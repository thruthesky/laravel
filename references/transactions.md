# 심화 — 트랜잭션과 데이터 무결성 — DB::transaction·잠금·경쟁 조건

"두 개 이상의 저장이 **전부 되거나 전부 안 되어야** 할 때", 그리고 "두 사람이 **같은 순간에** 같은 행을 건드릴 때" 필요한 문서다. 먼저 [Eloquent 쓰기](eloquent.md#4-쓰기고치기지우기)와 [DB 제약](database.md#5-db-제약--pes-의-check)을 읽고 오면 좋다.

## 목차

1. [트랜잭션이 필요한 순간](#1-트랜잭션이-필요한-순간)
2. [DB::transaction — 클로저 한 번으로](#2-dbtransaction--클로저-한-번으로)
3. [수동 트랜잭션과 중첩](#3-수동-트랜잭션과-중첩)
4. [커밋 뒤에 할 일 — afterCommit](#4-커밋-뒤에-할-일--aftercommit)
5. [비관적 잠금 — lockForUpdate](#5-비관적-잠금--lockforupdate)
6. [낙관적 잠금 — version 칸](#6-낙관적-잠금--version-칸)
7. [경쟁 조건 — firstOrCreate 와 unique 제약](#7-경쟁-조건--firstorcreate-와-unique-제약)
8. [원자적 증가 — increment](#8-원자적-증가--increment)
9. [대량 저장 — upsert](#9-대량-저장--upsert)
10. [DB 제약이 최후 방어선](#10-db-제약이-최후-방어선)
11. [테스트와 트랜잭션](#11-테스트와-트랜잭션)
12. [암기 카드](#12-암기-카드)

---

## 1. 트랜잭션이 필요한 순간

### 핵심 개념

트랜잭션은 **여러 SQL 을 하나로 묶는 단위**다. 묶인 SQL 은 모두 반영(commit)되거나, 하나라도 실패하면 모두 취소(rollback)된다. 은행 이체가 교과서 예다 — A 계좌에서 빼고 B 계좌에 넣는 두 UPDATE 중 하나만 되면 돈이 사라진다.

Laravel 앱에서 트랜잭션이 필요한 전형적인 순간은 이렇다.

| 상황 | 묶어야 할 SQL | 안 묶으면 |
|---|---|---|
| 예약 확정 | 예약 INSERT + 슬롯 상태 UPDATE + 포인트 차감 | 예약은 생겼는데 포인트가 안 빠짐 |
| 글 + 태그 저장 | posts INSERT + post_tag INSERT 여러 줄 | 글만 있고 태그가 반만 붙음 |
| 데이터 옮기기 | 새 칸 채우기 + 옛 칸 지우기 | 중간에 죽으면 데이터 반쪽 |
| 회원 탈퇴 | 개인정보 지우기 + 로그 남기기 | 로그 없는 삭제 |

⚠ **한 번의 `save()` 는 이미 SQL 한 줄이라 원자적이다.** 트랜잭션은 "SQL 이 두 개 이상이고 서로 맞아야 할 때"만 쓴다. 모든 컨트롤러를 트랜잭션으로 감싸는 것은 잠금 시간만 늘린다.

### 순수 PHP 와 비교

```php
// 순수 PDO — 모든 경로에서 rollBack 을 잊지 않아야 한다
$pdo->beginTransaction();
try {
    $pdo->prepare('INSERT INTO bookings (slot_id, student_id) VALUES (?, ?)')->execute([$slotId, $studentId]);
    $pdo->prepare('UPDATE slots SET status = ? WHERE id = ?')->execute(['booked', $slotId]);
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
}
```

Laravel 은 이 `try / commit / catch / rollBack / throw` 뼈대를 클로저 하나로 줄인다.

---

## 2. DB::transaction — 클로저 한 번으로

### 핵심 개념

`DB::transaction()` 에 클로저를 넘기면 Laravel 이 트랜잭션을 열고 클로저를 실행한다.

- 클로저가 **정상으로 끝나면 commit**, **예외가 나면 rollback 한 뒤 그 예외를 다시 던진다.**
- 클로저가 돌려준 값을 `DB::transaction()` 이 그대로 돌려준다.
- 두 번째 인자 `attempts` 는 **교착 상태(deadlock) 같은 동시성 오류가 났을 때 다시 시도할 횟수**다(기본 1 = 재시도 없음).

### 예제 — 예약 확정 (일반 Laravel 예)

```php
use Illuminate\Support\Facades\DB;

$booking = DB::transaction(function () use ($slot, $student) {
    $booking = Booking::create([               // ① INSERT
        'slot_id' => $slot->id,
        'student_id' => $student->id,
    ]);
    $slot->update(['status' => 'booked']);    // ② UPDATE
    $student->decrement('points', $slot->price);  // ③ UPDATE — 여기서 예외가 나면 ①② 도 취소

    return $booking;                          // DB::transaction() 의 반환값이 된다
}, attempts: 3);                              // 교착 상태면 최대 3번 시도
```

### 왜 클로저인가

클로저 방식은 "열었으면 반드시 닫는다"를 **문법으로 보장**한다. 수동 방식은 `return` 을 중간에 하나만 넣어도 트랜잭션이 열린 채 남는다. 그래서 Laravel 코드에서는 클로저 방식이 기본이다.

⚠ **클로저 안에서 예외를 잡아 삼키면 롤백되지 않는다.**

```php
DB::transaction(function () {
    try {
        $post->tags()->attach($ids);
    } catch (Throwable $e) {
        logger($e->getMessage());   // ❌ 예외를 삼켰다 → Laravel 은 "성공"으로 보고 commit 한다
    }
});
```

잡아야 한다면 로그를 남긴 뒤 `throw $e;` 로 다시 던진다.

⚠ **DB 가 아닌 것은 롤백되지 않는다.** 클로저 안에서 올린 파일, 보낸 메일, 부른 외부 API, 지운 캐시는 rollback 해도 돌아오지 않는다. 그런 일은 [4절](#4-커밋-뒤에-할-일--aftercommit)처럼 커밋 뒤로 미룬다.

---

## 3. 수동 트랜잭션과 중첩

### 핵심 개념

클로저로 표현하기 어려울 때만 수동으로 쓴다.

```php
DB::beginTransaction();
try {
    // …
    DB::commit();
} catch (Throwable $e) {
    DB::rollBack();       // 대문자 B — rollback() 이 아니다
    throw $e;
}
```

**중첩**: 트랜잭션 안에서 또 `DB::transaction()` 을 부르면 Laravel 은 새 트랜잭션 대신 **세이브포인트(SAVEPOINT)** 를 만든다. 안쪽이 실패하면 세이브포인트까지만 되돌리고, 바깥이 실패하면 전부 되돌린다. 지금 깊이는 `DB::transactionLevel()` 로 본다.

```
DB::transaction(바깥)          BEGIN                 level 1
  └ DB::transaction(안쪽)      SAVEPOINT trans2      level 2
      안쪽 예외                 ROLLBACK TO trans2    → 바깥으로 예외 전파
  바깥이 예외를 못 잡으면        ROLLBACK              → 전부 취소
```

⚠ 중첩이 가능하다고 서비스 메서드마다 트랜잭션을 거는 것은 좋지 않다. **트랜잭션 경계는 "하나의 업무 동작" 바깥쪽 한 곳**(대개 컨트롤러나 서비스의 공개 메서드)에 둔다.

---

## 4. 커밋 뒤에 할 일 — afterCommit

### 핵심 개념

트랜잭션 안에서 큐 작업을 보내면 이런 일이 생긴다.

```
요청 스레드                         큐 워커
BEGIN
INSERT bookings (id=42)
dispatch(SendBookingMail(42)) ──→  작업 받음 → Booking::find(42) → null! (아직 commit 전)
UPDATE slots …
COMMIT
```

워커는 **다른 DB 연결**이라 commit 전의 데이터를 볼 수 없다. 반대로 롤백되면 "없는 예약"에 대한 메일이 나간다. 그래서 **커밋이 확정된 뒤에** 실행되게 미룬다.

### 예제 — 세 가지 방법 (일반 Laravel 예)

```php
// ① 작업 하나만 커밋 뒤로
SendBookingMail::dispatch($booking)->afterCommit();

// ② 아무 코드나 커밋 뒤로 — 트랜잭션 밖이면 바로 실행된다
DB::afterCommit(fn () => Cache::forget('slots:'.$slot->tutor_id));

// ③ 큐 연결 전체를 커밋 뒤로 — config/queue.php 의 연결 설정
'redis' => [
    'driver' => 'redis',
    // …
    'after_commit' => true,
],
```

큐 자체는 [queues.md](queues.md) 에서 다룬다.

---

## 5. 비관적 잠금 — lockForUpdate

### 핵심 개념

"남은 자리가 1개인 수업"에 두 학생이 동시에 예약 버튼을 누르면?

```
학생 A                              학생 B
SELECT seats_left → 1               SELECT seats_left → 1
1 > 0 이니 예약 가능!                 1 > 0 이니 예약 가능!
UPDATE seats_left = 0               UPDATE seats_left = 0
INSERT booking                      INSERT booking        ← 자리 1개에 예약 2개
```

**비관적 잠금**은 "누군가 동시에 건드릴 것"이라고 비관하고 **읽는 순간 행을 잠근다.** `lockForUpdate()` 는 `SELECT … FOR UPDATE` 를 만든다. 잠긴 행을 같은 방식으로 읽으려는 다른 트랜잭션은 **먼저 잡은 쪽이 commit/rollback 할 때까지 기다린다.**

| 메서드 | SQL (PostgreSQL) | 다른 트랜잭션은 |
|---|---|---|
| `lockForUpdate()` | `FOR UPDATE` | 읽기 잠금·쓰기 모두 대기 — 고칠 행에 쓴다 |
| `sharedLock()` | `FOR SHARE` | 읽기 잠금은 되고 쓰기는 대기 — "읽는 동안 바뀌면 안 되는" 행에 쓴다 |

### 순수 PHP 와 비교

```php
$pdo->beginTransaction();
$stmt = $pdo->prepare('SELECT * FROM classes WHERE id = ? FOR UPDATE');
```

Laravel 은 SQL 끝에 `FOR UPDATE` 를 직접 붙이는 대신 메서드 사슬로 쓴다.

### 예제 — 마지막 한 자리 (일반 Laravel 예)

```php
$booking = DB::transaction(function () use ($classId, $student) {
    $class = Course::whereKey($classId)->lockForUpdate()->firstOrFail();   // 행 잠금 — B 는 여기서 기다린다

    if ($class->seats_left < 1) {
        throw ValidationException::withMessages(['class' => '자리가 없습니다.']);   // 예외 → 롤백 → 잠금 해제
    }

    $class->decrement('seats_left');
    return $class->bookings()->create(['student_id' => $student->id]);
});   // commit → 잠금 해제 → B 가 이제 seats_left = 0 을 읽는다
```

⚠ **잠금은 트랜잭션 안에서만 의미가 있다.** 트랜잭션 밖에서 `lockForUpdate()` 를 쓰면 SELECT 가 끝나는 순간(자동 커밋) 잠금이 풀린다.
⚠ SQLite 는 `FOR UPDATE` 문법이 없어 Laravel 이 잠금 구문을 빼고 보낸다. 잠금 동작을 테스트하려면 PostgreSQL·MySQL 로 해야 한다.
⚠ 잠금을 잡은 채 외부 API 를 부르지 말 것 — 그동안 다른 요청이 줄줄이 기다린다.

---

## 6. 낙관적 잠금 — version 칸

### 핵심 개념

**낙관적 잠금**은 "동시에 고치는 일은 드물다"고 낙관하고, 잠그지 않는 대신 **저장할 때 "내가 읽은 뒤로 바뀌지 않았나"를 확인**한다. 관리자 두 명이 같은 강사 소개글을 편집하는 화면처럼, 폼을 여는 시간과 저장하는 시간 사이가 긴 경우에 맞는다(그 몇 분 동안 행을 잠글 수는 없다).

Laravel 에 전용 기능은 없고, `version` 칸과 조건부 UPDATE 로 만든다.

### 예제 — 편집 충돌 알리기 (일반 Laravel 예)

```php
// 폼에 hidden 으로 읽을 때의 version 을 넣어 두었다
$changed = Post::whereKey($post->id)
    ->where('version', $request->integer('version'))       // 내가 읽은 버전일 때만
    ->update([
        'body' => $request->validated('body'),
        'version' => DB::raw('version + 1'),
    ]);

if ($changed === 0) {                                       // 0행 = 누가 먼저 고쳤다
    return back()->withErrors(['body' => '다른 사람이 먼저 고쳤습니다. 새로고침 후 다시 시도하세요.'])->withInput();
}
```

쿼리 빌더 `update()` 는 바뀐 행 수를 돌려준다. ⚠ 쿼리 빌더 `update()` 는 모델 이벤트를 건너뛴다([함정 11](pitfalls.md#11-완성도-점수가-안-바뀜--모델-이벤트-건너뜀)).

| | 비관적 잠금 | 낙관적 잠금 |
|---|---|---|
| 언제 확인 | 읽을 때 잠근다 | 쓸 때 확인한다 |
| 충돌 시 | 기다린다 | 실패를 알린다 |
| 맞는 곳 | 짧은 트랜잭션, 충돌 잦음(좌석·재고) | 긴 편집, 충돌 드묾(문서 편집) |

---

## 7. 경쟁 조건 — firstOrCreate 와 unique 제약

### 핵심 개념

`firstOrCreate()` 는 "없으면 만든다"를 **SELECT 한 번 + INSERT 한 번**으로 한다. 두 요청이 동시에 SELECT 하면 둘 다 "없다"를 보고 둘 다 INSERT 한다. 검증 규칙 `Rule::unique` 도 똑같다 — 검증 시점에는 둘 다 통과한다.

```
요청 A: SELECT … where email=x → 없음      요청 B: SELECT … where email=x → 없음
요청 A: INSERT email=x                       요청 B: INSERT email=x   ← 중복!
```

**답은 DB 의 unique 제약이다.** 제약이 있으면 두 번째 INSERT 는 DB 가 거절한다. Laravel 은 이 거절을 `Illuminate\Database\UniqueConstraintViolationException` 으로 던진다.

`createOrFirst()` 는 순서를 뒤집어 **먼저 INSERT 하고, unique 위반이면 SELECT** 한다. unique 제약이 있어야만 제대로 동작한다.

### 예제 — 좋아요 한 번만 (일반 Laravel 예)

```php
// 마이그레이션 — 한 사람이 한 글에 한 번
$table->unique(['user_id', 'post_id']);

// 컨트롤러
$like = Like::createOrFirst(['user_id' => $user->id, 'post_id' => $post->id]);   // 동시에 눌러도 1행

// 직접 잡을 때
try {
    Like::create(['user_id' => $user->id, 'post_id' => $post->id]);
} catch (UniqueConstraintViolationException) {
    // 이미 눌렀다 — 무시
}
```

⚠ `createOrFirst()` 를 트랜잭션 안에서 쓰면, PostgreSQL 에서는 unique 위반 오류가 난 순간 **트랜잭션 전체가 실패 상태**가 된다. Laravel 은 이를 피하려고 내부에서 세이브포인트를 쓰지만, 직접 `try/catch` 로 잡을 때는 트랜잭션 밖에서 하거나 안쪽을 `DB::transaction()` 으로 한 번 더 감싸 세이브포인트를 만든다.

> `firstOrCreate()` 의 내부 구현은 버전에 따라 `createOrFirst()` 를 쓰도록 바뀌어 왔다. 어느 쪽이든 **unique 제약 없이는 중복을 막을 수 없다**는 결론은 같다.

---

## 8. 원자적 증가 — increment

### 핵심 개념

조회수·포인트·재고처럼 숫자를 더하고 빼는 일을 PHP 에서 하면 동시 요청이 서로의 값을 덮어쓴다.

```php
$post->views = $post->views + 1;   // ❌ 읽은 값(100)에 1 을 더해 101 로 "덮어쓴다"
$post->save();                     //    동시에 두 요청 → 둘 다 101. 한 번이 사라짐

$post->increment('views');         // ✅ UPDATE posts SET views = views + 1 — DB 가 더한다
```

| 메서드 | SQL |
|---|---|
| `$post->increment('views')` | `views = views + 1` |
| `$post->increment('views', 5)` | `views = views + 5` |
| `$user->decrement('points', 300)` | `points = points - 300` |
| `Post::whereKey($id)->increment('views')` | 모델을 불러오지 않고 바로 |
| `$post->incrementEach(['views' => 1, 'likes' => 2])` | 여러 칸을 한 번에 |

⚠ `decrement` 는 음수를 막아 주지 않는다. "0 아래로 내려가면 안 된다"는 CHECK 제약이나 `where('points', '>=', 300)` 조건을 함께 건다.

---

## 9. 대량 저장 — upsert

### 핵심 개념

`upsert()` 는 "있으면 고치고 없으면 넣기"를 **여러 행에 한 SQL 로** 한다(PostgreSQL 의 `INSERT … ON CONFLICT … DO UPDATE`). 외부 API 에서 받은 환율·순위를 날마다 통째로 반영할 때 쓴다.

```php
ExchangeRate::upsert(
    [
        ['currency' => 'USD', 'date' => '2026-09-26', 'rate' => 1391.5],
        ['currency' => 'JPY', 'date' => '2026-09-26', 'rate' => 9.4],
    ],
    uniqueBy: ['currency', 'date'],   // 이 칸 조합이 같으면 "있는 행"
    update: ['rate'],                 // 있으면 이 칸만 고친다
);
```

⚠ `uniqueBy` 의 칸에는 **unique 인덱스가 있어야** 한다(PostgreSQL 은 없으면 오류).
⚠ `upsert()` 는 모델을 하나씩 만들지 않으므로 **모델 이벤트(`saving` 등)와 casts 변환이 돌지 않는다.** 이벤트로 계산하는 값이 있으면 쓰지 않는다.

`updateOrCreate()`(한 행)와 비교하면: `updateOrCreate` 는 SELECT 후 INSERT/UPDATE 두 번이고 이벤트가 돈다, `upsert` 는 SQL 한 번이고 이벤트가 없다.

---

## 10. DB 제약이 최후 방어선

### 핵심 개념

검증(`validate()`)·정책·트랜잭션은 모두 **"코드가 올바르게 불렸을 때"** 만 지킨다. tinker 에서 손으로 넣은 값, 새로 만든 관리자 화면, 동시 요청은 이 층을 빠져나간다. 마지막으로 지키는 것은 DB 다.

```
요청 → 검증(validate) → 정책(Gate) → 코드 로직 → 트랜잭션·잠금 → DB 제약(NOT NULL·UNIQUE·FK·CHECK)
       사용자에게 친절한 오류             동시성                    절대 못 지나감
```

PES 는 이 원칙을 따른다 — 회원 상태를 `CHECK (status IN ('active', 'suspended'))` 로 묶는다([database.md 5절](database.md#5-db-제약--pes-의-check)). 검증을 빠뜨린 코드가 있어도 DB 가 막는다.

| 지키고 싶은 규칙 | DB 제약 |
|---|---|
| 한 사람이 한 번만 | `unique(['user_id', 'post_id'])` |
| 없는 회원을 가리키면 안 됨 | `foreignId('user_id')->constrained()` |
| 값의 범위 | `CHECK (points >= 0)` — `DB::statement()` 로 |
| 반드시 있어야 함 | `nullable()` 을 빼면 NOT NULL |

"검증은 사용자를 위한 것, 제약은 데이터를 위한 것"이라고 외운다. 둘 다 둔다.

---

## 11. 테스트와 트랜잭션

### 핵심 개념

[RefreshDatabase](testing.md#3-db-를-쓰는-테스트--refreshdatabase) 는 **테스트마다 트랜잭션을 열고 끝나면 롤백**한다. 그래서 테스트가 만든 데이터가 다음 테스트로 새지 않고, DB 를 매번 새로 만드는 것보다 훨씬 빠르다.

이 때문에 생기는 착시 두 가지:

1. **테스트 안의 `DB::transaction()` 은 이미 트랜잭션 안에 있다** → 실제로는 세이브포인트(level 2)로 돈다. 동작은 같지만 `DB::transactionLevel()` 이 1 이 아니다.
2. **`afterCommit` 콜백** — 테스트 전체가 결국 롤백되므로 진짜 commit 은 일어나지 않는다. Laravel 은 RefreshDatabase 를 쓸 때 "테스트의 바깥 트랜잭션"을 무시하고 안쪽 트랜잭션 commit 시점에 `afterCommit` 콜백을 실행해 준다 — 그래서 대부분의 경우 실제와 같이 동작한다.

⚠ 잠금·경쟁 조건은 테스트 하나(연결 하나)로는 재현되지 않는다. 동시성 버그는 **DB 제약으로 막고, 제약이 있다는 사실을 테스트**하는 편이 현실적이다(중복 INSERT 가 예외를 던지는지).

```php
it('같은 글에 좋아요를 두 번 할 수 없다', function () {
    $user = User::factory()->create();
    $post = Post::factory()->create();

    Like::create(['user_id' => $user->id, 'post_id' => $post->id]);

    expect(fn () => Like::create(['user_id' => $user->id, 'post_id' => $post->id]))
        ->toThrow(UniqueConstraintViolationException::class);
});
```

---

## 12. 암기 카드

| 질문 | 답 |
|---|---|
| 트랜잭션은 언제 필요한가? | SQL 이 두 개 이상이고 전부 되거나 전부 안 되어야 할 때 |
| `DB::transaction()` 클로저에서 예외가 나면? | 롤백하고 그 예외를 다시 던진다 |
| `DB::transaction()` 의 반환값은? | 클로저가 돌려준 값 |
| 두 번째 인자 `attempts` 는? | 교착 상태 등 동시성 오류일 때 다시 시도할 횟수 |
| 클로저 안에서 예외를 잡아 삼키면? | 성공으로 보고 commit 한다 — 다시 `throw` 해야 롤백 |
| 롤백해도 돌아오지 않는 것은? | 파일·메일·외부 API·캐시 등 DB 밖의 일 |
| 트랜잭션 안에서 또 트랜잭션을 열면? | 세이브포인트가 된다 |
| 수동 롤백 메서드 이름은? | `DB::rollBack()` (대문자 B) |
| 큐 작업을 커밋 뒤에 보내려면? | `dispatch(...)->afterCommit()` 또는 `DB::afterCommit()` |
| `lockForUpdate()` 가 만드는 SQL 은? | `SELECT … FOR UPDATE` |
| 잠금이 의미 있는 곳은? | 트랜잭션 안 |
| 비관적 vs 낙관적 잠금? | 읽을 때 잠가 기다리게 / 쓸 때 version 을 확인해 실패를 알림 |
| `firstOrCreate()` 의 중복을 막는 진짜 방법은? | DB unique 제약 (+ `createOrFirst()`) |
| unique 위반 예외 클래스는? | `UniqueConstraintViolationException` |
| `$post->views++; save()` 대신 쓸 것은? | `$post->increment('views')` |
| `upsert()` 의 함정은? | 모델 이벤트·casts 가 돌지 않고, `uniqueBy` 칸에 unique 인덱스가 필요 |
| 검증과 DB 제약의 역할은? | 검증은 사용자에게 친절한 오류, 제약은 데이터의 최후 방어선 |
| RefreshDatabase 가 빠른 이유는? | 테스트마다 트랜잭션을 열고 롤백한다 |
