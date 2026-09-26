# 심화 — 관계 더 알기 — 다대다·피벗·관계 집계·다형

글에 태그 달기, 강사가 가르치는 과목 여러 개, 글과 사진 양쪽에 붙는 댓글처럼 **한쪽이 여럿이고 다른 쪽도 여럿인 관계**는 [4단계 Eloquent](eloquent.md#7-관계--hasonehasmanybelongsto) 의 `hasOne`·`hasMany`·`belongsTo` 만으로는 표현할 수 없다. 이 문서는 그다음 단계다. 괄호 규칙과 [즉시 로딩·N+1](eloquent.md#8-즉시-로딩과-n1) 을 먼저 익히고 읽는다.

PES 저장소에는 아직 다대다·다형 관계가 없다. 그래서 이 문서의 예제는 대부분 **일반 Laravel 예**(미니 게시판: `User`·`Post`·`Comment`·`Tag`)이고, PES 코드는 발췌가 있는 곳에서만 인용한다.

## 목차

1. [관계 한눈에 — 지도](#1-관계-한눈에--지도)
2. [다대다 — belongsToMany 와 피벗 테이블](#2-다대다--belongstomany-와-피벗-테이블)
3. [피벗 다루기 — attach·detach·sync·toggle](#3-피벗-다루기--attachdetachsynctoggle)
4. [피벗에 칸 더하기 — withPivot·withTimestamps·using](#4-피벗에-칸-더하기--withpivotwithtimestampsusing)
5. [건너뛰는 관계 — hasManyThrough](#5-건너뛰는-관계--hasmanythrough)
6. [다형 관계 — 여러 모델에 붙는 댓글](#6-다형-관계--여러-모델에-붙는-댓글)
7. [관계로 저장하기 — create·save·associate](#7-관계로-저장하기--createsaveassociate)
8. [관계 집계 — withCount·withExists·withSum](#8-관계-집계--withcountwithexistswithsum)
9. [관계로 거르기 — has·doesntHave·whereRelation](#9-관계로-거르기--hasdoesnthavewhererelation)
10. [즉시 로딩 심화 — 제약·중첩·latestOfMany](#10-즉시-로딩-심화--제약중첩latestofmany)
11. [암기 카드](#11-암기-카드)

---

## 1. 관계 한눈에 — 지도

### 핵심 개념

관계 메서드는 "**외래 키가 어느 테이블에 있나**" 로 고른다. 이 한 가지만 판단하면 메서드 이름이 따라온다.

| 관계 | 외래 키 위치 | 예 | 메서드 |
|---|---|---|---|
| 1:1 | 상대 테이블 | 사용자 → 프로필 | `hasOne` |
| 1:1 (반대편) | 내 테이블 | 프로필 → 사용자 | `belongsTo` |
| 1:N | 상대 테이블 | 글 → 댓글들 | `hasMany` |
| N:1 | 내 테이블 | 댓글 → 글 | `belongsTo` |
| **N:M** | **제3의 테이블(피벗)** | 글 ↔ 태그 | `belongsToMany` (양쪽 모두) |
| 건너뛰기 | 중간 테이블을 거쳐 | 게시판 → (글) → 댓글 | `hasManyThrough` · `hasOneThrough` |
| **다형** | 내 테이블에 `*_type` + `*_id` | 댓글 → 글 또는 사진 | `morphTo` ↔ `morphMany` · `morphOne` |
| 다형 N:M | 피벗에 `*_type` | 글·영상 ↔ 태그 | `morphToMany` ↔ `morphedByMany` |

```
         hasMany                         belongsToMany (양쪽)
 posts ───────────▶ comments      posts ◀───── post_tag ─────▶ tags
  id                 post_id        id         post_id  tag_id    id

         morphMany                        hasManyThrough
 posts  ─┐                        boards ──▶ posts ──▶ comments
 photos ─┴─▶ comments               id      board_id   post_id
             commentable_type
             commentable_id
```

### 순수 PHP 와 비교

순수 PHP 에서는 관계가 "JOIN 을 어떻게 쓰느냐" 였다. Eloquent 는 관계를 **모델의 메서드 이름**으로 한 번 선언해 두고, 그 이름으로 조회·저장·집계·거르기를 모두 한다. SQL 을 고치고 싶으면 관계 메서드 한 곳만 고치면 된다.

---

## 2. 다대다 — belongsToMany 와 피벗 테이블

### 핵심 개념

글 하나에 태그가 여럿, 태그 하나에 글이 여럿이면 어느 쪽 테이블에도 외래 키를 둘 수 없다. 그래서 **둘을 잇는 제3의 테이블**을 만든다. Laravel 은 이것을 **피벗 테이블**이라 부른다.

피벗 테이블 이름 규칙: **두 모델의 단수 snake_case 이름을 알파벳순으로 `_` 로 잇는다.**

| 모델 | 피벗 테이블 | 칸 |
|---|---|---|
| `Post` · `Tag` | `post_tag` (p < t) | `post_id`, `tag_id` |
| `User` · `Role` | `role_user` (r < u) | `role_id`, `user_id` |
| `Tutor` · `Subject` | `subject_tutor` | `subject_id`, `tutor_id` |

⚠ `posts_tags`·`tag_post` 처럼 복수형이나 역순으로 만들면 Laravel 이 테이블을 못 찾는다. 규칙을 벗어나면 두 번째 인자로 적는다.

### 순수 PHP 와 비교

```php
// 순수 PDO — 글 1번의 태그
$stmt = $pdo->prepare('SELECT tags.* FROM tags
    JOIN post_tag ON post_tag.tag_id = tags.id
    WHERE post_tag.post_id = ?');
$stmt->execute([1]);

// Eloquent — 관계 이름으로
$post->tags;
```

### 예제 — 마이그레이션과 모델 (일반 Laravel 예)

```php
// database/migrations/xxxx_create_post_tag_table.php
Schema::create('post_tag', function (Blueprint $table) {
    $table->foreignId('post_id')->constrained()->cascadeOnDelete();
    $table->foreignId('tag_id')->constrained()->cascadeOnDelete();
    $table->primary(['post_id', 'tag_id']);   // 같은 짝이 두 번 들어가지 않게
});
```

```php
// app/Models/Post.php
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Post extends Model
{
    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class);
    }
}

// app/Models/Tag.php — 반대편도 똑같이 belongsToMany
class Tag extends Model
{
    public function posts(): BelongsToMany
    {
        return $this->belongsToMany(Post::class);
    }
}
```

규칙을 벗어날 때는 인자 네 개를 적는다: `belongsToMany(관련모델, 피벗테이블, 이쪽외래키, 저쪽외래키)`.

```php
return $this->belongsToMany(Role::class, 'user_roles', 'user_id', 'role_id');
```

피벗 테이블에는 **모델 파일이 필요 없다**(4절의 `using` 을 쓰기 전까지). 그리고 `hasMany` 와 달리 **양쪽 모두 `belongsToMany`** 다 — 누가 외래 키를 "가졌다" 고 할 수 없기 때문이다.

---

## 3. 피벗 다루기 — attach·detach·sync·toggle

### 핵심 개념

피벗 테이블에 행을 넣고 빼는 일은 관계 메서드(괄호 O)에 붙은 전용 메서드로 한다. 모델 `save()` 가 아니다.

| 메서드 | 하는 일 | 피벗 SQL |
|---|---|---|
| `attach(3)` · `attach([3, 5])` | 짝 추가 | `INSERT` |
| `detach(3)` · `detach()` | 짝 삭제 / 전부 삭제 | `DELETE` |
| `sync([1, 2, 3])` | **목록과 똑같이 맞춤** — 없으면 넣고 목록에 없는 것은 뺀다 | `INSERT` + `DELETE` |
| `syncWithoutDetaching([4])` | 넣기만 하고 빼지는 않음(중복은 건너뜀) | `INSERT` |
| `toggle([1, 2])` | 있으면 빼고 없으면 넣음 | 둘 다 |
| `updateExistingPivot(3, [...])` | 피벗 칸 값만 고침 | `UPDATE` |

### 예제 — 태그 체크박스 저장 (일반 Laravel 예)

```php
public function update(Request $request, Post $post)
{
    $data = $request->validate([
        'title' => ['required', 'string', 'max:200'],
        'tag_ids' => ['array'],
        'tag_ids.*' => ['integer', 'exists:tags,id'],
    ]);

    $post->update(['title' => $data['title']]);
    $changes = $post->tags()->sync($data['tag_ids'] ?? []);   // 체크한 것과 똑같이 맞춘다

    // $changes = ['attached' => [5], 'detached' => [2], 'updated' => []]
    return back()->with('status', count($changes['attached']).'개 태그를 붙였습니다');
}
```

폼에서 체크박스로 태그를 고르는 화면은 `sync()` 가 정답이다. "지금 상태 = 체크한 목록" 이기 때문이다. `attach()` 로 하면 같은 짝이 두 번 들어가 기본 키 충돌이 나거나(복합 기본 키가 있을 때) 중복 행이 쌓인다.

⚠ `sync([])` 는 **전부 떼어 낸다.** 입력이 비어 있을 때 `$data['tag_ids'] ?? []` 처럼 빈 배열이 넘어가면 태그가 모두 사라지므로, "태그 칸을 아예 안 보냈다"와 "모두 해제했다"를 구분해야 하는 화면이면 `$request->has('tag_ids')` 로 먼저 확인한다.

### 순수 PHP 와 비교

순수 PHP 의 "기존 행 `DELETE` → 새 목록 `INSERT` 반복" 을 `sync()` 한 줄이 한다. 게다가 바뀐 것만 건드리므로 그대로 둔 짝의 `created_at` 이 지켜진다.

---

## 4. 피벗에 칸 더하기 — withPivot·withTimestamps·using

### 핵심 개념

피벗 테이블에도 칸을 더 둘 수 있다. "사용자가 역할을 **언제** 받았나", "강사가 이 과목을 **몇 년** 가르쳤나" 같은 **관계 자체의 정보**다. 이 칸은 어느 한쪽 모델의 칸이 아니므로 피벗에 둔다.

기본으로는 피벗의 두 외래 키만 읽는다. 다른 칸은 **알려 줘야** 읽힌다.

### 예제 — 강사와 과목 (일반 Laravel 예)

```php
// subject_tutor 에 years(경력 연수) 칸과 created_at·updated_at 이 있다
public function subjects(): BelongsToMany
{
    return $this->belongsToMany(Subject::class, 'subject_tutor', 'tutor_id', 'subject_id')
        ->withPivot('years')              // 이 칸도 읽어 온다
        ->withTimestamps()                // attach·sync 때 created_at·updated_at 을 채운다
        ->as('teaching');                 // ->pivot 대신 ->teaching 으로 부른다
}
```

```php
$tutor->subjects()->attach($subjectId, ['years' => 3]);   // 피벗 칸 값과 함께
$tutor->subjects()->updateExistingPivot($subjectId, ['years' => 4]);

foreach ($tutor->subjects as $subject) {
    echo $subject->name.' — '.$subject->teaching->years.'년';   // 피벗 칸 읽기
}

// 피벗 칸으로 거르기
$tutor->subjects()->wherePivot('years', '>=', 3)->get();
```

`->as()` 를 안 쓰면 `$subject->pivot->years` 다. `pivot` 이라는 이름이 코드에서 무엇인지 드러나지 않으므로 칸이 있는 피벗은 이름을 붙여 주는 편이 읽기 좋다.

### 피벗 모델 — using

피벗에 casts·메서드·이벤트가 필요해지면 피벗 전용 모델을 만든다. `Model` 이 아니라 `Pivot` 을 상속한다.

```php
use Illuminate\Database\Eloquent\Relations\Pivot;

class SubjectTutor extends Pivot
{
    protected function casts(): array
    {
        return ['certified_at' => 'date'];
    }
}

// 관계에서 알려 준다
return $this->belongsToMany(Subject::class)->using(SubjectTutor::class)->withPivot('years', 'certified_at');
```

⚠ `withTimestamps()` 를 빼먹고 피벗에 `created_at` 칸만 만들어 두면 `attach()` 가 그 칸을 채우지 않아 `null` 로 남는다(칸이 `NOT NULL` 이면 오류).

---

## 5. 건너뛰는 관계 — hasManyThrough

### 핵심 개념

게시판(`boards`) → 글(`posts.board_id`) → 댓글(`comments.post_id`) 구조에서 "이 게시판의 모든 댓글"이 필요하면, 글을 하나씩 돌며 댓글을 모을 필요 없이 **중간 테이블을 건너뛰는 관계**를 선언한다.

```php
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class Board extends Model
{
    public function posts(): HasMany
    {
        return $this->hasMany(Post::class);
    }

    public function comments(): HasManyThrough
    {
        // 최종 모델, 중간 모델 — 외래 키가 규칙(board_id, post_id)대로면 이것으로 끝
        return $this->hasManyThrough(Comment::class, Post::class);
    }
}

$board->comments()->latest()->take(10)->get();   // JOIN 한 번
```

결과가 하나뿐이면 `hasOneThrough` 다(예: 정비사 → 자동차 → 차 주인).

### 순수 PHP 와 비교

```php
// 순수 SQL 로 쓰던 것
SELECT comments.* FROM comments
JOIN posts ON posts.id = comments.post_id
WHERE posts.board_id = ?
```

`hasManyThrough` 는 이 JOIN 을 관계 이름 하나로 감싼 것이다. **읽기 전용**으로 생각하는 편이 안전하다 — 이 관계로 `create()` 하면 중간 모델(글)을 정할 수 없다. 댓글은 `$post->comments()->create()` 로 만든다.

---

## 6. 다형 관계 — 여러 모델에 붙는 댓글

### 핵심 개념

댓글이 글(`Post`)에도, 사진(`Photo`)에도 붙는다. `post_id`·`photo_id` 칸을 둘 다 두고 하나만 채우는 대신, **"어느 종류의 무엇" 을 두 칸으로** 적는다.

| `comments` 칸 | 뜻 | 예 |
|---|---|---|
| `commentable_type` | 붙은 대상의 종류 | `post` 또는 `photo` |
| `commentable_id` | 그 대상의 기본 키 | `42` |

관계 이름(`commentable`)이 두 칸의 접두사가 된다. 이것이 **다형(polymorphic) 관계**다.

### 예제 — 마이그레이션과 모델 (일반 Laravel 예)

```php
Schema::create('comments', function (Blueprint $table) {
    $table->id();
    $table->morphs('commentable');   // commentable_type + commentable_id + 복합 인덱스
    $table->foreignId('user_id')->constrained();
    $table->text('body');
    $table->timestamps();
});
```

```php
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Comment extends Model
{
    public function commentable(): MorphTo
    {
        return $this->morphTo();          // 댓글 → 글 또는 사진 (type 칸을 보고 고른다)
    }
}

class Post extends Model
{
    public function comments(): MorphMany
    {
        return $this->morphMany(Comment::class, 'commentable');
    }
}

class Photo extends Model
{
    public function comments(): MorphMany
    {
        return $this->morphMany(Comment::class, 'commentable');
    }
}
```

```php
$post->comments()->create(['user_id' => $user->id, 'body' => '좋아요']);   // type·id 자동
$comment->commentable;      // Post 또는 Photo 객체
```

### type 칸에 무엇을 적나 — morphMap

기본값은 **클래스 전체 이름**(`App\Models\Post`)이다. 그러면 나중에 클래스 이름이나 네임스페이스를 바꿀 때 DB 의 옛 값이 전부 깨진다. 그래서 짧은 별명을 등록한다.

```php
// app/Providers/AppServiceProvider.php 의 boot()
use Illuminate\Database\Eloquent\Relations\Relation;

Relation::enforceMorphMap([
    'post' => \App\Models\Post::class,
    'photo' => \App\Models\Photo::class,
]);
```

`enforceMorphMap` 은 등록 안 된 모델을 다형 관계에 쓰면 **예외를 던진다** — 별명 없이 클래스 이름이 몰래 저장되는 사고를 막는다. 처음부터 켜 두는 것이 좋다.

### PES 코드와 비교 — `AdminLog` 의 subject_type

PES 의 관리 기록(`app/Models/AdminLog.php`, [eloquent.md 2절](eloquent.md#2-이름-규칙과-바꾸는-법) 발췌)도 같은 생각을 쓴다.

```php
'subject_type' => $subject->getTable(),   // 모델의 테이블 이름
'subject_id' => $subject->getKey(),       // 모델의 기본 키 값
```

어떤 모델이든 "종류 + 기본 키" 두 칸으로 가리키는 **다형 참조**다. 다만 PES 는 `morphTo()` 관계를 선언하지 않고 테이블 이름을 직접 적는다 — 기록을 **쓰기만** 하고 기록에서 대상 모델을 불러올 일이 적기 때문이다. 불러와야 한다면 `morphTo()` 와 morphMap 으로 옮기는 것이 Laravel 다운 방법이다.

⚠ 다형 관계는 `commentable_id` 에 **외래 키 제약을 걸 수 없다**(가리키는 테이블이 행마다 다르다). 그래서 대상 글을 지워도 DB 가 댓글을 지워 주지 않는다. 모델 이벤트(`deleting`)나 옵저버에서 직접 지운다 — [eloquent-plus.md](eloquent-plus.md#9-옵저버--모델-이벤트를-한-클래스로) 의 옵저버 절.

---

## 7. 관계로 저장하기 — create·save·associate

### 핵심 개념

자식을 만들 때 외래 키를 손으로 넣지 말고 **부모의 관계 메서드로** 만든다. 외래 키가 자동으로 채워지고, 남의 부모에 붙이는 실수가 줄어든다.

| 상황 | 코드 | 채워지는 칸 |
|---|---|---|
| 부모 → 자식 하나 만들기 | `$post->comments()->create([...])` | `comments.post_id` |
| 부모 → 이미 만든 객체 저장 | `$post->comments()->save($comment)` | 〃 |
| 여러 개 | `$post->comments()->createMany([[...], [...]])` | 〃 |
| 자식 → 부모 바꾸기 | `$comment->post()->associate($post); $comment->save();` | `comments.post_id` |
| 자식 → 부모 떼기 | `$comment->post()->dissociate(); $comment->save();` | `null` |

### 예제 — 로그인한 사용자의 글 (일반 Laravel 예)

```php
// ❌ 외래 키를 요청에서 받으면 남의 이름으로 글을 쓸 수 있다
Post::create($request->all());

// ✅ 로그인한 사용자의 관계로 만든다 — user_id 는 서버가 채운다
$post = $request->user()->posts()->create($request->validated());
```

이것은 [pitfalls.md 7번](pitfalls.md#7-남의-데이터가-보이거나-지워짐) 과 짝이다. **읽을 때도 쓸 때도 "내 관계" 에서 출발한다.**

`associate()` 는 `belongsTo` 쪽에서 쓰는 메서드다. 호출만으로는 DB 에 저장되지 않으므로 `save()` 를 잊지 않는다.

---

## 8. 관계 집계 — withCount·withExists·withSum

### 핵심 개념

목록 화면에 "댓글 12" 를 보여 주려고 `$post->comments->count()` 를 쓰면 **글마다 댓글 전부를 불러온다**(N+1 + 쓸데없는 데이터). 필요한 것은 숫자 하나다. `withCount()` 는 SQL 하위 쿼리로 **개수만** 세어 모델에 `관계_count` 속성으로 붙인다.

| 메서드 | 붙는 속성 | SQL |
|---|---|---|
| `withCount('comments')` | `comments_count` | `(select count(*) …)` |
| `withExists('comments')` | `comments_exists` (bool) | `exists(…)` |
| `withSum('orders', 'amount')` | `orders_sum_amount` | `(select sum(amount) …)` |
| `withAvg`·`withMin`·`withMax` | `orders_avg_amount` … | 〃 |

### 예제 — 게시판 목록 (일반 Laravel 예)

```php
$posts = Post::query()
    ->withCount('comments')                                            // comments_count
    ->withCount(['comments as approved_count' => fn ($q) => $q->where('approved', true)])
    ->withExists(['likes as liked_by_me' => fn ($q) => $q->where('user_id', auth()->id())])
    ->orderByDesc('comments_count')                                    // 집계로 정렬도 된다
    ->paginate(20);
```

```blade
@foreach ($posts as $post)
    {{ $post->title }} · 댓글 {{ $post->comments_count }} (승인 {{ $post->approved_count }})
    @if ($post->liked_by_me) ♥ @endif
@endforeach
```

이미 가져온 모델에 나중에 붙이려면 `$post->loadCount('comments')` 다(`with()` ↔ `load()` 와 같은 짝).

### 순수 PHP 와 비교

순수 SQL 의 `SELECT posts.*, (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS comments_count` 를 직접 쓰던 일이다. `withCount` 는 그 하위 쿼리를 관계 정의에서 만들어 준다.

⚠ `comments_count` 는 `withCount` 를 쓴 쿼리에서만 생긴다. 다른 화면에서 `$post->comments_count` 를 부르면 `null` 이다(오류가 아니라 조용히). [eloquent-plus.md](eloquent-plus.md#5-엄격-모드--조용한-실수를-예외로) 의 엄격 모드를 켜면 이런 "없는 속성" 읽기가 예외로 드러난다.

---

## 9. 관계로 거르기 — has·doesntHave·whereRelation

### 핵심 개념

"댓글이 **있는** 글만", "태그가 **없는** 글만" 처럼 관계의 존재로 부모를 거른다. [eloquent.md 의 whereHas](eloquent.md#관계로-조건-걸기--wherehas) 가 조건 있는 버전이고, 나머지는 그 친척이다.

| 메서드 | 뜻 |
|---|---|
| `has('comments')` | 댓글이 하나라도 있는 글 |
| `has('comments', '>=', 3)` | 댓글 3개 이상 |
| `doesntHave('comments')` | 댓글이 없는 글 |
| `whereHas('comments', fn ($q) => …)` | 조건에 맞는 댓글이 있는 글 |
| `whereDoesntHave('comments', fn ($q) => …)` | 조건에 맞는 댓글이 없는 글 |
| `whereRelation('comments', 'approved', true)` | `whereHas` 의 한 줄 줄임 |
| `withWhereHas('comments', fn ($q) => …)` | 거르기 **+** 같은 조건으로 즉시 로딩 |

### 예제 (일반 Laravel 예)

```php
// 오늘 승인된 댓글이 있는 글, 그리고 그 댓글만 함께 가져오기
$posts = Post::withWhereHas('comments', fn ($q) => $q
    ->where('approved', true)
    ->whereDate('created_at', today())
)->get();

// 점 표기로 중첩 관계도 거른다 — 관리자가 쓴 댓글이 있는 글
Post::whereHas('comments.user', fn ($q) => $q->where('is_admin', true))->get();
```

⚠ `whereHas` 로 걸렀다고 `$post->comments` 가 **걸러진 댓글만** 되는 것은 아니다. 거르기(어떤 글을 가져올까)와 로딩(그 글의 어떤 댓글을 붙일까)은 별개다. 둘 다 같은 조건이면 `withWhereHas` 를 쓴다.

---

## 10. 즉시 로딩 심화 — 제약·중첩·latestOfMany

### 핵심 개념

`with('관계')` 는 관계 전체를 가져온다. 실제 화면은 "최근 댓글 3개만", "댓글과 그 작성자까지" 처럼 더 세밀하다.

### 예제 — 목록에 최근 댓글 3개와 작성자 (일반 Laravel 예)

```php
$posts = Post::query()
    ->with([
        'user:id,name',                                        // 필요한 칸만 (id 는 꼭 포함)
        'comments' => fn ($q) => $q->latest()->limit(3),       // 글마다 최근 3개
        'comments.user:id,name',                               // 중첩 — 댓글의 작성자
    ])
    ->latest()
    ->paginate(20);
```

- **제약 있는 로딩** — 배열 키에 관계 이름, 값에 클로저. 클로저 안은 그 관계의 쿼리 빌더다.
- **중첩 로딩** — `comments.user` 처럼 점으로 잇는다. 쿼리는 관계 단계마다 1번씩, 총 4번이다(글 1 + 작성자 1 + 댓글 1 + 댓글 작성자 1). 글이 20개여도 늘지 않는다.
- **칸 고르기** — `관계:칸,칸`. ⚠ 연결에 쓰는 키(`id`, 외래 키)를 빼면 관계가 붙지 않고 빈 값이 된다.
- 즉시 로딩 안의 `limit(3)` 이 **부모마다** 3개로 동작하는 것은 Laravel 11 부터다(그 전에는 전체에서 3개). 옛 튜토리얼의 우회 패키지는 필요 없다.

### latestOfMany — "여럿 중 하나" 를 관계로

"글마다 가장 최근 댓글 하나" 는 자주 쓰인다. `hasMany` 에서 첫 번째를 꺼내면 전부 불러오므로, **하나짜리 관계**를 따로 선언한다.

```php
public function latestComment(): HasOne
{
    return $this->hasOne(Comment::class)->latestOfMany();     // created_at… 이 아니라 id 기준 최댓값
}

public function bestComment(): HasOne
{
    return $this->hasOne(Comment::class)->ofMany('likes', 'max');   // 좋아요가 가장 많은 것
}

Post::with('latestComment')->get();   // 글마다 댓글 하나씩, 쿼리 2번
```

`latestOfMany()` 는 기본 키가 가장 큰 행을 고른다. 날짜 칸 기준이 필요하면 `latestOfMany('published_at')` 처럼 칸을 준다.

---

## 11. 암기 카드

| 질문 | 답 |
|---|---|
| 관계 메서드를 고르는 기준은? | 외래 키가 어느 테이블에 있나 |
| `Post` 와 `Tag` 의 피벗 테이블 이름은? | `post_tag` (단수, 알파벳순) |
| 다대다에서 반대편 모델의 관계는? | 양쪽 모두 `belongsToMany` |
| 체크박스 목록과 똑같이 맞추는 메서드는? | `sync()` |
| `sync([])` 를 하면? | 모든 짝을 떼어 낸다 |
| 넣기만 하고 빼지 않는 sync 는? | `syncWithoutDetaching()` |
| 피벗의 다른 칸을 읽으려면? | `withPivot('칸')` → `$model->pivot->칸` |
| 피벗 `created_at` 을 자동으로 채우려면? | `withTimestamps()` |
| 피벗에 casts 를 쓰려면? | `Pivot` 을 상속한 모델 + `using()` |
| 중간 테이블을 건너뛰는 1:N 관계는? | `hasManyThrough` |
| 다형 관계의 두 칸은? | `*_type` 과 `*_id` (`morphs('이름')`) |
| type 칸에 클래스 이름 대신 별명을 쓰려면? | `Relation::enforceMorphMap([...])` |
| 부모를 바꾸는 `belongsTo` 쪽 메서드는? | `associate()` (그다음 `save()`) |
| 댓글 개수만 붙이는 메서드와 속성 이름은? | `withCount('comments')` → `comments_count` |
| 관계가 없는 부모만 고르려면? | `doesntHave('관계')` |
| 거르기와 로딩을 같은 조건으로 하려면? | `withWhereHas()` |
| 글마다 최근 댓글 하나를 관계로 만들려면? | `hasOne(...)->latestOfMany()` |
| `with('user:id,name')` 에서 `id` 를 빼면? | 관계가 연결되지 않는다 |
