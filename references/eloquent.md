# 4단계 — Eloquent (ORM)

가장 많이 쓰고 가장 오래 걸리는 단계다. 2~3일을 잡는다.

## 목차

1. [모델 = 테이블 하나](#1-모델--테이블-하나)
2. [이름 규칙과 바꾸는 법](#2-이름-규칙과-바꾸는-법)
3. [조회](#3-조회)
4. [쓰기·고치기·지우기](#4-쓰기고치기지우기)
5. [대량 할당 보호 — #[Fillable]](#5-대량-할당-보호--fillable)
6. [casts 와 기본값](#6-casts-와-기본값)
7. [관계 — hasOne·hasMany·belongsTo](#7-관계--hasonehasmanybelongsto)
8. [즉시 로딩과 N+1](#8-즉시-로딩과-n1)
9. [로컬 스코프 — 이름 붙인 조건](#9-로컬-스코프--이름-붙인-조건)
10. [모델 이벤트](#10-모델-이벤트)
11. [원시 SQL 이 필요할 때](#11-원시-sql-이-필요할-때)
12. [Collection](#12-collection)
13. [페이지 나누기](#13-페이지-나누기)
14. [모델에 메서드 두기](#14-모델에-메서드-두기)
15. [암기 카드](#15-암기-카드)

---

## 1. 모델 = 테이블 하나

### 핵심 개념

Eloquent 는 **Active Record** 방식 ORM 이다. 모델 클래스 하나가 테이블 하나, 모델 객체 하나가 행 하나다. 객체가 자기 자신을 저장·삭제한다(`$slot->save()`, `$slot->delete()`).

### 순수 PHP 와 비교

```php
// 순수 PDO
$stmt = $pdo->prepare('SELECT * FROM tutor_slots WHERE tutor_id = ? ORDER BY weekday, starts_at');
$stmt->execute([$userId]);
$slots = $stmt->fetchAll(PDO::FETCH_ASSOC);          // 배열의 배열

// Eloquent
$slots = TutorSlot::where('tutor_id', $userId)->orderBy('weekday')->orderBy('starts_at')->get();
// 또는 관계로
$slots = $user->tutorSlots()->orderBy('weekday')->orderBy('starts_at')->get();   // TutorSlot 객체들의 Collection
```

바인딩(`?`)은 Eloquent 가 알아서 하므로 `where()` 에 사용자 입력을 넣어도 SQL 인젝션이 없다.

### PES 코드 — 가장 작은 모델 `app/Models/UserRole.php`

```php
#[Fillable(['role'])]
class UserRole extends Model
{
    protected function casts(): array
    {
        return ['role' => Role::class];     // 문자열 'admin' ↔ Role::Admin enum
    }
}
```

클래스 이름 `UserRole` → 테이블 `user_roles`. 칸 목록은 어디에도 적지 않는다 — **테이블에 있는 칸이 곧 속성**이다(`$role->user_id`, `$role->created_at`).

모델 구조를 한눈에 보는 명령: `docker compose exec app php artisan model:show TutorSlot`

---

## 2. 이름 규칙과 바꾸는 법

| 규칙 | 기본 | 바꾸는 법 |
|---|---|---|
| 테이블 이름 | 클래스 복수 snake_case | `protected $table = 'tutor_days_off';` 또는 `#[Table('...')]` |
| 기본 키 | `id` (자동 증가) | `protected $primaryKey = 'code';` |
| 시각 칸 | `created_at`·`updated_at` 자동 기록 | `public $timestamps = false;` |
| `updated_at` 만 없음 | — | `public const UPDATED_AT = null;` |

### PES 코드 — `app/Models/AdminLog.php` (추가만 하는 기록이라 updated_at 이 없다)

```php
/** 관리 기록 — 추가만 한다(admin_logs 트리거가 UPDATE·DELETE 를 막는다). */
#[Fillable(['admin_id', 'action', 'subject_type', 'subject_id', 'data'])]
class AdminLog extends Model
{
    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return ['data' => 'array'];
    }

    public static function record(?User $admin, string $action, Model $subject, array $data = []): self
    {
        return self::create([
            'admin_id' => $admin?->id,
            'action' => $action,
            'subject_type' => $subject->getTable(),   // 모델의 테이블 이름
            'subject_id' => $subject->getKey(),       // 모델의 기본 키 값
            'data' => $data,                          // 배열 → JSON 으로 저장 (array cast)
        ]);
    }
}
```

`TutorDayOff` 모델은 규칙대로면 `tutor_day_offs` 가 되지만 실제 테이블은 `tutor_days_off` 다. 이런 경우 `$table` 을 적는다 — 파일을 열어 확인해 보는 것이 좋은 연습이다.

---

## 3. 조회

| 코드 | 결과 | 없을 때 |
|---|---|---|
| `TutorSlot::find(3)` | 모델 | `null` |
| `TutorSlot::findOrFail(3)` | 모델 | 404 (`ModelNotFoundException`) |
| `User::firstWhere('email', $email)` | 모델 | `null` |
| `->first()` / `->firstOrFail()` | 첫 행 | `null` / 404 |
| `->sole()` | 딱 한 행 | 0개나 2개 이상이면 예외 |
| `->get()` | Collection | 빈 Collection |
| `->exists()` | bool | |
| `->count()` | int | |
| `->pluck('role')` | 한 칸만 모은 Collection | |
| `TutorSlot::all()` | 전부 | 테이블이 크면 쓰지 말 것 |

조건 잇기:

```php
TutorSlot::query()
    ->where('tutor_id', $id)                          // =
    ->where('duration_minutes', '<=', 15)             // 연산자
    ->whereIn('weekday', [1, 2, 3])
    ->whereNull('hidden_at')
    ->where(fn ($q) => $q->where(...)->orWhere(...))  // 괄호 묶기 ( A OR B )
    ->orderBy('weekday')->orderByDesc('id')
    ->limit(10)
    ->get();
```

`TutorSlot::where(...)` 와 `TutorSlot::query()->where(...)` 는 같다. `query()` 로 시작하면 줄 맞춤이 깔끔하고 IDE 자동 완성이 잘 된다.

### PES 코드 — 휴무일 조회 (`ScheduleController::index`)

```php
'daysOff' => $user->tutorDaysOff()
    ->where('date', '>=', now($user->timezone)->toDateString())   // 강사 시간대의 오늘부터
    ->orderBy('date')
    ->get(),
```

---

## 4. 쓰기·고치기·지우기

```php
// 새로 만들기
$slot = TutorSlot::create([...]);                  // INSERT 후 모델 반환 (Fillable 칸만)
$user->tutorSlots()->create($data);                // 관계로 — tutor_id 자동

$slot = new TutorSlot; $slot->weekday = 1; $slot->save();   // 속성 대입 후 저장

// 고치기
$slot->update(['points' => 12000]);                // Fillable 칸만
$slot->points = 12000; $slot->save();              // 바뀐 칸만 UPDATE

// 지우기
$slot->delete();
TutorSlot::where('tutor_id', $id)->delete();       // ⚠ 쿼리로 여러 행 — 모델 이벤트 없음

// 찾거나 만들기
User::firstOrCreate(['email' => $e], ['name' => $n]);   // 있으면 가져오고 없으면 INSERT
$user->tutorProfile()->firstOrNew();                    // 있으면 가져오고 없으면 새 객체(저장 안 함)
TutorProfile::updateOrCreate(['user_id' => $id], [...]);
```

### PES 코드 — 새로 만들었는지 알기 (`app/Console/Commands/SetUserRole.php`)

```php
$changed = $remove
    ? $user->roles()->where('role', $role)->delete() > 0          // 지운 행 수
    : $user->roles()->firstOrCreate(['role' => $role])->wasRecentlyCreated;   // 이번에 INSERT 했으면 true
```

---

## 5. 대량 할당 보호 — #[Fillable]

### 핵심 개념

`create($request->all())` 처럼 **배열을 통째로 넣는 것**을 대량 할당이라 한다. 사용자가 폼에 `is_admin=1` 을 끼워 보내면 위험하므로, 모델은 **허락한 칸만** 받는다.

```php
#[Fillable(['name', 'email', 'password', 'timezone'])]   // Laravel 13 속성 방식 (PES)
class User extends Authenticatable

protected $fillable = ['name', 'email', 'password', 'timezone'];   // 옛 방식 — 같은 뜻
```

**핵심 로직 — 조용히 버린다**: Fillable 에 없는 칸은 `create()`·`fill()`·`update()` 에서 **오류 없이 무시된다.** "저장했는데 값이 안 들어가요"의 1순위 원인이다.

| 방법 | Fillable 적용 |
|---|---|
| `create([...])`, `fill([...])`, `update([...])` | 적용 (없는 칸 버림) |
| `$model->칸 = 값` 직접 대입 | 적용 안 됨 |
| `forceFill([...])` | 적용 안 됨 — 일부러 바꿀 때 |
| 팩토리 `Model::factory()->create([...])` | 적용 안 됨 — 테스트용 |

### PES 에서 Fillable 로 통제하는 칸

| 모델 | Fillable 에 **없는** 칸 | 바꾸는 곳 |
|---|---|---|
| `User` | `status` | 관리 화면만 (`$attributes` 주석: "status 는 Fillable 이 아니다") |
| `TutorProfile` | `trial_enabled`, `escrow_at`, `admin_stars`, `hidden_at`, `profile_score` … | 검사를 거친 컨트롤러의 `forceFill`, 관리 화면, 모델 이벤트 |

### #[Hidden] — JSON 으로 내보낼 때 뺄 칸

```php
#[Hidden(['password', 'remember_token'])]   // $user->toArray(), toJson(), response()->json($user) 에서 빠진다
```

---

## 6. casts 와 기본값

### 핵심 개념

DB 는 문자열·숫자만 준다. casts 는 **읽을 때 PHP 타입으로, 저장할 때 DB 형식으로** 자동 변환한다. 칸을 만드는 쪽(마이그레이션의 `json`·`boolean`·`date` 타입)은 [database.md 3절](database.md#3-컬럼-타입과-수식어) 에 있다.

### PES 코드 — `User`·`TutorProfile`

```php
// app/Models/User.php
protected $attributes = ['timezone' => 'UTC', 'status' => 'active'];   // new User 했을 때의 기본값 (DB 기본값과 같게)

protected function casts(): array
{
    return [
        'email_verified_at' => 'datetime',     // → Carbon
        'password' => 'hashed',                // 대입하면 자동으로 해시 (password_hash 를 직접 부르지 않는다)
        'status' => UserStatus::class,         // 'suspended' ↔ UserStatus::Suspended
    ];
}

// app/Models/TutorProfile.php
protected function casts(): array
{
    return [
        'birth_date' => 'date',                // → Carbon (시각 없음)
        'subjects' => 'array',                 // JSON 칸 ↔ PHP 배열
        'languages' => 'array',
        'escrow_at' => 'datetime',
        'trial_enabled' => 'boolean',          // 't'/'f', 0/1 → true/false
        'hidden_at' => 'datetime',
        'booking_locked_at' => 'datetime',
    ];
}
```

| cast | DB | PHP |
|---|---|---|
| `integer` · `boolean` · `float` | 숫자·불린 | int · bool · float |
| `date` · `datetime` | 날짜 문자열 | `Carbon` 객체 |
| `array` | JSON 문자열 | 배열 |
| `hashed` | 해시 문자열 | 대입할 때 해시 |
| `SomeEnum::class` | 문자열·정수 | enum |

enum cast 덕분에 비교가 타입 안전해진다:

```php
public function isSuspended(): bool
{
    return $this->status === UserStatus::Suspended;   // 문자열 'suspended' 오타 걱정이 없다
}
```

---

## 7. 관계 — hasOne·hasMany·belongsTo

### 핵심 개념

외래 키를 **가진 쪽이 `belongsTo`**, 가리킴을 **받는 쪽이 `hasOne`/`hasMany`** 다.

```
users (id)  ──1:1──  tutor_profiles (user_id)     User hasOne TutorProfile  /  TutorProfile belongsTo User
users (id)  ──1:N──  tutor_slots   (tutor_id)     User hasMany TutorSlot
users (id)  ──1:N──  user_roles    (user_id)      User hasMany UserRole
```

### PES 코드 — `app/Models/User.php`

```php
public function tutorProfile(): HasOne
{
    return $this->hasOne(TutorProfile::class);             // 외래 키 user_id — 규칙대로라 생략
}

public function tutorSlots(): HasMany
{
    return $this->hasMany(TutorSlot::class, 'tutor_id');   // 규칙(user_id)과 달라서 적는다
}

public function roles(): HasMany
{
    return $this->hasMany(UserRole::class);
}

public function hasRole(Role $role): bool
{
    return $this->roles->contains('role', $role);          // 괄호 없음 → 역할 전체를 한 번 읽어 Collection 에서 찾는다
}
```

```php
// app/Models/TutorProfile.php
public function user(): BelongsTo
{
    return $this->belongsTo(User::class);                   // tutor_profiles.user_id → users.id
}
```

### 괄호 규칙 — 반드시 외운다

```php
$user->tutorSlots()     // 괄호 O: HasMany 쿼리 빌더 — 아직 SQL 안 나감. 조건을 더 붙인다
    ->where('weekday', 1)->get();

$user->tutorSlots       // 괄호 X: 결과 Collection — 처음 접근할 때 SQL 한 번, 이후 기억(캐시)
$user->tutorProfile     // hasOne 은 모델 하나 또는 null
```

| 하고 싶은 일 | 쓸 것 |
|---|---|
| 조건·정렬을 더 붙여 조회 | `$user->tutorSlots()->where(...)->get()` |
| 관계로 새 행 만들기 | `$user->tutorSlots()->create([...])` |
| 전부 가져와 반복 | `foreach ($user->tutorSlots as $slot)` |
| 있나 확인 | `$user->tutorProfile` (null 검사) 또는 `$user->tutorSlots()->exists()` |

### 관계로 조건 걸기 — `whereHas`

```php
// app/Models/TutorProfile.php 의 scopeSearch — 강사 이름(users.name)으로도 찾는다
->orWhereHas('user', fn (Builder $user) => $user->where('name', 'ilike', $like))
```

화면에서 관계를 반복해 그리는 모습은 [blade.md 3절](blade.md#3-조건반복-지시어) 의 `@forelse`, 괄호를 빼먹었을 때의 증상은 [pitfalls.md 4절](pitfalls.md#4-괄호-하나-차이) 에 있다.

---

## 8. 즉시 로딩과 N+1

### 핵심 개념

괄호 없는 관계는 **처음 접근할 때 SQL 을 한 번** 보낸다(지연 로딩). 반복문 안에서 접근하면 행마다 SQL 이 나간다.

```php
$profiles = TutorProfile::all();                 // SQL 1번
foreach ($profiles as $p) {
    echo $p->user->name;                         // 강사마다 SQL 1번 → 강사 100명이면 101번 (N+1)
}

$profiles = TutorProfile::with('user')->get();   // SQL 2번: 프로필 전부 + users WHERE id IN (...)
foreach ($profiles as $p) {
    echo $p->user->name;                         // SQL 없음
}
```

이미 가져온 모델에 나중에 붙이려면 `$profiles->load('user')`.

"목록 화면이 느리다"는 증상에서 거꾸로 찾아오려면 [pitfalls.md 3절](pitfalls.md#3-목록-화면이-느림--n1).

### PES 코드 — `TutorListController::index`

```php
$tutors = TutorProfile::query()
    ->visible()
    ->search($keyword)
    ->when($language !== '', fn ($query) => $query->whereJsonContains('tutor_profiles.languages', $language))
    ->ranked()
    ->with('user')                  // 목록 화면에서 강사 이름을 쓰므로 미리 불러온다
    ->simplePaginate(20)
    ->withQueryString();
```

---

## 9. 로컬 스코프 — 이름 붙인 조건

### 핵심 개념

자주 쓰는 조건에 이름을 붙인다. `scope` + 이름 메서드를 만들면 **`scope` 를 뺀 이름**으로 쿼리에 이어 붙일 수 있다.

```php
public function scopeVisible(Builder $query): void { ... }    // 정의: scopeVisible
TutorProfile::query()->visible()->get();                     // 사용: visible()
```

Laravel 12+ 에는 `#[Scope] protected function visible(Builder $query)` 형식도 있다. PES 는 `scope` 접두사를 쓴다.

### PES 코드 — `app/Models/TutorProfile.php`

```php
/** 관리자가 숨기지 않은 강사 */
public function scopeVisible(Builder $query): void
{
    $query->whereNull('tutor_profiles.hidden_at');
}

/** 과목·한 줄 소개·자기소개·이름에서 찾는다(부분 일치, 대소문자 무시). */
public function scopeSearch(Builder $query, ?string $keyword): void    // 인자도 받을 수 있다
{
    $keyword = trim((string) $keyword);
    if ($keyword === '') {
        return;                                                          // 조건을 붙이지 않음
    }
    $like = '%'.addcslashes($keyword, '%_\\').'%';                       // LIKE 특수문자 이스케이프

    $query->where(fn (Builder $q) => $q
        ->whereRaw('tutor_profiles.subjects::text ilike ?', [$like])
        ->orWhere('tutor_profiles.headline', 'ilike', $like)
        ->orWhere('tutor_profiles.bio', 'ilike', $like)
        ->orWhereHas('user', fn (Builder $user) => $user->where('name', 'ilike', $like)));
}

/** 강사 찾기 순서와 표시 점수 칸 — App\Tutor\Ranking */
public function scopeRanked(Builder $query): void
{
    Ranking::apply($query);                                              // 긴 쿼리는 별도 클래스로
}
```

`->when($조건, fn ($q) => ...)` 는 **조건이 참일 때만** 쿼리를 붙인다 — `if` 로 쿼리 변수를 나눠 쓰지 않게 해 준다.

`ilike` 는 PostgreSQL 의 대소문자 무시 LIKE 다(MySQL 에는 없다). PES 는 PostgreSQL 을 쓴다.

---

## 10. 모델 이벤트

### 핵심 개념

모델이 저장·삭제될 때 자동으로 코드를 실행한다. 이벤트 순서: `saving` → (`creating` | `updating`) → SQL → (`created` | `updated`) → `saved`. 삭제는 `deleting` → `deleted`.

### PES 코드 — `TutorProfile::booted()` (저장할 때마다 완성도 점수를 다시 계산)

```php
protected static function booted(): void
{
    // 어디서 저장하든(강사 화면·관리자·tinker) 완성도 점수를 다시 계산한다.
    static::saving(fn (TutorProfile $profile) => $profile->profile_score = ProfileScore::calculate($profile));
}
```

**핵심 로직**: 컨트롤러마다 점수 계산을 부르지 않아도 `$profile->save()` 만 하면 점수가 맞다. 대신 **모델을 거치지 않는 저장에는 이벤트가 없다**:

```php
$profile->save();                                         // saving 실행 ✅
$profile->update([...]);                                  // saving 실행 ✅ (내부에서 save)
TutorProfile::where('id', 1)->update(['bio' => '...']);   // 쿼리 빌더 — saving 없음 ❌ 점수가 옛날 그대로
DB::table('tutor_profiles')->update([...]);               // 없음 ❌
```

이 함정은 증상("완성도 점수가 안 바뀐다")으로 [pitfalls.md 11절](pitfalls.md#11-완성도-점수가-안-바뀜--모델-이벤트-건너뜀) 에도 정리해 두었다.

---

## 11. 원시 SQL 이 필요할 때

Eloquent 로 표현하기 어려운 계산은 SQL 조각을 섞는다. **사용자 입력은 반드시 `?` 바인딩**으로 넘긴다.

```php
->whereRaw('tutor_profiles.subjects::text ilike ?', [$like])     // ✅ 바인딩
->whereRaw("name ilike '%$keyword%'")                            // ❌ SQL 인젝션
->selectRaw('... as display_score')
->orderByRaw('tutor_profiles.admin_stars desc nulls last')
->join('users', 'users.id', '=', 'tutor_profiles.user_id')
DB::statement('ALTER TABLE ...');                                 // 결과 없는 SQL (마이그레이션)
DB::select('select ...', [$bind]);                                // 결과를 stdClass 배열로
```

### PES 코드 — `app/Tutor/Ranking.php` (발췌)

```php
$query
    ->join('users', 'users.id', '=', 'tutor_profiles.user_id')
    ->leftJoinLateral("select ... from tutor_slots s where s.tutor_id = tutor_profiles.user_id ...", 'today');

$total = "tutor_profiles.profile_score + coalesce(tutor_profiles.admin_stars, 0) * {$star} + today.schedule_points + today.trial_points";

$query
    ->select('tutor_profiles.*', 'today.schedule_points', 'today.trial_points')
    ->selectRaw("{$total} as display_score")               // 계산 칸 → $profile->display_score 로 읽힌다
    ->orderByDesc('tutor_profiles.priority_display_score')
    ->orderByRaw('tutor_profiles.escrow_at is null')
    ->orderByDesc('display_score');
```

여기 끼워 넣은 `{$star}` 등은 `(int)` 로 바꾼 **설정값**이라 사용자 입력이 아니다. `join` 을 하면 칸 이름이 겹치므로 `tutor_profiles.hidden_at` 처럼 **테이블 이름을 붙여** 쓴다 — PES 스코프가 모두 그렇게 쓰는 이유다.

---

## 12. Collection

### 핵심 개념

`get()` 은 배열이 아니라 `Illuminate\Support\Collection`(모델이면 `Eloquent\Collection`)을 돌려준다. 배열처럼 `foreach`·`count()`·`$c[0]` 이 되면서, 메서드 체이닝을 할 수 있다.

```php
$slots->count();
$slots->isEmpty() / isNotEmpty();
$slots->first();
$slots->pluck('points');                        // 한 칸만
$slots->map(fn ($s) => $s->startTime());        // array_map
$slots->filter(fn ($s) => $s->points > 0);      // array_filter
$slots->sum('duration_minutes');
$slots->groupBy('weekday');                     // [1 => Collection, 3 => Collection, ...]
$slots->contains('role', $role);
$slots->implode(', ');
$slots->toArray();
```

### PES 코드 — 요일별로 묶기 (`ScheduleController::index`)

```php
'slots' => $user->tutorSlots()->orderBy('weekday')->orderBy('starts_at')->get()->groupBy('weekday'),
//                 └──────────── 쿼리 빌더 (SQL) ────────────────────────┘ └ Collection (PHP) ┘
```

뷰에서: `@forelse ($slots as $weekday => $daySlots)`.

### 주의 — 같은 이름, 다른 곳

```php
$user->tutorSlots()->where('weekday', 1)->get();   // SQL WHERE — DB 가 거른다
$user->tutorSlots->where('weekday', 1);            // Collection::where — 전부 가져와 PHP 가 거른다
```

결과는 같아 보이지만 행이 많으면 두 번째가 느리다. `get()` 앞은 SQL, 뒤는 PHP 라고 기억한다.

---

## 13. 페이지 나누기

```php
->paginate(20)          // 전체 개수(COUNT)까지 — "1 2 3 … 10" 번호 링크
->simplePaginate(20)    // 개수 안 셈 — "이전 / 다음" 만. 빠르다
->withQueryString()     // ?q=math&language=ko 를 다음 쪽 링크에도 유지
```

`?page=2` 를 Laravel 이 알아서 읽는다. PES 는 `simplePaginate` 를 쓰고, 뷰에서 `{{ $tutors->links('partials.pager') }}` 로 직접 만든 이전·다음 링크를 그린다(Laravel 13 에 태그만 쓰는 기본 simple 뷰가 없어서 — `partials/pager.blade.php` 주석).

---

## 14. 모델에 메서드 두기

규칙이 담긴 판단은 **모델 메서드**로 둔다. 컨트롤러·뷰·테스트가 같은 판단을 한 곳에서 부른다.

### PES 코드 — `TutorProfile` 의 판단 메서드

```php
public function isEscrow(): bool
{
    return $this->escrow_at !== null;
}

public function offersTrial(): bool
{
    return $this->trial_enabled && $this->isEscrow() && $this->admin_stars !== null;
}

public function hasBookableScore(): bool
{
    return $this->profile_score >= config('tutor.booking_min_score');   // 숫자는 설정에서
}
```

### PES 코드 — `TutorSlot` 의 정적·인스턴스 메서드

```php
/** 0 → 일요일, 보고 있는 언어로 */
public static function weekdayName(int $weekday): string
{
    return Carbon::now()->startOfWeek(Carbon::SUNDAY)->addDays($weekday)->locale(app()->getLocale())->dayName;
}

/** '09:00:00' → '09:00' */
public function startTime(): string
{
    return substr($this->starts_at, 0, 5);
}

/** 무료 체험이 될 수 있는 길이인가 */
public function isTrialLength(): bool
{
    return $this->duration_minutes <= config('tutor.trial_max_minutes');
}
```

뷰에서 `$slot->startTime()`, `\App\Models\TutorSlot::weekdayName($weekday)`, `$profile->offersTrial()` 로 부른다.

---

## 15. 암기 카드

| 질문 | 답 |
|---|---|
| 모델 `TutorSlot` 의 테이블 이름은? | `tutor_slots` |
| `find()` 와 `findOrFail()` 의 차이는? | 없을 때 null / 404 |
| 딱 한 행이어야 할 때 쓰는 메서드는? | `sole()` |
| `$user->tutorSlots()` 와 `$user->tutorSlots` 의 차이는? | 괄호 O = 쿼리 빌더(조건 더 붙임), 괄호 X = 결과 Collection |
| Fillable 에 없는 칸을 `create()` 에 넣으면? | 오류 없이 버려진다 |
| Fillable 을 무시하고 넣는 법은? | `forceFill()` 또는 속성 직접 대입 |
| 외래 키를 가진 쪽의 관계는? | `belongsTo` |
| 외래 키가 `user_id` 가 아닐 때는? | `hasMany(TutorSlot::class, 'tutor_id')` 처럼 2번째 인자 |
| N+1 을 막는 메서드는? | `with('관계')` (이미 가져왔으면 `load()`) |
| `scopeVisible` 을 쓰는 이름은? | `->visible()` |
| 조건이 참일 때만 쿼리를 붙이는 메서드는? | `->when($cond, fn ($q) => ...)` |
| 저장할 때마다 실행되는 이벤트는? | `saving` (`booted()` 안에서 `static::saving(...)`) |
| 쿼리 빌더 `->update()` 의 함정은? | 모델 이벤트가 실행되지 않는다 |
| `'password' => 'hashed'` cast 의 효과는? | 대입하면 자동으로 해시 |
| `'subjects' => 'array'` cast 의 효과는? | JSON 칸 ↔ PHP 배열 |
| `whereRaw` 에 사용자 입력을 넣는 법은? | `?` 바인딩 — `whereRaw('x ilike ?', [$like])` |
| `get()` 앞과 뒤의 차이는? | 앞은 SQL(쿼리 빌더), 뒤는 PHP(Collection) |
| `simplePaginate` 와 `paginate` 의 차이는? | 개수를 안 세서 이전/다음만 / 전체 개수와 번호 |
