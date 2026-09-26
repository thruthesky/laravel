# 3단계 — 컨트롤러·요청·검증·응답·인증

## 목차

1. [컨트롤러의 역할](#1-컨트롤러의-역할)
2. [Request — 입력 읽기](#2-request--입력-읽기)
3. [검증 — $request->validate()](#3-검증--request-validate)
4. [검증 규칙 문법](#4-검증-규칙-문법)
5. [FormRequest — 검증을 클래스로](#5-formrequest--검증을-클래스로)
6. [응답 — view·redirect·json](#6-응답--viewredirectjson)
7. [flash 세션 — 한 번만 보이는 메시지](#7-flash-세션--한-번만-보이는-메시지)
8. [저장 패턴](#8-저장-패턴)
9. [인증 — 로그인·로그아웃](#9-인증--로그인로그아웃)
10. [권한 — 정책(Policy)](#10-권한--정책policy)
11. [암기 카드](#11-암기-카드)

---

## 1. 컨트롤러의 역할

### 핵심 개념

컨트롤러는 **요청을 받아 → 검증하고 → 모델에 일을 시키고 → 응답을 돌려주는** 얇은 층이다. 계산이 길어지면 모델이나 별도 클래스(PES 의 `app/Tutor/Ranking.php`, `ProfileScore.php`)로 옮긴다.

### 순수 PHP 와 비교

| 순수 PHP | Laravel 컨트롤러 |
|---|---|
| `$_GET['q']`, `$_POST['email']` | `$request->input('q')`, `$request->string('q')` |
| `$_FILES['photo']` | `$request->file('photo')` |
| `$_SESSION['user_id']` | `$request->user()` |
| `if (!filter_var($email, ...)) $errors[] = ...` | `$request->validate(['email' => ['required', 'email']])` |
| `header('Location: /x'); exit;` | `return redirect()->to('/x');` |
| `echo json_encode($data)` | `return response()->json($data);` |
| `http_response_code(404); exit;` | `abort(404);` 또는 `findOrFail()` |

---

## 2. Request — 입력 읽기

GET 쿼리·POST 본문·JSON 본문을 구분하지 않고 같은 메서드로 읽는다.

```php
$request->input('name');               // 문자열|null
$request->input('name', '기본값');
$request->string('q')->trim()->toString();   // Stringable → 체이닝 후 문자열
$request->integer('weekday');          // int (없으면 0)
$request->boolean('trial_enabled');    // "1","true","on","yes" → true, 없으면 false
$request->has('q') / $request->filled('q')   // 있나 / 비어 있지 않나
$request->only(['email', 'password']);
$request->hasFile('photo');  $request->file('photo');
$request->user();                      // 로그인한 User 모델 또는 null
$request->route('locale');             // URL 매개변수
$request->session();                   // 세션
$request->expectsJson();               // JS 가 JSON 을 원하나
```

### PES 코드 — `TutorListController::index` (쿼리 문자열 읽기)

```php
$keyword = $request->string('q')->trim()->toString();
$language = $request->string('language')->toString();
$language = isset(config('locales.locales')[$language]) ? $language : '';   // 허용 목록에 없으면 버림
```

### PES 코드 — 체크박스는 `boolean()` (`ScheduleController::updateTrial`)

```php
$enabled = $request->boolean('trial_enabled');   // 체크를 풀면 칸 자체가 안 오므로 false
```

---

## 3. 검증 — $request->validate()

### 핵심 개념

`validate()` 는 **통과하면 검증된 값 배열을 돌려주고, 실패하면 예외를 던진다.** 예외를 Laravel 이 잡아서 자동으로 처리하므로 `if` 로 실패 분기를 쓰지 않는다.

```
실패 시 자동으로 일어나는 일
 ├─ 일반 폼 요청 → 이전 페이지로 redirect
 │                 + 오류 메시지를 세션에 → 뷰의 $errors
 │                 + 입력값을 세션에 → 뷰의 old('칸')
 └─ JSON 요청   → 422 응답 + {"message": ..., "errors": {...}}
```

### PES 코드 — `ScheduleController::storeDayOff`

```php
public function storeDayOff(Request $request): RedirectResponse
{
    $user = $request->user();
    $data = $request->validate([
        'date' => [
            'required', 'date', 'after_or_equal:'.now($user->timezone)->toDateString(),
            Rule::unique('tutor_days_off')->where('tutor_id', $user->id),   // 같은 강사의 같은 날짜 중복 금지
        ],
    ], [], ['date' => __('tutor.field_day_off')]);
    //  ↑ 2번째: 오류 문장 바꾸기(없음)  ↑ 3번째: 오류에 보일 칸 이름

    $user->tutorDaysOff()->create($data);   // $data 에는 검증한 칸(date)만 들어 있다

    return $this->saved();
}
```

**핵심 로직**: `validate()` 가 돌려준 `$data` 에는 **규칙에 적은 칸만** 있다. 사용자가 몰래 `tutor_id=999` 를 보내도 `$data` 에 들어오지 않는다.

### PES 코드 — 한 줄로 검증하고 저장 (`updateTimezone`)

```php
$request->user()->update($request->validate(['timezone' => ['required', 'timezone:all']]));
```

---

## 4. 검증 규칙 문법

규칙은 문자열 `'required|email'` 이나 배열 `['required', 'email']` 로 적는다. PES 는 배열을 쓴다(객체 규칙 `Rule::unique()` 를 섞을 수 있어서).

| 규칙 | 뜻 |
|---|---|
| `required` / `nullable` | 필수 / 비어도 됨(null 허용) |
| `string` · `integer` · `boolean` · `array` | 타입 |
| `email` · `date` · `date_format:H:i` · `timezone:all` | 형식 |
| `min:1` · `max:120` · `between:0,6` | 크기 (문자열이면 글자 수, 숫자면 값, 파일이면 KB) |
| `multiple_of:5` | 배수 |
| `in:paypal,gcash` | 목록 중 하나 (`Rule::in([...])`) |
| `after_or_equal:2026-09-26` | 날짜 비교 |
| `unique:users,email` | 테이블에 없어야 (`Rule::unique('t')->where(...)`) |
| `exists:users,id` | 테이블에 있어야 |
| `confirmed` | `password_confirmation` 칸과 같아야 |
| `file` · `image` · `mimes:mp4` · `max:5120` | 파일 |

오류 문장은 `lang/{언어}/validation.php` 에서 찾고, 없으면 Laravel 기본 파일(`vendor/laravel/framework/src/Illuminate/Translation/lang/en/validation.php`, 영어)을 쓴다. 2026-09-26 현재 PES 에는 `lang/*/validation.php` 가 없어서 **문장은 영어로 나오고, 칸 이름만** `attributes()`·`validate()` 3번째 인자로 번역된다. 문장까지 번역하려면 `php artisan lang:publish` 로 기본 파일을 꺼내 17개 언어로 옮긴다.

---

## 5. FormRequest — 검증을 클래스로

### 핵심 개념

규칙이 길거나 추가 검사가 필요하면 `app/Http/Requests/` 에 클래스로 옮긴다. 컨트롤러 인자 타입으로 적으면 **메서드가 불리기 전에** 검증이 끝난다.

| 메서드 | 역할 |
|---|---|
| `rules()` | 규칙 배열 |
| `authorize()` | 이 요청을 해도 되나 (없으면 허용) |
| `after()` | 규칙이 끝난 뒤 추가 검사 (DB 조회 등) |
| `attributes()` | 오류에 보일 칸 이름 |
| `messages()` | 오류 문장 바꾸기 |

### PES 코드 — `app/Http/Requests/StoreTutorSlotRequest.php`

```php
class StoreTutorSlotRequest extends FormRequest
{
    public function rules(): array
    {
        $minutes = config('tutor.slot_minutes');   // 숫자는 설정에서

        return [
            'weekday' => ['required', 'integer', 'between:0,6'],
            'starts_at' => ['required', 'date_format:H:i'],
            'duration_minutes' => ['required', 'integer', "between:{$minutes['min']},{$minutes['max']}", "multiple_of:{$minutes['step']}"],
            'points' => ['required', 'integer', 'min:1'],
        ];
    }

    /** 이미 있는 수업 시간과 겹치면 안 된다. */
    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;                                    // 기본 규칙에서 이미 틀렸으면 DB 를 보지 않는다
            }
            $user = $this->user();

            if (TutorSlot::overlapsFor($user->id, $this->integer('weekday'), $this->input('starts_at'), $this->integer('duration_minutes'))) {
                $validator->errors()->add('starts_at', __('tutor.slot_overlaps'));
            }
        }];
    }

    public function attributes(): array
    {
        return [
            'weekday' => __('tutor.field_weekday'),
            'starts_at' => __('tutor.field_starts_at'),
            // …
        ];
    }
}
```

컨트롤러에서 받는 법:

```php
public function storeSlot(StoreTutorSlotRequest $request): RedirectResponse
{
    $data = $request->validated();                    // 검증된 칸 전부
    $request->user()->tutorSlots()->create($data);
    return $this->saved();
}

// 일부만 빼고 싶을 때 (ProfileController::update)
$profile->fill($request->safe()->except(['photo', 'video']));
```

---

## 6. 응답 — view·redirect·json

```php
return view('tutor.schedule', ['slots' => $slots]);      // 화면
return view('tutor.index', compact('tutors', 'keyword')); // compact = ['tutors' => $tutors, ...]

return redirect()->to(lroute('tutor.schedule'));         // URL 로 이동
return redirect()->route('home');                        // 라우트 이름으로 이동
return back();                                           // 이전 페이지로
return redirect()->intended(lroute('home'));             // 로그인 전에 가려던 곳, 없으면 기본값

return response()->json(['user' => ...]);                // JSON
return response()->json(['message' => '...'], 403);      // 상태 코드와 함께

abort(404);                                              // 즉시 오류 응답
```

redirect 에 붙이는 것:

```php
->with('status', __('tutor.saved'))          // flash 메시지 (다음 요청 한 번)
->withErrors(['email' => __('member.failed')])  // $errors 에 넣기
->onlyInput('email')                          // old() 로 email 만 되살림 (비밀번호는 빼고)
->withInput()                                 // 입력값 전부 되살림
->withCookie($cookie)                         // 쿠키
```

### PES 코드 — 같은 redirect 를 private 메서드로 (`ScheduleController`)

```php
/** 저장한 뒤에는 보고 있던 언어의 시간표 화면으로 */
private function saved(): RedirectResponse
{
    return redirect()->to(lroute('tutor.schedule'))->with('status', __('tutor.saved'));
}
```

### PES 코드 — 조건 검사 후 오류와 함께 되돌리기 (`updateTrial`)

```php
$enabled = $request->boolean('trial_enabled');
if ($enabled && ! $profile->isEscrow()) {
    return back()->withErrors(['trial_enabled' => __('tutor.trial_needs_escrow')]);
}
```

---

## 7. flash 세션 — 한 번만 보이는 메시지

### 핵심 개념

"저장했습니다" 같은 메시지는 **redirect 뒤 다음 요청에서 한 번만** 보여야 한다. `->with('status', ...)` 는 세션에 넣되, 다음 요청이 끝나면 지워지게 표시한다.

```
POST /tutor/schedule/slots  → 저장 → redirect ... ->with('status', '저장했습니다')
GET  /tutor/schedule        → 뷰: session('status') = '저장했습니다'   ← 여기서 보이고
GET  /tutor/schedule (새로고침) → session('status') = null              ← 사라진다
```

뷰에서 보여 주기 (`resources/views/tutor/schedule.blade.php`):

```blade
@if (session('status'))
    <p class="form-status" role="status">{{ session('status') }}</p>
@endif
```

순수 PHP 로 하면 `$_SESSION['flash'] = ...; ... echo $_SESSION['flash']; unset($_SESSION['flash']);` 를 직접 짜야 하는 일이다.

---

## 8. 저장 패턴

### 있으면 고치고 없으면 새로 — `firstOrNew` + `fill` + `save` (`ProfileController::update`)

```php
$user = $request->user();
$profile = $user->tutorProfile()->firstOrNew();        // 있으면 가져오고, 없으면 새 객체(아직 DB 에 없음, user_id 는 채워짐)
$profile->fill($request->safe()->except(['photo', 'video']));   // Fillable 칸만 채움

if ($request->hasFile('photo')) {
    $profile->photo_path = TutorMedia::storePhoto($request->file('photo'), $user->id);   // 속성 직접 대입은 Fillable 과 상관없음
}

$profile->save();   // INSERT 또는 UPDATE — profile_score 는 모델 이벤트가 다시 계산 (eloquent.md 9절)
```

### Fillable 이 아닌 칸을 일부러 바꾸기 — `forceFill` (`updateTrial`)

```php
$profile->forceFill(['trial_enabled' => $enabled])->save();
```

`trial_enabled` 는 `#[Fillable]` 에 없다. 사용자가 프로필 폼에 `trial_enabled=1` 을 끼워 보내도 `fill()` 이 버린다. 이 칸은 에스크로·별점 검사를 거친 `updateTrial` 만 `forceFill` 로 바꾼다 — **"누가 이 칸을 바꿀 수 있나"를 Fillable 로 통제**하는 패턴이다.

---

## 9. 인증 — 로그인·로그아웃

### PES 코드 — `app/Http/Controllers/Auth/LoginController.php`

```php
public function store(Request $request): RedirectResponse
{
    $credentials = $request->validate([
        'email' => ['required', 'email'],
        'password' => ['required', 'string'],
    ]);

    // users 에서 email 로 찾고 password_verify 로 비교, 맞으면 로그인. 2번째 인자 = 로그인 유지
    if (! Auth::attempt($credentials, $request->boolean('remember'))) {
        return back()->withErrors(['email' => __('member.failed')])->onlyInput('email');
    }

    if (Auth::user()->isSuspended()) {        // 정지된 회원은 비밀번호가 맞아도 들여보내지 않는다
        Auth::logout();
        return back()->withErrors(['email' => __('member.suspended')])->onlyInput('email');
    }

    $request->session()->regenerate();        // 세션 고정 공격 방지 — 로그인하면 세션 id 를 바꾼다

    return redirect()->intended(lroute('home'))->withCookie(SignedInCookie::make());
}

public function destroy(Request $request): RedirectResponse
{
    Auth::logout();
    $request->session()->invalidate();        // 세션 데이터 전부 버림
    $request->session()->regenerateToken();   // CSRF 토큰 새로

    return redirect()->to(lroute('home'))->withCookie(SignedInCookie::forget());
}
```

| 코드 | 순수 PHP 로는 |
|---|---|
| `Auth::attempt($credentials)` | SELECT + `password_verify` + `$_SESSION['user_id'] = ...` |
| `Auth::user()` / `$request->user()` | `$_SESSION['user_id']` 로 SELECT |
| `$request->session()->regenerate()` | `session_regenerate_id(true)` |
| `Auth::logout()` | `unset($_SESSION['user_id'])` |

비밀번호 저장은 `User` 모델의 `'password' => 'hashed'` cast 가 자동으로 해시한다([eloquent.md 6절](eloquent.md#6-casts-와-기본값)).

---

## 10. 권한 — 정책(Policy)

### 핵심 개념

"로그인했나"는 `auth` 미들웨어, **"이 사람이 이 데이터에 이 일을 해도 되나"는 정책**이 맡는다. `app/Policies/{모델}Policy.php` 로 이름을 지으면 Laravel 이 모델과 자동으로 짝짓는다.

### PES 코드 — `app/Policies/TutorProfilePolicy.php`

```php
class TutorProfilePolicy
{
    public function viewAny(User $user): bool          // 목록을 볼 수 있나
    {
        return $user->hasRole(Role::Admin);
    }

    public function view(User $user, TutorProfile $profile): bool   // 이 하나를 볼 수 있나
    {
        return $user->hasRole(Role::Admin);
    }
}
```

PES 에서 이 정책은 **Filament 관리 화면이 자동으로** 부른다. 컨트롤러·뷰에서 직접 쓰는 법:

```php
Gate::authorize('view', $profile);         // 안 되면 403 예외
$request->user()->can('view', $profile);   // true/false
```

```blade
@can('view', $profile) ... @endcan
```

Laravel 11+ 기본 `Controller` 는 빈 클래스라 옛 튜토리얼의 `$this->authorize()` 가 없다. `Gate::authorize()` 를 쓴다.

---

## 11. 암기 카드

| 질문 | 답 |
|---|---|
| 체크박스 값을 읽는 메서드는? | `$request->boolean('칸')` — 체크 해제면 칸이 안 와서 false |
| `validate()` 가 실패하면? | 예외 → 이전 페이지로, `$errors`·`old()` 가 채워짐 (JSON 이면 422) |
| `validate()` 가 돌려주는 값은? | 규칙에 적은 칸만 담은 배열 |
| `validate()` 의 3번째 인자는? | 오류 메시지에 보일 칸 이름 |
| FormRequest 에서 DB 를 보는 추가 검사는 어디에? | `after()` |
| FormRequest 에서 검증된 값을 받는 법은? | `$request->validated()`, 일부 제외는 `$request->safe()->except([...])` |
| "저장했습니다"를 다음 화면에 한 번 보이려면? | `redirect(...)->with('status', ...)` + 뷰의 `session('status')` |
| 로그인 전에 가려던 곳으로 보내는 redirect 는? | `redirect()->intended($기본값)` |
| 로그인 직후 꼭 하는 일은? | `$request->session()->regenerate()` |
| Fillable 이 아닌 칸을 일부러 바꾸려면? | `forceFill([...])->save()` |
| "이 데이터에 이 일을 해도 되나"는 어디에? | 정책 `app/Policies/{모델}Policy.php` |
| Laravel 11+ 에서 `$this->authorize()` 대신? | `Gate::authorize('ability', $model)` |
