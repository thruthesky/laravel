/* ------------------------------------------------------------------
   홈 화면 — 로드맵·암기 카드·차이표는 SKILL.md 와 references/*.md 에서 그때그때 읽는다
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  var L = window.LV;
  L.header('home');

  var QUICK = ['미들웨어', 'N+1', 'with()', 'flash', '419', '서비스 컨테이너', 'FormRequest', '마이그레이션'];
  var TRY = ['419', '검증 규칙', 'env()', '요청흐름', 'middleware'];
  var CLOUD = ['서비스 컨테이너', '의존성 주입', 'Facade', '서비스 프로바이더', 'config()', 'env()', '미들웨어', '라우트 모델 바인딩',
    'FormRequest', 'validate()', 'flash', 'Eloquent', '대량 할당', 'casts', 'hasMany', '괄호 규칙', 'N+1', 'with()', '로컬 스코프',
    'Collection', 'Blade', '@csrf', '@extends', '컴포넌트', '$slot', '마이그레이션', '팩토리', 'Pest', 'RefreshDatabase', 'tinker', 'route:list'];

  /* ── 검색 진입점 ──────────────────────────────────────── */
  function chips(box, words) {
    words.forEach(function (w) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = w;
      b.addEventListener('click', function () { L.search.open(w); });
      box.appendChild(b);
    });
  }
  chips(L.$('#quick'), QUICK);
  chips(L.$('#tryQuick'), TRY);
  var hs = L.$('#heroSearch');
  // 한글 입력(IME)이 끊기지 않게, 글자를 치기 전에 검색 창으로 옮긴다
  hs.addEventListener('focus', function () { hs.blur(); L.search.open(''); });

  /* ── 설치 코드 ────────────────────────────────────────── */
  L.$$('.install pre code').forEach(function (c) { L.highlight(c, 'bash'); L.codeBox(c.parentNode, 'bash'); });

  /* ── 로드맵 ───────────────────────────────────────────── */
  var road = L.$('#road'), deep = L.$('#deep');
  L.docs.filter(function (d) { return typeof d.stage === 'number' || ['artisan', 'pitfalls', 'exercises'].indexOf(d.slug) >= 0 || d.stage === '심화'; })
    .forEach(function (d) {
      var box = d.stage === '심화' ? deep : road;
      if (!box) return;
      var el = document.createElement('div');
      var misc = typeof d.stage !== 'number';
      el.className = 'stage' + (misc ? ' misc' : '') + (L.done.get(d.slug) ? ' done' : '');
      el.innerHTML =
        (d.star ? '<span class="star">★ 핵심</span>' : '') +
        '<div class="top-row"><span class="num">' + L.esc(d.stage === '심화' ? '◆' : d.stage) + '</span>' +
        '<div><h3><a href="doc.html?d=' + d.slug + '"></a></h3><div class="meta"></div></div></div>' +
        (d.goal ? '<p class="goal"><b>' + (misc ? '이 문서로' : '마치면 할 수 있는 것') + '</b></p>' : '<p class="goal"></p>') +
        '<div class="heads" data-no-gl></div>';
      el.querySelector('h3 a').textContent = d.short;
      el.querySelector('.meta').textContent = d.title;
      el.querySelector('.goal').appendChild(document.createTextNode(d.goal || d.desc));
      box.appendChild(el);
      L.loadParsed(d.slug).then(function (P) {
        var hs2 = P.heads.filter(function (h) { return h.lv === 2 && h.text !== '목차' && !/암기 카드$/.test(h.text); });
        var box = el.querySelector('.heads');
        hs2.slice(0, 6).forEach(function (h) {
          var a = document.createElement('a');
          a.href = L.docUrl(d.slug, h.anchor);
          a.setAttribute('data-pv', d.slug + '#' + h.anchor);
          a.textContent = h.text.replace(/^\d+\.\s*/, '');
          box.appendChild(a);
        });
        if (hs2.length > 6) {
          var more = document.createElement('a');
          more.href = 'doc.html?d=' + d.slug;
          more.setAttribute('data-pv', d.slug);
          more.textContent = '+' + (hs2.length - 6);
          box.appendChild(more);
        }
      });
    });

  /* ── 기초 암기 카드 — SKILL.md 의 절을 탭으로 ─────────── */
  L.loadParsed('skill').then(function (P) {
    var top = P.heads.filter(function (h) { return h.anchor === '기초-암기-카드'; })[0];
    var tabs = L.$('#cardTabs'), body = L.$('#cardBody');
    if (!top) { body.innerHTML = '<div class="state">SKILL.md 에서 “기초 암기 카드” 절을 찾지 못했습니다.</div>'; return; }
    var subs = P.heads.filter(function (h) { return h.parent === top && h.lv === top.lv + 1; });
    body.innerHTML = '';
    var panes = [];
    subs.forEach(function (h, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'tab'); b.id = 'card-tab-' + i;
      b.textContent = h.text;
      tabs.appendChild(b);
      var pane = L.render(P.lines.slice(h.line + 1, h.end).join('\n'), { slug: 'skill' });
      pane.setAttribute('role', 'tabpanel');
      pane.setAttribute('aria-labelledby', b.id);
      pane.hidden = i !== 0;
      body.appendChild(pane);
      panes.push([b, pane]);
      b.addEventListener('click', function () { show(i); });
    });
    function show(i) {
      panes.forEach(function (p, k) { p[0].setAttribute('aria-selected', k === i ? 'true' : 'false'); p[1].hidden = k !== i; });
    }
    tabs.addEventListener('keydown', function (ev) {
      var i = panes.findIndex(function (p) { return p[0] === document.activeElement; });
      if (i < 0) return;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
        ev.preventDefault();
        var n = (i + (ev.key === 'ArrowRight' ? 1 : -1) + panes.length) % panes.length;
        show(n); panes[n][0].focus();
      }
    });
    show(0);

    // 차이표
    var diff = P.heads.filter(function (h) { return h.anchor === '옛-튜토리얼과-이-프로젝트의-차이'; })[0];
    if (diff) L.$('#diffBody').appendChild(L.render(P.lines.slice(diff.line + 1, diff.end).join('\n'), { slug: 'skill' }));
  });

  /* ── 용어 — 본문 밑줄과 모음 ─────────────────────────── */
  L.gloss.whenReady(function () {
    ['#heroLead', '#flow'].forEach(function (s) { L.gloss.apply(L.$(s)); });
    L.$$('.how').forEach(function (el) { L.gloss.apply(el, { all: true }); });
    var cloud = L.$('#cloud'), n = 0;
    CLOUD.forEach(function (t) {
      var e = L.gloss.byTerm[t];
      if (!e) return;
      var s = document.createElement('span');
      s.className = 'gl gl-m' + (L.isCodeTerm(t) ? ' code' : '');
      s.setAttribute('data-t', e.id);
      s.setAttribute('tabindex', '0');
      s.setAttribute('role', 'button');
      s.textContent = t;
      cloud.appendChild(s);
      n++;
    });
    var more = document.createElement('a');
    more.className = 'btn'; more.href = 'glossary.html';
    more.textContent = '전체 ' + L.gloss.list.length + '개 보기 →';
    cloud.appendChild(more);
    L.$('#termsLead').textContent = '용어 ' + L.gloss.list.length + '개 — 모든 항목에 뜻·순수 PHP 비교가 있고, 예제와 “자세히”(문서의 해당 절)가 붙어 있습니다. 올려 보거나 눌러 보세요.';
    stats();
  });
  // 키보드로 여는 일은 popup.js 가 모든 용어에 대해 한다

  /* ── 숫자 ─────────────────────────────────────────────── */
  function stats() {
    var box = L.$('#stats');
    function paint() {
      var s = L.search.stats;
      box.innerHTML =
        '<span><b>' + L.docs.length + '</b>편 문서</span>' +
        (s.lines ? '<span><b>' + s.lines.toLocaleString() + '</b>줄</span><span><b>' + s.secs + '</b>개 절</span>' : '') +
        '<span><b>' + L.gloss.list.length + '</b>개 용어 팝업</span>' +
        '<span><b>' + L.notes.list.length + '</b>개 코드 줄 설명</span>' + progress();
    }
    // 진도 — 로드맵 8단계(0~7) 중 "마쳤어요" 표시한 수
    function progress() {
      var st = L.docs.filter(function (d) { return typeof d.stage === 'number'; });
      var n = st.filter(function (d) { return L.done.get(d.slug); }).length;
      return n ? '<span class="prog"><b>' + n + '/' + st.length + '</b>단계 마침</span>' : '';
    }
    paint();
    L.notes.whenReady(paint);
    L.search.build().then(paint);
  }
})();
