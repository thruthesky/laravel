# 심화 — 큐·잡·이벤트·메일·알림·스케줄러 — 요청 밖에서 일하기

요청 하나가 응답을 돌려주기 전에 다 끝내지 않아도 되는 일(메일 보내기, 이미지 줄이기, 점수 다시 계산)을 **요청 밖으로 빼는** 도구들을 한 번에 다룬다. 이 문서의 예제는 PES 발췌가 아니라 **일반 Laravel 예**다. PES 에 대한 사실은 기존 문서에 적힌 것(PES 는 `queue` 컨테이너로 워커를 돌린다 — [pitfalls.md](pitfalls.md#10-코드를-고쳤는데-반영이-안-됨--캐시))만 인용한다.

## 목차

1. [왜 요청 밖에서 일하나](#1-왜-요청-밖에서-일하나)
2. [큐 설정 — 연결과 큐 테이블](#2-큐-설정--연결과-큐-테이블)
3. [잡 만들기와 디스패치](#3-잡-만들기와-디스패치)
4. [재시도와 실패 처리](#4-재시도와-실패-처리)
5. [SerializesModels — 모델은 id 로 간다](#5-serializesmodels--모델은-id-로-간다)
6. [워커 — queue:work 와 재시작](#6-워커--queuework-와-재시작)
7. [트랜잭션 안에서 디스패치 — afterCommit](#7-트랜잭션-안에서-디스패치--aftercommit)
8. [이벤트와 리스너](#8-이벤트와-리스너)
9. [메일 — Mailable](#9-메일--mailable)
10. [알림 — Notification](#10-알림--notification)
11. [스케줄러 — 서버 cron 한 줄](#11-스케줄러--서버-cron-한-줄)
12. [테스트 — 가짜로 바꿔 끼우기](#12-테스트--가짜로-바꿔-끼우기)
13. [암기 카드](#13-암기-카드)

---

## 1. 왜 요청 밖에서 일하나

### 핵심 개념

가입 버튼을 누르면 "환영 메일 보내기"가 끝날 때까지 브라우저가 기다린다. 메일 서버가 3초 걸리면 사용자도 3초 기다린다. **작업 큐**는 이런 일을 "할 일 목록"(DB 테이블·Redis)에 적어 두고 곧바로 응답하게 한다. 목록은 따로 떠 있는 프로세스 — **큐 워커** — 가 하나씩 꺼내 처리한다.

```
브라우저 ── POST /register ──▶ 컨트롤러
                                 │ ① User 저장
                                 │ ② SendWelcomeMail::dispatch($user)   ← 할 일을 적기만 한다
                                 ▼
                        jobs 테이블 (또는 Redis)
                        ┌──────────────────────────────┐
                        │ id │ queue   │ payload(직렬화) │
                        │ 41 │ default │ SendWelcomeMail │
                        └──────────────────────────────┘
                                 │ ③ 응답은 이미 나갔다 (redirect)
                                 ▼
             php artisan queue:work  (따로 떠 있는 워커 프로세스)
                                 │ ④ 꺼내서 handle() 실행 → 메일 발송
                                 ▼
                    성공 → 행 삭제 · 실패 → 재시도 → 끝내 실패 → failed_jobs
```

같은 "요청 밖에서 일하기"를 목적에 따라 다섯 도구로 나눈다.

| 도구 | 언제 | 이 문서 |
|---|---|---|
| 잡(Job) | 오래 걸리는 일 하나를 나중에 | 3~7절 |
| 이벤트·리스너 | "무슨 일이 일어났다"를 알리고, 반응은 여러 곳이 따로 | 8절 |
| 메일(Mailable) | 메일 한 통을 클래스로 | 9절 |
| 알림(Notification) | 같은 소식을 메일·DB·문자 등 여러 채널로 | 10절 |
| 스케줄러 | 정해진 시각마다 | 11절 |

### 순수 PHP 와 비교

```php
// 순수 PHP — 흔히 하던 세 가지
mail($to, $subject, $body);                 // ① 그냥 기다린다 (느리면 사용자도 기다림)

echo '가입 완료';
fastcgi_finish_request();                   // ② 응답을 먼저 보내고 같은 프로세스로 계속 일한다
sendWelcomeMail($user);                     //    PHP-FPM 전용 · 실패해도 재시도·기록이 없다

$pdo->prepare('INSERT INTO tasks (type, payload) VALUES (?, ?)')
    ->execute(['welcome_mail', json_encode(['user_id' => $id])]);
// ③ 할 일 테이블 + cron 이 매분 php worker.php 로 폴링 — 직접 짠 큐
```

Laravel 의 큐는 ③ 을 대신 만들어 둔 것이다. 할 일 테이블(`jobs`), 직렬화, 워커, 재시도, 실패 기록(`failed_jobs`), 여러 큐 이름, 지연 실행까지 들어 있다.

---

## 2. 큐 설정 — 연결과 큐 테이블

### 핵심 개념

할 일 목록을 어디에 둘지는 `.env` 의 `QUEUE_CONNECTION` 이 정한다. 값의 뜻은 `config/queue.php` 의 `connections` 에 있다.

| 값 | 목록이 사는 곳 | 쓰는 때 |
|---|---|---|
| `sync` | 없음 — `dispatch()` 하는 그 자리에서 바로 실행 | 테스트·디버깅. 큐를 쓰는 척만 한다 |
| `database` | DB 의 `jobs` 테이블 | 새 Laravel 골격의 기본값. 작은 서비스는 이걸로 충분 |
| `redis` | Redis | 작업이 많을 때. 빠르다 |

Laravel 11 이후 새 골격에는 `jobs`·`job_batches`·`failed_jobs` 를 만드는 마이그레이션(`database/migrations/0001_01_01_000002_create_jobs_table.php`)이 이미 들어 있다. 오래된 프로젝트라 없으면 만든다.

```bash
php artisan make:queue-table   # jobs 테이블 마이그레이션 만들기 (옛 이름 queue:table)
php artisan migrate
```

```ini
# .env
QUEUE_CONNECTION=database
```

⚠ `QUEUE_CONNECTION=sync` 인 채로 "큐로 보냈는데 왜 응답이 느리지?" 하는 일이 흔하다. `sync` 는 큐가 아니라 **즉시 실행**이다. 반대로 `database` 인데 워커를 안 띄우면 잡이 `jobs` 테이블에 쌓이기만 하고 아무 일도 일어나지 않는다.

---

## 3. 잡 만들기와 디스패치

### 핵심 개념

**잡 클래스**는 "나중에 할 일 하나"를 담은 클래스다. `ShouldQueue` 인터페이스를 붙이면 큐로 가고, 떼면 그 자리에서 실행된다. 실제 일은 `handle()` 에 적는다.

```bash
php artisan make:job SendWelcomeMail   # app/Jobs/SendWelcomeMail.php
```

### 예제 — 환영 메일 잡 (일반 Laravel 예)

```php
namespace App\Jobs;

use App\Mail\WelcomeMail;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Mail;

class SendWelcomeMail implements ShouldQueue
{
    use Queueable;   // dispatch()·delay()·onQueue()·모델 직렬화를 한 번에 주는 트레이트

    // 생성자 인자 = 잡에 실려 가는 데이터 (직렬화되어 jobs 테이블에 저장된다)
    public function __construct(public User $user) {}

    // 워커가 꺼내서 부르는 메서드 — 인자에 타입을 적으면 서비스 컨테이너가 채워 준다
    public function handle(): void
    {
        Mail::to($this->user)->send(new WelcomeMail($this->user));
    }
}
```

`handle()` 의 인자도 컨트롤러처럼 **메서드 주입**이 된다([lifecycle.md](lifecycle.md#3-서비스-컨테이너와-의존성-주입)). 생성자에는 "무엇을"(데이터)만, `handle()` 인자에는 "무엇으로"(서비스)를 둔다고 기억한다.

### 디스패치 — 목록에 적기

```php
SendWelcomeMail::dispatch($user);                        // 가장 흔한 모양 — 인자는 생성자로 간다
dispatch(new SendWelcomeMail($user));                    // 같은 일, 헬퍼 함수로

SendWelcomeMail::dispatch($user)
    ->delay(now()->addMinutes(10))                       // 10분 뒤에 실행
    ->onQueue('mail');                                   // 'mail' 이라는 이름의 줄에 세운다

SendWelcomeMail::dispatchIf($user->wants_mail, $user);   // 조건이 참일 때만
```

큐 이름(`onQueue`)은 **줄을 여러 개 세우는 것**이다. 워커를 `--queue=mail,default` 로 띄우면 `mail` 줄을 먼저 비운다. 결제 확인처럼 급한 일과 통계 계산처럼 느긋한 일을 나눌 때 쓴다.

⚠ 잡 생성자에 큰 배열·파일 내용·클로저를 넣지 않는다. 전부 직렬화되어 DB 행에 들어간다. id 나 모델만 넘기고 `handle()` 안에서 다시 읽는다(5절).

---

## 4. 재시도와 실패 처리

### 핵심 개념

`handle()` 이 예외를 던지면 잡은 실패한 것이다. 워커는 정해진 횟수만큼 다시 시도하고, 끝내 실패하면 `failed_jobs` 테이블에 **예외 메시지와 함께** 옮겨 둔다. 순수 PHP 로 짠 큐에서 가장 귀찮은 부분(재시도·실패 기록)을 대신 해 준다.

```php
class SendWelcomeMail implements ShouldQueue
{
    use Queueable;

    public $tries = 3;                 // 최대 3번 시도
    public $backoff = [10, 60, 300];   // 재시도 전 기다리는 초 — 1회차 10초, 2회차 60초, 3회차 300초
    public $timeout = 120;             // 한 번 실행이 120초를 넘으면 실패로 본다

    public function __construct(public User $user) {}

    public function handle(): void { /* ... */ }

    // 모든 시도가 실패했을 때 한 번 불린다 — 관리자에게 알리기 등
    public function failed(?\Throwable $e): void
    {
        logger()->error('환영 메일 최종 실패', ['user' => $this->user->id, 'error' => $e?->getMessage()]);
    }
}
```

실패한 잡 다루기:

```bash
php artisan queue:failed            # 실패 목록 (UUID·잡 이름·예외)
php artisan queue:retry all         # 전부 다시 큐에 넣기
php artisan queue:retry 5b1c…       # 하나만 (UUID)
php artisan queue:forget 5b1c…      # 하나 지우기
php artisan queue:flush             # 실패 목록 비우기
```

⚠ **재시도는 같은 일을 두 번 할 수 있다는 뜻이다.** 메일을 보낸 뒤 로그를 쓰다 예외가 나면, 재시도 때 메일이 또 간다. `handle()` 은 여러 번 불려도 결과가 같게(멱등) 짜거나, 부작용이 있는 일을 맨 마지막에 둔다.

---

## 5. SerializesModels — 모델은 id 로 간다

### 핵심 개념

잡 생성자에 `User $user` 를 넘기면 모델 전체가 DB 에 저장될 것 같지만 그렇지 않다. `Queueable` 안에 든 **SerializesModels** 트레이트가 모델을 **"클래스 이름 + id"** 로만 적어 두고, 워커가 꺼낼 때 **DB 에서 다시 조회**한다.

```
dispatch 순간                          워커가 꺼내는 순간 (몇 초~몇 분 뒤)
User {id: 7, name: '김', ...}  ──▶  "App\Models\User#7"  ──▶  User::findOrFail(7)  ← 지금 DB 값
```

이 설계 덕분에 payload 가 작고, 워커는 **최신 값**으로 일한다. 대신 알아야 할 결과가 셋 있다.

1. dispatch 뒤, 워커 실행 전에 **값이 바뀌면 바뀐 값**으로 일한다. "dispatch 순간의 값"이 필요하면 그 값을 따로 인자로 넘긴다(`new SendReceipt($order, $order->total)`).
2. 그 사이 **행이 지워지면** 다시 조회가 실패해 `ModelNotFoundException` 으로 잡이 실패한다. 무시해도 되는 잡이면 클래스에 `public $deleteWhenMissingModels = true;` 를 둔다.
3. 저장하지 않은 모델(아직 id 가 없는 `new User`)은 넘길 수 없다.

### 순수 PHP 와 비교

```php
// 순수 PHP 로 짠 큐에서도 결국 이렇게 한다
$payload = json_encode(['user_id' => $user['id']]);   // 행 전체가 아니라 id 만
// worker.php
$user = $pdo->query('SELECT * FROM users WHERE id = ' . (int) $data['user_id'])->fetch();
```

---

## 6. 워커 — queue:work 와 재시작

### 핵심 개념

워커는 `jobs` 테이블을 계속 들여다보며 잡을 꺼내 실행하는 **끝나지 않는 PHP 프로세스**다.

```bash
php artisan queue:work                         # 기본 연결·default 큐
php artisan queue:work --queue=mail,default    # mail 줄을 먼저
php artisan queue:work --tries=3 --timeout=90  # 클래스에 값이 없을 때의 기본값
php artisan queue:work --stop-when-empty       # 목록이 비면 끝 (배치 처리·CI 용)
php artisan queue:listen                       # 잡마다 코드를 새로 읽는다 — 개발용, 느림
```

새 골격의 `composer run dev` 는 웹 서버·Vite 와 함께 `queue:listen` 을 한 번에 띄운다. 로컬에서 따로 워커를 켜지 않아도 되는 이유다.

### ⚠ 코드를 고쳤으면 워커를 재시작한다

`queue:work` 는 앱을 **한 번 부팅해 메모리에 들고** 잡을 계속 처리한다. 잡 클래스를 고쳐 배포해도 떠 있는 워커는 **옛 코드**로 계속 일한다. PES 도 `queue` 컨테이너가 이 상태라 재시작이 필요하다([pitfalls.md](pitfalls.md#10-코드를-고쳤는데-반영이-안-됨--캐시)).

```bash
php artisan queue:restart   # 떠 있는 워커들에게 "지금 잡만 끝내고 종료하라" 신호 (캐시에 표시를 남긴다)
```

`queue:restart` 는 워커를 **끝낼 뿐 다시 띄우지 않는다.** 운영에서는 Supervisor·systemd·Docker 의 `restart: always` 같은 **프로세스 관리자**가 꺼진 워커를 다시 띄운다. 그래서 배포 순서가 "코드 교체 → `queue:restart` → 관리자가 새 코드로 재기동"이 된다.

| 환경 | 워커 띄우기 |
|---|---|
| 로컬 | `composer run dev` 또는 터미널 하나에 `queue:work` |
| 운영 (서버) | Supervisor 설정으로 `queue:work` 를 여러 개 상주 |
| 운영 (Docker, PES 방식) | 워커 전용 컨테이너 — 명령이 `php artisan queue:work` |

---

## 7. 트랜잭션 안에서 디스패치 — afterCommit

### 핵심 개념

트랜잭션 안에서 잡을 디스패치하면, 워커가 **커밋보다 먼저** 잡을 꺼낼 수 있다. 그러면 워커는 아직 보이지 않는 행을 찾다 실패한다. 트랜잭션이 롤백되면 "없던 일"인데 메일은 이미 간다.

```php
DB::transaction(function () use ($data) {
    $order = Order::create($data);
    SendReceipt::dispatch($order);      // ⚠ 커밋 전에 워커가 꺼내면 Order 를 못 찾는다
    $order->items()->createMany($data['items']);
});
```

**afterCommit** 은 "트랜잭션이 커밋된 뒤에만 큐에 넣어라"는 표시다.

```php
SendReceipt::dispatch($order)->afterCommit();   // 이 한 건만

// 또는 잡 클래스 자체를 늘 커밋 뒤로
use Illuminate\Contracts\Queue\ShouldQueueAfterCommit;
class SendReceipt implements ShouldQueueAfterCommit { use Queueable; /* ... */ }
```

`config/queue.php` 의 연결마다 `'after_commit' => true` 를 켜면 전체에 적용된다. 트랜잭션 자체는 [transactions.md](transactions.md) 에서 다룬다.

---

## 8. 이벤트와 리스너

### 핵심 개념

**이벤트 클래스**는 "무슨 일이 일어났다"는 사실을 담은 작은 클래스이고, **리스너**는 그 사실에 반응하는 클래스다. 컨트롤러는 "주문이 들어왔다"만 알리고, 메일·재고·통계는 각자의 리스너가 맡는다. 새 반응을 더할 때 컨트롤러를 고치지 않는다.

```bash
php artisan make:event OrderPlaced                          # app/Events/OrderPlaced.php
php artisan make:listener SendOrderMail --event=OrderPlaced # app/Listeners/SendOrderMail.php
php artisan event:list                                      # 어떤 이벤트에 누가 붙어 있나
```

### 예제 — 주문 이벤트 (일반 Laravel 예)

```php
// app/Events/OrderPlaced.php — 데이터만 싣는다
class OrderPlaced
{
    use Dispatchable, SerializesModels;
    public function __construct(public Order $order) {}
}

// app/Listeners/SendOrderMail.php — handle() 인자의 타입이 곧 "어느 이벤트를 듣나"
class SendOrderMail implements ShouldQueue       // ShouldQueue 를 붙이면 리스너가 큐로 간다
{
    public function handle(OrderPlaced $event): void
    {
        Mail::to($event->order->user)->send(new OrderMail($event->order));
    }
}

// 컨트롤러 — 알리기만 한다
OrderPlaced::dispatch($order);          // 또는 event(new OrderPlaced($order))
```

Laravel 11~13 은 `app/Listeners` 의 클래스를 **자동으로 찾는다**(event discovery). `handle(OrderPlaced $event)` 처럼 타입을 적으면 그 이벤트에 연결된다. 옛 튜토리얼의 `EventServiceProvider` 의 `$listen` 배열에 적는 일은 필요 없다. 다른 폴더의 리스너나 클로저는 `AppServiceProvider::boot()` 에서 `Event::listen(...)` 으로 직접 잇는다.

### 모델 이벤트와 무엇이 다른가

| | 모델 이벤트 ([eloquent.md](eloquent.md#10-모델-이벤트)) | 이 절의 이벤트 |
|---|---|---|
| 누가 일으키나 | Eloquent 가 자동으로 (`saving`·`created` …) | 내 코드가 `dispatch()` 로 |
| 뜻 | "DB 행이 바뀌려 한다/바뀌었다" | "업무상 무슨 일이 일어났다" |
| 건너뛰는 경우 | 쿼리 빌더 `update()` 는 건너뜀 ([pitfalls.md](pitfalls.md#11-완성도-점수가-안-바뀜--모델-이벤트-건너뜀)) | 부르지 않으면 안 일어난다 |
| 알맞은 일 | 칸 값 자동 계산(PES 완성도 점수) | 메일·알림·다른 시스템에 알리기 |

⚠ 이벤트를 너무 잘게 쪼개면 "이 버튼을 누르면 무슨 일이 일어나지?"를 코드에서 따라가기 어려워진다. 반응이 하나뿐이면 잡을 바로 디스패치하는 편이 읽기 쉽다.

---

## 9. 메일 — Mailable

### 핵심 개념

**Mailable** 은 메일 한 통(제목·본문 뷰·첨부)을 클래스 하나로 만든 것이다. 본문은 Blade 뷰라서 화면 만들 때와 같은 문법을 쓴다([blade.md](blade.md#1-blade-란)).

```bash
php artisan make:mail WelcomeMail   # app/Mail/WelcomeMail.php
```

### 예제 — 환영 메일 (일반 Laravel 예)

```php
namespace App\Mail;

use App\Models\User;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class WelcomeMail extends Mailable
{
    // public 속성은 뷰에서 그대로 $user 로 쓸 수 있다
    public function __construct(public User $user) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: '가입을 환영합니다');   // 제목·보내는 사람
    }

    public function content(): Content
    {
        return new Content(view: 'mail.welcome');           // resources/views/mail/welcome.blade.php
    }
}
```

```php
Mail::to($user)->send(new WelcomeMail($user));    // 지금 보낸다 (기다린다)
Mail::to($user)->queue(new WelcomeMail($user));   // 큐로 보낸다 (워커가 보낸다)
```

Mailable 클래스에 `implements ShouldQueue` 를 붙이면 `send()` 로 불러도 큐로 간다.

### 개발 중에 메일 확인하기

```ini
# .env — 실제로 보내지 않고 storage/logs/laravel.log 에 메일 전문을 적는다
MAIL_MAILER=log
```

```php
// routes/web.php (로컬에서만) — 메일을 브라우저에서 미리 본다: Mailable 을 그대로 돌려주면 HTML 로 그린다
Route::get('/mail-preview', fn () => new App\Mail\WelcomeMail(App\Models\User::first()));
```

### 순수 PHP 와 비교

```php
// 순수 PHP — 헤더·인코딩·HTML 을 직접 조립
$headers = "MIME-Version: 1.0\r\nContent-type: text/html; charset=UTF-8\r\n";
mail($user['email'], '=?UTF-8?B?' . base64_encode('가입을 환영합니다') . '?=', $html, $headers);
```

---

## 10. 알림 — Notification

### 핵심 개념

**알림**은 "같은 소식을 여러 통로로" 보내는 도구다. "예약이 잡혔다"를 메일로도, 사이트 안 종 모양 목록(DB)으로도 보낸다. 어느 통로로 보낼지는 `via()` 가 사람마다 정한다.

```bash
php artisan make:notification SlotBooked     # app/Notifications/SlotBooked.php
php artisan make:notifications-table         # database 채널용 notifications 테이블
php artisan migrate
```

### 예제 — 예약 알림 (일반 Laravel 예)

```php
class SlotBooked extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Booking $booking) {}

    // 받는 사람($notifiable)마다 통로를 고른다
    public function via(object $notifiable): array
    {
        return $notifiable->wants_mail ? ['mail', 'database'] : ['database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('새 예약이 들어왔습니다')
            ->line($this->booking->starts_at->format('m월 d일 H:i') . ' 수업')
            ->action('예약 보기', url('/tutor/bookings'));
    }

    // database 채널 — notifications 테이블의 data 칸(JSON)에 들어간다
    public function toArray(object $notifiable): array
    {
        return ['booking_id' => $this->booking->id];
    }
}
```

```php
$tutor->notify(new SlotBooked($booking));           // 한 사람에게
Notification::send($admins, new SlotBooked($booking)); // 여러 사람에게

$tutor->unreadNotifications;                         // 안 읽은 알림 (Collection)
$tutor->unreadNotifications->markAsRead();
```

`notify()` 는 `User` 모델의 `Notifiable` 트레이트가 준다. 새 골격의 `User` 에는 이미 `use Notifiable;` 가 들어 있다.

| 무엇을 보낼 때 | 고를 도구 |
|---|---|
| 정해진 한 통의 메일 (영수증·비밀번호 재설정 메일 본문) | Mailable |
| 사람마다 통로가 다를 수 있는 "소식" | Notification (메일 통로도 결국 메일이다) |

---

## 11. 스케줄러 — 서버 cron 한 줄

### 핵심 개념

순수 PHP 에서는 정기 작업마다 crontab 에 한 줄씩 적었다. Laravel 은 crontab 에 **딱 한 줄**만 두고, "무엇을 언제"는 코드(`routes/console.php`)에 적는다. 그래서 정기 작업 목록이 git 에 남고 리뷰된다.

```bash
# 서버 crontab — 이 한 줄뿐. 매분 Laravel 에게 "지금 돌 차례인 게 있나?"를 묻는다
* * * * * cd /var/www/app && php artisan schedule:run >> /dev/null 2>&1
```

### 예제 — routes/console.php (일반 Laravel 예)

```php
use Illuminate\Support\Facades\Schedule;

Schedule::command('ranking:rebuild')        // Artisan 명령
    ->dailyAt('03:00')
    ->timezone('Asia/Seoul')
    ->withoutOverlapping();                 // 앞 실행이 안 끝났으면 이번은 건너뛴다

Schedule::job(new PruneExpiredSlots)->hourly();       // 잡을 큐에 넣는다
Schedule::call(fn () => cache()->forget('home.stats'))->everyTenMinutes();  // 클로저
Schedule::command('queue:prune-failed --hours=168')->daily();              // 실패 잡 7일 지나면 정리
```

```bash
php artisan schedule:list   # 등록된 작업과 다음 실행 시각
php artisan schedule:work   # 로컬에서 cron 대신 — 매분 schedule:run 을 부르며 떠 있다
php artisan schedule:run    # 지금 한 번 (cron 이 부르는 그 명령)
```

⚠ 옛 튜토리얼은 `app/Console/Kernel.php` 의 `schedule()` 메서드에 적는다. Laravel 11~13 에는 그 파일이 없다([SKILL.md 차이표](../SKILL.md#옛-튜토리얼과-이-프로젝트의-차이)).

⚠ 서버가 여러 대면 모든 서버의 cron 이 같은 작업을 돈다. 한 대에서만 돌게 하려면 `->onOneServer()`(캐시 드라이버가 redis·database 등 공유 저장소여야 한다).

---

## 12. 테스트 — 가짜로 바꿔 끼우기

### 핵심 개념

테스트에서 진짜 메일을 보내거나 워커를 기다릴 수는 없다. Facade 는 컨테이너 객체의 대리자라서([lifecycle.md](lifecycle.md#5-facade--정적-호출처럼-보이는-객체-호출)) 테스트에서 **가짜로 바꿔 끼울 수 있다.** `Queue::fake()` 를 부르면 그 뒤의 디스패치는 실행되지 않고 **기록만** 된다. 기록을 `assert…` 로 검사한다.

### 예제 — Pest (일반 Laravel 예)

```php
use App\Jobs\SendWelcomeMail;
use App\Mail\WelcomeMail;
use App\Notifications\SlotBooked;
use Illuminate\Support\Facades\{Queue, Mail, Notification, Event};

it('가입하면 환영 메일 잡을 큐에 넣는다', function () {
    Queue::fake();

    $this->post('/register', ['email' => 'a@b.com', 'password' => 'secret-pass-1234']);

    Queue::assertPushed(SendWelcomeMail::class, fn ($job) => $job->user->email === 'a@b.com');
});

it('예약하면 강사에게 알림이 간다', function () {
    Notification::fake();
    // ... 예약 요청 ...
    Notification::assertSentTo($tutor, SlotBooked::class);
});

it('메일 내용 확인', function () {
    Mail::fake();
    // ...
    Mail::assertSent(WelcomeMail::class, fn ($mail) => $mail->hasTo('a@b.com'));
    // Mail::to()->queue() 로 보냈으면 assertQueued
});

it('이벤트만 확인하고 리스너는 돌리지 않는다', function () {
    Event::fake([OrderPlaced::class]);
    // ...
    Event::assertDispatched(OrderPlaced::class);
});
```

테스트 설정(`phpunit.xml`)은 보통 `QUEUE_CONNECTION=sync`·`MAIL_MAILER=array` 라서 fake 가 없어도 잡이 즉시 실행되고 메일은 메모리에만 쌓인다. "잡이 **큐에 들어갔는가**"를 보려면 fake, "잡이 **한 일의 결과**"를 보려면 sync 로 두고 DB 를 검사한다. 테스트 기본은 [testing.md](testing.md#1-pes-테스트의-모양) 에 있다.

---

## 13. 암기 카드

| 질문 | 답 |
|---|---|
| 잡을 큐로 보내게 만드는 인터페이스는? | `ShouldQueue` |
| `QUEUE_CONNECTION=sync` 의 뜻은? | 큐 없이 `dispatch()` 자리에서 바로 실행 |
| 잡을 적어 두는 기본 테이블은? 실패한 잡은? | `jobs` / `failed_jobs` |
| 잡을 큐에 넣는 두 가지 모양은? | `SendWelcomeMail::dispatch($user)` · `dispatch(new SendWelcomeMail($user))` |
| 10분 뒤에 실행하려면? | `->delay(now()->addMinutes(10))` |
| 재시도 횟수와 간격을 정하는 속성은? | `$tries` · `$backoff` |
| 모든 시도가 실패하면 불리는 메서드는? | `failed(?Throwable $e)` |
| 잡에 넘긴 모델은 큐에 어떻게 저장되나? | 클래스 + id 만. 워커가 꺼낼 때 DB 에서 다시 조회 (SerializesModels) |
| 워커를 띄우는 명령은? | `php artisan queue:work` |
| 잡 코드를 고쳤는데 옛날처럼 동작한다. 왜, 어떻게? | 워커가 옛 코드를 메모리에 들고 있다 → `queue:restart` (재기동은 프로세스 관리자가) |
| 트랜잭션 커밋 뒤에만 큐에 넣으려면? | `->afterCommit()` 또는 `ShouldQueueAfterCommit` |
| 리스너가 어느 이벤트를 듣는지 정하는 곳은? | `handle(OrderPlaced $event)` 의 타입 (자동 발견) |
| Mailable 의 제목·본문을 정하는 메서드는? | `envelope()` · `content()` |
| 개발 중 메일을 실제로 안 보내고 확인하려면? | `MAIL_MAILER=log` → `storage/logs/laravel.log` |
| 알림의 통로를 고르는 메서드는? | `via()` — `['mail', 'database']` |
| `$user->notify()` 는 어디서 오나? | `Notifiable` 트레이트 |
| 서버 crontab 에 적는 한 줄은? | `* * * * * php artisan schedule:run` |
| 테스트에서 잡이 큐에 들어갔는지 보려면? | `Queue::fake()` → `Queue::assertPushed(...)` |
