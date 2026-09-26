/* ------------------------------------------------------------------
   문서 화면 (doc.html?d=slug&q=검색어#앵커)
   md 를 그대로 읽어 그린다 — 원문은 GitHub 의 SKILL.md·references/*.md 하나뿐이다
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  var L = window.LV;
  L.header('doc');

  var P = new URLSearchParams(location.search);
  var slug = L.docBySlug[P.get('d')] ? P.get('d') : 'skill';
  var d = L.docBySlug[slug];
  var art = L.$('#doc'), side = L.$('#side'), findIn = L.$('#find'), cnt = L.$('#findCnt');
  var BADGE = { skill: '★', readme: '+', artisan: '$', pitfalls: '!', exercises: '?' };
  document.title = d.title + ' · Laravel 13 공부';

  /* ── 왼쪽 목록 ────────────────────────────────────────── */
  var groups = [
    ['시작', function (x) { return x.slug === 'skill'; }],
    ['공부 로드맵', function (x) { return typeof x.stage === 'number'; }],
    ['수시로 보기', function (x) { return typeof x.stage !== 'number' && x.slug !== 'skill'; }]
  ];
  var h = '';
  groups.forEach(function (g) {
    h += '<div class="lbl">' + g[0] + '</div>';
    L.docs.filter(g[1]).forEach(function (x) {
      var n = typeof x.stage === 'number' ? x.stage : (BADGE[x.slug] || '·');
      h += '<a class="d' + (x === d ? ' cur" aria-current="page' : '') + '" href="doc.html?d=' + x.slug + '">' +
        '<span class="n">' + L.esc(n) + '</span><span>' + L.esc(x.short) + '</span></a>';
      if (x === d) h += '<nav class="toc" id="toc" aria-label="이 문서의 목차"></nav>';
    });
  });
  side.innerHTML = h;
  var tocBox = L.$('#toc');

  L.$('#crumb').innerHTML = '<b>' + L.esc(L.stageLabel(d)) + '</b> · ' + L.esc(d.short);
  L.$('#src').href = L.srcUrl(d);

  // 휴대폰 — 목록 서랍
  var menu = L.$('#menuBtn');
  function menuOpen(on) { document.body.classList.toggle('menu-open', on); if (menu) menu.setAttribute('aria-expanded', on ? 'true' : 'false'); }
  if (menu) menu.addEventListener('click', function () { menuOpen(!document.body.classList.contains('menu-open')); });
  L.$('#scrim').addEventListener('click', function () { menuOpen(false); });
  side.addEventListener('click', function (ev) { if (ev.target.closest('a')) menuOpen(false); });

  /* ── 본문 ─────────────────────────────────────────────── */
  L.loadMd(slug).then(function (md) {
    var Pm = L.parse(slug, md);
    art.innerHTML = window.marked ? marked.parse(md, { gfm: true, breaks: false }) : '<pre>' + L.esc(md) + '</pre>';

    // 제목 id — md 에서 뽑은 앵커를 순서대로 준다(GitHub 과 같은 규칙). 수가 다르면 글자로 다시 만든다
    var hs = L.$$('h1, h2, h3, h4, h5, h6', art);
    if (hs.length === Pm.heads.length) hs.forEach(function (el, i) { el.id = Pm.heads[i].anchor; });
    else {
      var seen = {};
      hs.forEach(function (el) {
        var a = L.slug(el.textContent.trim());
        if (a in seen) { seen[a]++; a += '-' + seen[a]; } else seen[a] = 0;
        el.id = a;
      });
    }

    // 이 단계를 마치면 — 로드맵의 체크포인트
    var h1 = L.$('h1', art);
    if (h1 && d.goal) {
      var lead = document.createElement('div');
      lead.className = 'doc-lead';
      lead.innerHTML = '<b>' + (typeof d.stage === 'number' ? '이 단계를 마치면' : '이 문서로') + '</b> — ' + L.esc(d.goal);
      h1.parentNode.insertBefore(lead, h1.nextSibling);
    }

    // 문서 안의 "목차" 절은 넓은 화면에서 숨긴다(왼쪽 목록과 겹친다)
    var tocH = hs.filter(function (el) { return el.tagName === 'H2' && el.textContent.trim() === '목차'; })[0];
    if (tocH) {
      tocH.classList.add('md-toc');
      for (var n = tocH.nextElementSibling; n && n.tagName !== 'H2'; n = n.nextElementSibling) {
        n.classList.add('md-toc');
        if (n.tagName === 'HR') break;
      }
    }

    L.enhance(art, { slug: slug, isPage: true, noGloss: true });

    // 1단계 문서 — 글자 그림 흐름도 앞에 팝업이 되는 흐름도를 끼우고, 글자 그림은 접어 둔다
    var flowH = slug === 'lifecycle' && L.flowBox ? document.getElementById('흐름도') : null;
    var flowPre = flowH && flowH.nextElementSibling;
    if (flowPre && flowPre.classList.contains('codebox')) {
      var det = document.createElement('details');
      det.className = 'ascii';
      det.innerHTML = '<summary>글자 그림으로 보기 — 서비스 프로바이더·미들웨어 뒷부분까지 더 자세히</summary>';
      flowPre.parentNode.insertBefore(L.flowBox(), flowPre);
      flowPre.parentNode.insertBefore(det, flowPre);
      det.appendChild(flowPre);
    }

    // 절 링크(#)
    hs.forEach(function (el) {
      if (el.tagName !== 'H2' && el.tagName !== 'H3') return;
      var a = document.createElement('a');
      a.className = 'hlink'; a.href = '#' + el.id; a.textContent = '#';
      a.setAttribute('aria-label', '이 절 링크');
      el.appendChild(a);
    });

    // 왼쪽 목차
    var tocLinks = [];
    hs.forEach(function (el) {
      if ((el.tagName !== 'H2' && el.tagName !== 'H3') || el.classList.contains('md-toc')) return;
      if (el.tagName === 'H3' && /^(핵심 개념|순수 PHP 와 비교|읽는 법|구조)$/.test(el.textContent.replace(/#$/, '').trim())) return;   // 절마다 되풀이되는 소제목은 뺀다
      var a = document.createElement('a');
      a.href = '#' + el.id;
      a.className = el.tagName.toLowerCase();
      a.textContent = el.firstChild ? el.textContent.replace(/#$/, '').trim() : '';
      tocBox.appendChild(a);
      tocLinks.push([el, a]);
    });

    // 지금 읽는 절 표시
    if ('IntersectionObserver' in window && tocLinks.length) {
      var vis = {};
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { vis[e.target.id] = e.isIntersecting; });
        var cur = null;
        for (var i = 0; i < tocLinks.length; i++) {
          var r = tocLinks[i][0].getBoundingClientRect();
          if (r.top < window.innerHeight * 0.3) cur = tocLinks[i][1]; else break;
        }
        tocLinks.forEach(function (x) { x[1].classList.toggle('cur', x[1] === cur); });
        if (cur) {
          var sr = side.getBoundingClientRect(), cr = cur.getBoundingClientRect();
          if (cr.top < sr.top + 60 || cr.bottom > sr.bottom - 40) side.scrollTop += cr.top - sr.top - sr.height / 3;
        }
      }, { rootMargin: '0px 0px -60% 0px', threshold: [0, 1] });
      tocLinks.forEach(function (x) { io.observe(x[0]); });
    }

    // 이전·다음 문서
    var pg = L.$('#pager'), pv = L.docs[d.i - 1], nx = L.docs[d.i + 1];
    pg.innerHTML =
      (pv ? '<a class="prev" href="doc.html?d=' + pv.slug + '"><small>← 이전 · ' + L.esc(L.stageLabel(pv)) + '</small><b>' + L.esc(pv.short) + '</b></a>' : '') +
      (nx ? '<a class="next" href="doc.html?d=' + nx.slug + '"><small>다음 · ' + L.esc(L.stageLabel(nx)) + ' →</small><b>' + L.esc(nx.short) + '</b></a>' : '');

    // 용어 밑줄
    L.gloss.whenReady(function () {
      L.gloss.reset();
      L.gloss.apply(art);
      arrive();
    });
  }).catch(function (err) {
    art.innerHTML = '<div class="state"><b>문서를 불러오지 못했습니다</b><code>' + L.esc(d.path) + '</code> — ' +
      L.esc(err.message) + '<br><br><a href="index.html">← 처음으로</a></div>';
  });

  /* ── 도착 — 앵커로 가고 검색어를 칠한다 ─────────────── */
  function target() {
    var id = decodeURIComponent(location.hash.slice(1));
    return id ? document.getElementById(id) : null;
  }
  function arrive() {
    var t = target(), q = P.get('q') || '';
    if (q) {
      findIn.value = q;
      find(q, t);
    } else if (t) {
      t.scrollIntoView();
      flash(t);
    }
  }
  function flash(el) { el.classList.remove('flash-target'); void el.offsetWidth; el.classList.add('flash-target'); }

  /* ── 이 문서에서 찾기 ─────────────────────────────────── */
  var marks = [], cur = -1, ft = 0;
  function find(q, after) {
    L.unmark(art);
    marks = []; cur = -1;
    if (!q.trim()) { cnt.textContent = ''; return; }
    marks = L.markText(art, L.needles(q), '.hlink');
    if (!marks.length) { cnt.textContent = '없음'; if (after) after.scrollIntoView(); return; }
    var start = 0;
    if (after) {
      for (var i = 0; i < marks.length; i++) {
        if (after.compareDocumentPosition(marks[i][0]) & Node.DOCUMENT_POSITION_FOLLOWING) { start = i; break; }
      }
    }
    step(start, true);
  }
  function step(i, scroll) {
    if (!marks.length) return;
    if (cur >= 0 && marks[cur]) marks[cur].forEach(function (m) { m.classList.remove('cur'); });
    cur = (i + marks.length) % marks.length;
    marks[cur].forEach(function (m) { m.classList.add('cur'); });
    cnt.textContent = (cur + 1) + '/' + marks.length;
    if (scroll) marks[cur][0].scrollIntoView({ block: 'center' });
  }
  findIn.addEventListener('input', function () {
    clearTimeout(ft);
    ft = setTimeout(function () { find(findIn.value); }, 180);
  });
  findIn.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); clearTimeout(ft); if (!marks.length || cur < 0) find(findIn.value); else step(cur + (ev.shiftKey ? -1 : 1), true); }
    else if (ev.key === 'Escape') { findIn.value = ''; find(''); findIn.blur(); }
  });
  L.$('#findNext').addEventListener('click', function () { step(cur + 1, true); });
  L.$('#findPrev').addEventListener('click', function () { step(cur - 1, true); });

  // 검색 팔레트에서 같은 문서를 고르면 다시 읽지 않는다
  L.onNavigate = function (it, q) {
    if (it.type !== 'sec' || it.d.slug !== slug) return false;
    var a = it.h ? it.h.anchor : '';
    history.pushState(null, '', L.docUrl(slug, a, q));
    findIn.value = q;
    var t = a ? document.getElementById(a) : null;
    find(q, t);
    if (t && !marks.length) flash(t);
    return true;
  };
  window.addEventListener('hashchange', function () { var t = target(); if (t) flash(t); });
})();
