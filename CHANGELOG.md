# Changelog

All notable changes. The section of a version is used as its GitHub release notes
(and is what the box shows before you update), so write it for players, not developers.

Format: `## vX.Y.Z – YYYY-MM-DD`, newest first.

## v1.3.1 – 2026-11-25

Cleaner charts and an easier caller setup.

- **Statistics and results charts redrawn:** real axes with round numbers, dates under the trend, no more stretched text or squashed dots, and a scale that no longer turns a small change into a cliff.
- **Tap or hover a chart** to read the exact value of every player at that point; *Show values* lists them as a table.
- Player colours are now a colour-blind-checked set.
- **Choosing the caller voice is simpler:** one *Caller* switch and one *Voice* list – the box's natural voices first, then the device's own voices – with an explanation of what you picked and a **▶ Listen** button that plays a sample (also while the caller is off). The old "Natural voice" switch is gone; your choice carries over.
- **More voices:** list extra Piper voices in `CALLER_VOICES_EXTRA` (`/etc/dartbox/dartbox.conf`, suggestions included) and re-run the installer – they show up in the list on every device.

## v1.3.0 – 2026-11-25

Board trouble? Fix it without leaving the game.

- **Board panel in the playroom:** tap the board chip (top right) to see what the Autodarts board is doing – live camera picture, detection running or stopped, calibration per camera, darts currently in the board.
- **One-tap fixes:** *Reset* (stuck takeout, wrongly detected darts), *Calibrate*, *Start/Stop detection* and *Restart cameras* right from the playroom – on the box's screen or your phone. No more detour via the hub and the board manager.
- **Warnings on the chip:** the chip turns red when the board is not calibrated or hangs in takeout for more than 20 seconds ("Takeout stuck? Tap").
- Switching automatic detection on/off for a device moved into the same panel.

## v1.2.0 – 2026-11-25

Jetzt auch auf Deutsch – and a caller with some energy.

- **German version:** the playroom (all games, training, statistics, settings) and the hub are available in German. Language follows the browser, can be set for the whole box (`LANGUAGE=de`) or per device in ⚙ Settings.
- **Natural caller voice:** the box now speaks with a neural voice (Piper TTS, runs offline) instead of the robotic system voice – German "Thorsten" with an excited style for 180s and checkouts, British "Alan" in English. Big moments get a louder, slightly faster delivery with a touch of arena reverb, plus a bit of praise ("Great darts!", "Klasse Darts!").
- **Caller in German:** "Hundertachtzig!", "Anna, du brauchst 32.", "Überworfen!", "gewinnt das Leg!"
- **Sound on the TV:** the installer adds PipeWire so the kiosk browser plays sound through HDMI/DisplayPort.
- New installer option `--no-voice` to skip the voice download (~170 MB).

## v1.1.0 – 2026-11-25

Looks and sounds like a real darts night – and every bit of it can be switched off.

- **Live dartboard** next to the scoreboard: your darts appear where they landed, and the board shows what to aim for (checkout route, open cricket numbers, the current training target).
- **Celebrations:** 180s, ton-plus scores, checkouts, Shanghai, white horse, killers and wins get a big on-screen moment – confetti included. Busts shake.
- **Sounds:** dart hits, target hits, bust, 180 fanfare, checkout and win jingles – made in the browser, no sound files.
- **Caller (optional):** scores, "you require 32", "game shot and the leg" in an English voice.
- **Animated scores:** the remaining score counts down instead of jumping.
- **After every game:** a chart of how the leg went and a hit map per player.
- **Statistics:** "Where your darts land" – your all-time hit map.
- **⚙ Settings page** in the playroom: sounds, volume, caller, voice, celebrations, confetti, animations, dartboard view and targets – saved per device, so the box's screen and your phone can differ.
- **Installer:** keeps the box's network name on updates (choose one with `--hostname`), installs a voice for the caller.

## v1.0.0 – 2026-11-24

First public release.

- **Headless or with a screen** – the same box works with and without a monitor; with a monitor it shows a fullscreen browser (kiosk).
- **WiFi setup hotspot** – no known WiFi? The box opens the `Dartbox-xxxx` hotspot with a setup page that opens by itself on your phone.
- **Reset without a keyboard** – press the power button 3× (setup mode) or 5× (forget all WiFi), or use a USB stick.
- **Hub** at `http://dartbox.local/` – Autodarts, board manager and local playroom in one place; switch what the screen shows from your phone.
- **Local playroom** – X01, Cricket, Around the Clock, Shanghai, Killer, Halve-It, Count Up, Baseball, Gotcha and six training modes, without the Autodarts cloud. Darts come in automatically from the Autodarts board, or via touch keypad / phone.
- **Statistics** per player – averages, checkout %, doubles heat map, training trends.
- **Online updates** – new releases show up in the hub with their release notes; update with one click, automatic rollback if the self-test fails.
- **One installer** – also installs the Autodarts board client.
