# 2단계 — 라우트와 미들웨어

## 목차

1. [라우트 기본 형태](#1-라우트-기본-형태)
2. [라우트 → 코드 연결 네 가지](#2-라우트--코드-연결-네-가지)
3. [메서드 이름 관례 — 리소스 7개](#3-메서드-이름-관례--리소스-7개)
4. [라우트 이름과 URL 만들기](#4-라우트-이름과-url-만들기)
5. [URL 매개변수와 모델 바인딩](#5-url-매개변수와-모델-바인딩)
6. [미들웨어와 그룹](#6-미들웨어와-그룹)
7. [PES 의 Route::localized 해부](#7-pes-의-routelocalized-해부)
8. [미들웨어 클래스 만들기](#8-미들웨어-클래스-만들기)
9. [web.php 와 public.php](#9-webphp-와-publicphp)
10. [암기 카드](#10-암기-카드)

---

## 1. 라우트 기본 형태

### 핵심 개념

라우트는 **"이 HTTP 메서드 + 이 URL 이 오면 이 코드를 실행한다"** 는 한 줄 규칙이다.

```php
Route::get('/tutor/schedule', [ScheduleController::class, 'index'])->name('tutor.schedule');
//    ↑ 메서드  ↑ URL            ↑ 실행할 컨트롤러 메서드                  ↑ 이름
```

### 순수 PHP 와 비교

```php
// 순수 PHP — 직접 분기
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $path === '/tutor/schedule') {
    (new ScheduleController)->index();
} elseif (...) { ... }
```

Laravel 은 이 분기표를 `routes/web.php` 에 선언형으로 적는다.

### HTTP 메서드

| 메서드 | 쓰는 때 | PES 예 |
|---|---|---|
| `Route::get` | 화면 보기 | `/tutor/schedule` |
| `Route::post` | 새로 만들기 | `/tutor/schedule/slots` |
| `Route::put` / `patch` | 고치기 | `/tutor/schedule/timezone` |
| `Route::delete` | 지우기 | `/tutor/schedule/slots/{slot}` |

HTML 폼은 GET·POST 만 보낼 수 있다. PUT·DELETE 는 POST 로 보내고 폼 안에 `@method('PUT')` 를 넣는다(→ [blade.md](blade.md)).

---

## 2. 라우트 → 코드 연결 네 가지

```php
// ① 클로저 — 연습용. 실제 코드는 컨트롤러에 둔다 (라우트 캐시·가독성 때문)
Route::get('/hello', fn () => 'Hello');

// ② 컨트롤러 메서드 — 가장 흔함
Route::get('/login', [LoginController::class, 'create'])->name('login');

// ③ 단일 액션 컨트롤러 — 메서드가 __invoke 하나뿐
Route::get('/me', MeController::class)->name('me');

// ④ 화면만 — 컨트롤러 없이 뷰를 바로
Route::view('/class/policy', 'class.policy')->name('class.policy');
```

### PES 코드 — ③ 단일 액션 `app/Http/Controllers/MeController.php`

```php
class MeController extends Controller
{
    /** 캐시된 공개 페이지가 뜬 뒤 로그인 상태와 CSRF 토큰을 받아 가는 곳. */
    public function __invoke(Request $request): JsonResponse
    {
        return response()
            ->json([
                'user' => $request->user()?->only(['id', 'name']),
                'csrf' => csrf_token(),
            ])
            ->header('Cache-Control', 'no-store');
    }
}
```

---

## 3. 메서드 이름 관례 — 리소스 7개

Laravel 은 CRUD 메서드 이름을 이렇게 쓰는 관례가 있다. `Route::resource('posts', PostController::class)` 한 줄이 7개 라우트를 만든다.

| 메서드 | HTTP | URL | 하는 일 |
|---|---|---|---|
| `index` | GET | `/posts` | 목록 |
| `create` | GET | `/posts/create` | 만들기 폼 |
| `store` | POST | `/posts` | 저장 |
| `show` | GET | `/posts/{post}` | 하나 보기 |
| `edit` | GET | `/posts/{post}/edit` | 고치기 폼 |
| `update` | PUT/PATCH | `/posts/{post}` | 고쳐 저장 |
| `destroy` | DELETE | `/posts/{post}` | 지우기 |

PES 는 `Route::resource` 를 쓰지 않지만 **메서드 이름은 이 관례를 따른다**: `RegisterController::create/store`, `ProfileController::edit/update`, `EscrowController::edit/update/destroy`, `TutorListController::index/show`. 이름만 봐도 무슨 일을 하는지 안다.

---

## 4. 라우트 이름과 URL 만들기

### 핵심 개념

URL 을 코드 곳곳에 직접 쓰지 않고 **이름으로 부른다.** URL 이 바뀌어도 라우트 한 줄만 고치면 된다.

```php
Route::get('/tutor/schedule', ...)->name('tutor.schedule');

route('tutor.schedule');                                   // http://…/tutor/schedule
route('tutor.slots.destroy', ['slot' => 5]);               // http://…/tutor/schedule/slots/5
redirect()->route('tutor.schedule');                        // 그 URL 로 이동
```

**PES 는 `route()` 대신 `lroute()`** 를 쓴다 — 보고 있는 언어의 접두사(`/ko`)를 붙여 준다([lifecycle.md](lifecycle.md) 7절).

```blade
<form method="post" action="{{ lroute('tutor.slots.destroy', ['slot' => $slot->id]) }}">
```

PES 규칙: `routes/public.php` 의 라우트에는 **반드시 이름을 붙인다**(언어 전환 URL·hreflang 을 이름으로 만들기 때문).

---

## 5. URL 매개변수와 모델 바인딩

### 매개변수

```php
Route::get('/class/tutors/{tutor}', [TutorListController::class, 'show'])
    ->whereNumber('tutor')                // 숫자만 — /class/tutors/abc 는 404
    ->name('class.tutors.show');

public function show(int $tutor): View    // {tutor} 가 같은 이름의 인자로 들어온다
```

| 문법 | 뜻 |
|---|---|
| `{id}` | 필수 매개변수 |
| `{id?}` | 선택 (인자에 기본값 필요: `$id = null`) |
| `->whereNumber('id')` | 숫자만 |
| `->where('locale', 'ko|ja')` | 정규식 |

### 라우트 모델 바인딩 (일반 Laravel)

인자 타입을 모델로 적으면 Laravel 이 **id 로 조회까지 해서** 모델을 넣어 준다. 없으면 404.

```php
Route::delete('/slots/{slot}', [SlotController::class, 'destroy']);

public function destroy(TutorSlot $slot)   // TutorSlot::findOrFail($slot) 를 자동으로
{
    $slot->delete();                        // ⚠ 남의 칸도 지울 수 있다!
}
```

`SubstituteBindings` 미들웨어가 이 일을 한다(`web` 그룹에 기본 포함, PES `public` 그룹에는 직접 넣었다).

### PES 가 대신 쓰는 패턴 — 관계로 찾기

```php
// app/Http/Controllers/Tutor/ScheduleController.php
public function destroySlot(Request $request, int $slot): RedirectResponse
{
    $request->user()->tutorSlots()->findOrFail($slot)->delete();

    return $this->saved();
}
```

**핵심 로직**: `$request->user()->tutorSlots()` 는 `where tutor_id = 내 id` 가 붙은 쿼리다. 그 안에서 `findOrFail` 하므로 **남의 칸 번호를 넣으면 404** 가 된다. 모델 바인딩을 쓰면서 막으려면 정책(Policy)이나 `scopeBindings()` 가 따로 필요하다.

---

## 6. 미들웨어와 그룹

### 핵심 개념

미들웨어는 **컨트롤러 앞뒤에 끼는 필터**다. 양파 껍질처럼 요청이 바깥 미들웨어부터 들어가고, 응답은 안쪽부터 나온다.

```
요청 → [세션] → [CSRF] → [auth] → [SetLocale] → 컨트롤러
응답 ← [세션] ← [CSRF] ← [auth] ← [SetLocale] ← 컨트롤러
```

### 순수 PHP 와 비교

```php
// 순수 PHP — 페이지마다 맨 위에 복사
session_start();
if (empty($_SESSION['user_id'])) { header('Location: /login'); exit; }
```

Laravel 은 라우트에 `->middleware('auth')` 한 번.

### PES 코드 — `routes/web.php` (발췌)

```php
Route::localized(function () {
    Route::middleware('guest')->group(function () {             // 로그인한 사람은 못 들어옴
        Route::get('/login', [LoginController::class, 'create'])->name('login');
        Route::post('/login', [LoginController::class, 'store'])->middleware('throttle:10,1');
    });

    Route::middleware('auth')->group(function () {              // 로그인해야 들어옴
        Route::get('/tutor/schedule', [ScheduleController::class, 'index'])->name('tutor.schedule');
        Route::post('/tutor/schedule/slots', [ScheduleController::class, 'storeSlot'])->name('tutor.slots.store');
        Route::delete('/tutor/schedule/slots/{slot}', [ScheduleController::class, 'destroySlot'])->name('tutor.slots.destroy');
    });
});
Route::post('/logout', [LoginController::class, 'destroy'])->middleware('auth')->name('logout');
```

| 미들웨어 | 뜻 |
|---|---|
| `auth` | 로그인 필수. 손님은 로그인 화면으로 |
| `guest` | 손님만. 로그인한 사람은 다른 곳으로 |
| `throttle:10,1` | 1분에 10번까지 (로그인 무차별 대입 방지) |
| `web` 그룹 | 쿠키 암호화·세션·`$errors` 공유·CSRF·모델 바인딩 — `routes/web.php` 에 자동 |

### 그룹 문법

```php
Route::middleware('auth')          // 미들웨어
    ->prefix('admin')              // URL 앞에 /admin
    ->name('admin.')               // 이름 앞에 admin.
    ->group(function () { ... });
```

---

## 7. PES 의 Route::localized 해부

### 핵심 개념

PES 는 17개 언어를 URL 접두사로 나눈다: 영어는 `/tutor/schedule`, 한국어는 `/ko/tutor/schedule`. `Route::localized` 는 **같은 라우트 묶음을 두 번 등록**하는 매크로다(`AppServiceProvider::boot()` 에서 정의, [lifecycle.md](lifecycle.md) 4절).

```php
Route::macro('localized', function (Closure $routes) {
    $others = array_diff(array_keys(config('locales.locales')), [config('locales.default')]);

    Route::middleware(SetLocale::class)->group($routes);          // ① /tutor/schedule        이름 tutor.schedule

    Route::prefix('{locale}')                                      // ② /{locale}/tutor/schedule
        ->where(['locale' => implode('|', $others)])               //    locale 은 ko|ja|zh… 만
        ->name('localized.')                                       //    이름 localized.tutor.schedule
        ->middleware(SetLocale::class)
        ->group($routes);
});
```

**핵심 로직**: 등록은 두 번, URL 만들기는 `lroute('tutor.schedule')` 하나. `lroute()` 가 지금 언어를 보고 `tutor.schedule` 과 `localized.tutor.schedule` 중 하나를 고른다.

`route:list` 로 보면 한 라우트가 두 줄로 나온다:

```bash
docker compose exec app php artisan route:list --name=tutor.schedule
```

---

## 8. 미들웨어 클래스 만들기

### 구조

```php
public function handle(Request $request, Closure $next): Response
{
    // ① 컨트롤러 전에 할 일
    $response = $next($request);     // ② 다음 미들웨어(결국 컨트롤러)로 넘김
    // ③ 컨트롤러 뒤에 할 일 (응답 가공)
    return $response;
}
```

`$next($request)` 를 부르지 않고 다른 응답을 `return` 하면 **거기서 멈춘다**(컨트롤러까지 가지 않는다).

### PES 코드 — `app/Http/Middleware/SetLocale.php` (앞에서만 일함)

```php
public function handle(Request $request, Closure $next): Response
{
    $route = $request->route();
    $locale = $route->parameter('locale', config('locales.default'));

    // 컨트롤러 인자에 locale 이 끼어들지 않게 뺀다(/ko/posts/5 → show($post) 그대로).
    $route->forgetParameter('locale');

    App::setLocale($locale);
    URL::defaults(['locale' => $locale]);

    return $next($request);
}
```

### PES 코드 — `app/Http/Middleware/LogoutSuspended.php` (조건에 따라 멈춤)

```php
public function handle(Request $request, Closure $next): Response
{
    if (! $request->user()?->isSuspended()) {
        return $next($request);                 // 정상 회원 — 그냥 통과
    }

    Auth::logout();                             // 정지 회원 — 여기서 멈추고 로그아웃
    $request->session()->invalidate();
    $request->session()->regenerateToken();

    if ($request->expectsJson()) {
        return response()->json(['message' => __('member.suspended')], 403)->withCookie(SignedInCookie::forget());
    }

    $locale = $request->route('locale') ?? config('locales.default');

    return redirect()->to(lroute('login', [], $locale))
        ->withErrors(['email' => __('member.suspended', [], $locale)])
        ->withCookie(SignedInCookie::forget());
}
```

등록은 `bootstrap/app.php` 의 `$middleware->web(append: [LogoutSuspended::class])` — 모든 `web` 라우트에 붙는다.

---

## 9. web.php 와 public.php

PES 만의 구조다. 공부할 때 헷갈리기 쉬우니 따로 외운다.

| | `routes/web.php` | `routes/public.php` |
|---|---|---|
| 미들웨어 그룹 | `web` (세션·쿠키·CSRF) | `public` (세션·쿠키 없음, PES 가 만든 그룹) |
| 로그인 정보 | `$request->user()` 쓸 수 있음 | **언제나 `null`** — 세션이 없다 |
| 캐시 | 하지 않음 | Cloudflare 가 캐시 |
| 예 | 로그인, 강사 프로필·시간표 | 홈, 강사 찾기, 서비스 지침 |

공개 페이지가 캐시된 뒤 로그인 상태는 브라우저 JS 가 `/me`(`MeController`)를 불러 받아 간다.

---

## 10. 암기 카드

| 질문 | 답 |
|---|---|
| 라우트 한 줄의 네 부분은? | HTTP 메서드 · URL · 실행할 코드 · 이름 |
| HTML 폼으로 DELETE 를 보내려면? | POST + `@method('DELETE')` |
| 리소스 7개 메서드 이름은? | index · create · store · show · edit · update · destroy |
| `__invoke` 컨트롤러를 라우트에 적는 법은? | `Route::get('/me', MeController::class)` — 배열 없이 클래스만 |
| URL 을 직접 쓰지 않고 만드는 법은? | `route('이름', [매개변수])`, PES 는 `lroute()` |
| `{tutor}` 에 숫자만 받으려면? | `->whereNumber('tutor')` |
| 라우트 모델 바인딩의 위험은? | 남의 데이터도 찾아 준다 → 관계로 찾거나 정책으로 막는다 |
| `throttle:10,1` 의 뜻은? | 1분에 10번 |
| 미들웨어에서 컨트롤러로 넘기는 코드는? | `return $next($request);` |
| `Route::localized` 는 라우트를 몇 번 등록하나? | 두 번 — `/…` 와 `/{locale}/…` |
| `routes/public.php` 에서 `$request->user()` 는? | 언제나 `null` (세션 없음) |
| 라우트 목록 보는 명령은? | `php artisan route:list` (`--path=`, `--name=`, `-v`) |
