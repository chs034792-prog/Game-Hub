# 머니 디펜스 — 영구 성장 재화 "퇴직금" 검증

- 검증일: 2026-10-27
- 검증자: `gamehub-qa-functional`
- 대상 파일: `GameHub/Money-Defense/index.html` (원본, git 커밋 전)
- 근거 문서: `GameHub/Money-Defense/README.md` ("일일 접속 보상·일일 임무", "밸런스" > "영구 강화(퇴직금) 밸런스 근거", "원작과 다른 점"), `GameHub/기획/2026-10-27_리텐션_분석.md`
- 방법: 브라우저 실행 없이 코드 정독 + Node.js로 핵심 수식·세이브 호환 로직을 똑같이 재현해 계산 대조. `node tools/sync.js --check`로 원본/사본 상태 확인.

## 결론: **전체 통과**

7개 확인 항목 모두 문제를 찾지 못했다. 코드의 수치(지급 공식, 7종 강화 비용표, 완료 판수 추정)는 README에 적힌 값과 **소수점까지 정확히 일치**한다. 아래는 확인한 항목과 근거.

## 확인한 항목

### 1. 문법 검사
`<script>` 내용(1개, 100,776자)을 추출해 `new Function(body)`로 검사 — 에러 없음.

### 2. 저장/불러오기 호환성 (옛 세이브)
`freshMeta()`/`Object.assign` 체인(617~645행)을 Node로 그대로 재현해 4가지 시나리오를 돌렸다.

| 시나리오 | 결과 |
|---|---|
| `meta` 필드 자체가 없는 아주 옛 세이브 | `meta:{points:0, perma:{전부 0}}`으로 정상 채워짐 |
| `daily`만 있고 `meta`는 없는 세이브(일일 보상만 있던 버전) | 동일하게 정상 채워짐, `daily`도 그대로 보존 |
| `meta.perma`에 일부 id(`gold`,`lumber`)만 있는 세이브 | 없는 id(`worker`·`income`·`upkeep`·`bounty`·`hero`)는 0으로 채워짐, 있는 값은 보존 |
| `points`만 있고 `perma` 없는 세이브 | `perma` 전부 0으로 채워짐 |

`permaLv = id => save.meta.perma[id] || 0`이 항상 숫자를 반환하므로(636행), `save.meta.perma[id]`가 `undefined`로 읽혀도 다운스트림(`permaBonusGold` 등)에서 `NaN`이 퍼지는 경로는 없다.

### 3. 중복 적용/누락 (D.worker.max)
- `BASE_WORKER_MAX`(409행)는 `D.worker`가 정의된 직후(405~407행, `max:6`)에 **딱 한 번** 캡처되는 `const`라, 이후 `syncPermaStatic()`을 몇 번을 호출해도 "기준값 6"이 바뀌지 않는다.
- `syncPermaStatic() { D.worker.max = BASE_WORKER_MAX + permaLv('worker'); }`(644행)는 매번 "기준값 + 지금 레벨"로 **다시 계산**해 덮어쓰므로, 호출을 반복해도(세이브 로드 직후 645행, `newGame()` 754행, `buyPerma()` 1771행) 누적되지 않는다. `D.worker.max`를 건드리는 다른 코드 경로는 없음(검색 확인).
- 레벨 0(강화를 전혀 안 산 상태)에서 `D.worker.max = 6 + 0 = 6`으로 원작 그대로. `permaBonusGold()`·`permaBonusLumber()`도 0, `permaIncomeMul()`·`permaBountyMul()`도 1(곱해도 변화 없음), `permaHeroDiscount()`도 0(`permaHeroCost`가 원본 `c`를 그대로 반환)이라 **레벨 0은 기존 동작과 100% 동일**함을 코드로 확인했다.

### 4. `buyPerma` 부족/최대 레벨 방어
```
function buyPerma(id) {
  const p = PERMAM[id]; if (!p) return;
  const lv = permaLv(id); if (lv >= p.max) return;
  const cost = p.cost(lv); if (save.meta.points < cost) return;
  save.meta.points -= cost;
  save.meta.perma[id] = lv + 1;
  syncPermaStatic(); persist(); renderShop(); refreshMenu();
}
```
최대 레벨·포인트 부족을 함수 안에서 직접 재확인하므로, UI의 `disabled` 속성과 무관하게 음수 포인트나 최대 레벨 초과로 가는 경로가 없다. 이중 클릭이 같은 틱에서 두 번 실행돼도(동기 실행이라 실질적으로 불가능하지만) 두 번째 호출 시점의 `save.meta.points`·레벨은 첫 번째 호출이 끝난 뒤 값이라 안전하다.

### 5. `finish()` 중복/1회 지급
`finish()`는 `if (G.over) return;`으로 막혀 있고, `G.over = true`를 그 다음 줄에서 설정한다. `finish()`를 부르는 곳은 `quitBtn.onclick`(1923행) 단 한 곳뿐이라, 퇴직금(`calcPermaReward` → `save.meta.points +=`)은 한 판에 정확히 1회만 지급된다.

### 6. README 밸런스 수치 대조 (코드 수식으로 직접 계산)
- **지급 공식**: `calcPermaReward(g) = round((round×4 + floor(kills/25) + bossKills×15) × diff.hp)`를 README 예시 4개(하수60/중수44/하드코어30/중수10라운드 조기이탈)에 그대로 대입 → **265 / 271 / 491 / 63**, README 표와 **완전히 일치**.
- **강화 7종 비용표**: `cost(l)=round(base×growth^l)`를 `l=0`부터 `max-1`까지 합산(Node 스크립트로 재현) → gold 908 · lumber 681 · worker 748 · income 1,725 · upkeep 377 · bounty 494 · hero 393, **합계 5,326** — README "최대까지 총비용" 열·총합과 **완전히 일치**.
- **완료 판수 추정**: 5,326 ÷ 271(중수 완주) ≈ 19.65 → "약 20판", 5,326 ÷ 491(하드코어 완주) ≈ 10.85 → "약 11판", income 1,725÷271≈6.37→"약 6.4판", hero 393÷271≈1.45→"약 1.5판" — 모두 README 서술과 일치.
- `CFG.startGold`(2,100)·`CFG.startLumber`(100)·`DAILY_LOGIN_GOLD`([100,140,190,250,320,400,500])·`CFG.killGold(r)=5+2r`도 README 수치와 일치.

### 7. 모바일(375px) CSS 구조 검토
- `#shopBox`: 기본 `width:92vw;max-width:540px`, `@media (max-width:900px)`에서 `width:94vw;padding:16px 14px`로 조정. `.ovbox`의 `min-width:330px`보다 94vw(375px 기준 ≈352px)가 더 크므로 min-width에 걸려 넘치는 일은 없다.
- `.permarow{display:flex;flex-wrap:wrap}` + 모바일 override `.pr-info{flex-basis:calc(100% - 38px)}`, `button.buy{flex-basis:100%;margin-top:4px}` — 아이콘(28px)+정보가 1행, 구매 버튼이 줄바꿈되어 2행이 되는 구조라 가로로 넘칠 요소가 없다. `pr-name`·`pr-desc`에 `white-space:nowrap`이 없어 텍스트가 길어져도 줄바꿈되지(가로 스크롤이 생기지) 않는다.
- `#dailyOv`(z-index:8, 게임 화면 전용)와 `#shopOv`(z-index:10, 메인 화면 전용 `.overlay`)는 서로 다른 `.screen`에 있어 겹칠 일이 없다.
- 결론: 코드상 레이아웃 규칙만으로는 375px에서 가로로 넘칠 구조적 결함을 찾지 못했다. 다만 이것은 CSS 규칙 검토이며 **실제 렌더링 확인은 못 했다** — 브라우저·해상도 실측은 `gamehub-qa-compat` 담당 범위.

## 참고 (버그는 아니지만 확인/공유할 사항)

- `node tools/sync.js --check` 결과 "머니 디펜스 — 원본이 다르다(사본 124,662 → 원본 133,746바이트)"로 나온다. 이는 결함이 아니라 **작업 순서상 당연한 상태**다(`GameHub/CLAUDE.md`: 원본 수정 → 원본 커밋 → `sync.js` → 허브 커밋). 프로그래밍팀이 원본을 커밋하고 `node tools/sync.js`로 사본을 맞춘 뒤 허브 쪽 저장 키(`moneydefense.v4`)가 그대로 읽히는지도 마지막에 한 번 더 확인하면 좋다.
- README "밸런스" 절이 스스로 적어 둔 대로, 이번 작업에서는 자동 플레이 봇을 영구 강화 적용 상태로 재실행하지 못했다(저장소에 봇 스크립트가 없음) — 지급 공식·비용표의 **수식 정합성**은 이 리포트에서 확인했지만, 영구 강화를 전부 산 상태에서 실제로 하드코어 도달 라운드 격차가 얼마나 줄어드는지는 **확인 필요**(사람 플레이 또는 봇 스크립트 추가가 있어야 측정 가능).
- `계산.round`가 "라운드를 완전히 끝까지 정리한 횟수"가 아니라 "마지막으로 시작된 라운드 번호"이므로, 라운드 중간에 '게임 끝내기'를 눌러도 그 진행 중인 라운드 번호가 그대로 보상에 들어간다. README도 동일한 전제(도달 라운드)로 서술하고 있어 기획 의도와 다르지 않다고 판단했다.

## 작성한 파일

- `GameHub/QA/2026-10-27_money-defense_퇴직금(영구강화) 검증.md` (이 파일)

## 승인·확인이 필요한 항목

- 없음(치명/보통/경미 버그 모두 발견되지 않음). 다음 단계(원본 git 커밋 → `tools/sync.js` → 허브 커밋)로 진행해도 된다고 판단한다.
- 참고 사항 2가지(sync 미반영 상태, 영구 강화 적용 후 실측 도달 라운드 미측정)는 버그 리포트가 아니라 **다음 작업 전 체크리스트**로 남긴다.
