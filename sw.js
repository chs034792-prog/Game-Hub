/* Game Hub 서비스 워커 — 휴대폰 홈 화면 앱(PWA)용.
   방식: "최신판 우선". 인터넷이 되면 항상 서버에서 새로 받고(받은 것은 저장해 둔다),
   인터넷이 없거나 4초 안에 응답이 없으면 마지막으로 저장해 둔 판으로 띄운다.
   그래서 게임을 고쳐 올리면 앱을 다시 설치하지 않아도 다음 실행 때 바로 최신판이 된다.
   이 파일 자체를 크게 바꿀 때만 CACHE 이름의 숫자를 올린다 (게임 업데이트 때는 손대지 않는다). */
const CACHE = 'gamehub-v2';   // v2: 벽짓살을 허브에서 내림 (2026-11-02)
const CORE = [
  './', './index.html', './play.html', './pwa.js', './manifest.webmanifest',
  './games/slime.html', './games/nexus.html', './games/money.html',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-48.png',
];
const NET_TIMEOUT_MS = 4000;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // 바깥 서버(랭킹 등)는 건드리지 않는다
  if (url.searchParams.has('hubcheck')) return;       // 업데이트 확인 요청은 저장하지 않고 그대로 보낸다
  e.respondWith(networkFirst(req, url));
});

async function networkFirst(req, url) {
  const cache = await caches.open(CACHE);
  try {
    const res = await withTimeout(fetch(req, { cache: 'no-cache' }), NET_TIMEOUT_MS);
    if (res && res.ok && res.type === 'basic') {
      cache.put(cacheKey(url), res.clone());
    }
    return res;
  } catch (err) {
    const hit = await cache.match(cacheKey(url));
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const home = await cache.match('./index.html');
      if (home) return home;
    }
    throw err;
  }
}

// play.html?game=slime 처럼 주소 뒤 ?값만 다른 페이지는 같은 파일 하나로 저장한다
function cacheKey(url) {
  return url.origin + url.pathname;
}

function withTimeout(p, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
