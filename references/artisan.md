# 수시 — Artisan 명령과 tinker

## 목차

1. [Artisan 이란](#1-artisan-이란)
2. [매일 쓰는 명령](#2-매일-쓰는-명령)
3. [스스로 조사하는 명령](#3-스스로-조사하는-명령)
4. [파일을 만드는 make:*](#4-파일을-만드는-make)
5. [캐시 명령](#5-캐시-명령)
6. [tinker — 앱이 로드된 REPL](#6-tinker--앱이-로드된-repl)
7. [직접 만든 명령 — user:role](#7-직접-만든-명령--userrole)
8. [암기 카드](#8-암기-카드)

---

## 1. Artisan 이란

`php artisan` 은 **Laravel 앱 전체를 불러온 상태로 실행하는 CLI** 다. 프로젝트 루트의 `artisan` 파일이 입구다. 모든 명령 목록은 `php artisan list`, 명령 하나의 도움말은 `php artisan help migrate`.

PES 는 PHP 가 Docker 컨테이너 안에 있으므로 **항상 앞에 `docker compose exec app` 을 붙인다.**

```bash
docker compose exec app php artisan route:list
```

---

## 2. 매일 쓰는 명령

| 명령 | 하는 일 |
|---|---|
| `php artisan test` | Pest 테스트 ([testing.md](testing.md#9-실행)) |
| `php artisan migrate` | 마이그레이션 적용 ([database.md](database.md#7-마이그레이션-명령과-주의)) |
| `php artisan tinker` | 앱이 로드된 PHP REPL (6절) |
| `php artisan route:list` | 라우트 목록 |
| `php artisan optimize:clear` | 모든 캐시 비우기 |
| `php artisan queue:failed` | 실패한 백그라운드 작업 |

---

## 3. 스스로 조사하는 명령

코드를 읽다 막히면 **추측하지 말고 앱에게 물어본다.**

| 궁금한 것 | 명령 |
|---|---|
| 이 URL 은 어느 컨트롤러로 가나? | `route:list --path=tutor/schedule` (`-v` 를 붙이면 미들웨어까지) |
| 이 라우트 이름의 URL 은? | `route:list --name=tutor.slots` |
| 이 모델의 칸·관계·casts·Fillable 은? | `model:show TutorProfile` |
| 이 테이블의 칸·인덱스·외래 키는? | `db:table tutor_slots` |
| DB 전체 요약(테이블 목록·크기)은? | `db:show` |
| 이 설정값은 지금 무엇인가? | `config:show tutor` |
| 버전·환경·드라이버 요약은? | `about` |
| 정기 작업 목록은? | `schedule:list` |
| 마이그레이션 적용 상태는? | `migrate:status` |

---

## 4. 파일을 만드는 make:*

틀(보일러플레이트)을 만들어 준다. **PES 저장소에서 AI 는 이 명령을 실행하지 않는다**(소스 코드는 사람이 만든다, `make:test` 만 예외). 공부할 때는 따로 만든 연습 프로젝트에서 사용자가 직접 실행한다.

| 명령 | 만드는 파일 |
|---|---|
| `make:model Post -mf` | 모델 + 마이그레이션(`-m`) + 팩토리(`-f`) |
| `make:model Post -a` | 모델 + 마이그레이션·팩토리·시더·컨트롤러·FormRequest·정책 전부 |
| `make:controller PostController` | 빈 컨트롤러 |
| `make:controller PostController --resource` | 리소스 7개 메서드가 있는 컨트롤러 |
| `make:controller MeController --invokable` | `__invoke` 하나짜리 |
| `make:request StorePostRequest` | FormRequest |
| `make:middleware SetLocale` | 미들웨어 |
| `make:policy PostPolicy --model=Post` | 정책 |
| `make:migration add_status_to_users_table` | 마이그레이션 |
| `make:component Button` | 컴포넌트 클래스 + 뷰 (`--view` 면 뷰만) |
| `make:enum Role` | enum |
| `make:command SetUserRole` | Artisan 명령 |
| `make:test PostTest` | 테스트 (Pest 가 설치돼 있으면 Pest 형식, `--unit` 이면 Unit) |

---

## 5. 캐시 명령

운영 서버는 속도를 위해 설정·라우트·뷰를 미리 굳혀 둔다.

| 굳히기 | 비우기 | 굳힌 뒤 주의 |
|---|---|---|
| `config:cache` | `config:clear` | `.env` 를 다시 읽지 않는다 → 코드의 `env()` 가 `null` 이 될 수 있다 |
| `route:cache` | `route:clear` | 라우트 파일을 고쳐도 반영 안 됨 |
| `view:cache` | `view:clear` | |
| `optimize` (전부) | `optimize:clear` (전부) | |

**"설정을 바꿨는데 반영이 안 돼요"** → 먼저 `optimize:clear`.

---

## 6. tinker — 앱이 로드된 REPL

### 핵심 개념

`tinker` 는 모델·헬퍼·설정이 모두 로드된 PHP 대화형 셸이다. **코드를 파일에 쓰기 전에 한 줄씩 실험하는 곳**이다. Eloquent 를 익히는 가장 빠른 길이다.

```bash
docker compose exec app php artisan tinker
```

```php
> config('tutor.trial_max_minutes')
= 15

> $u = App\Models\User::first()
> $u->tutorSlots                        // 괄호 없음 → Collection
> $u->tutorSlots()->toRawSql()          // 괄호 있음 → 어떤 SQL 인지 (값까지 채운 SQL)
> App\Models\TutorProfile::visible()->count()
> App\Models\TutorProfile::with('user')->first()->user->name
> App\Models\TutorSlot::weekdayName(1)
> app()->setLocale('ko'); App\Models\TutorSlot::weekdayName(1)
> lroute('tutor.schedule')
```

안전 규칙:

- **조회는 자유롭게.** `create`·`update`·`delete` 는 로컬 DB 에서만, 운영 서버에서는 하지 않는다.
- `exit` 또는 Ctrl+D 로 나온다.

실습 문제는 [exercises.md 3절](exercises.md#3-tinker-조회-실습).

---

## 7. 직접 만든 명령 — user:role

### 핵심 개념

Artisan 명령은 `app/Console/Commands/` 에 클래스로 만든다. **관리 작업처럼 웹 화면에 두기 싫은 일**을 명령으로 둔다. PES 는 관리자 역할을 이 명령으로만 준다.

### PES 코드 — `app/Console/Commands/SetUserRole.php`

```php
class SetUserRole extends Command
{
    //                      인자 {email}  인자 {role}  옵션 --remove (설명)
    protected $signature = 'user:role {email} {role} {--remove : 역할을 뺀다}';

    protected $description = '회원에게 관리 역할(admin · board_manager · comment_manager)을 주거나 뺀다';

    public function handle(): int
    {
        $user = User::firstWhere('email', $this->argument('email'));   // 인자 읽기
        $role = Role::tryFrom($this->argument('role'));               // 문자열 → enum, 없으면 null

        if (! $user) {
            $this->error('없는 회원: '.$this->argument('email'));      // 빨간 글씨

            return self::FAILURE;                                       // 종료 코드 1
        }
        if (! $role) {
            $this->error('없는 역할 — 쓸 수 있는 역할: '.implode(' · ', array_column(Role::cases(), 'value')));

            return self::FAILURE;
        }

        $remove = $this->option('remove');                              // 옵션 읽기 (true/false)
        $changed = $remove
            ? $user->roles()->where('role', $role)->delete() > 0
            : $user->roles()->firstOrCreate(['role' => $role])->wasRecentlyCreated;

        if ($changed) {
            AdminLog::record(null, $remove ? 'role_removed' : 'role_added', $user, ['role' => $role->value]);
        }

        $roles = $user->roles()->pluck('role')->map(fn (Role $r) => $r->value)->implode(', ');
        $this->info($user->email.' 의 역할: '.($roles ?: '없음'));        // 초록 글씨

        return self::SUCCESS;                                           // 종료 코드 0
    }
}
```

사용:

```bash
docker compose exec app php artisan user:role someone@example.com admin
docker compose exec app php artisan user:role someone@example.com admin --remove
```

| `$signature` 문법 | 뜻 |
|---|---|
| `{email}` | 필수 인자 |
| `{email?}` | 선택 인자 |
| `{--remove}` | 켜고 끄는 옵션 |
| `{--limit=10}` | 값이 있는 옵션 |
| `{x : 설명}` | 도움말에 보일 설명 |

`app/Console/Commands/` 의 클래스는 자동 등록된다. 짧은 명령은 `routes/console.php` 에 `Artisan::command('inspire', fn () => ...)` 로 클로저로도 만든다.

---

## 8. 암기 카드

| 질문 | 답 |
|---|---|
| PES 에서 artisan 앞에 붙이는 것은? | `docker compose exec app` |
| URL 로 라우트를 찾는 명령은? | `route:list --path=...` |
| 모델의 칸·관계·casts 를 보는 명령은? | `model:show 모델` |
| 테이블 구조를 보는 명령은? | `db:table 테이블` |
| 설정값을 보는 명령은? | `config:show 파일` |
| 설정이 반영 안 될 때 먼저 할 일은? | `optimize:clear` |
| 모델 + 마이그레이션 + 팩토리를 한 번에? | `make:model Post -mf` |
| 앱을 불러온 REPL 은? | `tinker` |
| 쿼리의 SQL 을 보는 메서드는? | `->toRawSql()` (바인딩 없이는 `->toSql()`) |
| 명령 클래스의 인자·옵션을 정하는 곳은? | `$signature` |
| 명령에서 인자·옵션 읽기는? | `$this->argument('x')` · `$this->option('x')` |
| 명령의 성공·실패 반환값은? | `self::SUCCESS` (0) · `self::FAILURE` (1) |
