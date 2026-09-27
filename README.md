# laravel — Laravel 13 공부 스킬

PHP 는 잘 알지만 Laravel 은 처음인 사람을 위한 **AI 코딩 에이전트용 공부 스킬**입니다. 설치하면 AI 가 Laravel 선생님이 되어 기초 암기 → 요청 한 바퀴 따라가기 → 주제별 심화 → 퀴즈·실습 순서로 한국어로 가르칩니다.

- 대상: Laravel 13 · PHP 8.3+ · Pest
- 형식: [Agent Skills](https://agentskills.io) 표준(`SKILL.md` + `references/`) — Claude Code, Codex CLI, Gemini CLI, GitHub Copilot, Cursor 등에서 동작합니다.
- 언어: 한국어

> **알아 둘 점** — 이 스킬은 [PES](https://getpes.com) 저장소의 실제 코드를 예제로 씁니다. 필요한 코드는 `references/` 문서 안에 발췌해 두었으므로 다른 프로젝트에서도 공부할 수 있습니다. 다만 PES 파일로 가는 링크는 열리지 않고, `docker compose exec app php artisan …` 명령은 여러분의 환경에 맞게 `php artisan …` 등으로 바꿔 읽어야 합니다.

---

## 1. 가장 쉬운 설치 — AI 에게 맡기기

쓰고 있는 AI 코딩 에이전트(Claude Code, Codex, Gemini CLI, Copilot, Cursor …)의 채팅 창에 아래 문구를 **그대로 붙여 넣으세요.**

```text
https://github.com/thruthesky/laravel 에 있는 Agent Skill "laravel" 을 이 프로젝트에 설치해 줘.

1. 너(지금 이 AI 도구)가 스킬을 읽는 폴더를 확인해.
   - Claude Code: .claude/skills/
   - Codex CLI: .agents/skills/
   - Gemini CLI: .gemini/skills/ 또는 .agents/skills/
   - GitHub Copilot: .github/skills/ 또는 .claude/skills/
   - Cursor: .cursor/skills/ 또는 .agents/skills/
2. 그 폴더 아래 laravel/ 에 저장소를 받아. 이 프로젝트가 git 저장소면 서브모듈로:
   git submodule add https://github.com/thruthesky/laravel <스킬폴더>/laravel
   아니면: git clone https://github.com/thruthesky/laravel <스킬폴더>/laravel
3. <스킬폴더>/laravel/SKILL.md 가 있는지 확인하고, 설치한 경로를 알려 줘.
```

설치가 끝나면 AI 를 새로 시작(새 세션)한 뒤 [4. 사용법](#4-사용법)처럼 말해 보세요.

---

## 2. 명령 한 줄로 설치 — skills CLI

Node.js 가 있으면 [skills CLI](https://skills.sh) 로 설치할 수 있습니다. 설치할 AI 도구를 고르는 화면이 나옵니다.

```bash
npx skills add thruthesky/laravel                            # 지금 프로젝트에
npx skills add thruthesky/laravel -g                         # 모든 프로젝트에 (사용자 전역)
npx skills add thruthesky/laravel --agent claude-code cursor # 도구를 골라서
```

업데이트는 `npx skills update laravel`, 제거는 `npx skills remove laravel`.

---

## 3. 직접 설치 — git

### 도구별 스킬 폴더

| AI 도구 | 프로젝트 폴더 | 사용자 전역 폴더 |
|---|---|---|
| Claude Code | `.claude/skills/laravel` | `~/.claude/skills/laravel` |
| Codex CLI | `.agents/skills/laravel` | `~/.agents/skills/laravel` |
| Gemini CLI | `.gemini/skills/laravel` 또는 `.agents/skills/laravel` | `~/.gemini/skills/laravel` 또는 `~/.agents/skills/laravel` |
| GitHub Copilot (VS Code·CLI) | `.github/skills/laravel` 또는 `.claude/skills/laravel` | `~/.copilot/skills/laravel` 또는 `~/.claude/skills/laravel` |
| Cursor | `.cursor/skills/laravel` · `.agents/skills/laravel` · `.claude/skills/laravel` | `~/.cursor/skills/laravel` · `~/.agents/skills/laravel` · `~/.claude/skills/laravel` |

- `.claude/skills` 한 곳에 두면 Claude Code · Copilot · Cursor 가 함께 읽습니다.
- `.agents/skills` 한 곳에 두면 Codex · Gemini CLI · Cursor 가 함께 읽습니다.

### 프로젝트에 설치 (팀과 공유)

```bash
# git 서브모듈로 — 저장소를 clone 하는 사람도 함께 받는다 (PES 가 쓰는 방식)
git submodule add https://github.com/thruthesky/laravel .claude/skills/laravel
git commit -m "chore: laravel 공부 스킬 추가"

# 서브모듈이 싫으면 그냥 받기
git clone https://github.com/thruthesky/laravel .claude/skills/laravel
```

서브모듈로 넣은 저장소를 새로 clone 한 사람은 한 번 실행합니다:

```bash
git submodule update --init .claude/skills/laravel
```

### 모든 프로젝트에서 쓰기 (나만)

```bash
git clone https://github.com/thruthesky/laravel ~/.claude/skills/laravel   # Claude Code·Copilot·Cursor
git clone https://github.com/thruthesky/laravel ~/.agents/skills/laravel   # Codex·Gemini CLI·Cursor
```

### 여러 도구를 한 폴더로 (심볼릭 링크)

한 번 받아 두고 다른 도구 폴더는 링크로 잇습니다.

```bash
git clone https://github.com/thruthesky/laravel .agents/skills/laravel
mkdir -p .claude/skills
ln -s ../../.agents/skills/laravel .claude/skills/laravel
```

### 스킬을 지원하지 않는 AI 도구

어느 폴더에 받든, 그 도구가 읽는 지침 파일(`AGENTS.md`, `CLAUDE.md`, `GEMINI.md` 등)에 한 줄을 넣으면 됩니다.

```markdown
- Laravel 을 공부·복습하거나 Laravel 개념을 물으면 `.claude/skills/laravel/SKILL.md` 를 먼저 읽고 그 지침대로 가르친다.
```

### 업데이트

```bash
git -C .claude/skills/laravel pull                      # clone 으로 받았을 때
git submodule update --remote .claude/skills/laravel    # 서브모듈일 때 (그다음 상위 저장소에서 커밋)
```

---

## 4. 사용법

설치 후 **새 세션**에서 이렇게 말하면 스킬이 불려 나옵니다.

| 이렇게 말하면 | AI 가 하는 일 |
|---|---|
| "Laravel 공부 처음부터 시작해 주세요" | 7단계 로드맵 1단계 + 기초 암기 카드 |
| "Eloquent 관계가 뭐예요?" | 개념 → 예제 코드 → 순수 PHP 와 비교 → 확인 문제 |
| "이 컨트롤러 코드 설명해 주세요" | 줄마다 Laravel 개념 이름을 붙여 설명 |
| "요청 한 바퀴 따라가기 해 주세요" | 요청이 거치는 파일을 순서대로 |
| "4단계 퀴즈 내 주세요" | 문제만 내고, 답하면 채점·해설 |
| "실습하고 싶어요" | tinker 조회 실습, 연습 프로젝트 "미니 게시판" 과제 10개 |

Claude Code 에서는 `/laravel` 로 직접 부를 수도 있습니다. Gemini CLI 에서는 `/skills list` 로 설치 여부를 확인합니다.

---

## 5. 구성

```
laravel/
├── SKILL.md                  가르치는 규칙, 공부 모드, 7단계 로드맵, 기초 암기 카드, 옛 튜토리얼과의 차이표, 심화 과정
└── references/
    ├── install.md            0단계 설치 — 명령을 실행할 폴더, 생기는 폴더 구조
    ├── lifecycle.md          1단계 큰 그림 — 요청 흐름·서비스 컨테이너·Facade·config
    ├── routing.md            2단계 라우트·미들웨어
    ├── controllers.md        3단계 컨트롤러·검증·응답·인증·정책
    ├── eloquent.md           4단계 Eloquent — 관계·스코프·casts·N+1·Collection
    ├── blade.md              5단계 Blade — 레이아웃 상속·컴포넌트·폼·헬퍼
    ├── database.md           6단계 마이그레이션·팩토리·시더
    ├── testing.md            7단계 Pest 테스트
    ├── artisan.md            Artisan 명령·tinker
    ├── pitfalls.md           PHP 전문가가 빠지는 함정 12개
    ├── exercises.md          퀴즈 문제 은행(7단계 + 심화)·실습 과제
    │
    │   심화 — 7단계를 마친 뒤 실무 주제
    ├── relations.md          관계 더 알기 — 다대다·피벗·관계 집계·다형
    ├── eloquent-plus.md      Eloquent 더 알기 — 접근자·소프트 삭제·전역 스코프·엄격 모드·대량 처리
    ├── transactions.md       트랜잭션과 데이터 무결성 — DB::transaction·잠금·경쟁 조건
    ├── files-cache.md        파일 업로드·저장소와 캐시
    ├── queues.md             큐·잡·이벤트·메일·알림·스케줄러
    ├── api.md                JSON API — api 라우트·API Resource·Sanctum
    ├── security.md           보안 — Laravel 이 막아 주는 것과 내가 막아야 할 것
    ├── debugging.md          디버깅·로그·예외 처리
    └── deploy.md             배포 — 로컬에서 운영 서버로
```
