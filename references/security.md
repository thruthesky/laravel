# 심화 — 보안 — Laravel 이 대신 막아 주는 것과 내가 막아야 할 것

순수 PHP 로 사이트를 만들 때 직접 챙기던 보안 작업 중 상당수를 Laravel 이 **기본값으로** 해 준다. 문제는 "기본값을 끄는 코드"와 "Laravel 이 알 수 없는 업무 규칙"이다. 이 문서는 그 경계를 공격 종류별로 정리한다. [컨트롤러·검증](controllers.md#3-검증--request-validate)과 [Blade 출력](blade.md#2-출력-세-가지)을 먼저 읽고 오면 좋다.

## 목차

1. [한눈에 보기 — 공격과 방어](#1-한눈에-보기--공격과-방어)
2. [XSS — 화면 출력 이스케이프](#2-xss--화면-출력-이스케이프)
3. [CSRF — @csrf 와 419](#3-csrf--csrf-와-419)
4. [SQL 인젝션 — 바인딩과 칸 이름](#4-sql-인젝션--바인딩과-칸-이름)
5. [대량 할당 — validated() 만 넣는다](#5-대량-할당--validated-만-넣는다)
6. [권한 — 로그인했다고 다 되는 게 아니다](#6-권한--로그인했다고-다-되는-게-아니다)
7. [비밀번호 — Hash](#7-비밀번호--hash)
8. [암호화 — Crypt 와 APP_KEY](#8-암호화--crypt-와-app_key)
9. [로그인 시도 제한 — RateLimiter](#9-로그인-시도-제한--ratelimiter)
10. [서명된 URL — signed](#10-서명된-url--signed)
11. [파일 업로드](#11-파일-업로드)
12. [운영 설정 — APP_DEBUG 와 .env](#12-운영-설정--app_debug-와-env)
13. [보안 헤더 — 미들웨어로](#13-보안-헤더--미들웨어로)
14. [암기 카드](#14-암기-카드)

---

## 1. 한눈에 보기 — 공격과 방어

| 공격 | 순수 PHP 대응 | Laravel 이 해 주는 것 | 내가 할 일 |
|---|---|---|---|
| XSS | `htmlspecialchars()` 를 매번 | `{{ }}` 가 자동 이스케이프 | `{!! !!}` 를 사용자 입력에 쓰지 않기 |
| CSRF | 토큰 만들고 세션과 비교 | `web` 그룹이 POST·PUT·DELETE 를 자동 검사 | 폼마다 `@csrf` |
| SQL 인젝션 | `prepare` + `?` | 쿼리 빌더·Eloquent 가 바인딩 | `whereRaw`·`DB::select` 에 문자열 잇지 않기, 칸 이름은 화이트리스트 |
| 대량 할당 | 칸을 하나씩 대입 | `$fillable`/`#[Fillable]` 밖의 칸은 버림 | `$request->all()` 대신 `validated()` |
| 권한 우회 | `if ($row['user_id'] != $_SESSION['uid'])` | 정책·Gate 틀 | **모든** 조회·수정에 소유자 조건 또는 `Gate::authorize` |
| 비밀번호 유출 | `password_hash` | `Hash`·`hashed` cast | 평문을 로그·세션에 남기지 않기 |
| 무차별 대입 | 직접 카운터 | `throttle` 미들웨어·`RateLimiter` | 로그인·비밀번호 찾기에 걸기 |
| 링크 위조 | HMAC 직접 | 서명된 URL + `signed` 미들웨어 | 메일 링크에 서명 |
| 세션 고정 | `session_regenerate_id(true)` | `session()->regenerate()` | 로그인 직후 호출 |
| 정보 노출 | `display_errors=Off` | `APP_DEBUG` 하나로 | 운영에서 `false` |

---

## 2. XSS — 화면 출력 이스케이프

### 핵심 개념

XSS(교차 사이트 스크립팅)는 사용자가 넣은 `<script>` 가 **다른 사람의 브라우저에서 실행되는** 공격이다. Blade 의 `{{ $x }}` 는 내부에서 `htmlspecialchars()` 를 부르는 `e()` 헬퍼로 출력하므로 기본으로 안전하다.

```blade
{{ $post->title }}       {{-- ✅ <script> 가 &lt;script&gt; 로 나간다 --}}
{!! $post->title !!}     {{-- ❌ 그대로 나간다 — 사용자 입력에는 절대 쓰지 않는다 --}}
```

### 순수 PHP 와 비교

```php
<?= htmlspecialchars($post['title'], ENT_QUOTES, 'UTF-8') ?>   // 매번 잊지 않아야 한다
```

Blade 에서는 "잊으면 안전"(기본 이스케이프), "일부러 `{!! !!}` 를 써야 위험"이 된다. 방향이 뒤집힌 것이 핵심이다.

### 이스케이프로 못 막는 곳

| 위치 | 위험 | 대응 |
|---|---|---|
| `<a href="{{ $url }}">` | `javascript:alert(1)` 은 이스케이프해도 실행된다 | 검증 규칙 `'url:http,https'` 로 스킴을 제한 |
| `<script>var name = '{{ $name }}';</script>` | 따옴표 문맥이 다르다 | `@js($name)` 로 JS 값으로 넘기기 |
| 마크다운·HTML 본문 | 허용한 HTML 안의 `onerror=` | `Str::markdown($text, ['html_input' => 'strip'])` 또는 HTML 정화 라이브러리 |

⚠ `{!! !!}` 가 정당한 경우는 **내가 만든 HTML**(번역 문자열 안의 `<b>`, 서버에서 정화한 본문)뿐이다. 코드 리뷰에서 `{!!` 를 grep 해 하나씩 확인하는 습관을 들인다.

---

## 3. CSRF — @csrf 와 419

### 핵심 개념

CSRF(사이트 간 요청 위조)는 로그인한 사용자가 **악성 사이트를 방문했을 때, 그 사이트가 몰래 우리 사이트로 POST 를 보내게** 하는 공격이다. 브라우저는 쿠키를 자동으로 붙이므로 서버는 진짜 요청과 구별하지 못한다.

Laravel 은 `web` 미들웨어 그룹에서 **POST·PUT·PATCH·DELETE 요청마다 세션의 토큰과 폼의 `_token` 을 비교**한다. 다르면 **419 Page Expired**.

```blade
<form method="POST" action="{{ route('posts.store') }}">
    @csrf                        {{-- <input type="hidden" name="_token" value="…"> --}}
    …
</form>
```

AJAX 는 `<meta name="csrf-token" content="{{ csrf_token() }}">` 를 두고 `X-CSRF-TOKEN` 헤더로 보낸다(axios 는 `XSRF-TOKEN` 쿠키를 자동으로 읽는다).

### 예외 두기 — Laravel 11 이후

옛 튜토리얼의 `app/Http/Middleware/VerifyCsrfToken.php` 의 `$except` 배열은 더 이상 없다. `bootstrap/app.php` 에서 적는다.

```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->validateCsrfTokens(except: [
        'webhooks/stripe',          // 외부 서비스가 POST 하는 주소만
    ]);
})
```

⚠ 예외 주소는 **자체 서명 검증**(웹훅 서명 헤더)을 반드시 한다. "419 가 귀찮아서" 예외에 넣는 것은 방어를 끄는 일이다. 419 가 나는 흔한 원인은 [함정 6](pitfalls.md#6-419-page-expired--405-method-not-allowed)에 있다.

---

## 4. SQL 인젝션 — 바인딩과 칸 이름

### 핵심 개념

쿼리 빌더와 Eloquent 는 **값을 모두 PDO 바인딩(`?`)으로** 보낸다. `where('email', $email)` 은 안전하다. 위험은 **SQL 조각을 직접 쓰는 메서드**에 사용자 입력을 **문자열로 이어 붙일 때** 생긴다.

```php
// ❌ 이어 붙이기
User::whereRaw("name ilike '%{$q}%'")->get();
DB::select("select * from users where email = '$email'");

// ✅ 바인딩 — 두 번째 인자 배열
User::whereRaw('name ilike ?', ['%'.$q.'%'])->get();
DB::select('select * from users where email = ?', [$email]);
```

### 칸 이름은 바인딩이 안 된다

PDO 는 **값**만 바인딩할 수 있고 **칸 이름·정렬 방향**은 바인딩할 수 없다. 그래서 정렬 칸을 사용자에게 받을 때는 **허용 목록**으로 거른다.

```php
// ❌ ?sort=… 를 그대로
Post::orderBy($request->input('sort'))->get();

// ✅ 화이트리스트 (일반 Laravel 예)
$sort = in_array($request->input('sort'), ['created_at', 'title', 'views'], true)
    ? $request->input('sort')
    : 'created_at';
$dir = $request->input('dir') === 'asc' ? 'asc' : 'desc';

Post::orderBy($sort, $dir)->get();
```

`selectRaw`·`orderByRaw`·`havingRaw`·`DB::statement` 도 같은 규칙이다 — 값은 `?` 로, 칸 이름은 코드에 고정. PES 의 원시 SQL 사례는 [eloquent.md 11절](eloquent.md#11-원시-sql-이-필요할-때)에 있다.

---

## 5. 대량 할당 — validated() 만 넣는다

### 핵심 개념

`User::create($request->all())` 에 공격자가 `is_admin=1` 을 끼워 보내면? `#[Fillable]`(또는 `$fillable`) 에 없는 칸은 **버려지므로** 기본적으로 막힌다([eloquent.md 5절](eloquent.md#5-대량-할당-보호--fillable)). 그러나 두 가지가 이 방어를 무너뜨린다.

1. `protected $guarded = [];` — 모든 칸을 열어 버린다.
2. `forceFill($request->all())` — Fillable 을 무시한다.

그래서 **모델에 넣는 것은 검증을 통과한 값만**이라는 규칙을 둔다.

```php
// ❌
$post->update($request->all());

// ✅ 검증한 키만 — validate() 가 돌려준 배열, 또는 FormRequest 의 validated()
$post->update($request->validated());
$post->update($request->safe()->only(['title', 'body']));
```

`validated()` 는 **규칙에 적힌 키만** 돌려준다. 규칙에 없는 `is_admin` 은 애초에 빠진다. 이중 방어(Fillable + validated)가 된다.

---

## 6. 권한 — 로그인했다고 다 되는 게 아니다

### 핵심 개념

`auth` 미들웨어는 "로그인했는가"만 본다. "**이 글의 주인인가**"는 Laravel 이 알 수 없는 업무 규칙이라 내가 적어야 한다. 이것을 빠뜨리면 `/posts/7/edit` 의 숫자만 바꿔 남의 글을 고치는 IDOR(직접 객체 참조) 취약점이 된다.

두 가지 방법이 있다.

```php
// ① 관계로 찾기 — 남의 것은 애초에 404 (PES 가 쓰는 패턴)
$slot = $request->user()->tutorSlots()->findOrFail($id);

// ② 정책으로 묻기 — 찾은 뒤 권한 확인, 아니면 403
$post = Post::findOrFail($id);
Gate::authorize('update', $post);        // PostPolicy::update($user, $post)
```

라우트에 붙이는 방법도 있다: `Route::put('/posts/{post}', …)->can('update', 'post');`. Blade 에서는 `@can('update', $post) … @endcan` 으로 단추를 숨긴다 — ⚠ **단추를 숨기는 것은 방어가 아니다.** 서버에서 반드시 다시 검사한다.

자세히는 [정책 절](controllers.md#10-권한--정책policy)과 [함정 7](pitfalls.md#7-남의-데이터가-보이거나-지워짐).

---

## 7. 비밀번호 — Hash

### 핵심 개념

`Hash` Facade 는 PHP 의 `password_hash()`·`password_verify()` 를 감싼 것이다(기본 bcrypt, 설정으로 argon2id).

```php
use Illuminate\Support\Facades\Hash;

$hash = Hash::make('secret');            // password_hash()
Hash::check('secret', $hash);            // password_verify() → true
Hash::needsRehash($hash);                // 알고리즘·비용이 바뀌었나
```

모델에 `'password' => 'hashed'` cast 를 두면 **대입만 해도 해시된다**(이미 해시된 값은 다시 해시하지 않는다). 로그인은 `Auth::attempt()` 가 `Hash::check()` 를 대신 한다([로그인 절](controllers.md#9-인증--로그인로그아웃)).

### 비밀번호 규칙

```php
use Illuminate\Validation\Rules\Password;

'password' => ['required', 'confirmed', Password::min(10)->letters()->numbers()->uncompromised()],
```

`uncompromised()` 는 유출된 비밀번호 목록(Have I Been Pwned)에 있는지 k-익명성 방식으로 확인한다(비밀번호 자체는 보내지 않는다).

⚠ 비밀번호를 `logger()`·예외 메시지·flash 에 남기지 않는다. `#[Hidden]`(또는 `$hidden`)에 `password` 를 넣어 JSON 으로 나가지 않게 한다.

---

## 8. 암호화 — Crypt 와 APP_KEY

### 핵심 개념

해시는 **되돌릴 수 없고**(비밀번호), 암호화는 **키가 있으면 되돌릴 수 있다**(주민번호·API 토큰처럼 나중에 원문이 필요한 값). Laravel 의 `Crypt` 는 `.env` 의 `APP_KEY` 로 AES-256 암호화하고 변조 방지 MAC 을 붙인다.

```php
use Illuminate\Support\Facades\Crypt;
use Illuminate\Contracts\Encryption\DecryptException;

$enc = Crypt::encryptString('010-1234-5678');
try {
    $plain = Crypt::decryptString($enc);
} catch (DecryptException) {
    // 변조됐거나 다른 APP_KEY 로 암호화된 값
}
```

모델 칸은 cast 로 투명하게: `'phone' => 'encrypted'`, `'meta' => 'encrypted:array'`. DB 에는 암호문이 저장되고 코드에서는 평문처럼 쓴다. ⚠ 암호화된 칸은 `where('phone', …)` 로 **검색할 수 없다**(같은 값도 매번 다른 암호문).

⚠ **APP_KEY 를 바꾸면 기존 암호문·세션·암호화 쿠키가 모두 풀리지 않는다.** 키를 교체해야 하면 옛 키를 `APP_PREVIOUS_KEYS` 에 쉼표로 적어 두면 복호화할 때 차례로 시도한다. `php artisan key:generate` 는 새 프로젝트에서 한 번만 실행한다.

---

## 9. 로그인 시도 제한 — RateLimiter

### 핵심 개념

비밀번호를 무한히 시도하게 두면 무차별 대입 공격에 뚫린다. 간단한 경우는 `throttle:횟수,분` 미들웨어면 된다(PES 로그인 라우트의 `throttle:10,1` — [미들웨어 절](routing.md#6-미들웨어와-그룹)). 이메일별·IP별처럼 **기준을 세밀하게** 정하려면 이름 있는 리미터를 만든다.

### 예제 — 이메일 + IP 로 제한 (일반 Laravel 예)

```php
// app/Providers/AppServiceProvider.php 의 boot()
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

RateLimiter::for('login', function (Request $request) {
    return Limit::perMinute(5)->by(strtolower($request->input('email')).'|'.$request->ip());
});

// routes/web.php
Route::post('/login', [LoginController::class, 'store'])->middleware('throttle:login');
```

제한을 넘으면 **429 Too Many Requests** 가 나가고 `Retry-After` 헤더가 붙는다. 횟수는 캐시에 저장되므로 운영에서는 여러 서버가 공유하는 캐시(Redis·DB)를 쓴다([files-cache.md](files-cache.md#8-캐시-드라이버와-키-설계)).

⚠ IP 만으로 제한하면 한 회사(같은 공인 IP)의 사용자들이 서로를 막는다. 이메일만으로 제한하면 공격자가 남의 계정을 일부러 잠근다. 둘을 조합하는 것이 보통이다.

---

## 10. 서명된 URL — signed

### 핵심 개념

"이 링크를 누르면 수신 거부", "30분 동안만 유효한 다운로드 링크"처럼 **로그인 없이도 위조할 수 없는 링크**가 필요할 때 쓴다. Laravel 이 URL 끝에 `APP_KEY` 로 만든 `signature` 를 붙이고, `signed` 미들웨어가 검사한다. 주소의 한 글자라도 바꾸면 403.

```php
use Illuminate\Support\Facades\URL;

URL::signedRoute('unsubscribe', ['user' => $user->id]);                               // 영구
URL::temporarySignedRoute('invoice.download', now()->addMinutes(30), ['invoice' => 7]);  // 30분

Route::get('/unsubscribe/{user}', UnsubscribeController::class)
    ->name('unsubscribe')
    ->middleware('signed');
```

### 순수 PHP 와 비교

```php
$sig = hash_hmac('sha256', $path.$expires, $secret);   // 만들기
hash_equals($sig, $_GET['signature']);                  // 비교 — 타이밍 공격까지 챙겨야 한다
```

---

## 11. 파일 업로드

### 핵심 개념

업로드는 공격 표면이 가장 넓다 — 확장자를 속인 PHP 파일, 거대한 파일, 경로 조작(`../../`). Laravel 에서 지킬 세 가지:

1. **검증 규칙**으로 종류·크기를 제한한다.
2. **저장 이름은 Laravel 이 만든다** — `store()` 는 `hashName()`(무작위 이름 + 내용으로 추정한 확장자)을 쓴다. 사용자가 보낸 이름(`getClientOriginalName()`)으로 저장하지 않는다.
3. **실행되지 않는 곳에** 둔다 — `storage/app` 은 웹 루트 밖이다. 공개 파일만 `public` 디스크.

```php
$request->validate([
    'photo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],   // max 는 KB 단위
]);

$path = $request->file('photo')->store('photos', 'public');   // photos/aZ3k…9.jpg
```

`mimes` 는 파일 **내용**으로 MIME 을 판별하므로 확장자만 바꾼 파일을 거른다. 저장·공개 URL·`storage:link` 는 [files-cache.md](files-cache.md#3-저장하기--storestoreas) 에서 다룬다.

⚠ SVG 는 이미지지만 `<script>` 를 담을 수 있다. 사용자 업로드에는 허용하지 않거나 정화한다.

---

## 12. 운영 설정 — APP_DEBUG 와 .env

### 핵심 개념

| 설정 | 로컬 | 운영 | 틀리면 |
|---|---|---|---|
| `APP_ENV` | `local` | `production` | 운영에서 위험한 명령(`migrate:fresh` 등)이 확인 없이 돈다 |
| `APP_DEBUG` | `true` | **`false`** | 오류 화면에 스택·쿼리·설정값이 노출된다 |
| `APP_KEY` | 있음 | 있음(로컬과 **다르게**) | 세션·암호화 쿠키 위조 |

`.env` 는 비밀번호 창고다.

- git 에 올리지 않는다(`.gitignore` 에 이미 있다). 공유용은 값을 비운 `.env.example`.
- **웹 서버의 문서 루트는 `public/`** 이어야 한다. 프로젝트 루트를 문서 루트로 잡으면 `https://…/.env` 로 파일이 그대로 내려받아진다.
- 운영에서 `php artisan config:cache` 를 쓰면 `.env` 가 설정 캐시에 녹아든다 — 그래서 코드에서 `env()` 를 직접 부르면 안 된다([함정 1](pitfalls.md#1-env-가-null)).

배포 전 점검 목록은 [deploy.md](deploy.md#4-배포-순서-체크리스트) 에 있다.

---

## 13. 보안 헤더 — 미들웨어로

### 핵심 개념

Laravel 은 `X-Frame-Options`(클릭재킹 방지) 같은 보안 헤더를 기본으로 붙이지 않는다. 웹 서버(Nginx·Caddy) 설정에서 붙이거나, 미들웨어 하나로 붙인다.

### 예제 — 모든 응답에 헤더 (일반 Laravel 예)

```php
// app/Http/Middleware/SecurityHeaders.php — php artisan make:middleware SecurityHeaders
public function handle(Request $request, Closure $next): Response
{
    $response = $next($request);                                          // 컨트롤러를 먼저 실행

    $response->headers->set('X-Frame-Options', 'SAMEORIGIN');            // 남의 iframe 에 못 넣게
    $response->headers->set('X-Content-Type-Options', 'nosniff');         // MIME 추측 금지
    $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

    return $response;
}

// bootstrap/app.php
->withMiddleware(function (Middleware $middleware) {
    $middleware->append(\App\Http\Middleware\SecurityHeaders::class);    // 모든 요청
})
```

`$next($request)` 의 **뒤**에서 일하는 미들웨어다. 앞에서 일하는 PES 의 `SetLocale` 과 비교해 보자([미들웨어 클래스](routing.md#8-미들웨어-클래스-만들기)). HTTPS 강제(`Strict-Transport-Security`)와 CSP(`Content-Security-Policy`)는 사이트 구성에 따라 값이 크게 달라서, 켜기 전에 로컬에서 충분히 시험한다.

---

## 14. 암기 카드

| 질문 | 답 |
|---|---|
| `{{ $x }}` 는 내부에서 무엇을 하나? | `e()` = `htmlspecialchars()` 로 이스케이프 |
| `{!! $x !!}` 를 써도 되는 경우는? | 내가 만들었거나 서버에서 정화한 HTML 뿐 |
| `href` 에 사용자 URL 을 넣을 때 추가로 할 일은? | `url:http,https` 검증으로 `javascript:` 차단 |
| CSRF 검사가 실패하면 나오는 상태 코드는? | 419 |
| Laravel 11+ 에서 CSRF 예외 주소는 어디에 적나? | `bootstrap/app.php` 의 `validateCsrfTokens(except: [...])` |
| `whereRaw` 에 사용자 입력을 넣는 법은? | `?` 자리표시자 + 두 번째 인자 배열 |
| `orderBy($request->sort)` 가 위험한 이유는? | 칸 이름은 바인딩이 안 된다 → 화이트리스트 |
| 모델에 넣을 입력은? | `$request->validated()` (또는 `safe()->only()`) |
| `$guarded = []` 의 뜻은? | 대량 할당 보호를 끈다 |
| 남의 글 수정을 막는 두 방법은? | 관계로 찾기(`$user->posts()->findOrFail`) / `Gate::authorize('update', $post)` |
| `@can` 으로 단추를 숨기면 충분한가? | 아니다 — 서버에서 다시 검사 |
| 비밀번호 해시·확인 메서드는? | `Hash::make()` / `Hash::check()` |
| 해시와 암호화의 차이는? | 되돌릴 수 없음 / 키로 되돌릴 수 있음 |
| `encrypted` cast 칸의 한계는? | `where` 로 검색할 수 없다 |
| APP_KEY 를 바꾸면? | 기존 암호문·세션이 풀리지 않는다 → `APP_PREVIOUS_KEYS` |
| 이름 있는 요청 제한은 어디서 정의하나? | `AppServiceProvider::boot()` 의 `RateLimiter::for()` |
| 위조할 수 없는 링크를 만드는 법은? | `URL::signedRoute()` + `signed` 미들웨어 |
| 업로드 파일의 저장 이름은? | `store()` 가 만드는 `hashName()` — 사용자 파일명 금지 |
| 운영의 `APP_DEBUG` 는? | `false` |
