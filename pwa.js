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

  /* ── 앱 설치 버튼 (허브의 #installBtn 이 있을 때만) ──────────────────
     - Chrome·삼성 인터넷: 브라우저가 주는 설치 창(beforeinstallprompt)을 바로 띄운다
     - 카카오톡 안 미리보기: 설치가 안 되므로 바깥 브라우저로 다시 연다
     - 그 밖(설치 창을 안 주는 브라우저): 메뉴에서 설치하는 방법을 보여 준다
     - 이미 앱으로 열었으면 버튼을 숨긴다 */
  var installBtn = document.getElementById('installBtn');
  var deferred = null;
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    if (installBtn && !standalone) installBtn.hidden = false;
  });
  window.addEventListener('appinstalled', function () {
    deferred = null;
    if (installBtn) installBtn.hidden = true;
  });

  if (installBtn && !standalone) {
    installBtn.hidden = false;
    installBtn.addEventListener('click', function () {
      if (deferred) {
        var ev = deferred; deferred = null;
        var shown;
        try { shown = ev.prompt(); } catch (err) { showInstallHelp(navigator.userAgent || ''); return; }
        // 설치 창을 못 띄우면(브라우저가 거절) 메뉴로 설치하는 방법을 보여 준다
        if (shown && shown.catch) shown.catch(function () { showInstallHelp(navigator.userAgent || ''); });
        if (ev.userChoice) ev.userChoice.then(function (r) { if (r && r.outcome === 'accepted') installBtn.hidden = true; });
        return;
      }
      var ua = navigator.userAgent || '';
      if (/KAKAOTALK/i.test(ua)) {
        location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href);
        return;
      }
      showInstallHelp(ua);
    });
  }

  function showInstallHelp(ua) {
    var box = document.getElementById('installHelp');
    var steps = document.getElementById('installSteps');
    if (!box || !steps) return;
    var items;
    if (/SamsungBrowser/i.test(ua)) {
      items = ['화면 <b>오른쪽 아래 ≡</b> (줄 3개) 를 누릅니다', '<b>현재 페이지 추가</b> → <b>홈 화면</b> 을 누릅니다', '홈 화면의 <b>Game Hub</b> 아이콘으로 실행합니다'];
    } else if (/iPhone|iPad|iPod/i.test(ua)) {
      items = ['Safari 아래쪽 <b>공유(□↑)</b> 버튼을 누릅니다', '<b>홈 화면에 추가</b> 를 누릅니다', '홈 화면의 <b>Game Hub</b> 아이콘으로 실행합니다'];
    } else if (/Android/i.test(ua) && !/Chrome\//i.test(ua)) {
      items = ['이 화면은 설치가 안 되는 앱 안 미리보기일 수 있습니다', '<b>⋮ → 다른 브라우저로 열기</b> 로 Chrome 에서 다시 엽니다', 'Chrome 에서 이 <b>앱 설치</b> 버튼을 다시 누릅니다'];
    } else {
      items = ['주소창 <b>오른쪽 끝 ⋮</b> (점 3개) 를 누릅니다', '<b>홈 화면에 추가</b> 또는 <b>앱 설치</b> 를 누릅니다', '홈 화면의 <b>Game Hub</b> 아이콘으로 실행합니다'];
    }
    steps.innerHTML = items.map(function (t) { return '<li>' + t + '</li>'; }).join('');
    box.classList.add('open');
    var close = function () { box.classList.remove('open'); };
    document.getElementById('installHelpClose').onclick = close;
    box.onclick = function (e) { if (e.target === box) close(); };
  }
})();
