# 심화 — Eloquent 더 알기 — 접근자·소프트 삭제·전역 스코프·엄격 모드·대량 처리

[4단계 Eloquent](eloquent.md) 로 조회·저장·관계를 할 수 있게 되면, 실제 서비스에서 곧 이런 요구를 만난다 — "이름과 성을 합쳐 보여 주고 싶다", "지운 글을 되살리고 싶다", "모든 조회에 공개 글 조건을 자동으로 걸고 싶다", "N+1 을 개발 중에 바로 잡고 싶다", "100만 행을 메모리 걱정 없이 돌고 싶다". 이 문서가 그 답이다. [casts](eloquent.md#6-casts-와-기본값)·[로컬 스코프](eloquent.md#9-로컬-스코프--이름-붙인-조건)·[모델 이벤트](eloquent.md#10-모델-이벤트) 를 먼저 읽는다.

PES 에 발췌가 없는 기능이 대부분이라 예제는 **일반 Laravel 예**(미니 게시판)다.

## 목차

1. [접근자와 변경자 — Attribute::make](#1-접근자와-변경자--attributemake)
2. [계산한 값을 JSON 에 — $appends](#2-계산한-값을-json-에--appends)
3. [소프트 삭제 — 지운 척하기](#3-소프트-삭제--지운-척하기)
4. [전역 스코프 — 모든 조회에 붙는 조건](#4-전역-스코프--모든-조회에-붙는-조건)
5. [엄격 모드 — 조용한 실수를 예외로](#5-엄격-모드--조용한-실수를-예외로)
6. [대량 처리 — chunk·chunkById·lazy·cursor](#6-대량-처리--chunkchunkbyidlazycursor)
7. [이벤트 없이 한 번에 — insert·upsert](#7-이벤트-없이-한-번에--insertupsert)
8. [작은 도구들 — replicate·is·touches·$with](#8-작은-도구들--replicateistoucheswith)
9. [옵저버 — 모델 이벤트를 한 클래스로](#9-옵저버--모델-이벤트를-한-클래스로)
10. [암기 카드](#10-암기-카드)

---

## 1. 접근자와 변경자 — Attribute::make

### 핵심 개념

- **접근자(accessor)** — 속성을 **읽을 때** 값을 바꾸거나 계산한다. `$user->full_name`
- **변경자(mutator)** — 속성에 **넣을 때** 값을 바꾼다. `$user->email = ' A@B.com '` → `a@b.com` 으로 저장

둘 다 모델에 **칸 이름을 camelCase 로 쓴 protected 메서드** 하나로 정의하고, `Attribute` 객체를 돌려준다. 메서드 이름 `fullName` ↔ 속성 이름 `full_name` 이 짝이다.

### 순수 PHP 와 비교

순수 PHP 클래스에서 `getFullName()`·`setEmail()` 게터·세터를 만들던 일이다. 차이는 **부르는 쪽이 속성처럼 부른다**는 점 — `$user->full_name`. 그래서 Blade·JSON·Collection 의 `pluck('full_name')` 에서 칸처럼 쓸 수 있다.

### 예제 — 이름 합치기와 이메일 정리 (일반 Laravel 예)

```php
use Illuminate\Database\Eloquent\Casts\Attribute;

class User extends Model
{
    // 읽기 전용 접근자 — DB 에 full_name 칸은 없다
    protected function fullName(): Attribute
    {
        return Attribute::make(
            get: fn (mixed $value, array $attributes) => $attributes['last_name'].$attributes['first_name'],
        );
    }

    // 읽기·쓰기 둘 다
    protected function email(): Attribute
    {
        return Attribute::make(
            get: fn (string $value) => $value,
            set: fn (string $value) => strtolower(trim($value)),   // 저장 전에 정리
        );
    }
}
```

```php
$user->full_name;                  // '홍길동'
$user->email = '  Hong@Mail.COM ';
$user->save();                     // DB 에는 'hong@mail.com'
```

- `get` 의 첫 인자는 그 칸의 원래 값, 두 번째는 **모든 칸의 배열**이다. 계산 접근자는 두 번째를 쓴다.
- 비싼 계산이면 `Attribute::make(get: …)->shouldCache()` 로 한 요청 안에서 한 번만 계산한다.

⚠ 옛 튜토리얼의 `getFullNameAttribute()`·`setEmailAttribute()` 이름 규칙도 지금 동작한다. 한 모델에 두 방식을 섞지 말고 `Attribute::make` 로 통일한다.

⚠ 접근자는 **PHP 에서만** 존재한다. `User::where('full_name', …)` 이나 `orderBy('full_name')` 은 SQL 이라 동작하지 않는다(그런 칸이 없다). 검색·정렬에 필요하면 DB 칸이나 SQL 식으로 만든다.

### casts 와 무엇이 다른가

| | casts | 접근자·변경자 |
|---|---|---|
| 쓸 때 | 타입 변환(날짜·배열·bool·enum) | 계산·가공·조합 |
| 정의 | `casts()` 에 한 줄 | 메서드 하나 |
| 예 | `'published_at' => 'datetime'` | 성+이름, 금액에 통화 기호 |

타입만 바꾸면 cast, 로직이 있으면 접근자다.

---

## 2. 계산한 값을 JSON 에 — $appends

### 핵심 개념

모델을 JSON 으로 내보낼 때(`return $user;`·`toArray()`·`response()->json($user)`) 접근자 값은 **기본으로 빠진다.** DB 칸만 나간다. 넣으려면 `$appends` 에 적는다.

```php
class User extends Model
{
    protected $appends = ['full_name'];     // JSON 에 항상 포함
}

$user->toArray();   // [..., 'full_name' => '홍길동']
$user->append('avatar_url')->toArray();     // 이번 한 번만 더 넣기
```

⚠ `$appends` 의 접근자가 관계를 읽으면(`$this->posts->count()`) 모델을 JSON 으로 만들 때마다 관계를 불러와 **목록 JSON 에서 N+1** 이 된다. 개수라면 [withCount](relations.md) 를 쓴다. 내보낼 칸을 세밀하게 정하는 일은 API 리소스([api.md](api.md))가 더 알맞다.

---

## 3. 소프트 삭제 — 지운 척하기

### 핵심 개념

`delete()` 가 행을 지우지 않고 `deleted_at` 칸에 **지운 시각만 적는다.** 그리고 Eloquent 가 모든 조회에 `where deleted_at is null` 을 자동으로 붙인다. 그래서 앱에서는 사라진 것처럼 보이지만 DB 에 남아 있어 되살릴 수 있다.

```
delete()          → UPDATE posts SET deleted_at = now()
Post::all()       → SELECT * FROM posts WHERE deleted_at IS NULL
restore()         → UPDATE posts SET deleted_at = NULL
forceDelete()     → DELETE FROM posts            (진짜 삭제)
```

### 순수 PHP 와 비교

순수 PHP 에서 `is_deleted` 칸을 두고 **모든 SELECT 에 `AND is_deleted = 0` 을 손으로 붙이던** 방식이다. 한 곳이라도 빠뜨리면 지운 글이 보였다. 소프트 삭제는 그 조건을 모델이 자동으로 건다(4절 전역 스코프로 구현되어 있다).

### 예제 (일반 Laravel 예)

```php
// 마이그레이션
Schema::table('posts', function (Blueprint $table) {
    $table->softDeletes();          // deleted_at timestamp null
});

// 모델
use Illuminate\Database\Eloquent\SoftDeletes;

class Post extends Model
{
    use SoftDeletes;
}
```

```php
$post->delete();                              // 휴지통으로
$post->trashed();                             // true

Post::withTrashed()->find($id);               // 지운 것까지 포함
Post::onlyTrashed()->latest('deleted_at')->get();   // 휴지통 목록
Post::withTrashed()->find($id)->restore();    // 되살리기
$post->forceDelete();                         // 영구 삭제

// 라우트 모델 바인딩에서 지운 글도 찾으려면
Route::get('/trash/{post}', [TrashController::class, 'show'])->withTrashed();
```

### ⚠ 흔한 함정

| 함정 | 증상 | 대처 |
|---|---|---|
| **unique 제약** | 탈퇴(소프트 삭제)한 이메일로 재가입 → `unique` 위반 | 검증은 `Rule::unique('users')->withoutTrashed()`, DB 는 PostgreSQL 부분 인덱스 `CREATE UNIQUE INDEX … WHERE deleted_at IS NULL` |
| **자식은 안 지워진다** | 글을 지웠는데 댓글은 그대로 | `cascadeOnDelete()` 는 진짜 DELETE 에서만 동작. 자식도 소프트 삭제하려면 옵저버(9절)에서 처리 |
| **원시 SQL·쿼리 빌더** | `DB::table('posts')` 로 조회하면 지운 글도 나옴 | 전역 스코프는 Eloquent 에만 걸린다 |
| **쌓이기만 함** | 휴지통이 무한히 커짐 | `Prunable` 트레이트 + `model:prune` 명령을 스케줄러에 등록 ([queues.md](queues.md)) |

소프트 삭제는 "되살리기·감사 기록" 이 정말 필요한 테이블에만 쓴다. 모든 테이블에 습관처럼 붙이면 unique·집계·조인마다 `deleted_at` 을 생각해야 한다.

---

## 4. 전역 스코프 — 모든 조회에 붙는 조건

### 핵심 개념

[로컬 스코프](eloquent.md#9-로컬-스코프--이름-붙인-조건)(`->visible()`)는 **부를 때만** 붙는다. 전역 스코프는 그 모델의 **모든 조회에 자동으로** 붙는다. 소프트 삭제가 대표적인 전역 스코프다.

### 예제 — 공개 글만 (일반 Laravel 예)

```php
// app/Models/Scopes/PublishedScope.php
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

class PublishedScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $builder->whereNotNull('published_at')->where('published_at', '<=', now());
    }
}
```

```php
// 모델에 붙이는 두 가지 방법
use Illuminate\Database\Eloquent\Attributes\ScopedBy;

#[ScopedBy([PublishedScope::class])]          // ① 속성으로
class Post extends Model
{
    protected static function booted(): void
    {
        // ② booted() 안에서 — 클로저로 짧게도 된다
        static::addGlobalScope('has_title', fn (Builder $q) => $q->where('title', '!=', ''));
    }
}
```

```php
Post::all();                                            // 공개 글만
Post::withoutGlobalScope(PublishedScope::class)->get(); // 관리 화면 — 조건 끄기
Post::withoutGlobalScopes()->get();                     // 전부 끄기
```

### 왜 조심해서 쓰나

전역 스코프는 **보이지 않는 WHERE** 다. 새로 온 사람이 `Post::find(5)` 가 `null` 인 이유를 한참 찾는다. 관리 화면·통계·테스트에서 매번 `withoutGlobalScope` 를 붙이게 되면 설계를 의심한다. "이 조건을 **빼야 하는** 경우가 거의 없다" 는 확신이 있을 때만(소프트 삭제, 다중 테넌트의 `tenant_id` 정도) 쓰고, 나머지는 로컬 스코프로 둔다.

---

## 5. 엄격 모드 — 조용한 실수를 예외로

### 핵심 개념

Eloquent 의 가장 위험한 실수들은 **오류 없이 조용히** 지나간다 — [N+1](pitfalls.md#3-목록-화면이-느림--n1), [Fillable 에 없는 칸 버림](pitfalls.md#2-저장했는데-값이-안-들어감), 없는 속성 읽기(`null`). 엄격 모드는 이것들을 **개발 중에 예외로** 바꾼다.

| 설정 | 잡아내는 것 | 던지는 예외 |
|---|---|---|
| `Model::preventLazyLoading()` | 즉시 로딩 없이 관계 접근(N+1 의 원인) | `LazyLoadingViolationException` |
| `Model::preventSilentlyDiscardingAttributes()` | fillable 에 없는 칸을 `create`·`fill` 에 넣음 | `MassAssignmentException` |
| `Model::preventAccessingMissingAttributes()` | `select` 에 없거나 존재하지 않는 속성 읽기 | `MissingAttributeException` |
| `Model::shouldBeStrict()` | **위 셋을 한꺼번에** | |

### 예제 — 개발에서만 켜기 (일반 Laravel 예)

```php
// app/Providers/AppServiceProvider.php
use Illuminate\Database\Eloquent\Model;

public function boot(): void
{
    // 운영에서는 끈다 — 사용자가 500 오류를 보면 안 된다
    Model::shouldBeStrict(! $this->app->isProduction());
}
```

이제 반복문에서 `$post->user->name` 을 즉시 로딩 없이 쓰면 **로컬 화면이 바로 깨진다.** 불편해 보이지만, 운영에서 "목록이 느려요" 보고를 받고 원인을 찾는 것보다 훨씬 싸다. 테스트도 같은 설정으로 돌므로 N+1 이 있는 코드는 테스트에서 먼저 실패한다.

### 순수 PHP 와 비교

`error_reporting(E_ALL)` 과 `declare(strict_types=1)` 을 켜서 "조용한 변환" 을 오류로 바꾸는 것과 같은 생각이다.

⚠ 엄격 모드를 **나중에** 켜면 기존 코드 여기저기가 한꺼번에 깨진다. 새 프로젝트(연습 프로젝트 포함)는 첫날 켠다.

---

## 6. 대량 처리 — chunk·chunkById·lazy·cursor

### 핵심 개념

`Post::all()` 은 모든 행을 모델 객체로 만들어 **한꺼번에 메모리에** 올린다. 10만 행이면 PHP 메모리 한도(`memory_limit`)를 넘는다. 대량 작업(일괄 메일, 데이터 이전, 통계 재계산)은 나눠서 돈다.

| 방법 | 쿼리 | 메모리 | 돌려주는 것 | 도중에 행을 고칠 때 |
|---|---|---|---|---|
| `chunk(500, fn)` | 500개씩 `OFFSET` | 500개분 | 콜백에 Collection | ⚠ 거르는 칸을 고치면 행을 건너뜀 |
| `chunkById(500, fn)` | `id > 마지막 id` 로 | 500개분 | 콜백에 Collection | ✅ 안전 |
| `lazy(500)` · `lazyById(500)` | 내부적으로 chunk | 500개분 | `LazyCollection`(foreach 로) | `lazyById` 가 안전 |
| `cursor()` | **쿼리 1번**, 한 행씩 | 모델 1개분(+DB 버퍼) | `LazyCollection` | 즉시 로딩 불가 |

### 예제 (일반 Laravel 예)

```php
// 오래된 초안을 보관 처리 — 거르는 칸(status)을 바꾸므로 chunkById
Post::where('status', 'draft')
    ->where('updated_at', '<', now()->subYear())
    ->chunkById(500, function ($posts) {
        foreach ($posts as $post) {
            $post->update(['status' => 'archived']);   // 모델 이벤트도 실행된다
        }
    });

// 읽기만 — foreach 로 자연스럽게
foreach (User::where('subscribed', true)->lazy() as $user) {
    // 메일 보내기(실제로는 큐에 넣는다 — queues.md)
}
```

⚠ `chunk()` 로 돌면서 `status = 'draft'` 조건의 행을 `archived` 로 바꾸면, 다음 페이지의 `OFFSET` 이 줄어든 결과 기준으로 계산되어 **절반쯤을 건너뛴다.** 조건 칸을 바꾸는 작업은 항상 `chunkById` 다.

### 순수 PHP 와 비교

`cursor()` 는 PDO 의 `while ($row = $stmt->fetch())` 와 같다(한 행씩). `chunk` 는 `LIMIT 500 OFFSET n` 반복 루프를 직접 짜던 일이다.

---

## 7. 이벤트 없이 한 번에 — insert·upsert

### 핵심 개념

모델로 1,000개를 `create()` 하면 `INSERT` 가 1,000번이다. 한 번의 SQL 로 여러 행을 넣는 메서드가 있지만, **모델을 거치지 않으므로** 조건이 붙는다.

| 메서드 | SQL | 모델 이벤트 | 타임스탬프 |
|---|---|---|---|
| `create()` 반복 | INSERT × n | 실행 | 자동 |
| `Post::insert([...])` | INSERT 1번 | ❌ | ❌ 직접 넣어야 함 |
| `Post::upsert([...], uniqueBy: [...], update: [...])` | INSERT … ON CONFLICT 1번 | ❌ | 모델이면 채워 줌 |

### 예제 — 외부 가격표 동기화 (일반 Laravel 예)

```php
// sku 가 같으면 price·name 만 고치고, 없으면 새로 넣는다 — 행 수와 상관없이 쿼리 1번
Product::upsert(
    [
        ['sku' => 'A-1', 'name' => '연필', 'price' => 500],
        ['sku' => 'B-2', 'name' => '공책', 'price' => 1500],
    ],
    uniqueBy: ['sku'],            // 충돌 판정 칸 — DB 에 unique 인덱스가 있어야 한다
    update: ['name', 'price'],    // 충돌하면 고칠 칸
);
```

⚠ `insert`·`upsert` 는 **모델 이벤트·옵저버·`saving` 계산을 건너뛴다.** PES 의 완성도 점수처럼 이벤트로 계산하는 값이 있는 모델이면 [pitfalls.md 11번](pitfalls.md#11-완성도-점수가-안-바뀜--모델-이벤트-건너뜀) 과 똑같은 문제가 생긴다. 쿼리 빌더 `update()` 도 같다.

⚠ `uniqueBy` 칸에 unique 인덱스가 없으면 PostgreSQL 은 `ON CONFLICT` 대상을 못 찾아 오류를 낸다.

---

## 8. 작은 도구들 — replicate·is·touches·$with

### 핵심 개념과 예제 (일반 Laravel 예)

```php
// replicate — 저장 안 된 복사본. id·타임스탬프는 비운다
$copy = $post->replicate(['slug']);   // slug 는 복사하지 않음
$copy->title = $post->title.' (사본)';
$copy->save();

// is / isNot — 같은 테이블의 같은 기본 키인가 (== 로 객체 비교하지 않는다)
if ($post->user->is($request->user())) { /* 내 글 */ }

// touches — 자식이 바뀌면 부모의 updated_at 도 갱신
class Comment extends Model
{
    protected $touches = ['post'];    // 댓글 저장 → posts.updated_at = now()
}

// $with — 항상 함께 불러올 관계
class Post extends Model
{
    protected $with = ['user'];       // Post 를 조회할 때마다 user 즉시 로딩
}
Post::without('user')->get();         // 이번만 빼기
```

- `is()` 가 필요한 이유 — `$a == $b` 는 두 객체의 **모든 속성**을 비교하므로, 한쪽만 관계를 불러왔거나 값을 고쳤으면 같은 행인데도 `false` 다.
- `touches` 는 "목록을 최근 활동순으로" 나 캐시 무효화 키(`updated_at`)에 쓴다.
- ⚠ `$with` 는 편하지만 그 관계가 필요 없는 곳에서도 **항상** 쿼리가 나간다. 모델 대부분의 화면이 정말 그 관계를 쓸 때만 둔다.

---

## 9. 옵저버 — 모델 이벤트를 한 클래스로

### 핵심 개념

[모델 이벤트](eloquent.md#10-모델-이벤트) 를 `booted()` 안에 클로저로 여러 개 쓰면 모델 파일이 길어진다. **옵저버**는 한 모델의 이벤트 처리를 전용 클래스로 모은다. 메서드 이름 = 이벤트 이름이다.

```
creating → created      (새 행 INSERT 전·후)
updating → updated      (UPDATE 전·후)
saving   → saved        (INSERT·UPDATE 둘 다)
deleting → deleted
restoring → restored    (소프트 삭제 되살리기)
forceDeleting → forceDeleted
```

`-ing` 는 **전**(여기서 `false` 를 돌려주면 작업이 취소된다), `-ed` 는 **후**다.

### 예제 — 글을 지우면 다형 댓글도 지우기 (일반 Laravel 예)

```bash
php artisan make:observer PostObserver --model=Post
```

```php
// app/Observers/PostObserver.php
class PostObserver
{
    public function creating(Post $post): void
    {
        $post->slug ??= Str::slug($post->title);    // 저장 전에 채우기
    }

    public function deleted(Post $post): void
    {
        $post->comments()->delete();                // 다형 관계는 FK 제약이 없으니 직접
    }
}

// app/Models/Post.php — 모델에 등록
use Illuminate\Database\Eloquent\Attributes\ObservedBy;

#[ObservedBy([PostObserver::class])]
class Post extends Model { /* … */ }
```

속성 대신 `AppServiceProvider::boot()` 에서 `Post::observe(PostObserver::class);` 로 등록해도 된다.

### 이벤트를 일부러 끄기

```php
$post->saveQuietly();                               // 이 저장만 이벤트 없이
Post::withoutEvents(fn () => $seeder->run());       // 블록 안 전부
```

⚠ 옵저버는 **모델 메서드**(`create`·`save`·`update`·`delete`)에서만 실행된다. `Post::where(...)->update()`·`insert`·`upsert`·`DB::table()` 은 모델을 만들지 않으므로 옵저버를 건너뛴다(7절, [pitfalls.md 11번](pitfalls.md#11-완성도-점수가-안-바뀜--모델-이벤트-건너뜀)).

⚠ 트랜잭션 안에서 저장하고 옵저버가 메일·큐 작업을 보내면, 나중에 트랜잭션이 롤백되어도 메일은 이미 나갔다. 커밋 뒤에 실행하려면 옵저버가 `ShouldHandleEventsAfterCommit` 인터페이스를 구현한다 — [transactions.md](transactions.md).

---

## 10. 암기 카드

| 질문 | 답 |
|---|---|
| 접근자 메서드 `fullName()` 을 부르는 속성 이름은? | `$model->full_name` |
| 접근자·변경자가 돌려주는 객체는? | `Attribute::make(get: …, set: …)` |
| 접근자 칸으로 `where` 할 수 있나? | 없다 — PHP 에만 있는 값이다 |
| 접근자 값을 JSON 에 항상 넣으려면? | `protected $appends = ['full_name']` |
| 소프트 삭제에 필요한 두 가지는? | `SoftDeletes` 트레이트 + `softDeletes()` 칸 |
| 지운 것까지 조회 / 지운 것만 조회는? | `withTrashed()` / `onlyTrashed()` |
| 되살리기 / 진짜 삭제는? | `restore()` / `forceDelete()` |
| 소프트 삭제와 unique 가 부딪칠 때 검증 규칙은? | `Rule::unique(...)->withoutTrashed()` |
| 전역 스코프를 이번만 끄려면? | `withoutGlobalScope(클래스)` |
| 개발 중 N+1·대량 할당 버림을 예외로 바꾸는 한 줄은? | `Model::shouldBeStrict(! app()->isProduction())` |
| 즉시 로딩 없이 관계에 접근하면 나는 예외는? | `LazyLoadingViolationException` |
| 조건 칸을 고치며 대량으로 돌 때 쓰는 것은? | `chunkById()` (`chunk()` 는 행을 건너뛴다) |
| 쿼리 한 번으로 한 행씩 도는 것은? | `cursor()` |
| 있으면 고치고 없으면 넣기를 쿼리 한 번으로? | `upsert($rows, uniqueBy: [...], update: [...])` |
| `insert`·`upsert` 가 건너뛰는 것은? | 모델 이벤트·옵저버 (`insert` 는 타임스탬프도) |
| 두 모델이 같은 행인지 비교하는 메서드는? | `is()` / `isNot()` |
| 댓글 저장 때 글의 `updated_at` 도 갱신하려면? | 댓글 모델에 `$touches = ['post']` |
| 옵저버를 모델에 붙이는 속성은? | `#[ObservedBy([PostObserver::class])]` |
