#!/bin/bash
# Dartbox installer - run as root on Debian 12/13 (amd64), e.g.
#     sudo bash install.sh            (if your user may use sudo)
#     su - -c "bash $PWD/install.sh"   (with the root password)
# Safe to re-run: updates scripts, keeps /etc/dartbox/dartbox.conf, players and statistics.
#
# Options:
#   --user NAME       the normal login user that owns Autodarts (default: who called sudo/su,
#                     else the owner of this folder)
#   --no-autodarts    don't install the Autodarts board client
#   --keep-desktop    don't switch off a desktop environment (it would fight the kiosk for the screen)
#   --no-sudo-group   don't add the user to the sudo group
#   --no-voice        don't download the natural caller voices (Piper TTS, ~170 MB)
#   --hostname NAME   network name of the box (default on a fresh install: dartbox -> dartbox.local);
#                     re-runs and updates keep whatever name the box has
#   --update          non-interactive update mode (used by dartbox-update): only refreshes the
#                     dartbox files and services, leaves Autodarts / desktop / sudo alone
set -euo pipefail
cd "$(dirname "$0")"
# "su -c" (without "-") keeps the normal user's PATH, which lacks useradd/usermod/runuser
export PATH="/usr/local/sbin:/usr/sbin:/sbin:$PATH"

HOSTNAME_NEW="${DARTBOX_HOSTNAME:-}"
KIOSK_USER=dartbox
WITH_AUTODARTS=1
KEEP_DESKTOP=0
SUDO_GROUP=1
UPDATE_MODE=0
WITH_VOICE=1
OWNER_USER="${SUDO_USER:-}"
while [ $# -gt 0 ]; do
    case "$1" in
        --user) OWNER_USER="$2"; shift ;;
        --no-autodarts) WITH_AUTODARTS=0 ;;
        --keep-desktop) KEEP_DESKTOP=1 ;;
        --no-sudo-group) SUDO_GROUP=0 ;;
        --update) UPDATE_MODE=1 ;;
        --no-voice) WITH_VOICE=0 ;;
        --hostname) HOSTNAME_NEW="$2"; shift ;;
        -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
    shift
done
[ "$(id -u)" -eq 0 ] || { echo "Please run as root:  sudo bash install.sh   or   su - -c \"bash $PWD/install.sh\""; exit 1; }
# su doesn't set SUDO_USER: use the user remembered from an earlier install, else the folder owner
if [ -z "$OWNER_USER" ] || [ "$OWNER_USER" = root ]; then
    OWNER_USER=$(cat /etc/dartbox/owner 2>/dev/null || true)
fi
if [ -z "$OWNER_USER" ] || [ "$OWNER_USER" = root ]; then
    OWNER_USER=$(stat -c %U "$PWD")
fi
if [ "$OWNER_USER" = root ] || ! id "$OWNER_USER" >/dev/null 2>&1; then
    OWNER_USER=""
fi
TODO=()   # manual steps printed at the end
VERSION=$(tr -d '[:space:]' < VERSION 2>/dev/null || echo dev)
echo "==> Dartbox $VERSION"

echo "==> Installing packages"
apt_install() {
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    network-manager iw wireless-regdb python3 curl ca-certificates avahi-daemon \
    cage chromium fonts-dejavu-core xwayland dbus-user-session sudo speech-dispatcher espeak-ng pipewire pipewire-pulse pipewire-alsa wireplumber \
    firmware-iwlwifi firmware-atheros firmware-realtek 2>/dev/null \
  || DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    network-manager iw wireless-regdb python3 curl ca-certificates avahi-daemon \
    cage chromium fonts-dejavu-core xwayland dbus-user-session sudo speech-dispatcher espeak-ng pipewire pipewire-pulse pipewire-alsa wireplumber
}
# (firmware packages need "non-free-firmware" in sources.list - second attempt skips them)
if [ "$UPDATE_MODE" = 1 ]; then
    apt_install || echo "    (package update failed - continuing with what is installed)"
else
    apt_install
fi

# Name the box only on a fresh install or when asked to - never rename it behind the user's back
if [ -z "$HOSTNAME_NEW" ] && [ "$UPDATE_MODE" = 0 ] && [ ! -f /etc/dartbox/dartbox.conf ]; then
    HOSTNAME_NEW=dartbox
fi
if ! [[ -z "$HOSTNAME_NEW" || "$HOSTNAME_NEW" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$ ]]; then
    echo "Invalid hostname '$HOSTNAME_NEW' (letters, digits and '-' only)"; exit 1
fi
if [ -n "$HOSTNAME_NEW" ] && [ "$(hostname)" != "$HOSTNAME_NEW" ]; then
    echo "==> Hostname: $HOSTNAME_NEW"
    hostnamectl set-hostname "$HOSTNAME_NEW"
    sed -i "s/^127\.0\.1\.1.*/127.0.1.1\t$HOSTNAME_NEW/" /etc/hosts
    grep -q "^127.0.1.1" /etc/hosts || echo -e "127.0.1.1\t$HOSTNAME_NEW" >> /etc/hosts
    systemctl try-restart avahi-daemon 2>/dev/null || true
fi
HOSTNAME_NEW=$(hostname)

echo "==> Kiosk user"
id "$KIOSK_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$KIOSK_USER"
usermod -aG video,render,input,audio "$KIOSK_USER" 2>/dev/null || usermod -aG video,input,audio "$KIOSK_USER"

if [ "$UPDATE_MODE" = 0 ] && [ -n "$OWNER_USER" ] && [ "$SUDO_GROUP" = 1 ] && ! id -nG "$OWNER_USER" | grep -qw sudo; then
    echo "==> Allowing '$OWNER_USER' to use sudo (takes effect at next login)"
    usermod -aG sudo "$OWNER_USER"
fi

echo "==> Keeping a copy of this version for updates/rollback: /opt/dartbox/versions/$VERSION"
install -d /opt/dartbox/versions /var/lib/dartbox/update /var/lib/dartbox/backups
DEST="/opt/dartbox/versions/$VERSION"
if [ "$(realpath "$PWD")" != "$(realpath -m "$DEST")" ]; then
    rm -rf "$DEST.tmp" && mkdir -p "$DEST.tmp"
    tar --exclude=.git -cf - . | tar -xf - -C "$DEST.tmp"
    rm -rf "$DEST" && mv "$DEST.tmp" "$DEST"
fi
OLD=$(basename "$(readlink -f /opt/dartbox/current 2>/dev/null || true)" 2>/dev/null || true)
if [ -n "$OLD" ] && [ "$OLD" != "$VERSION" ] && [ "$OLD" != current ] && [ -d "/opt/dartbox/versions/$OLD" ]; then
    echo "$OLD" > /var/lib/dartbox/update/previous
fi
ln -sfn "$DEST" /opt/dartbox/current

echo "==> Files"
install -d /usr/local/lib/dartbox /usr/local/share/dartbox /etc/dartbox /var/lib/dartbox
[ -n "$OWNER_USER" ] && echo "$OWNER_USER" > /etc/dartbox/owner
install -m 644 VERSION release.conf /usr/local/share/dartbox/
install -m 644 lib/dartbox_common.py /usr/local/lib/dartbox/
install -m 644 webui/index.html /usr/local/share/dartbox/
install -d /usr/local/share/dartbox/kiosk-extension
install -m 644 kiosk-extension/* /usr/local/share/dartbox/kiosk-extension/
install -d /usr/local/share/dartbox/playroom/js /var/lib/dartbox/playroom
install -m 644 playroom/index.html playroom/app.css /usr/local/share/dartbox/playroom/
install -m 644 playroom/js/*.js /usr/local/share/dartbox/playroom/js/
for f in bin/*; do install -m 755 "$f" /usr/local/bin/; done
[ -f /etc/dartbox/dartbox.conf ] || install -m 600 config/dartbox.conf /etc/dartbox/
install -m 644 systemd/*.service systemd/*.timer /etc/systemd/system/
install -m 644 config/99-dartbox-usb.rules /etc/udev/rules.d/

echo "==> NetworkManager config"
install -d /etc/NetworkManager/conf.d /etc/NetworkManager/dnsmasq-shared.d
cat > /etc/NetworkManager/conf.d/dartbox.conf <<'EOF'
[connection]
# Disable WiFi power saving - avoids lag/disconnects with the Autodarts server
wifi.powersave=2
EOF
# Captive portal: while the hotspot is active, every DNS name resolves to the box
. /etc/dartbox/dartbox.conf
echo "address=/#/${HOTSPOT_ADDRESS:-10.42.0.1}" > /etc/NetworkManager/dnsmasq-shared.d/dartbox-captive.conf

# Debian installer puts WiFi into /etc/network/interfaces -> NetworkManager would
# ignore the adapter. Move such a WiFi config into NetworkManager instead.
if grep -qE '^\s*(allow-hotplug|auto|iface)\s+wl' /etc/network/interfaces 2>/dev/null; then
    echo "==> Migrating WiFi config from /etc/network/interfaces to NetworkManager"
    cp -n /etc/network/interfaces /etc/network/interfaces.dartbox-backup
    SSID=$(sed -n 's/^\s*wpa-ssid\s\+//p' /etc/network/interfaces | head -n1 | sed 's/^"\(.*\)"$/\1/')
    PSK=$(sed -n 's/^\s*wpa-psk\s\+//p' /etc/network/interfaces | head -n1 | sed 's/^"\(.*\)"$/\1/')
    WL=$(grep -oE '^\s*iface\s+wl[a-z0-9]+' /etc/network/interfaces | awk '{print $2}' | head -n1)
    # Comment out the whole WiFi stanza (takes effect after reboot - keeps your SSH session alive now)
    awk -v wl="$WL" '
        /^[[:space:]]*(allow-hotplug|auto)[[:space:]]/ { if ($2==wl) { print "#dartbox# " $0; next } }
        /^[[:space:]]*iface[[:space:]]/ { inwl = ($2==wl) }
        /^[[:space:]]*$/ { inwl=0 }
        { if (inwl) print "#dartbox# " $0; else print }
    ' /etc/network/interfaces.dartbox-backup > /etc/network/interfaces
    if [ -n "$SSID" ]; then
        STATE=/var/lib/dartbox/pending-wifi
        printf 'SSID=%s\nPASSWORD=%s\n' "$SSID" "$PSK" > "$STATE"; chmod 600 "$STATE"
        echo "    WiFi '$SSID' will be added to NetworkManager on next boot."
    fi
fi

echo "==> Power button: let dartbox-button handle it instead of logind"
install -d /etc/systemd/logind.conf.d
cat > /etc/systemd/logind.conf.d/dartbox.conf <<'EOF'
[Login]
HandlePowerKey=ignore
EOF

# A desktop (GNOME, ...) would grab the screen and fight the kiosk browser.
if [ "$KEEP_DESKTOP" = 0 ] && [ "$UPDATE_MODE" = 0 ]; then
    if [ "$(systemctl get-default)" = graphical.target ] || [ -e /etc/systemd/system/display-manager.service ]; then
        echo "==> Switching off automatic desktop start (still installed; re-enable with:"
        echo "    systemctl set-default graphical.target && systemctl enable <gdm3|lightdm|sddm>)"
        systemctl set-default multi-user.target
        systemctl disable display-manager.service 2>/dev/null || true
    fi
fi

echo "==> Enabling services"
systemctl daemon-reload
udevadm control --reload-rules
systemctl enable NetworkManager avahi-daemon dartbox-import-wifi \
    dartbox-netmgr dartbox-web dartbox-button dartbox-kiosk dartbox-playroom dartbox-update-check.timer
# Older installs had no playroom configured: switch it on
if grep -q '^PLAYROOM_URL=$' /etc/dartbox/dartbox.conf; then
    sed -i 's#^PLAYROOM_URL=$#PLAYROOM_URL=http://localhost:8081/#' /etc/dartbox/dartbox.conf
fi
# Kiosk owns tty7; don't let a getty sit there
systemctl mask getty@tty7.service >/dev/null 2>&1 || true

# ---------------------------------------------------------------- Autodarts board client
# Autodarts v2 installs per user (~/.local/share/autodarts). Its boot service is a *user*
# service that the board's own screen creates after you sign in - that step needs you.
if [ "$WITH_AUTODARTS" = 1 ] && [ "$UPDATE_MODE" = 0 ]; then
    if [ -z "$OWNER_USER" ]; then
        echo "==> Autodarts: no normal user found - skipped (re-run with --user NAME)"
        TODO+=("Install Autodarts: re-run this installer with --user <your login name>")
    else
        UHOME=$(getent passwd "$OWNER_USER" | cut -d: -f6)
        if [ -x "$UHOME/.local/bin/autodarts" ]; then
            echo "==> Autodarts: already installed for '$OWNER_USER' (update with: autodarts update)"
        else
            echo "==> Installing Autodarts board client (headless) for '$OWNER_USER'"
            runuser -l "$OWNER_USER" -c 'curl -fsSL https://autodarts.sh/sh/install.sh | bash -s -- --headless' \
                || TODO+=("Autodarts download failed - check the internet connection and re-run the installer")
        fi
        # make the `autodarts` command available in the user's shells
        if ! grep -qs '.local/bin' "$UHOME/.profile"; then
            echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$UHOME/.profile"
            chown "$OWNER_USER": "$UHOME/.profile"
        fi
        # user services only run while the user is logged in - unless lingering is on
        echo "==> Autodarts: let '$OWNER_USER''s services start at boot without a login"
        loginctl enable-linger "$OWNER_USER"
        if [ ! -f "$UHOME/.config/systemd/user/autodarts.service" ]; then
            TODO+=("Set up Autodarts (one time): log in as '$OWNER_USER' via ssh, run  autodarts ,
     sign in / link your board, then open its 'Service' section and install the service.
     After that the board manager (http://$HOSTNAME_NEW.local:3180/) starts at every boot.")
        else
            echo "==> Autodarts: boot service already set up"
        fi
    fi
fi

# ---------------------------------------------------------------- natural caller voice (Piper TTS)
# Neural text-to-speech that runs offline on the box. Downloaded from the official sources
# (github.com/rhasspy/piper, huggingface.co/rhasspy/piper-voices); voices have their own licenses.
if [ "$WITH_VOICE" = 1 ]; then
    . /etc/dartbox/dartbox.conf
    PIPER_DIR=/opt/dartbox/piper
    VOICE_DIR=/var/lib/dartbox/voices
    install -d "$VOICE_DIR" /var/lib/dartbox/voice-cache
    if [ ! -x "$PIPER_DIR/piper" ]; then
        case "$(uname -m)" in
            x86_64) PARCH=x86_64 ;; aarch64|arm64) PARCH=aarch64 ;; armv7l) PARCH=armv7l ;; *) PARCH="" ;;
        esac
        if [ -n "$PARCH" ]; then
            echo "==> Installing Piper (natural caller voice engine)"
            if curl -fsSL --retry 3 "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_${PARCH}.tar.gz" \
                | tar -xz -C /opt/dartbox; then
                echo "    Piper installed in $PIPER_DIR"
            else
                echo "    (Piper download failed - the caller uses the browser voice; re-run the installer later)"
            fi
        fi
    fi
    for V in "${CALLER_VOICE_DE:-de_DE-thorsten_emotional-medium}" "${CALLER_VOICE_EN:-en_GB-alan-medium}"; do
        [ -n "$V" ] || continue
        [ -s "$VOICE_DIR/$V.onnx" ] && [ -s "$VOICE_DIR/$V.onnx.json" ] && continue
        # name = <lang>_<REGION>-<voice>-<quality>  ->  <lang>/<lang>_<REGION>/<voice>/<quality>/<name>.onnx
        CODE=${V%%-*}; REST=${V#*-}; QUAL=${REST##*-}; VNAME=${REST%-*}; LANG2=${CODE%%_*}
        URL="https://huggingface.co/rhasspy/piper-voices/resolve/main/$LANG2/$CODE/$VNAME/$QUAL/$V"
        echo "==> Downloading caller voice $V"
        if curl -fsSL --retry 3 -o "$VOICE_DIR/$V.onnx.part" "$URL.onnx" && curl -fsSL --retry 3 -o "$VOICE_DIR/$V.onnx.json" "$URL.onnx.json"; then
            mv "$VOICE_DIR/$V.onnx.part" "$VOICE_DIR/$V.onnx"
        else
            rm -f "$VOICE_DIR/$V.onnx.part"
            echo "    (download of $V failed - that language falls back to the browser voice)"
        fi
    done
fi

# Running services pick up the new files (no-op on a first install before the reboot)
echo "==> Restarting running dartbox services"
systemctl try-restart dartbox-web dartbox-playroom dartbox-netmgr dartbox-button dartbox-kiosk || true
systemctl start dartbox-update-check.timer 2>/dev/null || true

if [ "$UPDATE_MODE" = 1 ]; then
    echo "Dartbox updated to $VERSION."
    exit 0
fi

echo
echo "Dartbox $VERSION installed."
if [ ${#TODO[@]} -gt 0 ]; then
    echo
    echo "Still to do:"
    n=1
    for t in "${TODO[@]}"; do echo "  $n. $t"; n=$((n + 1)); done
fi
cat <<EOF

Then reboot:  sudo reboot

After reboot:
  - Hub from any device:   http://$HOSTNAME_NEW.local/      (or the box's IP address)
  - Local playroom:        http://$HOSTNAME_NEW.local:8081/
  - Autodarts board:       http://$HOSTNAME_NEW.local:3180/
  - With monitor:  browser opens Autodarts fullscreen (🎯 button bottom-left = back to hub).
  - No WiFi / reset:  join hotspot "${HOTSPOT_SSID_PREFIX:-Dartbox}-xxxx" (password: ${HOTSPOT_PASSWORD:-<open>})
                      and open http://${HOTSPOT_ADDRESS:-10.42.0.1}/
EOF
