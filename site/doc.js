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
  document.title = d.title + ' · Laravel 13 공부';

  /* ── 왼쪽 상세 목차 — site/outline.js ─────────────────── */
  // 문서 22편과 각 문서의 절 목차. 지금 문서는 펼친 채 h2·h3 까지, 다른 문서는 ▸ 로 펼친다
  var ol = L.outline(side, { current: slug });
  // 사용자가 목차를 직접 만진 뒤 잠시는 본문 스크롤을 따라 목차를 끌어당기지 않는다
  var sideTouched = 0;
  function touched() { sideTouched = Date.now(); }
  side.onUserToggle = touched;
  ['wheel', 'touchmove', 'keydown'].forEach(function (t) { side.addEventListener(t, touched, { passive: true }); });
  // 목록이 길어졌으니 처음에 지금 문서가 보이게 한다
  var meRow = side.querySelector('.ol-doc.me');
  if (meRow) side.scrollTop = Math.max(0, meRow.offsetTop - 90);

  L.$('#crumb').innerHTML = '<b>' + L.esc(L.stageLabel(d)) + '</b> · ' + L.esc(d.short);
  L.$('#src').href = L.srcUrl(d);

  // 메뉴 단추(좁은 화면의 서랍)는 site/outline.js 의 L.menu 가 연다

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
      lead.innerHTML = '<b>' + (typeof d.stage === 'number' ? '이 단계를 마치면' : '이 문서로') + '</b> — ' + L.esc(d.goal) +
        '<label class="done-chk" data-no-gl><input type="checkbox"> 말로 설명할 수 있어요 — 마쳤어요</label>';
      h1.parentNode.insertBefore(lead, h1.nextSibling);
      // 진도 — 체크하면 왼쪽 목록과 홈 로드맵에 표시된다(이 브라우저에만 저장)
      var chk = lead.querySelector('input');
      chk.checked = L.done.get(slug);
      chk.addEventListener('change', function () {
        L.done.set(slug, chk.checked);
        var me = side.querySelector('.ol-doc.me a.d');
        if (me) me.classList.toggle('done', chk.checked);
      });
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

    // 지금 읽는 절 표시 — 상세 목차의 이 문서 링크와 본문 제목을 잇는다
    ol.ready.then(function (links) {
      var tocLinks = links.map(function (l) { return [document.getElementById(l.anchor), l.a]; }).filter(function (x) { return x[0]; });
      if (!('IntersectionObserver' in window) || !tocLinks.length) return;
      var io = new IntersectionObserver(function () {
        var cur = null;
        for (var i = 0; i < tocLinks.length; i++) {
          var r = tocLinks[i][0].getBoundingClientRect();
          if (r.top < window.innerHeight * 0.3) cur = tocLinks[i][1]; else break;
        }
        tocLinks.forEach(function (x) { x[1].classList.toggle('cur', x[1] === cur); });
        if (cur && Date.now() - sideTouched > 4000 && !document.body.classList.contains('menu-open')) {
          var sr = side.getBoundingClientRect(), cr = cur.getBoundingClientRect();
          if (cr.top < sr.top + 120 || cr.bottom > sr.bottom - 40) side.scrollTop += cr.top - sr.top - sr.height / 3;
        }
      }, { rootMargin: '0px 0px -60% 0px', threshold: [0, 1] });
      tocLinks.forEach(function (x) { io.observe(x[0]); });
    });

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
