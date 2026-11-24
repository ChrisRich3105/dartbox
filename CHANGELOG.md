# Changelog

All notable changes. The section of a version is used as its GitHub release notes
(and is what the box shows before you update), so write it for players, not developers.

Format: `## vX.Y.Z – YYYY-MM-DD`, newest first.

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
