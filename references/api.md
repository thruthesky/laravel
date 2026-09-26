# 심화 — JSON API 만들기 — api 라우트·API Resource·Sanctum

화면(HTML) 대신 JSON 을 돌려주는 API 를 만드는 법이다. 모바일 앱·다른 서버·자바스크립트가 부르는 주소를 만든다고 생각하면 된다. PES 에는 아직 `routes/api.php` 가 없으므로(SKILL.md 차이표) 대부분 **일반 Laravel 예**로 설명하고, PES 가 이미 JSON 을 내보내는 곳(`MeController`, `bootstrap/app.php` 의 예외 설정)은 PES 코드로 보여 준다.

## 목차

1. [API 는 화면 대신 JSON 을 돌려준다](#1-api-는-화면-대신-json-을-돌려준다)
2. [무엇을 return 하면 JSON 이 되나](#2-무엇을-return-하면-json-이-되나)
3. [routes/api.php 와 install:api](#3-routesapiphp-와-installapi)
4. [Route::apiResource — 화면 없는 리소스 5개](#4-routeapiresource--화면-없는-리소스-5개)
5. [API Resource — 모델을 JSON 모양으로 바꾸는 클래스](#5-api-resource--모델을-json-모양으로-바꾸는-클래스)
6. [검증 실패·404 도 JSON 으로 — Accept 헤더](#6-검증-실패404-도-json-으로--accept-헤더)
7. [상태 코드 표](#7-상태-코드-표)
8. [Sanctum — 토큰으로 로그인](#8-sanctum--토큰으로-로그인)
9. [속도 제한](#9-속도-제한)
10. [API 테스트](#10-api-테스트)
11. [curl 로 직접 불러 보기](#11-curl-로-직접-불러-보기)
12. [암기 카드](#12-암기-카드)

---

## 1. API 는 화면 대신 JSON 을 돌려준다

### 핵심 개념

웹 화면 요청과 API 요청은 **같은 라우트 → 컨트롤러 → 모델 흐름**을 탄다([lifecycle.md](lifecycle.md#1-요청-한-바퀴)). 다른 것은 두 가지뿐이다.

| | 웹 화면 | API |
|---|---|---|
| 응답 | `view()` 로 HTML, 저장 뒤 `redirect()` | JSON + 상태 코드 |
| 로그인 기억 | 세션 쿠키 (`web` 그룹) | 요청마다 토큰(`Authorization: Bearer …`) |
| CSRF | `@csrf` 필요 | 필요 없음(쿠키를 안 쓰므로) |
| 검증 실패 | 이전 페이지로 되돌아감 + `$errors` | `422` + `{"errors": …}` |

API 에는 "이전 페이지"도 "flash 메시지"도 없다. 성공·실패를 **상태 코드**로 말하고, 내용은 JSON 본문에 담는다.

### 순수 PHP 와 비교

```php
// 순수 PHP
header('Content-Type: application/json; charset=utf-8');
http_response_code(201);
echo json_encode(['id' => $id, 'title' => $title], JSON_UNESCAPED_UNICODE);
exit;

// Laravel — 헤더·인코딩·상태 코드를 한 줄에
return response()->json(['id' => $id, 'title' => $title], 201);
```

`json_encode` 를 직접 부르지 않는다. `echo` 도, `exit` 도 없다 — 컨트롤러는 응답 객체를 `return` 한다.

### PES 코드 — `app/Http/Controllers/MeController.php` (이미 JSON 을 돌려주는 곳)

```php
public function __invoke(Request $request): JsonResponse
{
    return response()
        ->json([
            'user' => $request->user()?->only(['id', 'name']),
            'csrf' => csrf_token(),
        ])
        ->header('Cache-Control', 'no-store');
}
```

캐시된 공개 페이지가 뜬 뒤, 자바스크립트가 이 주소를 불러 로그인 상태를 받아 간다([routing.md](routing.md#2-라우트--코드-연결-네-가지)). `routes/web.php` 에 있어도 JSON 을 돌려줄 수 있다 — "API" 는 파일 이름이 아니라 **응답 모양**의 문제다.

---

## 2. 무엇을 return 하면 JSON 이 되나

### 핵심 개념

컨트롤러가 돌려준 값을 Laravel 이 응답으로 바꿀 때, **배열·모델·Collection 은 자동으로 JSON** 이 된다.

```php
// 일반 Laravel 예
return ['ok' => true];                      // 배열 → {"ok":true}
return Post::find(1);                       // 모델 → {"id":1,"title":…}
return Post::latest()->take(10)->get();     // Collection → [{…},{…}]
return response()->json($data, 201);        // 상태 코드·헤더를 직접 정할 때
return response()->noContent();             // 204 — 본문 없음(삭제 성공 등)
```

- 모델을 JSON 으로 바꿀 때 `#[Hidden]`(또는 `$hidden`)에 적은 칸은 빠진다([eloquent.md](eloquent.md#5-대량-할당-보호--fillable)). 비밀번호가 새지 않는 이유다.
- `casts` 가 붙은 칸은 cast 된 모양으로 나간다 — `date` 는 ISO 8601 문자열, `array` 는 JSON 배열([eloquent.md](eloquent.md#6-casts-와-기본값)).
- 방금 `create()` 한 모델을 그대로 돌려주면 상태 코드가 자동으로 **201** 이 된다(`wasRecentlyCreated` 가 `true` 라서).

### ⚠ 모델을 그대로 돌려주면 생기는 일

모델을 통째로 `return` 하면 **테이블의 모든 칸**이 나간다. 나중에 칸을 추가하면 그 칸도 말없이 API 에 실린다. 내부 칸(`admin_note`, `score` …)이 새기 쉽다. 학습용·내부용이 아니면 5절의 **API Resource** 로 내보낼 칸을 정해 둔다.

---

## 3. routes/api.php 와 install:api

### 핵심 개념

Laravel 11 부터 새 프로젝트에는 `routes/api.php` 가 **없다**. 필요할 때 명령 하나로 추가한다.

```bash
php artisan install:api
```

이 명령이 하는 일:

1. `routes/api.php` 를 만든다.
2. `bootstrap/app.php` 의 `->withRouting()` 에 `api: __DIR__.'/../routes/api.php'` 를 더한다.
3. **Sanctum** 패키지를 설치하고, 토큰 테이블(`personal_access_tokens`) 마이그레이션을 만든다(8절).

`routes/api.php` 의 라우트에는 두 가지가 자동으로 붙는다.

| 자동으로 붙는 것 | 뜻 |
|---|---|
| URL 앞 `/api` | `Route::get('/posts', …)` → 실제 주소는 `/api/posts` |
| `api` 미들웨어 그룹 | 세션·쿠키·CSRF **없음**. 라우트 모델 바인딩(`SubstituteBindings`)만 |

그래서 API 라우트에서는 `auth` 대신 `auth:sanctum` 을 쓴다 — 세션이 없으니 "세션으로 로그인 확인"이 동작하지 않는다.

### 예제 — 기본 `routes/api.php` (일반 Laravel 예)

```php
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();                 // 토큰 주인(User 모델) → JSON
})->middleware('auth:sanctum');
```

### PES 와 비교

PES 는 `web.php`(세션 있음)와 `public.php`(캐시용, 세션 없음)만 있다([routing.md](routing.md#9-webphp-와-publicphp)). 그런데 `bootstrap/app.php` 에는 이미 API 를 대비한 설정이 있다(6절).

---

## 4. Route::apiResource — 화면 없는 리소스 5개

### 핵심 개념

`Route::resource` 는 7개 메서드를 만든다([routing.md](routing.md#3-메서드-이름-관례--리소스-7개)). 그중 `create`(입력 폼 화면)·`edit`(수정 폼 화면)는 HTML 화면용이라 API 에는 필요 없다. `Route::apiResource` 는 **그 둘을 뺀 5개**만 만든다.

```php
// 일반 Laravel 예 — routes/api.php
Route::apiResource('posts', PostController::class);
```

| HTTP | URL | 메서드 | 하는 일 | 성공 코드 |
|---|---|---|---|---|
| GET | `/api/posts` | `index` | 목록 | 200 |
| POST | `/api/posts` | `store` | 만들기 | 201 |
| GET | `/api/posts/{post}` | `show` | 하나 보기 | 200 |
| PUT/PATCH | `/api/posts/{post}` | `update` | 고치기 | 200 |
| DELETE | `/api/posts/{post}` | `destroy` | 지우기 | 204 |

컨트롤러는 `php artisan make:controller PostController --api` 로 5개 메서드가 든 채로 만든다(연습 프로젝트에서).

### 예제 — API 컨트롤러 (일반 Laravel 예)

```php
class PostController extends Controller
{
    public function index()
    {
        return PostResource::collection(Post::latest()->paginate(20));
    }

    public function store(StorePostRequest $request)
    {
        $post = $request->user()->posts()->create($request->validated());
        return new PostResource($post);          // 방금 만든 모델 → 201
    }

    public function show(Post $post)             // 라우트 모델 바인딩 — 없으면 404 JSON
    {
        return new PostResource($post->load('user'));
    }

    public function update(UpdatePostRequest $request, Post $post)
    {
        Gate::authorize('update', $post);        // 남의 글이면 403
        $post->update($request->validated());
        return new PostResource($post);
    }

    public function destroy(Post $post)
    {
        Gate::authorize('delete', $post);
        $post->delete();
        return response()->noContent();          // 204
    }
}
```

웹 컨트롤러와 비교하면 `redirect()` 와 `with('status', …)` 자리에 **Resource 와 상태 코드**가 들어간 것뿐이다. 검증(FormRequest)·권한(정책)은 똑같다([controllers.md](controllers.md#5-formrequest--검증을-클래스로), [controllers.md](controllers.md#10-권한--정책policy)).

---

## 5. API Resource — 모델을 JSON 모양으로 바꾸는 클래스

### 핵심 개념

API Resource 는 **"이 모델을 JSON 으로 내보낼 때 어떤 칸을 어떤 이름으로"** 를 정하는 클래스다. 뷰가 HTML 모양을 정하듯, Resource 는 JSON 모양을 정한다. DB 칸 이름을 바꿔도 API 모양은 그대로 둘 수 있다 — 앱을 쓰는 쪽이 깨지지 않는다.

```bash
php artisan make:resource PostResource     # app/Http/Resources/PostResource.php
```

### 순수 PHP 와 비교

```php
// 순수 PHP — 내보낼 칸을 손으로 고른다
$out = array_map(fn ($row) => [
    'id'    => (int) $row['id'],
    'title' => $row['title'],
    'date'  => date(DATE_ATOM, strtotime($row['created_at'])),
], $rows);
echo json_encode(['data' => $out]);

// Laravel — 그 "고르기" 를 클래스 하나에 모아 두고 어디서나 재사용
return PostResource::collection($posts);
```

### 예제 — `app/Http/Resources/PostResource.php` (일반 Laravel 예)

```php
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,                         // $this 는 감싼 모델처럼 쓴다
            'title'      => $this->title,
            'excerpt'    => str($this->body)->limit(100),
            'author'     => new UserResource($this->whenLoaded('user')),   // with('user') 했을 때만
            'comments_count' => $this->whenCounted('comments'),            // withCount 했을 때만
            'admin_note' => $this->when($request->user()?->isAdmin(), $this->admin_note),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
```

| 쓰는 곳 | 코드 | 결과 |
|---|---|---|
| 하나 | `new PostResource($post)` | `{"data": {…}}` |
| 여러 개 | `PostResource::collection($posts)` | `{"data": [{…}, {…}]}` |
| 페이지 | `PostResource::collection(Post::paginate(20))` | `{"data": [...], "links": {...}, "meta": {...}}` |

- **`whenLoaded('user')`** — 관계를 미리 불러왔을 때만 넣는다. Resource 안에서 `$this->user` 를 그냥 쓰면 목록 20개에 쿼리 20번, 즉 **N+1** 이 된다([pitfalls.md](pitfalls.md#3-목록-화면이-느림--n1)). 컨트롤러에서 `with('user')` 를 했을 때만 실리게 하는 장치다.
- **`when(조건, 값)`** — 조건이 거짓이면 그 키가 **아예 빠진다**(`null` 이 아니라).
- 결과가 `data` 키로 한 번 감싸진다. 감싸지 않으려면 `AppServiceProvider::boot()` 에서 `JsonResource::withoutWrapping();`.

### 페이지 나누기 JSON 모양

```json
{
  "data": [ { "id": 41, "title": "…" }, { "id": 40, "title": "…" } ],
  "links": { "first": "…?page=1", "last": "…?page=3", "prev": null, "next": "…?page=2" },
  "meta":  { "current_page": 1, "last_page": 3, "per_page": 20, "total": 57, "path": "…" }
}
```

앱은 `links.next` 가 `null` 이 될 때까지 다음 페이지를 부르면 된다. `simplePaginate()` 를 쓰면 `total`·`last_page` 가 없다([eloquent.md](eloquent.md#13-페이지-나누기)).

---

## 6. 검증 실패·404 도 JSON 으로 — Accept 헤더

### 핵심 개념

`validate()` 와 FormRequest 는 **요청이 JSON 을 원하는지**를 보고 실패 응답을 고른다([controllers.md](controllers.md#3-검증--request-validate)). 판단 기준은 `$request->expectsJson()` — 주로 요청 헤더 **`Accept: application/json`** 이다.

```json
// 422 Unprocessable Content — 검증 실패 (JSON 요청일 때)
{
  "message": "The title field is required.",
  "errors": {
    "title": ["The title field is required."]
  }
}
```

`findOrFail()`·라우트 모델 바인딩의 404, `Gate::authorize()` 의 403, `abort(404)` 도 JSON 요청이면 `{"message": "…"}` 로 나간다.

### ⚠ Accept 헤더를 빼먹으면

`routes/api.php` 의 주소라도 앱이 `Accept: application/json` 을 보내지 않으면, 검증 실패 때 Laravel 은 "폼 요청"으로 보고 **302 redirect** 를 돌려준다. 앱 개발자는 "API 가 HTML 을 준다", "로그인 페이지로 튕긴다"고 느낀다. 해결은 둘 중 하나다.

1. 부르는 쪽이 항상 `Accept: application/json` 을 보낸다.
2. 서버가 "이 경로는 무조건 JSON" 이라고 정한다 — PES 가 이미 해 둔 방법이다.

### PES 코드 — `bootstrap/app.php` (발췌)

```php
->withExceptions(function (Exceptions $exceptions): void {
    $exceptions->shouldRenderJsonWhen(
        fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
    );
})
```

`/api/…` 주소이거나 JSON 을 원하는 요청이면, 헤더가 없어도 예외를 JSON 으로 그린다([lifecycle.md](lifecycle.md#2-bootstrapappphp--앱-조립)). 나중에 `routes/api.php` 를 더해도 오류 모양이 처음부터 맞다.

### ⚠ 운영에서는 APP_DEBUG=false

`APP_DEBUG=true` 이면 500 오류 JSON 에 **예외 메시지·파일 경로·스택**이 실린다. 운영 서버에서는 반드시 끈다([deploy.md](deploy.md)).

---

## 7. 상태 코드 표

API 는 상태 코드로 말한다. 앱 개발자는 본문보다 코드를 먼저 본다.

| 코드 | 뜻 | Laravel 에서 나오는 곳 |
|---|---|---|
| **200** OK | 성공 | 배열·모델·Resource 를 `return` |
| **201** Created | 만들었다 | 방금 `create()` 한 모델·Resource, 또는 `response()->json($x, 201)` |
| **204** No Content | 성공, 본문 없음 | `response()->noContent()` — 주로 삭제 |
| **401** Unauthorized | 누구인지 모른다(로그인 안 함·토큰 틀림) | `auth:sanctum` 통과 실패 |
| **403** Forbidden | 누구인지는 알지만 권한이 없다 | `Gate::authorize()`·정책 실패, `abort(403)` |
| **404** Not Found | 없다 | `findOrFail()`, 라우트 모델 바인딩, `abort(404)` |
| **405** Method Not Allowed | 주소는 있는데 메서드가 틀림 | GET 만 있는 주소에 POST |
| **422** Unprocessable Content | 입력이 틀렸다 | `validate()`·FormRequest 실패 |
| **429** Too Many Requests | 너무 자주 불렀다 | `throttle` 미들웨어(9절) |
| **500** Server Error | 서버 코드 오류 | 잡히지 않은 예외 |

**401 과 403 을 헷갈리지 않는다.** 401 = "당신 누구세요?" → 다시 로그인. 403 = "당신인 건 알지만 안 됩니다" → 다시 로그인해도 소용없다.

---

## 8. Sanctum — 토큰으로 로그인

### 핵심 개념

웹은 로그인하면 세션 쿠키가 생기고 브라우저가 알아서 보낸다. 모바일 앱·다른 서버는 쿠키를 쓰지 않으므로 **토큰**(긴 비밀 문자열)을 받아 두었다가 요청마다 헤더에 싣는다. 이렇게 `Authorization` 헤더에 싣는 토큰을 **Bearer 토큰**이라 부른다.

```
Authorization: Bearer 3|kR8x…pQ2
```

Sanctum 은 Laravel 공식 패키지로, 이 토큰을 DB(`personal_access_tokens` 테이블)에 **해시로** 저장하고 요청마다 확인한다. `install:api` 가 함께 설치한다.

### 순수 PHP 와 비교

```php
// 순수 PHP — 직접 짜면
$token = bin2hex(random_bytes(40));
$pdo->prepare('INSERT INTO api_tokens (user_id, token_hash) VALUES (?, ?)')
    ->execute([$userId, hash('sha256', $token)]);
// 요청마다: 헤더에서 꺼내 → 해시 → 조회 → 사용자 찾기 … 를 모든 API 에서

// Laravel Sanctum
$token = $user->createToken('iphone')->plainTextToken;   // 발급
Route::middleware('auth:sanctum')->group(…);             // 확인
```

### 예제 — 토큰 발급·사용·폐기 (일반 Laravel 예)

```php
// app/Models/User.php
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;
}
```

```php
// routes/api.php — 이메일·비밀번호를 받아 토큰을 준다
Route::post('/tokens', function (Request $request) {
    $request->validate([
        'email' => ['required', 'email'],
        'password' => ['required'],
        'device' => ['required', 'string', 'max:100'],
    ]);

    $user = User::where('email', $request->email)->first();
    if (! $user || ! Hash::check($request->password, $user->password)) {
        throw ValidationException::withMessages(['email' => '이메일 또는 비밀번호가 틀렸습니다.']);
    }

    return ['token' => $user->createToken($request->device)->plainTextToken];
})->middleware('throttle:10,1');

// 토큰이 있어야 하는 주소
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', fn (Request $request) => $request->user());
    Route::apiResource('posts', PostController::class);

    // 지금 쓰는 토큰만 폐기(로그아웃)
    Route::delete('/tokens/current', function (Request $request) {
        $request->user()->currentAccessToken()->delete();
        return response()->noContent();
    });
});
```

- **`plainTextToken` 은 발급할 때 한 번만 볼 수 있다.** DB 에는 해시만 있다. 앱이 잃어버리면 새로 발급한다.
- 토큰에 권한 범위를 줄 수 있다 — `createToken('bot', ['posts:read'])`, 확인은 `$request->user()->tokenCan('posts:read')`.
- 모든 기기에서 로그아웃: `$user->tokens()->delete()`.

### SPA 쿠키 인증 (개념만)

같은 도메인의 자바스크립트 화면(SPA)은 토큰 대신 **Sanctum 의 쿠키 방식**을 쓸 수 있다 — 브라우저는 세션 쿠키를 쓰고, 서버는 `api` 경로에서도 세션을 인정한다. `bootstrap/app.php` 의 `$middleware->statefulApi()` 와 CORS·도메인 설정이 필요하다. 모바일 앱이면 토큰, 같은 사이트의 화면이면 쿠키 — 이렇게만 기억하고, 실제 설정은 공식 문서(Sanctum → SPA Authentication)를 따른다.

---

## 9. 속도 제한

### 핵심 개념

API 는 사람이 아니라 프로그램이 부르므로 1초에 수백 번도 부를 수 있다. **`throttle` 미들웨어**가 정해진 횟수를 넘으면 `429` 를 돌려준다. PES 는 로그인에 이미 쓰고 있다 — `->middleware('throttle:10,1')`(1분에 10번, [routing.md](routing.md#6-미들웨어와-그룹)).

```php
// 일반 Laravel 예 — 라우트 몇 개에만
Route::middleware(['auth:sanctum', 'throttle:60,1'])->group(function () {
    Route::apiResource('posts', PostController::class);
});
```

사용자별로 다르게 제한하려면 이름 붙인 제한을 만든다.

```php
// app/Providers/AppServiceProvider.php 의 boot()
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

RateLimiter::for('api', function (Request $request) {
    return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
});

// 라우트에서
Route::middleware('throttle:api')->group(…);
```

- 로그인한 사용자는 사용자 id 로, 아니면 IP 로 센다.
- 응답 헤더 `X-RateLimit-Limit`·`X-RateLimit-Remaining` 으로 남은 횟수가 나가고, 넘으면 `Retry-After` 가 붙는다.
- 횟수는 **캐시**에 센다. 서버가 여러 대면 캐시가 공유(Redis 등)돼야 제한이 맞는다([files-cache.md](files-cache.md)).
- `routes/api.php` 전체에 한 번에 걸고 싶으면 `bootstrap/app.php` 의 `->withMiddleware()` 에서 `$middleware->throttleApi();` 를 쓴다 — 쓰기 전에 공식 문서(Rate Limiting)로 확인한다.

---

## 10. API 테스트

### 핵심 개념

웹 테스트의 `get()`·`post()` 에 대응하는 **`getJson()`·`postJson()`·`putJson()`·`deleteJson()`** 이 있다([testing.md](testing.md#4-http-요청-보내기)). 이 메서드들은 `Accept: application/json` 을 **자동으로** 붙인다 — 6절의 함정이 테스트에서는 생기지 않는다.

### 예제 — `tests/Feature/PostApiTest.php` (일반 Laravel 예, Pest)

```php
use App\Models\Post;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

it('목록을 페이지로 준다', function () {
    Post::factory()->count(25)->create();

    $this->getJson('/api/posts')
        ->assertOk()
        ->assertJsonCount(20, 'data')
        ->assertJsonPath('meta.total', 25);
});

it('로그인 없이 만들면 401', function () {
    $this->postJson('/api/posts', ['title' => '제목'])->assertUnauthorized();
});

it('제목이 없으면 422 와 errors.title', function () {
    Sanctum::actingAs(User::factory()->create());

    $this->postJson('/api/posts', ['body' => '본문만'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['title']);
});

it('만들면 201 과 data.title', function () {
    Sanctum::actingAs($user = User::factory()->create());

    $this->postJson('/api/posts', ['title' => '첫 글', 'body' => '안녕'])
        ->assertCreated()
        ->assertJsonPath('data.title', '첫 글');

    expect($user->posts()->count())->toBe(1);
});

it('남의 글은 지울 수 없다', function () {
    Sanctum::actingAs(User::factory()->create());
    $post = Post::factory()->create();          // 다른 사람의 글

    $this->deleteJson("/api/posts/{$post->id}")->assertForbidden();
});
```

| 검사 | 뜻 |
|---|---|
| `assertJson([...])` | 응답 JSON 이 이 부분을 **포함**하는가(나머지 칸은 있어도 됨) |
| `assertJsonPath('data.title', '첫 글')` | 점 경로의 값 하나 |
| `assertJsonCount(20, 'data')` | 배열 길이 |
| `assertJsonValidationErrors(['title'])` | 422 의 `errors` 에 그 칸이 있는가 |
| `assertCreated()`·`assertNoContent()`·`assertUnauthorized()`·`assertForbidden()`·`assertUnprocessable()` | 201·204·401·403·422 |

`Sanctum::actingAs($user)` 는 웹 테스트의 `actingAs()` 에 해당한다 — 토큰을 실제로 발급하지 않고 "이 사용자의 토큰으로 부른 것"으로 친다.

---

## 11. curl 로 직접 불러 보기

브라우저 주소창은 GET 만 보내고 헤더를 못 붙인다. API 는 `curl` 로 확인한다(연습 프로젝트에서 `php artisan serve` 를 띄운 뒤).

```bash
# 토큰 받기
curl -X POST http://127.0.0.1:8000/api/tokens \
  -H 'Accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{"email":"a@example.com","password":"secret","device":"curl"}'
# → {"token":"1|kR8x…"}

# 토큰으로 글 만들기 — -i 는 상태 코드·헤더까지 보여 준다
curl -i -X POST http://127.0.0.1:8000/api/posts \
  -H 'Accept: application/json' \
  -H 'Authorization: Bearer 1|kR8x…' \
  -H 'Content-Type: application/json' \
  -d '{"title":"첫 글","body":"안녕"}'
# → HTTP/1.1 201 Created

# Accept 를 빼고 검증 실패를 일으켜 보기 — 302 가 나오는지 확인(6절 함정)
curl -i -X POST http://127.0.0.1:8000/api/posts -H 'Authorization: Bearer 1|kR8x…' -d 'body=x'
```

`php artisan route:list --path=api` 로 API 주소 목록과 붙은 미들웨어를 본다([artisan.md](artisan.md#3-스스로-조사하는-명령)).

---

## 12. 암기 카드

| 질문 | 답 |
|---|---|
| 컨트롤러가 배열·모델·Collection 을 `return` 하면? | 자동으로 JSON 응답 |
| 상태 코드를 직접 정해 JSON 을 보내는 법은? | `response()->json($data, 201)` |
| 본문 없는 성공 응답(삭제)은? | `response()->noContent()` → 204 |
| 새 Laravel 11+ 프로젝트에 `routes/api.php` 를 만드는 명령은? | `php artisan install:api` |
| `routes/api.php` 라우트에 자동으로 붙는 것 두 가지는? | URL 앞 `/api`, 세션·CSRF 없는 `api` 미들웨어 그룹 |
| `Route::resource` 와 `Route::apiResource` 의 차이는? | apiResource 는 화면용 `create`·`edit` 를 뺀 5개 |
| 모델을 JSON 으로 내보낼 칸·이름을 정하는 클래스는? | API Resource (`make:resource`, `toArray()`) |
| Resource 여러 개를 감싸는 법은? | `PostResource::collection($posts)` |
| 관계를 미리 불러왔을 때만 넣는 메서드는? | `$this->whenLoaded('user')` — N+1 방지 |
| 페이지 JSON 의 세 키는? | `data`·`links`·`meta` |
| API 인데 검증 실패 때 302 redirect 가 오는 이유는? | 요청에 `Accept: application/json` 이 없어서 |
| 401 과 403 의 차이는? | 401 = 누구인지 모름(로그인·토큰), 403 = 알지만 권한 없음 |
| Sanctum 토큰 발급 코드는? | `$user->createToken('이름')->plainTextToken` |
| `plainTextToken` 을 다시 볼 수 있나? | 없다 — DB 에는 해시만. 잃으면 새로 발급 |
| 토큰이 필요한 라우트에 거는 미들웨어는? | `auth:sanctum` |
| 너무 자주 부르면 나오는 코드와 미들웨어는? | 429, `throttle` |
| JSON 요청 테스트 메서드는? | `getJson`·`postJson`·`putJson`·`deleteJson` (Accept 자동) |
| 422 의 errors 에 칸이 있는지 검사하는 법은? | `assertJsonValidationErrors(['title'])` |
