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
10. [암기 카드](#10-암기-카드)

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

공통 틀(헤더·메뉴·푸터)은 레이아웃 한 파일에 두고, 각 화면은 **빈칸만 채운다.**

```
layouts/app.blade.php                 tutor/schedule.blade.php
┌──────────────────────────┐          @extends('layouts.app')
│ <title>@yield('title')   │  ◀────── @section('title', __('tutor.schedule'))
│ 헤더·메뉴                  │
│ @yield('content')        │  ◀────── @section('content') ... @endsection
│ 푸터                      │
└──────────────────────────┘
```

순수 PHP 의 `include 'header.php'; ... include 'footer.php';` 를 뒤집은 구조다 — 화면이 틀을 부르는 게 아니라, **화면이 틀을 상속하고 빈칸을 채운다.**

### PES 코드

```blade
{{-- resources/views/tutor/schedule.blade.php --}}
@extends('layouts.app')

@section('title', __('tutor.schedule'))            {{-- 짧은 값은 두 번째 인자로 --}}

@section('content')                                {{-- 긴 내용은 @endsection 까지 --}}
    <h1>{{ __('tutor.schedule') }}</h1>
    ...
@endsection
```

```blade
{{-- resources/views/layouts/app.blade.php --}}
<title>@yield('title', __('home.docTitle'))</title>       {{-- 채우지 않으면 기본값 --}}
@hasSection('description')                              {{-- 채웠을 때만 --}}
    <meta name="description" content="@yield('description')">
@endif
...
@yield('content')
```

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

## 10. 암기 카드

| 질문 | 답 |
|---|---|
| `view('tutor.schedule')` 의 파일은? | `resources/views/tutor/schedule.blade.php` |
| `{{ }}` 와 `{!! !!}` 의 차이는? | 이스케이프 함 / 안 함(XSS 위험) |
| HTML 에 나가지 않는 주석은? | `{{-- --}}` |
| 목록이 비었을 때 다른 내용을 보이는 반복은? | `@forelse ... @empty ... @endforelse` |
| 반복 안의 자동 변수는? | `$loop` (`first`·`last`·`index`·`iteration`) |
| 레이아웃의 빈칸과 채우기는? | 레이아웃 `@yield('content')` ↔ 화면 `@section('content')` |
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
