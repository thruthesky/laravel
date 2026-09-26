/* ------------------------------------------------------------------
   용어 사전 화면 — site/glossary.json 을 단계별로 보여 주고 거른다
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  var L = window.LV;
  L.header('glossary');

  var list = L.$('#glist'), qIn = L.$('#gq'), cnt = L.$('#gcount'), none = L.$('#gempty');
  var cards = [], kindOn = {}, stageOn = {};

  function stageName(s) {
    if (typeof s === 'number') {
      var d = L.docs.filter(function (x) { return x.stage === s; })[0];
      return s + '단계 · ' + (d ? d.short : '');
    }
    return s === '수시' ? '수시 · 명령·함정·일반' : String(s);
  }
  function stageKey(s) { return typeof s === 'number' ? s : 99; }

  L.gloss.whenReady(function () {
    var G = L.gloss;
    if (!G.list.length) { list.innerHTML = '<div class="state"><b>용어 사전을 불러오지 못했습니다</b>site/glossary.json</div>'; return; }
    var byStage = {};
    G.list.forEach(function (e) { (byStage[e.stage] = byStage[e.stage] || []).push(e); });
    var stages = Object.keys(byStage).map(function (k) { return byStage[k][0].stage; })
      .sort(function (a, b) { return stageKey(a) - stageKey(b); });

    list.innerHTML = '';
    stages.forEach(function (s) {
      var sec = document.createElement('section');
      sec.className = 'g-group';
      var es = byStage[s].slice().sort(function (a, b) { return a.term.localeCompare(b.term, 'ko'); });
      sec.innerHTML = '<h2>' + L.esc(stageName(s)) + ' <small>' + es.length + '개</small></h2><div class="g-grid"></div>';
      var grid = sec.querySelector('.g-grid');
      es.forEach(function (e) { var c = card(e); grid.appendChild(c.el); c.sec = sec; cards.push(c); });
      list.appendChild(sec);
    });

    // 거르기 단추
    var kinds = {};
    G.list.forEach(function (e) { kinds[e.kind] = (kinds[e.kind] || 0) + 1; });
    Object.keys(kinds).sort(function (a, b) { return kinds[b] - kinds[a]; }).forEach(function (k) {
      L.$('#kinds').appendChild(filterBtn(k + ' ' + kinds[k], function (on) { kindOn[k] = on; apply(); }));
    });
    stages.forEach(function (s) {
      L.$('#stages').appendChild(filterBtn(typeof s === 'number' ? s + '단계' : s, function (on) { stageOn[s] = on; apply(); }));
    });

    apply();
    // 본문 속 용어도 팝업이 뜬다(자기 자신은 빼고)
    cards.forEach(function (c) { L.gloss.apply(c.el.querySelector('.body'), { exclude: c.e }); });
    fillSee();
    arrive();
  });

  function filterBtn(label, fn) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = label; b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', function () {
      var on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      fn(on);
    });
    return b;
  }

  function card(e) {
    var el = document.createElement('article');
    el.className = 'gcard';
    el.id = e.id;
    var code = L.isCodeTerm(e.term);
    var h =
      '<div class="hd"><h3 class="tt' + (code ? ' code' : '') + '"><a href="#' + e.id + '"></a></h3>' +
      '<span class="chip"></span><span class="chip gray"></span></div>' +
      '<div class="body">' +
      '<p class="short">' + L.inline(e.short) + '</p>' +
      '<p class="desc">' + L.inline(e.desc) + '</p>' +
      (e.php ? '<div class="php"><span>순수 PHP 로는</span>' + L.inline(e.php) + '</div>' : '') +
      (e.aliases && e.aliases.length ? '<div class="aka">같은 뜻 · ' + e.aliases.map(function (a) { return '<code>' + L.esc(a) + '</code>'; }).join(' ') + '</div>' : '') +
      (e.example && e.example.code ? '<details><summary>예제 보기</summary>' + (e.example.caption ? '<p class="cap">' + L.inline(e.example.caption) + '</p>' : '') + '<pre><code></code></pre></details>' : '') +
      '</div><div class="lk" data-no-gl></div>';
    el.innerHTML = h;
    L.noBreak(el);
    el.querySelector('.tt a').textContent = e.term;
    el.querySelector('.chip').textContent = e.kind;
    el.querySelector('.chip.gray').textContent = typeof e.stage === 'number' ? e.stage + '단계' : e.stage;
    var det = el.querySelector('details');
    if (det) {
      var c = det.querySelector('code');
      c.textContent = e.example.code;
      det.addEventListener('toggle', function () {
        if (!det.open || det.dataset.hl) return;
        det.dataset.hl = '1';
        L.highlight(c, e.example.lang || 'php');
        L.codeBox(c.parentNode, e.example.lang || 'php');
        L.gloss.apply(det, { exclude: e });
      });
    }
    var lk = el.querySelector('.lk');
    if (e.see) {
      var p = e.see.split('#'), a = document.createElement('a');
      a.href = L.docUrl(p[0], p.slice(1).join('#'));
      a.setAttribute('data-pv', e.see);
      a.className = 'see';
      var d = L.docBySlug[p[0]];
      a.textContent = '자세히 — ' + (d ? L.stageLabel(d) + ' ' + d.short : p[0]);
      lk.appendChild(a);
    }
    if (e.official) {
      var o = document.createElement('a');
      o.href = e.official; o.target = '_blank'; o.rel = 'noopener'; o.textContent = '공식 문서 ↗';
      lk.appendChild(o);
    }
    var names = [e.term].concat(e.aliases || []).join(' ');
    var hay = (names + ' ' + e.short + ' ' + e.desc + ' ' + (e.php || '') + ' ' + (e.example ? e.example.code : '') + ' ' + e.kind).toLowerCase();
    return { e: e, el: el, hay: hay, ns: hay.replace(/\s+/g, '') };
  }

  // "자세히" 링크에 절 이름을 채운다
  function fillSee() {
    var need = {};
    cards.forEach(function (c) { if (c.e.see) need[c.e.see.split('#')[0]] = 1; });
    Object.keys(need).forEach(function (slug) {
      L.loadParsed(slug).then(function (P) {
        cards.forEach(function (c) {
          if (!c.e.see || c.e.see.split('#')[0] !== slug) return;
          var an = c.e.see.split('#').slice(1).join('#');
          var h = P.heads.filter(function (x) { return x.anchor === an; })[0];
          if (h) c.el.querySelector('.see').textContent += ' › ' + h.text;
        });
      }, function () {});
    });
  }

  function apply() {
    var toks = L.tokens(qIn.value), vs = toks.map(function (t) { return L.variants(t); });
    var anyKind = Object.keys(kindOn).some(function (k) { return kindOn[k]; });
    var anyStage = Object.keys(stageOn).some(function (k) { return stageOn[k]; });
    var shown = 0;
    cards.forEach(function (c) {
      var ok = (!anyKind || kindOn[c.e.kind]) && (!anyStage || stageOn[c.e.stage]);
      if (ok) ok = vs.every(function (v) {
        return v.some(function (x) { return c.hay.indexOf(x) >= 0 || c.ns.indexOf(x.replace(/\s+/g, '')) >= 0; });
      });
      c.el.hidden = !ok;
      if (ok) shown++;
    });
    L.$$('.g-group').forEach(function (s) { s.hidden = !L.$$('.gcard:not([hidden])', s).length; });
    cnt.textContent = '용어 ' + L.gloss.list.length + '개 중 ' + shown + '개';
    none.hidden = shown > 0;
  }
  var t = 0;
  qIn.addEventListener('input', function () { clearTimeout(t); t = setTimeout(apply, 120); });

  function arrive() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    if (el.hidden) { qIn.value = ''; kindOn = {}; stageOn = {}; L.$$('.g-filters button').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); }); apply(); }
    el.scrollIntoView({ block: 'start' });
    el.classList.remove('flash-target'); void el.offsetWidth; el.classList.add('flash-target');
    var det = el.querySelector('details');
    if (det) det.open = true;
  }
  window.addEventListener('hashchange', arrive);
  L.onNavigate = function (it) {
    if (it.type !== 'term') return false;
    history.pushState(null, '', 'glossary.html#' + it.e.id);
    arrive();
    return true;
  };
})();
