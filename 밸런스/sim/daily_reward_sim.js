// 4개 게임 "일일 접속 보상 + 오늘의 임무" 30일 누적 시뮬레이션 (2026-10-27)
// 원본(읽기만): ../sim/src/<게임>/index.html (각 게임 index.html 복사본)
// 실행: node 밸런스/sim/daily_reward_sim.js
//
// [가정] 일일 임무는 카테고리마다 "날짜 문자열 해시"로 두세 변형 중 하나가 고정 선택된다
// (Math.random 아님). 매 날짜의 실제 선택은 시드에 따라 정해지지만, 이 스크립트는 "장기로
// 보면 각 변형이 균등하게 나온다"고 가정해 변형들의 평균값으로 기대 보상을 계산한다.
// 실제 누적치는 날짜 시드에 따라 이 평균과 달라질 수 있다(가정 명시).

function sum(arr) { return arr.reduce((a, b) => a + b, 0); }
function avg(arr) { return sum(arr) / arr.length; }
// 7일 주기 로그인 보상의 30일 누적(연속 접속 가정): 4주+2일
function cumulate30(weekArr) {
  const week = sum(weekArr);
  const extra = weekArr[0] + weekArr[1]; // 29,30일째 = 또 1,2일차
  return week * 4 + extra;
}

console.log('================ 1) 머니 디펜스 (Money-Defense) ================');
{
  // 원본: Money-Defense/index.html DAILY_LOGIN_GOLD(596줄대), DAILY_MISSION_POOL
  const LOGIN = [100, 140, 190, 250, 320, 400, 500];
  const MISSION_AVG = { kill: avg([80, 130]), round: avg([100, 150]), build: avg([90, 140]) };
  const loginMax = LOGIN[LOGIN.length - 1];
  const missionMaxSum = 130 + 150 + 140;
  const dayMax = loginMax + missionMaxSum;
  const CFG_startGold = 2100;
  const round10Income = Array.from({ length: 10 }, (_, i) => 5 + 2 * (i + 1)).reduce((a, b) => a + b, 0) * 20; // killGold(r)*20마리, 1~10라운드 합
  console.log(`하루 최대(로그인 ${loginMax}+미션 ${missionMaxSum}) = ${dayMax} 골드`);
  console.log(`  - 시작 골드(2,100) 대비 ${(dayMax / CFG_startGold * 100).toFixed(0)}%`);
  console.log(`  - 1~10라운드 처치 골드 총수입(추정 ${round10Income}) 대비 ${(dayMax / round10Income * 100).toFixed(0)}%`);
  const login30 = cumulate30(LOGIN);
  const missionDayAvg = MISSION_AVG.kill + MISSION_AVG.round + MISSION_AVG.build;
  const mission30 = missionDayAvg * 30;
  console.log(`30일 누적(연속 접속·미션 매일 완료 가정): 로그인 ${login30} + 미션(평균) ${mission30.toFixed(0)} = ${(login30+mission30).toFixed(0)} 골드`);
  console.log('  [중요] 이 골드는 "판 안에서만 쓰는 자원"이라 퇴직금(영구 재화)과 분리되어 있고(README 명시),');
  console.log('  📅 버튼이 게임 화면(#game) 안에만 있어 매 판 접속할 때 그 판의 G.gold로 직접 들어간다.');
  console.log('  미청구 보상(pendingGold)은 "다음 판 시작"에만 소비되므로, 정상적인 하루 1판 패턴에서는');
  console.log('  30일치가 그대로 쌓이지 않고 그날 판에 바로 쓰인다 — 30일 누적액은 "이론적 상한"일 뿐이다.');
}

console.log('\n================ 2) 슬라임 키우기 (SlimeGame) ================');
{
  // 원본: SlimeGame/index.html DAILY_LOGIN_REWARDS(1185줄), DAILY_MISSION_POOL(1199줄), soulMult(1266줄)
  const LOGIN = [
    { jelly: 50, soul: 0 }, { jelly: 80, soul: 0 }, { jelly: 120, soul: 1 }, { jelly: 170, soul: 0 },
    { jelly: 230, soul: 0 }, { jelly: 300, soul: 0 }, { jelly: 420, soul: 3 },
  ];
  const loginJellyWeek = sum(LOGIN.map(x => x.jelly));
  const loginSoulWeek = sum(LOGIN.map(x => x.soul));
  const login30Jelly = loginJellyWeek * 4 + LOGIN[0].jelly + LOGIN[1].jelly;
  const login30Soul = loginSoulWeek * 4 + LOGIN[0].soul + LOGIN[1].soul;

  const missDayJelly = avg([50, 90]) + avg([60, 110]) + avg([70, 100]); // kill+buy+floorboss(jelly부분)
  const missDaySoul = avg([0, 1]); // floorboss 변형 중 'boss'만 영혼 1
  const mission30Jelly = missDayJelly * 30;
  const mission30Soul = missDaySoul * 30;

  const totalJelly30 = login30Jelly + mission30Jelly;
  const totalSoul30 = login30Soul + mission30Soul;
  console.log(`30일 누적(연속 접속 가정): 젤리 ${totalJelly30.toFixed(0)}, 영혼 ${totalSoul30.toFixed(1)}개 (로그인 ${login30Soul}+미션 평균 ${mission30Soul.toFixed(1)})`);

  // soulMult = 1 + 0.10 * soulsTotal — 영혼을 "쓰든 안 쓰든" soulsTotal 자체가 전체 배율을 올린다.
  const soulMultDelta = 0.10 * totalSoul30;
  console.log(`  - soulMult(=1+0.10×soulsTotal)는 "쓰지 않고 쌓아만 둬도" 전체 배율을 올린다(index.html 1266줄).`);
  console.log(`  - 30일치 영혼 ${totalSoul30.toFixed(1)}개만으로 soulMult가 +${soulMultDelta.toFixed(2)} 커진다(예: 1.00배 → ${(1+soulMultDelta).toFixed(2)}배).`);
  console.log(`  - 비교: 환생 레벨 100 1회 보상이 영혼 20개(soulMult +2.0) — 한 번 제대로 키운 환생 1회의 절반 넘는 배율을 "로그인만 해도" 한 달 만에 얻는다.`);
  console.log(`  - 가장 싼 업그레이드 '젤리밭'(기본가 60) 대비 30일 젤리 누적(${totalJelly30.toFixed(0)})은 ${(totalJelly30/60).toFixed(0)}회를 바로 살 수 있는 양.`);

  // 로그인만(미션 제외, 순수 "접속만" 했을 때) 영혼 — 전투 없이 얻는 영혼
  console.log(`  - [분리] 전투 없이 "접속만" 했을 때도 30일에 영혼 ${login30Soul}개 → soulMult +${(0.10*login30Soul).toFixed(2)} (미션 없이 로그인만 클릭해도 발생).`);
}

console.log('\n================ 3) 넥서스 디펜스 (Nexus-Defense) ================');
{
  // 원본: Nexus-Defense/index.html DAILY_LOGIN_REWARDS(2037줄), coreReward(1961줄), dailyWaveReward(2062줄)
  const LOGIN = [30, 50, 80, 120, 170, 230, 320];
  const coreReward = cleared => Math.floor(10 * Math.pow(Math.max(0, cleared), 1.3));
  const login30 = cumulate30(LOGIN);
  const sortieAvg = avg([40, 70]);
  const actAvg = avg([60, 100]);
  // 웨이브 임무: 최고 웨이브의 50%/70%를 10단위 반올림, 보상은 coreReward(target)*0.15
  function waveMissionReward(best) {
    const fracs = [0.5, 0.7];
    const targets = fracs.map(f => Math.max(10, Math.round(best * f / 10) * 10));
    const rewards = targets.map(t => Math.max(20, Math.round(coreReward(t) * 0.15 / 10) * 10));
    return avg(rewards);
  }
  // 초반(최고 웨이브 0~30)과 중반(최고 웨이브 100) 두 구간으로 나눠 제시(가정: 30일 동안 최고 웨이브가 이 구간대라고 봄)
  const early = waveMissionReward(10);
  const mid = waveMissionReward(100);
  const missionDayEarly = sortieAvg + actAvg + early;
  const missionDayMid = sortieAvg + actAvg + mid;
  console.log(`하루 보상(평균): 로그인 1~7일차 평균 ${avg(LOGIN).toFixed(0)}, 미션 평균(초반 최고웨이브≈10) ${missionDayEarly.toFixed(0)}, (중반 최고웨이브≈100) ${missionDayMid.toFixed(0)}`);
  console.log(`30일 로그인 누적: ${login30} 코어`);
  console.log(`30일 미션 누적(초반 가정): ${(missionDayEarly*30).toFixed(0)} 코어 / (중반 가정): ${(missionDayMid*30).toFixed(0)} 코어`);
  console.log(`비교: 웨이브10 클리어 1판 보상 ${coreReward(10)}코어, 웨이브20 ${coreReward(20)}코어, 웨이브100 ${coreReward(100)}코어`);
  console.log(`  - 30일 전체 누적(로그인+미션, 초반가정) ${ (login30+missionDayEarly*30).toFixed(0) }코어 ≈ 웨이브${Math.round(Math.pow((login30+missionDayEarly*30)/10,1/1.3))} 클리어 1판과 비슷한 수준(역산, coreReward 공식 기준)`);
}

console.log('\n================ 4) 벽짓고 살아남기 (Wall-Defense) ================');
{
  // 원본: Wall-Defense/index.html DAILY_LOGIN_REWARDS(477줄), DAILY_MISSION_POOL(480줄), gameOver() 정수 공식(2417줄 부근)
  const LOGIN = [4, 5, 7, 9, 11, 14, 20];
  const login30 = cumulate30(LOGIN);
  // 미션 3종 각각 3단계 중 하나(날짜 시드) — 보상 6/8/10, 기대값은 평균 8
  const missionDayAvg = avg([6, 8, 10]) * 3;
  const mission30 = missionDayAvg * 30;
  // 판당 정수(README/코드 공식): floor(floor(wave*essence) + 5*bossKills + 3*objCleared + winBonus) * (1+mutBonus)
  // 보통 난이도(essence=1) 기준, balance-bot.js 실측 "보통 67웨이브"(보스 6~7회, 보너스목표 미측정→0 가정)
  const wave = 67, essenceMul = 1, bossKills = 6, objCleared = 0, winBonus = 0, mutBonus = 0;
  const perRun = Math.floor((Math.floor(wave * essenceMul) + 5 * bossKills + 3 * objCleared + winBonus) * (1 + mutBonus));
  console.log(`하루 최대(로그인 20 + 미션 평균 ${missionDayAvg.toFixed(1)}) ≈ ${(20+missionDayAvg).toFixed(1)} 정수`);
  console.log(`1판 보상(보통 난이도, 67웨이브, 보스6, 가정: 보너스목표0) ≈ ${perRun} 정수`);
  console.log(`  - 하루 평균(로그인+미션, 평균값)은 1판 보상의 약 ${(((avg(LOGIN))+missionDayAvg)/perRun*100).toFixed(0)}%`);
  console.log(`30일 누적: 로그인 ${login30} + 미션(평균) ${mission30.toFixed(0)} = ${(login30+mission30).toFixed(0)} 정수`);
  console.log(`  - 1판 보상(${perRun}) 기준 약 ${((login30+mission30)/perRun).toFixed(1)}판치 — PERKS(레벨 하나 20~30) 다수를 공짜로 채울 수 있는 양.`);
}
