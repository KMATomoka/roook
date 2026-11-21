// Appli installable (PWA) : service worker + bouton « Installer l'appli ».
// - Android, ordinateur (Chrome, Edge…) : le navigateur prévient qu'on peut installer (beforeinstallprompt),
//   on garde ce signal et le bouton ouvre sa vraie fenêtre d'installation.
// - iPhone, iPad : pas de fenêtre d'installation ; le bouton montre comment faire (Partager → Sur l'écran d'accueil).
// - Déjà installée (ouverte en plein écran) : rien ne s'affiche.
// Le bouton est discret : une ligne du menu ☰ sur téléphone, une petite icône dans la barre sur ordinateur.

// Service worker (sw.js) : page « hors ligne » et installation. Il ne garde jamais les pages ni les scripts.
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

const standalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
const ua = navigator.userAgent;
const isIos = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
// Les navigateurs intégrés des applis (Instagram, TikTok…) ne savent pas installer : pas de bouton
const inApp = /; wv\)|FBAN|FBAV|FB_IAB|Instagram|Snapchat|musical_ly|BytedanceWebview|TikTok|Line\/|LinkedInApp|MicroMessenger|Pinterest/i.test(ua);

const OUT = '#1d1530';
const ICON = `<svg class="ui-ico" viewBox="0 0 64 64" fill="none" stroke="${OUT}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="15" y="5" width="34" height="54" rx="8" fill="#d6ccff"/>
  <path d="M27 51 H37"/>
  <circle cx="32" cy="27" r="13" fill="#3cf2a3"/>
  <path d="M32 20 V33 M26.5 28 L32 33.5 L37.5 28" stroke-width="3.2"/>
</svg>`;
const SHARE = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2"/></svg>`;
const ADD = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/></svg>`;

let deferred = null; // le signal « installable » du navigateur
const buttons = [];

function refresh() {
  const show = !standalone() && !inApp && (!!deferred || isIos);
  for (const b of buttons) b.hidden = !show;
}

function iosHelp() {
  const dlg = document.createElement('dialog');
  dlg.className = 'modal install-help';
  dlg.innerHTML = `
    <form method="dialog">
      <div class="install-help-ico" aria-hidden="true">${ICON}</div>
      <h2>Installer ROOOK</h2>
      <p>Ajoute ROOOK sur ton écran d’accueil : il s’ouvrira en plein écran, comme une vraie appli.</p>
      <ol class="install-steps">
        <li>Touche <b>Partager</b> <span class="install-key">${SHARE}</span> dans Safari (en bas de l’écran, ou dans le menu <b>···</b>).</li>
        <li>Choisis <b>Sur l’écran d’accueil</b> <span class="install-key">${ADD}</span> (fais défiler la liste si besoin).</li>
        <li>Touche <b>Ajouter</b> en haut à droite.</li>
      </ol>
      <div class="end-actions"><button class="btn btn-primary" value="ok">Compris</button></div>
    </form>`;
  document.body.appendChild(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();
}

async function install(e) {
  e.preventDefault();
  if (deferred) {
    const prompt = deferred;
    deferred = null;
    refresh();
    prompt.prompt();
    try {
      await prompt.userChoice;
    } catch {}
  } else if (isIos) iosHelp();
}

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // pas de bandeau automatique : c'est notre bouton qui propose
  deferred = e;
  refresh();
});
addEventListener('appinstalled', () => {
  deferred = null;
  refresh();
});
matchMedia('(display-mode: standalone)').addEventListener?.('change', refresh);

// Les boutons (cachés tant que l'installation n'est pas possible)
{
  const bar = document.querySelector('.topbar');
  const nav = bar?.querySelector('.topnav');
  if (nav && !document.body.classList.contains('page-auth')) {
    nav.insertAdjacentHTML('beforeend', `<a class="nav-install" href="#" role="button" hidden><span class="nav-ico" aria-hidden="true">${ICON}</span>Installer l’appli</a>`);
    nav.insertAdjacentHTML('afterend', `<button type="button" class="icon-btn install-btn" title="Installer l’appli" aria-label="Installer l’appli" hidden>${ICON}</button>`);
    buttons.push(nav.querySelector('.nav-install'), bar.querySelector('.install-btn'));
    for (const b of buttons) b.addEventListener('click', install);
  }
  refresh();
}
