// 머니 디펜스 영구 성장 '퇴직금' 시뮬레이션 (2026-10-27)
// 원본(읽기만): ../sim/src/Money-Defense/index.html (Money-Defense/index.html 복사본)
//   - PERMA_UPS 테이블: 원본 357~365줄
//   - calcPermaReward 공식: 원본 369~372줄
//   - 봇 측정 도달 라운드(하수60·중수44·하드코어30, 처치수·보스처치는 README "밸런스" 절 수치): README 283~291줄
// 이 스크립트는 원본 파일을 바꾸지 않고, 그 안의 상수를 그대로 복사해 계산만 한다.
// 실행: node 밸런스/sim/money_defense_perma_sim.js

// ---- 원본에서 그대로 옮긴 상수 (Money-Defense/index.html) ----
const PERMA_UPS = [
  { id: 'gold',   name: '퇴사 전 가불',     max: 10, per: 150,  cost: l => Math.round(8  * Math.pow(1.5,  l)) },
  { id: 'lumber', name: '자재 리베이트',    max: 10, per: 30,   cost: l => Math.round(6  * Math.pow(1.5,  l)) },
  { id: 'worker', name: '용역업체 인맥',    max: 4,  per: 1,    cost: l => Math.round(40 * Math.pow(2.2,  l)) },
  { id: 'income', name: '전관예우',         max: 10, per: .03,  cost: l => Math.round(12 * Math.pow(1.55, l)) },
  { id: 'upkeep', name: '노조 뒷돈',        max: 5,  per: 8,    cost: l => Math.round(20 * Math.pow(1.7,  l)) },
  { id: 'bounty', name: '경조사비',         max: 8,  per: .05,  cost: l => Math.round(10 * Math.pow(1.5,  l)) },
  { id: 'hero',   name: '스카우트 리베이트', max: 6,  per: .04,  cost: l => Math.round(15 * Math.pow(1.6,  l)) },
];
const START_GOLD = 2100, START_LUMBER = 100, BASE_WORKER_MAX = 6;

// calcPermaReward(g) = round((round*4 + floor(kills/25) + bossKills*15) * diffHp)
function calcPermaReward(round, kills, bossKills, diffHp) {
  const base = round * 4 + Math.floor(kills / 25) + bossKills * 15;
  return Math.max(0, Math.round(base * diffHp));
}

// 자동 플레이 봇으로 실측한 도달 라운드(README "밸런스" 절). 고수·초고수는 실측 없음(확인 필요).
// 라운드당 몹 20마리(CFG.count), 보스는 10라운드마다 1회로 가정(README와 동일한 가정).
const BOT_RUNS = {
  easy:     { name: '하수',     round: 60, diffHp: 0.7 },
  normal:   { name: '중수',     round: 44, diffHp: 1.0 },
  hardcore: { name: '하드코어', round: 30, diffHp: 2.6 },
};
for (const k of Object.keys(BOT_RUNS)) {
  const r = BOT_RUNS[k];
  r.kills = r.round * 20;
  r.bossKills = Math.floor(r.round / 10);
  r.perGame = calcPermaReward(r.round, r.kills, r.bossKills, r.diffHp);
}

console.log('=== 판당 퇴직금 지급량 (봇 실측 도달 라운드 기준) ===');
for (const k of Object.keys(BOT_RUNS)) {
  const r = BOT_RUNS[k];
  console.log(`${r.name}: 도달${r.round}R, 처치${r.kills}, 보스${r.bossKills} → 퇴직금 ${r.perGame}/판`);
}

// ---- 그리디 구매 시뮬레이션: 포인트가 생길 때마다 "다음 레벨 비용이 가장 싼" 강화를 산다 ----
function simulate(points) {
  const lv = Object.fromEntries(PERMA_UPS.map(p => [p.id, 0]));
  let remain = points;
  while (true) {
    let best = null, bestCost = Infinity;
    for (const p of PERMA_UPS) {
      if (lv[p.id] >= p.max) continue;
      const c = p.cost(lv[p.id]);
      if (c < bestCost) { bestCost = c; best = p; }
    }
    if (!best || bestCost > remain) break;
    remain -= bestCost;
    lv[best.id] += 1;
  }
  return { lv, remain };
}

function deriveStats(lv) {
  return {
    시작골드: START_GOLD + lv.gold * PERMA_UPS[0].per,
    시작목재: START_LUMBER + lv.lumber * PERMA_UPS[1].per,
    노동자최대: BASE_WORKER_MAX + lv.worker * PERMA_UPS[2].per,
    수입배율: +(1 + lv.income * PERMA_UPS[3].per).toFixed(3),
    유지비구간상한: 50 + lv.upkeep * PERMA_UPS[4].per,
    처치골드배율: +(1 + lv.bounty * PERMA_UPS[5].per).toFixed(3),
    영웅비용할인: +(lv.hero * PERMA_UPS[6].per).toFixed(3),
  };
}

const CHECKPOINTS = [5, 10, 20, 50];
console.log('\n=== 난이도별 N판 뒤 누적 퇴직금 → 강화 레벨 → 파생 수치 (그리디 구매, 쌈 강화부터) ===');
for (const k of Object.keys(BOT_RUNS)) {
  const r = BOT_RUNS[k];
  console.log(`\n--- ${r.name} (판당 ${r.perGame} 퇴직금) ---`);
  for (const n of CHECKPOINTS) {
    const pts = r.perGame * n;
    const { lv, remain } = simulate(pts);
    const stats = deriveStats(lv);
    console.log(`${n}판(누적${pts}): 레벨[${PERMA_UPS.map(p=>p.id+':'+lv[p.id]+'/'+p.max).join(' ')}] 남는돈${remain}`);
    console.log(`   → 시작골드 ${stats.시작골드}(기본${START_GOLD}의 ${(stats.시작골드/START_GOLD*100).toFixed(0)}%), 시작목재 ${stats.시작목재}, 노동자 ${stats.노동자최대}명, 수입×${stats.수입배율}, 유지비없음구간 0~${stats.유지비구간상한}, 처치골드×${stats.처치골드배율}, 영웅비용 -${(stats.영웅비용할인*100).toFixed(0)}%`);
  }
}

// 7종 전부 최대 레벨 총비용과, 그걸 채우는 데 필요한 판 수(README 값 검증)
const TOTAL_MAX_COST = PERMA_UPS.reduce((s, p) => {
  let c = 0; for (let l = 0; l < p.max; l++) c += p.cost(l); return s + c;
}, 0);
console.log(`\n=== 7종 전부 최대 레벨 총비용: ${TOTAL_MAX_COST} 퇴직금 (README 5,326과 비교) ===`);
for (const k of Object.keys(BOT_RUNS)) {
  const r = BOT_RUNS[k];
  console.log(`${r.name}: ${Math.ceil(TOTAL_MAX_COST / r.perGame)}판 (README: 중수 약20판·하드코어 약11판과 비교)`);
}

// ---- [가정] 경제 배율 → 추가 생존 라운드 환산 ----
// Money-Defense에는 자동 플레이 봇 스크립트가 커밋돼 있지 않아(README 248~251줄) 실제 재플레이로
// "강화를 적용하면 몇 라운드 더 버티는지"를 직접 측정할 수 없다. 아래는 단순화한 가정 모델이다:
//   - 몹 체력은 10라운드까지 ×1.3, 그 뒤로는 ×1.12씩 늘어난다(README "밸런스" 절). 후반 생존을
//     좌우하는 구간은 10라운드 이후이므로 g=1.12를 쓴다.
//   - 플레이어의 화력은 "모은 돈"에 비례한다고 가정하고, 영구 강화가 주는 경제 배율을
//     M = (1+수입%)×(1+처치골드%) 로 근사한다(시작 골드·목재는 초반 1회성 효과라 장기 라운드에는
//     비중을 작게 둬 제외했다 — 그만큼 아래 ΔR 은 "과소추정"에 가깝다).
//   - 경제가 M배가 되면, 매 라운드 g배씩 세지는 몹을 상대로 ΔR ≈ ln(M)/ln(g) 라운드를 더 버틴다고 본다
//     (화력이 M배면 g^ΔR = M을 만족하는 라운드만큼 "시간을 번다"는 아주 단순한 지수 모델).
// 이 값은 추측(가정)이며, 실제 확인은 QA 팀의 자동 플레이 봇 측정이 필요하다(README도 동일하게 권고).
console.log('\n=== [가정] 영구 강화 완료 시 경제 배율 → 추가 생존 라운드 (단순 지수 모델, 낮은 신뢰도) ===');
const g = 1.12;
for (const k of Object.keys(BOT_RUNS)) {
  const r = BOT_RUNS[k];
  for (const n of CHECKPOINTS) {
    const pts = r.perGame * n;
    const { lv } = simulate(pts);
    const stats = deriveStats(lv);
    const M = stats.수입배율 * stats.처치골드배율;
    const deltaR = Math.log(M) / Math.log(g);
    console.log(`${r.name} ${n}판: 경제배율 M=${M.toFixed(3)} → [가정] 약 +${deltaR.toFixed(1)}라운드`);
  }
}
