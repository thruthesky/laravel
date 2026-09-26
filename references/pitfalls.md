# 수시 — PHP 전문가가 Laravel 에서 빠지는 함정 12개

각 함정은 **증상 → 원인 → 올바른 코드** 순서다. 사용자가 "왜 안 되지?"라고 물으면 이 목록부터 대조한다.

## 목차

1. [env() 가 null](#1-env-가-null)
2. [저장했는데 값이 안 들어감](#2-저장했는데-값이-안-들어감)
3. [목록 화면이 느림 — N+1](#3-목록-화면이-느림--n1)
4. [괄호 하나 차이](#4-괄호-하나-차이)
5. [Collection 을 배열처럼](#5-collection-을-배열처럼)
6. [419 Page Expired · 405 Method Not Allowed](#6-419-page-expired--405-method-not-allowed)
7. [남의 데이터가 보이거나 지워짐](#7-남의-데이터가-보이거나-지워짐)
8. [메시지가 한 번만 보이고 사라짐](#8-메시지가-한-번만-보이고-사라짐)
9. [날짜가 몰래 바뀜 — Carbon 은 mutable](#9-날짜가-몰래-바뀜--carbon-은-mutable)
10. [코드를 고쳤는데 반영이 안 됨 — 캐시](#10-코드를-고쳤는데-반영이-안-됨--캐시)
11. [완성도 점수가 안 바뀜 — 모델 이벤트 건너뜀](#11-완성도-점수가-안-바뀜--모델-이벤트-건너뜀)
12. [공개 페이지에서 로그인 정보가 null](#12-공개-페이지에서-로그인-정보가-null)

---

## 1. env() 가 null

- **증상**: 로컬에선 되는데 운영 서버에서 API 키가 `null`.
- **원인**: 운영은 `config:cache` 를 한다. 그 뒤 `.env` 를 읽지 않으므로 코드에서 부른 `env()` 가 `null` 이 될 수 있다.

```php
// ❌ 컨트롤러·모델에서
$key = env('PAYPAL_KEY');

// ✅ config/services.php 에서만 env() 를 쓰고
'paypal' => ['key' => env('PAYPAL_KEY')],
// 코드에서는 config()
$key = config('services.paypal.key');
```

## 2. 저장했는데 값이 안 들어감

- **증상**: `create([...])` 가 오류 없이 끝났는데 어떤 칸이 비어 있다.
- **원인**: 그 칸이 `#[Fillable]` 에 없어서 **조용히 버려졌다.**

```php
// TutorProfile 의 Fillable 에 trial_enabled 가 없다
$profile->update(['trial_enabled' => true]);              // ❌ 무시됨
$profile->forceFill(['trial_enabled' => true])->save();   // ✅ 일부러 바꿀 때 (PES updateTrial)
```

Fillable 에 넣을지 판단 기준: **사용자가 폼으로 직접 바꿔도 되는 칸인가?** 아니면 넣지 않고 검사를 거친 코드에서 `forceFill` 한다.

## 3. 목록 화면이 느림 — N+1

- **증상**: 목록 20개 화면에서 SQL 이 21번.
- **원인**: 반복문 안에서 관계(괄호 없음)를 처음 읽을 때마다 SQL.

```php
$profiles = TutorProfile::visible()->get();
@foreach ($profiles as $p) {{ $p->user->name }} @endforeach    // ❌ 강사마다 SQL

$profiles = TutorProfile::visible()->with('user')->get();      // ✅ SQL 2번 (PES TutorListController)
```

## 4. 괄호 하나 차이

```php
$user->tutorSlots()->count();   // SQL: SELECT count(*) ...        (빠름)
$user->tutorSlots->count();     // SQL: SELECT * ... 후 PHP 에서 셈  (행이 많으면 느림)

$user->tutorSlots->create([...]);    // ❌ Collection 에는 create 가 없다 → 오류
$user->tutorSlots()->create([...]);  // ✅
```

외우는 법: **괄호 = 아직 SQL, 괄호 없음 = 이미 가져온 결과.**

## 5. Collection 을 배열처럼

```php
$slots = $user->tutorSlots()->get();
array_map(fn ($s) => ..., $slots);        // ❌ TypeError — Collection 은 배열이 아니다
$slots->map(fn ($s) => ...);              // ✅
empty($slots);                            // ❌ 객체라 언제나 false
$slots->isEmpty();                        // ✅
```

배열이 꼭 필요하면 `$slots->all()`(모델 배열) 또는 `$slots->toArray()`(배열의 배열).

## 6. 419 Page Expired · 405 Method Not Allowed

- **419**: 폼에 `@csrf` 가 없거나, 세션이 만료된 뒤 제출. → 모든 POST·PUT·DELETE 폼에 `@csrf`.
- **405**: 라우트는 `Route::put` 인데 폼은 POST. → 폼에 `@method('PUT')`.

```blade
<form method="post" action="{{ lroute('tutor.timezone') }}">
    @csrf
    @method('PUT')
```

## 7. 남의 데이터가 보이거나 지워짐

- **원인**: id 만으로 찾았다.

```php
TutorSlot::findOrFail($slot)->delete();                            // ❌ 아무 칸이나 지운다
$request->user()->tutorSlots()->findOrFail($slot)->delete();       // ✅ 내 칸 중에서만 — 남의 것은 404 (PES)
```

라우트 모델 바인딩(`TutorSlot $slot`)도 소유를 검사하지 않는다 → 정책이나 관계로 막는다([routing.md](routing.md) 5절).

## 8. 메시지가 한 번만 보이고 사라짐

- **증상**: "저장했습니다"가 새로고침하면 없어진다.
- **원인**: 정상이다. `->with('status', ...)` 는 **다음 요청 한 번만** 남는 flash 세션이다.
- 반대로 redirect 없이 `view()` 를 바로 돌려주면서 `session()->flash()` 를 하면 **그 다음 페이지**에 나타나 엉뚱한 곳에 보인다. 저장 뒤에는 **redirect 후 flash**(PRG 패턴)를 지킨다.

## 9. 날짜가 몰래 바뀜 — Carbon 은 mutable

`now()` 와 `datetime` cast 가 주는 `Illuminate\Support\Carbon` 은 **자기 자신을 바꾸는** 객체다.

```php
$start = $lesson->starts_at;
$end = $start->addMinutes(50);     // ❌ $start 도 50분 뒤로 바뀐다 (같은 객체)

$end = $start->copy()->addMinutes(50);          // ✅ 복사 후 변경
$end = $start->toImmutable()->addMinutes(50);   // ✅ 불변 객체로
```

PES 는 시간대가 중요하다: `now($user->timezone)` 은 그 시간대의 지금, `->utc()` 는 UTC 로.

## 10. 코드를 고쳤는데 반영이 안 됨 — 캐시

| 고친 것 | 확인할 것 |
|---|---|
| `config/*.php`, `.env` | `config:cache` 가 되어 있나 → `optimize:clear` |
| `routes/*.php` | `route:cache` → `optimize:clear` |
| `app/helpers.php` 추가·`composer.json` autoload | `composer dump-autoload` |
| 번역·Blade | 대개 바로 반영. 이상하면 `view:clear` |
| 큐 작업 코드 | 큐 워커(PES `queue` 컨테이너)는 코드를 메모리에 들고 있다 → 워커 재시작 |

## 11. 완성도 점수가 안 바뀜 — 모델 이벤트 건너뜀

- **PES 특유의 함정.** `TutorProfile` 은 `saving` 이벤트에서 `profile_score` 를 다시 계산한다.
- **원인**: 쿼리 빌더로 고치면 모델을 거치지 않아 이벤트가 없다.

```php
TutorProfile::where('user_id', $id)->update(['bio' => $bio]);   // ❌ profile_score 가 옛날 그대로

$profile = TutorProfile::where('user_id', $id)->firstOrFail();
$profile->update(['bio' => $bio]);                              // ✅ save → saving → 점수 다시 계산
```

쿼리 `delete()` 도 `deleting`·`deleted` 이벤트가 없다.

## 12. 공개 페이지에서 로그인 정보가 null

- **PES 특유의 함정.** `routes/public.php` 의 라우트는 `public` 미들웨어 그룹이라 **세션이 없다** — Cloudflare 캐시를 위해서다.
- **증상**: 강사 찾기 화면에서 `$request->user()`·`auth()->user()`·`@auth` 가 로그인했는데도 `null`/거짓.
- **올바른 방법**: 공개 페이지는 로그인 정보를 쓰지 않는다. 로그인 상태가 필요하면 브라우저 JS 가 `/me`(`MeController`, `web` 그룹)를 불러 받아 간다. 로그인이 꼭 필요한 화면은 `routes/web.php` 에 둔다.
