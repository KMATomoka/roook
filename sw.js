// Service worker de ROOOK (appli installable).
// Règle d'or : ne jamais bloquer le site sur une ancienne version. Il ne garde donc presque rien :
// - les pages viennent toujours du réseau ; sans connexion, il affiche la page « hors ligne » à la place ;
// - scripts, styles, images, Firebase (comptes, base, googleapis, firebaseio…) et autres sites : jamais touchés,
//   le navigateur s'en occupe comme d'habitude (avec les numéros de version ajoutés par scripts/build.js).
// scripts/build.js remplace __ROOOK_VERSION__ à chaque construction : le fichier change, le navigateur installe le
// nouveau service worker, qui prend la main tout de suite (skipWaiting / clients.claim) et vide les anciens caches.
const VERSION = 'f4cd128-mwquidh7';
const CACHE = `roook-${VERSION}`;
const OFFLINE = 'hors-ligne.html';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.add(new Request(OFFLINE, { cache: 'reload' })))
      .catch(() => {}),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('roook-') && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Seulement l'ouverture d'une page du site ; tout le reste passe sans détour
  if (req.mode !== 'navigate' || req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req).catch(async (err) => {
      const offline = await caches.match(OFFLINE, { ignoreSearch: true });
      if (offline) return offline;
      throw err;
    }),
  );
});
