const staticCacheName = 'offline-app-v42';
const dynamicCacheName = 'offline-app-v41';

const assets = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    './icons/icon-128x128.png',
    './icons/icon-512x512.png'
];

self.addEventListener('install', (e) => {
    console.log('Service Worker Installed');
    e.waitUntil(
        caches.open(staticCacheName).then(async cache => {
            for (const asset of assets) {
                try {
                    await cache.add(asset);
                    console.log('Cache assets added successfully');
                } catch (err) {
                    console.error(err);
                }
            }
        })
    );
});

self.addEventListener('fetch', (e) => {
    console.log("Fetch Executed from Service Worker");
    e.respondWith(
        caches.match(e.request).then(cacheMatch => {
            // If a match is found in the cache, serve it.
            // Otherwise, perform a network request.
            return cacheMatch || fetch(e.request)

            .then(fetchResp => {
                return caches.open(dynamicCacheName).then(cache => {
                    cache.put(e.request, fetchResp.clone())
                    return fetchResp;   
                })
            })
        })
    );
});