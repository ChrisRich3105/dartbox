// Translations. English is the source language: t('English text {var}', {var}) and
// tr('string a game produced'). Game rules stay language-neutral (and testable);
// their texts are translated when they are shown.
let lang = 'en';

export const LANG_CHOICES = [['auto', 'Automatic'], ['de', 'Deutsch'], ['en', 'English']];

export function setLang(l) {
  lang = l === 'de' ? 'de' : 'en';
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}
export const getLang = () => lang;

/** pick 'de' or 'en' from a setting ('auto' | 'de' | 'en'), a server default and the browser */
export function resolveLang(setting, serverDefault) {
  if (setting === 'de' || setting === 'en') return setting;
  if (serverDefault === 'de' || serverDefault === 'en') return serverDefault;
  const nav = (typeof navigator !== 'undefined' && (navigator.language || '')) || '';
  return nav.toLowerCase().startsWith('de') ? 'de' : 'en';
}

export function t(key, vars = {}) {
  const s = lang === 'de' && DE[key] !== undefined ? DE[key] : key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
}

/** translate a string produced by the game engine (exact match, list or pattern) */
export function tr(s) {
  if (lang === 'en' || s === null || s === undefined || s === '') return s;
  s = String(s);
  if (DE[s] !== undefined) return DE[s];
  if (s.includes(' · ')) return s.split(' · ').map(tr).join(' · ');
  for (const [re, f] of RULES) {
    const m = s.match(re);
    if (m) return f(...m.slice(1));
  }
  return s;
}

// ------------------------------------------------------------------ patterns for engine strings
const RULES = [
  [/^Set (\d+) \(first to (\d+)\)$/, (a, b) => `Satz ${a} (auf ${b})`],
  [/^Leg (\d+) \(first to (\d+)\)$/, (a, b) => `Leg ${a} (auf ${b})`],
  [/^Round (\d+)\/(\d+)$/, (a, b) => `Runde ${a}/${b}`],
  [/^Round (\d+)$/, (a) => `Runde ${a}`],
  [/^Darts: (\d+)$/, (a) => `Darts: ${a}`],
  [/^Last: (.*)$/, (a) => `Zuletzt: ${a}`],
  [/^Target: (.*)$/, (a) => `Ziel: ${tr(a)}`],
  [/^(.*) – (.*) wins the leg$/, (a, b) => `${tr(a)} – ${b} gewinnt das Leg`],
  [/^(.*) wins the leg$/, (a) => `${a} gewinnt das Leg`],
  [/^(.*) wins!$/, (a) => `${a} gewinnt!`],
  [/^Checkout (\d+)$/, (a) => `Checkout ${a}`],
  [/^(\d+)\/(\d+) done$/, (a, b) => `${a}/${b} geschafft`],
  [/^(.*) is out!$/, (a) => `${a} ist raus!`],
  [/^(.*) is a KILLER$/, (a) => `${a} ist ein KILLER`],
  [/^Become a killer: hit (.*)$/, (a) => `Werde Killer: triff ${a}`],
  [/^(\d+) lives$/, (a) => `${a} Leben`],
  [/^(.*): halved!$/, (a) => `${a}: halbiert!`],
  [/^(\d+) marks$/, (a) => `${a} Marks`],
  [/^Inning (\d+): hit (\d+)$/, (a, b) => `Inning ${a}: triff die ${b}`],
  [/^Needs (\d+)$/, (a) => `Braucht ${a}`],
  [/^needs (-?\d+)$/, (a) => `braucht ${a}`],
  [/^Gotcha! (.*) back to 0$/, (a) => `Gotcha! ${a} zurück auf 0`],
  [/^Hits (\d+)\/(\d+)$/, (a, b) => `Treffer ${a}/${b}`],
  [/^(.*) drops below zero – game over$/, (a) => `${a} fällt unter null – Spiel vorbei`],
  [/^until hit per double$/, () => 'bis zum Treffer pro Doppel'],
  [/^(\d+) darts per double$/, (a) => `${a} Darts pro Doppel`],
  [/^(\d+) darts each$/, (a) => `${a} Darts pro Finish`],
  [/^Finish (\d+)\/(\d+)$/, (a, b) => `Finish ${a}/${b}`],
  [/^Success (\d+)\/(\d+)$/, (a, b) => `Erfolg ${a}/${b}`],
  [/^Darts left (\d+)$/, (a) => `Noch ${a} Darts`],
  [/^(\d+) darts at (.*)$/, (a, b) => `${a} Darts auf ${b}`],
  [/^(\d+)\/(\d+) darts$/, (a, b) => `${a}/${b} Darts`],
  [/^⌀ ([\d.]+) \/ visit$/, (a) => `⌀ ${a} / Aufnahme`],
  [/^Done in (\d+) darts$/, (a) => `Geschafft in ${a} Darts`],
  [/^(.*) – (any segment|singles|doubles|trebles)$/, (a, b) => `${tr(a)} – ${tr(b)}`],
  [/^(.*) – (T\d+|D\d+|S\d+|Bull|25)$/, (a, b) => `${tr(a)} – ${b}`],
];

// ------------------------------------------------------------------ German
const DE = {
  // ---- navigation / common
  'Play': 'Spielen', 'Stats': 'Statistik', 'Players': 'Spieler', 'Settings': 'Einstellungen', 'Hub': 'Hub',
  'Games': 'Spiele', 'Training': 'Training', 'Add': 'Hinzufügen', 'Done': 'Fertig', 'Yes': 'Ja', 'No': 'Nein',
  'none': 'keins', 'Automatic': 'Automatisch',
  'Board off': 'Board aus', 'Board …': 'Board …', 'Board offline': 'Board offline', 'Board: takeout': 'Board: Darts ziehen',
  'Board on · {n} in board': 'Board an · {n} im Board',
  'Board: calibrating …': 'Board: kalibriert …', 'Board: not calibrated': 'Board: nicht kalibriert', 'Board: stopped': 'Board: gestoppt',
  'Takeout stuck? Tap': 'Hängt beim Ziehen? Tippen',
  'Board status, reset and calibration': 'Board-Status, Zurücksetzen und Kalibrieren',
  'Checking the board …': 'Board wird geprüft …', 'Board manager not reachable': 'Board Manager nicht erreichbar',
  'Is Autodarts running on the box? A restart of the box usually helps.': 'Läuft Autodarts auf der Box? Ein Neustart der Box hilft meistens.',
  'Calibrating …': 'Kalibriert …', 'Keep the board empty until it is finished.': 'Board leer lassen, bis es fertig ist.',
  'Not calibrated': 'Nicht kalibriert', 'Take all darts out of the board and press Calibrate.': 'Alle Darts aus dem Board ziehen und Kalibrieren drücken.',
  'Detection is stopped': 'Erkennung ist gestoppt', 'Press Start to detect darts again.': 'Starten drücken, damit Darts wieder erkannt werden.',
  'Takeout seems stuck': 'Hängt beim Darts-Ziehen', 'All darts out of the board? Then press Reset.': 'Alle Darts draußen? Dann Zurücksetzen drücken.',
  'Takeout – pull the darts': 'Darts ziehen', 'Detection continues once the board is empty.': 'Die Erkennung geht weiter, sobald das Board leer ist.',
  'Ready – throw!': 'Bereit – wirf!', '{n} darts in the board': '{n} Darts im Board', 'Board is empty.': 'Board ist leer.',
  'yes': 'ja', 'no': 'nein', 'Calibration error (lower is better)': 'Kalibrierfehler (kleiner ist besser)', 'Cam {n}': 'Kamera {n}',
  'calibrating': 'kalibriert', 'failed': 'fehlgeschlagen', 'not calibrated': 'nicht kalibriert',
  'Autodarts board': 'Autodarts-Board', 'Close': 'Schließen', 'Live camera picture': 'Live-Kamerabild', 'No camera picture': 'Kein Kamerabild',
  'Detection': 'Erkennung', 'stopped': 'gestoppt', 'running': 'läuft', 'Calibrated': 'Kalibriert', 'In the board': 'Im Board',
  'Board manager': 'Board Manager', '↺ Reset': '↺ Zurücksetzen', 'stuck takeout, wrong darts': 'hängt beim Ziehen, falsche Darts',
  '🎯 Calibrate': '🎯 Kalibrieren', 'board must be empty': 'Board muss leer sein',
  '▶ Start detection': '▶ Erkennung starten', '⏸ Stop detection': '⏸ Erkennung stoppen', '⟳ Restart cameras': '⟳ Kameras neu starten',
  'Use the board in the playroom': 'Board im Playroom verwenden', 'Off: enter darts by hand (this device only).': 'Aus: Darts von Hand eingeben (nur dieses Gerät).',
  'Open the full board manager': 'Kompletten Board Manager öffnen',
  'Calibrate the board now? Take all darts out first – it takes a few seconds.': 'Board jetzt kalibrieren? Vorher alle Darts ziehen – dauert ein paar Sekunden.',
  'Restart the cameras? Detection pauses for a moment.': 'Kameras neu starten? Die Erkennung pausiert kurz.',
  'Stop dart detection? Darts are then not recognised until you press Start.': 'Dart-Erkennung stoppen? Darts werden dann erst nach Starten wieder erkannt.',
  'Board reset': 'Board zurückgesetzt', 'Calibration started': 'Kalibrierung gestartet', 'Detection started': 'Erkennung gestartet',
  'Detection stopped': 'Erkennung gestoppt', 'Cameras restarting …': 'Kameras starten neu …',
  'The board manager did not accept that ({error})': 'Der Board Manager hat das abgelehnt ({error})',
  'Automatic detection on': 'Automatische Erkennung an',
  'Automatic detection off – enter darts manually': 'Automatische Erkennung aus – Darts von Hand eingeben',
  'Sound and display settings': 'Ton- und Anzeige-Einstellungen',
  'Automatic dart detection (Autodarts board manager)': 'Automatische Dart-Erkennung (Autodarts Board Manager)',

  // ---- home
  '{game} is running here': '{game} läuft hier', 'Back to game': 'Zurück zum Spiel',
  'is running on another screen': 'läuft auf einem anderen Bildschirm', 'was not finished': 'wurde nicht beendet',
  'Remote keypad': 'Fernbedienung', 'Take over here': 'Hier übernehmen', 'Resume': 'Fortsetzen', 'Discard': 'Verwerfen',
  'Discard the unfinished game?': 'Das nicht beendete Spiel verwerfen?',
  'Update {tag} available': 'Update {tag} verfügbar', '☕ Buy me a coffee': '☕ Spendier mir einen Kaffee',

  // ---- setup
  'Tap names below to add players': 'Namen unten antippen, um Spieler hinzuzufügen',
  '🔀 Shuffle order': '🔀 Reihenfolge mischen', 'New player name': 'Name neuer Spieler',
  'No settings.': 'Keine Einstellungen.', 'Start {game}': '{game} starten', 'Choose {n} player(s).': '{n} Spieler wählen.',
  'Could not add player': 'Spieler konnte nicht angelegt werden', 'A game is running here. Replace it?': 'Hier läuft ein Spiel. Ersetzen?',

  // ---- game screen
  'Double': 'Double', 'Treble': 'Triple', 'Miss': 'Miss', '↶ Undo': '↶ Zurück', 'Next ▶': 'Weiter ▶', 'End': 'Ende',
  'Leg over – pull the darts (or press Next) to start the next leg': 'Leg vorbei – Darts ziehen (oder Weiter) für das nächste Leg',
  'Leg over – press Next to start the next leg': 'Leg vorbei – Weiter drücken für das nächste Leg',
  'Pull the darts (or press Next)': 'Darts ziehen (oder Weiter drücken)', 'Press Next for the next player': 'Weiter drücken für den nächsten Spieler',
  'Correcting dart {n} – choose the right segment': 'Dart {n} korrigieren – richtiges Feld wählen',
  'End the training session? The darts thrown so far are saved to your statistics.': 'Training beenden? Die bisherigen Darts werden in der Statistik gespeichert.',
  'End this game without a result?': 'Dieses Spiel ohne Ergebnis beenden?',

  // ---- results
  'Session complete': 'Training beendet', '{name} wins!': '{name} gewinnt!', 'Again': 'Nochmal', 'Rematch': 'Revanche',
  'Change settings': 'Einstellungen ändern', '↶ Undo last dart': '↶ Letzten Dart zurück', 'Results are saved to the statistics.': 'Die Ergebnisse sind in der Statistik gespeichert.',
  'Where the darts landed': 'Wo die Darts gelandet sind',
  'Points left (last leg)': 'Restpunkte (letztes Leg)', 'Score (last leg)': 'Punkte (letztes Leg)', 'Targets done': 'Ziele geschafft',
  'Lives': 'Leben', 'Hit % (running)': 'Trefferquote (laufend)', 'Successful finishes': 'Erfolgreiche Finishes', 'Score': 'Punkte',
  'first 9': 'First 9', 'checkout': 'Checkout', 'hit': 'Treffer', 'success': 'Erfolg', 'visit': 'Aufnahme', 'darts': 'Darts', 'visits →': 'Aufnahmen →',

  // ---- celebrations / messages
  '{name} wins the leg': '{name} gewinnt das Leg', '{name} is a killer': '{name} ist ein Killer', '{name} is out': '{name} ist raus',
  'Checkout {n}': 'Checkout {n}', 'ONE HUNDRED AND EIGHTY': 'HUNDERTACHTZIG', 'White horse': 'White Horse', '9 marks': '9 Marks',
  '{name} back to zero': '{name} zurück auf null', 'Bust': 'Überworfen', 'Halved!': 'Halbiert!', '{n} marks': '{n} Marks',
  'TON FORTY PLUS': 'ÜBER 140', 'TON PLUS': 'ÜBER 100',

  // ---- remote
  'No game is running.': 'Es läuft kein Spiel.', 'Start one': 'Eins starten',
  'The screen running {game} is not responding.': 'Der Bildschirm mit {game} antwortet nicht.',
  'Continue the game here': 'Spiel hier fortsetzen', 'Remote keypad · {info}': 'Fernbedienung · {info}', 'Game over – see the screen': 'Spiel vorbei – siehe Bildschirm',

  // ---- players
  'Rename': 'Umbenennen', 'Remove': 'Entfernen', 'No players yet.': 'Noch keine Spieler.', 'New name': 'Neuer Name',
  'Remove {name} from the name list? Their statistics stay saved.': '{name} aus der Namensliste entfernen? Die Statistik bleibt gespeichert.',

  // ---- statistics
  'Statistics': 'Statistik', 'No players yet – play a game or training first.': 'Noch keine Spieler – spiel erst ein Spiel oder Training.',
  'Player': 'Spieler', 'Where your darts land': 'Wo deine Darts landen', '{n} darts, last {m} sessions': '{n} Darts, letzte {m} Einheiten',
  '{n} session': '{n} Einheit', '{n} sessions': '{n} Einheiten', '{w} won of {m}': '{w} von {m} gewonnen', '{label} per session': '{label} pro Einheit', 'Show values': 'Werte anzeigen', 'Chart': 'Diagramm', 'Visit': 'Aufnahme',
  'No games or training sessions recorded yet.': 'Noch keine Spiele oder Trainings gespeichert.', 'Recent sessions': 'Letzte Einheiten',
  '(stopped early)': '(vorzeitig beendet)', 'Delete this record': 'Eintrag löschen',
  'Delete this session from the statistics (for all its players)?': 'Diese Einheit aus der Statistik löschen (für alle Spieler)?',
  'Play more sessions to see a trend.': 'Spiel mehr Einheiten, um einen Verlauf zu sehen.',
  '3-dart average': '3-Dart-Average', 'First 9 average': 'First-9-Average', 'Checkout %': 'Checkout-Quote', 'Highest checkout': 'Höchstes Finish',
  'Best leg (darts)': 'Bestes Leg (Darts)', 'Highest visit': 'Höchste Aufnahme', '180s': '180er', 'Legs won': 'Legs gewonnen',
  'Marks per round': 'Marks pro Runde', 'Best score': 'Bestwert', 'Average score': 'Durchschnitt', 'Double hit %': 'Doppel-Quote',
  'Completed': 'Durchgespielt', 'Darts thrown': 'Geworfene Darts', 'Success %': 'Erfolgsquote', 'Finishes': 'Finishes',
  'Darts per success': 'Darts pro Erfolg', 'Hit %': 'Trefferquote', 'Number hit %': 'Zahl getroffen', 'Points per visit': 'Punkte pro Aufnahme',
  'Darts': 'Darts', 'Best (darts)': 'Bestwert (Darts)', 'Average (darts)': 'Schnitt (Darts)', 'Best total': 'Bestes Ergebnis',
  'Average per visit': 'Schnitt pro Aufnahme', 'MPR': 'MPR', 'Darts needed': 'Benötigte Darts', 'Total': 'Gesamt',
  'any segment': 'beliebiges Feld', 'singles': 'Singles', 'doubles': 'Doppel', 'trebles': 'Triples',

  // ---- settings page
  'Saved on this device only – the box\'s screen and your phone can be set up differently.': 'Nur auf diesem Gerät gespeichert – der Bildschirm der Box und dein Handy können unterschiedlich eingestellt sein.',
  'Language': 'Sprache', 'Language of the playroom and the caller.': 'Sprache des Playrooms und des Callers.',
  'Sound': 'Ton', 'Visuals': 'Anzeige', 'Sounds': 'Töne', 'Master switch for all sounds on this device.': 'Hauptschalter für alle Töne auf diesem Gerät.',
  'Volume': 'Lautstärke', 'Dart sounds': 'Dart-Geräusche', 'A short sound for every dart – higher for doubles and trebles.': 'Ein kurzer Ton für jeden Dart – heller bei Doubles und Triples.',
  'Event sounds': 'Ereignis-Töne', 'Bust, target hit, 180, checkout, leg and match won.': 'Überworfen, Treffer, 180, Checkout, Leg und Match gewonnen.',
  'Caller (voice)': 'Caller (Stimme)', 'Calls scores and "you require …" like on TV. Needs a voice on this device.': 'Ruft Punkte und „du brauchst …“ wie im Fernsehen. Braucht eine Stimme auf diesem Gerät.',
  'Voice': 'Stimme', 'Celebrations': 'Jubel-Effekte', 'Big on-screen messages for 180, high scores, checkouts, busts and wins.': 'Große Einblendungen für 180, hohe Aufnahmen, Checkouts, Überworfen und Siege.',
  'Confetti': 'Konfetti', 'Confetti for 180s and won matches.': 'Konfetti bei 180 und gewonnenen Matches.',
  'Animations': 'Animationen', 'Scores count down, darts pop onto the board. Switch off on slow devices.': 'Punkte zählen herunter, Darts erscheinen animiert. Auf langsamen Geräten ausschalten.',
  'Dartboard view': 'Dartboard-Ansicht', 'A dartboard next to the scoreboard showing this turn\'s darts.': 'Ein Dartboard neben der Anzeige mit den Darts der aktuellen Aufnahme.',
  'Dartboard on phones': 'Dartboard auf Handys', 'Also show the dartboard on narrow screens.': 'Das Dartboard auch auf schmalen Bildschirmen zeigen.',
  'Show targets': 'Ziele zeigen', 'Highlight what to aim for: checkout route, cricket numbers, training target.': 'Zeigt, worauf du zielen solltest: Checkout-Weg, Cricket-Zahlen, Trainingsziel.',
  'Natural voice (on the box)': 'Natürliche Stimme (auf der Box)', 'English voices are preferred automatically.': 'Passende Stimmen werden automatisch gewählt.',
  'No voices found on this device – the caller stays silent.': 'Keine Stimmen auf diesem Gerät gefunden – der Caller bleibt stumm.',
  'Using the natural voice of the box.': 'Es wird die natürliche Stimme der Box verwendet.',
  "Not installed on this box – the device's own voice is used.": 'Auf dieser Box nicht installiert – die Stimme des Geräts wird verwendet.',
  '▶ Test sounds': '▶ Töne testen', '▶ Test caller': '▶ Caller testen', '▶ Test effects': '▶ Effekte testen', 'Reset to defaults': 'Zurücksetzen',
  'Celebrations are switched off': 'Jubel-Effekte sind ausgeschaltet',

  // ---- game titles and descriptions
  'Around the Clock': 'Around the Clock', 'Halve-It': 'Halve-It', 'Count Up': 'Count Up', 'Doubles practice': 'Doppel-Training',
  'Checkout practice': 'Checkout-Training', 'Target practice': 'Ziel-Training', 'Solo X01': 'Solo X01', "Bob's 27": "Bob's 27",
  'Count down from 301, 501, … to exactly zero.': 'Von 301, 501, … genau auf null herunterspielen.',
  'Close 15–20 and bull with three marks each; score on numbers your opponents have not closed.': 'Schließe 15–20 und Bull mit je drei Treffern; punkte auf Zahlen, die deine Gegner noch offen haben.',
  'Hit 1 to 20 (and bull) in order. First one through wins.': 'Triff 1 bis 20 (und Bull) der Reihe nach. Wer zuerst durch ist, gewinnt.',
  'Round n: only number n scores. Single, double and treble of the number in one visit = Shanghai, instant win.': 'Runde n: nur die Zahl n zählt. Single, Double und Triple der Zahl in einer Aufnahme = Shanghai, sofortiger Sieg.',
  'Everyone gets a number. Hit your own double to become a killer, then take lives with your opponents\' doubles.': 'Jeder bekommt eine Zahl. Triff dein eigenes Doppel, um Killer zu werden – dann nimmst du den anderen mit ihren Doppeln Leben.',
  'A target every round. Miss it with all three darts and your score is halved.': 'Jede Runde ein Ziel. Verfehlst du es mit allen drei Darts, werden deine Punkte halbiert.',
  'Score as many points as possible in a fixed number of rounds.': 'So viele Punkte wie möglich in einer festen Zahl von Runden.',
  '9 innings. Inning n: hit number n. Single = 1 run, double = 2, treble = 3.': '9 Innings. Inning n: triff die Zahl n. Single = 1 Run, Double = 2, Triple = 3.',
  'Count up to exactly the target. Match an opponent\'s score and they go back to zero.': 'Zähl genau bis zum Ziel hoch. Triffst du den Punktestand eines Gegners, fällt er auf null zurück.',
  'Start with 27. Three darts at each double: every hit adds the double, no hit subtracts it.': 'Start mit 27. Drei Darts auf jedes Doppel: jeder Treffer zählt dazu, kein Treffer zieht ab.',
  'Work through the doubles and see which ones are your strong and weak ones.': 'Arbeite dich durch die Doppel und finde deine starken und schwachen Felder.',
  'Random finishes from a range you choose – check out within the dart limit.': 'Zufällige Finishes aus einem Bereich deiner Wahl – check innerhalb des Dart-Limits aus.',
  'A fixed number of darts at one target (T20, T19, bull, …) – accuracy and scoring power.': 'Eine feste Zahl Darts auf ein Ziel (T20, T19, Bull, …) – Genauigkeit und Scoring.',
  'Go round the board as fast as you can – fewer darts is better.': 'Einmal ums Board, so schnell es geht – weniger Darts ist besser.',
  'Practise legs of 501 (or 301 …) on your own – averages, first 9, checkout %.': 'Allein Legs auf 501 (oder 301 …) üben – Average, First 9, Checkout-Quote.',

  // ---- game settings
  'Start score': 'Startpunkte', 'Check-in': 'Check-in', 'Check-out': 'Check-out', 'Straight in': 'Straight In', 'Double in': 'Double In',
  'Master in (D/T)': 'Master In (D/T)', 'Double out': 'Double Out', 'Straight out': 'Straight Out', 'Master out (D/T)': 'Master Out (D/T)',
  'Master out': 'Master Out', 'Legs (first to)': 'Legs (Gewinn-Legs)', 'Sets (first to)': 'Sätze (Gewinn-Sätze)', 'Round limit': 'Rundenlimit',
  'Scoring': 'Wertung', 'Standard (points for you)': 'Standard (Punkte für dich)', 'Cut-throat (points to opponents)': 'Cut-Throat (Punkte für die Gegner)',
  'No score (just close)': 'Ohne Punkte (nur schließen)', 'Numbers': 'Zahlen', 'Tactics: 10–20 + Bull': 'Tactics: 10–20 + Bull',
  'Random: 6 numbers + Bull': 'Zufällig: 6 Zahlen + Bull', 'Order': 'Reihenfolge', 'Random order': 'Zufällig', 'Random': 'Zufällig',
  'Segment to hit': 'Zu treffen', 'Any (S/D/T)': 'Egal (S/D/T)', 'Singles only': 'Nur Singles', 'Doubles only': 'Nur Doubles', 'Trebles only': 'Nur Triples',
  'Double/treble skips ahead': 'Double/Triple überspringt', 'Yes (D = +2, T = +3)': 'Ja (D = +2, T = +3)', 'Finish on bull': 'Mit Bull beenden',
  'Rounds': 'Runden', 'Shanghai wins instantly': 'Shanghai gewinnt sofort', 'No (scores only)': 'Nein (zählt nur Punkte)',
  'Counts': 'Zählt', 'Whole number (S=1, D=2, T=3)': 'Ganze Zahl (S=1, D=2, T=3)', 'Killer hitting own number': 'Killer trifft eigene Zahl',
  'Loses a life': 'Verliert ein Leben', 'Nothing happens': 'Nichts passiert', 'Targets': 'Ziele',
  'Classic: 15 16 D 17 18 T 19 20 Bull': 'Klassisch: 15 16 D 17 18 T 19 20 Bull', 'Bermuda Triangle: 12–20, D, T, 25, Bull': 'Bermuda-Dreieck: 12–20, D, T, 25, Bull',
  'Long: 12 rounds': 'Lang: 12 Runden', 'Tie after 9 innings': 'Unentschieden nach 9 Innings', 'Extra innings': 'Extra-Innings', 'Ends in a tie': 'Endet unentschieden',
  'Bull in any inning': 'Bull in jedem Inning', 'Nothing': 'Nichts', '25 = 1 run, Bull = 2 runs': '25 = 1 Run, Bull = 2 Runs', 'Target': 'Ziel',
  'Include bull at the end': 'Bull am Ende', 'Below zero': 'Unter null', 'Game over': 'Spiel vorbei', 'Keep playing': 'Weiterspielen',
  'Favourites: D20 D16 D8 D10 D12 D18 Bull': 'Favoriten: D20 D16 D8 D10 D12 D18 Bull', 'Include bull': 'Mit Bull', 'Darts per double': 'Darts pro Doppel',
  '3 darts': '3 Darts', '6 darts': '6 Darts', '9 darts': '9 Darts', 'Until hit (max 9)': 'Bis zum Treffer (max. 9)', 'Number of finishes': 'Anzahl Finishes',
  'Darts per finish': 'Darts pro Finish', '3 (one visit)': '3 (eine Aufnahme)', '6 (two visits)': '6 (zwei Aufnahmen)', '9 (three visits)': '9 (drei Aufnahmen)',

  // ---- engine / game strings (exact)
  'Bust!': 'Überworfen!', 'Bust': 'Überworfen', '180!': '180!', 'SHANGHAI!': 'SHANGHAI!', 'Shanghai!': 'Shanghai!', 'Round limit reached': 'Rundenlimit erreicht',
  'White horse! 9 marks': 'White Horse! 9 Marks', 'Killer – go after the others!': 'Killer – jetzt die anderen!', 'KILLER': 'KILLER',
  'no checkout': 'kein Finish möglich', 'Double or treble in': 'Double oder Triple In', 'Standard': 'Standard', 'Cut-throat': 'Cut-Throat', 'No score': 'Ohne Punkte',
  'double in': 'Double In', 'master in': 'Master In', 'double out': 'Double Out', 'straight out': 'Straight Out', 'master out': 'Master Out',
  'Any double': 'beliebiges Doppel', 'Any treble': 'beliebiges Triple', 'Bull (25/50)': 'Bull (25/50)', '25 (outer bull)': '25 (Single Bull)', 'Bull (50)': 'Bull (50)',
  'game over': 'Spiel vorbei', 'All doubles done': 'Alle Doppel geschafft', 'Checked out – session complete': 'Ausgecheckt – Training beendet',
  'Checked out!': 'Ausgecheckt!', 'Not this time': 'Diesmal nicht', 'Done': 'Fertig',
};
