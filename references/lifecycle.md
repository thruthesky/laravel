# 1단계 — 큰 그림: 요청 흐름·컨테이너·Facade·설정

## 목차

1. [요청 한 바퀴](#1-요청-한-바퀴)
2. [bootstrap/app.php — 앱 조립](#2-bootstrapappphp--앱-조립)
3. [서비스 컨테이너와 의존성 주입](#3-서비스-컨테이너와-의존성-주입)
4. [서비스 프로바이더 — register 와 boot](#4-서비스-프로바이더--register-와-boot)
5. [Facade — 정적 호출처럼 보이는 객체 호출](#5-facade--정적-호출처럼-보이는-객체-호출)
6. [.env → config → config()](#6-env--config--config)
7. [직접 만든 전역 함수 — app/helpers.php](#7-직접-만든-전역-함수--apphelpersphp)
8. [실습: 요청 한 바퀴 따라가기](#8-실습-요청-한-바퀴-따라가기)
9. [암기 카드](#9-암기-카드)

---

## 1. 요청 한 바퀴

### 핵심 개념

Laravel 은 **모든 요청을 `public/index.php` 한 파일로 받는** front controller 구조다. 웹 서버(PES 는 FrankenPHP)가 `/ko/tutor/schedule` 같은 주소를 전부 `index.php` 로 넘기면, Laravel 이 URL 을 보고 어느 코드를 실행할지 정한다.

### 순수 PHP 와 비교

| 순수 PHP | Laravel |
|---|---|
| `schedule.php`, `login.php` … URL 마다 파일 | `public/index.php` 하나 + `routes/web.php` 에 URL 목록 |
| 파일 맨 위에서 `session_start()`, 로그인 검사 | 미들웨어가 컨트롤러 앞에서 처리 |
| `$_POST` 를 직접 검사 | `$request->validate([...])` |
| `new PDO(...)` + SQL | Eloquent 모델 |
| `include 'header.php'` + `echo` | Blade 레이아웃·컴포넌트 |
| `header('Location: ...'); exit;` | `return redirect()->to(...)` |

### 흐름도

```
브라우저 GET /ko/tutor/schedule
 │
 ├─ public/index.php                 모든 요청의 입구
 ├─ bootstrap/app.php                앱 조립 (라우트 파일·미들웨어·예외 처리)
 ├─ 서비스 프로바이더 boot()          앱 전체 준비 (PES: Route::localized 매크로 등록)
 ├─ 라우터가 URL 에 맞는 라우트를 찾음   routes/web.php
 ├─ 미들웨어 (앞부분)                  세션 시작 → CSRF 검사 → 로그인 검사 → 언어 설정
 ├─ 컨트롤러 메서드                    ScheduleController::index(Request $request)
 │    ├─ 모델로 DB 조회               $user->tutorSlots()->...->get()
 │    └─ return view('tutor.schedule', [...])
 ├─ Blade 렌더링                      resources/views/tutor/schedule.blade.php
 ├─ 미들웨어 (뒷부분)                  쿠키 암호화 등 응답 가공
 └─ 응답 HTML
```

**핵심 로직**: 컨트롤러는 `echo` 하지 않고 **응답 객체를 `return`** 한다. 그래야 미들웨어가 응답을 받아 쿠키·헤더를 붙일 수 있다.

---

## 2. bootstrap/app.php — 앱 조립

### 핵심 개념

Laravel 11 부터 앱 설정(라우트 파일, 미들웨어, 예외 처리)이 이 파일 하나로 모였다. 옛 튜토리얼의 `app/Http/Kernel.php`·`RouteServiceProvider` 가 하던 일이다.

### PES 코드 — `bootstrap/app.php` (발췌)

```php
return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',          // 'web' 미들웨어 그룹(세션·쿠키·CSRF)이 붙는다
        commands: __DIR__.'/../routes/console.php', // artisan 명령
        health: '/up',                              // 헬스 체크 URL
        then: function () {
            // 공개 페이지 — 세션·쿠키가 없어 Cloudflare 가 캐시한다.
            Route::middleware('public')->group(base_path('routes/public.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // web 그룹(세션·쿠키·CSRF)에서 쿠키·세션을 모두 뺀 그룹.
        $middleware->group('public', [
            DetectLocale::class,
            SubstituteBindings::class,
            CachePublicPage::class,
        ]);
        $middleware->encryptCookies(except: ['locale', 'signed_in']);
        $middleware->redirectGuestsTo(fn (Request $request) => lroute('login', [], $request->route('locale') ?? config('locales.default')));
        // 정지된 회원은 로그인해 있어도 다음 요청에서 로그아웃시킨다.
        $middleware->web(append: [LogoutSuspended::class]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
```

### 읽는 법

| 코드 | 뜻 |
|---|---|
| `withRouting(web: ...)` | `routes/web.php` 의 모든 라우트에 `web` 미들웨어 그룹이 붙는다 |
| `then: fn () => Route::middleware('public')->group(...)` | PES 가 추가한 두 번째 라우트 파일. `web` 대신 직접 만든 `public` 그룹이 붙는다 |
| `$middleware->group('public', [...])` | 미들웨어 여러 개에 이름 하나를 붙여 묶음 |
| `$middleware->web(append: [...])` | 기본 `web` 그룹 끝에 미들웨어 추가 |
| `redirectGuestsTo(...)` | `auth` 미들웨어가 손님을 보낼 곳 |
| `withExceptions(...)` | 예외를 HTML 로 보여 줄지 JSON 으로 줄지 등 |

---

## 3. 서비스 컨테이너와 의존성 주입

### 핵심 개념

서비스 컨테이너는 **"이 클래스가 필요하면 이렇게 만들어 준다"를 기억하는 거대한 공장**이다. Laravel 은 컨트롤러 메서드·생성자의 **타입 힌트**를 보고 필요한 객체를 컨테이너에서 꺼내 넣어 준다. 이것이 의존성 주입(DI)이다.

### 순수 PHP 와 비교

```php
// 순수 PHP — 직접 만든다
$request = new Request($_GET, $_POST, $_COOKIE, $_FILES, $_SERVER);
$controller = new ScheduleController();
$controller->index($request);

// Laravel — 타입만 적으면 컨테이너가 채운다
public function index(Request $request): View   // ← Laravel 이 지금 요청 객체를 넣어 준다
```

### PES 코드 — 메서드 주입

```php
// app/Http/Controllers/Tutor/ScheduleController.php
public function storeSlot(StoreTutorSlotRequest $request): RedirectResponse
{
    $data = $request->validated();   // 이 메서드가 불리기 전에 이미 검증이 끝났다
    $request->user()->tutorSlots()->create($data);

    return $this->saved();
}
```

`StoreTutorSlotRequest` 를 타입으로 적었기 때문에 컨테이너가 이 FormRequest 를 만들고, **만드는 순간 검증까지 실행**한다. 검증에 실패하면 메서드 본문은 아예 실행되지 않는다.

### 직접 꺼내기·등록하기 (일반 예)

```php
app(Foo::class);              // 컨테이너에서 꺼내기 (없으면 자동으로 new 해 준다)
app()->getLocale();           // app() = 컨테이너 자체(= Application)

// 서비스 프로바이더 register() 안에서 등록
$this->app->singleton(PaymentGateway::class, fn () => new PaypalGateway(config('services.paypal.key')));
```

인터페이스를 타입으로 적고 구현체를 등록해 두면, 테스트에서 가짜 구현으로 바꿔 끼울 수 있다. PES 는 아직 직접 등록한 것이 없다(`AppServiceProvider::register()` 가 비어 있다).

---

## 4. 서비스 프로바이더 — register 와 boot

### 핵심 개념

서비스 프로바이더는 **앱이 시작될 때 한 번 실행되는 준비 코드**다. 두 메서드가 있다.

| 메서드 | 할 일 | 하지 말 일 |
|---|---|---|
| `register()` | 컨테이너에 "만드는 법" 등록만 | 다른 서비스 사용 (아직 준비 안 됐을 수 있음) |
| `boot()` | 모든 등록이 끝난 뒤 실행 — 매크로, 이벤트, 뷰 공유 등 | — |

### PES 코드 — `app/Providers/AppServiceProvider.php`

```php
public function boot(): void
{
    // Route::localized(fn () => …) — 같은 라우트를 두 번 등록한다.
    //   기본 언어: /about        (이름 about)
    //   그 밖:     /ko/about     (이름 localized.about) — URL 은 lroute('about') 로 만든다.
    Route::macro('localized', function (Closure $routes) {
        $others = array_diff(array_keys(config('locales.locales')), [config('locales.default')]);

        Route::middleware(SetLocale::class)->group($routes);

        Route::prefix('{locale}')
            ->where(['locale' => implode('|', $others)])
            ->name('localized.')
            ->middleware(SetLocale::class)
            ->group($routes);
    });
}
```

**핵심 로직**: `Route::macro()` 는 Laravel 클래스에 **메서드를 새로 붙이는** 기능이다. 여기서 붙인 `localized` 덕분에 `routes/web.php` 에서 `Route::localized(function () { ... })` 를 쓸 수 있다. 자세히는 [routing.md](routing.md) 7절.

---

## 5. Facade — 정적 호출처럼 보이는 객체 호출

### 핵심 개념

`Route::get()`, `Auth::user()`, `DB::statement()`, `Storage::disk()` 는 정적 메서드처럼 보이지만 **정적 클래스가 아니다.** Facade 는 컨테이너에 들어 있는 객체를 짧게 부르는 대리자다.

```php
Auth::user();
// 실제로는 ↓ 와 같다
app('auth')->user();
```

Facade 클래스는 "컨테이너의 어떤 이름을 부를지" 하나만 안다(`getFacadeAccessor()`). 그래서 테스트에서 `Storage::fake()`, `Mail::fake()` 처럼 **가짜로 바꿔 끼울 수 있다** — 진짜 정적 클래스라면 불가능한 일이다.

### PES 에서 쓰는 Facade

| Facade | 하는 일 | PES 위치 |
|---|---|---|
| `Route::` | 라우트 등록 | `routes/web.php` |
| `Auth::` | 로그인·로그아웃 | `LoginController` |
| `App::` | 언어 설정 `App::setLocale()` | `SetLocale` 미들웨어 |
| `URL::` | URL 기본값 `URL::defaults()` | `SetLocale` 미들웨어 |
| `DB::` | 원시 SQL | 마이그레이션의 CHECK 제약 |
| `Schema::` | 테이블 만들기·바꾸기 | 마이그레이션 |
| `Storage::` | 파일 저장소 | `TutorProfile::photoUrl()` |

같은 일을 하는 헬퍼 함수가 있는 것도 많다: `Auth::user()` = `auth()->user()`, `App::getLocale()` = `app()->getLocale()`. 둘 다 같은 객체를 부른다.

---

## 6. .env → config → config()

### 핵심 개념

설정은 **세 층**으로 흐른다.

```
.env                        TUTOR_DISK=public          ← 서버마다 다른 값·비밀번호 (git 에 올리지 않음)
  ↓ env() 는 여기서만
config/tutor.php            'disk' => env('TUTOR_DISK', 'public'),
  ↓ config() 로 읽기
코드                         config('tutor.disk')
```

**핵심 로직**: 운영 서버는 속도를 위해 `php artisan config:cache` 로 `config/*.php` 전체를 한 파일로 굳힌다. 그 뒤에는 `.env` 파일을 읽지 않으므로 **코드에서 직접 부른 `env()` 는 `null` 이 될 수 있다.** 그래서 `env()` 는 `config/*.php` 안에서만 쓴다.

### PES 코드 — `config/tutor.php` (발췌)

```php
return [
    'disk' => env('TUTOR_DISK', 'public'),       // env() 는 config 파일 안에서만
    'booking_min_score' => 80,
    'slot_minutes' => ['min' => 10, 'max' => 180, 'step' => 5],
    'trial_max_minutes' => 15,
    'ranking' => [
        'star_points' => 10,
        'schedule' => ['max' => 10, 'classes' => 8, 'minutes' => 200],
    ],
];
```

```php
config('tutor.trial_max_minutes');          // 15  — 점으로 파일.키.하위키
config('tutor.ranking.schedule.max');       // 10
config('tutor.slot_minutes');               // ['min' => 10, 'max' => 180, 'step' => 5]
config('tutor.nothing', 'default');         // 없으면 기본값
```

PES 규칙: 숫자를 코드에 박지 않고 `config/*.php` 에서 읽는다. 운영 규정 숫자의 기준은 `PES-SSOT.md` 이고, `config/tutor.php`·`config/booking.php` 가 그 숫자를 담는다.

확인 명령: `docker compose exec app php artisan config:show tutor`

---

## 7. 직접 만든 전역 함수 — app/helpers.php

### 핵심 개념

Laravel 의 `route()`, `view()` 같은 전역 함수처럼, 프로젝트가 직접 전역 함수를 만들 수도 있다. `composer.json` 의 `autoload.files` 에 적은 파일은 **모든 요청에서 자동으로 `require`** 된다.

```json
"autoload": {
    "files": ["app/helpers.php"],
    "psr-4": { "App\\": "app/" }
}
```

`psr-4` 는 "`App\Models\User` 클래스는 `app/Models/User.php` 에 있다"는 규칙이다. 클래스는 쓰일 때 자동 로드되지만, 함수는 자동 로드가 안 되므로 `files` 로 미리 불러온다.

### PES 코드 — `app/helpers.php` 의 `lroute()`

```php
if (! function_exists('lroute')) {
    /** 언어가 붙은 라우트 URL. 기본 언어(en)는 접두사 없이, 나머지는 /ko/… 로 만든다. */
    function lroute(string $name, array $parameters = [], ?string $locale = null): string
    {
        $locale ??= app()->getLocale();

        return $locale === config('locales.default')
            ? route($name, $parameters)
            : route('localized.'.$name, ['locale' => $locale] + $parameters);
    }
}
```

`lroute('tutor.schedule')` → 영어면 `/tutor/schedule`, 한국어면 `/ko/tutor/schedule`. PES 코드에서 `route()` 대신 `lroute()` 가 자주 보이는 이유다.

---

## 8. 실습: 요청 한 바퀴 따라가기

사용자가 "요청 따라가기"를 원하면 아래 순서대로 **파일을 하나씩 열어 보여 주며** 설명한다. 각 단계에서 파일을 다시 읽어 지금 줄 번호로 링크한다.

**대상 요청**: 로그인한 강사가 `GET /ko/tutor/schedule` 을 연다.

| 순서 | 파일 | 볼 것 | 설명할 개념 |
|---|---|---|---|
| 1 | `public/index.php` | 몇 줄뿐인 입구 | front controller |
| 2 | `bootstrap/app.php` | `withRouting(web: ...)` | 라우트 파일 등록, `web` 그룹 |
| 3 | `app/Providers/AppServiceProvider.php` | `Route::macro('localized', ...)` | 서비스 프로바이더 boot, 매크로 |
| 4 | `routes/web.php` | `Route::localized(...)` 안의 `middleware('auth')` 그룹, `Route::get('/tutor/schedule', [ScheduleController::class, 'index'])->name('tutor.schedule')` | 라우트, 이름, 그룹 |
| 5 | 미들웨어 | `web` 그룹(세션 시작·CSRF·`LogoutSuspended`) → `auth`(손님이면 `redirectGuestsTo` 로) → `SetLocale`(`App::setLocale('ko')`) | 미들웨어 순서. `bootstrap/app.php` 주석대로 `auth` 가 `SetLocale` 보다 먼저 돈다 |
| 6 | `app/Http/Controllers/Tutor/ScheduleController.php` | `index(Request $request)` | 메서드 주입, `$request->user()`, 프로필이 없으면 redirect + flash |
| 7 | `app/Models/User.php` | `tutorSlots(): HasMany` | 관계, 괄호 규칙, `groupBy('weekday')` |
| 8 | `resources/views/tutor/schedule.blade.php` | `@extends('layouts.app')`, `@forelse ($slots as $weekday => $daySlots)` | 레이아웃 상속, 반복 |
| 9 | `resources/views/layouts/app.blade.php` | `@yield('content')` | 레이아웃 |

확인하며 해 볼 명령:

```bash
docker compose exec app php artisan route:list --path=tutor/schedule   # 이름·미들웨어 확인 (-v 를 붙이면 미들웨어 목록)
```

마친 뒤 사용자에게 "로그인하지 않은 사람이 같은 주소를 열면 어느 단계에서 무엇이 일어나나?"를 묻는다. 정답: 5단계의 `auth` 미들웨어가 컨트롤러 전에 막고, `redirectGuestsTo` 에 적힌 대로 `/ko/login` 으로 보낸다.

---

## 9. 암기 카드

| 질문 | 답 |
|---|---|
| 모든 요청의 입구 파일은? | `public/index.php` |
| 미들웨어·라우트 파일을 등록하는 곳은? (Laravel 11+) | `bootstrap/app.php` |
| 컨트롤러가 응답을 내보내는 방법은? | `echo` 가 아니라 `return` (view·redirect·json) |
| 서비스 컨테이너를 한 문장으로? | 타입 힌트를 보고 필요한 객체를 만들어 넣어 주는 공장 |
| `register()` 와 `boot()` 의 차이는? | register 는 등록만, boot 는 모든 등록이 끝난 뒤 실행 |
| Facade 는 정적 클래스인가? | 아니다. 컨테이너 객체의 대리자라 `fake()` 로 바꿔 끼울 수 있다 |
| `env()` 를 쓰는 곳은? | `config/*.php` 안에서만 |
| `config('tutor.ranking.star_points')` 는 어느 파일? | `config/tutor.php` 의 `['ranking']['star_points']` |
| `app/helpers.php` 가 자동으로 불리는 이유는? | `composer.json` 의 `autoload.files` |
| PES 에서 `route()` 대신 자주 쓰는 함수는? | `lroute()` — 언어 접두사를 붙인다 |
