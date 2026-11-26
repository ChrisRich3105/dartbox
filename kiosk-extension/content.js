// Runs on every page in the kiosk browser.
(() => {
  if (window.top !== window) return;            // not inside iframes

  // Wake the background worker regularly so remote screen commands apply quickly.
  setInterval(() => {
    try { chrome.runtime.sendMessage('ping').catch(() => {}); } catch (e) { /* extension reloaded */ }
  }, 2000);

  // Floating home button - everywhere except on the hub itself.
  const onHub = location.hostname === 'localhost' && (location.port === '' || location.port === '80');
  if (onHub || document.querySelector('meta[name="dartbox-no-home-button"]')) return;
  const a = document.createElement('a');
  a.href = 'http://localhost/';
  a.title = 'Dartbox hub';
  // drawn, not a text emoji: foreign pages and a bare kiosk browser may have no emoji font
  a.innerHTML = '<svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="#fff" stroke-width="2">' +
    '<circle cx="13" cy="13" r="11"/><circle cx="13" cy="13" r="6"/><circle cx="13" cy="13" r="1.5" fill="#fff"/></svg>';
  Object.assign(a.style, {
    position: 'fixed', left: '12px', bottom: '12px', zIndex: '2147483647',
    width: '48px', height: '48px', borderRadius: '50%',
    background: 'rgba(20,22,26,.8)', border: '1px solid rgba(255,255,255,.25)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '24px', lineHeight: '1', textDecoration: 'none',
    opacity: '0.35', transition: 'opacity .2s', cursor: 'pointer',
  });
  a.addEventListener('mouseenter', () => { a.style.opacity = '1'; });
  a.addEventListener('mouseleave', () => { a.style.opacity = '0.35'; });
  document.documentElement.appendChild(a);
})();
