#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""홈페이지 점검 — 배포(git push) 전에 돌린다.

    python3 scripts/check_site.py

  1. site/docs.js 의 문서 목록과 실제 md 파일이 맞는가 (references/ 에 새 문서가 생겼는데 목록에 없으면 알려 준다)
  2. md 안의 링크 앵커(#…)가 실제 제목과 맞는가 — 사이트의 미리보기 팝업이 이 앵커로 절을 찾는다
  3. site/glossary.json — 필수 칸, 종류, "자세히"(see) 앵커, 같은 표기의 중복
오류가 있으면 종료 코드 1.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KINDS = {'개념', '파일·폴더', '클래스', '메서드', '함수', '지시어', '명령', '문법', '도구', '규칙', 'PES 코드'}
errors, warns = [], []


def heading_text(h):
    h = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', h)
    return h.replace('`', '').replace('**', '').strip()


def gh_slug(t):
    # GitHub 과 같은 규칙 — site/lib.js 의 L.slug 와 같아야 한다
    return re.sub(r'[^\w\- ]', '', t.lower()).replace(' ', '-')


def strip_front(s):
    return re.sub(r'^---\n.*?\n---\n', '', s, count=1, flags=re.S)


# ── 1. 문서 목록 ───────────────────────────────────────────
src = open(os.path.join(ROOT, 'site', 'docs.js'), encoding='utf-8').read()
DOCS = dict(re.findall(r"slug:\s*'([^']+)',\s*path:\s*'([^']+)'", src))
for slug, path in DOCS.items():
    if not os.path.exists(os.path.join(ROOT, path)):
        errors.append(f'docs.js: {slug} → {path} 파일이 없다')
for f in sorted(os.listdir(os.path.join(ROOT, 'references'))):
    if f.endswith('.md') and f'references/{f}' not in DOCS.values():
        warns.append(f'docs.js: references/{f} 가 문서 목록에 없다 — 사이트에 안 보이고 검색도 안 된다')

anchors, texts = {}, {}
for slug, path in DOCS.items():
    p = os.path.join(ROOT, path)
    if not os.path.exists(p):
        continue
    s = strip_front(open(p, encoding='utf-8').read())
    texts[slug] = s
    seen, lst, fence = {}, [], False
    for ln in s.split('\n'):
        if ln.startswith('```') or ln.startswith('~~~'):
            fence = not fence
            continue
        if fence:
            continue
        m = re.match(r'^(#{1,6})\s+(.+?)\s*$', ln)
        if not m:
            continue
        a = gh_slug(heading_text(m.group(2)))
        if a in seen:
            seen[a] += 1
            a = f'{a}-{seen[a]}'
        else:
            seen[a] = 0
        lst.append(a)
    anchors[slug] = set(lst)

# ── 2. md 링크 ─────────────────────────────────────────────
path2slug = {v: k for k, v in DOCS.items()}
nlinks, bare = 0, []
for slug, s in texts.items():
    body = re.sub(r'```.*?```', '', s, flags=re.S)
    body = re.sub(r'^#{1,6} .*$', '', body, flags=re.M)   # 제목 줄의 문서 링크(문서 전체를 가리킴)는 뺀다
    for href in re.findall(r'\]\(([^)\s]+)\)', body):
        if re.match(r'^[a-z][a-z0-9+.-]*:', href, re.I):
            continue
        file, _, frag = href.partition('#')
        tgt = slug
        if file:
            p = os.path.normpath(os.path.join(os.path.dirname(DOCS[slug]), file))
            tgt = path2slug.get(p)
            if not tgt:
                continue  # 스킬 밖(PES 저장소) 파일 — 사이트는 글자로만 보여 준다
        nlinks += 1
        if frag and frag not in anchors.get(tgt, ()):
            errors.append(f'{DOCS[slug]}: 링크 {href} — 그런 제목이 없다')
        elif file and not frag and slug != 'skill':   # SKILL.md 의 로드맵·지도 표는 문서 전체를 가리키는 것이 맞다
            bare.append(f'{DOCS[slug]} → {file}')

# ── 3. 용어 사전 ───────────────────────────────────────────
gp = os.path.join(ROOT, 'site', 'glossary.json')
try:
    G = json.load(open(gp, encoding='utf-8'))
except Exception as e:
    errors.append(f'glossary.json 을 읽지 못했다 — {e}')
    G = []
surf, terms, n_ex, unused = {}, set(), 0, []
alltext = '\n'.join(texts.values())
for e in G:
    t = e.get('term', '')
    for k in ('term', 'kind', 'stage', 'short', 'desc', 'see'):
        if e.get(k) in (None, ''):
            errors.append(f'glossary: {t or "?"} — {k} 가 비었다')
    if t in terms:
        errors.append(f'glossary: {t} 가 두 번 있다')
    terms.add(t)
    if e.get('kind') not in KINDS:
        errors.append(f'glossary: {t} — 종류 "{e.get("kind")}" 는 쓰지 않는다')
    see = e.get('see', '')
    slug, _, frag = see.partition('#')
    if slug not in anchors:
        errors.append(f'glossary: {t} — see 문서 "{slug}" 가 없다')
    elif frag and frag not in anchors[slug]:
        errors.append(f'glossary: {t} — see 앵커 "{see}" 가 없다')
    off = e.get('official') or ''
    if off and not re.match(r'^https://(laravel\.com/docs/13\.x|pestphp\.com/docs|www\.php\.net|php\.net|getcomposer\.org|carbon\.nesbot\.com|alpinejs\.dev|filamentphp\.com|frankenphp\.dev|docs\.docker\.com|www\.postgresql\.org|fakerphp\.org|laravel\.com)', off):
        warns.append(f'glossary: {t} — official 주소 확인 필요 {off}')
    if '#' in off:
        warns.append(f'glossary: {t} — official 에 # 앵커가 있다 {off}')
    if e.get('example', {}).get('code'):
        n_ex += 1
    # 팝업·용어 사전은 이 칸들을 마크다운(HTML 통과)으로 그린다 — 백틱 밖의 태그는 화면을 깨뜨린다(<script> 등)
    for k in ('short', 'desc', 'php'):
        if re.search(r'<[A-Za-z/!]', re.sub(r'`[^`]*`', '', e.get(k) or '')):
            errors.append(f'glossary: {t} — {k} 에 백틱 밖 HTML 태그가 있다(`<…>` 로 감쌀 것)')
    if re.search(r'<[A-Za-z/!]', re.sub(r'`[^`]*`', '', (e.get('example') or {}).get('caption') or '')):
        errors.append(f'glossary: {t} — 예제 caption 에 백틱 밖 HTML 태그가 있다')
    for s in [t] + (e.get('aliases') or []):
        core = s[:-2] if s.endswith('()') else s
        key = (core, s.endswith('()'))
        if key in surf and surf[key] != t:
            errors.append(f'glossary: 표기 "{s}" 가 {surf[key]} 와 {t} 에 함께 있다')
        surf[key] = t
    if t.rstrip('()') not in alltext:
        unused.append(t)

# ── 4. 코드 줄 각주 site/notes.json ───────────────────────
# match 문자열은 그 문서의 코드블록 안에서 딱 한 줄에만 있어야 한다 — 없으면 배지가 안 붙고, 여러 줄이면 엉뚱한 줄에 붙는다
n_notes = 0
np_ = os.path.join(ROOT, 'site', 'notes.json')
if os.path.exists(np_):
    try:
        NOTES = json.load(open(np_, encoding='utf-8'))
    except Exception as e:
        errors.append(f'notes.json 을 읽지 못했다 — {e}')
        NOTES = []
    code_lines = {k: [ln for blk in re.findall(r'```[^\n]*\n(.*?)```', v, flags=re.S) for ln in blk.split('\n')]
                  for k, v in texts.items()}
    seen_n = set()
    for n in NOTES:
        sl, mt = n.get('slug', ''), n.get('match', '')
        if re.search(r'<[A-Za-z/!]', re.sub(r'`[^`]*`', '', n.get('note') or '')):
            errors.append(f'notes.json: {sl} "{mt}" — note 에 백틱 밖 HTML 태그가 있다')
        if not n.get('note'):
            errors.append(f'notes.json: {sl} "{mt}" — note 가 비었다')
        if sl not in code_lines:
            errors.append(f'notes.json: 문서 "{sl}" 가 없다')
            continue
        hit = sum(1 for ln in code_lines[sl] if mt in ln)
        if hit == 0:
            errors.append(f'notes.json: {sl} — "{mt}" 가 든 코드 줄이 없다')
        elif hit > 1:
            errors.append(f'notes.json: {sl} — "{mt}" 가 코드 {hit}줄에 있다(한 줄에만 있게 더 길게 적는다)')
        if (sl, mt) in seen_n:
            errors.append(f'notes.json: {sl} "{mt}" 가 두 번 있다')
        seen_n.add((sl, mt))
        n_notes += 1

# ── 5. 홈·흐름도의 미리보기 대상 ─────────────────────────────
def check_pv(src, where):
    for key in re.findall(r"""data-pv=["']([^"']+)["']""", src) + re.findall(r"""'([a-z-]+#[^']+)'\]""", src):
        slug, _, frag = key.partition('#')
        if slug not in anchors:
            errors.append(f'{where}: 미리보기 "{key}" — 문서가 없다')
        elif frag and frag not in anchors[slug]:
            errors.append(f'{where}: 미리보기 "{key}" — 그런 제목이 없다')
for f in ('index.html', 'site/flow.js', 'site/outline.js'):
    p = os.path.join(ROOT, f)
    if os.path.exists(p):
        check_pv(open(p, encoding='utf-8').read(), f)

# ── 6. 조용히 어긋날 수 있는 곳(경고) ─────────────────────────
# 절마다 되풀이되는 소제목(-1·-2 번호가 붙는 앵커)을 가리키는 see 는, 앞에 같은 소제목이 하나 늘면 다른 절을 가리킨다
REPEAT = re.compile(r'#(핵심-개념|순수-php-와-비교|읽는-법|구조)(-\d+)?$')
fragile = [e.get('term') for e in G if REPEAT.search(e.get('see', ''))]
if fragile:
    warns.append(f'glossary: 되풀이 소제목을 가리키는 see {len(fragile)}개 — 이 문서들 앞쪽에 "핵심 개념" 같은 소제목을 끼워 넣지 말 것 (예: {", ".join(fragile[:4])} …)')
# 앵커 없는 문서 링크 — 미리보기 팝업이 그 절 대신 문서 목차만 띄운다
if bare:
    warns.append(f'앵커(#) 없는 문서 링크 {len(bare)}개 — 팝업이 목차만 보여 준다: ' + ', '.join(bare[:6]) + (' …' if len(bare) > 6 else ''))
no_php = [e.get('term') for e in G if not e.get('php')]
if no_php:
    warns.append(f'glossary: 순수 PHP 비교(php)가 없는 용어 {len(no_php)}개')

# ── 결과 ───────────────────────────────────────────────────
lines = sum(len(s.splitlines()) for s in texts.values())
print(f'문서 {len(texts)}편 · {lines:,}줄 · 제목 {sum(len(a) for a in anchors.values())}개 · 내부 링크 {nlinks}개')
print(f'용어 {len(G)}개 (예제 {n_ex}개) · 본문에 한 번도 안 나오는 용어 {len(unused)}개')
print(f'코드 각주 {n_notes}개')
for w in warns:
    print('  ⚠', w)
for e in errors:
    print('  ✗', e)
print('정상' if not errors else f'오류 {len(errors)}개')
sys.exit(1 if errors else 0)
