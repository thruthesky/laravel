# 심화 — 배포 — 로컬에서 운영 서버로

내 컴퓨터에서 잘 돌던 Laravel 앱을 운영 서버에 올릴 때 **무엇을 어떤 순서로 하는지**, 그리고 왜 그 순서인지 다룬다. FTP 로 PHP 파일을 덮어쓰던 방식과 가장 크게 다른 점은 "파일 복사 뒤에도 할 일이 있다"는 것이다 — 의존성 설치, 마이그레이션, 캐시 굳히기, 워커 재시작. 예제는 일반 서버 기준이고, Docker 로 도는 PES 는 11절에서 따로 본다.

## 목차

1. [로컬과 운영은 .env 가 다르다](#1-로컬과-운영은-env-가-다르다)
2. [APP_KEY 는 한 번 만들고 바꾸지 않는다](#2-app_key-는-한-번-만들고-바꾸지-않는다)
3. [웹 서버 문서 루트는 public/](#3-웹-서버-문서-루트는-public)
4. [배포 순서 체크리스트](#4-배포-순서-체크리스트)
5. [composer install --no-dev](#5-composer-install---no-dev)
6. [migrate --force 와 되돌리기 어려운 변경](#6-migrate---force-와-되돌리기-어려운-변경)
7. [캐시 굳히기 — optimize](#7-캐시-굳히기--optimize)
8. [프런트 자산 — Vite 와 npm run build](#8-프런트-자산--vite-와-npm-run-build)
9. [쓰기 권한과 storage](#9-쓰기-권한과-storage)
10. [큐 워커·스케줄러·유지보수 모드](#10-큐-워커스케줄러유지보수-모드)
11. [헬스 체크·로그·롤백 — 그리고 Docker 로 도는 PES](#11-헬스-체크로그롤백--그리고-docker-로-도는-pes)
12. [암기 카드](#12-암기-카드)

---

## 1. 로컬과 운영은 .env 가 다르다

### 핵심 개념

같은 코드를 로컬과 운영에서 다르게 동작시키는 것은 **`.env` 파일 하나**다([lifecycle.md](lifecycle.md#6-env--config--config)). `.env` 는 git 에 올리지 않고 서버마다 따로 둔다. 코드는 같고 `.env` 만 다르다.

| 키 | 로컬 | 운영 | 틀리면 |
|---|---|---|---|
| `APP_ENV` | `local` | `production` | `production` 이 아니면 위험한 명령이 확인 없이 돈다 |
| `APP_DEBUG` | `true` | **`false`** | 오류 화면에 **코드·경로·환경 변수**가 그대로 보인다 ⚠ |
| `APP_URL` | `http://localhost:8000` | `https://example.com` | 메일·큐에서 만든 링크가 localhost 로 나간다 |
| `APP_KEY` | 로컬용 | 운영용(따로 만든다) | 2절 |
| `DB_*` | 로컬 DB | 운영 DB | — |
| `LOG_LEVEL` | `debug` | `warning` 또는 `error` | 로그 파일이 금방 커진다 |
| `CACHE_STORE`·`SESSION_DRIVER`·`QUEUE_CONNECTION` | `database`·`file` 등 | 서버 여러 대면 `redis` 같은 공유 저장소 | 서버마다 세션·캐시가 달라진다 |

### 순수 PHP 와 비교

```php
// 순수 PHP — 서버마다 config.php 를 손으로 고치거나
define('DEBUG', $_SERVER['HTTP_HOST'] === 'localhost');
ini_set('display_errors', DEBUG ? '1' : '0');

// Laravel — 코드는 그대로, 서버의 .env 만
APP_DEBUG=false
```

### ⚠ APP_DEBUG=true 로 운영하면

Laravel 의 오류 화면은 개발에 아주 편하다 — 대신 **예외 메시지, 파일 경로, 쿼리, 요청 정보**를 보여 준다. 운영에서 켜 두면 공격자에게 설계도를 주는 셈이다. API 의 500 JSON 에도 스택이 실린다([api.md](api.md#6-검증-실패404-도-json-으로--accept-헤더)). 배포 체크리스트 맨 위에 둔다.

---

## 2. APP_KEY 는 한 번 만들고 바꾸지 않는다

### 핵심 개념

`APP_KEY` 는 **암호화 열쇠**다. 쿠키 암호화, `Crypt::encrypt()`, `encrypted` cast 로 저장한 칸이 모두 이 열쇠를 쓴다. 새 서버를 처음 만들 때 한 번 만든다.

```bash
php artisan key:generate     # .env 의 APP_KEY 를 새로 채운다 — 처음 한 번만
```

### ⚠ 운영 중에 바꾸면

- 이미 암호화한 쿠키를 못 읽는다 → **모든 사용자가 로그아웃**된다.
- `encrypted` cast 로 DB 에 저장한 값을 **복호화할 수 없다** → 데이터를 잃는다.

그래서 배포 스크립트에 `key:generate` 를 넣지 않는다. 열쇠를 꼭 바꿔야 하면(유출 등) 새 열쇠를 `APP_KEY` 에, 옛 열쇠를 `APP_PREVIOUS_KEYS` 에 두어 옛 값도 읽히게 한다(Laravel 11+, 공식 문서 Encryption → Gracefully Rotating Encryption Keys 로 확인).

비밀번호 해시(`hashed` cast, `Hash::make`)는 APP_KEY 와 **상관없다** — 열쇠를 바꿔도 로그인 비밀번호는 그대로 맞는다([security.md](security.md#7-비밀번호--hash)).

---

## 3. 웹 서버 문서 루트는 public/

### 핵심 개념

Laravel 은 **모든 요청을 `public/index.php` 하나로** 받는다([lifecycle.md](lifecycle.md#1-요청-한-바퀴)). 웹 서버(Nginx·Apache·FrankenPHP)의 문서 루트를 **프로젝트 루트가 아니라 `public/`** 으로 잡아야 한다.

```
/var/www/myapp/            ← ❌ 여기를 문서 루트로 잡으면
├── .env                   ←    https://example.com/.env 로 비밀번호가 열린다
├── app/  config/  vendor/
└── public/                ← ✅ 문서 루트는 여기
    ├── index.php
    └── build/  storage → ../storage/app/public
```

### 예제 — Nginx 핵심 두 줄 (일반 예)

```nginx
root /var/www/myapp/public;                          # 문서 루트 = public
location / { try_files $uri $uri/ /index.php?$query_string; }   # 없는 파일은 전부 index.php 로
```

`try_files` 가 순수 PHP 의 "front controller + .htaccess 재작성"과 같은 일을 한다. PES 는 웹 서버로 FrankenPHP 를 쓴다([lifecycle.md](lifecycle.md#1-요청-한-바퀴)).

---

## 4. 배포 순서 체크리스트

### 핵심 개념

코드를 올린 뒤 할 일은 매번 같다. 스크립트로 만들어 두고 손으로 하지 않는다.

```bash
# 프로젝트 루트에서 (일반 서버 예)
php artisan down --retry=60                       # (선택) 유지보수 모드 — 10절

git pull origin main                              # ① 새 코드
composer install --no-dev --optimize-autoloader   # ② PHP 의존성 — 5절
npm ci && npm run build                           # ③ CSS·JS 빌드 — 8절 (Vite 를 쓸 때)
php artisan migrate --force                       # ④ DB 구조 — 6절
php artisan optimize                              # ⑤ 설정·라우트·뷰·이벤트 캐시 — 7절
php artisan storage:link                          # ⑥ 처음 한 번 — 9절 (이미 있으면 건너뜀)
php artisan queue:restart                         # ⑦ 큐 워커에게 새 코드로 다시 뜨라고 — 10절

php artisan up                                    # 유지보수 모드 해제
```

| 순서 | 왜 이 자리인가 |
|---|---|
| ② 가 ④ 보다 먼저 | 마이그레이션 파일이 새 패키지 클래스를 쓸 수 있다 |
| ④ 가 ⑤ 보다 먼저 | 캐시를 굳힌 뒤 실패하면 옛 상태로 돌리기가 더 번거롭다. 어느 쪽이든 **⑤ 는 매 배포마다** 다시 한다 |
| ⑤ 는 `.env` 가 준비된 뒤 | `config:cache` 는 그 순간의 `.env` 값을 파일로 굳힌다 |
| ⑦ 이 마지막 | 워커는 옛 코드를 메모리에 들고 있다. 새 코드·새 DB 가 준비된 뒤 다시 띄운다 |

### 순수 PHP 와 비교

순수 PHP 는 "FTP 로 파일 덮어쓰기 = 배포 끝"이었다. Laravel 은 `vendor/`(git 에 없음), 컴파일된 뷰·설정 캐시, 백그라운드 워커가 있어서 **파일 복사만으로는 반쯤 옛 앱**이 된다.

### 배포 도구 이름만

이 순서를 대신 돌려 주는 서비스가 있다 — **Laravel Forge**(내 서버를 관리해 줌), **Laravel Cloud**(Laravel 공식 호스팅). 둘 다 속에서 위 명령을 실행한다. 순서를 알고 쓰면 문제가 생겨도 어디서 멈췄는지 안다.

---

## 5. composer install --no-dev

### 핵심 개념

`vendor/` 는 git 에 올리지 않는다. 서버에서 `composer.lock` 에 적힌 **정확한 버전**으로 다시 받는다.

```bash
composer install --no-dev --optimize-autoloader
```

| 옵션 | 뜻 |
|---|---|
| `install` (≠ `update`) | `composer.lock` 의 버전 그대로. 운영에서 `composer update` 는 하지 않는다 ⚠ — 로컬에서 시험 안 한 버전이 깔린다 |
| `--no-dev` | `require-dev`(Pest·Faker 등 개발 도구)를 빼고 받는다 |
| `--optimize-autoloader` | 클래스 위치 지도를 미리 만들어 자동 로드를 빠르게 |

### ⚠ --no-dev 로 받았는데 운영에서 Faker 오류

팩토리·시더가 쓰는 `fake()` 는 개발 의존성(Faker)이다([database.md](database.md#8-팩토리--테스트용-가짜-데이터)). 운영에서 `db:seed` 로 팩토리를 돌리면 클래스가 없다는 오류가 난다. 운영 초기 데이터는 팩토리 없이 쓰는 시더나 마이그레이션으로 넣는다.

---

## 6. migrate --force 와 되돌리기 어려운 변경

### 핵심 개념

`APP_ENV=production` 에서 `php artisan migrate` 를 실행하면 **"정말 실행할까요?"** 라고 묻는다. 배포 스크립트는 대답할 사람이 없으므로 `--force` 로 확인을 건너뛴다.

```bash
php artisan migrate --force        # 운영 — 확인 없이 앞으로만
php artisan migrate:status         # 어디까지 적용됐나
```

### ⚠ 운영 DB 에서 하지 않는 것

- `migrate:fresh`·`migrate:refresh` — 테이블을 지우고 다시 만든다. **데이터가 전부 사라진다**([database.md](database.md#7-마이그레이션-명령과-주의)).
- `migrate:rollback` 을 습관처럼 — `down()` 이 칸을 지우는 코드면 그 칸의 데이터도 사라진다.
- 이미 운영에 적용된 마이그레이션 파일을 **고쳐 쓰기** — 운영은 그 파일을 "이미 했음"으로 보고 다시 실행하지 않는다. 고칠 것이 있으면 새 마이그레이션을 만든다.

칸 삭제·이름 변경·데이터 이전처럼 되돌리기 어려운 마이그레이션은 **배포 전에 DB 백업**을 한다. PES 가 무료 체험 칸을 옮길 때처럼 "새 칸 추가 → 데이터 복사 → 옛 칸 삭제"를 한 파일에서 순서대로 한 실제 예가 [database.md](database.md#6-실제-이력-읽기--무료-체험을-옮긴-마이그레이션) 에 있다.

---

## 7. 캐시 굳히기 — optimize

### 핵심 개념

운영에서는 요청마다 설정 파일 수십 개를 읽고, 라우트 파일을 해석하는 일을 줄이려고 **결과를 미리 파일로 굳혀 둔다**([artisan.md](artisan.md#5-캐시-명령)).

```bash
php artisan optimize          # config:cache + route:cache + view:cache + event:cache 를 한 번에
php artisan optimize:clear    # 전부 비우기
```

| 굳힌 것 | 저장 위치 | 굳힌 뒤 달라지는 점 |
|---|---|---|
| 설정 | `bootstrap/cache/config.php` | `.env` 를 다시 읽지 않는다 |
| 라우트 | `bootstrap/cache/routes-v7.php` | 라우트 파일을 고쳐도 반영 안 됨 |
| 뷰 | `storage/framework/views` | Blade 를 미리 PHP 로 컴파일 |
| 이벤트 | `bootstrap/cache/events.php` | 리스너 자동 찾기를 미리 |

### ⚠ 캐시 뒤 env() 가 null

`config:cache` 뒤에는 `.env` 를 읽지 않으므로, 컨트롤러·모델에서 부른 `env('PAYPAL_KEY')` 가 `null` 이 될 수 있다. `env()` 는 `config/*.php` 안에서만 쓰고 코드에서는 `config()` 로 읽는다 — [pitfalls.md](pitfalls.md#1-env-가-null) 1번 함정이 운영에서만 터지는 이유다.

### ⚠ 서버에서 .env 를 고쳤는데 반영이 안 됨

`.env` 를 고친 뒤에는 `php artisan optimize`(또는 `config:cache`)를 **다시** 실행해야 한다. 굳힌 파일이 옛 값을 들고 있다([pitfalls.md](pitfalls.md#10-코드를-고쳤는데-반영이-안-됨--캐시)).

---

## 8. 프런트 자산 — Vite 와 npm run build

### 핵심 개념

새 Laravel 골격은 CSS·JS 를 **Vite**(Node 도구)로 묶는다. Blade 에서는 `@vite` 지시어로 불러온다.

```blade
{{-- resources/views/layouts/app.blade.php (일반 Laravel 예) --}}
<head>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
```

| 환경 | 하는 일 | `@vite` 가 만드는 태그 |
|---|---|---|
| 로컬 | `npm run dev` 가 개발 서버를 띄운다 | 개발 서버 주소의 `<script>` — 고치면 바로 반영 |
| 운영 | `npm run build` 가 `public/build/` 에 파일과 `manifest.json` 을 만든다 | `manifest.json` 을 보고 해시 붙은 파일 이름으로 |

### ⚠ Vite manifest not found at: public/build/manifest.json

운영에서 이 오류가 나면 **빌드를 안 한 것**이다. `public/build/` 는 보통 git 에 올리지 않으므로, 서버에서 `npm ci && npm run build` 를 하거나 CI 에서 빌드한 결과를 함께 올린다.

### PES 와 다른 점

PES 는 골격의 Node 파일(`package.json`·`vite.config.js`)을 넣지 않았다([install.md](install.md#5-설치-후-생기는-폴더-구조)). 그래서 PES 배포에는 ③ `npm run build` 단계가 없다. 연습 프로젝트는 골격 그대로이므로 이 단계가 있다.

---

## 9. 쓰기 권한과 storage

### 핵심 개념

Laravel 이 **실행 중에 파일을 쓰는 곳**은 두 군데뿐이다. 웹 서버(PHP) 사용자가 여기에 쓸 수 있어야 한다.

| 폴더 | 무엇을 쓰나 |
|---|---|
| `storage/` | 로그(`storage/logs/laravel.log`), 컴파일된 뷰, 파일 세션·캐시, 업로드 파일(`storage/app`) |
| `bootstrap/cache/` | 7절의 설정·라우트·이벤트 캐시 |

```bash
# 일반 예 — 웹 서버 사용자가 www-data 일 때
sudo chown -R $USER:www-data storage bootstrap/cache
sudo chmod -R ug+rwx storage bootstrap/cache
```

**증상**: 첫 요청부터 500, 로그 파일도 안 생김 → 대개 `storage/` 쓰기 권한. `chmod -R 777` 로 덮지 않는다 — 누구나 쓸 수 있는 폴더가 된다.

### storage:link

업로드한 파일을 URL 로 보여 주려면 `public/storage` → `storage/app/public` 심볼릭 링크가 필요하다. 서버마다 **한 번** `php artisan storage:link`. 링크가 없으면 업로드는 되는데 이미지 주소가 404 다([files-cache.md](files-cache.md#5-storagelink--공개-url-만들기)).

---

## 10. 큐 워커·스케줄러·유지보수 모드

### 큐 워커 재시작

큐 워커(`php artisan queue:work`)는 **한 번 뜨면 계속 돌면서 코드를 메모리에 들고 있다**. 새 코드를 올려도 워커는 옛 코드로 작업한다([pitfalls.md](pitfalls.md#10-코드를-고쳤는데-반영이-안-됨--캐시) 마지막 줄 — PES 는 `queue` 컨테이너).

```bash
php artisan queue:restart     # 워커들에게 "지금 하던 작업 끝나면 종료" 신호 → Supervisor 등이 새로 띄운다
```

워커가 죽으면 다시 띄워 주는 프로세스 관리자(Supervisor, systemd, Docker 의 `restart:` 정책)가 함께 있어야 한다. 큐 자체는 [queues.md](queues.md#6-워커--queuework-와-재시작) 에서 다룬다.

### 스케줄러 — cron 한 줄

`routes/console.php` 의 `Schedule::` 정기 작업([SKILL.md 차이표](../SKILL.md#옛-튜토리얼과-이-프로젝트의-차이))은 **누군가 매분 깨워 줘야** 돈다. 서버 crontab 에 한 줄만 넣는다.

```bash
# crontab -e (일반 서버 예)
* * * * * cd /var/www/myapp && php artisan schedule:run >> /dev/null 2>&1
```

작업마다 cron 줄을 추가하지 않는다 — 언제 무엇을 돌릴지는 코드(`Schedule::`)가 정하고, cron 은 매분 "지금 할 것 있나?"만 묻는다. `php artisan schedule:list` 로 확인([artisan.md](artisan.md#3-스스로-조사하는-명령)).

### 유지보수 모드 — down / up

```bash
php artisan down --retry=60 --secret="deploy-7f3a9c"   # 모든 요청에 503 "점검 중"
# 브라우저로 https://example.com/deploy-7f3a9c 를 한 번 열면 나만 통과 쿠키를 받아 앱을 볼 수 있다
php artisan up                                        # 해제
```

- 점검 중에는 **큐 작업도 처리되지 않는다**.
- 마이그레이션이 짧고 뒤로 호환되면(칸 추가만) 유지보수 모드 없이 배포하는 경우가 많다. 칸 삭제·이름 변경처럼 옛 코드와 새 DB 가 부딪히는 배포에서 쓴다.
- `--secret` 값은 추측하기 어려운 문자열로.

---

## 11. 헬스 체크·로그·롤백 — 그리고 Docker 로 도는 PES

### 헬스 체크 /up

Laravel 11+ 골격은 `/up` 주소를 기본으로 둔다. 앱이 예외 없이 부팅되면 200, 아니면 500 을 돌려준다. 로드 밸런서·모니터링·배포 스크립트가 "새 버전이 살아 있나"를 이 주소로 확인한다.

```php
// PES 코드 — bootstrap/app.php (발췌)
->withRouting(
    web: __DIR__.'/../routes/web.php',
    commands: __DIR__.'/../routes/console.php',
    health: '/up',                              // 헬스 체크 URL
    …
)
```

```bash
curl -fsS https://example.com/up && echo 살아있음
```

### 배포 뒤 확인

```bash
php artisan about                         # 환경·디버그·캐시 상태 한눈에 (Environment=production, Debug Mode=OFF 인지)
tail -f storage/logs/laravel.log          # 새 오류가 쌓이는지
php artisan queue:failed                  # 실패한 큐 작업
```

### 롤백 계획

- **코드**: 직전 커밋으로 되돌리고(`git revert` 또는 이전 태그 checkout) 4절 순서를 다시 돈다.
- **DB**: 마이그레이션은 되돌리기가 코드보다 어렵다. `migrate:rollback` 은 `down()` 이 정확할 때만, 데이터가 사라지는 `down()` 이면 백업 복원을 먼저 생각한다. 그래서 "칸 추가 배포"와 "옛 칸 삭제 배포"를 **나눠서** 하는 편이 안전하다 — 첫 배포가 문제면 코드만 되돌리면 된다.

### Docker 로 도는 PES

PES 는 PHP 가 호스트가 아니라 컨테이너 안에 있다. 같은 명령을 `docker compose exec app` 을 붙여 실행한다([install.md](install.md#6-설치-뒤-명령은-어디서--프로젝트-루트)).

```bash
docker compose exec app php artisan migrate --force
docker compose exec app php artisan optimize
docker compose exec app php artisan about
```

컨테이너 방식에서는 "서버에 `composer install`"이 이미지 빌드 단계로 옮겨 가고, 큐 워커 재시작은 `queue` 컨테이너를 다시 띄우는 일이 된다. 명령의 **의미**는 4절 그대로다. PES 의 실제 배포 절차는 PES 저장소 문서를 따른다.

---

## 12. 암기 카드

| 질문 | 답 |
|---|---|
| 운영 `.env` 에서 반드시 확인할 두 값은? | `APP_ENV=production`, `APP_DEBUG=false` |
| `APP_DEBUG=true` 로 운영하면? | 오류 화면에 코드·경로·설정이 노출된다 |
| 운영 중 `APP_KEY` 를 바꾸면? | 모두 로그아웃, `encrypted` 로 저장한 값 복호화 불가 |
| 웹 서버 문서 루트는? | 프로젝트 루트가 아니라 `public/` (아니면 `.env` 가 열린다) |
| 운영에서 의존성 설치 명령은? | `composer install --no-dev --optimize-autoloader` (`update` 아님) |
| 운영에서 마이그레이션 명령은? | `php artisan migrate --force` (확인 질문 건너뜀) |
| 운영 DB 에서 절대 안 하는 명령은? | `migrate:fresh` — 데이터 전부 삭제 |
| 설정·라우트·뷰·이벤트 캐시를 한 번에 굳히는 명령은? | `php artisan optimize` (비우기는 `optimize:clear`) |
| 서버에서 `.env` 를 고친 뒤 할 일은? | `optimize`(또는 `config:cache`) 다시 실행 |
| `Vite manifest not found` 오류의 원인은? | `npm run build` 를 안 했다 (`public/build/manifest.json` 없음) |
| 실행 중 쓰기 권한이 필요한 두 폴더는? | `storage/`, `bootstrap/cache/` |
| 업로드 이미지 URL 이 404 이면? | `php artisan storage:link` 를 안 했다 |
| 새 코드를 올린 뒤 큐 워커에 할 일은? | `php artisan queue:restart` |
| 스케줄러를 돌리려면 cron 에 무엇을? | 매분 `php artisan schedule:run` 한 줄 |
| 유지보수 모드 켜기·끄기는? | `php artisan down --secret=…` / `php artisan up` |
| 새 버전이 살아 있는지 확인하는 기본 주소는? | `/up` (`bootstrap/app.php` 의 `health:`) |
| 배포 뒤 환경·디버그 상태를 한눈에 보는 명령은? | `php artisan about` |
| PES 에서 같은 명령을 실행하는 법은? | 앞에 `docker compose exec app` 을 붙인다 |
