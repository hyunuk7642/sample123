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

## 연구회 카드 그림 넣기

연구회가 낸 카드 그림은 번호(폼 드롭다운 순번, 1~20)를 붙여 등록합니다. 2:3 비율로 줄여 `assets/cards/NN.webp`로 저장하고 `index.html`의 그림 목록을 다시 씁니다.

```bash
python3 -I tools/card_art.py 08=그림.webp 01=다른그림.png
```

그림이 없는 연구회는 코드로 그린 기본 카드가 나옵니다.
