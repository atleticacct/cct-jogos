/* CCT JOGOS — Service Worker V4.8.5
 * Objetivo: impedir que iPhone/PWA fique preso em JS/CSS antigos.
 * HTML/JS/CSS = network-first; assets estáticos = cache-first.
 */
const CACHE_NAME='cct-jogos-shell-v485';
const CORE=[
  './',
  './index.html',
  './styles.css?v=485',
  './app.js?v=485',
  './manifest.json'
];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache=>Promise.allSettled(CORE.map(url=>cache.add(url))))
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE_NAME && /^cct-jogos/i.test(k)).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING') self.skipWaiting();
});

function isCodeRequest(request,url){
  if(request.mode==='navigate') return true;
  return /\.(?:html|js|css)$/i.test(url.pathname);
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);

  // API e serviços externos continuam diretamente na rede.
  if(url.origin!==self.location.origin) return;

  if(isCodeRequest(request,url)){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(request,{cache:'no-store'});
        if(fresh && fresh.ok){
          const cache=await caches.open(CACHE_NAME);
          cache.put(request,fresh.clone()).catch(()=>{});
        }
        return fresh;
      }catch(err){
        return (await caches.match(request)) || (request.mode==='navigate' ? caches.match('./index.html') : Promise.reject(err));
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    const cached=await caches.match(request);
    if(cached) return cached;
    const response=await fetch(request);
    if(response && response.ok){
      const cache=await caches.open(CACHE_NAME);
      cache.put(request,response.clone()).catch(()=>{});
    }
    return response;
  })());
});
