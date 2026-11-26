# 🎯 Dartbox

**Turn a small PC (e.g. a Dell Wyse thin client) into a plug-and-play box for your [Autodarts](https://autodarts.io) board – with or without a screen, online or completely offline.**

[![CI](https://github.com/ChrisRich3105/dartbox/actions/workflows/ci.yml/badge.svg)](https://github.com/ChrisRich3105/dartbox/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/ChrisRich3105/dartbox)](https://github.com/ChrisRich3105/dartbox/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Buy me a coffee](https://img.shields.io/badge/☕-Buy%20me%20a%20coffee-ffdd00)](https://www.buymeacoffee.com/chrisrich3105)

- Plug in a monitor → it shows Autodarts (or the offline playroom) fullscreen.
- No monitor → it runs headless; you use your phone.
- No known WiFi → it opens its own hotspot with a setup page.
- No internet / no Autodarts subscription needed for the built-in **local playroom** with 9 games, 6 training modes and statistics.
- Updates itself from GitHub releases – with release notes, one-click update and automatic rollback.
- English and **German** (Deutsch) – UI and caller. 🇩🇪 [Kurzanleitung auf Deutsch](README.de.md)

> Dartbox is a community project and **not affiliated with Autodarts**. It installs the official Autodarts board client and uses its local interface.

---

## Contents

- [What you get](#what-you-get)
- [Ways to use it](#ways-to-use-it)
- [Hardware](#hardware)
- [Installation](#installation)
- [First start](#first-start)
- [Using Dartbox](#using-dartbox)
- [Getting back into setup mode (reset)](#getting-back-into-setup-mode-reset)
- [Updates and rollback](#updates-and-rollback)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [For developers](#for-developers)
- [Support the project](#support-the-project)

---

## What you get

| | |
|---|---|
| **Hub** – `http://dartbox.local/` | One page for everything: open Autodarts, the board manager or the local playroom, control what the box's screen shows from your phone, WiFi setup, updates. |
| **Local playroom** – `http://dartbox.local:8081/` | X01, Cricket, Around the Clock, Shanghai, Killer, Halve-It, Count Up, Baseball, Gotcha + training (Bob's 27, doubles, checkouts, target practice, …) with per-player statistics. Works offline. |
| **WiFi setup hotspot** | No known network? The box opens `Dartbox-xxxx`; your phone shows the setup page automatically. |
| **Kiosk mode** | With a monitor: fullscreen browser, no desktop, a 🎯 button to get back to the hub. |
| **Reset without keyboard** | Power button 3× = setup mode, 5× = forget all WiFi, or a USB stick. |
| **Online updates** | New GitHub release → shown in the hub with its notes → update with one click → self-test → automatic rollback if anything fails. |

## Ways to use it

### With a screen or headless

| | **With a screen** (TV/monitor on HDMI/DP) | **Headless** (no screen) |
|---|---|---|
| After boot | Fullscreen browser opens the start page (Autodarts by default) | Nothing to see – the box just works |
| You control it with | Touchscreen, mouse/keyboard – or your phone | Your phone / PC: `http://dartbox.local/` |
| WiFi setup | On screen (hub → WiFi) or via the hotspot | Via the `Dartbox-xxxx` hotspot |
| Back to the hub | 🎯 button bottom-left on every page | – |

You don't have to decide: the box checks for a connected monitor and starts the kiosk as soon as one is plugged in.

### Online with Autodarts or local playroom

| | **Autodarts online** (play.autodarts.io) | **Local playroom** (on the box) |
|---|---|---|
| Needs | Internet + Autodarts account (and their plans) | Nothing – works offline, no account |
| Games | Everything Autodarts offers, online matches, lobbies | 9 local games + 6 training modes, 1–8 players at the board |
| Dart detection | Autodarts board client | The same board client, read locally (`:3180`) |
| Input without cameras | – | Touch keypad on screen or your phone as remote keypad |
| Statistics | In your Autodarts account | On the box, per player |

Switch between them any time from the hub. To make the playroom the start page of the screen, set `KIOSK_START=playroom` (see [Configuration](#configuration)).

## Hardware

- **PC:** any x86-64 mini PC; tested target is the **Dell Wyse 5070** (Pentium/Celeron J5005, 4–8 GB). A Wyse 3040 is too weak for three cameras plus a browser.
- **Cameras:** as required by Autodarts (usually 3 USB cameras). Use different USB controllers / a powered hub.
- **WiFi or Ethernet.** Ethernet is the most robust; WiFi works with the hotspot setup.
- **Optional:** monitor/TV, touchscreen, USB keyboard.

## Installation

### 1. Install Debian

Install **Debian 12 or 13 (amd64 "netinst")**: [debian.org/download](https://www.debian.org/download).

- Boot the Wyse from the USB stick (**F12** at the Dell logo for the boot menu).
- *Software selection:* untick **Debian desktop environment** and **GNOME**; tick **SSH server** and **standard system utilities**. (If a desktop gets installed anyway, Dartbox switches its autostart off.)
- Create a normal user (e.g. `darts`). Set up WiFi if you like – it is taken over automatically.

### 2. Install Dartbox

Log in on the box (or via `ssh <user>@<ip-of-the-box>`) and run **one** of these:

```bash
# your user may use sudo:
curl -fsSL https://raw.githubusercontent.com/ChrisRich3105/dartbox/main/get.sh | sudo bash

# Debian with a root password (no sudo yet):
curl -fsSL https://raw.githubusercontent.com/ChrisRich3105/dartbox/main/get.sh -o get.sh
su - -c "bash $PWD/get.sh --user $USER"
```

This downloads the newest release and installs:
the hub, playroom, WiFi manager, kiosk, power-button handler, update service, the packages they need (Chromium, cage, NetworkManager, …) **and the Autodarts board client** for your user.
It also adds your user to the `sudo` group, sets the hostname to `dartbox` and switches off a desktop's autostart.

<details><summary>Installer options / installing from a downloaded copy</summary>

```bash
# from a copy of this repository (zip, git clone or scp):
cd dartbox
sudo bash install.sh            # or: su - -c "bash $PWD/install.sh --user $USER"
```

| Option | Effect |
|---|---|
| `--user NAME` | user that gets the Autodarts client (default: who called sudo / owner of the folder) |
| `--no-autodarts` | don't install the Autodarts client |
| `--keep-desktop` | leave a desktop environment's autostart alone (it will fight the kiosk for the screen) |
| `--no-sudo-group` | don't add the user to the `sudo` group |
| `--no-voice` | don't download the natural caller voices (~170 MB) |
| `--hostname NAME` | network name, e.g. `autodarts` → `http://autodarts.local/` (default on a fresh install: `dartbox`; updates keep the current name) |
| `DARTBOX_HOSTNAME=name` | other hostname than `dartbox` (environment variable) |

The installer can be re-run any time; settings, players and statistics are kept.
</details>

### 3. Connect Autodarts (one time, needs you)

The Autodarts board client is signed in and turned into a boot service from its own screen – this part can't be automated. **Log out and in again**, then:

```bash
autodarts
```

Sign in / link your board, then open the **Service** section and install the service. Afterwards the board manager runs at every boot on `http://dartbox.local:3180/` – calibrate your cameras there.

### 4. Reboot

```bash
sudo reboot
```

## First start

- **With Ethernet or a WiFi from the Debian installer:** after about a minute, open `http://dartbox.local/` (or `http://<ip-of-the-box>/`).
- **Without a known network:** after 90 seconds the box opens the WiFi **`Dartbox-xxxx`** (password **`dartsetup`**). Join it with your phone; the setup page opens by itself (otherwise open `http://10.42.0.1/`). Pick your WiFi, enter the password – done. Your phone goes back to your normal WiFi; the box is now at `http://dartbox.local/`.

> ⚠️ Change the hotspot password (`HOTSPOT_PASSWORD`) if the box is used anywhere public.

## Using Dartbox

### The hub – `http://dartbox.local/`

| Tab | |
|---|---|
| **Home** | Tiles for *Autodarts*, *Board manager* and *Local playroom*. On a phone, **Show on the dartbox screen** switches what the monitor shows (Autodarts / board manager / playroom / hub / reload). |
| **Board** | The Autodarts board manager (cameras, calibration). |
| **WiFi** | Connect to a network, setup mode, forget all networks. |
| **System** | Installed version, updates with release notes, rollback. |

On the box's own screen, every page has a small **🎯** button bottom-left that brings you back to the hub (on the playroom, use the *Hub* link at the top instead – the 🎯 would cover the keypad).

### The local playroom – `http://dartbox.local:8081/`

**Games**

| Game | Options |
|---|---|
| X01 | 101 – 1001 · straight / double / master in · double / straight / master out · legs and sets · round limit · checkout suggestions |
| Cricket | standard / cut-throat / no-score · 15–20 + Bull, Tactics (10–20 + Bull) or 6 random numbers · legs/sets · round limit |
| Around the Clock | 1→20, 20→1 or random · any / singles / doubles / trebles · doubles/trebles skip ahead · finish on bull |
| Shanghai | 7, 10 or 20 rounds · Shanghai = instant win or just points |
| Killer | 1/3/5/7 lives · doubles only or whole number · self-hit costs a life or not |
| Halve-It | classic, Bermuda Triangle or 12-round variant · start at 0 or 40 |
| Count Up | 5–20 rounds |
| Baseball | 9 innings · extra innings on a tie · optional bull runs |
| Gotcha | 201 / 301 / 501 |

**Training** (1–4 players, everything goes into the statistics): Solo X01, Bob's 27, Doubles practice (hit rate per double), Checkout practice (random finishes from a range, 3/6/9 darts), Target practice (T20, T19, bull, … – hit % and points per visit), Around the Clock (darts needed).

**Players** – every name entered is remembered and offered as one-tap chips (most recently used first); line-up and settings are remembered per game.

**Look and sound** – a live dartboard next to the scoreboard shows your darts and what to aim for (checkout route, open cricket numbers, training target). 180s, ton-plus scores, checkouts and wins get celebrations with confetti; sounds for darts, hits, busts and wins; an optional caller ("you require 32"); a chart and hit map after every game.
Everything can be switched off in **⚙ Settings** (per device, so the box's screen and your phone can be set up differently):

| Setting | |
|---|---|
| Sounds, volume | master switch for everything audible |
| Dart sounds / event sounds | per dart, or only bust / 180 / checkout / win / target hit |
| Language | Deutsch / English / automatic (browser language, or the box default `LANGUAGE`) |
| Caller · Voice | spoken scores on/off; **Voice** picks a natural voice of the box or one of this device's own voices, **▶ Listen** plays a sample (also while the caller is off) |
| Celebrations, confetti, animations | big messages, confetti, counting scores; animations follow the system's "reduce motion" setting |
| Dartboard view, on phones, show targets | the board panel (wide screens by default) and the target highlights |

**The caller** – on the box, Dartbox speaks with a natural neural voice ([Piper](https://github.com/rhasspy/piper), runs offline, no cloud): German "Thorsten" (emotional variant – an excited style for 180s, checkouts and wins) and British "Alan" in English. Big moments are louder, a touch faster and get some arena reverb; ton-forty-plus scores sometimes get praise ("Great darts!" / "Klasse Darts!"). Phrases are rendered once in the background and cached, so calls are instant. The natural voices are rendered on the box, so phones and PCs that open the playroom get them too. Each device chooses its voice in ⚙ Settings → Caller (*Automatic* = the box default). More voices to choose from: add their names to `CALLER_VOICES_EXTRA` in `/etc/dartbox/dartbox.conf` (suggestions are listed there, any voice from [piper-voices](https://huggingface.co/rhasspy/piper-voices) works) and re-run the installer; `CALLER_VOICE_DE` / `CALLER_VOICE_EN` set the default.

**Statistics** – per player: an all-time hit map ("where your darts land"), X01 average, first-9 average, checkout %, highest checkout, best leg, 180s / 140+ / 100+, Cricket MPR, Bob's 27, doubles heat map, checkout and target practice rates, trend charts, recent sessions (wrong records can be deleted).

**Entering darts**

- **Automatic:** with *Board on* (top right; on by default on the box's screen) darts detected by the Autodarts board are entered by themselves; pulling the darts out = next player.
- **Board panel:** tap the board chip (top right) for the board's status – live camera picture, detection, calibration per camera – and one-tap **Reset** (stuck takeout), **Calibrate**, **Start/Stop detection** and **Restart cameras**. The chip turns red when the board isn't calibrated or hangs in takeout for more than 20 s. Automatic detection is **on by default on every device** (the board belongs to the box); switch it off per device in the same panel. If a game is already running on another screen, you can take it over or join as remote keypad.
- **Keypad:** tap *Double* / *Treble*, then the number; *Next* = next player (missing darts count as misses). Tap a dart in the visit bar to correct it – also fixes wrong detections.
- **Phone as remote keypad:** open the playroom on your phone while a game runs on the screen → *Remote keypad*.
- **Keyboard:** Enter = next, Backspace = undo, D / T = double / treble, M = miss.

A running game survives a browser or box restart.

## Getting back into setup mode (reset)

| How | Effect |
|---|---|
| **Power button 3×** (within ~2 s) | Setup hotspot until a network is configured or the box reboots. Saved WiFi is kept. |
| **Power button 5×** | Forget **all** saved WiFi networks → hotspot. |
| Power button 1× | Clean shutdown (holding 4 s = hard power-off, as always). |
| **USB stick** with an empty file `dartbox-reset` | Forget all WiFi → hotspot. |
| USB stick with a file `dartbox-hotspot` | Hotspot only, WiFi kept. |
| USB stick with `dartbox-wifi.txt` (`SSID=…` and `PASSWORD=…` lines) | Connect to that network directly – no phone needed. |
| Hub → WiFi → *Setup mode* / *Forget all WiFi* | same as 3× / 5× |
| Automatic | Known WiFi gone for 90 s → hotspot. With no phone connected, the box retries the saved networks every 5 minutes (e.g. after a router restart). |

## Updates and rollback

Dartbox updates itself from the **releases of this GitHub repository**.

1. The box looks for a new release a few minutes after boot and every 6 hours (or press **Check for updates** in hub → System).
2. A new version shows up as a banner in the hub (and a hint in the playroom) with **its release notes** – for every version between yours and the newest.
3. **Update** → the box
   - downloads the release,
   - backs up settings, players and statistics (`/var/lib/dartbox/backups/`),
   - installs it,
   - runs a **self-test** (all services up, hub and playroom answering).
4. If installing or the self-test fails, it **goes back to the previous version automatically** and restores the backup.
5. Not happy with a new version? **Roll back** (hub → System) returns to the previous one at any time; statistics recorded since the update are kept.

From the command line:

```bash
sudo dartbox-update check       # look for a new release
sudo dartbox-update apply       # install the newest (or: apply v1.2.0)
sudo dartbox-update rollback    # back to the previous version
dartbox-update status           # what's installed / available / last result
sudo dartbox-selftest           # run the self-test by hand
```

Every installed version is kept in `/opt/dartbox/versions/` (the active one, the previous one and one older).
`UPDATE_CHANNEL=beta` also offers pre-releases (`v1.3.0-beta.1`); `UPDATE_CHECK=0` turns automatic checks off.

## Configuration

Everything lives in **`/etc/dartbox/dartbox.conf`**. After a change: `sudo systemctl restart dartbox-web dartbox-netmgr dartbox-playroom dartbox-button`.

| Key | Default | |
|---|---|---|
| `HOTSPOT_SSID_PREFIX` | `Dartbox` | hotspot name (+ last 4 characters of the WiFi MAC) |
| `HOTSPOT_PASSWORD` | `dartsetup` | hotspot password (min. 8 characters; empty = open) |
| `CONNECT_GRACE` | `90` | seconds without network before the hotspot starts |
| `RETRY_INTERVAL` / `RETRY_TIMEOUT` | `300` / `45` | retrying saved WiFi while in hotspot mode |
| `KIOSK_START` | `autodarts` | what the screen opens after boot: `autodarts`, `playroom`, `board`, `hub` |
| `AUTODARTS_URL` | `https://play.autodarts.io` | |
| `BOARD_MANAGER_URL` | `http://localhost:3180` | Autodarts board manager (also the playroom's dart source) |
| `PLAYROOM_URL` | `http://localhost:8081/` | empty = hide the playroom |
| `POWER_BUTTON_ENABLED` | `1` | `0` = normal power button behaviour |
| `LANGUAGE` | `auto` | default language of hub and playroom: `auto` (browser), `de`, `en`; each device can override it in ⚙ Settings |
| `CALLER_VOICE_DE` / `CALLER_VOICE_EN` | `de_DE-thorsten_emotional-medium` / `en_GB-alan-medium` | default natural caller voice per language (Piper); empty = device voice |
| `CALLER_VOICES_EXTRA` | *(empty)* | more Piper voices to download, space separated – selectable per device in the playroom |
| `UPDATE_CHECK` | `1` | automatic update checks |
| `UPDATE_CHANNEL` | `stable` | `beta` = also pre-releases |
| `UPDATE_REPO` | from `release.conf` | install updates from a fork (`owner/name`) |

Your data: `/var/lib/dartbox/playroom/` (players and statistics) – back it up if you care about your stats.

## Troubleshooting

| Problem | Fix |
|---|---|
| `»user« ist nicht in der sudoers-Datei` / *not in the sudoers file* | Use the `su - -c "…"` variant of the command (root password). After the first install your user is in the `sudo` group (log out and in again). |
| `useradd: command not found` with `su -c` | Use `su - -c` (with the dash) – it loads root's full PATH. |
| Board manager `:3180` refuses the connection | The Autodarts service isn't installed or running: log in as your user, run `autodarts`, install the service in its **Service** section. Check with `systemctl --user status autodarts`. |
| `autodarts` exits immediately without output | It needs a real terminal: use `ssh -t …` or log in directly on the box. Try `autodarts --help`. |
| Playroom says *Board offline* | Board manager not running (see above). You can always use the keypad or your phone. |
| Board hangs in takeout / needs calibrating | Playroom → tap the board chip → **Reset** or **Calibrate** (take the darts out first). |
| Darts are not entered automatically although *Board on* | Board manager 2.0.x may not provide dart data locally – update it (`autodarts update`) or enter darts by keypad. |
| Screen stays black / shows a login | A desktop environment is still active: `sudo systemctl set-default multi-user.target && sudo systemctl disable display-manager` and reboot. |
| Box not reachable as `dartbox.local` | Some networks/Windows setups don't resolve `.local` – use the IP address (shown in your router or on the hub). Type it with a slash (`dartbox.local/`) so the browser doesn't search for it. With a FRITZ!Box, `http://dartbox/` usually works too. |
| Want another name (e.g. `autodarts.local`) | `sudo hostnamectl set-hostname autodarts && sudo systemctl restart avahi-daemon` – updates keep it. |
| No sound / no caller on the box's screen | Check ⚙ Settings in the playroom (sounds and caller on, volume) and that the TV/monitor has audio over HDMI/DP and isn't muted. After installing, reboot once (PipeWire). Natural voice missing? `ls /var/lib/dartbox/voices` – re-run the installer to download it. |
| Something else | `sudo dartbox-selftest`, and the logs: `journalctl -u 'dartbox-*' -b` |

Commands in Windows **Command Prompt**: quotes and `|` inside ssh commands get mangled – rather log in with `ssh user@ip` and type the commands on the box.

## For developers

```
install.sh                  installer (also used by the updater with --update)
get.sh                      one-line installer: newest release from GitHub -> install.sh
VERSION / release.conf      version of this tree / GitHub repo + support link
bin/dartbox-netmgr          WiFi watchdog + hotspot state machine
bin/dartbox-web             hub, WiFi setup, captive portal, screen remote, update API (:80)
bin/dartbox-playroom        playroom server: players, history, board proxy, remote input (:8081)
bin/dartbox-update          online updates: check / apply / rollback
bin/dartbox-selftest        post-update self-test
bin/dartbox-kiosk           monitor detection + cage/Chromium
bin/dartbox-button          power-button multi-press
bin/dartbox-usbreset        USB stick reset/config (udev)
bin/dartbox-ctl             small CLI (status / hotspot / forget / connect)
lib/dartbox_common.py       shared helpers
webui/index.html            the hub
playroom/                   playroom web app (plain ES modules, no build step):
                              engine/games/training = rules, dartboard/charts/fx/sound = presentation
kiosk-extension/            Chromium extension: 🎯 button + remote screen switching
fonts/                      bundled web fonts (DejaVu Sans + Noto Emoji subsets) and build-fonts.py
systemd/, config/           units, udev rule, default config
tests/                      static checks + game engine tests (also run in CI)
```

**Tests**

```bash
bash tests/check-scripts.sh          # Python compiles, shell scripts parse, JSON valid
node tests/run-engine-tests.mjs      # 90+ rule checks for all games and training modes
```

**Making a release**

1. Bump `VERSION` (e.g. `1.1.0`).
2. Add a `## v1.1.0 – YYYY-MM-DD` section to `CHANGELOG.md` – it becomes the release notes users see before updating.
3. Commit, then tag and push:
   ```bash
   git tag v1.1.0 && git push && git push --tags
   ```
4. GitHub Actions runs the tests and publishes the release. Boxes offer it within a few hours.

Tags with a suffix (`v1.1.0-beta.1`) become pre-releases and are only offered to boxes with `UPDATE_CHANNEL=beta`.

**Forking:** change `GITHUB_REPO` and `SUPPORT_URL` in `release.conf` and the links in this README.

Pull requests and bug reports are welcome – please describe your hardware and Autodarts version.

## Support the project

Dartbox is free and open source. If it saves you an evening of tinkering or you simply enjoy it, you can buy me a coffee:

[![Buy me a coffee](https://img.shields.io/badge/☕-Buy%20me%20a%20coffee-ffdd00?style=for-the-badge)](https://www.buymeacoffee.com/chrisrich3105)

The link also appears in the hub (System tab and page footer) and in the playroom.

## License

[MIT](LICENSE). The caller voices are downloaded at install time from their original sources and keep their own licenses (Thorsten: CC0; Alan: see [piper-voices](https://huggingface.co/rhasspy/piper-voices)); Piper itself is MIT-licensed. Autodarts is a trademark of its respective owners; this project is not affiliated with or endorsed by Autodarts.
