/* ------------------------------------------------------------------
   공용 도구 — 모든 화면이 먼저 불러온다 (docs.js 다음)
   · md 불러오기·절 나누기·그리기(marked + highlight.js)
   · 링크를 사이트 주소로 바꾸고 미리보기 표시(data-pv)
   · 용어 사전(glossary.json)을 읽어 본문의 용어에 밑줄
   · 검색어 넓히기(한↔영 별칭·조사 떼기) — 검색·찾기가 함께 쓴다
   · 상단 막대·테마
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  var SITE = window.LARAVEL_SITE;
  var L = window.LV = {};

  /* ── 기본 ─────────────────────────────────────────────── */
  L.$ = function (s, r) { return (r || document).querySelector(s); };
  L.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  L.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  L.store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  L.hoverable = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  L.repo = SITE.repo;

  /* ── 문서 목록 ────────────────────────────────────────── */
  L.docs = SITE.docs;
  L.docBySlug = {};
  L.docByPath = {};
  SITE.docs.forEach(function (d, i) { d.i = i; L.docBySlug[d.slug] = d; L.docByPath[d.path] = d; });
  L.stageLabel = function (d) {
    return typeof d.stage === 'number' ? d.stage + '단계' : d.stage;
  };
  L.docUrl = function (slug, anchor, q) {
    return 'doc.html?d=' + encodeURIComponent(slug) + (q ? '&q=' + encodeURIComponent(q) : '') +
      (anchor ? '#' + encodeURIComponent(anchor) : '');
  };
  L.srcUrl = function (d) { return SITE.repo + '/blob/' + SITE.branch + '/' + d.path; };

  /* ── 제목 → 앵커 (GitHub 규칙과 같아야 한다 — 문서 속 링크가 GitHub 기준) ── */
  L.headingText = function (raw) {
    return raw.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/`/g, '').replace(/\*\*/g, '').trim();
  };
  L.slug = function (t) {
    return t.toLowerCase().replace(/[^\p{L}\p{M}\p{N}_\- ]/gu, '').replace(/ /g, '-');
  };

  /* ── md 불러오기·나누기 ──────────────────────────────── */
  var mdCache = {}, parseCache = {};
  L.loadMd = function (slug) {
    var d = L.docBySlug[slug];
    if (!d) return Promise.reject(new Error('없는 문서: ' + slug));
    if (!mdCache[slug]) {
      mdCache[slug] = fetch(d.path + '?v=' + SITE.v).then(function (r) {
        if (!r.ok) throw new Error(d.path + ' — HTTP ' + r.status);
        return r.text();
      }).then(function (t) { return t.replace(/\r\n/g, '\n').replace(/^---\n[\s\S]*?\n---\n/, ''); });
    }
    return mdCache[slug];
  };
  // → { lines, heads:[{lv,text,anchor,line,end,next,parent}], title }
  L.parse = function (slug, md) {
    if (parseCache[slug]) return parseCache[slug];
    var lines = md.split('\n'), heads = [], fence = false, seen = {};
    lines.forEach(function (ln, i) {
      if (/^(```|~~~)/.test(ln)) { fence = !fence; return; }
      if (fence) return;
      var m = ln.match(/^(#{1,6})\s+(.+?)\s*$/);
      if (!m) return;
      var text = L.headingText(m[2]), a = L.slug(text);
      if (a in seen) { seen[a]++; a = a + '-' + seen[a]; } else seen[a] = 0;
      heads.push({ lv: m[1].length, text: text, anchor: a, line: i });
    });
    heads.forEach(function (h, k) {
      h.end = lines.length;
      for (var j = k + 1; j < heads.length; j++) if (heads[j].lv <= h.lv) { h.end = heads[j].line; break; }
      h.next = k + 1 < heads.length ? heads[k + 1].line : lines.length;
      for (var p = k - 1; p >= 0; p--) if (heads[p].lv < h.lv) { h.parent = heads[p]; break; }
    });
    var h1 = heads.filter(function (h) { return h.lv === 1; })[0];
    return (parseCache[slug] = { lines: lines, heads: heads, title: h1 ? h1.text : slug });
  };
  L.loadParsed = function (slug) {
    return L.loadMd(slug).then(function (md) { return L.parse(slug, md); });
  };
  // 제목 경로(문서 제목 제외) — 예: ["7. 관계 — hasOne·hasMany·belongsTo", "괄호 규칙 — 반드시 외운다"]
  L.headPath = function (h) {
    var out = [];
    for (var p = h; p && p.lv > 1; p = p.parent) out.unshift(p.text);
    return out;
  };
  // 한 절의 md. anchor 가 없으면 문서 머리말 + 목차
  L.section = function (slug, anchor) {
    return L.loadParsed(slug).then(function (P) {
      var d = L.docBySlug[slug];
      if (!anchor) {
        var first = P.heads.filter(function (h) { return h.lv === 2; });
        var h1 = P.heads.filter(function (h) { return h.lv === 1; })[0];
        var from = h1 ? h1.line + 1 : 0, to = first.length ? first[0].line : P.lines.length;
        return { doc: d, head: null, md: P.lines.slice(from, to).join('\n'), toc: first.filter(function (h) { return h.text !== '목차'; }) };
      }
      var h = P.heads.filter(function (x) { return x.anchor === anchor; })[0];
      if (!h) return null;
      return { doc: d, head: h, md: P.lines.slice(h.line, h.end).join('\n') };
    });
  };

  /* ── 코드 강조 — Blade 문법을 highlight.js 에 더한다 ── */
  if (window.hljs && !hljs.getLanguage('blade')) {
    hljs.registerLanguage('blade', function (hl) {
      return {
        name: 'Blade', subLanguage: 'xml',
        contains: [
          hl.COMMENT(/\{\{--/, /--\}\}/),
          { className: 'template-variable', begin: /\{\{|\{!!/, end: /\}\}|!!\}/, subLanguage: 'php', relevance: 10 },
          { className: 'keyword', begin: /@(?:[a-zA-Z_]+)(?=[\s(\n]|$)/, relevance: 5 }
        ]
      };
    });
  }
  var LANG_ALIAS = { sh: 'bash', shell: 'bash', zsh: 'bash', dockerfile: 'bash', text: 'plaintext', txt: 'plaintext' };
  L.highlight = function (codeEl, lang) {
    if (!window.hljs) return;
    lang = LANG_ALIAS[lang] || lang;
    try {
      if (lang && hljs.getLanguage(lang)) {
        codeEl.innerHTML = hljs.highlight(codeEl.textContent, { language: lang, ignoreIllegals: true }).value;
        codeEl.classList.add('hljs');
      }
    } catch (e) {}
  };
  L.codeBox = function (pre, lang) {
    var box = document.createElement('div');
    box.className = 'codebox';
    pre.parentNode.insertBefore(box, pre);
    box.appendChild(pre);
    if (lang && lang !== 'text' && lang !== 'plaintext') {
      var lb = document.createElement('span'); lb.className = 'lang'; lb.textContent = lang; box.appendChild(lb);
    }
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'copy'; b.textContent = '복사'; b.setAttribute('data-no-gl', '');
    b.addEventListener('click', function () {
      var cp = pre.cloneNode(true);
      L.$$('.cn', cp).forEach(function (x) { x.parentNode.removeChild(x); });
      var t = cp.textContent;
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () {
        b.textContent = '복사됨'; b.classList.add('ok');
        setTimeout(function () { b.textContent = '복사'; b.classList.remove('ok'); }, 1400);
      }, function () { b.textContent = '복사 실패'; });
    });
    box.appendChild(b);
    return box;
  };

  /* ── md → DOM ─────────────────────────────────────────── */
  L.render = function (md, ctx) {
    var box = document.createElement('div');
    box.className = 'md';
    box.innerHTML = window.marked ? marked.parse(md, { gfm: true, breaks: false }) : '<pre>' + L.esc(md) + '</pre>';
    L.enhance(box, ctx || {});
    return box;
  };
  // 인라인 코드의 "->" 를 한 덩어리로 — 브라우저가 "-" 뒤에서 줄을 바꿔 "$user-" / ">name" 으로 쪼개지 않게
  L.noBreak = function (root) {
    L.$$('code', root).forEach(function (c) {
      if (c.closest('pre') || c.querySelector('.nb') || c.textContent.indexOf('->') < 0) return;
      var w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT), list = [], n;
      while ((n = w.nextNode())) if (n.data.indexOf('->') >= 0) list.push(n);
      list.forEach(function (t) {
        var parts = t.data.split('->'), f = document.createDocumentFragment();
        parts.forEach(function (p, i) {
          if (i) { var s = document.createElement('span'); s.className = 'nb'; s.textContent = '->'; f.appendChild(s); }
          if (p) f.appendChild(document.createTextNode(p));
        });
        t.parentNode.replaceChild(f, t);
      });
    });
    return root;
  };
  L.inline = function (s) {
    return window.marked ? marked.parseInline(String(s || '')) : L.esc(s);
  };

  // 링크·표·코드를 다듬는다. ctx.slug = 이 md 가 들어 있던 문서, ctx.isPage = 그 문서 화면 자체인가
  L.enhance = function (root, ctx) {
    ctx = ctx || {};
    var base = (L.docBySlug[ctx.slug] || L.docs[0]).path;
    L.$$('a[href]', root).forEach(function (a) {
      var raw = a.getAttribute('href');
      if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) { a.target = '_blank'; a.rel = 'noopener'; return; }
      if (raw.charAt(0) === '#') {
        var an = safeDecode(raw.slice(1));
        if (ctx.slug) {
          a.setAttribute('data-pv', ctx.slug + '#' + an);
          if (!ctx.isPage) a.href = L.docUrl(ctx.slug, an);
        }
        return;
      }
      var parts = raw.split('#'), frag = safeDecode(parts[1] || '');
      var abs;
      try { abs = safeDecode(new URL(parts[0], 'http://x/' + base).pathname.slice(1)); } catch (e) { abs = ''; }
      var d = L.docByPath[abs];
      if (d) {
        a.href = L.docUrl(d.slug, frag);
        a.setAttribute('data-pv', d.slug + (frag ? '#' + frag : ''));
      } else if (/\.(html?)$/.test(abs)) {
        // 사이트 안 html 은 그대로
      } else {
        // PES 저장소 파일(AGENTS.md·app/…) — 이 사이트에서는 열 수 없다
        var s = document.createElement('span');
        s.className = 'plain-ref';
        s.title = 'PES 저장소의 파일입니다 — 이 사이트에서는 열 수 없습니다';
        s.innerHTML = a.innerHTML;
        a.parentNode.replaceChild(s, a);
      }
    });
    L.$$('table', root).forEach(function (t) {
      if (t.parentNode.classList.contains('tbl')) return;
      var w = document.createElement('div'); w.className = 'tbl';
      t.parentNode.insertBefore(w, t); w.appendChild(t);
    });
    L.hideAnswers(root);
    L.noBreak(root);
    L.$$('pre > code', root).forEach(function (c) {
      var m = (c.className || '').match(/language-([\w-]+)/), lang = m ? m[1] : '';
      L.highlight(c, lang);
      if (!c.parentNode.parentNode.classList.contains('codebox')) L.codeBox(c.parentNode, lang);
      if (ctx.slug) L.notes.whenReady(function () { L.notes.attach(c, ctx.slug); });
    });
    if (!ctx.noGloss) L.gloss.whenReady(function () { L.gloss.apply(root, { exclude: ctx.exclude, all: ctx.inPopup }); });
    return root;
  };
  function safeDecode(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }

  /* ── 진도 — "마쳤어요" 표시(이 브라우저에만 저장) ─────── */
  L.done = {
    get: function (slug) { return L.store.get('lv-done-' + slug, '') === '1'; },
    set: function (slug, on) { L.store.set('lv-done-' + slug, on ? '1' : ''); }
  };

  /* ── 퀴즈·암기 카드 — 답 칸을 가린다 ─────────────────── */
  // md 원문은 그대로 둔다(AI 가 채점에 쓴다). 사람이 보는 화면에서만 마지막 열이 "답"인 표를 가린다
  var ANSWER_HEAD = /^(답|정답|정답·해설)$/;
  L.hideAnswers = function (root) {
    L.$$('table', root).forEach(function (t) {
      if (t.classList.contains('quiz')) return;
      var ths = L.$$('thead th', t), col = ths.length - 1;
      if (col < 1 || !ANSWER_HEAD.test(ths[col].textContent.trim())) return;
      t.classList.add('quiz');
      var cells = [];
      L.$$('tbody tr', t).forEach(function (tr) {
        var td = tr.children[col];
        if (!td) return;
        var ans = document.createElement('span');
        ans.className = 'ans-t';
        while (td.firstChild) ans.appendChild(td.firstChild);
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'ans-b'; b.textContent = '답 보기';
        b.setAttribute('data-no-gl', ''); b.setAttribute('aria-expanded', 'false');
        td.classList.add('ans');
        td.appendChild(b); td.appendChild(ans);
        cells.push(td);
      });
      if (!cells.length) return;
      function show(td, on) {
        td.classList.toggle('open', on);
        var b = td.querySelector('.ans-b');
        b.textContent = on ? '가리기' : '답 보기';
        b.setAttribute('aria-expanded', on ? 'true' : 'false');
        count();
      }
      t.addEventListener('click', function (ev) {
        var b = ev.target.closest('.ans-b');
        if (b) { ev.stopPropagation(); show(b.parentNode, !b.parentNode.classList.contains('open')); return; }
        // 가려진 칸은 어디를 눌러도 열린다(열린 칸 안의 용어·링크는 그대로 동작)
        var td = ev.target.closest('td.ans');
        if (td && !td.classList.contains('open')) show(td, true);
      });
      var bar = document.createElement('div');
      bar.className = 'quiz-bar';
      bar.setAttribute('data-no-gl', '');
      bar.innerHTML = '<span class="q-info"><b>스스로 풀어 보기</b> — 답을 떠올린 뒤 눌러 보세요 · <span class="q-cnt"></span></span>' +
        '<button type="button" class="q-all">모두 보기</button><button type="button" class="q-none">모두 가리기</button>';
      function count() {
        var n = cells.filter(function (c) { return c.classList.contains('open'); }).length;
        bar.querySelector('.q-cnt').textContent = n + ' / ' + cells.length + ' 열어 봄';
      }
      bar.querySelector('.q-all').addEventListener('click', function () { cells.forEach(function (c) { show(c, true); }); });
      bar.querySelector('.q-none').addEventListener('click', function () { cells.forEach(function (c) { show(c, false); }); });
      var box = t.parentNode.classList.contains('tbl') ? t.parentNode : t;
      box.parentNode.insertBefore(bar, box);
      count();
    });
  };

  /* ── 코드 줄 각주 — site/notes.json ──────────────────── */
  // 코드블록 안의 한 줄(match 문자열이 든 줄) 끝에 번호 배지를 붙이고, 누르거나 올리면 설명 팝업이 뜬다.
  // md 코드블록에는 HTML 을 넣을 수 없어 설명을 따로 둔다. match 가 맞는지는 scripts/check_site.py 가 검사한다
  var NT = L.notes = { list: [], bySlug: {}, done: false };
  NT.ready = fetch('site/notes.json?v=' + SITE.v).then(function (r) {
    if (!r.ok) throw new Error('notes.json — HTTP ' + r.status);
    return r.json();
  }).then(function (arr) {
    arr.forEach(function (n, i) { n.id = i; NT.list.push(n); (NT.bySlug[n.slug] = NT.bySlug[n.slug] || []).push(n); });
    NT.done = true;
  }).catch(function (err) { console.warn('코드 각주를 읽지 못했습니다', err); NT.done = true; });
  NT.whenReady = function (fn) { if (NT.done) fn(); else NT.ready.then(fn); };
  NT.attach = function (code, slug) {
    var list = NT.bySlug[slug];
    if (!list || code.querySelector('.cn')) return 0;
    var lines = code.textContent.split('\n'), hits = [];
    list.forEach(function (n) {
      for (var k = 0; k < lines.length; k++) if (lines[k].indexOf(n.match) >= 0) { hits.push({ n: n, k: k }); return; }
    });
    if (!hits.length) return 0;
    hits.sort(function (a, b) { return a.k - b.k; });
    // 줄 k 의 끝 위치(글자 수) — 뒤에서부터 넣어야 앞 위치가 흔들리지 않는다
    var ends = [], off = 0;
    lines.forEach(function (ln) { off += ln.length; ends.push(off); off += 1; });
    for (var h = hits.length - 1; h >= 0; h--) {
      var pos = ends[hits[h].k], w = document.createTreeWalker(code, NodeFilter.SHOW_TEXT), t, acc = 0, done = false;
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'cn'; b.textContent = h + 1;
      b.setAttribute('data-note', hits[h].n.id); b.setAttribute('data-no-gl', '');
      b.setAttribute('aria-label', '코드 설명 ' + (h + 1));
      while ((t = w.nextNode())) {
        if (acc + t.data.length >= pos) { var rest = t.splitText(pos - acc); rest.parentNode.insertBefore(b, rest); done = true; break; }
        acc += t.data.length;
      }
      if (!done) code.appendChild(b);
      hits[h].n.num = h + 1;
    }
    var box = code.closest('.codebox');
    if (box && !box.querySelector('.cn-hint')) {
      var hint = document.createElement('span');
      hint.className = 'cn-hint'; hint.setAttribute('data-no-gl', '');
      hint.textContent = (L.hoverable ? '번호에 올리면' : '번호를 누르면') + ' 줄 설명 · ' + hits.length + '개';
      box.appendChild(hint);
      box.classList.add('has-notes');
    }
    return hits.length;
  };

  /* ── 용어 사전 ────────────────────────────────────────── */
  var G = L.gloss = { list: [], byId: {}, byTerm: {}, re: null, seen: {}, ready: null, done: false };
  var MARK_LIMIT = 2;          // 'mark' 모드에서 한 용어를 한 화면에 몇 번까지 밑줄 칠까
  var SKIP = { SCRIPT: 1, STYLE: 1, A: 1, BUTTON: 1, INPUT: 1, TEXTAREA: 1, SELECT: 1, KBD: 1, MARK: 1, SVG: 1, H1: 1 };
  L.termId = function (t) { return 't-' + t.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 't-x'; };
  L.isCodeTerm = function (t) { return !/^[가-힣]/.test(t) && (/[^A-Za-z가-힣 ]/.test(t) || /^[a-z]/.test(t) || /[a-z][A-Z]/.test(t)); };

  G.ready = fetch('site/glossary.json?v=' + SITE.v).then(function (r) {
    if (!r.ok) throw new Error('glossary.json — HTTP ' + r.status);
    return r.json();
  }).then(function (arr) {
    var core = {}, ids = {};
    arr.forEach(function (e) {
      var id = L.termId(e.term);
      while (ids[id]) id += '_';
      ids[id] = 1; e.id = id;
      G.list.push(e); G.byId[id] = e; G.byTerm[e.term] = e;
      [e.term].concat(e.aliases || []).forEach(function (s) {
        if (!s || s.length < 2) return;
        var paren = /\(\)$/.test(s), c = paren ? s.slice(0, -2) : s;
        if (!c) return;
        var slot = core[c] || (core[c] = {});
        if (paren) slot.paren = slot.paren || e; else slot.plain = slot.plain || e;
      });
    });
    G.core = core;
    var keys = Object.keys(core).sort(function (a, b) { return b.length - a.length || (a < b ? -1 : 1); });
    var parts = keys.map(function (c) {
      var slot = core[c], f = c.charAt(0), l = c.charAt(c.length - 1), pre, post = '';
      var e = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // 앞 글자 조건 — lookbehind 로 걸고, 못 쓰는 브라우저를 위해 같은 조건을 slot.preRe 에도 둔다
      var cls = /[가-힣]/.test(f) ? '가-힣' : /[A-Za-z0-9_]/.test(f) ? 'A-Za-z0-9_$@\\\\' : f === '$' ? 'A-Za-z0-9_$' : f === '@' ? 'A-Za-z0-9_@' : 'A-Za-z0-9_';
      pre = '(?<![' + cls + '])';
      slot.preRe = new RegExp('[' + cls + ']');
      if (!slot.plain) post = '(?=\\()';
      else if (/[A-Za-z0-9_]/.test(l)) post = '(?![A-Za-z0-9_])';
      slot.body = e + post;
      return pre + slot.body;
    });
    try { G.re = new RegExp(parts.join('|'), 'g'); }
    catch (err) {
      // lookbehind 를 못 쓰는 브라우저 — 앞 글자 조건은 G.apply 가 손으로 검사한다(밑줄·팝업이 통째로 꺼지지 않게)
      try { G.re = new RegExp(keys.map(function (c) { return core[c].body; }).join('|'), 'g'); G.noLB = true; } catch (e2) { G.re = null; }
    }
    G.done = true;
    return G;
  }).catch(function (err) { console.warn('용어 사전을 읽지 못했습니다', err); G.done = true; return G; });
  G.whenReady = function (fn) { if (G.done) fn(); else G.ready.then(fn); };
  G.mode = L.store.get('lv-gl-mode', 'mark');

  // 코드 강조(span)·인라인 코드는 같은 블록으로 이어 보고, 문단·칸·목록이 바뀌면 끊는다
  var BLOCK = 'p,li,td,th,pre,h1,h2,h3,h4,h5,h6,blockquote,dt,dd,summary,small,figcaption,div,section,article,ol,ul,label';
  function blockOf(n) { var p = n.parentNode; return p && p.closest ? p.closest(BLOCK) : null; }
  L.blockOf = blockOf;
  function skipNode(n, root) {
    for (var p = n.parentNode; p && p !== root.parentNode; p = p.parentNode) {
      if (p.nodeType !== 1) continue;
      if (SKIP[p.tagName.toUpperCase()]) return true;
      if (p.classList.contains('gl') || p.classList.contains('no-gl') || p.hasAttribute('data-no-gl')) return true;
    }
    return false;
  }
  // 본문의 용어를 <span class="gl"> 로 감싼다. 코드 강조로 글자가 여러 노드로 쪼개져도
  // 앞뒤 글자를 이어 붙여 판정한다(예: "with" 뒤의 "(" 가 다른 노드에 있어도 with() 로 본다).
  G.apply = function (root, opt) {
    if (!G.re || !root) return 0;
    opt = opt || {};
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [], text = '', n, blk = null;
    while ((n = w.nextNode())) {
      var b = blockOf(n);
      if (b !== blk) { text += '\n'; blk = b; }     // 블록이 바뀌면 경계를 둔다 — "2" + "public/…" 가 붙지 않게
      nodes.push({ n: n, s: text.length, ok: !skipNode(n, root) }); text += n.data;
    }
    if (!nodes.length) return 0;
    var hits = [], m, ni = 0;
    G.re.lastIndex = 0;
    while ((m = G.re.exec(text))) {
      var st = m.index, en = st + m[0].length;
      while (ni < nodes.length - 1 && nodes[ni + 1].s <= st) ni++;
      var nd = nodes[ni];
      if (!nd.ok || en > nd.s + nd.n.data.length) continue;
      var slot = G.core[m[0]]; if (!slot) continue;
      if (G.noLB && st > 0 && slot.preRe.test(text.charAt(st - 1))) continue;
      var e = (text.charAt(en) === '(' && slot.paren) ? slot.paren : (slot.plain || slot.paren);
      if (!e || e === opt.exclude) continue;
      hits.push({ nd: nd, a: st - nd.s, b: en - nd.s, e: e });
    }
    hits.forEach(function (h) {
      G.seen[h.e.id] = (G.seen[h.e.id] || 0) + 1;
      h.mark = opt.all || G.seen[h.e.id] <= MARK_LIMIT;
    });
    for (var i = hits.length - 1; i >= 0; i--) {
      var h = hits[i], node = h.nd.n;
      var mid = node.splitText(h.a);
      mid.splitText(h.b - h.a);
      var s = document.createElement('span');
      s.className = 'gl' + (h.mark ? ' gl-m' : '');
      s.setAttribute('data-t', h.e.id);
      // 키보드로도 연다 — 밑줄이 보이는 것(처음 두 번)만 탭 순서에 넣는다
      if (h.mark) { s.setAttribute('tabindex', G.mode === 'off' ? '-1' : '0'); s.setAttribute('role', 'button'); }
      s.textContent = mid.data;
      mid.parentNode.replaceChild(s, mid);
    }
    return hits.length;
  };
  G.reset = function () { G.seen = {}; };
  G.setMode = function (m) {
    G.mode = m; L.store.set('lv-gl-mode', m);
    document.body.setAttribute('data-gl', m);
    L.$$('.gl.gl-m[tabindex]').forEach(function (x) { x.setAttribute('tabindex', m === 'off' ? '-1' : '0'); });
    var b = document.getElementById('glMode');
    if (b) b.innerHTML = '<i></i>용어 밑줄 · <b>' + { mark: '처음 두 번', all: '전부', off: '끔' }[m] + '</b>';
  };

  /* ── 검색어 넓히기 — 한↔영 별칭, 조사 떼기 ─────────── */
  var ALIAS = [
    ['라라벨', 'laravel'], ['라우트', '라우팅', 'route', 'routing', 'routes'], ['미들웨어', 'middleware'],
    ['컨트롤러', 'controller'], ['검증', '유효성', '밸리데이션', 'validation', 'validate'], ['요청', '리퀘스트', 'request'],
    ['응답', '리스폰스', 'response'], ['리다이렉트', 'redirect'], ['세션', 'session'], ['플래시', 'flash'],
    ['인증', '로그인', 'auth', 'login'], ['로그아웃', 'logout'], ['권한', '정책', '폴리시', 'policy', 'gate', 'authorize'],
    ['파사드', '퍼사드', 'facade'], ['서비스 컨테이너', '컨테이너', 'container'], ['의존성 주입', 'di', 'dependency injection'],
    ['서비스 프로바이더', '프로바이더', 'provider'], ['설정', '환경 변수', 'config', 'env'], ['헬퍼', '헬퍼 함수', 'helper'],
    ['엘로퀀트', '엘로켄트', '엘로퀸트', 'eloquent', 'orm'], ['모델', 'model'], ['관계', '릴레이션', 'relation', 'relationship', 'hasmany', 'belongsto', 'hasone'],
    ['즉시 로딩', '이거 로딩', 'eager', 'eager loading'], ['지연 로딩', 'lazy'], ['n+1', 'n1', 'n 플러스 1'],
    ['스코프', 'scope'], ['캐스트', 'casts', 'cast'], ['대량 할당', 'fillable', 'mass assignment'], ['컬렉션', 'collection', 'collect'],
    ['페이지 나누기', '페이지네이션', 'paginate', 'pagination'], ['이벤트', 'event', 'booted', 'saving'], ['쿼리', 'query', 'sql'],
    ['블레이드', 'blade'], ['템플릿', 'template', 'view', '뷰'], ['레이아웃', 'layout', 'extends', 'yield'], ['컴포넌트', 'component'],
    ['슬롯', 'slot'], ['지시어', '디렉티브', 'directive'], ['번역', '다국어', 'translation', 'lang', 'locale'],
    ['마이그레이션', 'migration', 'migrate'], ['팩토리', 'factory', 'factories'], ['시더', 'seeder', 'seed'], ['스키마', 'schema'],
    ['외래 키', '외래키', 'foreign', 'foreignid'], ['제약', 'constraint', 'check'], ['테이블', 'table'],
    ['테스트', 'test', 'pest', 'phpunit'], ['데이터셋', 'dataset'], ['단언', 'assert', 'expect'],
    ['아티즌', '아티산', 'artisan'], ['팅커', 'tinker', 'repl'], ['캐시', 'cache'], ['설치', 'install', 'installer'],
    ['컴포저', 'composer'], ['카본', '날짜', 'carbon', 'now'], ['함정', '실수', 'pitfall'], ['퀴즈', '문제', 'quiz', '실습', 'exercise'],
    ['암기', '암기 카드'], ['매크로', 'macro'], ['도커', 'docker', 'compose'], ['환경', '.env', 'dotenv'],
    ['csrf', '419'], ['기본값', 'default'], ['요청 흐름', '라이프사이클', 'lifecycle'],
    // 심화 문서
    ['다대다', '피벗', 'pivot', 'belongstomany', 'many to many'], ['다형', '폴리모픽', 'polymorphic', 'morph'],
    ['트랜잭션', 'transaction', '롤백', 'rollback', '커밋', 'commit'], ['잠금', '락', 'lock', 'lockforupdate'],
    ['소프트 삭제', 'softdeletes', 'soft delete', '휴지통'], ['접근자', '변경자', 'accessor', 'mutator', 'attribute'],
    ['큐', 'queue', '잡', 'job', '워커', 'worker'], ['메일', 'mail', 'mailable'], ['알림', 'notification', 'notify'],
    ['스케줄', '스케줄러', 'schedule', 'cron', '크론'], ['리스너', 'listener'],
    ['파일 업로드', '업로드', 'upload', 'storage', '스토리지', '디스크', 'disk'],
    ['api', 'json', '제이슨'], ['리소스', 'resource', 'apiresource'], ['토큰', 'token', 'sanctum', '생텀'],
    ['보안', 'security', 'xss', 'sql 인젝션', 'injection'], ['암호화', 'encrypt', 'crypt', '해시', 'hash'],
    ['디버깅', '디버그', 'debug', 'dump'], ['로그', 'logging', 'pail'], ['예외', 'exception', '오류 처리'],
    ['배포', 'deploy', 'deployment', '운영 서버', 'production'], ['최적화', 'optimize']
  ];
  var ALIAS_MAP = {};
  ALIAS.forEach(function (g) { g.forEach(function (w) { (ALIAS_MAP[w] = ALIAS_MAP[w] || []).push.apply(ALIAS_MAP[w], g); }); });
  var PARTICLE = /^(.{2,}?)(으로|에서|까지|부터|이란|이라|란|은|는|이|가|을|를|의|에|로|와|과|도|만)$/;
  L.tokens = function (q) {
    var seen = {};
    return String(q || '').toLowerCase().split(/\s+/).filter(function (t) { return t && !seen[t] && (seen[t] = 1); });
  };
  L.variants = function (tok) {
    var v = [tok], m = tok.match(PARTICLE);
    if (m && /[가-힣]$/.test(m[1])) v.push(m[1]);
    v.slice().forEach(function (t) { (ALIAS_MAP[t] || []).forEach(function (x) { if (v.indexOf(x) < 0) v.push(x); }); });
    return v;
  };
  // 찾기·강조에 쓸 낱말 전부 (길이 긴 것부터)
  L.needles = function (q) {
    var out = [];
    L.tokens(q).forEach(function (t) { L.variants(t).forEach(function (v) { if (out.indexOf(v) < 0) out.push(v); }); });
    return out.sort(function (a, b) { return b.length - a.length; });
  };

  /* ── 여러 노드에 걸친 글자 찾기·강조 (문서 안 찾기·검색 미리보기) ── */
  // needles 를 대소문자 무시로 찾아 <mark class="find"> 로 감싼다. 반환: 찾은 것마다 mark 배열
  L.markText = function (root, needles, skipSel) {
    if (!needles.length) return [];
    var rx = new RegExp(needles.map(function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|'), 'gi');
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        if (!p || /^(SCRIPT|STYLE|BUTTON)$/.test(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (skipSel && p.closest(skipSel)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [], text = '', n, blk = null;
    while ((n = w.nextNode())) {
      var b = L.blockOf(n);
      if (b !== blk) { text += '\n'; blk = b; }
      nodes.push({ n: n, s: text.length }); text += n.data;
    }
    var found = [], m;
    while ((m = rx.exec(text))) { if (!m[0].length) { rx.lastIndex++; continue; } found.push([m.index, m.index + m[0].length]); }
    var groups = found.map(function () { return []; });
    // 뒤에서부터 감싸야 앞 노드의 위치가 흔들리지 않는다
    for (var k = found.length - 1; k >= 0; k--) {
      var st = found[k][0], en = found[k][1];
      for (var j = nodes.length - 1; j >= 0; j--) {
        var nd = nodes[j], ns = nd.s, ne = nd.s + nd.n.data.length;
        if (ne <= st || ns >= en) continue;
        var a = Math.max(st, ns) - ns, b = Math.min(en, ne) - ns;
        var node = nd.n, mid = a > 0 ? node.splitText(a) : node;
        if (b - a < mid.data.length) mid.splitText(b - a);
        var mk = document.createElement('mark');
        mk.className = 'find';
        mk.textContent = mid.data;
        mid.parentNode.replaceChild(mk, mid);
        groups[k].unshift(mk);
      }
    }
    return groups;
  };
  L.unmark = function (root) {
    L.$$('mark.find', root).forEach(function (m) {
      var p = m.parentNode;
      p.replaceChild(document.createTextNode(m.textContent), m);
      p.normalize();
    });
  };

  /* ── 테마 ─────────────────────────────────────────────── */
  (function () {
    var t = L.store.get('lv-theme', '');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  })();
  L.toggleTheme = function () {
    var cur = document.documentElement.getAttribute('data-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    L.store.set('lv-theme', next);
  };

  /* ── 상단 막대 ────────────────────────────────────────── */
  var ICON = {
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>',
    theme: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/></svg>',
    gh: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>'
  };
  L.ICON = ICON;
  L.header = function (active) {
    var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    var top = document.createElement('header');
    top.className = 'top';
    top.setAttribute('data-no-gl', '');
    top.innerHTML =
      '<div class="in">' +
      (active === 'doc' ? '<button class="iconbtn" id="menuBtn" type="button" aria-label="문서 목록 열기">' + ICON.menu + '</button>' : '') +
      '<a class="brand" href="index.html"><span class="logo">L</span><span class="txt"><b>Laravel 13 공부</b><small>PES 코드로 배우는</small></span></a>' +
      '<button class="search-trigger" type="button" id="searchBtn" aria-label="검색 열기">' + ICON.search +
      '<span>용어·개념·코드 검색</span><kbd>' + (mac ? '⌘' : 'Ctrl') + '</kbd><kbd>K</kbd></button>' +
      '<nav class="nav">' +
      '<a class="wide" href="doc.html?d=install"' + (active === 'doc' ? ' aria-current="page"' : '') + '>문서</a>' +
      '<a href="glossary.html"' + (active === 'glossary' ? ' aria-current="page"' : '') + '>' + ICON.book + '<span class="wide">용어 사전</span></a>' +
      '<button class="iconbtn" id="themeBtn" type="button" aria-label="밝게·어둡게 바꾸기" title="밝게·어둡게">' + ICON.theme + '</button>' +
      '<a class="iconbtn gh" href="' + SITE.repo + '" target="_blank" rel="noopener" aria-label="GitHub 저장소" title="GitHub 저장소">' + ICON.gh + '</a>' +
      '</nav></div>';
    document.body.insertBefore(top, document.body.firstChild);
    top.querySelector('#themeBtn').addEventListener('click', L.toggleTheme);
    top.querySelector('#searchBtn').addEventListener('click', function () { if (L.search) L.search.open(''); });
    // 용어 밑줄 단추
    var gb = document.createElement('button');
    gb.id = 'glMode'; gb.type = 'button'; gb.setAttribute('data-no-gl', '');
    gb.title = '용어에 마우스를 올리면(휴대폰은 탭) 뜻·예제·자세한 설명이 뜹니다. 눌러서 밑줄 표시를 바꿉니다';
    gb.addEventListener('click', function () {
      var order = ['mark', 'all', 'off'];
      G.setMode(order[(order.indexOf(G.mode) + 1) % order.length]);
    });
    document.body.appendChild(gb);
    G.setMode(G.mode);
  };
})();
