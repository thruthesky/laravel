# 6단계 — 마이그레이션·팩토리·시더

## 목차

1. [마이그레이션 = 테이블 구조의 git](#1-마이그레이션--테이블-구조의-git)
2. [파일 구조 — up·down](#2-파일-구조--updown)
3. [컬럼 타입과 수식어](#3-컬럼-타입과-수식어)
4. [테이블 바꾸기 — Schema::table](#4-테이블-바꾸기--schematable)
5. [DB 제약 — PES 의 CHECK](#5-db-제약--pes-의-check)
6. [실제 이력 읽기 — 무료 체험을 옮긴 마이그레이션](#6-실제-이력-읽기--무료-체험을-옮긴-마이그레이션)
7. [마이그레이션 명령과 주의](#7-마이그레이션-명령과-주의)
8. [팩토리 — 테스트용 가짜 데이터](#8-팩토리--테스트용-가짜-데이터)
9. [시더](#9-시더)
10. [암기 카드](#10-암기-카드)

---

## 1. 마이그레이션 = 테이블 구조의 git

### 핵심 개념

테이블을 DB 도구로 직접 만들거나 `ALTER` 하지 않는다. **바꿀 내용을 PHP 파일로 적고 `migrate` 로 적용한다.** 그러면

- 모든 개발자·서버의 DB 구조가 같아진다(`git pull` → `migrate`).
- 누가 언제 무엇을 바꿨는지 파일로 남는다.
- 적용한 파일은 `migrations` 테이블에 기록되어 **두 번 실행되지 않는다.**

### 순수 PHP 와 비교

| 순수 PHP 프로젝트 | Laravel |
|---|---|
| `schema.sql` 하나를 계속 고침 | 변경마다 새 파일 하나 |
| 서버에 접속해 `ALTER TABLE` 직접 | `php artisan migrate` |
| 어떤 서버에 어떤 ALTER 를 했는지 기억 | `migrations` 테이블이 기억 |

**핵심 로직 — 이미 적용한 파일은 고치지 않는다.** 고쳐도 이미 적용된 DB 에는 다시 실행되지 않는다. 바꿀 것이 생기면 **새 마이그레이션**을 만든다.

---

## 2. 파일 구조 — up·down

파일 이름 앞의 날짜가 **실행 순서**다: `2026_09_23_102122_create_tutor_slots_table.php`.

### PES 코드 — `database/migrations/2026_09_23_102122_create_tutor_slots_table.php` (처음 모습)

```php
return new class extends Migration          // 익명 클래스 (Laravel 9+) — 클래스 이름 충돌이 없다
{
    public function up(): void              // 적용할 때
    {
        Schema::create('tutor_slots', function (Blueprint $table) {
            $table->id();                                                       // bigint 자동 증가 기본 키
            $table->foreignId('tutor_id')->constrained('users')->cascadeOnDelete();  // users.id 외래 키, 회원 삭제 시 함께 삭제
            $table->unsignedTinyInteger('weekday');                             // 0 = 일요일 … 6 = 토요일
            $table->time('starts_at');                                          // '09:00'
            $table->unsignedSmallInteger('duration_minutes');
            $table->unsignedBigInteger('points');
            $table->boolean('is_trial')->default(false);                        // ← 나중 마이그레이션에서 지워짐 (6절)
            $table->timestampsTz();                                             // created_at, updated_at (시간대 포함)

            $table->unique(['tutor_id', 'weekday', 'starts_at']);              // 복합 유일
        });
    }

    public function down(): void            // 되돌릴 때 (rollback)
    {
        Schema::dropIfExists('tutor_slots');
    }
};
```

---

## 3. 컬럼 타입과 수식어

| 메서드 | PostgreSQL 타입 | 비고 |
|---|---|---|
| `id()` | `bigserial` 기본 키 | |
| `foreignId('user_id')` | `bigint` | `->constrained()` 를 붙이면 외래 키 |
| `string('name', 100)` | `varchar(100)` | 기본 255 |
| `text('bio')` | `text` | |
| `integer` · `unsignedSmallInteger` · `unsignedTinyInteger` · `unsignedBigInteger` | 정수 | |
| `boolean('x')` | `boolean` | |
| `date` · `time` · `timestampTz` | 날짜·시각 | `Tz` = 시간대 포함 |
| `timestamps()` / `timestampsTz()` | `created_at`·`updated_at` | |
| `json('subjects')` | `json` | 모델에서 `array` cast |

| 수식어 | 뜻 |
|---|---|
| `->nullable()` | NULL 허용 (기본은 NOT NULL) |
| `->default(0)` | 기본값 |
| `->unique()` / `$table->unique([...])` | 유일 |
| `->index()` / `$table->index('x')` | 인덱스 |
| `->constrained('users')` | 외래 키 (테이블 이름을 규칙으로 추측, 다르면 적는다) |
| `->cascadeOnDelete()` / `->nullOnDelete()` | 부모 삭제 시 함께 삭제 / NULL 로 |

---

## 4. 테이블 바꾸기 — Schema::table

### PES 코드 — `2026_09_25_074256_add_admin_controls_to_tutor_profiles_table.php` (발췌)

```php
public function up(): void
{
    Schema::table('tutor_profiles', function (Blueprint $table) {      // create 가 아니라 table
        $table->unsignedSmallInteger('priority_display_score')->default(0);
        $table->index('priority_display_score');

        $table->timestampTz('hidden_at')->nullable();           // 숨김: null = 꺼짐, 시각 = 켠 때
        $table->timestampTz('booking_locked_at')->nullable();   // 예약 잠금
    });
}

public function down(): void
{
    Schema::table('tutor_profiles', function (Blueprint $table) {
        $table->dropColumn(['priority_display_score', 'hidden_at', 'booking_locked_at']);
    });
}
```

**PES 패턴 — 켜고 끄는 값을 시각으로**: `boolean hidden` 대신 `timestampTz hidden_at nullable`. `null` 이면 꺼짐, 값이 있으면 켜짐 + **언제 켰는지**가 남는다. 모델에서는 `$profile->hidden_at !== null` 로 판단한다.

---

## 5. DB 제약 — PES 의 CHECK

Laravel 스키마 빌더에 없는 기능은 `DB::statement()` 로 SQL 을 직접 쓴다. PES 는 **잘못된 값이 DB 에 들어가지 못하게** CHECK 제약을 건다 — 검증을 빠뜨린 코드가 있어도 DB 가 막는다.

### PES 코드 — `2026_09_23_153033_add_status_to_users_table.php`

```php
Schema::table('users', function (Blueprint $table) {
    $table->string('status', 20)->default('active')->index();
});

DB::statement("ALTER TABLE users ADD CONSTRAINT users_status CHECK (status IN ('active', 'suspended'))");
```

### PES 코드 — 상한을 설정에서 읽는 CHECK

```php
// 상한은 설정에서 읽는다 — 설정을 바꾸면 새 마이그레이션으로 이 CHECK 도 바꾼다
$max = (int) config('tutor.priority_display_score_max');
DB::statement("ALTER TABLE tutor_profiles ADD CONSTRAINT tutor_profiles_priority_display_score
    CHECK (priority_display_score BETWEEN 0 AND {$max})");
```

---

## 6. 실제 이력 읽기 — 무료 체험을 옮긴 마이그레이션

### 핵심 개념

규정이 바뀌면 구조도 바뀐다. 처음 `tutor_slots` 에는 칸마다 `is_trial` 이 있었지만, "무료 체험은 강사 한 명에 하나인 설정"으로 규정이 바뀌어 **새 마이그레이션이 구조와 데이터를 함께 옮겼다.** 처음 파일(2절)은 고치지 않았다.

### PES 코드 — `2026_09_24_014714_move_free_trial_to_tutor_profiles.php` (발췌)

```php
public function up(): void
{
    // ① 새 칸 추가
    Schema::table('tutor_profiles', function (Blueprint $table) {
        $table->boolean('trial_enabled')->default(false);
    });

    // ② 데이터 옮기기 — 옛 무료 체험 칸이 있던 강사는 허용을 켠다
    DB::statement('UPDATE tutor_profiles SET trial_enabled = true
        WHERE user_id IN (SELECT tutor_id FROM tutor_slots WHERE is_trial)');
    DB::statement('DELETE FROM tutor_slots WHERE is_trial');

    // ③ 옛 제약·칸 제거, 새 제약
    DB::statement('ALTER TABLE tutor_slots DROP CONSTRAINT tutor_slots_valid');
    Schema::table('tutor_slots', function (Blueprint $table) {
        $table->dropColumn('is_trial');
    });
    DB::statement('ALTER TABLE tutor_slots ADD CONSTRAINT tutor_slots_valid
        CHECK (weekday BETWEEN 0 AND 6 AND duration_minutes > 0 AND points > 0)');
}
```

`down()` 은 이 순서를 거꾸로 되돌린다(지운 데이터는 되살리지 못한다). 지금 `tutor_slots` 의 실제 모양은 `php artisan db:table tutor_slots` 로 본다 — 파일 하나만 보고 판단하지 않는다.

---

## 7. 마이그레이션 명령과 주의

```bash
docker compose exec app php artisan make:migration create_posts_table          # 새 테이블 (이름에서 추측해 Schema::create 틀)
docker compose exec app php artisan make:migration add_status_to_users_table   # 칸 추가 (Schema::table 틀)
docker compose exec app php artisan migrate                # 아직 안 한 파일 적용
docker compose exec app php artisan migrate:status         # 파일별 적용 여부
docker compose exec app php artisan migrate:rollback       # 마지막 묶음 되돌리기 (down)
docker compose exec app php artisan migrate:fresh --seed   # ⚠ 모든 테이블 삭제 후 처음부터 + 시더
docker compose exec app php artisan db:table tutor_slots   # 지금 테이블 구조
```

- `migrate:fresh` 는 **데이터를 전부 지운다.** 로컬 전용. 운영 서버에서는 절대 쓰지 않는다.
- 운영 배포는 `migrate`(앞으로만)만 쓴다.
- 테스트는 `RefreshDatabase` 가 테스트 DB(`pes_test`)에서 알아서 마이그레이션한다([testing.md 3절](testing.md#3-db-를-쓰는-테스트--refreshdatabase)).

---

## 8. 팩토리 — 테스트용 가짜 데이터

### 핵심 개념

팩토리는 **"이 모델의 그럴듯한 한 행"을 만드는 설계도**다. 테스트마다 INSERT 문을 쓰지 않는다. 팩토리로 만든 값은 Fillable 을 무시한다(`admin_stars` 처럼 막아 둔 칸도 넣을 수 있다).

### PES 코드 — `database/factories/TutorProfileFactory.php`

```php
/** 모든 칸을 채운 강사 프로필(완성도 100점 → 목록에 나온다). @extends Factory<TutorProfile> */
class TutorProfileFactory extends Factory
{
    public function definition(): array            // 기본 값
    {
        return [
            'user_id' => User::factory(),           // 관계 — 회원도 함께 만든다
            'real_name' => fake()->name(),          // Faker 가짜 이름
            'headline' => fake()->sentence(6),
            'subjects' => ['Math'],
            'languages' => ['en'],
            'country' => 'KR',
            // …
        ];
    }

    public function starred(int $stars = 5): static   // 상태(state) — 변형
    {
        return $this->state(['admin_stars' => $stars]);
    }
}
```

사용:

```php
User::factory()->create();                                   // 회원 1명 INSERT
User::factory()->count(10)->create();                        // 10명
User::factory()->make();                                     // 객체만 (저장 안 함)
TutorProfile::factory()->starred(4)->create();               // 별점 4 강사
TutorProfile::factory()->create(['escrow_at' => now()]);     // 값 덮어쓰기
TutorProfile::factory()->for(User::factory()->state(['timezone' => 'Asia/Seoul']))->create();   // 부모 지정
```

모델에 `use HasFactory;` 가 있어야 `Model::factory()` 를 쓸 수 있다.

### PES 코드 — 팩토리를 감싼 테스트 도우미 `tests/Pest.php`

```php
/** 목록에 나오는 강사(완성도 100점). 속성은 tutor_profiles 칸. */
function makeTutor(array $profile = [], string $timezone = 'UTC'): User
{
    return TutorProfile::factory()
        ->for(User::factory()->state(['timezone' => $timezone]))
        ->create($profile)
        ->user;
}

/** 에스크로 강사(포인트로 수업료를 받는다). */
function escrowTutor(array $profile = [], string $timezone = 'UTC'): User
{
    return makeTutor(['escrow_at' => now(), 'payout_method' => 'paypal', 'payout_account' => 'tutor@example.com', ...$profile], $timezone);
}
```

---

## 9. 시더

시더는 **개발용 DB 에 처음 데이터를 넣는** 코드다. `migrate:fresh --seed` 나 `db:seed` 가 실행한다.

### PES 코드 — `database/seeders/DatabaseSeeder.php`

```php
public function run(): void
{
    User::factory()->create([
        'name' => 'Test User',
        'email' => 'test@example.com',
    ]);
}
```

PES 의 실제 초기 데이터(시험 문항·번역)는 시더가 아니라 직접 만든 Artisan 명령(`import:exam`, `import:messages`)이 넣는다([artisan.md 7절](artisan.md#7-직접-만든-명령--userrole)).

---

## 10. 암기 카드

| 질문 | 답 |
|---|---|
| 마이그레이션 실행 순서를 정하는 것은? | 파일 이름 앞의 날짜 |
| 이미 적용한 마이그레이션을 고쳐야 하면? | 고치지 않고 새 마이그레이션을 만든다 |
| `up()` 과 `down()` 은? | 적용 / 되돌리기 |
| 새 테이블과 기존 테이블 변경의 차이는? | `Schema::create` / `Schema::table` |
| NOT NULL 이 기본인가? | 그렇다. 허용하려면 `->nullable()` |
| `users.id` 를 가리키는 외래 키 한 줄은? | `$table->foreignId('user_id')->constrained()->cascadeOnDelete();` |
| 스키마 빌더에 없는 SQL 은? | `DB::statement('...')` |
| PES 가 켜고 끄는 값을 저장하는 방식은? | `timestampTz(...)->nullable()` — null=꺼짐, 시각=켠 때 |
| 적용 여부를 보는 명령은? | `migrate:status` |
| 로컬에서만 쓰는 위험한 명령은? | `migrate:fresh` (전부 삭제) |
| 팩토리의 기본 값 메서드는? | `definition()` |
| 팩토리 변형을 만드는 메서드는? | `state([...])` |
| 저장하지 않고 객체만 만드는 팩토리 메서드는? | `make()` |
| 팩토리는 Fillable 을 지키나? | 아니다 — 막아 둔 칸도 넣는다 |
