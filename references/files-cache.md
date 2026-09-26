# 심화 — 파일 업로드·저장소와 캐시

프로필 사진을 받거나, 무거운 목록을 몇 분씩 기억해 두어야 할 때 읽는다. 먼저 [controllers.md](controllers.md#2-request--입력-읽기)(입력 읽기)와 [lifecycle.md](lifecycle.md#6-env--config--config)(설정 흐름)를 알고 있어야 한다.

두 주제를 한 문서에 둔 이유는 같다. **둘 다 "어디에 둘지(드라이버)"를 코드에서 떼어 내 설정으로 옮긴 것**이다. 코드는 `Storage::put()`·`Cache::put()` 만 부르고, 로컬 폴더인지 S3 인지, 파일인지 Redis 인지는 `.env` 가 정한다.

## 목차

1. [업로드 받기 — $request->file()](#1-업로드-받기--request-file)
2. [업로드 검증 규칙](#2-업로드-검증-규칙)
3. [저장하기 — store·storeAs](#3-저장하기--storestoreas)
4. [디스크와 Storage 파사드](#4-디스크와-storage-파사드)
5. [storage:link — 공개 URL 만들기](#5-storagelink--공개-url-만들기)
6. [내려받기와 지우기](#6-내려받기와-지우기)
7. [캐시 — Cache::remember](#7-캐시--cacheremember)
8. [캐시 드라이버와 키 설계](#8-캐시-드라이버와-키-설계)
9. [무효화 — 언제 지우나](#9-무효화--언제-지우나)
10. [Cache::lock — 동시에 한 번만](#10-cachelock--동시에-한-번만)
11. [HTTP 캐시와 앱 캐시 — 이름은 같고 층이 다르다](#11-http-캐시와-앱-캐시--이름은-같고-층이-다르다)
12. [암기 카드](#12-암기-카드)

---

## 1. 업로드 받기 — $request->file()

### 핵심 개념

업로드된 파일은 `$request->file('photo')` 로 받는다. 돌아오는 것은 배열이 아니라 `UploadedFile` **객체**다. 원래 이름·확장자·크기·임시 경로를 메서드로 묻고, 저장도 그 객체에게 시킨다.

### 순수 PHP 와 비교

```php
// 순수 PHP — $_FILES 배열을 직접 뒤진다
if (isset($_FILES['photo']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK) {
    $ext  = pathinfo($_FILES['photo']['name'], PATHINFO_EXTENSION);   // ⚠ 사용자가 보낸 이름을 믿음
    $name = bin2hex(random_bytes(16)) . '.' . $ext;
    move_uploaded_file($_FILES['photo']['tmp_name'], __DIR__ . '/uploads/' . $name);
}

// Laravel — 객체에게 묻고 시킨다
if ($request->hasFile('photo') && $request->file('photo')->isValid()) {
    $path = $request->file('photo')->store('avatars', 'public');      // "avatars/무작위이름.jpg"
}
```

### UploadedFile 에게 물을 수 있는 것

| 메서드 | 돌려주는 것 | 믿어도 되나 |
|---|---|---|
| `getClientOriginalName()` | 사용자가 보낸 파일 이름 | ❌ 아무 글자나 올 수 있다. 화면 표시용으로만 |
| `getClientOriginalExtension()` | 사용자가 보낸 확장자 | ❌ `.jpg` 라고 붙인 PHP 파일일 수 있다 |
| `extension()` | 파일 **내용**으로 추측한 확장자 | ⭕ 저장 이름에 쓴다 |
| `getSize()` | 바이트 | ⭕ |
| `hashName()` | 무작위 40자 + 내용 기반 확장자 | ⭕ `store()` 가 쓰는 이름 |
| `isValid()` | 업로드가 오류 없이 끝났나 | ⭕ |

> ⚠ `hasFile()` 은 "필드가 있고 파일이 왔다"만 본다. 용량 초과로 PHP 가 업로드를 버리면 `isValid()` 가 `false` 다. 보통은 이것까지 직접 부르지 않고 **검증 규칙**(다음 절)에 맡긴다.

---

## 2. 업로드 검증 규칙

### 핵심 개념

파일도 다른 입력처럼 `validate()`·FormRequest 로 검사한다. 규칙 문법은 [controllers.md](controllers.md#4-검증-규칙-문법)와 같다. 파일에서 자주 쓰는 규칙은 다섯 개다.

| 규칙 | 뜻 | ⚠ 주의 |
|---|---|---|
| `file` | 업로드된 파일이어야 한다 | |
| `image` | jpg·jpeg·png·bmp·gif·webp 등 이미지 | SVG 는 기본으로 허용되지 않는다(스크립트를 품을 수 있다) |
| `mimes:jpg,png,pdf` | 확장자가 아니라 **내용**으로 판단한 형식 | 확장자만 바꾼 파일은 걸린다 |
| `max:2048` | 최대 크기 — **킬로바이트** | 2MB 는 `2048`. 숫자 규칙과 같은 `max` 인데 단위가 다르다 |
| `dimensions:min_width=200,max_width=2000` | 이미지 가로·세로 | |

### 예제 — 문자열 규칙과 규칙 객체 (일반 Laravel 예)

```php
use Illuminate\Validation\Rules\File;

$request->validate([
    // 문자열로 — 짧고 익숙하다
    'photo'  => ['required', 'image', 'max:2048', 'dimensions:min_width=200,min_height=200'],

    // 규칙 객체로 — 자동 완성이 되고 읽기 쉽다
    'resume' => ['nullable', File::types(['pdf', 'docx'])->max(5 * 1024)],   // 5MB (단위 KB)
    'avatar' => ['required', File::image()->max(2 * 1024)],
]);
```

> ⚠ PHP 자체의 한도(`php.ini` 의 `upload_max_filesize`·`post_max_size`)가 `max:` 보다 작으면, 파일은 Laravel 에 오기도 전에 버려진다. 증상은 "검증 오류 메시지 없이 파일이 비어 있음"이다. 서버 한도를 먼저 확인한다.

---

## 3. 저장하기 — store·storeAs

### 핵심 개념

`store(폴더, 디스크)` 는 **이름을 알아서 짓고**(`hashName()`), 그 디스크의 폴더에 넣고, **디스크 안의 상대 경로**를 돌려준다. DB 에는 이 경로(`avatars/abc….jpg`)를 저장한다. 전체 URL 이나 서버 절대 경로를 저장하지 않는다 — 디스크를 S3 로 바꾸는 순간 틀린 값이 되기 때문이다.

### 예제 — 저장 세 가지 (일반 Laravel 예)

```php
$file = $request->file('photo');

$path = $file->store('avatars', 'public');                 // 이름 자동: avatars/Xk2…9.jpg
$path = $file->storeAs('avatars', "user-{$user->id}.jpg", 'public');   // 이름 직접
$path = Storage::disk('public')->putFile('avatars', $file);            // 파사드로 — store() 와 같다

$user->forceFill(['avatar_path' => $path])->save();        // DB 에는 "디스크 안 경로"만
```

| 쓰는 것 | 이름 | 같은 이름이 있으면 |
|---|---|---|
| `store()` | 무작위 — 겹칠 일이 사실상 없다 | — |
| `storeAs()` | 내가 정함 | **덮어쓴다** ⚠ |

> **왜 기본이 무작위 이름인가** — 사용자가 보낸 이름에는 `../`, 한글·공백, 같은 이름 충돌, 추측 가능한 URL 같은 문제가 다 들어 있다. 무작위 이름 하나로 전부 피한다. 원래 이름이 필요하면 DB 에 따로 저장해 화면에만 보여 준다.

---

## 4. 디스크와 Storage 파사드

### 핵심 개념

**디스크** = "파일을 둘 곳 하나에 붙인 이름"이다. `config/filesystems.php` 에 정의한다.

| 디스크 | 실제 위치 | 웹에서 바로 보이나 |
|---|---|---|
| `local` | `storage/app/private` (Laravel 11+ 골격 기준) | ❌ — 컨트롤러를 거쳐 내려준다 |
| `public` | `storage/app/public` | ⭕ — `storage:link` 뒤 `/storage/…` 로 |
| `s3` | Amazon S3·호환 저장소 | 버킷 설정에 따라 |

> 버전에 따라 `local` 디스크의 폴더가 다를 수 있다 — 지금 프로젝트의 `config/filesystems.php` 를 열어 확인한다.

### 순수 PHP 와 비교

```php
// 순수 PHP — 저장 위치가 코드에 박힌다
file_put_contents(__DIR__ . '/uploads/report.txt', $text);
// 나중에 S3 로 옮기려면 이런 줄을 전부 찾아 AWS SDK 호출로 바꿔야 한다

// Laravel — 코드는 디스크 이름만 안다
Storage::disk('public')->put('reports/report.txt', $text);
// S3 로 옮길 때는 설정(디스크 정의·.env)만 바꾼다
```

### 예제 — Storage 로 자주 하는 일 (일반 Laravel 예)

```php
use Illuminate\Support\Facades\Storage;

$disk = Storage::disk('public');

$disk->put('notes/a.txt', '내용');           // 쓰기 (있으면 덮어씀)
$disk->get('notes/a.txt');                   // 읽기 → 문자열
$disk->exists('notes/a.txt');                // 있나?
$disk->delete('notes/a.txt');                // 지우기 (배열로 여러 개도)
$disk->url('avatars/x.jpg');                 // 공개 URL → /storage/avatars/x.jpg
$disk->files('avatars');                     // 폴더 안 파일 목록

Storage::put('private/memo.txt', '비밀');     // disk() 를 빼면 기본 디스크(FILESYSTEM_DISK)
```

`temporaryUrl()` 은 **기한이 있는 서명 URL**이다(예: 5분 뒤 만료). 비공개 파일을 잠깐 보여 줄 때 쓴다. S3 처럼 지원하는 드라이버에서 동작한다.

```php
$url = Storage::disk('s3')->temporaryUrl('contracts/42.pdf', now()->addMinutes(5));
```

### PES 코드 — 디스크를 설정에서 읽는다

PES 는 디스크 이름을 코드에 박지 않고 `config/tutor.php` 에 둔다([lifecycle.md](lifecycle.md#6-env--config--config) 6절).

```php
// config/tutor.php (발췌)
'disk' => env('TUTOR_DISK', 'public'),       // env() 는 config 파일 안에서만

// 코드에서는
config('tutor.disk')
```

로컬에서는 `public`, 운영에서는 `.env` 의 `TUTOR_DISK` 를 바꿔 다른 디스크로 옮길 수 있다. 코드 한 줄 고치지 않는다. 그리고 [controllers.md](controllers.md#8-저장-패턴) 8절의 `ProfileController::update` 는 사진 저장을 `TutorMedia::storePhoto($request->file('photo'), $user->id)` 한 줄에 맡긴다. 저장 방법을 한곳에 모아 두면 컨트롤러는 "저장해라"만 말하면 된다.

---

## 5. storage:link — 공개 URL 만들기

### 핵심 개념

웹 서버가 파일을 내주는 곳은 `public/` 폴더뿐이다. `public` 디스크의 실제 위치는 `storage/app/public` 이라서 그대로는 브라우저가 열 수 없다. 그래서 **심볼릭 링크**로 잇는다.

```bash
php artisan storage:link
# public/storage  →  storage/app/public  링크가 생긴다
```

```
브라우저  /storage/avatars/x.jpg
   ↓ 웹 서버가 public/ 에서 찾는다
public/storage/avatars/x.jpg   (링크)
   ↓
storage/app/public/avatars/x.jpg   (실제 파일)
```

> ⚠ **배포에서 가장 많이 빠뜨리는 명령**이다. 증상은 "업로드는 되는데 사진이 404"다. 링크는 git 에 올라가지 않는다(`public/storage` 는 `.gitignore` 에 있다). 새 서버나 새 컨테이너마다 한 번씩 만든다. [deploy.md](deploy.md#4-배포-순서-체크리스트) 의 체크리스트에도 있다.

**왜 처음부터 `public/` 에 저장하지 않나** — `public/` 은 코드 배포 때 통째로 바뀌는 폴더다. 사용자가 올린 파일은 배포와 상관없이 남아야 하므로 `storage/` 에 두고 링크만 건다.

---

## 6. 내려받기와 지우기

### 예제 — 비공개 파일을 권한 검사 뒤 내려주기 (일반 Laravel 예)

```php
public function download(Request $request, Invoice $invoice)
{
    Gate::authorize('view', $invoice);                               // 남의 청구서는 403

    return Storage::disk('local')->download($invoice->pdf_path, "청구서-{$invoice->id}.pdf");
}

// 서버의 임의 경로 파일이라면
return response()->download(storage_path('exports/today.csv'));
```

`local` 디스크의 파일은 URL 이 없다. 그래서 **컨트롤러를 거쳐야만** 내려받을 수 있고, 그 사이에 정책([controllers.md](controllers.md#10-권한--정책policy) 10절)을 끼울 수 있다. 계약서·신분증처럼 남이 보면 안 되는 파일은 `public` 디스크에 두지 않는다.

### 사진을 바꿀 때 옛 파일 지우기

```php
$old = $user->avatar_path;
$user->forceFill(['avatar_path' => $request->file('photo')->store('avatars', 'public')])->save();

if ($old) {
    Storage::disk('public')->delete($old);        // DB 저장이 끝난 뒤에 지운다
}
```

> ⚠ 순서가 중요하다. 먼저 지우고 DB 저장이 실패하면 사진이 사라진다. **새 것 저장 → DB 반영 → 옛 것 삭제**.

### 테스트에서는 가짜 디스크

```php
Storage::fake('public');                                   // 진짜 폴더 대신 임시 가짜
$this->post('/avatar', ['photo' => UploadedFile::fake()->image('me.jpg')]);
Storage::disk('public')->assertExists($user->fresh()->avatar_path);
```

`Storage::fake()` 가 되는 이유는 Storage 가 정적 클래스가 아니라 Facade 이기 때문이다([lifecycle.md](lifecycle.md#5-facade--정적-호출처럼-보이는-객체-호출) 5절).

---

## 7. 캐시 — Cache::remember

### 핵심 개념

**캐시** = 만들기 비싼 값을 잠깐 기억해 두는 곳이다. 가장 많이 쓰는 모양은 `Cache::remember(키, 유효 시간, 만드는 함수)` 하나다. "키에 값이 있으면 그것을, 없으면 함수를 실행해 저장하고 그 값을" 돌려준다.

### 순수 PHP 와 비교

```php
// 순수 PHP — 파일 캐시를 직접 짠다
$file = __DIR__ . '/cache/top_tutors.json';
if (is_file($file) && filemtime($file) > time() - 600) {
    $top = json_decode(file_get_contents($file), true);
} else {
    $top = $pdo->query('SELECT ... ORDER BY score DESC LIMIT 10')->fetchAll();
    file_put_contents($file, json_encode($top), LOCK_EX);
}

// Laravel — 한 줄. 저장 위치는 설정이 정한다
$top = Cache::remember('tutors.top', now()->addMinutes(10), fn () => TutorProfile::visible()->ranked()->limit(10)->get());
```

### 예제 — Cache 로 자주 하는 일 (일반 Laravel 예)

```php
use Illuminate\Support\Facades\Cache;

Cache::put('key', $value, 600);              // 600초 저장 (Carbon 시각도 된다)
Cache::get('key');                           // 없으면 null
Cache::get('key', 'default');                // 없으면 기본값
Cache::has('key');
Cache::forget('key');                        // 지우기
Cache::increment('visits');                  // 숫자 더하기

Cache::remember('stats', 300, fn () => 무거운_계산());     // 없으면 만들고 300초
Cache::rememberForever('countries', fn () => Country::all());  // 지울 때까지
```

> ⚠ 유효 시간 숫자는 **초**다. 옛 튜토리얼(Laravel 5.7 이전)은 분이었다. 헷갈리면 `now()->addMinutes(10)` 처럼 시각으로 적는다.

`Cache::flexible('key', [300, 600], fn () => …)` 는 "300초까지는 신선, 600초까지는 옛 값을 주면서 뒤에서 새로 만든다"이다. 인기 페이지에서 캐시가 만료되는 순간 요청이 한꺼번에 DB 로 몰리는 것을 줄인다.

> `flexible()` 은 Laravel 11 후반에 들어온 메서드다. Laravel 13 소스(`Illuminate/Cache/Repository.php`)에서 확인했다. 오래된 프로젝트라면 버전을 먼저 본다.

---

## 8. 캐시 드라이버와 키 설계

### 핵심 개념

어디에 저장할지는 `.env` 의 `CACHE_STORE` 가 정한다(`config/cache.php`). 옛 튜토리얼의 `CACHE_DRIVER` 는 Laravel 11 에서 이름이 바뀌었다.

| 드라이버 | 저장 위치 | 언제 |
|---|---|---|
| `database` | `cache` 테이블 | Laravel 11+ 새 골격의 기본값. 따로 설치할 것이 없다 |
| `file` | `storage/framework/cache` | 서버 한 대 |
| `redis` | Redis | 서버 여러 대·빠른 속도·태그 필요 |
| `array` | 메모리(요청 한 번) | 테스트 |

### 키 설계

```php
// ❌ 키가 겹친다 — 사용자마다 다른 값인데 키가 하나
Cache::remember('dashboard', 300, fn () => $user->stats());

// ✅ 값이 달라지는 조건을 전부 키에 넣는다
Cache::remember("dashboard.user.{$user->id}.{$locale}", 300, fn () => $user->stats());
```

키에 **무엇이 달라지면 값이 달라지는지**(사용자·언어·페이지 번호·필터)를 모두 넣는다. 하나라도 빠지면 남의 화면이 보인다.

### 캐시 태그 ⚠

```php
Cache::tags(['tutors'])->put("tutor.{$id}", $data, 600);
Cache::tags(['tutors'])->flush();            // tutors 태그 전부 지우기
```

태그는 `redis`·`memcached` 등 **일부 드라이버만** 지원한다. `file`·`database` 에서 부르면 예외가 난다. 로컬(file)에서 개발하고 운영(redis)에 올리는 구성이면 로컬에서 바로 터지므로, 태그 대신 "키 이름 규칙 + 개별 `forget`"을 먼저 고려한다.

---

## 9. 무효화 — 언제 지우나

### 핵심 개념

캐시에서 어려운 것은 저장이 아니라 **지우는 때**다. 원본이 바뀌었을 때 옛 값을 지우는 일을 **캐시 무효화**라고 한다. 방법은 둘이다.

1. **짧은 유효 시간** — 5분 늦게 보여도 되는 값(순위·통계)은 그냥 만료되게 둔다. 가장 단순하다.
2. **바뀔 때 지우기** — 늦으면 안 되는 값(내 설정·가격)은 저장하는 순간 `forget()` 한다.

### 예제 — 모델 이벤트에서 지우기 (일반 Laravel 예)

```php
// app/Models/TutorProfile.php (일반 예 — PES 코드 아님)
protected static function booted(): void
{
    static::saved(fn (TutorProfile $p) => Cache::forget("tutor.card.{$p->user_id}"));
    static::deleted(fn (TutorProfile $p) => Cache::forget("tutor.card.{$p->user_id}"));
}
```

모델 이벤트는 [eloquent.md](eloquent.md#10-모델-이벤트) 10절에서 봤다. 여기서도 같은 함정이 있다 — **쿼리 빌더의 `update()` 는 모델 이벤트를 건너뛴다**([pitfalls.md](pitfalls.md#11-완성도-점수가-안-바뀜--모델-이벤트-건너뜀) 11번). 그러면 캐시가 지워지지 않고 옛 값이 계속 보인다.

---

## 10. Cache::lock — 동시에 한 번만

### 핵심 개념

같은 작업을 두 요청이 동시에 하면 안 될 때(하루 한 번 정산, 같은 자리 두 번 예약) **잠금**을 건다. 캐시 저장소를 "누가 먼저 잡았나" 판정하는 곳으로 쓰는 것이다. 서버가 여러 대여도 같은 캐시(Redis·DB)를 보므로 동작한다. `flock()` 은 서버 한 대 안에서만 통한다.

### 예제 — 잠그고 일하기 (일반 Laravel 예)

```php
$lock = Cache::lock("payout.{$tutorId}", 10);    // 10초 뒤 자동으로 풀린다(프로세스가 죽어도)

if ($lock->get()) {
    try {
        정산하기($tutorId);
    } finally {
        $lock->release();                         // 끝나면 반드시 푼다
    }
} else {
    return back()->withErrors(['payout' => '이미 처리 중입니다.']);
}

// 더 짧게 — 함수가 끝나면 자동으로 푼다
Cache::lock("report.daily", 60)->get(fn () => 일일_보고서());

// 최대 5초 기다렸다가 잡기 (못 잡으면 LockTimeoutException)
Cache::lock("seat.{$slotId}", 10)->block(5, fn () => 예약하기($slotId));
```

> 잠금은 "동시에 들어오지 마라"만 막는다. 데이터가 틀어지지 않게 하는 마지막 방어선은 DB 의 unique 제약과 트랜잭션이다([transactions.md](transactions.md#10-db-제약이-최후-방어선)).

---

## 11. HTTP 캐시와 앱 캐시 — 이름은 같고 층이 다르다

| | 앱 캐시 (`Cache::`) | HTTP 캐시 (PES `public.php`) |
|---|---|---|
| 무엇을 | 값 하나(쿼리 결과·계산 결과) | **응답 페이지 통째** |
| 어디에 | 서버 쪽 저장소(DB·Redis·파일) | 서버 앞(Cloudflare)·브라우저 |
| 누가 판단 | 내 코드 | 응답 헤더(`Cache-Control`) |
| 요청이 Laravel 까지 오나 | 온다 — 캐시에서 값만 빨리 꺼낸다 | 캐시에 있으면 **오지도 않는다** |

PES 의 `routes/public.php` 라우트는 두 번째 방식이다([routing.md](routing.md#9-webphp-와-publicphp) 9절). 세션·쿠키를 빼고 `CachePublicPage` 미들웨어로 캐시 헤더를 붙여, Cloudflare 가 페이지를 통째로 들고 있게 한다. 그래서 그 라우트에서는 `$request->user()` 가 늘 `null` 이다 — 모든 사람에게 같은 페이지를 줘야 캐시할 수 있기 때문이다.

### 캐시 비우기 명령 — 무엇을 지우나

| 명령 | 지우는 것 |
|---|---|
| `php artisan cache:clear` | **앱 캐시**(`Cache::` 로 넣은 값 전부) |
| `php artisan config:clear` · `route:clear` · `view:clear` | 굳혀 둔 설정·라우트·뷰 |
| `php artisan optimize:clear` | 위 전부 + 앱 캐시 |

> ⚠ 운영에서 `cache:clear`·`optimize:clear` 를 치면 앱 캐시가 한꺼번에 비어 모든 요청이 DB 로 몰린다. "설정이 안 바뀐다"면 `config:clear` 처럼 필요한 것만 비운다. 캐시 명령은 [artisan.md](artisan.md#5-캐시-명령) 5절.

---

## 12. 암기 카드

| 질문 | 답 |
|---|---|
| 업로드 파일을 받는 메서드와 돌려주는 타입은? | `$request->file('photo')` → `UploadedFile` 객체 |
| 저장 이름에 `getClientOriginalExtension()` 을 쓰면 안 되는 이유는? | 사용자가 보낸 값이라 위조 가능. `extension()`·`hashName()` 을 쓴다 |
| 검증 규칙 `max:2048` 의 단위는(파일일 때)? | 킬로바이트 — 2MB |
| `store('avatars', 'public')` 이 돌려주는 것은? | 디스크 안 상대 경로 `avatars/무작위.jpg` |
| DB 에 무엇을 저장하나? | 디스크 안 경로. 전체 URL·절대 경로는 저장하지 않는다 |
| `store()` 와 `storeAs()` 의 차이는? | 이름 자동(무작위) / 이름 직접 — 같은 이름이면 덮어씀 |
| 디스크를 정의하는 파일은? | `config/filesystems.php` |
| `public` 디스크 파일이 404 일 때 먼저 할 것은? | `php artisan storage:link` — `public/storage` 링크 |
| 남이 보면 안 되는 파일은 어느 디스크에? | `local`(비공개) — 컨트롤러에서 권한 검사 후 `download()` |
| 기한 있는 비공개 URL 은? | `Storage::disk('s3')->temporaryUrl($path, now()->addMinutes(5))` |
| 테스트에서 진짜 폴더 대신 쓰는 것은? | `Storage::fake('public')` + `UploadedFile::fake()->image()` |
| 없으면 만들고 있으면 꺼내는 캐시 메서드는? | `Cache::remember(키, 초, fn)` |
| 캐시 유효 시간 숫자의 단위는? | 초 |
| 캐시 저장소를 고르는 `.env` 키는? | `CACHE_STORE` (옛 이름 `CACHE_DRIVER`) |
| `Cache::tags()` 를 `file`·`database` 드라이버에서 쓰면? | 예외 — 태그는 redis 등 일부만 |
| 저장할 때 캐시를 지우는 곳은? | 모델 이벤트 `saved`·`deleted` 에서 `Cache::forget()` |
| 두 요청이 동시에 같은 일을 못 하게 하려면? | `Cache::lock(키, 초)->get(fn)` |
| `cache:clear` 와 `config:clear` 의 차이는? | 앱 캐시 값 / 굳힌 설정 파일 |
