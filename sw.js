// sw.js
const CACHE_NAME = 'goshuin-ar-v3';

// キャッシュしておきたいローカルファイルの一覧
const urlsToCache = [
  './',
  './index.html',
  './targets.mind',
  './ume_petal.png',
  './kamon.png',
  './ink_aura.png',
  './oritsuru_merrygoround.glb',
  './tenmangu_ambient.mp3'
];

// インストール時にファイルをキャッシュに保存
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// ネットワークリクエストの傍受（キャッシュがあればそれを返す）
self.addEventListener('fetch', event => {
  // 注意：天気API（Open-Meteo）やログ送信（Google Forms）はキャッシュさせず、常に通信を試みる
  if (event.request.url.includes('api.open-meteo.com') || event.request.url.includes('docs.google.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // キャッシュ内にデータがあればそれを返す（オフラインでも一瞬で表示される）
        if (response) {
          return response;
        }
        // キャッシュになければ通常のネットワーク通信を行う
        return fetch(event.request);
      })
  );
});