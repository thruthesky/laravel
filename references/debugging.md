# 심화 — 디버깅·로그·예외 처리

"왜 안 되지?"에서 막혔을 때 읽는다. 순수 PHP 에서는 `var_dump`·`error_log`·`try/catch` 로 하던 일을 Laravel 이 어떻게 바꿨는지, 그리고 **어디부터 보면 되는지**를 다룬다. 증상별 원인은 [pitfalls.md](pitfalls.md) 에 따로 있다.

## 목차

1. [어디부터 볼까 — 디버깅 순서](#1-어디부터-볼까--디버깅-순서)
2. [dump·dd — 값 찍어 보기](#2-dumpdd--값-찍어-보기)
3. [SQL 들여다보기](#3-sql-들여다보기)
4. [로그 — Log:: 와 logger()](#4-로그--log-와-logger)
5. [예외 — 던지면 Laravel 이 응답으로 바꾼다](#5-예외--던지면-laravel-이-응답으로-바꾼다)
6. [예외 처리 설정 — bootstrap/app.php](#6-예외-처리-설정--bootstrapappphp)
7. [오류 화면과 APP_DEBUG](#7-오류-화면과-app_debug)
8. [암기 카드](#8-암기-카드)

---

## 1. 어디부터 볼까 — 디버깅 순서

증상이 무엇이든 이 순서로 보면 대부분 5분 안에 원인 근처에 간다.

| 순서 | 볼 곳 | 명령·방법 | 무엇을 알 수 있나 |
|---|---|---|---|
| 1 | **화면의 오류 메시지** | 로컬은 `APP_DEBUG=true` | 예외 이름·파일·줄 |
| 2 | **로그 파일** | `storage/logs/laravel.log` · `php artisan pail` | 화면에 안 보인 예외(운영·큐·AJAX) |
| 3 | **라우트** | `php artisan route:list --path=…` | URL 이 어느 컨트롤러로 가나, 미들웨어는 무엇인가 |
| 4 | **데이터** | `php artisan tinker` | 그 행이 정말 있나, 관계가 비었나 |
| 5 | **코드 중간값** | `dump()` · `dd()` | 변수가 어느 줄에서 예상과 달라지나 |
| 6 | **SQL** | `toRawSql()` · `DB::listen` | 실제로 나간 쿼리와 개수 |
| 7 | **캐시** | `php artisan optimize:clear` | 고친 설정·라우트가 반영됐나 |

> 3·4번은 조사용 명령이다. 자세히는 [artisan.md](artisan.md#3-스스로-조사하는-명령) 3절, tinker 는 [artisan.md](artisan.md#6-tinker--앱이-로드된-repl) 6절. 7번은 [pitfalls.md](pitfalls.md#10-코드를-고쳤는데-반영이-안-됨--캐시) 10번.

---

## 2. dump·dd — 값 찍어 보기

### 핵심 개념

`dump($x)` 는 값을 보기 좋게 찍고 **계속 실행**한다. `dd($x)` 는 찍고 **멈춘다**(dump and die). 객체·Collection·모델을 접었다 펼 수 있는 트리로 보여 준다.

### 순수 PHP 와 비교

```php
// 순수 PHP
echo '<pre>'; var_dump($user); echo '</pre>'; exit;
error_log(print_r($data, true));

// Laravel
dump($user);                 // 찍고 계속
dd($user, $slots);           // 여러 개를 찍고 멈춤
```

### 사슬 중간에서 찍기

쿼리 빌더와 Collection 은 사슬 **중간에** `->dump()`·`->dd()` 를 끼울 수 있다. 변수에 담았다가 찍을 필요가 없다.

```php
// 쿼리 빌더 — SQL 과 바인딩을 찍는다
TutorProfile::visible()->where('rating', '>', 4)->dd();
TutorProfile::visible()->ddRawSql();          // 값까지 채운 SQL 을 찍고 멈춤

// Collection — 그 시점의 내용을 찍는다
$slots->groupBy('weekday')->dump()->map(fn ($day) => $day->count());
```

> ⚠ `ddd()` 는 옛 튜토리얼에 나오지만 Laravel 에 있는 함수가 아니다. 예전 오류 화면 패키지(Ignition)가 주던 것이라 지금 골격에는 없다.
>
> ⚠ `dd()` 는 응답 도중에 출력하고 끝낸다. **AJAX·JSON 요청**에서는 브라우저 개발자 도구의 네트워크 탭 응답 본문에서 봐야 한다. 화면에는 아무것도 안 바뀐다. 이럴 때는 로그(4절)가 편하다.
>
> ⚠ 커밋 전에 `dd()`·`dump()` 를 지운다. 운영에서 `dd()` 가 실행되면 사용자에게 내부 데이터가 보인다.

---

## 3. SQL 들여다보기

### 핵심 개념

Eloquent 는 SQL 을 숨겨 준다. 편한 대신, **실제로 어떤 SQL 이 몇 번 나갔는지**가 안 보인다. N+1([eloquent.md](eloquent.md#8-즉시-로딩과-n1) 8절)도, 조건이 빠진 쿼리도 SQL 을 봐야 잡힌다.

### 예제 — 쿼리 하나 보기 (일반 Laravel 예)

```php
$q = TutorSlot::where('tutor_id', 7)->orderBy('weekday');

$q->toSql();        // "select * from "tutor_slots" where "tutor_id" = ? order by "weekday" asc"
$q->toRawSql();     // ? 자리에 7 까지 채운 SQL — DB 콘솔에 그대로 붙여 넣어 실행할 수 있다
```

### 예제 — 요청 하나에서 나간 쿼리 전부 보기 (일반 Laravel 예)

```php
use Illuminate\Support\Facades\DB;

DB::enableQueryLog();
$page = app(TutorListController::class)->index(request());     // 조사할 코드
dump(count(DB::getQueryLog()), DB::getQueryLog());             // 개수와 SQL·바인딩·시간(ms)
```

```php
// AppServiceProvider::boot() — 로컬에서만 모든 쿼리를 로그로
if (app()->isLocal()) {
    DB::listen(function ($query) {
        logger()->debug($query->sql, ['bindings' => $query->bindings, 'ms' => $query->time]);
    });
}
```

`DB::listen` 은 쿼리가 끝날 때마다 불린다. 목록 화면 하나에 쿼리가 수십 개 찍히면 N+1 이다.

### 느린 쿼리 찾기

```php
// AppServiceProvider::boot() — 한 요청의 DB 시간이 합계 500ms 를 넘으면 기록
DB::whenQueryingForLongerThan(500, function ($connection, $event) {
    Log::warning('DB 시간이 길다', ['url' => request()->fullUrl()]);
});
```

느린 쿼리를 찾았으면 그 SQL 을 `toRawSql()` 로 뽑아 PostgreSQL 의 `EXPLAIN ANALYZE` 로 본다. 인덱스가 없는 `where`·`orderBy` 칸이 흔한 원인이다([database.md](database.md#3-컬럼-타입과-수식어) 3절의 `index()`).

> N+1 을 개발 중에 예외로 바로 잡아 주는 `Model::preventLazyLoading()` 은 [eloquent-plus.md](eloquent-plus.md) 에서 다룬다.

---

## 4. 로그 — Log:: 와 logger()

### 핵심 개념

로그는 **나중에 읽는 dump** 다. 화면을 멈추지 않고 남기므로 운영·큐 작업·AJAX 에서 쓴다. 기본 위치는 `storage/logs/laravel.log`.

### 순수 PHP 와 비교

```php
// 순수 PHP
error_log('[' . date('c') . "] 결제 실패 order=$orderId");   // 형식·위치·등급을 직접 관리

// Laravel
Log::error('결제 실패', ['order_id' => $orderId, 'user_id' => $user->id]);
```

### 예제 — 등급과 컨텍스트 (일반 Laravel 예)

```php
use Illuminate\Support\Facades\Log;

Log::debug('계산 중간값', ['score' => $score]);      // 개발 중에만 보고 싶은 것
Log::info('강사 승인', ['tutor_id' => $id]);          // 정상 흐름의 기록
Log::warning('재시도', ['attempt' => 3]);              // 이상하지만 계속 간다
Log::error('결제 실패', ['order_id' => $orderId]);     // 처리 못 함 — 사람이 봐야 한다

logger('짧게');                  // = Log::debug('짧게')
logger()->error('…');           // = Log::error('…')
```

로그 한 줄의 모양:

```
[2026-09-26 14:03:11] local.ERROR: 결제 실패 {"order_id":42,"user_id":7}
```

> **왜 두 번째 인자(컨텍스트 배열)에 넣나** — 메시지를 `"결제 실패 order=$id"` 처럼 만들면 줄마다 글자가 달라져 같은 오류를 세거나 검색하기 어렵다. 메시지는 고정하고 바뀌는 값은 배열로 넣는다.
>
> ⚠ 비밀번호·카드 번호·토큰은 컨텍스트에 넣지 않는다. 로그 파일은 생각보다 많은 사람이 본다.

### 채널 — 어디에 쓸까

`config/logging.php` 의 **로그 채널**이 로그를 어디에 쓸지 정한다. `.env` 의 `LOG_CHANNEL` 이 기본 채널이다.

| 채널 드라이버 | 동작 |
|---|---|
| `single` | 파일 하나(`laravel.log`)에 계속 덧붙인다 |
| `daily` | 날짜별 파일(`laravel-2026-09-26.log`), 오래된 것은 지운다 |
| `stack` | 여러 채널에 한꺼번에 — 기본값. 안에 무엇을 넣을지는 `LOG_STACK` |
| `stderr` | 표준 오류 — Docker 에서 `docker compose logs` 로 보려면 |

```php
Log::channel('daily')->info('이 줄만 daily 채널로');
```

`LOG_LEVEL=warning` 이면 `debug`·`info` 는 기록되지 않는다. 운영에서 debug 로그가 쏟아지지 않게 등급으로 거른다.

### 실시간으로 보기 — pail

```bash
php artisan pail                        # 로그가 생기는 대로 터미널에 흘려 보여 준다
php artisan pail --filter="결제"         # 글자로 거르기
php artisan pail --level=error          # 등급으로 거르기
```

`tail -f storage/logs/laravel.log` 와 비슷하지만, 채널·파일 종류와 상관없이 보이고 예외를 읽기 좋게 펼쳐 준다. Laravel 11+ 골격에 들어 있다.

---

## 5. 예외 — 던지면 Laravel 이 응답으로 바꾼다

### 핵심 개념

순수 PHP 에서는 예외를 잡지 않으면 흰 화면이나 PHP 오류가 나온다. Laravel 은 **잡히지 않은 예외를 전부 받아** 두 가지를 한다.

1. **보고(report)** — 로그에 쓴다(설정하면 외부 오류 수집 서비스로도).
2. **그리기(render)** — 알맞은 응답으로 바꾼다. 404 화면, 422 검증 오류, JSON 오류 등.

그래서 컨트롤러에서 `try/catch` 를 거의 쓰지 않는다. 대신 **알맞은 예외가 알맞은 응답이 되도록** 되어 있다.

| 이런 일이 생기면 | 던져지는 예외 | 응답 |
|---|---|---|
| `findOrFail()` 에 없는 id | `ModelNotFoundException` | 404 |
| `validate()` 실패 | `ValidationException` | 이전 페이지 + `$errors` (JSON 요청이면 422) |
| `Gate::authorize()` 거부 | `AuthorizationException` | 403 |
| 로그인 안 함 + `auth` 미들웨어 | `AuthenticationException` | 로그인 페이지로 |
| `abort(404)` | `HttpException` | 404 |
| 그 밖의 예외 | 그 예외 | 500 |

### 예제 — abort_if·abort_unless (일반 Laravel 예)

```php
abort(403);                                          // 무조건
abort_if($slot->tutor_id !== $user->id, 403);        // 조건이 참이면
abort_unless($user->isAdmin(), 403, '관리자만');       // 조건이 거짓이면

// 순수 PHP 로 쓰면
if ($slot->tutor_id !== $user->id) { http_response_code(403); exit('Forbidden'); }
```

`abort` 는 응답을 직접 만들지 않고 **예외를 던진다**. 그래서 함수 몇 단계 안쪽에서 불러도 그 자리에서 멈추고, 오류 화면(7절)이 그려진다.

---

## 6. 예외 처리 설정 — bootstrap/app.php

### 핵심 개념

Laravel 11 부터 예외 처리 설정은 `bootstrap/app.php` 의 `withExceptions()` 에 둔다. 옛 튜토리얼의 `app/Exceptions/Handler.php` 가 하던 일이다([lifecycle.md](lifecycle.md#2-bootstrapappphp--앱-조립) 2절).

### PES 코드 — `bootstrap/app.php` (발췌)

```php
->withExceptions(function (Exceptions $exceptions): void {
    $exceptions->shouldRenderJsonWhen(
        fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
    );
})->create();
```

"주소가 `api/` 로 시작하거나 요청이 JSON 을 원하면, 오류도 HTML 이 아니라 JSON 으로 그려라"라는 뜻이다. `fetch()` 로 부른 곳에 HTML 오류 페이지가 돌아와 JS 가 깨지는 일을 막는다.

### 예제 — report·render·dontReport (일반 Laravel 예)

```php
->withExceptions(function (Exceptions $exceptions): void {
    // 보고 방식 바꾸기 — 이 예외는 따로 알림
    $exceptions->report(function (PaymentFailed $e) {
        Log::channel('payments')->error($e->getMessage(), ['order_id' => $e->orderId]);
    });

    // 응답 바꾸기 — API 의 404 를 원하는 JSON 모양으로
    $exceptions->render(function (NotFoundHttpException $e, Request $request) {
        if ($request->is('api/*')) {
            return response()->json(['message' => '없는 자료입니다.'], 404);
        }
    });

    // 로그에 남기지 않을 예외
    $exceptions->dontReport([
        CouponExpired::class,
    ]);
})
```

- `render()` 콜백이 **아무것도 돌려주지 않으면** 기본 처리로 넘어간다. 그래서 위 예는 API 요청만 바꾸고 나머지는 평소대로 404 화면이 된다.
- `findOrFail()` 의 `ModelNotFoundException` 은 그리기 전에 `NotFoundHttpException` 으로 바뀐다. 그래서 위 `render` 가 `findOrFail` 의 404 도 잡는다.

### 예제 — 멈추지 않고 보고만 (일반 Laravel 예)

```php
try {
    $rate = ExchangeApi::fetch();
} catch (Throwable $e) {
    report($e);                     // 로그에 남기고
    $rate = config('pay.default_rate');   // 기본값으로 계속 간다
}

// 같은 일을 한 줄로
$rate = rescue(fn () => ExchangeApi::fetch(), config('pay.default_rate'));
```

`report()` 는 "로그에 남기되 사용자 응답은 멈추지 않는다", `rescue()` 는 "실패하면 보고하고 기본값을 돌려준다"이다. 외부 API 처럼 **실패해도 페이지는 떠야 하는 곳**에 쓴다.

> ⚠ `catch (Exception $e) {}` 로 예외를 삼키지 않는다. 로그에도 안 남고 원인을 영영 모른다. 잡았으면 최소한 `report($e)`.

---

## 7. 오류 화면과 APP_DEBUG

### 핵심 개념

`.env` 의 `APP_DEBUG` 가 오류 화면을 정한다.

| `APP_DEBUG` | 500 오류 때 화면 | 어디서 |
|---|---|---|
| `true` | 예외 이름·메시지·스택 트레이스·요청 정보가 다 보이는 개발용 화면 | 로컬만 |
| `false` | "Server Error" 한 줄의 짧은 화면 | **운영은 반드시** |

> ⚠ 운영에서 `APP_DEBUG=true` 면 오류 화면에 **환경 변수·DB 정보·코드 경로**가 드러날 수 있다. 배포 체크리스트의 첫 줄이다([deploy.md](deploy.md)).

### 오류 화면 바꾸기

`resources/views/errors/` 에 **상태 코드 이름**으로 Blade 파일을 두면 그 화면을 쓴다.

```
resources/views/errors/404.blade.php    404 일 때
resources/views/errors/403.blade.php    403 일 때
resources/views/errors/500.blade.php    500 일 때 (APP_DEBUG=false 일 때만 보인다)
resources/views/errors/4xx.blade.php    따로 만든 파일이 없는 4xx 전부
```

```blade
{{-- resources/views/errors/404.blade.php (일반 Laravel 예) --}}
@extends('layouts.app')

@section('content')
    <h1>페이지를 찾을 수 없습니다</h1>
    <p>{{ $exception->getMessage() ?: '주소를 다시 확인해 주세요.' }}</p>
    <a href="{{ url('/') }}">처음으로</a>
@endsection
```

Laravel 기본 오류 화면을 복사해 와서 고치고 싶으면:

```bash
php artisan vendor:publish --tag=laravel-errors
```

> ⚠ 500 화면은 무언가 이미 깨진 상태에서 그려진다. DB 조회·로그인 정보처럼 **또 실패할 수 있는 것**을 500 화면 레이아웃에 넣지 않는다.

---

## 8. 암기 카드

| 질문 | 답 |
|---|---|
| `dump()` 와 `dd()` 의 차이는? | 찍고 계속 / 찍고 멈춤 |
| 쿼리 빌더 사슬 중간에서 SQL 을 찍고 멈추는 법은? | `->dd()` 또는 값까지 채운 `->ddRawSql()` |
| `toSql()` 과 `toRawSql()` 의 차이는? | `?` 자리표시자 그대로 / 값까지 채운 SQL |
| 요청 하나에서 나간 쿼리를 모두 보려면? | `DB::enableQueryLog()` 뒤 `DB::getQueryLog()`, 또는 `DB::listen` |
| AJAX 요청에서 `dd()` 결과는 어디서 보나? | 개발자 도구 네트워크 탭의 응답 본문 — 또는 로그로 |
| 로그 파일 기본 위치는? | `storage/logs/laravel.log` |
| 로그 메시지에 바뀌는 값을 넣는 법은? | 두 번째 인자 배열 — `Log::error('결제 실패', ['order_id' => $id])` |
| 로그를 날짜별 파일로 나누는 채널은? | `daily` |
| 로그를 실시간으로 보는 Artisan 명령은? | `php artisan pail` |
| Laravel 11+ 에서 예외 처리를 설정하는 곳은? | `bootstrap/app.php` 의 `withExceptions()` (옛 `Handler.php`) |
| `findOrFail()` 이 404 가 되는 원리는? | `ModelNotFoundException` 을 던지고 Laravel 이 404 응답으로 그린다 |
| 조건이 참이면 403 으로 멈추는 한 줄은? | `abort_if($cond, 403)` |
| 예외를 로그에 남기되 페이지는 계속 그리려면? | `report($e)` — 한 줄로는 `rescue(fn, 기본값)` |
| 404 화면을 바꾸려면 어떤 파일을? | `resources/views/errors/404.blade.php` |
| 운영에서 `APP_DEBUG` 는? | `false` — `true` 면 내부 정보가 오류 화면에 드러난다 |
| `render()` 콜백이 아무것도 돌려주지 않으면? | 기본 처리로 넘어간다 |
