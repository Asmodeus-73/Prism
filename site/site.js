// Prism website: pick the right download for this computer and point the buttons
// straight at the installers of the latest public version.
(() => {
  const en = document.documentElement.lang === 'en';
  const T = en
    ? { mac: 'Download for Mac', win: 'Download for Windows', web: 'Use online', alsoWin: '<a href="#download">Windows version</a>', alsoMac: '<a href="#download">Mac version</a>', free: 'Free', desk: 'Mac and Windows version', ver: v => 'Version ' + v + '. Free, no account, no ads.' }
    : { mac: 'Télécharger pour Mac', win: 'Télécharger pour Windows', web: 'Utiliser en ligne', alsoWin: '<a href="#telecharger">Version Windows</a>', alsoMac: '<a href="#telecharger">Version Mac</a>', free: 'Gratuit', desk: 'Version Mac et Windows', ver: v => 'Version ' + v + '. Gratuit, sans compte et sans publicité.' };
  const $ = id => document.getElementById(id);
  const ua = navigator.userAgent, pf = navigator.platform || '';
  const touch = navigator.maxTouchPoints > 1;
  const os = /Win/.test(pf) || /Windows/.test(ua) ? 'win' : (/Mac/.test(pf) && !touch) ? 'mac' : null;
  const hero = $('heroDl'), meta = $('heroMeta');
  if (hero) {
    if (os) {
      $(os === 'mac' ? 'cMac' : 'cWin').classList.add('on');
      hero.querySelector('span').textContent = os === 'mac' ? T.mac : T.win;
      hero.href = $(os === 'mac' ? 'bMac' : 'bWin').href;
      meta.innerHTML = T.free + ' · ' + (os === 'mac' ? T.alsoWin : T.alsoMac);
    } else {
      // phone or tablet: the browser version is the one that works here
      hero.querySelector('span').textContent = T.web;
      hero.href = $('bWeb').href;
      hero.nextElementSibling.textContent = T.desk;
      hero.nextElementSibling.href = en ? '#download' : '#telecharger';
      $('cWeb').classList.add('on');
    }
  }
  if (!$('bMac')) return;
  fetch('https://api.github.com/repos/Asmodeus-73/Prism/releases/latest')
    .then(r => (r.ok ? r.json() : null))
    .then(j => {
      if (!j) return;
      const find = re => (j.assets || []).find(a => re.test(a.name));
      const mac = find(/\.dmg$/i), win = find(/-setup\.exe$/i);
      if (mac) $('bMac').href = mac.browser_download_url;
      if (win) $('bWin').href = win.browser_download_url;
      const cn = (String(j.name || '').match(/«\s*([^»]+?)\s*»/) || [])[1];
      const v = String(j.tag_name || '').replace(/^v/, '') + (cn ? ' « ' + cn + ' »' : '');
      if (v && $('dlSub')) $('dlSub').textContent = T.ver(v);
      if (hero && os === 'mac' && mac) hero.href = mac.browser_download_url;
      if (hero && os === 'win' && win) hero.href = win.browser_download_url;
    })
    .catch(() => {});
})();
