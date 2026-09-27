---
name: laravel
description: PHP 는 잘 알지만 Laravel 은 처음인 사용자를 가르치는 Laravel 13 공부 도우미. PES 저장소의 실제 코드(라우트·미들웨어·컨트롤러·FormRequest·Eloquent 모델·Blade·마이그레이션·팩토리·Artisan 명령·Pest 테스트)를 예제로 삼아 기초 암기 → 요청 한 바퀴 따라가기 → 주제별 심화 → 퀴즈·실습 순서로 가르친다. 사용자가 Laravel 을 공부·학습·복습하고 싶다고 할 때, Laravel 개념(설치·laravel new·composer create-project·명령을 실행할 폴더, 요청 흐름, 서비스 컨테이너, Facade, 서비스 프로바이더, config·env, 라우트, 라우트 모델 바인딩, 미들웨어, 검증, 세션 flash, 인증, 정책, Eloquent, 관계, 스코프, casts, 모델 이벤트, Collection, N+1, Blade, 컴포넌트, 슬롯, 마이그레이션, 팩토리, 시더, Artisan, tinker, Pest)을 물을 때, "이 코드가 무슨 뜻이냐"·"왜 이렇게 쓰냐"처럼 PES 코드를 Laravel 관점에서 풀어 달라고 할 때, 암기 카드·퀴즈·연습 문제·공부 순서를 원할 때, 인터넷 튜토리얼(Laravel 8~10)과 이 프로젝트 코드가 달라 헷갈릴 때 반드시 사용한다. 예약·강사 기능을 실제로 구현하는 일은 booking 스킬이 맡는다. Keywords - Laravel, 라라벨, 다대다, 트랜잭션, 큐, 이벤트, 메일, 캐시, 파일 업로드, API, Sanctum, 보안, 디버깅, 로그, 배포, 공부, 학습, 스터디, 기초, 암기, 복습, 퀴즈, 튜토리얼, Eloquent, Blade, Artisan, tinker, route, middleware, migration, facade.
---

# Laravel 공부 — PES 코드로 배우는 Laravel 13

## 목차

1. [학생과 가르치는 규칙](#학생과-가르치는-규칙)
2. [공부 모드 고르기](#공부-모드-고르기)
3. [공부 로드맵 7단계](#공부-로드맵-7단계)
4. [기초 암기 카드](#기초-암기-카드)
5. [옛 튜토리얼과 이 프로젝트의 차이](#옛-튜토리얼과-이-프로젝트의-차이)
6. [심화 과정](#심화-과정)
7. [참조 문서 지도](#참조-문서-지도)

## 학생과 가르치는 규칙

**학생은 PHP 전문가이고 Laravel 은 처음이다.** PHP 문법·OOP·Composer·PDO·세션은 이미 안다. 그래서 설명은 언제나 **"순수 PHP 로 하던 일을 Laravel 은 이렇게 한다"** 로 시작한다. 이미 아는 것에 붙여야 빨리 외우고, Laravel 이 무엇을 대신해 주는지(그래서 무엇을 하지 말아야 하는지)가 보인다.

1. **한국어로 가르친다.** 코드·클래스명·명령어는 원문 그대로 둔다.
2. **예제는 PES 실제 코드로 든다.** 참조 문서의 발췌는 2026-09-26 기준이다. 코드는 계속 바뀌므로 사용자에게 보여 주기 전에 그 파일을 다시 읽고, 지금 줄 번호로 링크한다(예: `[ScheduleController.php:42](app/Http/Controllers/Tutor/ScheduleController.php#L42)`). 발췌와 지금 코드가 다르면 지금 코드로 가르친다.
3. **소스 코드를 고치지 않는다.** [AGENTS.md](../../../AGENTS.md) 의 절대 규칙은 공부 중에도 그대로다. 예제·실습 코드는 답변에 적기만 한다.
   - 파일을 만드는 실습(`make:controller` 등)은 PES 저장소가 아니라 **따로 만든 연습 프로젝트**에서 사용자가 직접 하게 한다. PES 에 연습 파일이 섞이면 커밋·배포에 딸려 간다.
   - `tinker` 실습은 조회(SELECT)만 권한다. 저장·삭제를 해 보려면 로컬 DB 에서만 하게 하고, 운영 서버에서는 절대 하지 않게 한다.
4. **버전을 맞춘다.** 이 프로젝트는 Laravel 13.33 · PHP 8.3 · PostgreSQL · Pest 5 · Filament 5 다. 기억이 애매한 API 는 `vendor/laravel/framework/src` 를 grep 해서 확인하고 답한다. 인터넷 튜토리얼 대부분은 Laravel 8~10 이라 [차이표](#옛-튜토리얼과-이-프로젝트의-차이)를 함께 보여 준다.
5. **명령은 컨테이너 안에서 실행한다.** PHP 는 호스트가 아니라 Docker 컨테이너 안에 있다 → `docker compose exec app php artisan ...`
6. **한 번에 한 주제, 짧게.** 개념 → PES 코드 → 순수 PHP 비교 → 확인 문제 2~3개 순서로 끝낸다. 긴 주제는 나눠서 준다.
7. **답을 먼저 주지 않는다(퀴즈·실습일 때).** 문제를 내고 사용자가 답한 뒤에 채점·해설한다.

## 공부 모드 고르기

요청을 보고 하나를 고른다. 애매하면 "처음부터"로 본다.

| 사용자 요청 | 할 일 |
|---|---|
| "처음부터", "기초", "뭐부터 외워요?" | [로드맵](#공부-로드맵-7단계) 1단계부터. 먼저 [기초 암기 카드](#기초-암기-카드)를 보여 준다 |
| "어떻게 설치해요?", "이 명령은 어느 폴더에서?", "무슨 폴더가 생겨요?" | [install.md](references/install.md) |
| "X 가 뭐예요?" (개념 질문) | 아래 [참조 문서 지도](#참조-문서-지도)에서 해당 문서를 읽고 → 개념 → PES 코드 → 순수 PHP 비교 → 확인 문제 |
| "이 코드 설명해 주세요" (파일·선택 영역) | 파일을 읽고 줄마다 Laravel 개념 이름을 붙여 설명한다(예: "여기가 로컬 스코프", "여기가 flash 세션"). 관련 참조 문서를 링크 |
| "요청 따라가기", "흐름이 궁금해요" | [lifecycle.md](references/lifecycle.md) 의 "요청 한 바퀴 따라가기" 절차 |
| "퀴즈", "복습", "문제 내 주세요" | [exercises.md](references/exercises.md) 의 퀴즈 절차 |
| "실습", "직접 해 보고 싶어요" | [exercises.md](references/exercises.md) 의 tinker 실습 또는 연습 프로젝트 과제 |
| "이거 옛날 방식이에요?" | [차이표](#옛-튜토리얼과-이-프로젝트의-차이) + vendor 소스 확인 |
| "큐가 뭐예요?", "배포는 어떻게 해요?" 처럼 7단계 밖의 실무 주제 | [심화 과정](#심화-과정) 표에서 문서를 골라 같은 방식으로 |
| 예약·강사 기능을 **구현**하려는 요청 | 이 스킬이 아니라 booking 스킬 |

## 공부 로드맵 7단계

단계마다 "마치면 할 수 있는 것"이 체크포인트다. 사용자가 체크포인트를 말로 설명할 수 있으면 다음 단계로 간다.

| 단계 | 주제 | 참조 | 마치면 할 수 있는 것 |
|---|---|---|---|
| 0 | 준비 | [install.md](references/install.md) | 연습 프로젝트를 만들고, 명령마다 어느 폴더에서 실행하는지와 무엇이 생기는지 말한다 |
| 1 | 큰 그림 | [lifecycle.md](references/lifecycle.md) | 요청이 어느 파일들을 거쳐 응답이 되는지 순서대로 말한다. Facade·서비스 컨테이너·config 가 무엇인지 한 문장씩 말한다 |
| 2 | 라우트 | [routing.md](references/routing.md) | `routes/web.php` 한 줄을 보고 URL·HTTP 메서드·컨트롤러·이름·미들웨어를 읽어 낸다 |
| 3 | 컨트롤러·검증 | [controllers.md](references/controllers.md) | 폼 하나의 저장 흐름(검증 → 저장 → redirect → flash 메시지)을 설명한다 |
| 4 | Eloquent | [eloquent.md](references/eloquent.md) | 관계·스코프·casts 를 읽고, `$user->tutorSlots()` 와 `$user->tutorSlots` 의 차이를 말한다. **가장 오래 걸리는 단계** |
| 5 | Blade | [blade.md](references/blade.md) | 레이아웃 상속·컴포넌트·폼 지시어(`@csrf`·`@method`·`@error`)를 읽는다 |
| 6 | DB 구조 | [database.md](references/database.md) | 마이그레이션 하나를 읽고 만들어질 테이블을 그린다. 팩토리로 테스트 데이터를 만든다 |
| 7 | 테스트 | [testing.md](references/testing.md) | PES 의 Pest 테스트 하나를 읽고 무엇을 검사하는지 말한다 |
| 수시 | 명령·함정 | [artisan.md](references/artisan.md) · [pitfalls.md](references/pitfalls.md) | `route:list`·`tinker`·`model:show` 로 스스로 조사한다. 함정 12개를 피한다 |
| 심화 | 실무 주제 | [심화 과정](#심화-과정) | 7단계를 마친 뒤 필요한 주제부터. 문서마다 "마치면 할 수 있는 것"이 있다 |

1~3단계는 하루씩, 4단계는 2~3일을 잡는다. 1단계를 마치면 바로 [lifecycle.md](references/lifecycle.md) 의 "요청 한 바퀴 따라가기"를 해 본다 — 이후 단계는 그 한 바퀴의 각 칸을 깊게 파는 일이다.

## 기초 암기 카드

처음에는 이것만 외운다. 나머지는 쓰다 보면 외워진다.

### ① 요청 한 바퀴

```
브라우저 요청
 → public/index.php         모든 요청의 입구 (순수 PHP 의 front controller)
 → bootstrap/app.php        앱 조립: 라우트 파일·미들웨어·예외 처리 등록
 → 미들웨어                   로그인 검사·CSRF·언어 결정 … (컨트롤러 앞뒤의 필터)
 → routes/web.php           URL + HTTP 메서드 → 컨트롤러 메서드
 → 컨트롤러                   app/Http/Controllers — 검증 → 모델 → 응답
 → 모델(Eloquent)            app/Models — 테이블 1개 = 클래스 1개
 → view('tutor.schedule')   resources/views/tutor/schedule.blade.php
 → 응답(HTML·JSON·redirect)
```

### ② 폴더 지도

| 폴더/파일 | 무엇 | PES 예 |
|---|---|---|
| `routes/web.php` | 세션이 있는 URL | `/tutor/schedule` |
| `routes/public.php` | **PES 전용** — 세션·쿠키 없는 캐시용 URL | `/class/tutors` |
| `app/Http/Controllers/` | 요청 처리 | `Tutor/ScheduleController.php` |
| `app/Http/Requests/` | 검증 규칙 클래스(FormRequest) | `StoreTutorSlotRequest.php` |
| `app/Http/Middleware/` | 미들웨어 | `SetLocale.php` |
| `app/Models/` | Eloquent 모델 | `TutorSlot.php` |
| `app/Policies/` | 권한(누가 무엇을 볼 수 있나) | `TutorProfilePolicy.php` |
| `resources/views/` | Blade 화면 | `tutor/schedule.blade.php` |
| `database/migrations/` | 테이블 구조 변경 이력 | `..._create_tutor_slots_table.php` |
| `database/factories/` | 테스트용 가짜 데이터 | `TutorProfileFactory.php` |
| `config/*.php` | 설정값 | `config/tutor.php` |
| `lang/{언어}/*.php` | 번역 | `lang/ko/tutor.php` |
| `bootstrap/app.php` | 앱 조립(미들웨어·라우트 파일 등록) | — |
| `.env` | 비밀번호·환경별 값 | — |

### ③ 이름 규칙 — 이름이 곧 설정이다

| 대상 | 규칙 | 예 |
|---|---|---|
| 모델 ↔ 테이블 | 단수 PascalCase ↔ 복수 snake_case | `TutorSlot` ↔ `tutor_slots` |
| 기본 키 | `id` | |
| 외래 키 | `{모델}_id` | `user_id` — 규칙을 벗어나면 직접 적는다: `hasMany(TutorSlot::class, 'tutor_id')` |
| 시각 칸 | `created_at`·`updated_at` 자동 | |
| 뷰 이름 | 점 = 폴더 | `'tutor.schedule'` → `tutor/schedule.blade.php` |
| 설정·번역 키 | 점 = 파일.키 | `config('tutor.trial_max_minutes')` · `__('tutor.save')` |

### ④ 헬퍼 함수 15개

```php
route('tutor.schedule')          // 라우트 이름 → URL (PES 는 언어를 붙이는 lroute())
view('tutor.schedule', [...])    // 화면
redirect()->to($url) / back()    // 이동 / 이전 페이지로
config('tutor.trial_max_minutes')
env('DB_HOST')                   // ⚠ config/*.php 안에서만
__('tutor.save')                 // 번역
auth()->user() / $request->user()
now()                            // Carbon (DateTime 확장)
abort(404)
dd($x)                           // dump and die
collect([...])                   // 배열 → Collection
old('email')                     // 검증 실패 뒤 이전 입력값
session('status')
logger('msg')                    // storage/logs/laravel.log
app(Foo::class)                  // 서비스 컨테이너에서 꺼내기
```

### ⑤ 괄호 규칙 — Eloquent 에서 제일 중요

```php
$user->tutorSlots()   // 괄호 O → 쿼리 빌더. 뒤에 ->where()->orderBy()->get() 을 잇는다
$user->tutorSlots     // 괄호 X → 결과(Collection). 처음 읽을 때 한 번 조회하고 기억한다
```

### ⑥ Artisan 10개 (앞에 `docker compose exec app` 을 붙인다)

```bash
php artisan route:list --path=tutor   # 라우트 찾기
php artisan tinker                    # 앱이 로드된 REPL
php artisan migrate                   # 마이그레이션 적용
php artisan migrate:status            # 어디까지 적용됐나
php artisan model:show User           # 모델의 칸·관계·casts 한눈에
php artisan db:table tutor_slots      # 테이블 구조
php artisan config:show tutor         # 설정값 확인
php artisan test --filter=schedule    # Pest 테스트
php artisan optimize:clear            # 캐시 비우기(설정이 안 바뀔 때)
php artisan make:model Post -mf       # 모델 + 마이그레이션 + 팩토리 (연습 프로젝트에서)
```

### ⑦ 함정 5개 (자세히는 [pitfalls.md](references/pitfalls.md))

1. `env()` 는 `config/*.php` 안에서만 — 설정 캐시 뒤에는 `null` 이 될 수 있다.
2. `create($data)` 는 `#[Fillable]` 에 없는 칸을 **오류 없이 버린다**.
3. 반복문 안의 `$u->tutorProfile` 는 N+1 쿼리 → `with('tutorProfile')`.
4. 폼에 `@csrf` 가 없으면 419, PUT·DELETE 는 `@method('PUT')`.
5. 남의 데이터 막기 — `TutorSlot::findOrFail($id)` 대신 `$request->user()->tutorSlots()->findOrFail($id)`.

## 옛 튜토리얼과 이 프로젝트의 차이

검색해서 찾은 예제가 이 프로젝트와 다르면 대부분 이 표 때문이다.

| 옛 튜토리얼 (Laravel 8~10) | Laravel 11~13 / PES |
|---|---|
| `app/Http/Kernel.php` 에 미들웨어 등록 | `bootstrap/app.php` 의 `->withMiddleware()` |
| `RouteServiceProvider` 가 라우트 파일 등록 | `bootstrap/app.php` 의 `->withRouting()` |
| `app/Console/Kernel.php` 의 `schedule()` | `routes/console.php` 에 `Schedule::` |
| `routes/api.php` 가 기본으로 있음 | `php artisan install:api` 로 추가 (PES 는 아직 없음) |
| `protected $casts = [...]` | `protected function casts(): array` (둘 다 동작) |
| `protected $fillable = [...]` | `#[Fillable([...])]` 속성 (둘 다 동작, PES 는 속성) |
| `protected $hidden = [...]` | `#[Hidden([...])]` |
| `Controller extends BaseController` + `AuthorizesRequests` | 빈 `abstract class Controller` → `$this->authorize()` 가 없다. `Gate::authorize()` 를 쓴다 |
| PHPUnit 클래스 `class XTest extends TestCase` | Pest `it('...', function () {...})` |
| `class CreateUsersTable extends Migration` | `return new class extends Migration` (익명 클래스) |
| `scopeVisible()` 만 | `scopeVisible()` 또는 `#[Scope] protected function visible()` (PES 는 `scope` 접두사) |

## 심화 과정

7단계를 마친 뒤 실제 서비스를 만들 때 만나는 주제다. 순서는 자유지만 **관계 심화 → 트랜잭션 → 디버깅** 을 먼저 권한다 — 연습 프로젝트 "미니 게시판"([exercises.md](references/exercises.md#4-연습-프로젝트--미니-게시판))에서 가장 먼저 부딪힌다. PES 에 없는 기능이 많아 예제는 대부분 **일반 Laravel 예**(미니 게시판)이고, PES 코드는 이미 발췌된 곳에서만 인용한다.

| 문서 | 이럴 때 | 마치면 할 수 있는 것 |
|---|---|---|
| [관계 심화](references/relations.md) | "글에 태그를 달고 싶다", "댓글 수를 목록에 같이 보여 주고 싶다" | 글–태그 같은 다대다 관계를 만들고 sync 로 고치며, withCount 로 개수를 N+1 없이 센다 |
| [Eloquent 더](references/eloquent-plus.md) | "지운 글을 되살리고 싶다", "이름을 늘 같은 모양으로 보여 주고 싶다", "10만 행을 돌려야 한다" | 접근자·소프트 삭제·엄격 모드를 쓰고, 많은 행을 메모리 걱정 없이 처리한다 |
| [트랜잭션·잠금](references/transactions.md) | "저장이 반만 되었다", "같은 시간이 두 번 예약됐다" | 여러 저장을 한 트랜잭션으로 묶고, 동시에 두 요청이 와도 데이터가 깨지지 않게 만든다 |
| [파일·캐시](references/files-cache.md) | "사진을 올리고 싶다", "순위 계산이 느리다" | 파일을 검증해 디스크에 저장하고 URL 로 보여 주며, 느린 계산을 캐시하고 제때 지운다 |
| [큐·이벤트·메일](references/queues.md) | "메일 보내느라 응답이 느리다", "매일 새벽에 정리 작업을 돌리고 싶다" | 느린 일을 잡으로 큐에 넘기고, 메일·알림을 보내고, 정해진 시각에 명령을 돌린다 |
| [JSON API](references/api.md) | "앱에서 쓸 JSON API 가 필요하다" | JSON API 를 만들고 Resource 로 응답 모양을 정하며, 토큰으로 인증하고 테스트한다 |
| [보안](references/security.md) | "이 코드 안전한가요?" | 공격마다 Laravel 이 막아 주는 것과 내가 막아야 할 것을 구분해 말한다 |
| [디버깅·로그](references/debugging.md) | "500 오류가 났다", "어떤 SQL 이 나가는지 보고 싶다" | 오류가 나면 로그 → 라우트 → tinker → dd 순서로 원인을 좁히고, 예외를 원하는 응답으로 바꾼다 |
| [배포](references/deploy.md) | "운영 서버에 올리고 싶다", "배포했더니 화면이 깨졌다" | 배포 순서를 체크리스트로 말하고, 배포 뒤 흔한 오류(캐시·권한·manifest)를 스스로 고친다 |

가르치는 방법은 7단계와 같다(개념 → 순수 PHP 비교 → 코드 → 확인 문제 2~3개). 퀴즈는 [exercises.md](references/exercises.md#2-문제-은행) 문제 은행의 "심화" 표를 쓴다. 심화 문서의 API 는 Laravel 13 소스(`vendor/laravel/framework/src`)로 확인해 두었지만, 설명하기 전에 사용자의 프로젝트 버전을 한 번 더 확인한다.

## 참조 문서 지도

주제별 문서다. 필요한 문서만 읽는다. 모든 문서는 **핵심 개념 → 순수 PHP 비교 → PES 실제 코드 → 암기 카드** 순서로 되어 있다.

### 0단계 설치 → [references/install.md](references/install.md)

새 Laravel 프로젝트를 만들 때 명령을 어느 폴더에서 실행하고 무엇이 생기는지 다룬다. 골격 만들기(`laravel new`·`composer create-project`)와 실행 환경(호스트 PHP·Sail·직접 쓴 `compose.yaml`)이 서로 다른 층이라는 점, `composer global require laravel/installer` 는 아무 폴더에서나 되고 `laravel new my-app` 은 부모 폴더(`~/apps`)에서 실행해 `~/apps/my-app/` 을 만든다는 점, `laravel: command not found` 일 때 `~/.composer/vendor/bin` 을 PATH 에 넣는 법, 연습 프로젝트를 만든 뒤 생기는 폴더 구조와 설치 중 만들어지는 `vendor/`·`.env`·`APP_KEY`·`database.sqlite`(골격 `composer.json` 의 `post-create-project-cmd`), `php artisan` 은 `artisan` 이 있는 프로젝트 루트에서 실행한다는 점, PES 의 `./:/app` 볼륨과 `WORKDIR /app` 덕분에 `docker compose exec app php artisan` 이 PES 루트에서 도는 이유, PES 안에서 `laravel new` 를 하면 안 되는 이유를 담았다.

### 1단계 큰 그림 → [references/lifecycle.md](references/lifecycle.md)

요청 하나가 `public/index.php` 에서 응답이 되기까지 거치는 파일을 순서대로 설명한다. PES 의 `bootstrap/app.php` 가 라우트 파일(web·public·console)과 미들웨어 그룹을 어떻게 등록하는지, 서비스 컨테이너가 컨트롤러 인자 `Request $request` 를 어떻게 채우는지, 서비스 프로바이더의 `register()`·`boot()` 차이, Facade(`Route::`·`Auth::`·`DB::`)가 정적 클래스가 아니라 컨테이너 객체의 대리자라는 점, `.env` → `config/*.php` → `config()` 의 흐름과 `env()` 를 코드에서 쓰면 안 되는 이유, `composer.json` 의 `files` 로 자동 로드되는 `app/helpers.php`(`lroute`·`lurl`)를 다룬다. 끝에 `/ko/tutor/schedule` GET 요청을 파일 단위로 따라가는 실습 절차가 있다.

### 2단계 라우트 → [references/routing.md](references/routing.md)

`Route::get/post/put/delete` 로 URL 과 HTTP 메서드를 컨트롤러에 잇는 법을 다룬다. 연결 방식 네 가지(클로저, `[Controller::class, 'method']`, 단일 액션 `__invoke` 인 `MeController`, 화면만 있는 `Route::view`), 라우트 이름과 `route()`·`lroute()`, `{tutor}` 매개변수와 `whereNumber`, 라우트 모델 바인딩과 PES 가 대신 쓰는 "관계로 찾기" 패턴, `middleware('auth')`·`guest`·`throttle:10,1` 과 그룹, PES 가 `AppServiceProvider` 에 만든 `Route::localized` 매크로(같은 라우트를 `/…` 와 `/ko/…` 로 두 번 등록), 미들웨어 클래스(`SetLocale`·`LogoutSuspended`)의 `handle($request, $next)` 구조, 세션 있는 `web.php` 와 캐시용 `public.php` 의 차이를 설명한다.

### 3단계 컨트롤러·검증 → [references/controllers.md](references/controllers.md)

컨트롤러가 `$_GET`·`$_POST`·`header('Location')` 대신 무엇을 쓰는지 다룬다. `Request` 의 입력 메서드(`input`·`string`·`integer`·`boolean`·`hasFile`·`user`), `$request->validate()` 가 실패하면 예외 → 이전 페이지로 되돌아가 `$errors`·`old()` 가 채워지는 자동 흐름, 규칙 문법(`required`·`between`·`Rule::unique`), FormRequest 의 `rules()`·`after()`·`attributes()`·`validated()`·`safe()`(`StoreTutorSlotRequest`), 응답 종류(`view`·`redirect()->to`·`back`·`intended`·`with` flash·`withErrors`·`response()->json`), `LoginController` 의 `Auth::attempt`·세션 재생성, 정책(`TutorProfilePolicy`)과 `Gate::authorize`, `firstOrNew`+`fill`+`save`·`forceFill` 저장 패턴을 PES 코드로 보여 준다.

### 4단계 Eloquent → [references/eloquent.md](references/eloquent.md)

가장 긴 문서다. 모델 = 테이블 규칙과 바꾸는 법(`UPDATED_AT = null`), 조회(`find`·`findOrFail`·`firstWhere`·`sole`·`where` 사슬·`exists`·`pluck`), 쓰기(`create`·`fill`+`save`·`update`·`delete`·`firstOrCreate`·`firstOrNew`·`forceFill`·`wasRecentlyCreated`), `#[Fillable]` 대량 할당 보호와 "조용히 버림", casts(`date`·`array`·`boolean`·`hashed`·enum)와 `$attributes` 기본값, 관계(`hasOne`·`hasMany`·`belongsTo`)와 괄호 규칙, `with()` 즉시 로딩과 N+1, `whereHas`, 로컬 스코프(`visible`·`search`·`ranked`) 사슬, 모델 이벤트(`booted()` 의 `saving` 으로 완성도 자동 계산), 원시 SQL(`selectRaw`·`orderByRaw`·`DB::statement`, `Ranking`), Collection(`groupBy`·`contains`·`map`), `simplePaginate` 를 다룬다.

### 5단계 Blade → [references/blade.md](references/blade.md)

`<?= htmlspecialchars($x) ?>` 가 `{{ $x }}` 가 되는 것부터 시작한다. 출력 세 가지(`{{ }}`·`{!! !!}`·`{{-- --}}`), 조건·반복 지시어(`@if`·`@unless`·`@isset`·`@forelse`·`$loop`), 레이아웃 상속(`layouts/app.blade.php` 의 `@yield` ↔ `tutor/schedule.blade.php` 의 `@extends`·`@section` — 순수 PHP 의 `ob_start()`+맨 끝 `include` 와 클래스 상속에 대어 본 실행 순서, `@show`·`@parent`, 여러 단계 상속, `@stack`·`@push`), `@include` 부분 화면(`partials/form-errors`), 컴포넌트(`<x-tutor.profile-item>` 파일 위치, `@props`, 기본 `$slot`, 이름 있는 슬롯 `<x-slot:value>`, `:` 로 PHP 값 넘기기), 폼 지시어(`@csrf`·`@method`·`@error`·`@selected`·`@checked`·`old()`), flash 메시지 표시, 번역 `__()` 와 자리표시자, Alpine.js 속성(`x-data`)과 Blade 가 섞일 때 읽는 법, 뷰에서 자주 쓰는 헬퍼·유틸리티(`route()`·`asset()`·`@session`·`@auth`·`@env`·`Str`·`Number`·Carbon·`@class`·`@includeWhen`·`@use`·`@dump`)와 뷰에서 하지 말 것을 다룬다.

### 6단계 DB 구조 → [references/database.md](references/database.md)

마이그레이션을 "테이블 구조의 git" 으로 설명한다. 파일 이름의 날짜가 실행 순서라는 점, `up()`·`down()`, `Schema::create`·`Schema::table`, 컬럼 타입 표(`id`·`foreignId()->constrained()->cascadeOnDelete()`·`unsignedTinyInteger`·`time`·`timestampsTz`·`nullable`·`default`·`unique`·`index`), PES 가 `DB::statement` 로 거는 CHECK 제약, `is_trial` 칸을 없애고 데이터를 옮긴 실제 이력(`move_free_trial_to_tutor_profiles`), `migrate`·`migrate:status`·`rollback`·`fresh` 와 운영 주의점, 팩토리(`definition`·`fake()`·`state`·`for`)와 `tests/Pest.php` 의 `makeTutor()`, 시더를 다룬다.

### 7단계 테스트 → [references/testing.md](references/testing.md)

PES 테스트가 Pest 로 쓰이는 이유와 구조(`tests/Pest.php` 가 `Feature` 에만 `TestCase` 를 붙임)부터 시작한다. `RefreshDatabase` 와 `phpunit.xml` 의 테스트 DB(`pes_test`), HTTP 테스트(`actingAs`·`from`·`get`·`post`·`put`), 응답 검사(`assertOk`·`assertRedirect`·`assertSee`·`assertSessionHasErrors`), `expect()->toBe()`·`sole()`·`fresh()`, 데이터셋 `->with()`, 테스트 도우미(`makeTutor`·`escrowTutor`·`addSlot`), 실행 명령(`--filter`)을 `TutorScheduleTest.php` 로 읽는다. 이 저장소에서 테스트는 AI 가 쓸 수 있는 예외 영역이라는 점도 적는다.

### 수시 명령 → [references/artisan.md](references/artisan.md)

Artisan 을 "Laravel 전용 CLI" 로 소개하고, 매일 쓰는 명령, 스스로 조사할 때 쓰는 명령(`route:list`·`model:show`·`db:table`·`config:show`·`about`·`schedule:list`), 파일을 만드는 `make:*` 표와 자주 쓰는 옵션(`-mf`·`--invokable`), 캐시 명령과 쓸 때, `tinker` 사용법, PES 가 직접 만든 명령 `user:role`(`SetUserRole` — `$signature` 문법·인자·옵션·`info`/`error`·종료 코드)을 다룬다.

### 수시 함정 → [references/pitfalls.md](references/pitfalls.md)

PHP 는 잘하지만 Laravel 이 처음인 사람이 실제로 빠지는 함정 12개를 "증상 → 원인 → 올바른 코드" 로 정리한다. `env()` 직접 호출, 대량 할당이 조용히 버려짐, N+1, 괄호 규칙 혼동, Collection 을 배열로 다룸, 419(CSRF)와 `@method`, 남의 데이터 조회, flash 가 한 번만 보이는 이유, Carbon 이 바뀌는(mutable) 객체라는 점, 설정·라우트 캐시, 쿼리 빌더 `update()` 가 모델 이벤트를 건너뛰어 PES 완성도 점수가 다시 계산되지 않는 문제, PES `public.php` 라우트에서 `$request->user()` 가 늘 `null` 인 이유를 다룬다.

### 퀴즈·실습 → [references/exercises.md](references/exercises.md)

퀴즈를 내고 채점하는 절차, 단계별 문제 은행(개념 문제와 PES 코드 읽기 문제, 정답·해설 포함), `tinker` 에서 해 보는 조회 실습, PES 저장소 밖 연습 프로젝트에서 사용자가 직접 만드는 "미니 게시판" 과제(라우트 → 마이그레이션 → 모델 → 컨트롤러 → Blade → 테스트 순서, 단계별 확인 기준)를 담고 있다.

### 심화 관계 심화 → [references/relations.md](references/relations.md)

다대다·피벗·관계 집계·다형 — belongsToMany·피벗 테이블·sync, hasManyThrough, 다형 관계, withCount·whereRelation, 제약 있는 즉시 로딩. 마치면: 글–태그 같은 다대다 관계를 만들고 sync 로 고치며, withCount 로 개수를 N+1 없이 센다.

### 심화 Eloquent 더 → [references/eloquent-plus.md](references/eloquent-plus.md)

접근자·소프트 삭제·전역 스코프·엄격 모드·대량 처리 — Attribute::make 접근자·변경자, SoftDeletes, 전역 스코프, shouldBeStrict, chunkById·lazy·upsert, 옵저버. 마치면: 접근자·소프트 삭제·엄격 모드를 쓰고, 많은 행을 메모리 걱정 없이 처리한다.

### 심화 트랜잭션·잠금 → [references/transactions.md](references/transactions.md)

DB::transaction·잠금·경쟁 조건 — DB::transaction, afterCommit, lockForUpdate, 낙관적 잠금, createOrFirst·upsert, 원자적 증가, DB 제약. 마치면: 여러 저장을 한 트랜잭션으로 묶고, 동시에 두 요청이 와도 데이터가 깨지지 않게 만든다.

### 심화 파일·캐시 → [references/files-cache.md](references/files-cache.md)

파일 업로드·저장소와 캐시 — 업로드 검증·store, Storage 디스크, storage:link, Cache::remember, 캐시 무효화, Cache::lock. 마치면: 파일을 검증해 디스크에 저장하고 URL 로 보여 주며, 느린 계산을 캐시하고 제때 지운다.

### 심화 큐·이벤트·메일 → [references/queues.md](references/queues.md)

요청 밖에서 일하기 — ShouldQueue 잡, queue:work·restart, 이벤트·리스너, Mailable, 알림, routes/console.php 스케줄, 페이크 테스트. 마치면: 느린 일을 잡으로 큐에 넘기고, 메일·알림을 보내고, 정해진 시각에 명령을 돌린다.

### 심화 JSON API → [references/api.md](references/api.md)

api 라우트·API Resource·Sanctum — install:api, apiResource, API Resource, 422·404 JSON 오류, Sanctum 토큰, 상태 코드, API 테스트. 마치면: JSON API 를 만들고 Resource 로 응답 모양을 정하며, 토큰으로 인증하고 테스트한다.

### 심화 보안 → [references/security.md](references/security.md)

Laravel 이 대신 막아 주는 것과 내가 막아야 할 것 — XSS·CSRF·SQL 인젝션·대량 할당·권한·비밀번호·암호화·요청 제한·서명된 URL·업로드 검증. 마치면: 공격마다 Laravel 이 막아 주는 것과 내가 막아야 할 것을 구분해 말한다.

### 심화 디버깅·로그 → [references/debugging.md](references/debugging.md)

디버깅·로그·예외 처리 — 디버깅 순서, dump·dd, toRawSql·쿼리 로그, Log 채널·pail, withExceptions, abort, 오류 화면·APP_DEBUG. 마치면: 오류가 나면 로그 → 라우트 → tinker → dd 순서로 원인을 좁히고, 예외를 원하는 응답으로 바꾼다.

### 심화 배포 → [references/deploy.md](references/deploy.md)

로컬에서 운영 서버로 — 운영 .env, composer install --no-dev, migrate --force, optimize, Vite 빌드, storage:link, queue:restart, /up. 마치면: 배포 순서를 체크리스트로 말하고, 배포 뒤 흔한 오류(캐시·권한·manifest)를 스스로 고친다.
