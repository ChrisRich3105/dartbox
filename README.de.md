# 🎯 Dartbox – Kurzanleitung auf Deutsch

Dartbox macht aus einem kleinen PC (z. B. einem Dell Wyse Thin Client) eine fertige Box für dein [Autodarts](https://autodarts.io)-Board – mit oder ohne Bildschirm, online oder ganz offline.
Die ausführliche Anleitung (englisch) steht in der [README.md](README.md).

> Dartbox ist ein Community-Projekt und **nicht mit Autodarts verbunden**. Es installiert den offiziellen Autodarts-Client und nutzt dessen lokale Schnittstelle.

## Was du bekommst

- **Mit Bildschirm:** Vollbild-Browser mit Autodarts oder dem lokalen Playroom. **Ohne Bildschirm:** alles übers Handy.
- **WLAN-Einrichtung per Hotspot:** kein bekanntes WLAN? Die Box öffnet `Dartbox-xxxx` (Passwort `dartsetup`), die Einrichtungsseite erscheint auf dem Handy von selbst.
- **Hub** unter `http://dartbox.local/` – Autodarts, Board Manager, Playroom, WLAN, Updates.
- **Lokaler Playroom** unter `http://dartbox.local:8081/` – X01, Cricket, Around the Clock, Shanghai, Killer, Halve-It, Count Up, Baseball, Gotcha und sechs Trainingsmodi mit Statistik. Ohne Internet und ohne Autodarts-Abo.
- **Caller mit natürlicher Stimme** („Hundertachtzig!“, „Anna, du brauchst 32.“), Jubel-Effekte, Töne, Dartboard-Ansicht – alles einzeln abschaltbar.
- **Online-Updates** mit Versionshinweisen, Selbsttest und automatischem Zurückrollen.

## Installation

1. **Debian 12 oder 13 (amd64, „netinst“)** installieren. Bei der Softwareauswahl **keine** Desktop-Umgebung, nur *SSH-Server* und *Standard-Systemwerkzeuge*.
2. Auf der Box (oder per `ssh benutzer@ip-der-box`):
   ```bash
   # wenn dein Benutzer sudo darf:
   curl -fsSL https://raw.githubusercontent.com/ChrisRich3105/dartbox/main/get.sh | sudo bash

   # sonst (Debian mit root-Passwort):
   curl -fsSL https://raw.githubusercontent.com/ChrisRich3105/dartbox/main/get.sh -o get.sh
   su - -c "bash $PWD/get.sh --user $USER"
   ```
   Das installiert alles – auch den Autodarts-Client und die Caller-Stimmen.
3. **Autodarts einmalig verbinden:** ab- und wieder anmelden, dann `autodarts` starten, anmelden/Board verknüpfen und im Bereich **Service** den Dienst installieren.
4. `sudo reboot`

**Sprache:** folgt dem Browser. Für die ganze Box fest auf Deutsch: in `/etc/dartbox/dartbox.conf` `LANGUAGE=de` setzen. Pro Gerät: Playroom → ⚙ Einstellungen → Sprache.

## Zurück in den Einrichtungsmodus

| So | Wirkung |
|---|---|
| **Power-Taste 3×** | Einrichtungs-Hotspot (gespeicherte WLANs bleiben) |
| **Power-Taste 5×** | Alle WLANs vergessen → Hotspot |
| Power-Taste 1× | Sauber herunterfahren |
| USB-Stick mit leerer Datei `dartbox-reset` | Alle WLANs vergessen → Hotspot |
| USB-Stick mit `dartbox-wifi.txt` (`SSID=…` / `PASSWORD=…`) | Direkt mit diesem WLAN verbinden |

## Updates

Neue Versionen erscheinen im Hub unter **System** mit den Neuigkeiten. **Update** installiert sie: vorher ein Backup, danach ein Selbsttest – schlägt etwas fehl, geht die Box automatisch auf die alte Version zurück. **Zurückrollen** geht jederzeit von Hand.

## Hilfe

| Problem | Lösung |
|---|---|
| „nicht in der sudoers-Datei“ | Die `su - -c "…"`-Variante nehmen (root-Passwort). Nach der Installation darf dein Benutzer sudo (neu anmelden). |
| Board Manager `:3180` nicht erreichbar | Autodarts-Dienst fehlt: `autodarts` starten → **Service** → installieren. |
| `dartbox.local` geht nicht | IP-Adresse nehmen, oder mit Schrägstrich tippen: `dartbox.local/`. Bei einer FRITZ!Box klappt meist auch `http://dartbox/`. |
| Kein Ton am Fernseher | Playroom → ⚙ Einstellungen (Töne/Caller an, Lautstärke), Ton am TV über HDMI/DP prüfen, nach der Installation einmal neu starten. |

## Unterstützen

Dartbox ist kostenlos und Open Source. Wenn es dir gefällt: [☕ Spendier mir einen Kaffee](https://www.buymeacoffee.com/chrisrich3105)
