// Polls the dartbox hub for "show this on the screen" commands and navigates the
// kiosk tab. Triggered every 2 s by the content script (which wakes this worker)
// and every 30 s by an alarm as a fallback (e.g. while a Chrome error page is shown,
// where content scripts don't run).
const HUB = 'http://localhost';
let busy = false;

async function check() {
  if (busy) return;
  busy = true;
  try {
    const cmd = await (await fetch(HUB + '/api/kiosk', { cache: 'no-store' })).json();
    const { lastSeq } = await chrome.storage.session.get('lastSeq');
    await chrome.storage.session.set({ lastSeq: cmd.seq });
    // First contact after browser start, or no new command: nothing to do.
    if (lastSeq === undefined || cmd.seq === lastSeq || !cmd.url) return;
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab) return;
    if (cmd.url === 'reload') await chrome.tabs.reload(tab.id);
    else await chrome.tabs.update(tab.id, { url: cmd.url });
  } catch (e) {
    // hub not reachable - try again next time
  } finally {
    busy = false;
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg === 'ping') check();
});
chrome.alarms.create('poll', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(check);
chrome.runtime.onStartup.addListener(check);
chrome.runtime.onInstalled.addListener(check);
