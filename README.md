# AI-E랩 연구 여정 웹앱

AI교육 성과주간 '곁' 체험 구역용 단일 HTML 웹앱입니다. GitHub Pages로 배포됩니다.

## 연구회 카드 내용 채우기

구글 폼 응답 CSV를 받으면 아래 한 줄로 카드 데이터를 다시 채웁니다. 대표교사 성함·이메일은 넣지 않고, 카드에 보이는 내용만 추립니다.

```bash
python3 -I tools/cards_from_csv.py "응답.csv"
```

- `data/cards.json`이 다시 쓰이고, `index.html`의 `/* CARDS:BEGIN */ … /* CARDS:END */` 사이가 바뀝니다.
- 연구회명은 `index.html`의 `G` 배열(폼 드롭다운과 같은 이름)과 글자 그대로 맞아야 합니다.
- 응답 CSV 자체는 개인정보가 있으므로 저장소에 넣지 않습니다.
