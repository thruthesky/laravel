# 7단계 — Pest 테스트

## 목차

1. [PES 테스트의 모양](#1-pes-테스트의-모양)
2. [구조 — tests/Pest.php 와 Feature·Unit](#2-구조--testspestphp-와-featureunit)
3. [DB 를 쓰는 테스트 — RefreshDatabase](#3-db-를-쓰는-테스트--refreshdatabase)
4. [HTTP 요청 보내기](#4-http-요청-보내기)
5. [응답 검사](#5-응답-검사)
6. [값 검사 — expect()](#6-값-검사--expect)
7. [데이터셋 — ->with()](#7-데이터셋---with)
8. [테스트 한 편 통째로 읽기](#8-테스트-한-편-통째로-읽기)
9. [실행](#9-실행)
10. [암기 카드](#10-암기-카드)

---

## 1. PES 테스트의 모양

### 핵심 개념

Pest 는 PHPUnit 위에서 도는 테스트 도구다. 클래스·메서드 대신 **`it('문장', 함수)`** 로 쓴다. 테스트 이름이 영어 문장처럼 읽힌다.

```php
// PHPUnit 방식 (PES 에서 새로 쓰지 않음)
class TutorScheduleTest extends TestCase {
    public function test_adds_a_weekly_class_time() { ... }
}

// Pest 방식 (PES)
it('adds a weekly class time', function () { ... });
```

PES 규칙([AGENTS.md](../../../../AGENTS.md) "테스트" 절):

- 새 테스트는 Pest 로 쓴다.
- 기대값은 **PES-SSOT.md 의 규정**에서 옮긴다. 지금 코드가 내는 값을 베끼지 않는다.
- 이 저장소에서 `tests/` 는 AI 가 직접 쓸 수 있는 예외 영역이다(소스 코드는 사람이 쓴다).

---

## 2. 구조 — tests/Pest.php 와 Feature·Unit

```
tests/
├── Pest.php          전체 설정 + 공용 도우미 함수
├── TestCase.php      Laravel 기능을 붙인 기본 클래스
├── Feature/          HTTP·DB·설정이 필요한 테스트 (대부분)
└── Unit/             순수 함수·클래스만
```

### PES 코드 — `tests/Pest.php`

```php
pest()->extend(Tests\TestCase::class)->in('Feature');   // Feature 에만 Laravel 기능($this->get() 등)을 붙인다

/** 목록에 나오는 강사(완성도 100점). */
function makeTutor(array $profile = [], string $timezone = 'UTC'): User { ... }

/** 에스크로 강사. */
function escrowTutor(array $profile = [], string $timezone = 'UTC'): User { ... }
```

`tests/Unit` 에서는 `$this->get()`·`config()` 같은 Laravel 기능을 쓸 수 없다. 도우미 함수는 전역이라 **다른 파일과 이름이 겹치면 안 된다.**

---

## 3. DB 를 쓰는 테스트 — RefreshDatabase

```php
pest()->use(RefreshDatabase::class);   // 이 파일의 테스트는 DB 를 쓴다
```

- 첫 테스트 전에 테스트 DB 에 마이그레이션을 한 번 적용한다.
- **테스트마다 트랜잭션을 열고 끝나면 롤백**한다 → 테스트끼리 데이터가 섞이지 않는다.
- 테스트 DB 는 `phpunit.xml` 이 정한다: `DB_CONNECTION=pgsql`, `DB_DATABASE=pes_test`. 개발 DB 의 데이터는 건드리지 않는다.
- 테스트 데이터는 팩토리로 만든다 → [database.md 8절](database.md#8-팩토리--테스트용-가짜-데이터).

---

## 4. HTTP 요청 보내기

실제 브라우저 없이 앱 안에서 요청을 흉내 낸다.

```php
$this->get('/tutor/schedule');
$this->post('/tutor/schedule/slots', ['weekday' => 1, ...]);
$this->put('/tutor/schedule/trial', ['trial_enabled' => 1]);
$this->delete('/tutor/schedule/slots/5');

$this->actingAs($user)->get(...);             // $user 로 로그인한 상태로
$this->from('/tutor/schedule')->post(...);    // "이전 페이지" 를 정함 → 검증 실패 시 back() 이 여기로
```

CSRF 검사는 테스트에서 자동으로 꺼진다.

---

## 5. 응답 검사

| 메서드 | 검사 |
|---|---|
| `->assertOk()` | 200 |
| `->assertStatus(403)` · `->assertNotFound()` · `->assertForbidden()` | 상태 코드 |
| `->assertRedirect('/tutor/profile')` | 그 주소로 redirect |
| `->assertSee('월요일')` · `->assertDontSee(...)` | 응답 본문에 글자가 (이스케이프 후) 있나 |
| `->assertSessionHasErrors('starts_at')` | 그 칸에 검증 오류 |
| `->assertSessionHasNoErrors()` | 검증 오류 없음 |
| `->assertJson([...])` | JSON 일부 일치 |

---

## 6. 값 검사 — expect()

```php
expect($value)->toBe(10);               // === 비교
expect($value)->toEqual([...]);         // == 비교
expect($flag)->toBeTrue() / ->toBeFalse() / ->toBeNull();
expect($list)->toHaveCount(3);
expect($text)->toContain('강사');
expect($x)->not->toBe(0);               // 부정
```

DB 에서 다시 읽을 때 자주 쓰는 것:

```php
$tutor->tutorSlots()->sole();           // 딱 한 행이어야 — 0개나 2개면 테스트 실패
$tutor->tutorProfile->fresh();          // DB 에서 다시 읽은 새 객체 (메모리 속 옛 값 말고)
```

---

## 7. 데이터셋 — ->with()

입력만 다르고 검사가 같은 테스트는 하나로 묶는다.

### PES 코드 — `tests/Feature/TutorScheduleTest.php`

```php
it('refuses class times that overlap', function (array $existing, array $new) {
    $tutor = makeTutor();
    $tutor->tutorSlots()->create(['points' => 10_000, ...$existing]);

    addSlot($tutor, $new)->assertSessionHasErrors('starts_at');
})->with([
    'same day' => [['weekday' => 1, 'starts_at' => '09:00', 'duration_minutes' => 50], ['weekday' => 1, 'starts_at' => '09:30']],
    'past midnight' => [['weekday' => 2, 'starts_at' => '23:30', 'duration_minutes' => 60], ['weekday' => 3, 'starts_at' => '00:15']],
    'saturday into sunday' => [['weekday' => 6, 'starts_at' => '23:30', 'duration_minutes' => 60], ['weekday' => 0, 'starts_at' => '00:00']],
]);
```

데이터셋의 키(`'same day'`)가 테스트 결과에 이름으로 나온다. 경계값(자정 넘김, 토→일)을 한눈에 볼 수 있다.

---

## 8. 테스트 한 편 통째로 읽기

### PES 코드 — `tests/Feature/TutorScheduleTest.php` (발췌)

```php
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;

pest()->use(RefreshDatabase::class);

// 파일 전용 도우미 — 시간표 칸 하나를 추가하는 요청
function addSlot(User $tutor, array $fields): TestResponse
{
    return test()->actingAs($tutor)->from('/tutor/schedule')->post('/tutor/schedule/slots', [
        'weekday' => 1, 'starts_at' => '09:00', 'duration_minutes' => 50, 'points' => 10_000, ...$fields,
    ]);
}

// ① 프로필이 없으면 시간표 대신 프로필 화면으로
it('asks for a tutor profile before the schedule', function () {
    $this->actingAs(User::factory()->create())->get('/tutor/schedule')->assertRedirect('/tutor/profile');
});

// ② 한국어 주소에서는 요일·포인트가 한국어로
it('shows the schedule in the viewer language', function () {
    $tutor = makeTutor();
    $tutor->tutorSlots()->create(['weekday' => 1, 'starts_at' => '09:00', 'duration_minutes' => 50, 'points' => 10_000]);

    $this->actingAs($tutor)->get('/ko/tutor/schedule')->assertOk()->assertSee('월요일')->assertSee('10,000포인트');
});

// ③ 저장되고, DB 에 정확히 들어갔나
it('adds a weekly class time', function () {
    $tutor = makeTutor();

    addSlot($tutor, [])->assertRedirect('/tutor/schedule')->assertSessionHasNoErrors();

    expect($tutor->tutorSlots()->sole()->only('weekday', 'starts_at', 'points'))
        ->toBe(['weekday' => 1, 'starts_at' => '09:00:00', 'points' => 10_000]);
});

// ④ 규정 검사 — 직거래 강사·별점 없는 강사는 무료 체험을 켤 수 없다
it('lets only escrow tutors with a PES rating allow free trials', function () {
    $allow = fn (User $tutor) => $this->actingAs($tutor)->from('/tutor/schedule')->put('/tutor/schedule/trial', ['trial_enabled' => 1]);

    $allow(makeTutor(['admin_stars' => 4]))->assertSessionHasErrors('trial_enabled');   // 직거래 강사
    $allow(escrowTutor())->assertSessionHasErrors('trial_enabled');                     // 별점 없음

    $tutor = escrowTutor(['admin_stars' => 4]);
    $allow($tutor)->assertRedirect('/tutor/schedule')->assertSessionHasNoErrors();
    expect($tutor->tutorProfile->fresh()->offersTrial())->toBeTrue();
});
```

읽는 법 — 각 테스트는 **준비(Arrange) → 실행(Act) → 검사(Assert)** 세 줄 묶음이다.

| 테스트 | 준비 | 실행 | 검사 | 배우는 Laravel 개념 |
|---|---|---|---|---|
| ① | 프로필 없는 회원 | GET | redirect | 컨트롤러의 조건 redirect |
| ② | 강사 + 칸 1개 | GET `/ko/...` | 한국어 글자 | `Route::localized`·`SetLocale`·번역 |
| ③ | 강사 | POST | redirect + DB 값 | FormRequest·관계 `create`·`sole()` |
| ④ | 세 종류 강사 | PUT | 오류 / 성공 + DB | `withErrors`·`forceFill`·`fresh()` |

`starts_at` 이 `'09:00:00'` 인 이유: DB 의 `time` 칸이 초까지 돌려준다. 그래서 모델에 `startTime()`(→ `'09:00'`)이 있다.

---

## 9. 실행

```bash
docker compose exec app php artisan test                                        # 전부
docker compose exec app php artisan test tests/Feature/TutorScheduleTest.php    # 파일 하나
docker compose exec app php artisan test --filter="overlap"                     # 이름에 overlap 이 든 것
```

실패하면 어느 `assert` 에서 무엇이 달랐는지 나온다. 테스트를 코드에 맞춰 약하게 고치지 않는다 — 먼저 어느 쪽이 SSOT 와 다른지 본다.

---

## 10. 암기 카드

| 질문 | 답 |
|---|---|
| Pest 테스트 한 개의 형태는? | `it('문장', function () { ... });` |
| Laravel 기능이 붙는 폴더는? | `tests/Feature` (`tests/Pest.php` 의 `->in('Feature')`) |
| 테스트마다 DB 를 깨끗하게 하는 것은? | `RefreshDatabase` (트랜잭션 롤백) |
| 테스트 DB 이름은? | `pes_test` (`phpunit.xml`) |
| 로그인한 상태로 요청하려면? | `$this->actingAs($user)` |
| 검증 실패 시 돌아갈 "이전 페이지"를 정하려면? | `->from('/주소')` |
| 칸에 검증 오류가 있는지 보는 검사는? | `assertSessionHasErrors('칸')` |
| DB 에서 다시 읽은 모델은? | `$model->fresh()` |
| 입력만 다른 테스트를 묶는 법은? | `->with([...])` 데이터셋 |
| 이름으로 골라 실행하는 옵션은? | `--filter=` |
| 테스트의 기대값은 어디서 가져오나? (PES) | PES-SSOT.md 규정 — 지금 코드 값이 아니다 |
