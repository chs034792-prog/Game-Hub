// "용병단 키우기" (가칭, 방치형 파티 RPG) 1차 수치 설계 — 근거 시뮬레이션
// 대상 문서: 밸런스/2026-11-02_용병단키우기_1차수치설계.md
// 기획 근거: GameHub/기획/2026-11-02_방치형RPG_기획안.md (용병 6종/희귀도3단계, 5구역x4스테이지=20개, 보스5체,
//           소환 포함·재화만, 중복→강화재료, 파티3인, 무기1슬롯, 오프라인8h·일일임무3개·7일출석)
// 주의: 이 게임은 아직 코드가 없는 신규 기획이라 "원본 복사"가 아니라, 밸런스팀이 1차로 제안하는 수식을
//      그대로 node 코드로 옮겨 계산한 것이다. 구현팀(gamehub-dev-gameplay)이 바로 코드에 넣을 수 있게
//      공식·상수를 그대로 쓴다. [가정] 표시는 기획안에 수치가 없어 밸런스팀이 설계한 부분이다.
// 실행: node 밸런스/sim/idlerpg_v1_sim.js

function round1(x) { return Math.round(x * 10) / 10; }

// ============================================================
// 1) 용병 6종 — 역할별 기본 스탯(Lv1·일반) + 희귀도 배율 + 레벨 성장
// ============================================================
const ROLES = {
  warrior: { name: '전사', atk: 12, def: 10, hp: 130 },
  archer:  { name: '궁수', atk: 15, def: 5,  hp: 95  },
  mage:    { name: '법사', atk: 19, def: 3,  hp: 80  },
  healer:  { name: '힐러', atk: 8,  def: 7,  hp: 115, healPerAtk: 1.0 }, // 턴당 회복량 = atk(최종) x 1.0
  rogue:   { name: '도적', atk: 14, def: 5,  hp: 90,  critChance: 0.15, critMult: 1.5 },
  tank:    { name: '탱커', atk: 6,  def: 16, hp: 170, dmgReduce: 0.10 },
};

const RARITY_MULT = { common: 1.0, rare: 1.5, epic: 2.3 }; // 일반/희귀/영웅
const LEVEL_GROWTH_RATE = 0.07; // 레벨당 +7%, 선형(스탯 폭주 방지)
const LEVEL_CAP = 60;

function levelFactor(lv) { return 1 + LEVEL_GROWTH_RATE * (lv - 1); }
function mercStat(role, rarity, lv, statKey) {
  return ROLES[role][statKey] * RARITY_MULT[rarity] * levelFactor(lv);
}

console.log('================ 1) 용병 6종 — 레벨별 ATK 샘플 (일반 등급) ================');
const SAMPLE_LVS = [1, 10, 20, 30, 40, 50, 60];
for (const key of Object.keys(ROLES)) {
  const r = ROLES[key];
  const line = SAMPLE_LVS.map(lv => round1(mercStat(key, 'common', lv, 'atk'))).join(' / ');
  console.log(`${r.name.padEnd(4, ' ')} ATK(일반, Lv1/10/20/30/40/50/60) = ${line}`);
}
console.log('\n희귀도 배율: 일반x1.0 / 희귀x1.5 / 영웅x2.3 (전사 Lv60 ATK 예시: ' +
  `일반 ${round1(mercStat('warrior','common',60,'atk'))} / 희귀 ${round1(mercStat('warrior','rare',60,'atk'))} / 영웅 ${round1(mercStat('warrior','epic',60,'atk'))})`);

// ============================================================
// 2) 몬스터 스탯 곡선 — 20스테이지(5구역x4) + 보스5체
// ============================================================
// [가정] 파티 구성: 탱커+궁수(주딜)+힐러 (가장 안정적인 표준 조합이라고 가정)
// [가정] 진행 페이스: 스테이지 n 클리어 시점 평균 용병 레벨 L(n)=min(60, round(3n)),
//        평균 희귀도 배율은 가챠로 서서히 올라 1.0(1스테이지)→1.8(20스테이지)로 선형 보간,
//        무기 레벨 W(n)=min(50, round(2.5n)) — 모두 "1차 설계용 진행 가정"이며 실제 QA 자동전투
//        실측으로 재조정이 필요하다.
const WEAPON_LEVEL_CAP = 50;
function weaponAtkBonus(w) { return 4 * w; } // 레벨당 +4 ATK(단순 선형)
function weaponUpgradeCost(w) { return Math.round(50 * Math.pow(1.13, w - 1)); } // w-1 -> w 비용(골드)

function paceLevel(n) { return Math.min(LEVEL_CAP, Math.round(3 * n)); }
function paceRarityMult(n) { return 1.0 + (1.8 - 1.0) * (n - 1) / 19; }
function paceWeaponLv(n) { return Math.min(WEAPON_LEVEL_CAP, Math.round(2.5 * n)); }

function partyAtk(n) {
  const lv = paceLevel(n);
  const rarityMix = paceRarityMult(n);
  const baseSum = ROLES.tank.atk + ROLES.archer.atk + ROLES.healer.atk; // 6+15+8=29
  const lvAtk = baseSum * levelFactor(lv) * rarityMix;
  const weaponAtk = weaponAtkBonus(paceWeaponLv(n));
  return lvAtk + weaponAtk;
}

// 몬스터 HP/ATK 곡선 — growth율은 "플레이어 파티 ATK 성장률"에 맞춰 역산(끝단 TTK가 처음과 비슷하게)
const BASE_HP = 150, BASE_ATK = 8;
const atk1 = partyAtk(1), atk20 = partyAtk(20);
const playerGrowthFactor = atk20 / atk1;
const G_HP = Math.pow(playerGrowthFactor, 1 / 19); // 스테이지당 HP 배율
const G_ATK = Math.pow(playerGrowthFactor, 1 / 19) * 0.9; // 몬스터 공격력은 조금 더 느리게(생존 여유)

function monsterHp(n) { return BASE_HP * Math.pow(G_HP, n - 1); }
function monsterAtk(n) { return BASE_ATK * Math.pow(G_ATK, n - 1); }

const BOSS_HP_MULT = 3.5, BOSS_ATK_MULT = 1.8;
function bossHp(zoneLastStage) { return monsterHp(zoneLastStage) * BOSS_HP_MULT; }
function bossAtk(zoneLastStage) { return monsterAtk(zoneLastStage) * BOSS_ATK_MULT; }

console.log('\n================ 2) 몬스터 스탯 곡선 (20스테이지 + 보스5체) ================');
console.log(`파티 ATK 성장(1->20스테이지 페이스 가정): ${round1(atk1)} -> ${round1(atk20)} (x${round1(playerGrowthFactor)})`);
console.log(`=> 몬스터 HP 스테이지당 성장률 G_HP=${round1(G_HP)} (예: x${round1(G_HP)}배/스테이지), ATK 성장률 G_ATK=${round1(G_ATK)}`);
console.log('스테이지 | 구역 | 몬스터HP | 몬스터ATK | 파티ATK(페이스) | TTK(타수=HP/ATK) | 스쿼시멤버 생존타수');
for (let n = 1; n <= 20; n++) {
  const zone = Math.ceil(n / 4);
  const hp = monsterHp(n), atk = monsterAtk(n);
  const pAtk = partyAtk(n);
  const ttk = hp / pAtk;
  // 스쿼시(가장 약한 DEF) 멤버 = 궁수(DEF5), 데미지 완화 공식: dmg = atk*100/(100+DEF*rarity*lvfactor)
  const squishyDef = mercStat('archer', 'common', paceLevel(n), 'def') * paceRarityMult(n);
  const squishyHp = mercStat('archer', 'common', paceLevel(n), 'hp') * paceRarityMult(n);
  const dmgTaken = atk * 100 / (100 + squishyDef);
  const hitsToKillSquishy = squishyHp / dmgTaken;
  console.log(`${String(n).padStart(2)} | ${zone} | ${round1(hp).toString().padStart(7)} | ${round1(atk).toString().padStart(6)} | ${round1(pAtk).toString().padStart(6)} | ${round1(ttk).toString().padStart(5)} | ${round1(hitsToKillSquishy)}`);
  if (n % 4 === 0) {
    const bHp = bossHp(n), bAtk2 = bossAtk(n);
    const bTtk = bHp / pAtk;
    const bDmg = bAtk2 * 100 / (100 + squishyDef);
    const bHits = squishyHp / bDmg;
    console.log(`   [구역${zone} 보스] HP=${round1(bHp)} ATK=${round1(bAtk2)} TTK=${round1(bTtk)}(일반스테이지의 x${round1(bTtk/ttk)}) 생존타수=${round1(bHits)}`);
  }
}

// ============================================================
// 3) 무기 강화 레벨별 비용·효과 곡선
// ============================================================
console.log('\n================ 3) 무기 강화 (레벨cap 50) ================');
const milestones = [1, 5, 10, 20, 30, 40, 50];
for (const w of milestones) {
  let c = 0;
  for (let i = 1; i <= w; i++) c += weaponUpgradeCost(i);
  console.log(`Lv${w}: 1회비용(해당레벨)=${weaponUpgradeCost(w)}골드, ATK보너스=+${weaponAtkBonus(w)}, 1~${w}레벨 누적비용=${c}골드`);
}
let totalCost = 0;
for (let i = 1; i <= WEAPON_LEVEL_CAP; i++) totalCost += weaponUpgradeCost(i);
console.log(`최대(Lv50)까지 총 누적 골드: ${totalCost}`);

// ============================================================
// 4) 소환 확률 + 중복 환전 + 소환 비용(용병표 소비처)
// ============================================================
console.log('\n================ 4) 소환(가챠) 확률 및 비용 ================');
const GACHA = { common: 0.70, rare: 0.24, epic: 0.06 };
console.log(`등급별 등장률: 일반 ${GACHA.common*100}% / 희귀 ${GACHA.rare*100}% / 영웅 ${GACHA.epic*100}%`);
function probAtLeastOneEpicIn(pulls) { return 1 - Math.pow(1 - GACHA.epic, pulls); }
[5, 10, 20, 30, 50].forEach(p => {
  console.log(`  ${p}회 소환 내 영웅 1체 이상 등장 확률: ${round1(probAtLeastOneEpicIn(p) * 100)}%`);
});
const evPullsToFirstEpic = 1 / GACHA.epic;
console.log(`영웅 1체 기대 소환 횟수(기하분포 평균): ${round1(evPullsToFirstEpic)}회`);
console.log('중복 환전(강화재료): 일반중복=10개 / 희귀중복=30개 / 영웅중복=100개 (등급 배율과 동일하게 1:3:10 비례)');

const TICKET_PER_PULL = 10;
const TICKET_PER_10PULL = 90; // 10연속 10% 할인
console.log(`소환 비용: 1회 ${TICKET_PER_PULL}용병표 / 10연속 ${TICKET_PER_10PULL}용병표(10% 할인)`);

// ============================================================
// 5) 골드/용병표 획득 대비 소비
// ============================================================
console.log('\n================ 5) 경제(획득 대비 소비) ================');
function goldRewardPerClear(n) { return Math.round(30 * Math.pow(1.20, n - 1)); } // 스테이지 클리어(파밍) 보상
console.log('스테이지 | 클리어 보상(골드, 반복파밍 기준)');
[1, 4, 8, 12, 16, 20].forEach(n => console.log(`  ${n}: ${goldRewardPerClear(n)}`));

// 레벨업 골드 비용(용병 1인, 1레벨당) — [가정] 간단화: cost(lv) = 8 * lv (레벨이 오를수록 비용도 커짐)
function mercLevelUpCost(lv) { return 8 * lv; }
let mercTotalCost = 0;
for (let lv = 2; lv <= LEVEL_CAP; lv++) mercTotalCost += mercLevelUpCost(lv);
console.log(`용병 1인을 Lv1->60까지 올리는 총 골드: ${mercTotalCost} (파티 3인이면 x3 = ${mercTotalCost * 3})`);
console.log(`무기(총 ${totalCost}골드) + 용병3인 레벨(${mercTotalCost * 3}골드) = 총 ${totalCost + mercTotalCost * 3}골드 (완전 맥스 목표)`);

// 스테이지/보스 최초 클리어 1회성 용병표 보너스 — [가정]
const FIRST_CLEAR_TICKET_NORMAL = 3; // 일반 스테이지 최초클리어
const FIRST_CLEAR_TICKET_BOSS = 20;  // 보스 최초클리어
const firstClearTicketTotal = FIRST_CLEAR_TICKET_NORMAL * 20 + FIRST_CLEAR_TICKET_BOSS * 5;
console.log(`\n최초 클리어 1회성 용병표: 일반스테이지 ${FIRST_CLEAR_TICKET_NORMAL}x20=${FIRST_CLEAR_TICKET_NORMAL*20} + 보스 ${FIRST_CLEAR_TICKET_BOSS}x5=${FIRST_CLEAR_TICKET_BOSS*5} = 총 ${firstClearTicketTotal}`);

// 일일임무/출석 — [가정] 제안값
const DAILY_MISSION_GOLD = [40, 60, 80]; // 3개 임무 보상(골드)
const DAILY_MISSION_TICKET = [0, 1, 2]; // 3개 임무 중 일부는 용병표도 지급
const WEEKLY_LOGIN_TICKET = [1, 1, 2, 1, 2, 3, 5]; // 7일 출석 용병표(점점 커짐, 7일차 대박)
const dailyMissionTicketSum = DAILY_MISSION_TICKET.reduce((a,b)=>a+b,0);
const weeklyLoginTicketSum = WEEKLY_LOGIN_TICKET.reduce((a,b)=>a+b,0);
console.log(`일일임무 3개 합계: 골드 ${DAILY_MISSION_GOLD.reduce((a,b)=>a+b,0)} + 용병표 ${dailyMissionTicketSum}`);
console.log(`7일 출석 용병표 합계: ${weeklyLoginTicketSum}`);

// 오프라인 보상: 분당 골드 생산의 일부를 최대 8시간까지, [가정] 전투 중 분당 골드생산의 50%로 캡
const offlineGoldPerMin = (n) => goldRewardPerClear(n) / 3 * 0.5; // 스테이지 n 반복 클리어가 3분 걸린다 가정, 그 50%
console.log(`오프라인(8시간=480분) 보상 예시 — 스테이지10 기준: ${round1(offlineGoldPerMin(10) * 480)}골드`);

// 1주차(신규 유저) 용병표 획득 총량 및 가능한 소환 횟수 — 실제로 "초반 영웅 체감"이 맞는지 검증
const week1TicketIncome = firstClearTicketTotal + dailyMissionTicketSum * 7 + weeklyLoginTicketSum;
const week1Pulls = Math.floor(week1TicketIncome / TICKET_PER_PULL);
console.log(`\n[1주차 검증] 용병표 획득 총량(최초클리어 전부+일일임무7일+7일출석) = ${week1TicketIncome}`);
console.log(`  => ${TICKET_PER_PULL}표/회 기준 약 ${week1Pulls}회 소환 가능`);
console.log(`  => ${week1Pulls}회 소환 시 영웅 1체 이상 등장 확률 ${round1(probAtLeastOneEpicIn(week1Pulls) * 100)}%`);

console.log('\n(세부 수치는 밸런스/2026-11-02_용병단키우기_1차수치설계.md 표 참고)');
