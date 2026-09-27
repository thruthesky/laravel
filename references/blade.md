# 5단계 — Blade 템플릿

## 목차

1. [Blade 란](#1-blade-란)
2. [출력 세 가지](#2-출력-세-가지)
3. [조건·반복 지시어](#3-조건반복-지시어)
4. [레이아웃 상속 — @extends·@section·@yield](#4-레이아웃-상속--extendssectionyield)
5. [부분 화면 — @include](#5-부분-화면--include)
6. [컴포넌트 — <x-...>](#6-컴포넌트--x-)
7. [폼 지시어](#7-폼-지시어)
8. [번역 — __()](#8-번역--__)
9. [Blade 와 Alpine.js 가 섞일 때](#9-blade-와-alpinejs-가-섞일-때)
10. [헬퍼·유틸리티 — 뷰에서 자주 쓰는 함수와 지시어](#10-헬퍼유틸리티--뷰에서-자주-쓰는-함수와-지시어)
11. [암기 카드](#11-암기-카드)

---

## 1. Blade 란

### 핵심 개념

Blade 는 **PHP 파일로 컴파일되는 템플릿**이다. `resources/views/tutor/schedule.blade.php` 는 처음 쓰일 때 `storage/framework/views/` 에 순수 PHP 로 바뀌어 저장되고, 이후에는 그 PHP 가 실행된다. 그래서 느리지 않고, 안에서 PHP 를 그대로 쓸 수 있다.

뷰 이름의 점은 폴더다: `view('tutor.schedule')` → `resources/views/tutor/schedule.blade.php`.

### 순수 PHP 와 비교

```php
<!-- 순수 PHP 템플릿 -->
<h1><?= htmlspecialchars($title, ENT_QUOTES) ?></h1>
<?php foreach ($slots as $slot): ?>
    <li><?= htmlspecialchars($slot['starts_at']) ?></li>
<?php endforeach; ?>
```

```blade
{{-- Blade --}}
<h1>{{ $title }}</h1>
@foreach ($slots as $slot)
    <li>{{ $slot->startTime() }}</li>
@endforeach
```

---

## 2. 출력 세 가지

| 문법 | 뜻 | 쓰는 때 |
|---|---|---|
| `{{ $x }}` | `htmlspecialchars` 해서 출력 | **기본. 거의 항상 이것** |
| `{!! $x !!}` | 이스케이프 없이 출력 | 믿을 수 있는 HTML 만. 사용자 입력에는 절대 금지(XSS) |
| `{{-- 주석 --}}` | Blade 주석 | HTML 에 나가지 않는다 (`<!-- -->` 는 나간다) |
| `@php ... @endphp` | PHP 블록 | 뷰 안에서 변수 준비 |

### PES 코드 — `resources/views/layouts/app.blade.php` 맨 위

```blade
@php
    $locale = app()->getLocale();
    $locales = config('locales.locales');
    $current = $locales[$locale];
@endphp
<!DOCTYPE html>
<html lang="{{ $locale }}" dir="{{ $current['dir'] }}">
```

---

## 3. 조건·반복 지시어

```blade
@if ($a) ... @elseif ($b) ... @else ... @endif
@unless ($filled) ... @endunless              {{-- if (! $filled) --}}
@isset($done) ... @endisset                   {{-- if (isset($done)) --}}
@empty($list) ... @endempty

@foreach ($items as $key => $item) ... @endforeach
@forelse ($items as $item) ... @empty 없을 때 @endforelse
@for ($i = 0; $i < 3; $i++) ... @endfor
```

반복 안에서는 `$loop` 가 자동으로 생긴다: `$loop->first`, `$loop->last`, `$loop->index`(0부터), `$loop->iteration`(1부터), `$loop->count`.

### PES 코드 — `resources/views/tutor/schedule.blade.php` (발췌)

```blade
@forelse ($slots as $weekday => $daySlots)          {{-- 컨트롤러의 groupBy('weekday') 결과 --}}
    <h3>{{ \App\Models\TutorSlot::weekdayName($weekday) }}</h3>
    <ul class="slot-list">
        @foreach ($daySlots as $slot)
            <li>
                {{ $slot->startTime() }} · {{ __('tutor.minutes', ['minutes' => $slot->duration_minutes]) }}
                @if ($profile->offersTrial() && $slot->isTrialLength())
                    · <strong>{{ __('tutor.trial_slot') }}</strong>
                @endif
            </li>
        @endforeach
    </ul>
@empty
    {{-- 칸이 하나도 없을 때 --}}
@endforelse
```

---

## 4. 레이아웃 상속 — @extends·@section·@yield

### 핵심 개념

사이트의 화면이 20개라면 20개 모두 `<html>`·`<head>`·헤더·메뉴·푸터가 똑같고 **가운데 본문만 다르다.** 레이아웃 상속은 그 "똑같은 부분"을 레이아웃 파일 하나에 두고, 각 화면은 **달라지는 빈칸만 채우는** 방법이다.

```
layouts/app.blade.php (레이아웃 = 틀)          tutor/schedule.blade.php (화면)
┌──────────────────────────────┐          @extends('layouts.app')          ← ① 이 틀을 쓴다
│ <title>@yield('title')</title>│  ◀────── @section('title', '내 시간표')    ← ② 빈칸 title 채우기
│ 헤더·메뉴                       │
│ @yield('content')             │  ◀────── @section('content')             ← ③ 빈칸 content 채우기
│ 푸터                           │              <h1>내 시간표</h1> …
└──────────────────────────────┘          @endsection
```

이름이 "상속"인 이유는 PHP 클래스 상속과 모양이 같아서다. 이미 아는 클래스 상속에 하나씩 대어 보면 외울 것이 거의 없다.

| 클래스 상속 (PHP OOP) | 레이아웃 상속 (Blade) |
|---|---|
| 부모 클래스 `class Layout` | 레이아웃 파일 `layouts/app.blade.php` |
| `class Schedule extends Layout` | 화면 맨 위 `@extends('layouts.app')` |
| 부모가 정해 둔 빈 메서드 `abstract function content()` | 레이아웃의 빈칸 `@yield('content')` |
| 자식이 그 메서드를 구현(오버라이드) | 화면의 `@section('content') … @endsection` |
| 부모의 기본 구현이 있는 메서드 | 레이아웃의 `@section('sidebar') 기본 … @show` |
| 자식 안에서 `parent::sidebar()` 호출 | 화면의 `@section('sidebar')` 안에서 `@parent` |
| 손자 클래스(`A extends B extends C`) | 레이아웃이 다른 레이아웃을 `@extends` |

### 순수 PHP 로 만든 레이아웃 — 상속의 정체

순수 PHP 로 공통 틀을 쓰는 흔한 방법은 `include 'header.php'; … include 'footer.php';` 다. 이 방법에는 불편이 둘 있다. `<body>` 를 여는 태그(header.php)와 닫는 태그(footer.php)가 두 파일로 갈라지고, `<title>` 처럼 헤더 안에 들어갈 값은 `include` **전에** 변수로 미리 정해야 한다.

그래서 조금 익숙한 사람은 **출력 버퍼**를 쓴다. 화면이 본문을 먼저 만들어 변수에 담고, 마지막에 레이아웃을 불러 그 변수를 찍게 한다.

```php
<?php // schedule.php — 화면
$title = '내 시간표';
ob_start();                                   // 여기부터 출력을 화면에 내지 말고 모아 둔다
?>
<h1>내 시간표</h1>
<ul>…</ul>
<?php
$content = ob_get_clean();                    // 모은 출력을 변수로 꺼낸다
include 'layout.php';                         // 맨 끝에서 틀을 부른다
```

```php
<!-- layout.php — 틀 -->
<html>
<head><title><?= htmlspecialchars($title ?? '기본 제목') ?></title></head>
<body>
  <header>공통 메뉴</header>
  <main><?= $content ?></main>
  <footer>공통 푸터</footer>
</body>
</html>
```

Blade 의 레이아웃 상속이 **정확히 이것**이다. Laravel 13.33 소스(`Illuminate/View/Concerns/ManagesLayouts.php`)를 보면 `@section('content')` 는 `ob_start()` 를, `@endsection` 은 `ob_get_clean()` 을 불러 내용을 `$sections['content']` 에 담는다. `@yield('content')` 는 그 배열에서 꺼내 찍는다. `@extends` 는 "맨 끝에서 `include 'layout.php'`" 에 해당한다. 새로운 마법이 아니라, 위의 버퍼 방식을 짧은 문법으로 쓴 것이다.

### 세 지시어가 하는 일

| 지시어 | 어느 파일에 | 하는 일 | 순수 PHP 로는 |
|---|---|---|---|
| `@extends('layouts.app')` | 화면(자식) 맨 위, 한 번 | 다 끝나면 이 레이아웃을 그린다 | 맨 끝의 `include 'layout.php'` |
| `@section('이름') … @endsection` | 화면(자식) | 이 내용을 '이름' 칸에 담아 둔다 | `ob_start(); … $content = ob_get_clean();` |
| `@section('이름', 값)` | 화면(자식) | 짧은 값을 '이름' 칸에 담는다 | `$title = '…';` |
| `@yield('이름', 기본값)` | 레이아웃(부모) | '이름' 칸의 내용을 여기에 찍는다 | `<?= $content ?? '기본' ?>` |

### @extends — "이 틀을 쓴다"

```blade
@extends('layouts.app')     {{-- resources/views/layouts/app.blade.php — 점은 폴더 --}}
```

- 화면 파일 **맨 위에 한 번** 쓴다. 뷰 이름 규칙은 `view()` 와 같다.
- 맨 위에 적지만, 컴파일된 PHP 에서는 **파일 맨 끝으로 옮겨진다.** Laravel 소스의 `compileExtends()` 는 결과를 그 자리에 두지 않고 `$this->footer[]` 에 넣는다. 그래서 "화면을 끝까지 실행한 뒤 레이아웃을 그린다"는 순서가 된다 — 순수 PHP 예제에서 `include 'layout.php'` 를 맨 끝에 둔 것과 같다.
- **레이아웃은 화면의 변수를 모두 본다.** 컴파일 결과가 `make('layouts.app', get_defined_vars())` 라서, 컨트롤러가 화면에 넘긴 `$profile` 도, 화면의 `@php` 에서 만든 변수도 레이아웃에서 쓸 수 있다.

#### ⚠ @section 밖에 쓴 글자는 새어 나간다

화면은 먼저 실행되고 레이아웃은 맨 끝에 그려진다. 그래서 화면에서 `@section` 으로 감싸지 않은 글자는 **레이아웃보다 먼저**, 곧 `<!DOCTYPE html>` 앞에 찍혀 나간다. 오류는 나지 않는다. Laravel 13.33 에서 그려 본 결과:

```blade
@extends('layouts.app')
[섹션 밖 글자]                          {{-- ❌ 어느 @section 에도 들어 있지 않다 --}}
@section('content') 본문 @endsection
```

```html
[섹션 밖 글자]
<!DOCTYPE html>                         <!-- 문서 선언보다 먼저 나갔다 -->
<html lang="ko">…
```

`@extends` 를 쓴 화면에서는 **모든 HTML 을 어느 한 `@section` 안에 둔다.** `@php … @endphp` 처럼 아무것도 찍지 않는 코드는 밖에 있어도 된다.

### @section — 빈칸에 넣을 내용

모양이 두 가지다.

```blade
@section('title', __('tutor.schedule'))        {{-- ① 짧은 값 — 두 번째 인자, @endsection 없음 --}}

@section('content')                            {{-- ② 긴 내용 — @endsection 까지 --}}
    <h1>{{ __('tutor.schedule') }}</h1>
    …
@endsection
```

- ① 짧은 모양의 값은 **이스케이프된다.** 소스가 `startSection($section, e($content))` 다. 그래서 강사 이름처럼 사용자가 넣은 값을 그대로 넣어도 안전하다. 거꾸로, 여기에 `'<b>시간표</b>'` 같은 HTML 을 넣으면 태그가 글자로 보인다 — HTML 이 필요하면 ② 블록 모양을 쓴다.
- ② 블록 안은 보통 Blade 다. `{{ }}`·`@if`·`@include`·컴포넌트를 모두 쓸 수 있다.
- `@endsection` 대신 `@stop` 이라고 쓴 옛 코드도 있다. 같은 뜻이다.
- **같은 이름을 두 번 채우면 먼저 채운 것이 이긴다.** `@section('content')첫째@endsection` 다음에 `@section('content')둘째@endsection` 을 쓰면 "첫째"만 나온다. 이 규칙이 아래 "실행 순서"의 열쇠다.

### @yield — 빈칸을 뚫어 둔다

```blade
<title>@yield('title', __('home.docTitle'))</title>      {{-- 화면이 안 채우면 기본값 --}}
<main>@yield('content')</main>                            {{-- 기본값 없으면 빈 문자열 --}}
```

- 두 번째 인자는 화면이 그 칸을 채우지 않았을 때의 기본값이다. 이 기본값도 `e()` 로 **이스케이프된다** — 짧은 글자만 넣는다.
- 화면이 채우지 않은 칸은 **오류 없이 빈 문자열**이 된다. 그래서 `@section('contnet')` 처럼 이름에 오타가 나면, 오류 대신 **본문이 텅 빈 페이지**가 나온다. 레이아웃은 멀쩡한데 가운데가 비었으면 칸 이름부터 맞춰 본다.
- 칸을 채웠을 때만 무언가를 보이려면 `@hasSection('이름') … @endif`, 반대는 `@sectionMissing('이름') … @endif` 다.

```blade
@hasSection('description')                                {{-- 화면이 설명을 채웠을 때만 meta 를 낸다 --}}
    <meta name="description" content="@yield('description')">
@endif
```

### 실행 순서 — 왜 화면이 레이아웃을 이기나

컨트롤러가 `return view('tutor.schedule', [...])` 를 돌려주면 다음 순서로 HTML 이 만들어진다.

```
① 컨트롤러          view('tutor.schedule', ['slots' => …]) 를 돌려준다
② 화면 실행         tutor/schedule.blade.php 를 위에서부터 실행
                    @section('title', …)   → 창고 $sections['title'] 에 담는다  (아직 아무것도 안 나감)
                    @section('content') …  → 창고 $sections['content'] 에 담는다
③ 파일 끝           @extends 가 옮겨 둔 코드 실행 → layouts/app.blade.php 를 그린다(화면의 변수 전부와 함께)
④ 레이아웃 실행      @yield('title')   → 창고에서 꺼내 찍는다
                    @yield('content') → 창고에서 꺼내 찍는다
⑤ 완성된 HTML 이 브라우저로
```

여기에 앞의 규칙 **"창고에 먼저 들어간 것이 이긴다"** 를 겹치면 상속이 설명된다. 화면(자식)이 늘 레이아웃(부모)보다 **먼저** 실행되므로, 같은 칸을 둘 다 채우면 화면의 것이 남는다. 클래스에서 자식의 메서드가 부모의 메서드를 가리는 오버라이드와 같은 결과다.

### @section…@show 와 @parent — 기본 내용이 있는 빈칸

`@yield('이름', 기본값)` 의 기본값은 짧은 글자뿐이다. 메뉴처럼 **긴 HTML 을 기본으로 두고, 화면이 바꾸거나 덧붙일 수 있게** 하려면 레이아웃에서 `@section … @show` 를 쓴다.

```blade
{{-- 레이아웃 — 기본 내용이 있는 빈칸 --}}
<nav>
    @section('sidebar')
        <a href="/">홈</a>
    @show                                   {{-- 담아 두고 바로 여기에 찍는다 --}}
</nav>
```

화면은 이 칸을 세 가지로 다룰 수 있다.

```blade
{{-- (가) 아무것도 안 한다 → 레이아웃의 기본 내용 "홈" 이 나온다 --}}

{{-- (나) 통째로 바꾼다 (오버라이드) --}}
@section('sidebar')
    <a href="/tutor">강사 메뉴</a>
@endsection

{{-- (다) 기본 내용에 덧붙인다 — @parent 자리에 레이아웃의 내용이 들어간다 (parent::sidebar()) --}}
@section('sidebar')
    @parent
    <a href="/tutor">강사 메뉴</a>
@endsection
```

(다) 의 결과는 `홈` 다음에 `강사 메뉴` 다. `@parent` 를 아래에 두면 순서가 뒤집힌다.

| 레이아웃 쪽 | 화면이 안 채우면 | 화면이 채우면 | `@parent` |
|---|---|---|---|
| `@yield('x', '글자')` | 기본 글자(이스케이프) | 화면 내용 | ❌ 안 된다 — 기본 글자가 사라지고 빈 문자열이 들어간다 |
| `@section('x') HTML @show` | 기본 HTML | 화면 내용 | ✅ 기본 HTML 이 그 자리에 들어간다 |

두 가지 흔한 실수가 있다. 둘 다 Laravel 13.33 에서 그려 확인했다.

- **레이아웃에서 `@show` 대신 `@endsection` 을 쓴다** → 내용을 창고에 담기만 하고 찍지 않아서, 그 자리에 **아무것도 안 나온다.** 레이아웃의 `@section` 은 `@show` 로 닫는다.
- **`@yield` 기본값에 `@parent` 를 기대한다** → 위 표처럼 기본값은 이어지지 않는다. 덧붙이기가 필요하면 레이아웃을 `@section … @show` 로 바꾼다.

### 여러 단계 상속 — 레이아웃이 레이아웃을 상속

레이아웃도 `@extends` 를 쓸 수 있다. 예를 들어 강사 화면들에만 왼쪽 메뉴가 있다면 "강사용 틀"을 한 단계 끼운다. PES 는 레이아웃이 하나(`layouts/app`)라서 아래는 일반 예다.

```blade
{{-- layouts/app.blade.php — 할아버지: 사이트 전체 틀 --}}
<nav>@section('sidebar')[기본 메뉴]@show</nav>
<main>@yield('content')</main>

{{-- layouts/tutor.blade.php — 아버지: 강사 화면 틀 --}}
@extends('layouts.app')
@section('sidebar') @parent [강사 메뉴] @endsection
@section('content')
    <div class="tutor-shell">@yield('tutor-content')</div>      {{-- 자식에게 새 빈칸을 연다 --}}
@endsection

{{-- tutor/schedule.blade.php — 손자: 실제 화면 --}}
@extends('layouts.tutor')
@section('sidebar') @parent [시간표 메뉴] @endsection
@section('tutor-content') 시간표 본문 @endsection
```

Laravel 13.33 에서 그린 결과(공백은 정리했다):

```html
<nav>[기본 메뉴] [강사 메뉴] [시간표 메뉴]</nav>
<main><div class="tutor-shell">시간표 본문</div></main>
```

실행 순서는 손자 → 아버지 → 할아버지다. 손자가 `sidebar` 를 먼저 창고에 넣고, 아버지와 할아버지의 내용은 차례로 `@parent` 자리에 끼워진다. 아버지 레이아웃은 부모의 빈칸(`content`)을 채우면서 동시에 자식에게 새 빈칸(`tutor-content`)을 열어 준다 — 클래스 계층의 가운데 클래스와 같다.

### @stack·@push — 여러 곳에서 모아 한 자리에

`@section` 은 한 칸에 **한 번** 채운다. 그런데 `<script>`·`<link>` 는 화면도, 그 안의 컴포넌트도, 부분 화면도 각자 "나는 이 JS 가 필요하다"고 **여러 곳에서** 더하고 싶다. 그때 쓰는 것이 스택이다.

```blade
{{-- 레이아웃 — </body> 바로 앞에 모을 자리 --}}
    @stack('scripts')
</body>

{{-- 화면이나 컴포넌트 어디서든 — 여러 번 쌓을 수 있다 --}}
@push('scripts')
    <script src="/js/schedule.js"></script>
@endpush

@prepend('scripts')                                  {{-- 맨 앞에 끼운다 --}}
    <script src="/js/need-first.js"></script>
@endprepend

@pushOnce('scripts', 'datepicker')                   {{-- 이 id 로는 한 번만 --}}
    <script src="/js/datepicker.js"></script>
@endPushOnce
```

| 지시어 | 하는 일 |
|---|---|
| `@stack('이름')` | 레이아웃에서, 모인 내용을 여기에 찍는다 |
| `@push('이름') … @endpush` | 뒤에 쌓는다. 여러 번 써도 모두 나온다 |
| `@prepend('이름') … @endprepend` | 앞에 쌓는다 |
| `@pushOnce('이름', 'id') … @endPushOnce` | 같은 id 로는 한 번만 쌓는다 |
| `@once … @endonce` | 스택과 상관없이, 이 자리의 내용을 요청 하나에서 한 번만 낸다 |

- **`@pushOnce` 는 id 를 적는다.** id 를 빼면 Blade 가 컴파일할 때 그 자리마다 다른 무작위 id 를 붙인다. 그래서 **같은 자리**가 반복될 때(반복문 안, 여러 번 쓴 컴포넌트)만 한 번으로 줄고, 다른 두 파일에 같은 `@pushOnce` 를 적으면 두 번 나온다 — Laravel 13.33 에서 확인했다. `@once` 도 같은 원리라, 한 부분 화면을 두 번 `@include` 하면 그 안의 `@once` 는 처음 한 번만 나온다.
- `@stack` 은 **레이아웃의 아래쪽**(`</body>` 앞)에 둔다. 화면과 그 안의 컴포넌트는 레이아웃보다 먼저 실행되므로 그때쯤이면 모든 `@push` 가 끝나 있다.

### PES 코드 — 레이아웃과 화면 한 쌍

```blade
{{-- resources/views/tutor/show.blade.php — 강사 소개 화면 (발췌) --}}
@extends('layouts.app')

@section('title', $profile->user->name.' · '.__('tutor.nav'))      {{-- 식도 된다. e() 로 이스케이프된다 --}}
@section('description', $profile->headline)                        {{-- 강사가 쓴 글 — 짧은 모양이라 안전 --}}

@section('content')
    <article class="tutor-detail">
        <h1>{{ $profile->user->name }}</h1>
        @include('tutor.badges')
        …
    </article>
@endsection
```

```blade
{{-- resources/views/layouts/app.blade.php (발췌) --}}
<head>
    <title>@yield('title', __('home.docTitle'))</title>      {{-- 채우지 않으면 기본값 --}}
    @hasSection('description')                              {{-- 채웠을 때만 --}}
        <meta name="description" content="@yield('description')">
    @endif
    …
</head>
<body x-data="shell" …>
    @include('partials.chat')
    <div class="page">
        <header class="topbar">… @include('partials.main-menu') …</header>
        <main class="content">
            @yield('content')
        </main>
        <footer class="site-footer">…</footer>
    </div>
</body>
```

PES 의 화면 9개가 모두 `@extends('layouts.app')` 로 시작하고, 채우는 칸은 `title`·`description`·`content` 셋뿐이다. 헤더·챗봇·메뉴·푸터는 레이아웃이 `@include` 로 한 번에 넣는다. 그래서 `tutor/schedule.blade.php` 에는 `<html>` 태그가 하나도 없다.

### 컴포넌트 레이아웃과 비교

Laravel 공식 문서와 Breeze 같은 스타터 키트는 레이아웃을 **컴포넌트**로도 만든다. 같은 일을 다른 문법으로 하는 것이라 둘 다 읽을 줄 알면 된다.

```blade
{{-- 컴포넌트 방식 — 화면이 레이아웃 태그로 본문을 감싼다 --}}
<x-app-layout>
    <x-slot:title>내 시간표</x-slot:title>      {{-- 이름 있는 슬롯 = @section('title') --}}
    <h1>내 시간표</h1>                          {{-- 기본 슬롯 $slot = @section('content') --}}
</x-app-layout>
```

| | 상속 방식 (PES) | 컴포넌트 방식 |
|---|---|---|
| 화면의 모양 | `@extends` + `@section` 들 | `<x-app-layout> … </x-app-layout>` 로 감싸기 |
| 레이아웃의 빈칸 | `@yield('content')` | `{{ $slot }}` |
| 레이아웃의 다른 칸 | `@yield('title')` | `{{ $title }}` (이름 있는 슬롯) |
| 기본 내용에 덧붙이기 | `@show` + `@parent` | 없다 — 필요하면 속성으로 넘긴다 |

컴포넌트 문법은 [6절](#6-컴포넌트--x-)에 있다.

### 레이아웃 지시어 한 장 정리

| 지시어 | 쓰는 곳 | 한 줄 뜻 |
|---|---|---|
| `@extends('layouts.app')` | 화면 맨 위 | 끝나면 이 틀을 그린다(변수 모두 전달) |
| `@section('x', 값)` | 화면 | 짧은 값 채우기 — 이스케이프됨 |
| `@section('x') … @endsection` | 화면 | 긴 내용 채우기 (`@stop` 도 같다) |
| `@parent` | 화면의 `@section` 안 | 부모의 기본 내용을 이 자리에 |
| `@yield('x', 기본값)` | 레이아웃 | 칸을 찍는다 — 기본값은 짧은 글자, 이스케이프됨 |
| `@section('x') … @show` | 레이아웃 | 기본 HTML 이 있는 칸을 만들고 바로 찍는다 |
| `@hasSection('x')` · `@sectionMissing('x')` | 레이아웃 | 채웠을 때만 · 안 채웠을 때만 |
| `@stack('x')` | 레이아웃 아래쪽 | 여러 곳에서 쌓은 것을 모아 찍는다 |
| `@push`·`@prepend`·`@pushOnce`·`@once` | 어디든 | 스택에 쌓기(뒤·앞·한 번만) |

---

## 5. 부분 화면 — @include

여러 화면에서 쓰는 조각은 `partials/` 에 두고 `@include` 한다. 부모 뷰의 변수를 그대로 본다.

### PES 코드 — `resources/views/partials/form-errors.blade.php`

```blade
{{-- 폼 검사 오류 목록. 모든 폼 맨 위에 넣는다. --}}
@if ($errors->any())
    <ul class="form-errors" role="alert">
        @foreach ($errors->all() as $error)
            <li>{{ $error }}</li>
        @endforeach
    </ul>
@endif
```

사용: `@include('partials.form-errors')`. 변수를 더 넘기려면 `@include('partials.x', ['a' => 1])`.

`$errors` 는 `web` 미들웨어 그룹이 **모든 뷰에 자동으로** 넣어 주는 변수다(검증 실패 때 채워지고, 평소엔 비어 있다).

---

## 6. 컴포넌트 — <x-...>

### 핵심 개념

컴포넌트는 **속성(props)과 슬롯(slot)을 받는 재사용 조각**이다. `@include` 보다 입력이 분명하다. 태그 이름이 파일 위치다:

```
<x-tutor.profile-item>  →  resources/views/components/tutor/profile-item.blade.php
<x-button>              →  resources/views/components/button.blade.php
```

### PES 코드 — 컴포넌트 정의 `resources/views/components/tutor/profile-item.blade.php` (발췌)

```blade
{{--
    item     항목 이름 — 번역 tutor.field_{item}
    done     완성도 점수에 드는 항목이면 채웠는지(true/false)
    files    파일을 올리는 항목(multipart)
    슬롯 value = 줄에 보일 지금 값, 기본 슬롯 = 창 안의 입력 칸
--}}
@props(['item', 'label' => null, 'help' => null, 'done' => null, 'files' => false])
{{-- ↑ 받을 속성과 기본값. 여기 없는 속성은 $attributes 로 간다 --}}

@php
    $label ??= __("tutor.field_$item");
    $reopen = old('item') === $item;          // 검사에 걸린 항목은 창을 연 채로 다시 보여 준다
@endphp

<li class="profile-item" @if ($done) data-done @endif>
    <span class="profile-item-value">{{ $value }}</span>      {{-- 이름 있는 슬롯 value --}}
    <form method="post" action="{{ lroute('tutor.profile') }}" @if ($files) enctype="multipart/form-data" @endif>
        @csrf
        @method('PUT')
        <input type="hidden" name="item" value="{{ $item }}">
        {{ $slot }}                                          {{-- 기본 슬롯: 태그 사이 내용 --}}
    </form>
</li>
```

### PES 코드 — 컴포넌트 사용 `resources/views/tutor/profile.blade.php` (발췌)

```blade
<x-tutor.profile-item item="headline" :done="$items['headline']">
    <x-slot:value>{{ $profile->headline }}</x-slot:value>           {{-- → $value --}}
    <input name="headline" value="{{ old('headline', $profile->headline) }}" maxlength="120">   {{-- → $slot --}}
</x-tutor.profile-item>

<x-tutor.profile-item item="photo" :done="$items['photo']" files
                      :help="__('tutor.help_photo', ['mb' => config('tutor.photo_max_kb') / 1024])">
```

| 속성 문법 | 넘어가는 값 |
|---|---|
| `item="headline"` | 문자열 `'headline'` |
| `:done="$items['headline']"` | **PHP 식**의 결과 (앞에 `:`) |
| `files` (값 없음) | `true` |

---

## 7. 폼 지시어

```blade
<form method="post" action="{{ lroute('tutor.timezone') }}">
    @csrf                          {{-- CSRF 토큰 숨은 칸. 없으면 419 오류 --}}
    @method('PUT')                 {{-- <input type="hidden" name="_method" value="PUT"> --}}

    <input name="email" value="{{ old('email') }}">             {{-- 검증 실패 뒤 이전 입력값 --}}
    <input name="headline" value="{{ old('headline', $profile->headline) }}">   {{-- 없으면 DB 값 --}}

    @error('email')                                             {{-- 이 칸에 오류가 있으면 --}}
        <p class="error">{{ $message }}</p>
    @enderror

    <option value="{{ $tz }}" @selected($user->timezone === $tz)>     {{-- 참이면 selected --}}
    <input type="checkbox" name="trial_enabled" value="1" @checked($profile->trial_enabled)>
    <button @disabled($locked)>
</form>
```

### PES 코드 — 지우기 버튼 (`tutor/schedule.blade.php`)

```blade
<form method="post" action="{{ lroute('tutor.slots.destroy', ['slot' => $slot->id]) }}">
    @csrf
    @method('DELETE')
    <button type="submit" class="link-button">{{ __('tutor.delete') }}</button>
</form>
```

라우트는 `Route::delete('/tutor/schedule/slots/{slot}', ...)` — 폼은 POST 로 보내지만 `_method=DELETE` 를 보고 Laravel 이 DELETE 라우트에 맞춘다. 라우트 쪽은 [routing.md 의 HTTP 메서드](routing.md#http-메서드), 419·405 가 뜨면 [pitfalls.md 6절](pitfalls.md#6-419-page-expired--405-method-not-allowed).

### flash 메시지 보여 주기

```blade
@if (session('status'))
    <p class="form-status" role="status">{{ session('status') }}</p>
@endif
```

메시지를 넣는 쪽(컨트롤러의 `->with('status', ...)`)은 [controllers.md 7절](controllers.md#7-flash-세션--한-번만-보이는-메시지).

---

## 8. 번역 — __()

```blade
{{ __('tutor.schedule') }}                                     {{-- lang/{언어}/tutor.php 의 'schedule' --}}
{{ __('tutor.minutes', ['minutes' => 50]) }}                   {{-- 'minutes' => ':minutes분' → 50분 --}}
{{ __('tutor.trial_enabled_help', ['minutes' => config('tutor.trial_max_minutes')]) }}
```

- 언어는 `SetLocale` 미들웨어가 `App::setLocale('ko')` 로 정해 둔 값을 따른다.
- 키가 없으면 키 문자열(`tutor.schedule`)이 그대로 나온다 — 화면에 점 찍힌 영어가 보이면 번역 키가 빠진 것이다.
- PES 는 17개 언어 파일(`lang/{en,ko,ja,…}/*.php`)에 같은 키를 둔다.

---

## 9. Blade 와 Alpine.js 가 섞일 때

PES 화면에는 `x-data`, `x-on:click`, `x-bind:` 같은 속성이 보인다. **Alpine.js(브라우저 JS)** 속성이다. 구분법:

| 보이는 것 | 누가 처리 | 언제 |
|---|---|---|
| `{{ }}`, `@if`, `<x-...>` | Blade (서버 PHP) | HTML 을 만들 때 |
| `x-data`, `x-on:`, `x-bind:`, `:class` (일반 HTML 태그) | Alpine (브라우저) | 페이지가 뜬 뒤 |

```blade
<body x-data="shell" x-bind:data-chat-open="chatOpen" x-on:keydown.escape.window="closeChat">
```

주의: `<x-컴포넌트>` 태그의 `:done="..."` 은 Blade 의 PHP 식이고, 일반 HTML 태그의 `:class="..."` 는 Alpine 의 JS 식이다. 같은 `:` 라도 **어느 태그에 붙었나**로 구분한다. JS 쪽 `{{ }}` 를 Blade 가 먹지 않게 하려면 `@{{ }}` 로 쓴다.

### PHP 값을 JS 로 넘기기 — @json 과 @js

설정값·DB 값(서버 PHP)을 브라우저 JS 가 써야 할 때가 있다. 예를 들어 시간표 화면의 JS 가 "칸 길이는 10~180분, 5분 단위"라는 규칙을 알아야 한다면, 그 숫자는 `config/tutor.php` 에 있다([lifecycle.md 6절](lifecycle.md#6-env--config--config)). 이때 `{{ }}` 는 맞지 않는다 — `{{ }}` 는 **HTML 용** 이스케이프라 배열을 못 넘기고, 문자열이면 JS 따옴표 문법과 어긋난다.

순수 PHP 로는 이렇게 했다:

```php
<script>
  const slot = <?= json_encode($config['slot_minutes'], JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT) ?>;
</script>
```

Blade 의 `@json(값)` 이 정확히 이 한 줄이다. Laravel 13.0 소스(`Illuminate/View/Compilers/Concerns/CompilesJson.php`)에서 컴파일 결과를 확인했다:

```blade
<script>
  const slot = @json(config('tutor.slot_minutes'));
  // 컴파일 결과: <?php echo json_encode(config('tutor.slot_minutes'), 15, 512) ?>
  // 브라우저에 나가는 것: const slot = {"min":10,"max":180,"step":5};
</script>
```

- `15` 는 `JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT` 를 더한 값이다. `<` `>` `'` `&` `"` 를 `\u003C` 처럼 바꿔서, 값 안에 `</script>` 가 들어 있어도 `<script>` 블록을 닫지 못하게 한다(XSS 방어 — [security.md 2절](security.md#2-xss--화면-출력-이스케이프)).
- `config('…')` 는 배열이든 숫자든 문자열이든 그대로 JSON 이 된다. 숫자는 `10`, 문자열은 `"PES"`, 배열은 `{…}`·`[…]`.

#### ⚠ 괄호 안에 쉼표를 쓰면 보호가 조용히 꺼진다

`@json` 은 괄호 안을 **쉼표로 잘라서** 둘째 조각을 `json_encode` 의 옵션으로, 셋째 조각을 깊이로 쓴다. 그래서 `config()` 의 기본값처럼 쉼표가 든 식을 넣으면 **오류 없이** 이스케이프 옵션 `15` 가 사라진다. Laravel 13.0 에서 값에 `</script><script>alert(1)</script>` 를 넣고 실제로 그려 본 결과:

| 쓴 것 | 컴파일 결과 | 브라우저로 나간 값 |
|---|---|---|
| `@json(config('demo.msg'))` | `json_encode(config('demo.msg'), 15, 512)` | `"\u003C\/script\u003E…"` ✅ 안전 |
| `@json(config('demo.msg', '기본'))` | `json_encode(config('demo.msg', '기본'), 512)` | `"<\/script><script>alert(1)<\/script>"` ❌ 태그가 그대로 |
| `@js(config('demo.msg', '기본'))` | `Js::from(config('demo.msg', '기본'))->toHtml()` | `'\u003C\/script\u003E…'` ✅ 안전 |

둘째 줄에서 `, '기본'` 이 옵션 자리로 들어가 `15` 를 밀어냈다. 배열 리터럴(`@json(['a' => 1, 'b' => 2])`)도 같은 이유로 옵션이 사라진다. 피하는 법은 셋 중 하나다:

```blade
{{-- ① 쉼표 없는 식만 넣는다 — 기본값이 필요하면 컨트롤러에서 변수로 만들어 넘긴다 --}}
<script>const slot = @json($slotRule);</script>

{{-- ② @js 를 쓴다 — 괄호 안을 자르지 않고 통째로 Js::from() 에 넘긴다 --}}
<script>const slot = @js(config('tutor.slot_minutes', []));</script>

{{-- ③ 이스케이프 옵션까지 직접 적는다(권하지 않음 — 길고 빠뜨리기 쉽다) --}}
```

#### HTML 속성 안에는 @js

`@json` 의 결과는 `{"min":10}` 처럼 **큰따옴표**를 그대로 쓴다. 그래서 `x-data="…"` 같은 큰따옴표 속성 안에 넣으면 속성이 중간에 끊긴다. 속성 안에는 `@js` 를 쓴다 — 문자열은 작은따옴표 `'…'`, 배열·객체는 `JSON.parse('…')` 로 바꾸고 큰따옴표를 `\u0022` 로 감춘다.

```blade
{{-- ❌ 속성이 x-data="{ rule: { 에서 끊긴다 --}}
<div x-data="{ rule: @json(config('tutor.slot_minutes')) }">

{{-- ✅ 브라우저로 나가는 것: x-data="{ rule: JSON.parse('{\u0022min\u0022:10,…}') }" --}}
<div x-data="{ rule: @js(config('tutor.slot_minutes')) }">
```

| 어디에 | 쓸 것 |
|---|---|
| `<script>` 블록 안, 쉼표 없는 식 | `@json(식)` 또는 `@js(식)` |
| `<script>` 블록 안, 쉼표가 든 식(`config('키', 기본값)`·배열 리터럴) | `@js(식)` — `@json` 은 보호가 꺼진다 |
| HTML 속성 안(`x-data="…"`·`data-…="…"`) | `@js(식)` |
| 화면 글자(HTML) | `{{ 값 }}` — JS 가 아니다 |

---

## 10. 헬퍼·유틸리티 — 뷰에서 자주 쓰는 함수와 지시어

### 헬퍼와 지시어는 어떻게 다른가

뷰에서 쓰는 도구는 두 종류다. 둘 다 결국 PHP 한 줄이 된다.

| | 헬퍼 함수 | 지시어 |
|---|---|---|
| 모양 | `route('home')`, `old('email')` — 괄호 있는 **PHP 함수** | `@csrf`, `@class([...])` — `@` 로 시작 |
| 어디서 | `{{ }}` 안, `@php` 안, 지시어의 괄호 안 — 그리고 컨트롤러·모델 어디서나 | Blade 파일 안에서만 |
| 정체 | `use` 없이 부르는 전역 함수 (`vendor/laravel/framework/src/Illuminate/Foundation/helpers.php` 등) | Blade 가 컴파일할 때 PHP 로 바꾸는 짧은 문법 |
| 순수 PHP 로는 | 직접 만든 `function url_for()` 같은 함수 | `<?php echo csrf_field(); ?>` 같은 한 줄 |

예를 들어 `@csrf` 는 `<?php echo csrf_field(); ?>` 로, `@method('PUT')` 은 `<?php echo method_field('PUT'); ?>` 로 컴파일된다 — 지시어가 헬퍼를 부르는 경우가 많다. 헬퍼는 [SKILL.md 기초 암기 카드의 ④ 헬퍼 함수 15개](../SKILL.md#기초-암기-카드)에서 처음 외웠다. 아래는 그중 **뷰에서 특히 자주 쓰는 것**과 뷰 전용 지시어를 쓰임별로 묶은 것이다.

### URL 만들기 — route()·lroute()·url()·asset()

```blade
<a href="{{ route('tutor.schedule') }}">…</a>                              {{-- 라우트 이름 → URL --}}
<form action="{{ route('tutor.slots.destroy', ['slot' => $slot->id]) }}">  {{-- 매개변수 채우기 --}}
<a href="{{ lroute('tutor.schedule') }}">…</a>                             {{-- PES: 언어 접두사까지 (/ko/…) --}}
<a href="{{ url('/logout') }}">…</a>                                       {{-- 경로 → 전체 URL --}}
<link rel="stylesheet" href="{{ asset('css/app.css') }}">                  {{-- public/ 안 파일의 URL --}}
<li @class(['active' => request()->routeIs('tutor.*')])>                  {{-- 지금 요청이 이 이름들인가 --}}
```

| 헬퍼 | 넣는 것 → 나오는 것 | 언제 |
|---|---|---|
| `route('이름', [매개변수])` | 라우트 이름 → `http://…/tutor/schedule` | 앱 안의 링크·폼 주소. **URL 을 손으로 적지 않는다** |
| `lroute('이름', [...])` | 같은데 언어 접두사까지 | **PES 에서는 `route()` 대신 이것** ([lifecycle.md 7절](lifecycle.md#pes-코드--apphelpersphp-의-lroute)) |
| `url('/경로')` | 경로 → 전체 URL | 이름 없는 라우트, 외부로 보낼 절대 주소 |
| `asset('css/app.css')` | `public/` 기준 파일 → URL | CSS·JS·이미지 |
| `request()->routeIs('tutor.*')` | 지금 라우트 이름이 맞는지 true/false | 메뉴의 "지금 페이지" 표시 |
| `url()->current()` | 지금 URL(쿼리 없이) | canonical·공유 링크 |

`route()` 를 쓰는 이유: URL 을 `/tutor/schedule` 처럼 손으로 적으면 라우트 주소를 바꿀 때 모든 화면을 찾아 고쳐야 한다. 이름으로 적으면 `routes/web.php` 한 곳만 고친다. 없는 이름을 적으면 `Route [x] not defined` 오류가 나서 오타도 바로 잡힌다.

PES 는 Vite 를 쓰지 않고 `public/` 의 파일을 `<link rel="stylesheet" href="/css/app.css">` 처럼 바로 링크한다. 새 Laravel 프로젝트의 레이아웃에서 보이는 `@vite(['resources/css/app.css', 'resources/js/app.js'])` 는 Vite 로 묶은 파일의 `<link>`·`<script>` 태그를 만들어 주는 지시어다.

### 요청·세션·로그인 — old()·session()·@session·@auth

```blade
<input name="headline" value="{{ old('headline', $profile->headline) }}">   {{-- 7절 --}}

{{-- flash 메시지 — 두 모양이 같은 일을 한다 --}}
@if (session('status'))                                     {{-- PES 가 쓰는 모양 --}}
    <p class="form-status" role="status">{{ session('status') }}</p>
@endif

@session('status')                                          {{-- Laravel 11+ 지시어. 안에서 $value 가 그 값 --}}
    <p class="form-status" role="status">{{ $value }}</p>
@endsession

@auth  <a href="/me">내 정보</a>  @endauth                  {{-- 로그인했을 때만 --}}
@guest <a href="/login">로그인</a> @endguest               {{-- 손님일 때만 --}}
@can('update', $post) <a href="…">고치기</a> @endcan       {{-- 정책이 허락할 때만 --}}
{{ auth()->user()?->name }}                                 {{-- 로그인한 사람(없으면 null) --}}
```

| 헬퍼·지시어 | 뜻 |
|---|---|
| `old('칸', 기본값)` | 검증 실패로 돌아왔을 때 방금 입력한 값. 없으면 기본값 ([7절](#7-폼-지시어)) |
| `session('키')` · `@session('키') … @endsession` | 세션 값 읽기 — 주로 한 번만 보이는 flash 메시지 ([controllers.md 7절](controllers.md#7-flash-세션--한-번만-보이는-메시지)) |
| `$errors` | 검증 오류 묶음. 모든 뷰에 자동으로 들어 있다 ([5절](#5-부분-화면--include)) |
| `auth()->user()` · `@auth` · `@guest` | 로그인한 사람 · 로그인 여부 |
| `@can('능력', $모델)` | 정책(Policy)이 허락할 때만 보인다 |
| `request('q')` | 쿼리·폼 값 하나(`$_GET['q'] ?? $_POST['q']` 와 비슷) |

PES 레이아웃은 로그인 상태를 `@auth` 로 그리지 **않는다.** 레이아웃 주석대로 "이 HTML 은 모든 방문자에게 같아야 캐시된다" — 그래서 페이지가 뜬 뒤 Alpine 이 `/me` 를 불러 이름과 로그아웃 버튼을 채운다. 사람마다 다른 HTML 을 서버에서 그리면 그 페이지를 통째로 캐시할 수 없다. 특히 공개 페이지는 세션이 없어서 `@auth` 가 늘 거짓이다 — [pitfalls.md 12절](pitfalls.md#12-공개-페이지에서-로그인-정보가-null).

### 설정·번역·환경 — config()·__()·@env

```blade
{{ config('tutor.trial_max_minutes') }}                             {{-- config/tutor.php 의 값 --}}
{{ __('tutor.trial_notice', ['minutes' => config('tutor.trial_max_minutes')]) }}   {{-- 번역 + 자리표시자 --}}
{{ trans_choice('{0} 없음|{1} 한 칸|[2,*] :count칸', $count) }}     {{-- 개수에 따라 다른 문장 --}}
<html lang="{{ app()->getLocale() }}">                              {{-- 지금 언어 --}}

@env('local') <div class="debug-bar">로컬</div> @endenv            {{-- APP_ENV 가 local 일 때만 --}}
@production <script src="/analytics.js"></script> @endproduction   {{-- 운영일 때만 --}}
```

- `config('파일.키')` — `.env` 를 뷰에서 `env()` 로 직접 읽지 않는다. `config:cache` 뒤에는 `env()` 가 null 을 돌려준다([pitfalls.md](pitfalls.md#1-env-가-null)). 값은 `config/*.php` 를 거쳐 `config()` 로 읽는다.
- `__()` 는 [8절](#8-번역--__). `trans_choice()` 는 `|` 로 나눈 문장 중 개수에 맞는 것을 고른다 — `3` 을 넣으면 `3칸`.

### 글자·숫자·날짜 다듬기 — Str·Number·Carbon

```blade
{{ Str::limit((string) $profile->bio, 100) }}          {{-- PES tutor/profile.blade.php — 길면 자르고 ... --}}
{{ str($title)->slug() }}                              {{-- 'Hello World' → hello-world (str() 는 Str 사슬) --}}
{{ number_format($slot->points) }}                     {{-- PES — 3000 → 3,000 (PHP 내장) --}}
{{ Number::currency(1500, 'PHP') }}                    {{-- ₱1,500.00 --}}
{{ Number::fileSize(2048) }}                           {{-- 2 KB --}}
{{ $dayOff->date->locale(app()->getLocale())->isoFormat('LL (dddd)') }}   {{-- PES — 2026년 9월 27일 (일요일) --}}
{{ $post->created_at->diffForHumans() }}               {{-- 5분 전 (locale 이 ko 일 때) --}}
```

| 도구 | 무엇 | 자주 쓰는 것 |
|---|---|---|
| `Str::` · `str()` | 문자열 | `limit`·`slug`·`title`·`after`·`before`·`contains`·`startsWith`·`plural`·`uuid` |
| `Number::` | 숫자 표시 | `format`·`currency`·`percentage`·`fileSize`·`abbreviate` — PHP `intl` 확장이 있어야 한다(PES 도커 이미지에 있다) |
| `number_format()` | PHP 내장 | 천 단위 쉼표 — 가장 단순 |
| Carbon (`now()`, 모델의 날짜 칸) | 날짜 | `format('Y-m-d')`·`isoFormat('LL')`·`diffForHumans()`·`timezone($tz)` ([eloquent.md 의 casts](eloquent.md#6-casts-와-기본값)) |

#### ⚠ Str::limit 은 한글을 절반만 남긴다

`Str::limit($s, 100)` 은 **글자 수가 아니라 화면 폭**으로 센다. Laravel 13.33 소스가 `mb_strwidth()`·`mb_strimwidth()` 를 쓰는데, 이 함수들은 한글·한자·일본어 한 글자를 폭 **2** 로 센다. 그래서:

| 쓴 것 | 결과 |
|---|---|
| `Str::limit('abcdefghij', 5)` | `abcde...` — 5글자 |
| `Str::limit('가나다라마바사', 10)` | `가나다라마...` — 5글자 |

PES 의 `Str::limit($profile->bio, 100)` 은 영어 소개면 약 100자, 한국어 소개면 약 50자를 보여 준다. 정확히 N 글자로 자르려면 `Str::substr($s, 0, N)` (끝에 `...` 없음)을 쓴다. 단어 중간에서 끊기 싫으면 `Str::limit($s, 100, preserveWords: true)`.

`Str`·`Number` 앞에 `\Illuminate\Support\` 를 적지 않아도 되는 이유는 아래 [클래스 쓰기](#클래스-쓰기--별칭use)에 있다.

### 목록 다듬기 — collect()·@each

```blade
{{-- PES tutor/show.blade.php — 언어 코드 배열 → "English, 한국어" --}}
<dd>{{ collect($profile->languages)->map(fn (string $code) => config("locales.locales.$code.name", $code))->join(', ') }}</dd>

{{-- 목록 하나마다 부분 화면을 그리고, 비었으면 다른 뷰를 --}}
<ul>@each('partials.slot-row', $slots, 'slot', 'partials.no-slots')</ul>
```

- `collect($배열)` 은 배열을 Collection 으로 바꿔 `map`·`filter`·`join`·`sum`·`groupBy` 를 사슬로 쓰게 한다([eloquent.md 의 Collection](eloquent.md#12-collection)).
- `@each('뷰', $목록, '변수이름', '빈 목록 뷰')` 는 `@foreach` + `@include` 를 한 줄로 쓴 것이다. 단, 그 부분 화면은 **부모 뷰의 변수를 보지 못한다**(넘긴 항목 하나와 `$key` 만 본다 — Laravel 13.33 `Factory::renderEach()`) — 부모 변수가 필요하면 `@foreach` 안에서 `@include` 를 쓴다.

### 속성 지시어 — @class·@style·@checked

HTML 속성을 조건에 따라 붙이는 지시어들이다. 순수 PHP 의 `<?= $trial ? 'badge-trial' : '' ?>` 를 줄인다.

```blade
<span @class(['badge', 'badge-trial' => $slot->isTrialLength(), 'muted' => $slot->isPast()])></span>
{{-- → <span class="badge badge-trial"></span>  (값이 참인 키만 모인다. 숫자 키는 늘 붙는다) --}}

<div @style(['color: red' => $late, 'font-weight: bold'])></div>
{{-- → <div style="font-weight: bold;"></div>  ($late 가 거짓일 때) --}}

<input type="checkbox" @checked($profile->trial_enabled)>     {{-- 참이면 checked --}}
<option @selected($tz === $user->timezone)>                   {{-- 참이면 selected --}}
<button @disabled($locked)>                                    {{-- 참이면 disabled --}}
<input @readonly($locked) @required($mustFill)>                {{-- 참이면 readonly · required --}}
```

`@class` 는 `class="…"` 속성 **전체**를 만든다. 그래서 같은 태그에 `class="…"` 를 따로 또 쓰지 않는다 — 늘 붙는 클래스는 배열에 숫자 키로(`'badge'`) 넣는다.

### 조각 불러오기 변형 — @includeIf·@includeWhen

[5절](#5-부분-화면--include)의 `@include` 에는 조건이 붙은 형제가 있다.

| 지시어 | 뜻 |
|---|---|
| `@include('뷰', [...])` | 늘 넣는다. 뷰 파일이 없으면 오류 |
| `@includeIf('뷰')` | 그 뷰 파일이 **있을 때만** 넣는다(없어도 오류 없음) |
| `@includeWhen($조건, '뷰', [...])` | 조건이 참일 때만 — `@if ($조건) @include(…) @endif` 의 한 줄 |
| `@includeUnless($조건, '뷰')` | 조건이 거짓일 때만 |
| `@includeFirst(['뷰1', '뷰2'])` | 있는 첫 번째 뷰를 넣는다 |
| `@each(…)` | 목록 반복 ([위](#목록-다듬기--collecteach)) |

### 클래스 쓰기 — 별칭·@use

뷰에서 PHP 클래스를 쓰는 방법은 세 가지다. PES 에 셋 다 있다.

```blade
{{-- ① 전체 이름 — PES tutor/show.blade.php --}}
<dd>{{ \App\Tutor\Countries::name($profile->country) }}</dd>

{{-- ② @use 로 위에서 한 번 가져오기 — PES tutor/profile.blade.php (Laravel 11+) --}}
@use('App\Tutor\Countries')
… {{ Countries::name($code) }} …

{{-- ③ 아무것도 안 적고 바로 — Laravel 이 미리 등록한 별칭 --}}
{{ Str::limit((string) $profile->bio, 100) }}
```

③ 이 되는 이유: Laravel 은 자주 쓰는 클래스를 **짧은 이름(별칭)** 으로 전역 등록해 둔다. Laravel 13.33 의 기본 별칭 목록(`Facade::defaultAliases()`)에서 뷰에 자주 쓰는 것은 `Str`·`Arr`·`Number`·`Js`·`Route`·`URL`·`Auth`·`Config`·`Session`·`Storage`·`Vite` 등이다. 그 밖의 클래스(`App\Models\TutorSlot` 등)는 ① 이나 ② 로 쓴다.

`@inject('변수', 클래스::class)` 는 서비스 컨테이너에서 객체를 꺼내 변수에 넣는다(`$변수 = app(클래스::class)`). 쓸 수는 있지만, 뷰가 필요한 값은 컨트롤러가 만들어 넘기는 편이 읽기 쉽다.

### 디버깅과 그대로 내보내기 — @dump·@verbatim

```blade
@dump($slots)                     {{-- 값을 펼쳐 보여 주고 계속 그린다 --}}
@dd($slots)                       {{-- 보여 주고 멈춘다 (dump and die) --}}

@verbatim                         {{-- 이 안은 Blade 가 손대지 않는다 --}}
    <p>{{ count }}개</p>              {{-- Vue 같은 JS 틀의 {{ }} 가 그대로 나간다 --}}
@endverbatim
```

- `@dump`·`@dd` 는 [debugging.md](debugging.md#2-dumpdd--값-찍어-보기) 의 `dump()`·`dd()` 와 같다. 커밋 전에 지운다.
- `@verbatim … @endverbatim` 은 `@{{ }}` 를 여러 줄에 한꺼번에 쓰는 것이다([9절](#9-blade-와-alpinejs-가-섞일-때)).

#### ⚠ {{ }} 안에서 e() 를 또 부르지 않는다

`{{ }}` 가 이미 `e()` 로 이스케이프한다. `{{ e($name) }}` 이라고 쓰면 두 번 이스케이프되어 `<` 가 화면에 `&lt;` 라는 **글자**로 보인다(Laravel 13.33 에서 `{{ e('<b>') }}` → 소스에 `&amp;lt;b&amp;gt;`). `e()` 는 PHP 코드에서 HTML 문자열을 직접 만들 때만 쓴다.

### 뷰에서 하지 말 것

헬퍼가 많다 보니 뷰에서 무엇이든 할 수 있지만, 뷰는 **받은 값을 보여 주는 곳**이다. 이 셋은 뷰 밖으로 뺀다.

| 뷰에 두면 안 되는 것 | 왜 | 어디로 |
|---|---|---|
| DB 조회 — `\App\Models\User::where(…)->get()`, 반복 안의 `$slot->tutor->name` | 반복마다 쿼리가 늘어난다(N+1). 뷰에서는 보이지 않는다 | 컨트롤러에서 조회하고 `with()` 로 미리 불러 넘긴다([eloquent.md](eloquent.md#8-즉시-로딩과-n1)) |
| 여러 줄 계산 — 점수·가격·상태 판단 | 여러 화면에 복사되고 테스트할 수 없다 | 모델 메서드(`$slot->startTime()`, `$profile->offersTrial()`) |
| 메뉴 목록·"지금 메뉴" 판단 | 모든 화면이 쓰는 로직 | 클래스 — PES 는 `App\Support\Menu::categories()` 가 `active`·`current` 까지 계산해 주고, `partials/main-menu` 는 찍기만 한다 |

`@php … @endphp` 는 레이아웃 맨 위의 `$locale = app()->getLocale();` 처럼 **짧게 변수를 준비할 때만** 쓴다. 블록이 길어지면 컨트롤러나 모델로 옮길 신호다.

---

## 11. 암기 카드

| 질문 | 답 |
|---|---|
| `view('tutor.schedule')` 의 파일은? | `resources/views/tutor/schedule.blade.php` |
| `{{ }}` 와 `{!! !!}` 의 차이는? | 이스케이프 함 / 안 함(XSS 위험) |
| HTML 에 나가지 않는 주석은? | `{{-- --}}` |
| 목록이 비었을 때 다른 내용을 보이는 반복은? | `@forelse ... @empty ... @endforelse` |
| 반복 안의 자동 변수는? | `$loop` (`first`·`last`·`index`·`iteration`) |
| 레이아웃의 빈칸과 채우기는? | 레이아웃 `@yield('content')` ↔ 화면 `@section('content')` |
| 레이아웃 상속을 순수 PHP 로 하면? | 화면이 `ob_start()` 로 본문을 모아 변수에 담고, 맨 끝에서 `include 'layout.php'` |
| `@extends` 는 맨 위에 쓰는데 언제 실행되나? | 화면 파일의 **맨 끝** — 화면의 `@section` 이 모두 담긴 뒤 레이아웃을 그린다 |
| 같은 칸을 화면과 레이아웃이 둘 다 채우면? | 먼저 채운 것이 이긴다 → 먼저 실행되는 **화면**이 이긴다(오버라이드) |
| `@extends` 를 쓴 화면에서 `@section` 밖에 쓴 HTML 은? | 레이아웃보다 먼저, `<!DOCTYPE>` 앞에 새어 나간다 |
| `@section('title', $name)` 의 값은 이스케이프되나? | 된다(`e()`). HTML 이 필요하면 블록 모양 `@section … @endsection` |
| `@section('contnet')` 처럼 칸 이름에 오타가 나면? | 오류 없이 그 칸이 빈 문자열 — 본문이 텅 빈 페이지 |
| 레이아웃에 기본 HTML 이 있고 화면이 덧붙일 수 있는 칸은? | 레이아웃 `@section('x') … @show` + 화면 `@parent` |
| 레이아웃의 `@section` 을 `@endsection` 으로 닫으면? | 담기만 하고 찍지 않아 아무것도 안 나온다 → `@show` |
| 여러 화면·컴포넌트가 `<script>` 를 한 자리에 모으려면? | 레이아웃 `@stack('scripts')` ↔ 어디서든 `@push('scripts')` |
| `@pushOnce` 에 id 를 적는 이유는? | id 가 없으면 자리마다 다른 무작위 id 라서, 다른 파일의 같은 코드는 두 번 나온다 |
| `<x-tutor.profile-item>` 의 파일은? | `resources/views/components/tutor/profile-item.blade.php` |
| 컴포넌트가 받을 속성을 적는 곳은? | `@props([...])` |
| 태그 사이 내용이 들어가는 변수는? | `$slot` (이름 있는 슬롯은 `<x-slot:value>` → `$value`) |
| 컴포넌트 속성에 PHP 값을 넘기려면? | 앞에 `:` — `:done="$items['x']"` |
| `@csrf` 가 없으면? | 419 오류 |
| 검증 실패 뒤 이전 입력값은? | `old('칸', 기본값)` |
| 칸별 오류 메시지는? | `@error('칸') {{ $message }} @enderror` |
| 선택·체크 상태를 조건으로? | `@selected(식)`, `@checked(식)` |
| Alpine 의 `{{ }}` 를 Blade 가 건드리지 않게 하려면? | `@{{ }}` |
| `@json(config('x'))` 가 하는 일은? | `json_encode(config('x'), 15, 512)` — `<` `>` `'` `&` `"` 를 `\u003C` 처럼 감춘 JSON |
| `@json(config('x', []))` 의 함정은? | 괄호 안을 쉼표로 잘라 이스케이프 옵션이 사라진다 → `@js(...)` 를 쓰거나 변수로 넘긴다 |
| HTML 속성(`x-data="…"`) 안에 PHP 배열을 넘기려면? | `@js(값)` — `@json` 의 큰따옴표가 속성을 끊는다 |
| 앱 안의 링크 주소를 만드는 헬퍼는? | `route('이름', [매개변수])` — PES 는 언어까지 붙이는 `lroute()` |
| `public/css/app.css` 의 URL 은? | `asset('css/app.css')` |
| 헬퍼와 지시어의 차이는? | 헬퍼 = 어디서나 부르는 전역 PHP 함수(`route()`), 지시어 = Blade 안에서만 쓰는 `@` 문법(`@csrf`) |
| 조건에 따라 클래스를 붙이려면? | `@class(['badge', 'badge-trial' => $trial])` |
| `Str::limit($한글, 100)` 은 몇 글자를 남기나? | 약 50글자 — 화면 폭으로 세서 한글 한 글자가 2 |
| 뷰에서 `Str::`·`Number::` 를 `use` 없이 쓸 수 있는 이유는? | Laravel 이 기본 별칭으로 등록해 둔다. 다른 클래스는 전체 이름이나 `@use(...)` |
| `{{ e($name) }}` 의 문제는? | 두 번 이스케이프 — `<` 가 `&lt;` 글자로 보인다 |
| 뷰에서 DB 조회를 하면 안 되는 이유는? | 반복 안에서 N+1 이 생기고 보이지 않는다 — 컨트롤러에서 `with()` 로 불러 넘긴다 |
