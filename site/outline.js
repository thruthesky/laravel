/* ------------------------------------------------------------------
   상세 목차(왼쪽 사이드바) — lib.js 다음, 페이지 스크립트(doc.js·home.js …) 앞에 불러온다
   · 문서 22편을 묶음별로 보여 주고, 문서마다 ▸ 를 누르면 그 문서의 절 목차가 펼쳐진다
   · 지금 보는 문서는 처음부터 펼쳐지고 h3 까지 보인다
   · 절 링크에 올리면 그 절이 미리보기 팝업으로 뜬다(a[data-pv])
   · 머리의 "목차에서 찾기" 는 문서·절 제목을 바로 좁힌다
   · 문서 화면은 왼쪽 고정 칸(#side), 홈·용어 사전은 메뉴 단추로 여는 서랍이다
   md 제목은 L.parse 가 GitHub 규칙으로 만든 앵커를 그대로 쓴다 — 여기에 앵커를 적지 않는다
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  var L = window.LV;
  var REPEAT = /^(핵심 개념|순수 PHP 와 비교|읽는 법|구조)$/;   // 절마다 되풀이되는 소제목
  var BADGE = { skill: '★', readme: '+', artisan: '$', pitfalls: '!', exercises: '?' };
  var GROUPS = [
    ['시작', function (x) { return x.slug === 'skill'; }],
    ['공부 로드맵', function (x) { return typeof x.stage === 'number'; }],
    ['수시로 보기', function (x) { return typeof x.stage !== 'number' && x.slug !== 'skill' && x.stage !== '심화'; }],
    ['심화 — 실무로', function (x) { return x.stage === '심화'; }]
  ];
  var OPEN_KEY = 'lv-ol-open';

  /* ── 공용: 목차에 올릴 제목 ─────────────────────────── */
  // opt.h3 — h3 도(되풀이 소제목 빼고), opt.noCards — "암기 카드" 절 빼기(홈 카드)
  L.outlineHeads = function (P, opt) {
    opt = opt || {};
    return P.heads.filter(function (h) {
      if (h.text === '목차') return false;
      if (h.lv === 2) return !(opt.noCards && /암기 카드$/.test(h.text));
      if (h.lv === 3) return !!opt.h3 && !REPEAT.test(h.text) && !(h.parent && h.parent.text === '목차');
      return false;
    });
  };
  // "7. 관계 — …" → ['7', '관계 — …']
  L.splitNum = function (text) {
    var m = text.match(/^(\d+)\.\s*(.*)$/);
    return m ? [m[1], m[2]] : ['', text];
  };
  function badge(x) { return typeof x.stage === 'number' ? x.stage : (BADGE[x.slug] || (x.stage === '심화' ? '◆' : '·')); }
  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ''); }

  function openSet() {
    var v = L.store.get(OPEN_KEY, '');
    return v ? v.split(',') : [];
  }
  function saveOpen(list) { L.store.set(OPEN_KEY, list.join(',')); }

  /* ── 목차 그리기 ────────────────────────────────────── */
  // box 를 채운다. opt.current = 지금 문서 slug(없으면 홈·용어 사전)
  // 돌려주는 값: { ready: Promise<[{anchor, a}]> } — 지금 문서의 목차 링크(본문 스크롤 따라 표시용)
  L.outline = function (box, opt) {
    opt = opt || {};
    var cur = opt.current || '', items = {}, remembered = openSet();
    box.innerHTML = '';
    box.classList.add('outline');

    var tools = document.createElement('div');
    tools.className = 'ol-tools';
    tools.innerHTML =
      '<input type="search" class="ol-q" placeholder="목차에서 찾기 — 문서·절 제목" autocomplete="off" spellcheck="false" aria-label="목차에서 찾기">' +
      '<div class="ol-btns"><button type="button" class="ol-all">모두 펼치기</button><button type="button" class="ol-none">모두 접기</button>' +
      '<span class="ol-cnt" aria-live="polite"></span></div>';
    box.appendChild(tools);
    var q = tools.querySelector('.ol-q'), cnt = tools.querySelector('.ol-cnt');

    var list = document.createElement('div');
    list.className = 'ol-list';
    box.appendChild(list);

    GROUPS.forEach(function (g) {
      var docs = L.docs.filter(g[1]);
      if (!docs.length) return;
      var lbl = document.createElement('div');
      lbl.className = 'lbl';
      lbl.textContent = g[0];
      list.appendChild(lbl);
      docs.forEach(function (x) { list.appendChild(docItem(x)); });
    });

    function docItem(x) {
      var me = x.slug === cur;
      var el = document.createElement('div');
      el.className = 'ol-doc' + (me ? ' me' : '');
      el.innerHTML =
        '<div class="ol-row">' +
        '<button type="button" class="ol-tg" aria-expanded="false" aria-label="' + L.esc(x.short) + ' 절 목차 펼치기"><i></i></button>' +
        '<a class="d' + (L.done.get(x.slug) ? ' done' : '') + (me ? ' cur" aria-current="page' : '') + '" href="doc.html?d=' + x.slug + '">' +
        '<span class="n">' + L.esc(badge(x)) + '</span><span class="t"></span></a></div>' +
        '<nav class="toc" hidden aria-label="' + L.esc(x.short) + ' 목차"></nav>';
      el.querySelector('.t').textContent = x.short;
      var it = items[x.slug] = { x: x, el: el, nav: el.querySelector('nav'), tg: el.querySelector('.ol-tg'), filled: null, open: false, me: me };
      it.tg.addEventListener('click', function () { toggle(it, !it.open, true); });
      return el;
    }

    // 절 목차 채우기 — 처음 펼칠 때 한 번(문서 md 는 lib.js 가 캐시한다)
    function fill(it) {
      if (it.filled) return it.filled;
      it.nav.innerHTML = '<span class="ol-loading">불러오는 중…</span>';
      it.filled = L.loadParsed(it.x.slug).then(function (P) {
        var hs = L.outlineHeads(P, { h3: it.me }), out = [];
        it.nav.innerHTML = '';
        hs.forEach(function (h) {
          var a = document.createElement('a'), sp = L.splitNum(h.text);
          a.className = 'h' + h.lv;
          if (it.me) a.href = '#' + h.anchor;
          else { a.href = L.docUrl(it.x.slug, h.anchor); a.setAttribute('data-pv', it.x.slug + '#' + h.anchor); }
          a.innerHTML = (sp[0] ? '<span class="no">' + sp[0] + '</span>' : '') + '<span class="tx"></span>';
          a.querySelector('.tx').textContent = sp[1];
          a.title = h.text;
          it.nav.appendChild(a);
          out.push({ anchor: h.anchor, a: a, text: h.text });
        });
        if (!out.length) it.nav.innerHTML = '<span class="ol-loading">절이 없습니다</span>';
        it.links = out;
        return out;
      }, function () {
        it.nav.innerHTML = '<span class="ol-loading">불러오지 못했습니다</span>';
        it.filled = null;
        return [];
      });
      return it.filled;
    }

    function toggle(it, on, remember) {
      it.open = on;
      it.el.classList.toggle('open', on);
      it.tg.setAttribute('aria-expanded', on ? 'true' : 'false');
      it.tg.setAttribute('aria-label', it.x.short + ' 절 목차 ' + (on ? '접기' : '펼치기'));
      it.nav.hidden = !on;
      if (on) fill(it);
      if (remember && !it.me) {
        var s = openSet().filter(function (k) { return k !== it.x.slug; });
        if (on) s.push(it.x.slug);
        saveOpen(s);
      }
      if (box.onUserToggle) box.onUserToggle();
    }

    // 처음 상태 — 지금 문서 + 전에 펼쳐 둔 문서
    Object.keys(items).forEach(function (k) {
      var it = items[k];
      if (it.me || remembered.indexOf(k) >= 0) toggle(it, true, false);
    });

    tools.querySelector('.ol-all').addEventListener('click', function () {
      Object.keys(items).forEach(function (k) { toggle(items[k], true, false); });
      saveOpen(Object.keys(items).filter(function (k) { return !items[k].me; }));
    });
    tools.querySelector('.ol-none').addEventListener('click', function () {
      Object.keys(items).forEach(function (k) { if (!items[k].me) toggle(items[k], false, false); });
      saveOpen([]);
    });

    /* ── 목차에서 찾기 — 문서·절 제목만 좁힌다(본문 검색은 ⌘K) ── */
    var saved = null, qt = 0;
    q.addEventListener('input', function () { clearTimeout(qt); qt = setTimeout(filter, 120); });
    q.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { ev.stopPropagation(); q.value = ''; filter(); }
      if (ev.key === 'Enter' && !ev.isComposing) {   // 첫 결과로 이동
        var first = list.querySelector('.ol-doc:not([hidden]) .toc a:not([hidden]), .ol-doc:not([hidden]) a.d');
        if (first) { ev.preventDefault(); first.click(); }
      }
    });
    function filter() {
      var v = norm(q.value), keys = Object.keys(items);
      if (!v) {
        cnt.textContent = '';
        list.classList.remove('filtering');
        keys.forEach(function (k) {
          var it = items[k];
          it.el.hidden = false;
          if (it.links) it.links.forEach(function (l) { l.a.hidden = false; });
          if (saved) toggle(it, saved[k], false);
        });
        L.$$('.lbl', list).forEach(function (l) { l.hidden = false; });
        saved = null;
        return;
      }
      if (!saved) { saved = {}; keys.forEach(function (k) { saved[k] = items[k].open; }); }
      list.classList.add('filtering');
      cnt.textContent = '찾는 중…';
      Promise.all(keys.map(function (k) { return fill(items[k]); })).then(function () {
        if (norm(q.value) !== v) return;
        var docsHit = 0, secsHit = 0;
        keys.forEach(function (k) {
          var it = items[k], x = it.x;
          var dHit = norm(x.short + ' ' + x.title + ' ' + (x.desc || '')).indexOf(v) >= 0, sHit = 0;
          (it.links || []).forEach(function (l) {
            var ok = norm(l.text).indexOf(v) >= 0;
            l.a.hidden = !ok && !dHit;
            if (ok) sHit++;
          });
          it.el.hidden = !dHit && !sHit;
          if (!it.el.hidden) { docsHit++; secsHit += sHit; toggle(it, sHit > 0, false); }
        });
        // 비는 묶음 제목은 숨긴다
        L.$$('.lbl', list).forEach(function (l) {
          var n = l.nextElementSibling, any = false;
          while (n && !n.classList.contains('lbl')) { if (!n.hidden) any = true; n = n.nextElementSibling; }
          l.hidden = !any;
        });
        cnt.textContent = docsHit ? '문서 ' + docsHit + ' · 절 ' + secsHit : '없음 — ⌘K 로 본문까지 찾기';
      });
    }

    var me = items[cur];
    return { ready: me ? fill(me) : Promise.resolve([]), items: items };
  };

  /* ── 홈·용어 사전 — 메뉴 단추로 여는 서랍 ────────────────── */
  L.outlineDrawer = function () {
    if (document.getElementById('side')) return;
    var side = document.createElement('aside');
    side.className = 'side drawer';
    side.id = 'side';
    side.setAttribute('data-no-gl', '');
    side.setAttribute('aria-label', '상세 목차');
    var scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.id = 'scrim';
    document.body.appendChild(side);
    document.body.appendChild(scrim);
    document.body.classList.add('has-drawer');
    L.outline(side, {});
  };

  /* ── 메뉴 단추·서랍 열고 닫기(모든 페이지 공통) ─────────── */
  L.menu = function () {
    var btn = document.getElementById('menuBtn'), side = document.getElementById('side'), scrim = document.getElementById('scrim');
    if (!btn || !side) return;
    function set(on) {
      document.body.classList.toggle('menu-open', on);
      btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (on) { var inp = side.querySelector('.ol-q'); if (inp && L.hoverable) setTimeout(function () { inp.focus(); }, 60); }
    }
    btn.addEventListener('click', function () { set(!document.body.classList.contains('menu-open')); });
    if (scrim) scrim.addEventListener('click', function () { set(false); });
    side.addEventListener('click', function (ev) {
      var a = ev.target.closest('a');
      if (a && !ev.metaKey && !ev.ctrlKey) set(false);
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && document.body.classList.contains('menu-open') && !(L.popup && L.popup.count())) set(false);
    });
  };
})();
