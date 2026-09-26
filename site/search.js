/* ------------------------------------------------------------------
   검색 — 사이트 전체 전문 검색 (lib.js·popup.js 다음에 불러온다)
   · 모든 md 를 절(제목 단위)로 나눠 본문·코드까지 색인한다 — 서버 없이 브라우저 안에서
   · 용어 사전도 함께 찾는다
   · 한↔영 별칭(미들웨어 ↔ middleware), 조사 떼기(모델이 → 모델), 띄어쓰기 무시(요청흐름)
   · ⌘K · Ctrl+K · / 로 연다. ↑↓ 이동, Enter 열기, Esc 닫기
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  var L = window.LV;
  var IDX = null, items = [], stats = { docs: 0, secs: 0, lines: 0, terms: 0 };
  var SUGGEST = ['미들웨어', 'N+1', 'with()', '괄호 규칙', 'flash', '419', 'Facade', '서비스 컨테이너', 'FormRequest', 'tinker', '마이그레이션', 'env()'];

  /* ── 색인 만들기 ──────────────────────────────────────── */
  function plain(md) {
    return md
      .replace(/^(```|~~~).*$/gm, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\*\*|`/g, '')
      .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, ' ')
      .replace(/\|/g, ' · ')
      .replace(/^>\s?/gm, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n')
      .trim();
  }
  function lower(s) { return s.toLowerCase(); }
  function nospace(s) { return s.replace(/\s+/g, ''); }

  function build() {
    if (IDX) return IDX;
    IDX = Promise.all([L.gloss.ready].concat(L.docs.map(function (d) {
      return L.loadParsed(d.slug).then(function (P) { return [d, P]; }, function () { return null; });
    }))).then(function (res) {
      items = [];
      L.gloss.list.forEach(function (e) {
        var names = [e.term].concat(e.aliases || []);
        var hay = lower(names.join(' ') + ' ' + e.short + ' ' + e.desc + ' ' + (e.php || '') + ' ' + (e.example ? e.example.code : ''));
        items.push({ type: 'term', e: e, title: e.term, names: names.map(lower), hay: hay, ns: nospace(hay), text: e.short + ' — ' + e.desc });
      });
      stats.terms = L.gloss.list.length;
      res.slice(1).forEach(function (r) {
        if (!r) return;
        var d = r[0], P = r[1];
        stats.docs++; stats.lines += P.lines.length;
        var h1 = P.heads.filter(function (h) { return h.lv === 1; })[0];
        var first = P.heads.filter(function (h) { return h.lv >= 2; })[0];
        var introMd = P.lines.slice(h1 ? h1.line + 1 : 0, first ? first.line : P.lines.length).join('\n');
        var intro = plain(introMd);
        items.push(sec(d, null, d.title, [], intro + ' ' + d.desc));
        P.heads.forEach(function (h) {
          if (h.lv < 2 || h.text === '목차') return;
          var body = plain(P.lines.slice(h.line + 1, h.next).join('\n'));
          var path = L.headPath(h).slice(0, -1);
          items.push(sec(d, h, h.text, path, body));
          stats.secs++;
        });
      });
      return items;
    });
    return IDX;
  }
  function sec(d, h, title, path, text) {
    var hay = lower(title + ' \n' + path.join(' ') + ' \n' + text);
    return {
      type: 'sec', d: d, h: h, title: title, path: path, text: text,
      tl: lower(title), pl: lower(path.join(' ') + ' ' + d.short + ' ' + d.title), hay: hay, ns: nospace(hay)
    };
  }

  /* ── 찾기·점수 ────────────────────────────────────────── */
  function count(h, v) { var n = 0, i = -1; while ((i = h.indexOf(v, i + 1)) >= 0 && n < 8) n++; return n; }
  function query(q) {
    var toks = L.tokens(q);
    if (!toks.length) return [];
    var vs = toks.map(function (t) { return L.variants(t); });
    var ql = lower(q.trim()), out = [];
    items.forEach(function (it) {
      var score = 0;
      for (var i = 0; i < toks.length; i++) {
        var best = 0;
        vs[i].forEach(function (v, vi) {
          var s = 0, vn = nospace(v);
          if (it.hay.indexOf(v) >= 0) s = 1 + Math.min(count(it.hay, v), 6);
          else if (vn && it.ns.indexOf(vn) >= 0) s = 2 + (it.type === 'sec' && nospace(it.tl).indexOf(vn) >= 0 ? 12 : 0);   // 띄어쓰기만 다른 것
          else return;
          if (it.type === 'term') {
            if (it.names.indexOf(v) >= 0) s += 60;
            else if (it.names.some(function (n) { return n.indexOf(v) === 0; })) s += 22;
            else if (it.names.some(function (n) { return n.indexOf(v) >= 0; })) s += 10;
          } else {
            if (it.tl.indexOf(v) >= 0) s += 14;
            if (it.pl.indexOf(v) >= 0) s += 3;
          }
          if (vi > 0) s *= 0.8;          // 별칭으로 맞은 것은 조금 낮게
          if (s > best) best = s;
        });
        if (!best) return;               // 모든 낱말이 맞아야 한다
        score += best;
      }
      if (toks.length > 1 && it.hay.indexOf(ql) >= 0) score += 12;
      if (it.type === 'term' && toks.length > 1 && it.names.indexOf(ql) >= 0) score += 80;   // 여러 낱말 이름이 그대로 맞으면 맨 위
      if (it.type === 'sec' && !it.h) score *= 0.7;
      out.push({ it: it, score: score });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  }
  function needleRe(ns) {
    if (!ns.length) return null;
    return new RegExp('(' + ns.map(function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'gi');
  }
  function hl(s, re) {
    if (!re) return L.esc(s);
    var out = '', last = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(s))) {
      if (!m[0].length) { re.lastIndex++; continue; }
      out += L.esc(s.slice(last, m.index)) + '<mark>' + L.esc(m[0]) + '</mark>';
      last = m.index + m[0].length;
    }
    return out + L.esc(s.slice(last));
  }
  function snippet(text, ns, re) {
    var low = lower(text), pos = -1, len = 0;
    ns.forEach(function (v) { var i = low.indexOf(v); if (i >= 0 && (pos < 0 || i < pos)) { pos = i; len = v.length; } });
    if (pos < 0) return hl(text.slice(0, 140), re);
    var s = Math.max(0, pos - 42), e = Math.min(text.length, pos + len + 110);
    return (s > 0 ? '…' : '') + hl(text.slice(s, e).replace(/\n/g, ' '), re) + (e < text.length ? '…' : '');
  }

  /* ── 팔레트 ───────────────────────────────────────────── */
  var root, input, list, prev, foot, sel = -1, shown = [], lastQ = null, prevT = 0, returnFocus = null;
  function ensure() {
    if (root) return;
    root = document.createElement('div');
    root.className = 'pal-scrim';
    root.hidden = true;
    root.setAttribute('data-no-gl', '');
    root.innerHTML =
      '<div class="pal" role="dialog" aria-modal="true" aria-label="사이트 검색">' +
      '<div class="pal-in">' + L.ICON.search +
      '<input type="search" autocomplete="off" spellcheck="false" aria-controls="palList" aria-autocomplete="list" ' +
      'placeholder="용어·개념·코드 검색 — 예: N+1, with(), 미들웨어, 419">' +
      '<kbd class="esc">Esc</kbd></div>' +
      '<div class="pal-body"><div class="pal-list" id="palList" role="listbox" aria-label="검색 결과"></div>' +
      '<div class="pal-prev" aria-live="polite"></div></div>' +
      '<div class="pal-foot"><span class="k"><kbd>↑</kbd><kbd>↓</kbd> 고르기</span><span class="k"><kbd>Enter</kbd> 열기</span>' +
      '<span><kbd>Esc</kbd> 닫기</span><span class="stat"></span></div></div>';
    document.body.appendChild(root);
    input = root.querySelector('input');
    list = root.querySelector('.pal-list');
    prev = root.querySelector('.pal-prev');
    foot = root.querySelector('.stat');
    root.addEventListener('mousedown', function (ev) { if (ev.target === root) close(); });
    input.addEventListener('input', function () { run(input.value); });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); select(sel + 1, true); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); select(sel - 1, true); }
      else if (ev.key === 'Enter' && !ev.isComposing) {
        ev.preventDefault();
        if (shown[sel]) go(shown[sel], ev.metaKey || ev.ctrlKey);
      } else if (ev.key === 'Escape') { ev.preventDefault(); close(); }
    });
    list.addEventListener('mousemove', function (ev) {
      var a = ev.target.closest('.pal-item');
      if (a) { var i = +a.getAttribute('data-i'); if (i !== sel) select(i, false); }
    });
    list.addEventListener('click', function (ev) {
      var a = ev.target.closest('.pal-item');
      if (!a) return;
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey) return;        // 새 탭은 브라우저에 맡긴다
      ev.preventDefault();
      go(shown[+a.getAttribute('data-i')], false);
    });
    root.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Tab') return;                                 // 대화 상자 안에서만 초점이 돈다
      var f = L.$$('input, a[href], button', root).filter(function (x) { return x.offsetParent; });
      if (!f.length) return;
      var i = f.indexOf(document.activeElement);
      if (ev.shiftKey && i <= 0) { ev.preventDefault(); f[f.length - 1].focus(); }
      else if (!ev.shiftKey && i === f.length - 1) { ev.preventDefault(); f[0].focus(); }
    });
  }
  function open(q) {
    ensure();
    returnFocus = document.activeElement;
    if (L.popup) L.popup.closeAll();
    root.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    input.value = q || '';
    input.focus();
    if (q) input.setSelectionRange(q.length, q.length);
    lastQ = null;
    list.innerHTML = '<div class="pal-empty">색인을 만드는 중…</div>';
    build().then(function () {
      foot.textContent = '문서 ' + stats.docs + '편 · 절 ' + stats.secs + '개 · 용어 ' + stats.terms + '개';
      run(input.value);
    });
  }
  function close() {
    if (!root || root.hidden) return;
    root.hidden = true;
    document.documentElement.style.overflow = '';
    if (L.popup) L.popup.closeAll();
    if (returnFocus && returnFocus.focus && document.contains(returnFocus)) returnFocus.focus();
  }
  function run(q) {
    if (!items.length) return;
    if (q === lastQ) return;
    lastQ = q;
    sel = -1; shown = [];
    if (!q.trim()) { empty(); return; }
    var res = query(q), ns = L.needles(q), re = needleRe(ns);
    var terms = res.filter(function (r) { return r.it.type === 'term'; }).slice(0, 6);
    var secs = res.filter(function (r) { return r.it.type === 'sec'; }).slice(0, 40);
    shown = terms.concat(secs).map(function (r) { return r.it; });
    if (!shown.length) {
      list.innerHTML = '<div class="pal-empty"><b>“' + L.esc(q) + '” 를 찾지 못했습니다</b>' +
        '다른 말로 찾아 보세요. 한국어·영어 어느 쪽으로 써도 됩니다(예: 검증 = validate).' + sugg() + '</div>';
      prev.innerHTML = '';
      return;
    }
    var h = '';
    if (terms.length) h += '<div class="pal-grp">용어 · ' + terms.length + '</div>';
    shown.forEach(function (it, i) {
      if (i === terms.length && secs.length) h += '<div class="pal-grp">문서 · ' + secs.length + (res.length - terms.length > 40 ? '+' : '') + '</div>';
      if (it.type === 'term') {
        h += '<a class="pal-item" role="option" id="pal-i-' + i + '" data-i="' + i + '" href="glossary.html#' + it.e.id + '">' +
          '<div class="p1"><span class="chip">' + L.esc(it.e.kind) + '</span><span>' + hl(it.e.term, re) + '</span></div>' +
          '<div class="snip">' + hl(it.e.short, re) + '</div></a>';
      } else {
        var crumb = L.stageLabel(it.d) + ' · ' + it.d.short + (it.path.length ? ' › ' + it.path.join(' › ') : '');
        h += '<a class="pal-item" role="option" id="pal-i-' + i + '" data-i="' + i + '" href="' + L.docUrl(it.d.slug, it.h ? it.h.anchor : '', q) + '">' +
          '<div class="path">' + L.esc(crumb) + '</div>' +
          '<div class="p1"><span>' + hl(it.title, re) + '</span></div>' +
          '<div class="snip">' + snippet(it.text, ns, re) + '</div></a>';
      }
    });
    list.innerHTML = h;
    list.scrollTop = 0;
    select(0, false);
  }
  function sugg() {
    return '<div class="pal-sugg">' + SUGGEST.map(function (s) { return '<button type="button">' + L.esc(s) + '</button>'; }).join('') + '</div>';
  }
  function empty() {
    list.innerHTML = '<div class="pal-empty"><b>무엇이든 찾아 보세요</b>' +
      '용어 이름, 개념, 코드 조각, 오류 번호까지 모든 문서의 본문을 찾습니다. 띄어쓰기·조사는 신경 쓰지 않아도 됩니다.' + sugg() + '</div>';
    prev.innerHTML = '<div class="pal-empty"><b>미리보기</b>결과를 고르면 여기에 그 절의 내용이 나옵니다. 안의 용어에 마우스를 올리면 뜻이 뜹니다.</div>';
  }
  function select(i, scroll) {
    var n = shown.length;
    if (!n) return;
    sel = (i + n) % n;
    L.$$('.pal-item', list).forEach(function (a) {
      var on = +a.getAttribute('data-i') === sel;
      a.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) { input.setAttribute('aria-activedescendant', a.id); if (scroll) a.scrollIntoView({ block: 'nearest' }); }
    });
    clearTimeout(prevT);
    prevT = setTimeout(preview, 60);
  }
  function preview() {
    var it = shown[sel];
    if (!it || window.innerWidth <= 860) return;
    if (L.popup) L.popup.closeAll();
    var ns = L.needles(input.value);
    prev.innerHTML = '';
    prev.scrollTop = 0;
    if (it.type === 'term') {
      prev.appendChild(termCard(it.e));
    } else {
      var c = document.createElement('div');
      c.className = 'crumb';
      c.textContent = L.stageLabel(it.d) + ' · ' + it.d.title + (it.path.length ? ' › ' + it.path.join(' › ') : '');
      prev.appendChild(c);
      L.section(it.d.slug, it.h ? it.h.anchor : '').then(function (S) {
        if (shown[sel] !== it || !S) return;
        var md = S.head ? S.md : '# ' + it.d.title + '\n\n' + S.md;
        var box = L.render(md, { slug: it.d.slug, inPopup: true, noGloss: true });
        prev.appendChild(box);
        var groups = L.markText(box, ns, 'pre');
        L.gloss.whenReady(function () { L.gloss.apply(box, { all: false }); });
        if (groups[0] && groups[0][0]) {
          var m0 = groups[0][0];
          if (m0.offsetTop > prev.clientHeight * .6) prev.scrollTop = m0.offsetTop - 80;
        }
      });
    }
  }
  function termCard(e) {
    var box = document.createElement('div');
    box.className = 'md';
    var h = '<h3 style="margin-top:0">' + L.esc(e.term) + ' <span class="chip">' + L.esc(e.kind) + '</span></h3>' +
      '<p><b>' + L.inline(e.short) + '</b></p><p>' + L.inline(e.desc) + '</p>';
    if (e.php) h += '<blockquote><p><b>순수 PHP 로는</b> ' + L.inline(e.php) + '</p></blockquote>';
    box.innerHTML = h;
    L.noBreak(box);
    if (e.example && e.example.code) {
      if (e.example.caption) { var cp = document.createElement('p'); cp.innerHTML = '<b>예제</b> — ' + L.inline(e.example.caption); box.appendChild(cp); }
      var pre = document.createElement('pre'), c = document.createElement('code');
      c.textContent = e.example.code; pre.appendChild(c); box.appendChild(pre);
      L.highlight(c, e.example.lang || 'php');
      L.codeBox(pre, e.example.lang || 'php');
    }
    L.gloss.whenReady(function () { L.gloss.apply(box, { exclude: e, all: true }); });
    return box;
  }
  function go(it, newTab) {
    var url = it.type === 'term' ? 'glossary.html#' + it.e.id : L.docUrl(it.d.slug, it.h ? it.h.anchor : '', input.value.trim());
    if (newTab) { window.open(url, '_blank', 'noopener'); return; }
    close();
    // 같은 화면이면 다시 읽지 않고 그 자리로 간다
    if (L.onNavigate && L.onNavigate(it, input.value.trim())) return;
    location.href = url;
  }

  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('.pal-sugg button');
    if (b) { input.value = b.textContent; run(input.value); input.focus(); }
  });
  document.addEventListener('keydown', function (ev) {
    var k = ev.key, typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName) || (document.activeElement && document.activeElement.isContentEditable);
    if ((ev.metaKey || ev.ctrlKey) && (k === 'k' || k === 'K')) { ev.preventDefault(); root && !root.hidden ? close() : open(''); return; }
    if (k === '/' && !typing && !ev.metaKey && !ev.ctrlKey && !ev.altKey) { ev.preventDefault(); open(''); }
  });
  // 화면이 한가할 때 색인을 미리 만들어 둔다
  (window.requestIdleCallback || function (f) { setTimeout(f, 1200); })(function () { build(); });

  L.search = { open: open, close: close, build: build, query: query, stats: stats };
})();
