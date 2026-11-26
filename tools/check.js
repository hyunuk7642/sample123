#!/usr/bin/env node
/* 전체 점검. 내용을 고치거나 연구회를 추가한 뒤, 올리기 전에 돌립니다.

   준비:   npm install playwright   (그리고 npx playwright install chromium)
   사용법: node tools/check.js

   로컬 서버로 페이지를 열고 외부 네트워크를 전부 막은 채 아래를 확인합니다. 하나라도 어긋나면 실패(종료 코드 1)로 끝납니다.
   1) 외부 요청 0건, 글꼴·배경·카드 그림 로드   2) 카드 20장 × 보이는 모든 단계 × 주제 6개 (화면 3종)
   3) 실제 클릭 경로 한 바퀴                    4) 트레일러 20개   5) 다크 모드 · 움직임 줄이기 · 무입력 복귀
   6) 터치 탭이 덮개 아래로 새지 않음            7) 추천에 20곳이 고르게 나옴   8) 글꼴 하나가 실패해도 영상이 시작됨
   9) '원하는 연구회 보기'에서 고른 연구회의 트레일러와 내용이 뜸 */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json' };
const fails = [];
const ok = (cond, label, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`); if (!cond) fails.push(label); };

(async () => {
  const srv = http.createServer((q, r) => {
    const u = decodeURIComponent(q.url.split('?')[0]), f = path.join(ROOT, u === '/' ? 'index.html' : u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch();
  const open = async (opts = {}) => {
    const ctx = await browser.newContext(opts), p = await ctx.newPage(), log = { errs: [], ext: [], notFound: [] };
    p.on('pageerror', e => log.errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') log.errs.push(m.text().slice(0, 120)); });
    p.on('response', r => { if (r.status() >= 400) log.notFound.push(r.url().replace(base, '')); });
    await p.route('**/*', r => { const u = r.request().url(); if (u.startsWith(base) || u.startsWith('data:')) return r.continue(); log.ext.push(u.slice(0, 80)); return r.abort(); });
    await p.goto(base); await p.waitForTimeout(700); return { p, log };
  };
  const toJourney = async p => { await p.evaluate(() => { if (reel.on) stopReel(); }); await p.waitForTimeout(500); await p.click('#skip'); await p.waitForTimeout(5600); };

  /* 1) 외부 요청, 글꼴, 그림 */
  { const { p, log } = await open({ viewport: { width: 1100, height: 820 } }); await p.waitForTimeout(2000);
    const f = await p.evaluate(async () => { const t = '연구 여정 ABC', list = ['400 20px "IBM Plex Sans KR"', '700 20px "IBM Plex Sans KR"', '700 20px "Gowun Batang"', '80px "Black Han Sans"', '40px "Nanum Pen Script"'];
      for (const x of list) await document.fonts.load(x, t); return list.filter(x => !document.fonts.check(x, t)); });
    const imgs = await p.evaluate(async () => { const bad = []; for (const c of CARDS) { const src = artOf(c); if (!src) { bad.push(c.id + ' (no art)'); continue; }
      const im = new Image(); im.src = src; await new Promise(r => { im.onload = im.onerror = r; }); if (im.naturalWidth !== 720) bad.push(c.id); } return bad; });
    ok(log.ext.length === 0, '외부 요청 없음', log.ext.slice(0, 2).join(' '));
    ok(log.notFound.length === 0, '없는 파일 요청 없음', log.notFound.slice(0, 3).join(' '));
    ok(f.length === 0, '글꼴 로드', f.join(', ')); ok(imgs.length === 0, '카드 그림 20장 로드', imgs.join(', '));
    ok(await p.evaluate(() => FILLED === CARDS.length && CARDS.every(c => SCRIPTS[c.group])), '연구회 20곳 모두 내용과 트레일러 있음');
    ok(log.errs.length === 0, '첫 화면 콘솔 오류 없음', log.errs[0]); await p.context().close(); }

  /* 2) 카드 × 단계 × 주제 */
  for (const [name, vp] of [['1100×820', { width: 1100, height: 820 }], ['1366×768', { width: 1366, height: 768 }], ['390×780', { width: 390, height: 780 }]]) {
    const { p, log } = await open({ viewport: vp }); await toJourney(p);
    const r = await p.evaluate(async () => { const out = { screens: 0, bad: [], wait: () => new Promise(r => setTimeout(r, 20)) };
      const scan = tag => { const st = document.getElementById('stage'), de = document.documentElement; out.screens++;
        if (/undefined|NaN|\[object/.test(st.innerText)) out.bad.push(tag + ' 깨진 글자'); if (de.scrollWidth - de.clientWidth > 1) out.bad.push(tag + ' 가로 넘침');
        if ([...st.querySelectorAll('h1,h2,h3,.btn,.tag,.stop,.opt b')].some(e => e.scrollWidth > e.clientWidth + 2)) out.bad.push(tag + ' 잘린 글자'); };
      for (const c of CARDS) { S.card = c; S.resp = []; S.qi = 0; S.topic = null;
        for (const st of visSteps()) {
          if (st === 4) { S.step = 4; S.qi = 0; S.resp = []; render(); await out.wait(); scan(`${c.id} 문항`);
            S.qi = QS.length; AX.forEach((a, ai) => { for (let k = 0; k < 3; k++) S.resp.push({ ai, v: ((c.id >> ai) & 1 ? 1 : -1) * 2 }); }); render(); await out.wait(); scan(`${c.id} 결과`); }
          else if (st === 5) { for (const tp of Object.keys(TOPIC)) { S.step = 5; S.topic = tp; render(); await out.wait(); scan(`${c.id} 추천 ${tp}`); } }
          else { S.step = st; render(); await out.wait(); scan(`${c.id} 단계 ${st}`); if (c.detail && document.querySelector('#stage .empty')) out.bad.push(`${c.id} 단계 ${st} 빈 안내`); } } }
      return { screens: out.screens, bad: out.bad }; });
    ok(r.bad.length === 0 && log.errs.length === 0, `화면 ${name}: ${r.screens}개`, [...r.bad, ...log.errs].slice(0, 3).join(' | ')); await p.context().close(); }

  /* 3) 실제 클릭 경로 */
  { const { p, log } = await open({ viewport: { width: 1100, height: 820 } }); await p.evaluate(() => { if (reel.on) stopReel(); }); await p.waitForTimeout(600);
    for (const i of [0, 1, 2]) { await p.click(`[data-i="${i}"]`, { force: true }); await p.waitForTimeout(350); }
    await p.waitForTimeout(800); await p.click('#enter');
    await p.waitForFunction(() => !document.getElementById('app').hidden, null, { timeout: 8000 });
    const box = await p.locator('[data-draw]:nth-child(4)').boundingBox(); await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await p.waitForTimeout(900);
    ok(await p.evaluate(() => !!S.card && tr.on), '입장 직후 탭으로 카드가 뽑히고 트레일러 시작');
    await p.mouse.click(500, 400); await p.waitForTimeout(2200);
    let hops = 0; while (await p.evaluate(() => S.step) !== 4 && hops++ < 6) { await p.click('#n'); await p.waitForTimeout(450); }   /* 화면이 바뀐 직후 0.3초의 탭은 앱이 일부러 무시함 */
    for (let i = 0; i < 12; i++) { await p.click(`.stop[data-k="${i % 4}"]`); await p.waitForTimeout(950); }
    await p.waitForTimeout(400);
    const type = await p.evaluate(() => document.querySelector('.typename')?.textContent || '');
    await p.click('#n'); await p.waitForTimeout(500); await p.click('.opt'); await p.waitForTimeout(500);
    const recs = await p.evaluate(() => document.querySelectorAll('.rec').length); await p.click('#again'); await p.waitForTimeout(700);
    ok(/연구자$/.test(type) && recs > 0 && await p.evaluate(() => !document.getElementById('intro').hidden) && log.errs.length === 0, '클릭 경로 한 바퀴', `유형 "${type}", 추천 ${recs}곳 ${log.errs[0] || ''}`);
    await p.context().close(); }

  /* 4) 트레일러 20개 */
  { const { p, log } = await open({ viewport: { width: 1100, height: 820 } }); await toJourney(p);
    for (let id = 1; id <= 20; id++) { await p.evaluate(i => { S.card = CARDS.find(c => c.id === i); startTrailer(S.card); }, id); await p.waitForTimeout(200);
      for (const t of [0.7, 2.2, 4, 6, 8, 10, 12, 14.2]) { await p.evaluate(tt => { tr.t0 = performance.now() - tt * 1000; }, t); await p.waitForTimeout(35); }
      await p.evaluate(() => stopTrailer()); await p.waitForTimeout(60); }
    ok(log.errs.length === 0, '트레일러 20개 × 8비트', log.errs[0]); await p.context().close(); }

  /* 5) 다크 모드, 움직임 줄이기, 무입력 복귀 */
  { const { p, log } = await open({ viewport: { width: 1100, height: 820 }, colorScheme: 'dark' }); await toJourney(p);
    await p.evaluate(() => { S.card = CARDS[1]; S.step = 1; render(); }); await p.waitForTimeout(200);
    const c = await p.evaluate(() => { const a = getComputedStyle(document.querySelector('.sheet')).backgroundColor.match(/\d+/g).map(Number), b = getComputedStyle(document.querySelector('.field p')).color.match(/\d+/g).map(Number); return [a[0] + a[1] + a[2], b[0] + b[1] + b[2]]; });
    ok(c[0] < 250 && c[1] > 500 && log.errs.length === 0, '다크 모드: 어두운 바탕에 밝은 글자'); await p.context().close(); }
  { const { p, log } = await open({ viewport: { width: 1100, height: 820 }, reducedMotion: 'reduce' }); await p.waitForTimeout(500);
    const a = await p.evaluate(() => !reel.on && !document.getElementById('intro').hidden); await p.click('#skip'); await p.waitForTimeout(400);
    const b2 = await p.evaluate(() => !document.getElementById('app').hidden); await p.click('[data-draw]', { force: true }); await p.waitForTimeout(300);
    ok(a && b2 && await p.evaluate(() => !tr.on && !!S.card) && log.errs.length === 0, '움직임 줄이기: 쇼릴·전환·트레일러 건너뜀'); await p.context().close(); }
  { const { p } = await open({ viewport: { width: 1100, height: 820 } }); await p.clock.install(); await p.goto(base); await p.clock.runFor(800);
    await p.evaluate(() => { if (reel.on) stopReel(); }); await p.clock.runFor(700); await p.click('#skip'); await p.clock.runFor(6500); await p.clock.runFor(70000);
    const still = await p.evaluate(() => !document.getElementById('app').hidden && !reel.on); await p.clock.runFor(115000);
    ok(still, '입장한 뒤 1분 남짓 가만히 있어도 쫓겨나지 않음');
    ok(await p.evaluate(() => reel.on && reel.loop && document.getElementById('app').hidden), '3분 무입력 → 쇼릴 반복으로 복귀'); await p.context().close(); }

  /* 6) 터치 탭이 덮개 아래로 새지 않는지 */
  { const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true }), p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base); await p.waitForTimeout(900);
    await p.touchscreen.tap(640, 400); await p.waitForTimeout(700);                       /* 쇼릴 한가운데(입장 카드 위)를 탭 */
    const reelLeak = await p.evaluate(() => flipped.size > 0 || !document.getElementById('app').hidden);
    await p.evaluate(() => enterApp()); await p.waitForTimeout(5600);
    const d = await p.locator('[data-draw]:nth-child(4)').boundingBox(); await p.touchscreen.tap(d.x + d.width / 2, d.y + d.height / 2); await p.waitForTimeout(150);
    await p.touchscreen.tap(d.x + d.width / 2, d.y + d.height / 2); await p.waitForTimeout(800);   /* 같은 자리를 두 번 탭 */
    const doubleTapKept = await p.evaluate(() => tr.on);
    const spot = await p.evaluate(() => { for (const id of ['r', 'n']) { const b = document.getElementById(id).getBoundingClientRect(), y = b.top + b.height / 2; if (y > 10 && y < innerHeight - 10) return { x: b.left + b.width / 2, y }; } return { x: innerWidth / 2, y: innerHeight * .8 }; });
    await p.touchscreen.tap(spot.x, spot.y); await p.waitForTimeout(700);                 /* 트레일러를, 아래에 버튼이 있는 자리에서 탭 */
    ok(!reelLeak && doubleTapKept && await p.evaluate(() => !!S.card && !tr.on && S.step === 0) && !errs.length, '터치: 덮개를 닫는 탭이 아래 버튼을 누르지 않고, 두 번 탭해도 트레일러가 꺼지지 않음', `reelLeak=${reelLeak} doubleTapKept=${doubleTapKept}`);
    await ctx.close(); }

  /* 7) 다음 연구 추천: 20곳이 모두 한 번 이상 나오고, 자기 연구회는 안 나오고, 꼬리표가 사실과 맞는지 */
  { const { p, log } = await open({ viewport: { width: 1100, height: 820 } }); await toJourney(p);
    const r = await p.evaluate(() => { const seen = new Set(), bad = [];
      for (const c of CARDS) for (const tp of Object.keys(TOPIC)) { S.card = c; S.step = 5; S.topic = tp; render();
        const recs = [...document.querySelectorAll('.rec')].map(e => ({ g: e.querySelector('h3').textContent, l: e.querySelector('.label').textContent }));
        recs.forEach((x, i) => { const card = CARDS.find(k => k.group === x.g); seen.add(x.g);
          if (x.g === c.group) bad.push(`${c.id}/${tp} 자기 자신`); if (!card.topics.includes(tp)) bad.push(`${c.id}/${tp} 주제 불일치`);
          if (i === 1 && /학교급이 다른/.test(x.l) && card.level === CARDS.find(k => k.group === recs[0].g).level) bad.push(`${c.id}/${tp} 학교급 꼬리표`); });
        if (!recs.length) bad.push(`${c.id}/${tp} 추천 없음`); }
      return { never: CARDS.filter(c => !seen.has(c.group)).map(c => c.group), bad }; });
    ok(r.never.length === 0 && r.bad.length === 0 && !log.errs.length, '추천: 20곳 모두 소개되고 꼬리표가 맞음', [...r.never, ...r.bad].slice(0, 3).join(' | ')); await p.context().close(); }

  /* 8) 글꼴 하나를 못 받아도 쇼릴과 트레일러가 멈추지 않는지 */
  { const ctx = await browser.newContext({ viewport: { width: 1100, height: 820 } }), p = await ctx.newPage();
    await p.route('**/black-han-sans-400.woff2', r => r.fulfill({ status: 404, body: '' })); await p.goto(base); await p.waitForTimeout(2500);
    const reelRuns = await p.evaluate(() => reel.on && reel.t0 > 0); await p.evaluate(() => { stopReel(); S.card = CARDS[1]; });
    await p.waitForTimeout(600); await p.evaluate(() => startTrailer(S.card)); await p.waitForTimeout(1500);
    ok(reelRuns && await p.evaluate(() => tr.on && tr.t0 > 0), '글꼴 하나가 실패해도 쇼릴·트레일러가 시작됨'); await ctx.close(); }

  /* 9) 원하는 연구회 보기: 목록에 20곳이 있고, 고르면 그 연구회의 트레일러와 입학 화면이 뜨는지 */
  { const { p, log } = await open({ viewport: { width: 1100, height: 820 } }); await toJourney(p);
    const closed = await p.evaluate(() => document.getElementById('pickList').hidden); await p.click('#pickBtn'); await p.waitForTimeout(700);
    const list = await p.evaluate(() => ({ n: document.querySelectorAll('.pick').length, names: [...document.querySelectorAll('.pick b')].every((e, i) => e.textContent === CARDS[i].group), wide: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
    await p.click('[data-pick="13"]'); await p.waitForTimeout(900);
    const got = await p.evaluate(() => ({ id: S.card && S.card.id, on: tr.on, script: tr.script === SCRIPTS[CARDS[12].group], title: document.querySelector('#stage h2')?.textContent }));
    ok(closed && list.n === 20 && list.names && list.wide <= 1 && got.id === 13 && got.on && got.script && got.title === await p.evaluate(() => CARDS[12].group) && !log.errs.length, '원하는 연구회 보기: 고른 연구회의 트레일러와 내용이 뜸', JSON.stringify({ list, got })); await p.context().close(); }

  await browser.close(); srv.close();
  console.log(fails.length ? `\n${fails.length}개 실패: ${fails.join(' / ')}` : '\n모두 통과');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
