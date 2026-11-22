#!/usr/bin/env python3
"""구글 폼 응답 CSV → 카드 데이터.

사용법:  python3 -I tools/cards_from_csv.py <응답.csv>

- data/cards.json 을 다시 쓰고, index.html 의  /* CARDS:BEGIN */ … /* CARDS:END */  사이를 바꿉니다.
- 대표교사 성함·이메일 같은 개인정보는 넣지 않습니다. 카드에 보이는 내용만 추립니다.
- 연구회명은 index.html 의 G 배열(폼 드롭다운과 같은 이름)과 글자 그대로 맞아야 합니다.
"""
import csv, io, json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
HTML = ROOT / "index.html"
OUT = ROOT / "data" / "cards.json"

# 폼의 주제 이름 → 웹앱의 주제 키
TOPIC_KEY = {
    "마음·윤리·사회정서": "mind",
    "AI 원리·알고리즘·데이터": "algo",
    "창작·표현": "create",
    "융합·지속가능": "sdg",
    "과학·피지컬·XR": "sim",
    "모두를 위한 AI": "incl",
    "통합교육": "incl",
    "다문화": "incl",
}
COL = {  # 폼 문항 제목의 앞부분으로 열을 찾습니다 (문항이 조금 바뀌어도 동작하도록)
    "group": "연구회명", "q": "연구 질문", "method": "설계 방법", "intro": "간략한 내용 소개",
    "target": "연구 대상", "status": "진행 상태", "topics": "우리 연구회와 가까운 주제",
    "activity": "현장에서 한 활동", "voice": "학생의 한마디", "change": "눈에 띈 변화", "trial": "시행착오",
}

# 응답 원문의 명백한 오타만 고칩니다 (내용은 바꾸지 않음)
FIX = {"초등 영초등 영어": "초등 영어", "쓰는태도": "쓰는 태도"}

# 글자 수 제한 등으로 문장 중간에서 끊긴 응답: 끝에 말줄임표를 붙여 잘렸음을 표시합니다
TRUNCATED = ["Padlet을 통한 교류를 이어"]
BULLET = re.compile(r"^\s*(?:[-–•·▪◦]|○|●|■|□|▶|\d+[.)])\s*")

def clean(s: str) -> str:
    """공백 정리. 목록(줄머리 기호)으로 쓴 응답은 줄바꿈을 살리고, 문장 중간의 줄바꿈은 띄어쓰기로 잇습니다."""
    s = (s or "").replace("\u00a0", " ").replace("\r\n", "\n").replace("\r", "\n")
    out = []
    for ln in s.split("\n"):
        ln = re.sub(r"[ \t]+", " ", ln).strip()
        if not ln: continue
        if BULLET.match(ln):
            head = ln.lstrip()[0]
            body = BULLET.sub("", ln).strip()
            out.append(("\n" if out else "") + (body if head in "○●■□▶" else "· " + body))
        else:
            out.append((" " if out else "") + ln)
    s = "".join(out).strip()
    for a, b in FIX.items(): s = s.replace(a, b)
    for t in TRUNCATED:
        if s.endswith(t): s += "…"
    return s

def level_of(target: str, group: str) -> str:
    t = target + " " + group
    has = []
    if re.search(r"초등|초중고|초·중·고|초\b|초\d", t): has.append("초")
    if re.search(r"중학|중등|초중고|초·중·고|중\s?[1-3]|중\d", t): has.append("중")
    if re.search(r"고등|직업계고|초중고|초·중·고|고\s?[1-3]|고\d", t): has.append("고")
    if "온라인" in t and not has: return "온라인"
    return "·".join(has) if has else ""

def main(path: str):
    raw = open(path, "rb").read()
    for enc in ("utf-8-sig", "utf-8", "cp949"):
        try: text = raw.decode(enc); break
        except UnicodeDecodeError: continue
    rows = list(csv.reader(io.StringIO(text, newline="")))   # 셀 안의 줄바꿈을 보존
    head = rows[0]
    idx = {}
    for key, prefix in COL.items():
        for i, h in enumerate(head):
            if clean(h).startswith(prefix): idx[key] = i; break
    missing = [k for k in COL if k not in idx]
    if missing: sys.exit(f"CSV에서 열을 찾지 못함: {missing}")

    cards = {}
    for r in rows[1:]:
        if len(r) < len(head): r = r + [""] * (len(head) - len(r))
        g = lambda k: clean(r[idx[k]])
        name = g("group")
        if not name: continue
        pairs = lambda items: [[l, v] for l, v in items if v]
        topics = []
        for t in re.split(r"[;,]", g("topics")):
            k = TOPIC_KEY.get(clean(t))
            if k and k not in topics: topics.append(k)
        cards[name] = {
            "status": g("status"),
            "level": level_of(g("target"), name),
            "topics": topics,
            "intro": g("intro"),
            "design": pairs([["연구 질문", g("q")], ["설계 방법", g("method")]]),
            "field": pairs([["대상·교과", g("target")], ["활동", g("activity")], ["시행착오", g("trial")]]),
            "learn": pairs([["학생의 목소리", g("voice")], ["나타난 변화", g("change")]]),
        }
    OUT.write_text(json.dumps(cards, ensure_ascii=False, indent=1), encoding="utf-8")

    html = HTML.read_text(encoding="utf-8")
    a, b = "/* CARDS:BEGIN */", "/* CARDS:END */"
    i, j = html.index(a), html.index(b)
    block = a + "\nconst DETAILS=" + json.dumps(cards, ensure_ascii=False, separators=(",", ":")) + ";\n" + b
    HTML.write_text(html[:i] + block + html[j + len(b):], encoding="utf-8")
    print(f"{len(cards)}개 연구회 카드를 채웠습니다 → {OUT.relative_to(ROOT)}, index.html")
    for n in cards: print(" -", n, "·", cards[n]["status"] or "상태 없음", "·", cards[n]["level"] or "학교급 미확인")

if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(__doc__)
    main(sys.argv[1])
