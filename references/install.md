# 0단계 — 설치: 명령을 어디서 실행하고 무엇이 생기나

## 목차

1. [골격 만들기와 실행 환경은 다른 일](#1-골격-만들기와-실행-환경은-다른-일)
2. [명령별 실행 폴더와 생기는 폴더](#2-명령별-실행-폴더와-생기는-폴더)
3. [laravel: command not found — PATH](#3-laravel-command-not-found--path)
4. [연습 프로젝트 만들기](#4-연습-프로젝트-만들기)
5. [설치 후 생기는 폴더 구조](#5-설치-후-생기는-폴더-구조)
6. [설치 뒤 명령은 어디서 — 프로젝트 루트](#6-설치-뒤-명령은-어디서--프로젝트-루트)
7. [하지 말 것](#7-하지-말-것)
8. [암기 카드](#8-암기-카드)

---

## 1. 골격 만들기와 실행 환경은 다른 일

`laravel new` 와 `compose.yaml` 은 둘 중 하나를 고르는 것이 아니다. 층이 다르다.

| 일 | 도구 | 몇 번 |
|---|---|---|
| **골격(코드) 만들기** | `laravel new` · `composer create-project` | 프로젝트마다 한 번 |
| **실행 환경 만들기** | 호스트 PHP(`php artisan serve`, Herd) · Sail · 직접 쓴 `compose.yaml` | 컴퓨터마다 |

순수 PHP 시절로 치면 "소스 압축을 풀고(골격) XAMPP·MAMP 로 Apache·MySQL 을 띄우던(환경)" 두 단계다. PES 는 골격 위에 직접 쓴 `compose.yaml`(FrankenPHP·PostgreSQL·Redis·Centrifugo·Mailpit)로 환경을 만든다.

---

## 2. 명령별 실행 폴더와 생기는 폴더

| 명령 | 실행할 폴더 | 생기는 것 |
|---|---|---|
| `composer global require laravel/installer` | **아무 폴더** | 프로젝트 폴더는 생기지 않는다. 설치기가 `~/.composer/vendor/laravel/installer` 에, 실행 파일이 `~/.composer/vendor/bin/laravel` 에 생긴다 |
| `laravel new my-app` | 프로젝트를 둘 **부모 폴더** (예: `~/apps`) | `~/apps/my-app/` |
| `composer create-project laravel/laravel my-app` | 위와 같음 | `~/apps/my-app/` |

- `my-app` 은 **새로 만들 폴더 이름**이다. `laravel-study` 라고 쓰면 `~/apps/laravel-study/` 가 생긴다.
- `laravel new` 는 스타터 키트·테스트 도구(Pest/PHPUnit)·DB 를 물어본다. `composer create-project` 는 묻지 않고 기본 골격을 만든다.
- 이름 자리에 `.` 을 쓰면(`composer create-project laravel/laravel .`) 지금 폴더에 설치한다. 폴더가 비어 있어야 한다.
- 전역 폴더(`~/.composer`)는 macOS 기본값이다. 확인: `composer global config home`.

---

## 3. laravel: command not found — PATH

설치기를 설치했는데 `laravel` 명령이 없다고 나오면, Composer 전역 실행 폴더가 PATH 에 없는 것이다.

```bash
composer global config bin-dir --absolute                            # 실행 폴더 확인 (macOS: ~/.composer/vendor/bin)
echo 'export PATH="$HOME/.composer/vendor/bin:$PATH"' >> ~/.zshrc    # 한 번만
source ~/.zshrc
laravel --version
```

설치기가 필요 없는 `composer create-project` 를 쓰면 이 과정을 건너뛸 수 있다.

---

## 4. 연습 프로젝트 만들기

```bash
cd ~/apps                                                  # 부모 폴더로
composer create-project laravel/laravel laravel-study      # ~/apps/laravel-study 가 생김
cd laravel-study                                           # 이제부터는 여기서
php artisan serve                                          # http://127.0.0.1:8000
```

`php artisan serve` 는 PHP 내장 웹 서버로 띄운다. 공식 문서의 `composer run dev` 는 Vite(Node)까지 함께 띄우므로, Node 를 쓰지 않으면 `php artisan serve` 로 충분하다. 연습 과제는 [exercises.md 4절](exercises.md#4-연습-프로젝트--미니-게시판).

---

## 5. 설치 후 생기는 폴더 구조

목록은 Laravel 공식 골격 저장소([laravel/laravel](https://github.com/laravel/laravel))에서 확인했다(2026-09-26). ★ 는 저장소에는 없고 **설치할 때 만들어지는** 것이다.

```
~/apps/laravel-study/
├── app/              컨트롤러·모델
├── bootstrap/        app.php (앱 조립)
├── config/
├── database/         migrations/ · factories/ · seeders/ · database.sqlite ★
├── public/           index.php (모든 요청의 입구)
├── resources/        views/ (Blade)
├── routes/           web.php · console.php
├── storage/          로그·캐시·업로드
├── tests/
├── vendor/ ★         composer 가 받은 라이브러리
├── .env ★            .env.example 을 복사해 만든 설정 (APP_KEY 까지 채워짐)
├── artisan           ← php artisan 이 실행하는 파일
├── composer.json · phpunit.xml · package.json · vite.config.js
└── AGENTS.md · CLAUDE.md · README.md
```

### ★ 가 생기는 이유 — 골격의 `composer.json` scripts

```json
"post-root-package-install": [
    "@php -r \"file_exists('.env') || copy('.env.example', '.env');\""
],
"post-create-project-cmd": [
    "@php artisan key:generate --ansi",
    "@php -r \"file_exists('database/database.sqlite') || touch('database/database.sqlite');\"",
    "@php artisan migrate --graceful --ansi"
]
```

`create-project` 가 끝나면 Composer 가 이 스크립트를 실행한다: `.env` 복사 → `APP_KEY` 생성 → 빈 `database.sqlite` 생성 → 마이그레이션. 기본 DB 가 SQLite 라서 **설치만 하면 바로 돌아간다.** `vendor/` 는 `composer install` 결과라 git 에 올리지 않는다(`.gitignore`). `.env` 도 올리지 않는다.

### PES 와 다른 점

골격의 `AGENTS.md`·`CLAUDE.md`(호스트에 PHP 를 설치하라는 안내)와 Node 파일(`package.json`·`vite.config.js`)은 PES 에 넣지 않았다(`PES-DESIGN.md` "로컬 개발 환경" 절). PES 의 `AGENTS.md` 는 PES 가 직접 쓴 개발 지침이다. PES 는 SQLite 대신 PostgreSQL 을 쓴다.

---

## 6. 설치 뒤 명령은 어디서 — 프로젝트 루트

**`php artisan` 은 사실상 `php ./artisan` 이다.** 지금 폴더의 `artisan` 파일을 PHP 로 실행하므로, `artisan` 이 있는 **프로젝트 루트**에서 실행한다. `composer require` 도 `composer.json` 이 있는 루트에서 한다.

```
~/apps/                      ← laravel new · composer create-project 를 여기서
├── pes/                     ← docker compose … 를 여기서 (compose.yaml 이 있는 곳)
│                               컨테이너 안에서는 이 폴더가 /app 이라,
│                               docker compose exec app php artisan … 은 cd 없이 동작
└── laravel-study/           ← 새로 생김. cd 한 뒤 php artisan … 를 여기서
```

### PES 코드 — 컨테이너 안의 폴더가 프로젝트 루트인 이유

```yaml
# compose.yaml (x-php 앵커)
x-php: &php
  build: ./docker/php
  volumes:
    - ./:/app              # PES 폴더 → 컨테이너의 /app
```

```dockerfile
# docker/php/Dockerfile
WORKDIR /app               # 컨테이너 안 명령은 /app 에서 실행
```

그래서 `docker compose exec app php artisan migrate` 는 컨테이너 안의 `/app`(= PES 루트)에서 돈다. PES 에서는 호스트의 `php artisan` 이 아니라 **항상 `docker compose exec app php artisan`** 을 쓴다 — 호스트 PHP 는 버전·확장·DB 주소(`DB_HOST=postgres`)가 컨테이너와 다르다.

---

## 7. 하지 말 것

- **`~/apps/pes` 안에서 `laravel new` 를 실행하지 않는다.** `~/apps/pes/my-app/` 처럼 PES 안에 프로젝트가 하나 더 생겨 git 에 딸려 들어갈 수 있다. 새 프로젝트는 항상 바깥 폴더(`~/apps`)에서 만든다.
- **프로젝트 루트가 아닌 곳에서 `php artisan` 을 실행하지 않는다.** `Could not open input file: artisan` 이 나온다 — 지금 폴더에 `artisan` 파일이 없다는 뜻이다.
- **이미 파일이 있는 폴더에 `composer create-project … .` 를 하지 않는다.** 빈 폴더여야 한다.

---

## 8. 암기 카드

| 질문 | 답 |
|---|---|
| `laravel new` 와 `compose.yaml` 의 관계는? | 층이 다르다 — 골격(코드) 만들기 / 실행 환경 만들기 |
| `composer global require laravel/installer` 는 어디서? | 아무 폴더 — 프로젝트 폴더는 생기지 않는다 |
| `laravel new my-app` 은 어디서 실행하고 무엇이 생기나? | 부모 폴더(`~/apps`)에서 → `~/apps/my-app/` |
| `laravel: command not found` 의 원인은? | `~/.composer/vendor/bin` 이 PATH 에 없다 |
| 설치할 때 만들어지는 파일 4가지는? | `vendor/` · `.env` · `APP_KEY`(`.env` 안) · `database/database.sqlite` |
| 그 파일들을 만드는 곳은? | 골격 `composer.json` 의 `post-root-package-install`·`post-create-project-cmd` |
| `php artisan` 은 어디서 실행하나? | `artisan` 파일이 있는 프로젝트 루트 |
| `Could not open input file: artisan` 의 뜻은? | 프로젝트 루트가 아닌 곳에서 실행했다 |
| PES 에서 artisan 을 부르는 법은? | `docker compose exec app php artisan …` (컨테이너의 `/app` = PES 루트) |
