/* ------------------------------------------------------------------
   팝업 — lib.js 다음에 불러온다
   ① 용어 팝업   .gl 에 마우스를 올리면(휴대폰은 탭) 뜬다. 탭: 뜻 · 예제 · 자세히
                 "자세히" 는 다른 문서의 해당 절을 팝업 안에 그대로 불러온다
   ② 링크 미리보기 a[data-pv] 에 마우스를 올리면 그 문서·절의 내용이 뜬다
                 (휴대폰은 첫 탭이 미리보기, 두 번째 탭이 이동)
   · 팝업 안의 용어·링크에서 다시 팝업이 열린다(중첩)
   · 클릭하면 고정된다. 바깥을 누르거나 Esc 로 닫는다
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  var L = window.LV, G = L.gloss;
  var stack = [], overEl = null, openT = 0, closeT = 0;
  var D_TERM = 150, D_LINK = 380, D_CLOSE = 280;

  function trigOf(node) {
    if (!node || !node.closest) return null;
    return node.closest('.gl[data-t], a[data-pv], .cn[data-note]');
  }
  function byEl(el) { for (var i = 0; i < stack.length; i++) if (stack[i].el === el) return stack[i]; return null; }
  function byTrig(t) { for (var i = 0; i < stack.length; i++) if (stack[i].trig === t) return stack[i]; return null; }
  function popOf(node) { var el = node && node.closest && node.closest('.pop'); return el ? byEl(el) : null; }
  function isDesc(q, p) { for (var r = q.parent; r; r = r.parent) if (r === p) return true; return false; }

  /* ── 열고 닫기 ────────────────────────────────────────── */
  function close(p) {
    stack.filter(function (q) { return isDesc(q, p); }).concat([p]).forEach(function (q) {
      var i = stack.indexOf(q);
      if (i < 0) return;
      stack.splice(i, 1);
      q.trig.classList.remove('gl-open');
      q.el.classList.remove('on');
      setTimeout(function () { if (q.el.parentNode) q.el.parentNode.removeChild(q.el); }, 140);
    });
  }
  function closeAll() { stack.slice().reverse().forEach(function (p) { if (stack.indexOf(p) >= 0) close(p); }); }
  function sweep() {
    var keep = [];
    stack.forEach(function (p) {
      if (p.pinned || (overEl && (p.el.contains(overEl) || p.trig.contains(overEl)))) {
        for (var r = p; r; r = r.parent) if (keep.indexOf(r) < 0) keep.push(r);
      }
    });
    stack.slice().reverse().forEach(function (p) { if (keep.indexOf(p) < 0 && stack.indexOf(p) >= 0) close(p); });
  }
  function pin(p) { p.pinned = true; p.el.classList.add('pinned'); }

  function open(t) {
    var ex = byTrig(t);
    if (ex) return ex;
    var parent = popOf(t);
    stack.filter(function (q) { return q.parent === parent; }).forEach(close);   // 같은 층의 팝업은 하나만
    var p = { trig: t, parent: parent, pinned: false, side: null, depth: parent ? parent.depth + 1 : 0 };
    if (t.classList.contains('gl')) {
      var e = G.byId[t.getAttribute('data-t')];
      if (!e) return null;
      p.el = termPop(e, p);
    } else if (t.classList.contains('cn')) {
      var n = L.notes.list[+t.getAttribute('data-note')];
      if (!n) return null;
      p.el = notePop(n, t);
    } else {
      p.el = linkPop(t.getAttribute('data-pv'), p);
    }
    p.el.style.zIndex = 80 + p.depth;
    stack.push(p);
    document.body.appendChild(p.el);
    place(p);
    t.classList.add('gl-open');
    requestAnimationFrame(function () { p.el.classList.add('on'); });
    return p;
  }

  /* ── 자리 잡기 ────────────────────────────────────────── */
  function place(p) {
    if (window.innerWidth <= 640) return;             // 좁은 화면은 CSS 가 아래쪽 시트로 띄운다
    if (!p.trig.isConnected) return close(p);
    var r = p.trig.getBoundingClientRect(), el = p.el;
    var vw = document.documentElement.clientWidth, vh = window.innerHeight;
    var topBar = (document.querySelector('.top') || { offsetHeight: 0 }).offsetHeight;
    var W = el.offsetWidth, H = el.offsetHeight;
    if (!p.side) p.side = (vh - r.bottom >= H + 14 || vh - r.bottom >= r.top - topBar) ? 'below' : 'above';
    var x = r.left + r.width / 2 - W / 2;
    x = Math.max(10, Math.min(x, vw - W - 10));
    var y = p.side === 'below' ? r.bottom + 8 : r.top - H - 8;
    y = Math.max(topBar + 6, Math.min(y, vh - H - 8));
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
  }
  function replaceAll() {
    stack.slice().forEach(function (p) {
      if (stack.indexOf(p) < 0) return;
      if (!p.trig.isConnected) return close(p);
      var r = p.trig.getBoundingClientRect();
      var gone = r.bottom < 0 || r.top > window.innerHeight;
      if (gone && !p.pinned) return close(p);
      place(p);
    });
  }

  /* ── 공통 틀 ──────────────────────────────────────────── */
  function shell(cls, label) {
    var el = document.createElement('div');
    el.className = 'pop ' + (cls || '');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', label);
    el.setAttribute('data-no-gl', '');
    return el;
  }
  function stageText(s) { return typeof s === 'number' ? s + '단계' : (s || ''); }
  function loading(box) { box.innerHTML = '<div class="loading">불러오는 중…</div>'; }
  function allowGloss(box) { box.removeAttribute('data-no-gl'); }

  /* ── ① 용어 팝업 ─────────────────────────────────────── */
  function termPop(e, p) {
    var el = shell(e.example && e.example.code && e.example.code.split('\n').length > 6 ? 'wide' : '', e.term + ' 뜻');
    var code = L.isCodeTerm(e.term);
    el.innerHTML =
      '<div class="pop-h"><span class="pop-t' + (code ? ' code' : '') + '"></span>' +
      '<span class="chip"></span><span class="chip gray"></span>' +
      '<button class="pop-x" type="button" aria-label="닫기">×</button></div>' +
      '<div class="pop-tabs" role="tablist"></div>' +
      '<div class="pop-b"></div>' +
      '<div class="pop-f"><a class="gd" href="glossary.html#' + e.id + '">용어 사전 ›</a>' +
      (e.official ? '<a class="of" target="_blank" rel="noopener">공식 문서 ↗</a>' : '') +
      '<a class="go" hidden></a></div>';
    el.querySelector('.pop-t').textContent = e.term;
    el.querySelector('.chip').textContent = e.kind;
    el.querySelector('.chip.gray').textContent = stageText(e.stage);
    if (e.official) el.querySelector('.of').href = e.official;
    var body = el.querySelector('.pop-b'), tabs = el.querySelector('.pop-tabs'), go = el.querySelector('.go');

    var list = [['뜻', mean]];
    if (e.example && e.example.code) list.push(['예제', example]);
    if (e.see) list.push(['자세히', more]);
    if (L.search && L.search.usedIn) list.push(['쓰이는 곳', used]);
    list.forEach(function (it, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = it[0];
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        L.$$('button', tabs).forEach(function (x) { x.setAttribute('aria-selected', 'false'); });
        b.setAttribute('aria-selected', 'true');
        stack.filter(function (q) { return q.parent === p; }).forEach(close);
        body.scrollTop = 0;
        it[1]();
        place(p);
      });
      tabs.appendChild(b);
      if (i === 0) b.setAttribute('aria-selected', 'true');
    });
    if (list.length < 2) tabs.hidden = true;

    function mean() {
      go.hidden = true;
      var h = '<p class="short">' + L.inline(e.short) + '</p><p>' + L.inline(e.desc) + '</p>';
      if (e.php) h += '<div class="php"><span>순수 PHP 로는</span>' + L.inline(e.php) + '</div>';
      if (e.aliases && e.aliases.length) h += '<div class="aka">같은 뜻 · ' + e.aliases.map(function (a) { return '<code>' + L.esc(a) + '</code>'; }).join(' ') + '</div>';
      body.innerHTML = h;
      L.noBreak(body);
      allowGloss(body);
      L.gloss.apply(body, { exclude: e, all: true });
    }
    function example() {
      go.hidden = true;
      var x = e.example;
      body.innerHTML = (x.caption ? '<p class="cap">' + L.inline(x.caption) + '</p>' : '') + '<pre><code></code></pre>';
      var c = body.querySelector('code');
      c.textContent = x.code;
      L.highlight(c, x.lang || 'php');
      L.codeBox(c.parentNode, x.lang || 'php');
      allowGloss(body);
      L.gloss.apply(body, { exclude: e, all: true });
    }
    function more() {
      var parts = e.see.split('#'), slug = parts[0], anchor = parts.slice(1).join('#');
      loading(body);
      go.hidden = false;
      go.href = L.docUrl(slug, anchor);
      go.textContent = '문서에서 열기 →';
      L.section(slug, anchor).then(function (S) {
        if (!S) { body.innerHTML = '<p>이 절을 찾지 못했습니다.</p>'; return; }
        body.innerHTML = '';
        var crumb = document.createElement('div');
        crumb.className = 'pop-crumb';
        crumb.innerHTML = L.esc(stageText(S.doc.stage) + ' · ' + S.doc.short) + '<b></b>';
        crumb.querySelector('b').textContent = S.head ? S.head.text : S.doc.title;
        body.appendChild(crumb);
        body.appendChild(sectionBody(S, slug));
        allowGloss(body);
        place(p);
      }, function (err) { body.innerHTML = '<p>불러오지 못했습니다 — ' + L.esc(err.message) + '</p>'; });
    }
    // 이 용어가 글자 그대로 나오는 다른 절들 — 링크에 올리면 그 절이 또 팝업으로 뜬다
    function used() {
      go.hidden = true;
      loading(body);
      L.search.build().then(function () {
        var rs = L.search.usedIn([e.term].concat(e.aliases || []), e.see), MAX = 8;
        if (!rs.length) { body.innerHTML = '<p class="cap">“자세히” 탭의 절 말고는 이 용어가 나오는 곳이 없습니다.</p>'; return; }
        var h = '<p class="cap">이 용어가 나오는 절 ' + rs.length + '곳' + (rs.length > MAX ? ' 중 많이 나오는 ' + MAX + '곳' : '') +
          ' — 올리면 미리보기, 누르면 이동</p><ul class="used">';
        rs.slice(0, MAX).forEach(function (r) {
          var it = r.it;
          h += '<li><a href="' + L.docUrl(it.d.slug, it.h.anchor) + '" data-pv="' + L.esc(r.key) + '">' +
            '<small>' + L.esc(stageText(it.d.stage) + ' · ' + it.d.short + (it.path.length ? ' › ' + it.path.join(' › ') : '')) + '</small>' + L.esc(it.title) + '</a>' +
            '<p>' + r.snip + '</p></li>';
        });
        body.innerHTML = h + '</ul>';
        place(p);
      }, function () { body.innerHTML = '<p>검색 색인을 만들지 못했습니다.</p>'; });
    }
    mean();
    return el;
  }

  /* ── ③ 코드 줄 각주 ──────────────────────────────────── */
  function notePop(n, t) {
    var el = shell('note', '코드 설명 ' + (n.num || ''));
    el.innerHTML =
      '<div class="pop-h"><span class="pop-t">코드 설명 <span class="cn-n"></span></span>' +
      '<button class="pop-x" type="button" aria-label="닫기">×</button></div>' +
      '<div class="pop-b"><pre class="cn-line"><code></code></pre><p class="cn-note"></p></div>';
    el.querySelector('.cn-n').textContent = n.num || '';
    // 배지가 붙은 줄의 글자(배지 번호 빼고)
    var code = t.closest('code'), line = '';
    if (code) {
      var cp = code.cloneNode(true);
      L.$$('.cn', cp).forEach(function (x) { x.parentNode.removeChild(x); });
      cp.textContent.split('\n').some(function (ln) { if (ln.indexOf(n.match) >= 0) { line = ln.trim(); return true; } return false; });
    }
    var c = el.querySelector('.cn-line code');
    c.textContent = line || n.match;
    L.highlight(c, 'php');
    var body = el.querySelector('.cn-note');
    body.innerHTML = L.inline(n.note);
    L.enhance(body, { slug: n.slug, inPopup: true, noGloss: true });
    allowGloss(el.querySelector('.pop-b'));
    L.gloss.whenReady(function () { L.gloss.apply(body, { all: true }); });
    return el;
  }

  /* ── ② 링크 미리보기 ─────────────────────────────────── */
  function linkPop(key, p) {
    var parts = key.split('#'), slug = parts[0], anchor = parts.slice(1).join('#');
    var d = L.docBySlug[slug];
    var el = shell('wide', '미리보기');
    el.innerHTML =
      '<div class="pop-h"><div class="pop-crumb"><span class="c1"></span><b></b></div>' +
      '<button class="pop-x" type="button" aria-label="닫기">×</button></div>' +
      '<div class="pop-b"></div>' +
      '<div class="pop-f"><span class="hint">' + (L.hoverable ? '클릭하면 이동 · Esc 닫기' : '한 번 더 누르면 이동') + '</span><a class="go"></a></div>';
    var body = el.querySelector('.pop-b'), go = el.querySelector('.go');
    el.querySelector('.c1').textContent = d ? stageText(d.stage) + ' · ' + d.short : slug;
    go.href = L.docUrl(slug, anchor);
    go.textContent = anchor ? '이 절로 이동 →' : '문서 열기 →';
    loading(body);
    if (!d) { body.innerHTML = '<p>없는 문서입니다.</p>'; return el; }
    L.section(slug, anchor).then(function (S) {
      if (!S) { body.innerHTML = '<p>이 절을 찾지 못했습니다.</p>'; return; }
      var path = S.head ? L.headPath(S.head) : [];
      el.querySelector('b').textContent = S.head ? path[path.length - 1] : S.doc.title;
      if (path.length > 1) el.querySelector('.c1').textContent += ' › ' + path.slice(0, -1).join(' › ');
      body.innerHTML = '';
      body.appendChild(sectionBody(S, slug));
      allowGloss(body);
      place(p);
    }, function (err) { body.innerHTML = '<p>불러오지 못했습니다 — ' + L.esc(err.message) + '</p>'; });
    return el;
  }

  // 절 내용(또는 문서 머리말 + 목차)을 그린다
  function sectionBody(S, slug) {
    if (S.head) return L.render(S.md, { slug: slug, inPopup: true });
    var box = document.createElement('div');
    box.className = 'md';
    var lead = document.createElement('p');
    lead.innerHTML = '<b>' + L.esc(S.doc.desc || '') + '</b>';
    box.appendChild(lead);
    var intro = S.md.trim();
    if (intro) box.appendChild(L.render(intro, { slug: slug, inPopup: true }));
    if (S.toc && S.toc.length) {
      var h = document.createElement('p');
      h.innerHTML = '<b>이 문서의 절</b>';
      box.appendChild(h);
      var ol = document.createElement('ul');
      ol.className = 'toc-list';
      S.toc.forEach(function (x) {
        var li = document.createElement('li'), a = document.createElement('a');
        a.href = L.docUrl(slug, x.anchor);
        a.setAttribute('data-pv', slug + '#' + x.anchor);
        a.textContent = x.text;
        li.appendChild(a); ol.appendChild(li);
      });
      box.appendChild(ol);
    }
    return box;
  }

  /* ── 이벤트 ───────────────────────────────────────────── */
  document.addEventListener('mouseover', function (ev) {
    overEl = ev.target;
    if (!L.hoverable) return;
    if (ev.target.closest && ev.target.closest('.pop')) clearTimeout(closeT);
    var t = trigOf(ev.target);
    if (!t) return;
    var term = t.classList.contains('gl');
    if (term && G.mode === 'off') return;
    if (byTrig(t)) { clearTimeout(closeT); return; }
    clearTimeout(openT);
    openT = setTimeout(function () { if (overEl && t.contains(overEl)) open(t); }, term || t.classList.contains('cn') ? D_TERM : D_LINK);
  });
  document.addEventListener('mouseout', function (ev) {
    if (!L.hoverable) return;
    if (!ev.relatedTarget) overEl = null;
    clearTimeout(closeT);
    closeT = setTimeout(sweep, D_CLOSE);
  });
  document.addEventListener('click', function (ev) {
    var x = ev.target.closest && ev.target.closest('.pop-x');
    if (x) { var px = popOf(x); if (px) close(px); return; }
    var t = trigOf(ev.target);
    if (t) {
      if (t.classList.contains('gl') || t.classList.contains('cn')) {
        ev.preventDefault();
        var ex = byTrig(t);
        if (ex && ex.pinned) close(ex);
        else { var np = ex || open(t); if (np) pin(np); }
        return;
      }
      // 링크 — 데스크톱은 그대로 이동, 휴대폰은 첫 탭이 미리보기
      if (L.hoverable || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) { closeAll(); return; }
      if (byTrig(t)) { closeAll(); return; }
      ev.preventDefault();
      var lp = open(t);
      if (lp) pin(lp);
      return;
    }
    var inPop = popOf(ev.target);
    if (!inPop) closeAll();
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && stack.length) {
      ev.preventDefault(); ev.stopPropagation();
      close(stack[stack.length - 1]);
    }
  }, true);
  window.addEventListener('scroll', function () { if (stack.length) replaceAll(); }, { passive: true, capture: true });
  window.addEventListener('resize', function () { if (stack.length) replaceAll(); });

  L.popup = { closeAll: closeAll, open: open, count: function () { return stack.length; } };
})();
