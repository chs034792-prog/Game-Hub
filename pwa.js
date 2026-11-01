/* 홈 화면 앱(PWA) 공통 — 서비스 워커 등록 + 새 버전 알림 띠.
   새 버전 확인: 이 페이지가 띄운 파일들(data-watch)의 서버 버전표(ETag/Last-Modified)를
   처음 값과 비교한다. 게임을 고쳐 올리면 값이 바뀌므로 화면 위에 "새 버전" 띠를 띄운다.
   확인 시점: 앱으로 돌아왔을 때(화면 켜짐) + 5분마다. 인터넷이 없으면 조용히 넘어간다. */
(function () {
  'use strict';
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(function () {});
    });
  }

  var me = document.currentScript;
  var watch = ((me && me.getAttribute('data-watch')) || 'index.html')
    .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  // play.html 은 어떤 게임을 띄웠는지 주소로 알 수 있다 → 그 게임 파일도 함께 본다
  var gid = new URLSearchParams(location.search).get('game');
  if (gid && /^[a-z]+$/.test(gid)) watch.push('games/' + gid + '.html');

  var first = {};
  var shown = false;

  function stamp(url) {
    return fetch(url + '?hubcheck=' + Date.now(), { method: 'HEAD', cache: 'no-store' })
      .then(function (r) { return r.ok ? (r.headers.get('ETag') || r.headers.get('Last-Modified') || '') : ''; })
      .catch(function () { return ''; });
  }

  function check() {
    if (shown || !navigator.onLine) return;
    watch.forEach(function (u) {
      stamp(u).then(function (v) {
        if (!v) return;
        if (!(u in first)) { first[u] = v; return; }
        if (first[u] !== v) showBanner();
      });
    });
  }

  function showBanner() {
    if (shown) return;
    shown = true;
    var bar = document.createElement('div');
    bar.id = 'hubUpdateBar';
    bar.setAttribute('role', 'status');
    bar.style.cssText = [
      'position:fixed', 'left:50%', 'transform:translateX(-50%)',
      'top:calc(env(safe-area-inset-top, 0px) + 8px)', 'z-index:2147483647',
      'display:flex', 'align-items:center', 'gap:10px', 'padding:8px 8px 8px 14px',
      'background:#1b2a4a', 'color:#e9eefc', 'border:1px solid rgba(127,178,255,.45)',
      'border-radius:12px', 'box-shadow:0 8px 24px rgba(0,0,0,.5)', 'white-space:nowrap',
      'font:700 13px system-ui,-apple-system,"Malgun Gothic",sans-serif', 'max-width:calc(100vw - 24px)'
    ].join(';');
    var msg = document.createElement('span');
    msg.textContent = '새 버전이 있습니다';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '새로고침';
    btn.style.cssText = 'border:0;border-radius:8px;padding:6px 12px;background:#4b86ff;color:#fff;font:inherit;cursor:pointer';
    btn.onclick = function () { location.reload(); };
    var close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', '닫기');
    close.textContent = '✕';
    close.style.cssText = 'border:0;background:transparent;color:#9aa8c7;font:inherit;cursor:pointer;padding:4px 6px';
    close.onclick = function () { bar.remove(); };
    bar.appendChild(msg);
    bar.appendChild(btn);
    bar.appendChild(close);
    document.body.appendChild(bar);
  }

  window.addEventListener('load', function () { setTimeout(check, 1500); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
  setInterval(check, 5 * 60 * 1000);
})();
