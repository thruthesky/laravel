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
nlinks = 0
for slug, s in texts.items():
    body = re.sub(r'```.*?```', '', s, flags=re.S)
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
    for s in [t] + (e.get('aliases') or []):
        core = s[:-2] if s.endswith('()') else s
        key = (core, s.endswith('()'))
        if key in surf and surf[key] != t:
            errors.append(f'glossary: 표기 "{s}" 가 {surf[key]} 와 {t} 에 함께 있다')
        surf[key] = t
    if t.rstrip('()') not in alltext:
        unused.append(t)

# ── 결과 ───────────────────────────────────────────────────
lines = sum(len(s.splitlines()) for s in texts.values())
print(f'문서 {len(texts)}편 · {lines:,}줄 · 제목 {sum(len(a) for a in anchors.values())}개 · 내부 링크 {nlinks}개')
print(f'용어 {len(G)}개 (예제 {n_ex}개) · 본문에 한 번도 안 나오는 용어 {len(unused)}개')
for w in warns:
    print('  ⚠', w)
for e in errors:
    print('  ✗', e)
print('정상' if not errors else f'오류 {len(errors)}개')
sys.exit(1 if errors else 0)
