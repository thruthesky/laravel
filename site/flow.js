/* ------------------------------------------------------------------
   요청 한 바퀴 흐름도 — lib.js 다음에 불러온다
   · 홈(#flowList)과 1단계 문서(lifecycle 의 "흐름도" 절)가 같은 데이터를 쓴다
   · 단계마다 [자세히] 링크가 그 문서의 절을 미리보기 팝업으로 연다(a[data-pv])
   · 단계의 용어(미들웨어·컨트롤러 …)에는 용어 팝업이 붙는다
   앵커가 실제로 있는지는 scripts/check_site.py 가 검사한다
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  var L = window.LV;

  // [제목(HTML), 한 줄 설명, 미리보기 대상 "문서#앵커"]
  var STEPS = [
    ['브라우저 요청', 'GET /ko/tutor/schedule', 'lifecycle#1-요청-한-바퀴'],
    ['<code>public/index.php</code>', '모든 요청의 입구 (순수 PHP 의 front controller)', 'lifecycle#흐름도'],
    ['<code>bootstrap/app.php</code>', '앱 조립 — 라우트 파일·미들웨어·예외 처리 등록', 'lifecycle#2-bootstrapappphp--앱-조립'],
    ['미들웨어', '로그인 검사·CSRF·언어 결정 — 컨트롤러 앞뒤의 필터', 'routing#6-미들웨어와-그룹'],
    ['<code>routes/web.php</code>', 'URL + HTTP 메서드 → 컨트롤러 메서드', 'routing#1-라우트-기본-형태'],
    ['컨트롤러', '검증 → 모델 → 응답', 'controllers#1-컨트롤러의-역할'],
    ['모델(Eloquent)', '테이블 1개 = 클래스 1개', 'eloquent#1-모델--테이블-하나'],
    ['<code>view(\'tutor.schedule\')</code>', 'resources/views/tutor/schedule.blade.php — Blade', 'blade#1-blade-란'],
    ['응답', 'HTML · JSON · redirect', 'controllers#6-응답--viewredirectjson']
  ];
  L.flowSteps = STEPS;

  // ol 하나를 채운다
  L.renderFlow = function (ol) {
    ol.innerHTML = '';
    STEPS.forEach(function (s, i) {
      var parts = s[2].split('#');
      var li = document.createElement('li');
      li.innerHTML = '<span class="dot">' + (i + 1) + '</span><div>' + s[0] + '<small></small></div>' +
        '<a class="flow-go" data-no-gl></a>';
      li.querySelector('small').textContent = s[1];
      var a = li.querySelector('.flow-go');
      a.href = L.docUrl(parts[0], parts[1]);
      a.setAttribute('data-pv', s[2]);
      a.setAttribute('aria-label', (i + 1) + '단계 자세히 보기');
      a.textContent = '자세히';
      ol.appendChild(li);
    });
    return ol;
  };

  // 흐름도 상자 전체(제목·목록·안내) — 문서 화면에 끼워 넣을 때
  L.flowBox = function () {
    var box = document.createElement('div');
    box.className = 'flow flow-doc';
    box.innerHTML = '<div class="t">요청 한 바퀴 — 단계의 [자세히] 에 올리면 그 절이 팝업으로 뜹니다</div><ol></ol>';
    L.renderFlow(box.querySelector('ol'));
    return box;
  };

  var home = document.getElementById('flowList');
  if (home) L.renderFlow(home);
})();
