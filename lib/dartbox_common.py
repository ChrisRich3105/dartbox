"""Shared helpers for the dartbox services (config, nmcli wrappers, state files)."""
import json
import os
import subprocess
import time

CONF_PATH = "/etc/dartbox/dartbox.conf"
RUN_DIR = "/run/dartbox"
STATE_DIR = "/var/lib/dartbox"
HOTSPOT_CON = "dartbox-hotspot"

# Flag files
FORCE_HOTSPOT = os.path.join(RUN_DIR, "force-hotspot")      # cleared on reboot
SCAN_CACHE = os.path.join(RUN_DIR, "scan.json")
STATUS_FILE = os.path.join(RUN_DIR, "status.json")
LAST_ERROR = os.path.join(RUN_DIR, "last-error")

DEFAULTS = {
    "HOTSPOT_SSID_PREFIX": "Dartbox",
    "HOTSPOT_PASSWORD": "dartsetup",
    "HOTSPOT_ADDRESS": "10.42.0.1",
    "CONNECT_GRACE": "90",
    "RETRY_INTERVAL": "300",
    "RETRY_TIMEOUT": "45",
    "AUTODARTS_URL": "https://play.autodarts.io",
    "BOARD_MANAGER_URL": "http://localhost:3180",
    "PLAYROOM_URL": "http://localhost:8081/",
    "KIOSK_START": "autodarts",
    "POWER_BUTTON_ENABLED": "1",
    "LANGUAGE": "auto",
    "CALLER_VOICE_DE": "de_DE-thorsten_emotional-medium",
    "CALLER_VOICE_EN": "en_GB-alan-medium",
}


def view_urls(cfg):
    """Named pages the hub can open / show on the kiosk screen (kiosk-local URLs)."""
    return {
        "hub": "http://localhost/",
        "autodarts": cfg["AUTODARTS_URL"],
        "board": cfg["BOARD_MANAGER_URL"],
        "playroom": cfg["PLAYROOM_URL"],
    }


def read_kv(path):
    """Read a shell-style KEY=VALUE file (comments and blank lines ignored)."""
    out = {}
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip().strip('"').strip("'")
    except (FileNotFoundError, PermissionError):
        pass
    return out


def load_config():
    cfg = dict(DEFAULTS)
    cfg.update(read_kv(CONF_PATH))
    return cfg


SHARE_DIR = os.environ.get("DARTBOX_SHARE", "/usr/local/share/dartbox")


def release_info():
    """Installed version, update repo and support link (release.conf, overridable in dartbox.conf)."""
    rel = read_kv(os.path.join(SHARE_DIR, "release.conf"))
    cfg = load_config()
    try:
        with open(os.path.join(SHARE_DIR, "VERSION")) as f:
            version = f.read().strip()
    except OSError:
        version = "dev"
    repo = cfg.get("UPDATE_REPO") or rel.get("GITHUB_REPO", "")
    support = cfg.get("SUPPORT_URL", rel.get("SUPPORT_URL", ""))
    return {
        "version": version,
        "repo": "" if "YOUR_" in repo else repo,
        "support_url": "" if "YOUR_" in support else support,
        "channel": cfg.get("UPDATE_CHANNEL", "stable"),
        "check_enabled": cfg.get("UPDATE_CHECK", "1") == "1",
    }


def ensure_dirs():
    os.makedirs(RUN_DIR, exist_ok=True)
    os.makedirs(STATE_DIR, exist_ok=True)


def log(*args):
    print(time.strftime("%H:%M:%S"), *args, flush=True)


def run(args, timeout=30, check=False):
    """Run a command, return (rc, stdout, stderr)."""
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return 124, "", "timeout"
    if check and p.returncode != 0:
        raise RuntimeError(f"{' '.join(args)}: {p.stderr.strip()}")
    return p.returncode, p.stdout, p.stderr


def nm_split(line):
    """Split an `nmcli -t` line, honouring backslash escapes of ':'."""
    out, cur, esc = [], "", False
    for ch in line:
        if esc:
            cur += ch
            esc = False
        elif ch == "\\":
            esc = True
        elif ch == ":":
            out.append(cur)
            cur = ""
        else:
            cur += ch
    out.append(cur)
    return out


def wifi_iface():
    _, out, _ = run(["nmcli", "-t", "-f", "DEVICE,TYPE", "device"])
    for line in out.splitlines():
        dev, typ = nm_split(line)[:2]
        if typ == "wifi":
            return dev
    return None


def wifi_mac_suffix(iface):
    try:
        with open(f"/sys/class/net/{iface}/address") as f:
            return f.read().strip().replace(":", "")[-4:]
    except OSError:
        return "0000"


def active_connections():
    """List of (name, type, device) for active connections."""
    _, out, _ = run(["nmcli", "-t", "-f", "NAME,TYPE,DEVICE", "connection", "show", "--active"])
    res = []
    for line in out.splitlines():
        parts = nm_split(line)
        if len(parts) >= 3:
            res.append(tuple(parts[:3]))
    return res


def hotspot_active():
    return any(n == HOTSPOT_CON for n, _, _ in active_connections())


def online_connection():
    """Name of an active client connection (WiFi client or ethernet), or None."""
    for name, typ, dev in active_connections():
        if name == HOTSPOT_CON or typ in ("loopback", "bridge", "tun") or dev in ("lo", ""):
            continue
        if typ in ("802-11-wireless", "802-3-ethernet", "wifi", "ethernet"):
            return name
    return None


def saved_wifi_connections():
    _, out, _ = run(["nmcli", "-t", "-f", "NAME,TYPE", "connection", "show"])
    res = []
    for line in out.splitlines():
        name, typ = nm_split(line)[:2]
        if typ == "802-11-wireless" and name != HOTSPOT_CON:
            res.append(name)
    return res


def scan_networks(rescan=True):
    """Return list of dicts {ssid, signal, security}, strongest first, de-duplicated."""
    _, out, _ = run(["nmcli", "-t", "-f", "SSID,SIGNAL,SECURITY", "device", "wifi", "list",
                     "--rescan", "yes" if rescan else "no"], timeout=25)
    best = {}
    for line in out.splitlines():
        parts = nm_split(line)
        if len(parts) < 3 or not parts[0]:
            continue
        ssid, sig, sec = parts[0], int(parts[1] or 0), parts[2]
        if ssid not in best or best[ssid]["signal"] < sig:
            best[ssid] = {"ssid": ssid, "signal": sig, "security": sec}
    return sorted(best.values(), key=lambda n: -n["signal"])


def write_json(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f)
    os.replace(tmp, path)


def read_json(path, default=None):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def touch(path):
    with open(path, "w"):
        pass


def remove(path):
    try:
        os.remove(path)
    except FileNotFoundError:
        pass


def submit_request(req):
    """Hand a request to dartbox-netmgr (the only component that touches WiFi state)."""
    req_dir = os.path.join(RUN_DIR, "requests")
    os.makedirs(req_dir, mode=0o700, exist_ok=True)
    path = os.path.join(req_dir, f"{time.time_ns()}.json")
    fd = os.open(path + ".tmp", os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        json.dump(req, f)
    os.replace(path + ".tmp", path)


def forget_all_wifi():
    for name in saved_wifi_connections():
        run(["nmcli", "connection", "delete", name])
