const CACHE='cct-jogos-v3-2';
const ASSETS=['./','index.html','styles.css','app.js','manifest.json','icon-192.png','icon-512.png',
'assets/logo-cct.jpg','assets/logo-cct-header.png','assets/mascote.png','assets/volei-praia-1.jpg','assets/volei-praia-2.jpg',
'assets/skate.jpg','assets/evento-verde.jpg','assets/levantamento-1.jpg','assets/levantamento-2.jpg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).catch(()=>caches.match('index.html')))));
