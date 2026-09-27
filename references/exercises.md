# 퀴즈·실습

## 목차

1. [퀴즈 진행 절차](#1-퀴즈-진행-절차)
2. [문제 은행](#2-문제-은행)
3. [tinker 조회 실습](#3-tinker-조회-실습)
4. [연습 프로젝트 — 미니 게시판](#4-연습-프로젝트--미니-게시판)

---

## 1. 퀴즈 진행 절차

1. 사용자가 고른 단계(없으면 지금 공부 중인 단계)에서 **3~5문제**를 고른다. 개념 문제와 코드 읽기 문제를 섞는다.
2. **정답을 함께 보여 주지 않는다.** 문제만 내고 사용자의 답을 기다린다.
3. 코드 읽기 문제를 내기 전에 그 PES 파일을 다시 읽는다. 코드가 바뀌었으면 지금 코드로 문제를 고친다.
4. 채점: 문제마다 ⭕·🔺(부분)·❌ 와 한두 문장 해설. 틀린 문제는 관련 참조 문서의 절을 링크한다.
5. 마지막에 점수와 "다시 볼 곳" 목록. 🔺·❌ 가 절반 이상이면 그 단계를 한 번 더 권한다.
6. 문제 은행에 없는 문제를 만들어도 된다 — 단, PES 실제 코드나 Laravel 13 동작으로 확인한 것만.

각 참조 문서 끝의 "암기 카드" 표도 빠른 문답 퀴즈로 쓴다(질문만 보여 주고 답을 받는다).

---

## 2. 문제 은행

### 1단계 — 큰 그림 ([lifecycle.md](lifecycle.md))

| # | 문제 | 정답·해설 |
|---|---|---|
| 1-1 | 브라우저가 `/ko/tutor/schedule` 을 열었다. 거치는 파일을 순서대로 5개 이상 적으시오. | `public/index.php` → `bootstrap/app.php` → `routes/web.php` → 미들웨어(세션·CSRF·auth·SetLocale) → `ScheduleController::index` → `User::tutorSlots()` → `tutor/schedule.blade.php` → `layouts/app.blade.php` |
| 1-2 | `Auth::user()` 의 `Auth` 는 정적 클래스인가? 테스트에서 어떤 이점이 있나? | 아니다. 컨테이너의 `auth` 객체를 부르는 Facade. `fake()` 등으로 바꿔 끼울 수 있다 |
| 1-3 | 컨트롤러에서 `env('TUTOR_DISK')` 를 쓰면 무엇이 문제인가? | `config:cache` 뒤 `null` 이 될 수 있다. `config/tutor.php` 의 `'disk' => env(...)` 를 `config('tutor.disk')` 로 읽는다 |
| 1-4 | `lroute()` 는 어디에 정의되어 있고, 왜 `use` 없이 어디서나 쓸 수 있나? | `app/helpers.php`. `composer.json` 의 `autoload.files` 로 자동 로드 |
| 1-5 | 서비스 프로바이더의 `register()` 에서 `Route::macro()` 를 하지 않고 `boot()` 에서 하는 이유는? | `register()` 는 등록만 하는 단계라 다른 서비스가 아직 준비되지 않았을 수 있다. `boot()` 는 모든 등록 뒤에 실행된다 |

### 2단계 — 라우트 ([routing.md](routing.md))

| # | 문제 | 정답·해설 |
|---|---|---|
| 2-1 | `Route::delete('/tutor/schedule/slots/{slot}', [ScheduleController::class, 'destroySlot'])->name('tutor.slots.destroy');` 에서 HTTP 메서드·URL·메서드·이름을 각각 말하시오. | DELETE · `/tutor/schedule/slots/{slot}` · `ScheduleController::destroySlot` · `tutor.slots.destroy` |
| 2-2 | HTML 폼으로 위 라우트를 부르려면 폼에 무엇이 필요한가? | `method="post"`, `@csrf`, `@method('DELETE')` |
| 2-3 | `Route::localized` 안에 라우트를 하나 적으면 실제로 몇 개가 등록되고, 이름은? | 2개. `tutor.schedule` 과 `localized.tutor.schedule` |
| 2-4 | `routes/public.php` 의 컨트롤러에서 `$request->user()` 를 쓰면? | 언제나 `null`. `public` 그룹에는 세션이 없다 |
| 2-5 | `throttle:10,1` 은 무엇을 막나? | 1분에 10번 넘는 요청 — 로그인 무차별 대입 |
| 2-6 | 미들웨어에서 요청을 컨트롤러로 넘기지 않고 멈추는 법은? | `$next($request)` 를 부르지 않고 다른 응답(redirect·json)을 `return` |

### 3단계 — 컨트롤러·검증 ([controllers.md](controllers.md))

| # | 문제 | 정답·해설 |
|---|---|---|
| 3-1 | `$request->validate()` 가 실패했을 때 일반 폼 요청과 JSON 요청에서 각각 무슨 일이 일어나나? | 폼: 이전 페이지로 redirect, `$errors`·`old()` 채움. JSON: 422 + errors |
| 3-2 | `StoreTutorSlotRequest::after()` 는 왜 `$validator->errors()->isNotEmpty()` 면 바로 `return` 하나? | 기본 규칙(형식)에서 이미 틀렸으면 DB 를 조회하는 겹침 검사를 할 필요도, 할 수도 없다(값이 이상할 수 있음) |
| 3-3 | `updateTrial` 은 왜 `update()` 가 아니라 `forceFill()` 을 쓰나? | `trial_enabled` 가 Fillable 이 아니어서 `update()` 는 조용히 버린다. 에스크로·별점 검사를 거친 이 메서드만 바꾸게 하려는 설계 |
| 3-4 | 로그인 성공 뒤 `$request->session()->regenerate()` 를 하는 이유는? | 세션 고정 공격 방지 — 로그인 전 세션 id 를 버린다 |
| 3-5 | `redirect()->intended(lroute('home'))` 의 동작은? | 로그인 전에 가려다 막힌 주소로, 없으면 홈으로 |
| 3-6 | "저장했습니다"가 새로고침하면 사라진다. 버그인가? | 아니다. `->with()` 는 다음 요청 한 번만 남는 flash |

### 4단계 — Eloquent ([eloquent.md](eloquent.md))

| # | 문제 | 정답·해설 |
|---|---|---|
| 4-1 | `$user->tutorSlots()->count()` 와 `$user->tutorSlots->count()` 의 SQL 차이는? | 앞: `SELECT count(*)`. 뒤: 전부 `SELECT *` 후 PHP 에서 셈 |
| 4-2 | `User::tutorSlots()` 는 왜 `hasMany(TutorSlot::class, 'tutor_id')` 처럼 두 번째 인자를 적나? | 외래 키가 규칙(`user_id`)이 아닌 `tutor_id` 라서 |
| 4-3 | `TutorProfile::where('user_id', 1)->update(['bio' => '...'])` 뒤 `profile_score` 는? | 옛날 그대로. 쿼리 빌더 update 는 `saving` 이벤트를 건너뛴다 |
| 4-4 | `TutorProfile::query()->visible()->search('math')->ranked()->with('user')` 에서 스코프 세 개의 정의 메서드 이름은? | `scopeVisible`, `scopeSearch`, `scopeRanked` |
| 4-5 | `scopeSearch` 가 `addcslashes($keyword, '%_\\')` 를 하는 이유는? | 사용자가 입력한 `%`·`_` 가 LIKE 와일드카드로 동작하지 않게 |
| 4-6 | `'subjects' => 'array'` cast 가 없으면 `$profile->subjects` 는? | JSON 문자열 |
| 4-7 | `ScheduleController::index` 의 `->get()->groupBy('weekday')` 에서 `groupBy` 는 SQL 인가 PHP 인가? | PHP (Collection). `get()` 뒤이므로 |
| 4-8 | `TutorListController` 에 `->with('user')` 가 없으면 20명 목록에서 SQL 이 대략 몇 번 늘어나나? | 강사 이름을 쓸 때마다 1번씩 — 최대 20번 (N+1) |

### 5단계 — Blade ([blade.md](blade.md))

| # | 문제 | 정답·해설 |
|---|---|---|
| 5-1 | `<x-tutor.profile-item item="headline" :done="$items['headline']">` 에서 `item` 과 `:done` 으로 넘어가는 값의 차이는? | `item` = 문자열 `'headline'`, `:done` = PHP 식의 결과(bool) |
| 5-2 | 위 컴포넌트 안의 `<x-slot:value>` 내용과 태그 사이 나머지 내용은 컴포넌트에서 어떤 변수가 되나? | `$value` 와 `$slot` |
| 5-3 | `tutor/schedule.blade.php` 에 `<html>` 태그가 없는데 완성된 HTML 이 나오는 이유는? | `@extends('layouts.app')` — 레이아웃이 틀을 주고 `@section('content')` 가 빈칸을 채운다 |
| 5-4 | `{!! $profile->bio !!}` 를 쓰면 무엇이 위험한가? | 강사가 쓴 `<script>` 가 그대로 실행(XSS). `{{ }}` 를 쓴다 |
| 5-5 | 검증 실패 뒤 입력 칸에 이전 값, 없으면 DB 값을 보이려면? | `value="{{ old('headline', $profile->headline) }}"` |
| 5-6 | `<script>const rule = @json(config('tutor.slot_minutes'));</script>` 에서 `@json` 이 `{{ }}` 대신 쓰이는 이유와, 값에 `</script>` 가 들어 있으면 어떻게 되나? | `{{ }}` 는 HTML 이스케이프라 배열을 JS 값으로 못 넘긴다. `@json` 은 `json_encode(…, 15, 512)` 로 `<` `>` 를 `\u003C` 처럼 감춰 `</script>` 가 블록을 닫지 못한다 |
| 5-7 | `@json(config('tutor.x', []))` 는 무엇이 위험하고 어떻게 고치나? | `@json` 이 괄호 안을 쉼표로 잘라 `, []` 가 옵션 자리에 들어가고 이스케이프 옵션 `15` 가 사라진다(오류 없음). `@js(config('tutor.x', []))` 를 쓰거나 컨트롤러에서 변수로 넘긴다 |
| 5-8 | 화면 맨 위의 `@extends('layouts.app')` 은 컴파일된 PHP 에서 어디로 가며, 그래서 무엇이 가능해지나? | 파일 **맨 끝**으로 간다. 화면의 `@section` 이 모두 `$sections` 에 담긴 뒤 레이아웃이 그려지므로, 레이아웃의 `@yield` 가 그 내용을 꺼낼 수 있다(순수 PHP 의 `ob_start()` + 맨 끝 `include`) |
| 5-9 | 레이아웃에 `@section('sidebar') <a href="/">홈</a> @show` 가 있다. 화면이 ① 아무것도 안 할 때 ② `@section('sidebar') 강사 @endsection` ③ `@section('sidebar') @parent 강사 @endsection` 일 때 결과는? | ① 홈 ② 강사(오버라이드) ③ 홈 강사(`@parent` 자리에 레이아웃 내용) |
| 5-10 | `@extends` 를 쓴 화면의 첫 줄에 `<p>안내</p>` 를 `@section` 밖에 적었다. 어디에 나오나? | `<!DOCTYPE html>` 보다 앞 — 화면이 먼저 실행되고 레이아웃은 끝에 그려진다. 모든 HTML 을 `@section` 안에 둔다 |
| 5-11 | 두 컴포넌트가 각자 `@push('scripts') <script src="/js/datepicker.js"></script> @endpush` 를 한다. 한 번만 나가게 하려면? | 둘 다 `@pushOnce('scripts', 'datepicker') … @endPushOnce` — id 를 같게 적는다(id 가 없으면 자리마다 달라 두 번 나간다) |
| 5-12 | `{{ Str::limit($profile->bio, 100) }}` 이 한국어 소개를 50자쯤에서 자르는 이유와, 정확히 100자로 자르는 법은? | `Str::limit` 은 `mb_strwidth` 로 폭을 세서 한글 한 글자가 2 다. `Str::substr($bio, 0, 100)` |

### 6단계 — DB 구조 ([database.md](database.md))

| # | 문제 | 정답·해설 |
|---|---|---|
| 6-1 | `tutor_slots` 에서 `is_trial` 칸을 없애야 할 때 처음 만든 마이그레이션 파일을 고치면 안 되는 이유는? | 이미 적용된 DB 에는 다시 실행되지 않는다. 새 마이그레이션으로 바꾼다 |
| 6-2 | `$table->timestampTz('hidden_at')->nullable()` 로 "숨김"을 저장하면 `boolean` 보다 무엇이 좋은가? | 켜짐/꺼짐과 함께 켠 시각이 남는다 |
| 6-3 | `foreignId('tutor_id')->constrained('users')->cascadeOnDelete()` 를 풀어 말하면? | bigint 칸 + `users.id` 외래 키 + 회원이 지워지면 그 칸들도 삭제 |
| 6-4 | 팩토리로 만든 강사에 `admin_stars` 를 넣을 수 있는 이유는? (Fillable 이 아닌데) | 팩토리는 Fillable 을 무시한다 |
| 6-5 | 운영 서버에서 절대 쓰면 안 되는 마이그레이션 명령은? | `migrate:fresh` (전부 삭제) |

### 7단계 — 테스트 ([testing.md](testing.md))

| # | 문제 | 정답·해설 |
|---|---|---|
| 7-1 | `addSlot()` 도우미가 `->from('/tutor/schedule')` 을 붙이는 이유는? | 검증 실패 시 `back()` 이 돌아갈 이전 페이지를 정해 `assertRedirect` 등을 예측 가능하게 |
| 7-2 | `expect($tutor->tutorProfile->fresh()->offersTrial())` 에서 `fresh()` 를 빼면? | 메모리 속 옛 객체라 요청이 바꾼 DB 값이 반영되지 않아 틀린 결과 |
| 7-3 | 테스트끼리 데이터가 섞이지 않는 이유는? | `RefreshDatabase` 가 테스트마다 트랜잭션을 롤백 |
| 7-4 | PES 에서 테스트 기대값은 어디서 가져오나? | PES-SSOT.md 규정. 지금 코드의 출력이 아니다 |

### 심화 — 관계 더 알기 ([relations.md](relations.md))

| # | 문제 | 정답·해설 |
|---|---|---|
| R-1 | `User` 와 `Role` 의 다대다 피벗 테이블 이름과 두 칸을 규칙대로 적으시오. | `role_user` — `role_id`, `user_id`. 단수 snake_case 를 알파벳순으로 잇는다 |
| R-2 | 글 수정 화면에서 체크박스로 고른 태그를 저장한다. `attach()` 가 아니라 `sync()` 를 쓰는 이유는? 그리고 `sync([])` 의 결과는? | 화면의 체크 목록이 곧 "지금 상태" 이므로 차이만 넣고 빼는 `sync()` 가 맞다. `attach()` 는 중복을 만든다. `sync([])` 는 모든 태그를 떼어 낸다 |
| R-3 | 목록에 글마다 댓글 수를 보여 주려고 `$post->comments->count()` 를 썼다. 무엇이 문제이고 어떻게 고치나? | 글마다 댓글 전부를 불러온다(N+1 + 불필요한 데이터). `Post::withCount('comments')` 로 개수만 세고 `$post->comments_count` 를 쓴다 |
| R-4 | 다형 관계의 `commentable_type` 칸에 기본으로 무엇이 저장되고, 왜 `enforceMorphMap` 을 권하나? | 클래스 전체 이름(`App\Models\Post`). 클래스를 옮기면 옛 값이 깨지므로 짧은 별명을 등록하고, 등록 안 된 모델은 예외로 막는다 |
| R-5 | `Post::whereHas('comments', fn ($q) => $q->where('approved', true))->with('comments')->get()` 에서 `$post->comments` 는 승인된 댓글만인가? | 아니다. 거르기와 로딩은 별개라 모든 댓글이 붙는다. 같은 조건이면 `withWhereHas()` 를 쓴다 |
| R-6 | PES 의 `AdminLog` 는 `subject_type`·`subject_id` 를 쓴다. Laravel 의 어떤 개념과 같고, 무엇이 다른가? | 다형 참조와 같은 생각이다. 다만 `morphTo()` 관계를 선언하지 않고 `getTable()` 로 테이블 이름을 직접 적는다(쓰기 위주라서) |

### 심화 — Eloquent 더 알기 ([eloquent-plus.md](eloquent-plus.md))

| # | 문제 | 정답·해설 |
|---|---|---|
| E-1 | `fullName()` 접근자를 만들었다. `User::orderBy('full_name')->get()` 은 동작하나? | 안 된다. 접근자는 PHP 에만 있는 값이라 SQL 에는 `full_name` 칸이 없다. DB 칸이나 SQL 식으로 정렬한다 |
| E-2 | 소프트 삭제한 회원의 이메일로 재가입하면 unique 오류가 난다. 검증과 DB 에서 각각 어떻게 푸나? | 검증은 `Rule::unique('users')->withoutTrashed()`, DB 는 PostgreSQL 부분 인덱스 `CREATE UNIQUE INDEX … WHERE deleted_at IS NULL` |
| E-3 | `Model::shouldBeStrict(! $this->app->isProduction())` 은 어디에 두고, 무엇을 예외로 바꾸나? | `AppServiceProvider::boot()`. 지연 로딩(N+1), fillable 에 없는 칸 버림, 없는 속성 읽기 |
| E-4 | `status = 'draft'` 인 글을 `chunk(500)` 으로 돌며 `archived` 로 바꿨더니 절반쯤이 그대로다. 왜이고 무엇으로 바꾸나? | `chunk` 는 OFFSET 으로 다음 묶음을 구하는데, 조건에서 빠진 행 때문에 OFFSET 이 밀려 행을 건너뛴다. `chunkById()` 를 쓴다 |
| E-5 | `Product::upsert(...)` 로 가격을 고쳤는데 옵저버의 `updated()` 가 실행되지 않았다. 왜인가? | `upsert`·`insert`·쿼리 빌더 `update()` 는 모델을 만들지 않아 모델 이벤트·옵저버를 건너뛴다 |
| E-6 | `$post->user == $request->user()` 가 같은 사람인데도 `false` 가 나올 수 있는 이유와 올바른 비교는? | `==` 는 모든 속성을 비교하므로 한쪽만 관계를 불러왔거나 값이 다르면 `false`. `$post->user->is($request->user())` 로 기본 키를 비교한다 |

### 심화 — 트랜잭션 ([transactions.md](transactions.md))

| # | 문제 | 정답·해설 |
|---|---|---|
| T-1 | `DB::transaction(function () { … })` 안에서 예외가 나면 무슨 일이 일어나고, 호출한 쪽에는 무엇이 전달되나? | 롤백한 뒤 **같은 예외를 다시 던진다.** 호출한 쪽은 예외를 받는다(성공하면 클로저의 반환값을 받는다) |
| T-2 | 클로저 안에서 `try { … } catch (Throwable $e) { logger($e->getMessage()); }` 로 예외를 잡았다. 롤백되나? | 안 된다. Laravel 은 예외가 없으니 성공으로 보고 commit 한다. 잡았으면 `throw $e;` 로 다시 던진다 |
| T-3 | 예약을 저장하는 트랜잭션 안에서 확인 메일 큐 작업을 보냈더니, 가끔 워커가 "예약이 없다"는 오류를 낸다. 원인과 해결은? | 워커는 다른 DB 연결이라 commit 전의 행을 못 본다. `dispatch(...)->afterCommit()` 이나 큐 설정 `after_commit => true` 로 commit 뒤에 보낸다 |
| T-4 | 남은 자리 1개인 수업에 두 명이 동시에 예약해 2건이 생겼다. `lockForUpdate()` 를 트랜잭션 **밖**에서 썼다면 막혔을까? | 못 막는다. 잠금은 트랜잭션이 끝날 때 풀리는데, 트랜잭션 밖이면 SELECT 가 끝나는 순간(자동 커밋) 풀린다. `DB::transaction()` 안에서 잠그고 확인·저장까지 해야 한다 |
| T-5 | 가입 폼에 `Rule::unique('users', 'email')` 검증이 있는데도 같은 이메일 계정이 두 개 생겼다. 왜이며, 무엇을 더해야 하나? | 동시 요청은 둘 다 검증 시점에 "없음"을 보고 통과한다(경쟁 조건). DB 에 `unique('email')` 제약을 걸어 두 번째 INSERT 를 DB 가 거절하게 한다(`UniqueConstraintViolationException`) |
| T-6 | `$post->views++; $post->save();` 와 `$post->increment('views');` 의 차이는? | 앞은 PHP 가 읽은 값에 1 을 더해 **덮어쓴다** → 동시 요청이면 증가가 사라진다. 뒤는 `UPDATE … SET views = views + 1` 로 **DB 가 더한다**(원자적) |

### 심화 — 파일·캐시 ([files-cache.md](files-cache.md))

| # | 문제 | 정답·해설 |
|---|---|---|
| F-1 | 업로드 파일을 저장할 때 `getClientOriginalExtension()` 으로 이름을 지으면 무엇이 문제인가? 무엇을 대신 쓰나? | 사용자가 보낸 값이라 `.jpg` 로 이름만 바꾼 PHP 파일도 통과한다. `store()`(내부에서 `hashName()`)나 내용 기반 `extension()` 을 쓰고, 검증은 `mimes`·`image` 로 한다 |
| F-2 | `'photo' => ['required', 'image', 'max:2048']` 의 `2048` 단위는? 2MB 이하 사진이 "파일이 비었다"며 실패한다면 먼저 볼 곳은? | 킬로바이트(2MB). `php.ini` 의 `upload_max_filesize`·`post_max_size` — PHP 가 Laravel 에 오기 전에 버렸을 수 있다 |
| F-3 | `store('avatars', 'public')` 로 저장했는데 `/storage/avatars/…` 가 404 다. 원인과 해결은? | `public/storage` 심볼릭 링크가 없다. `php artisan storage:link`. 링크는 git 에 없으므로 새 서버·컨테이너마다 만든다 |
| F-4 | DB 에 `https://example.com/storage/avatars/x.jpg` 전체 URL 을 저장하면 안 되는 이유는? | 도메인·디스크(S3)가 바뀌면 전부 틀린 값이 된다. 디스크 안 경로(`avatars/x.jpg`)만 저장하고 `Storage::disk(...)->url()` 로 만든다 |
| F-5 | `Cache::remember("dashboard", 300, fn () => $user->stats())` 의 버그는? | 키에 사용자가 없어 첫 사용자의 값이 모두에게 보인다. `"dashboard.user.{$user->id}"` 처럼 값이 달라지는 조건을 키에 넣는다 |
| F-6 | 강사 프로필을 `TutorProfile::where(...)->update([...])` 로 고쳤더니 캐시된 카드가 안 바뀐다. 왜인가? | 캐시를 모델 이벤트(`saved`)에서 지우는데, 쿼리 빌더 `update()` 는 모델 이벤트를 건너뛴다. 모델을 불러 `save()` 하거나 직접 `Cache::forget()` 한다 |

### 심화 — 큐·이벤트·메일 ([queues.md](queues.md))

| # | 문제 | 정답·해설 |
|---|---|---|
| Q-1 | `.env` 가 `QUEUE_CONNECTION=sync` 다. `SendWelcomeMail::dispatch($user)` 뒤 응답이 3초 늦다. 왜인가? | `sync` 는 큐가 아니라 **그 자리에서 바로 실행**이다. `database`(또는 `redis`)로 바꾸고 `queue:work` 워커를 띄워야 응답이 먼저 나간다 |
| Q-2 | 잡 클래스의 `handle()` 을 고쳐 배포했는데 운영에서 옛 동작 그대로다. 원인과 조치는? | `queue:work` 워커는 앱을 한 번 부팅해 **옛 코드를 메모리에 들고** 있다. `php artisan queue:restart` 로 종료 신호를 보내고, Supervisor·Docker 가 새 코드로 다시 띄운다 |
| Q-3 | 잡에 `User $user` 를 넘겼다. 워커 실행 전에 사용자가 이름을 바꿨다면 잡은 어느 이름을 쓰나? 그 이유는? | **바뀐 이름.** `SerializesModels` 가 모델을 클래스 + id 로만 저장하고 워커가 꺼낼 때 DB 에서 다시 조회하기 때문이다. 옛 값이 필요하면 따로 인자로 넘긴다 |
| Q-4 | `DB::transaction()` 안에서 `SendReceipt::dispatch($order)` 를 했더니 가끔 `ModelNotFoundException` 이 난다. 왜이고 어떻게 고치나? | 워커가 **커밋 전에** 잡을 꺼내면 다른 연결에서는 주문 행이 아직 보이지 않는다. `->afterCommit()` 을 붙이거나 잡에 `ShouldQueueAfterCommit` 을 구현한다 |
| Q-5 | 새 리스너 `SendOrderMail` 을 `app/Listeners` 에 만들었다. `EventServiceProvider` 에 등록해야 하나? | 필요 없다. Laravel 11~13 은 **이벤트 자동 발견**으로 `handle(OrderPlaced $event)` 의 타입을 읽어 연결한다. `php artisan event:list` 로 확인한다 |
| Q-6 | 정기 작업을 하나 더 만들었다. 서버 crontab 에 줄을 추가해야 하나? 테스트에서 메일이 실제로 나갔는지 대신 확인하는 법은? | crontab 은 `* * * * * php artisan schedule:run` **한 줄뿐**이고, 작업은 `routes/console.php` 에 `Schedule::command(...)` 로 더한다. 메일은 `Mail::fake()` 뒤 `Mail::assertSent(WelcomeMail::class)` (큐로 보냈으면 `assertQueued`) |

### 심화 — JSON API ([api.md](api.md))

| # | 문제 | 정답·해설 |
|---|---|---|
| A-1 | 컨트롤러에서 `return Post::latest()->get();` 을 하면 응답은 무엇이고, 공개 API 에서 이렇게 두면 무엇이 위험한가? | 자동으로 JSON 배열(200). 테이블의 모든 칸이 나가므로 나중에 추가한 내부 칸까지 새어 나간다 → API Resource 로 칸을 고른다 |
| A-2 | `Route::resource` 대신 `Route::apiResource` 를 쓰는 이유는? 빠지는 두 메서드는? | API 는 HTML 입력 폼을 보여 주지 않으므로 화면용 `create`·`edit` 가 필요 없다 |
| A-3 | 모바일 앱이 `/api/posts` 에 빈 제목을 POST 했더니 422 가 아니라 302 가 왔다. 원인과 해결 두 가지는? | `Accept: application/json` 헤더가 없어 폼 요청으로 봤다. 앱이 헤더를 보내거나, 서버가 `shouldRenderJsonWhen(fn ($r) => $r->is('api/*') …)` 로 api 경로를 무조건 JSON 으로 정한다(PES 방식) |
| A-4 | Resource 에서 `'author' => new UserResource($this->user)` 대신 `$this->whenLoaded('user')` 를 쓰는 이유는? | 목록에서 행마다 user 쿼리가 나가는 N+1 을 막는다. 컨트롤러가 `with('user')` 했을 때만 실린다 |
| A-5 | 토큰 없이 부르면 나오는 코드와, 남의 글을 지우려 하면 나오는 코드는? 차이는? | 401(누구인지 모름 — 다시 로그인하면 풀림) / 403(누구인지 알지만 권한 없음 — 다시 로그인해도 안 됨) |
| A-6 | `createToken()` 으로 발급한 토큰을 나중에 DB 에서 다시 꺼내 앱에 줄 수 있나? | 없다. DB 에는 해시만 저장되고 평문(`plainTextToken`)은 발급 순간에만 볼 수 있다. 잃으면 새로 발급한다 |

### 심화 — 보안 ([security.md](security.md))

| # | 문제 | 정답·해설 |
|---|---|---|
| S-1 | `<a href="{{ $user->homepage }}">` 는 `{{ }}` 로 이스케이프했으니 안전한가? | 아니다. `javascript:alert(1)` 은 이스케이프해도 실행된다. 저장할 때 `url:http,https` 규칙으로 스킴을 제한한다 |
| S-2 | Laravel 12 프로젝트에서 결제 웹훅 주소를 CSRF 검사에서 빼려고 `app/Http/Middleware/VerifyCsrfToken.php` 를 찾았는데 없다. 어디에 적나? | `bootstrap/app.php` 의 `->withMiddleware()` 안에서 `$middleware->validateCsrfTokens(except: ['webhooks/…'])`. 그 주소는 웹훅 서명을 직접 검증한다 |
| S-3 | `Post::orderBy($request->input('sort'))` 는 쿼리 빌더라 바인딩되니 안전한가? | 아니다. PDO 는 **값**만 바인딩하고 칸 이름은 바인딩하지 못한다. 허용 목록(`in_array(..., [...], true)`)으로 거른 값만 넣는다 |
| S-4 | `User` 에 `#[Fillable]` 이 있는데도 `$user->update($request->validated())` 를 권하는 이유는? | 이중 방어다. `validated()` 는 검증 규칙에 적힌 키만 돌려주므로, Fillable 설정 실수·`$guarded = []`·`forceFill` 같은 경우에도 공격자가 끼워 넣은 칸이 들어가지 않는다 |
| S-5 | 로그인한 사용자가 주소의 id 만 바꿔 남의 글 수정 화면을 열었다. `auth` 미들웨어가 있는데 왜 막지 못했고, 고치는 두 방법은? | `auth` 는 로그인 여부만 본다(IDOR). ① 관계로 찾기 `$request->user()->posts()->findOrFail($id)` ② `Gate::authorize('update', $post)` 정책 |
| S-6 | 운영 서버의 `APP_KEY` 가 유출돼 새로 바꿨더니 모든 사용자가 로그아웃되고 암호화 칸이 안 읽힌다. 미리 했어야 할 일은? | 옛 키를 `APP_PREVIOUS_KEYS` 에 적어 두면 복호화할 때 옛 키로도 시도한다. 새로 암호화하는 값은 새 키를 쓴다 |

### 심화 — 디버깅·로그·예외 ([debugging.md](debugging.md))

| # | 문제 | 정답·해설 |
|---|---|---|
| D-1 | `fetch()` 로 부르는 저장 API 에 `dd($request->all())` 를 넣었는데 화면에 아무것도 안 보인다. 어디서 봐야 하나? | 브라우저 개발자 도구의 네트워크 탭 → 그 요청의 응답 본문. 또는 `logger()` 로 남기고 `php artisan pail` 로 본다 |
| D-2 | `toSql()` 과 `toRawSql()` 의 차이는? DB 콘솔에서 `EXPLAIN` 하려면 어느 쪽인가? | `?` 자리표시자 그대로 / 값까지 채움. 바로 실행할 수 있는 `toRawSql()` |
| D-3 | `Log::error("결제 실패 order=$id")` 보다 `Log::error('결제 실패', ['order_id' => $id])` 가 나은 이유는? | 메시지가 고정돼 같은 오류를 세고 검색하기 쉽다. 바뀌는 값은 컨텍스트 배열이 구조화해 남긴다 |
| D-4 | Laravel 11+ 에서 옛 `app/Exceptions/Handler.php` 의 역할은 어디로 갔나? PES 는 거기서 무엇을 설정하나? | `bootstrap/app.php` 의 `withExceptions()`. PES 는 `shouldRenderJsonWhen` 으로 `api/*` 이거나 JSON 을 원하는 요청의 오류를 JSON 으로 그린다 |
| D-5 | 외부 환율 API 가 실패해도 페이지는 떠야 한다. 예외를 기록하고 기본값으로 계속 가는 한 줄은? | `rescue(fn () => ExchangeApi::fetch(), config('pay.default_rate'))` — 빈 `catch` 로 삼키지 않는다 |
| D-6 | 운영 서버에서 `APP_DEBUG=true` 면 무엇이 위험한가? | 오류 화면에 스택 트레이스·환경 변수·DB 정보·코드 경로가 드러날 수 있다. 운영은 반드시 `false` |

### 심화 — 배포 ([deploy.md](deploy.md))

| # | 문제 | 정답·해설 |
|---|---|---|
| P-1 | 운영 `.env` 에서 `APP_DEBUG=true` 로 두면 무엇이 문제인가? | 예외가 나면 코드·파일 경로·쿼리·설정이 담긴 오류 화면(API 면 스택 JSON)이 사용자에게 보인다. 운영은 `false` |
| P-2 | 배포 스크립트에 `php artisan key:generate` 를 넣으면 무슨 일이 생기나? | 배포마다 APP_KEY 가 바뀌어 모든 사용자가 로그아웃되고, `encrypted` 로 저장한 값을 복호화할 수 없다 |
| P-3 | 서버에서 `.env` 의 메일 설정을 고쳤는데 반영이 안 된다. 왜이고 어떻게 하나? | `optimize`(config:cache)로 굳힌 설정 파일이 옛 값을 들고 있다. `php artisan optimize` 를 다시 실행한다 |
| P-4 | 운영에서 `php artisan migrate` 대신 `migrate --force` 를 쓰는 이유는? 대신 절대 쓰면 안 되는 명령은? | production 에서 뜨는 확인 질문을 스크립트가 대답할 수 없어서. `migrate:fresh` 는 데이터를 전부 지우므로 금지 |
| P-5 | 새 코드를 배포했는데 이메일 발송(큐 작업)만 옛 동작을 한다. 원인과 명령은? | 큐 워커가 옛 코드를 메모리에 들고 계속 돈다. `php artisan queue:restart` (PES 는 queue 컨테이너 재시작) |
| P-6 | 웹 서버 문서 루트를 프로젝트 루트로 잡으면 무엇이 열리나? | `https://사이트/.env` 등 — DB 비밀번호·APP_KEY 가 URL 로 노출된다. 문서 루트는 `public/` |

---

## 3. tinker 조회 실습

`docker compose exec app php artisan tinker` 에서 사용자가 **직접** 입력한다. 모두 조회만 한다. 결과를 보고 "왜 이런 결과인지"를 사용자에게 설명하게 한다.

| # | 입력 | 확인할 개념 |
|---|---|---|
| T1 | `config('tutor.slot_minutes')` | config 점 표기, 배열 설정 |
| T2 | `App\Models\User::count()` | 모델 = 테이블 |
| T3 | `$u = App\Models\User::first()` 후 `$u->tutorSlots()` 와 `$u->tutorSlots` | 괄호 규칙 — 앞은 `HasMany`, 뒤는 `Collection` |
| T4 | `$u->tutorSlots()->where('weekday', 1)->toRawSql()` | 관계가 붙이는 `where tutor_id = ?` |
| T5 | `App\Models\TutorProfile::query()->visible()->search('math')->toRawSql()` | 스코프가 만드는 SQL, LIKE 이스케이프 |
| T6 | `App\Models\TutorProfile::first()?->subjects` | `array` cast |
| T7 | `App\Models\User::first()?->status` | enum cast (`UserStatus`) |
| T8 | `app()->setLocale('ko'); App\Models\TutorSlot::weekdayName(0)` | 언어 설정과 Carbon 로케일 |
| T9 | `lroute('tutor.schedule')` 를 `app()->setLocale('ko')` 전후로 | `lroute` 의 언어 접두사 |
| T10 | ① `DB::enableQueryLog();` ② `DB::flushQueryLog(); App\Models\TutorProfile::limit(5)->get()->each(fn ($p) => $p->user?->name); count(DB::getQueryLog())` ③ ②의 `limit(5)` 앞에 `with('user')->` 를 넣어 다시 | N+1 을 눈으로 보기 (강사 5명이면 6 vs 2) |

데이터가 없으면 결과가 `null`·`0` 일 수 있다 — 그때는 SQL(`toRawSql()`)만 보고 설명한다. 데이터를 만들고 싶으면 연습 프로젝트에서 한다.

---

## 4. 연습 프로젝트 — 미니 게시판

### 원칙

- **PES 저장소 밖**에 만든다. PES 에 연습 파일이 섞이면 커밋·배포에 딸려 간다.
- 코드는 **사용자가 직접 타이핑**한다. AI 는 과제를 내고, 막히면 힌트 → 그래도 막히면 해당 참조 문서의 PES 코드를 보여 준다. 사용자가 원하면 답 코드를 **답변에** 적어 준다(파일에 쓰지 않는다).
- 호스트에 PHP 8.5·Composer 가 있으므로 Docker 없이 한다. 기본 DB 는 SQLite 라 설정이 없다.

```bash
cd ~/apps
composer create-project laravel/laravel laravel-study
cd laravel-study
php artisan serve          # http://127.0.0.1:8000
```

명령마다 실행할 폴더, 설치 뒤 생기는 폴더 구조, `laravel: command not found` 해결은 [install.md](install.md#2-명령별-실행-폴더와-생기는-폴더).

### 과제 (각 과제가 PES 의 어느 코드와 같은 개념인지 함께 보여 준다)

| # | 과제 | 확인 기준 | 닮은 PES 코드 |
|---|---|---|---|
| M1 | `/hello` 에서 "Hello" 를 돌려주는 라우트(클로저) | 브라우저에 Hello | — |
| M2 | `php artisan make:model Post -mf` → 마이그레이션에 `title`(string)·`body`(text)·`user_id`(foreignId constrained) → `migrate` | `php artisan db:table posts` 에 칸이 보임 | `create_tutor_slots_table` |
| M3 | `Post` 에 `#[Fillable(['title', 'body'])]`, `User` 에 `posts(): HasMany`, `Post` 에 `user(): BelongsTo` | tinker: `User::first()->posts()->create([...])` 성공 | `User::tutorSlots()` |
| M4 | `PostFactory` 의 `definition()` 을 `fake()` 로 채우고 시더로 글 20개 | `Post::count()` = 20 | `TutorProfileFactory` |
| M5 | `PostController::index` — 최신순 `simplePaginate(10)` + `with('user')` 로 목록 화면(레이아웃 상속) | 목록·다음 쪽 링크, SQL 2~3번 | `TutorListController::index` |
| M6 | `StorePostRequest`(`title` required max:100, `body` required) + `store` — 저장 후 목록으로 redirect + flash | 빈 제목 → 오류 표시 + 입력값 유지, 성공 → "저장했습니다" 한 번 | `StoreTutorSlotRequest`, `ScheduleController::saved()` |
| M7 | 로그인 필수(`auth` 미들웨어) + 내 글만 지우기(`$request->user()->posts()->findOrFail($id)`) | 남의 글 id → 404 | `ScheduleController::destroySlot` |
| M8 | 스코프 `scopeSearch($q, ?string $keyword)` 로 제목 검색 + `->when()` | `?q=abc` 로 걸러짐, `%` 입력 안전 | `TutorProfile::scopeSearch` |
| M9 | Blade 컴포넌트 `<x-post-card :post="$post" />` 로 목록 한 줄 분리 | 목록이 그대로 보임 | `<x-tutor.profile-item>` |
| M10 | Pest 테스트 3개: 목록 200, 빈 제목 오류, 남의 글 삭제 404 | `php artisan test` 모두 통과 | `TutorScheduleTest` |

과제 도움말:

- M7 — 새 프로젝트에는 로그인 화면이 없다. 연습용 라우트에서 `Auth::login(User::first())` 로 로그인하거나, M10 테스트의 `actingAs()` 로 확인한다. 로그인 흐름 자체는 PES `LoginController` 로 공부한다.
- M10 — `composer.json` 에 Pest 가 없으면 `composer require pestphp/pest --dev --with-all-dependencies` 후 `./vendor/bin/pest --init`. 설치 방법이 바뀌었을 수 있으니 막히면 pestphp.com 문서를 확인한다.

M10 까지 마치면 PES 의 시간표 기능(라우트 → FormRequest → 관계 create → redirect+flash → Blade → Pest)을 처음부터 혼자 만들 수 있는 수준이다.
