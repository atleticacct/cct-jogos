const CACHE='cct-jogos-v3-drive-auto-final-20260902';
const ASSETS=['./','index.html','styles.css','app.js','manifest.json'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{}))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const req=e.request;if(req.method!=='GET')return;if(req.url.includes('script.google.com')||req.url.includes('googleusercontent.com')||req.url.includes('drive.google.com')){e.respondWith(fetch(req));return;}e.respondWith(fetch(req).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});return r}).catch(()=>caches.match(req)))});
