# 넥서스 디펜스 — "첫 판 안내 가이드"(튜토리얼) 검증

- 검증일: 2026-10-27
- 검증자: `gamehub-qa-functional`
- 대상 파일: `GameHub/Nexus-Defense/index.html` (원본, 커밋 `b468c1b`), 사본 `GameHub/games/nexus.html` (허브 커밋 `f85693a`)
- 근거: dev 보고 내용(아래 "구현 요약")과 `Nexus-Defense/README.md` "첫 판 안내" 절. 기획서·교육자료는 팀장 확인을 신뢰하고 재검토하지 않음.
- 방법: 브라우저 실행 없이 코드 정독 + `new Function()` 문법 검사 + `node tools/sync.js --check` + Node로 `loadSave()`의 신규/기존 판정 로직을 그대로 재현해 5가지 세이브 시나리오 실행.

## 결론: **조건부 통과 — 경미한 로직 결함 1건 발견 (되돌릴지 팀장 판단 필요)**

문법·동기화·단계 순서·건너뛰기·다시보기·id 충돌·README 반영은 모두 문제 없음. 다만 **백업 코드(importSave)로 복원한 경우의 신규 판정이 코드 자체 주석이 말하는 의도와 다르게 동작**하는 로직 결함을 찾았다(아래 3-5). 치명적 버그(크래시·세이브 손상)는 아니라 "전체 실패"로는 보지 않았지만, 실제로 겪을 수 있는 시나리오라 팀장 보고가 필요하다고 판단했다.

## 확인한 항목

### 1. 문법 검사 — 통과
`Nexus-Defense/index.html`, `games/nexus.html` 두 파일 모두 `<script>` 1개(289,352자)를 추출해 `new Function(body)`로 파싱 — 에러 없음.

### 2. 원본↔사본 일치 — 통과
`node tools/sync.js --check` 결과 "넥서스 디펜스 — 그대로" (다른 게임 0개). `diff -q`로도 두 파일이 바이트 단위로 동일함을 확인.

### 3. 신규/기존 판정 로직 — **4/5 정상, 1건 결함 발견**

`loadSave()`(2186~2226행)의 분기를 Node로 그대로 재현해 실행:

| 시나리오 | 입력 | 결과 `save.tutorial` | 판정 |
|---|---|---|---|
| 완전 신규(키 없음) | `localStorage.getItem(SAVE_KEY) === null` | `{step:0, done:false}` | 기대대로 안내 시작 |
| 기존 플레이어 | `{runs:5, best:120, cores:300}` (tutorial 필드 없음) | `{step:7, done:true}` | 기대대로 자동 비노출 |
| 아주 오래된 세이브(마이그레이션 전) | `{cores:50}` (runs/best/tutorial 모두 없음) | `{step:7, done:true}` | 키 자체가 있으므로(`rawBeforeLoad !== null`) 깨지지 않고 "기존"으로 처리됨 — 정상 |
| `runs:0, best:0`이지만 저장 키는 존재 | `{runs:0, best:0, cores:0}` | `{step:7, done:true}` | `rawBeforeLoad !== null`이라 신규로 오판하지 않음 — 정상 |
| **백업 코드로 베테랑 세이브를 "새 브라우저"에 복원** | 새 브라우저(키 없음) → `loadSave()` 먼저 실행 → 그 뒤 `importSave()`로 `runs:120, best:340` 복원 | `loadSave()` 직후 이미 `{step:0, done:false}`로 확정. `importSave()`(2266~2310행)는 `save.tutorial`을 전혀 건드리지 않으므로 복원 후에도 `{step:0, done:false}`가 그대로 남음 → `writeSave()`로 영구 저장됨 | **결함** |

**재현 방법**
1. `localStorage.removeItem('nexusdefense.save')` 등으로 해당 브라우저에 세이브가 전혀 없는 상태를 만든다(또는 새 브라우저·새 기기).
2. 페이지를 새로 열면 `loadSave()`(7550행에서 1회 호출)가 돌면서 `rawBeforeLoad === null`이라 `save.tutorial = {step:0, done:false}`로 확정된다.
3. 메인 화면의 "코드 관리"(`btnBackup`)를 열어, `runs:120, best:340`처럼 많이 플레이한 기존 백업 코드를 붙여넣어 불러온다(`importSave`, 6995행 또는 7319행에서 호출).
4. `importSave()`는 `runs`·`best`·`meta`·`cores` 등은 복원하지만 `save.tutorial` 필드는 다루지 않는다(2266~2310행에 해당 코드 없음) → 2단계에서 이미 정해진 `{step:0, done:false}`가 그대로 유지된 채 `writeSave()`로 저장된다.
5. 결과: `runs:120`짜리 베테랑 플레이어인데도 다음 판부터 "넥서스예요!" 같은 1단계 안내부터 7단계 전부가 뜬다. 새로고침해도 고쳐지지 않는다(3단계에서 이미 `tutorial` 필드가 저장되어 있어, 이후 로드에서는 `!save.tutorial` 분기 자체를 타지 않음).

**코드 주석과의 불일치**: `loadSave()` 바로 위 주석(2187~2189행)에 "백업 코드 불러오기 같은 엣지케이스에서도 '기존 플레이어'를 새 사람으로 잘못 보지 않게 한다"고 명시돼 있다. 하지만 실제로는 "같은 기기에 이미 세이브가 있는 상태에서 백업 코드로 덮어쓰는" 경우만 안전하고(이때는 `rawBeforeLoad`가 이미 null이 아니므로), "세이브가 전혀 없던 새 기기·새 브라우저에 백업 코드로 처음 복원하는" 경우는 주석이 막으려던 바로 그 상황이 그대로 발생한다. 실제로 흔한 시나리오(휴대폰 교체, 다른 브라우저로 이전)라 재현 가능성이 낮지 않다고 본다.

**영향도**: 세이브 손상·진행 불가 같은 치명적 문제는 아니다. 베테랑 플레이어가 원치 않는 안내 말풍선을 보게 되는 UX 결함이며, "안내 다시 보기"의 반대 방향("안내 끄기")에 해당하는 버튼이 없어 본인이 직접 "건너뛰기"를 한 번 눌러 끄는 것으로 우회는 가능하다.

### 4. 단계 순서·트리거 로직 — 통과
- `TUTORIAL_STEPS`(2521~2543행) 7단계는 `save.tutorial.step` 인덱스로만 진행되고, 현재 인덱스의 `when()`만 평가하므로(`tutorialCheck`, 2553~2565행) 선언 순서를 건너뛰고 뜨는 경로가 없음을 코드로 확인했다.
- `gold`(1단계) 조건이 `nexus`(0단계)와 동일(`screen==='game' && !!S`)해서, "다음"을 누르면 `tutorialNext()`가 즉시 `tutorialCheck()`를 재호출해(2573행) 1단계가 바로 이어 뜬다 — dev 요약의 "1번 직후" 동작과 코드가 일치.
- 중복 노출 방지: `box.dataset.stepId === step.id && box.classList.contains('on')`일 때 조기 반환(2558행)하므로, `syncUI()`처럼 매 프레임 불리는 지점에서 같은 조건이 계속 참이어도 같은 말풍선이 다시 그려지지 않음.
- `tutorialCheck()` 호출 지점은 `show()`(2511행), `syncUI()`(6509행), `openZones()`(6942행), `setShopTab()`(5798행) 4곳 — dev 보고와 일치. (`show('shop')`은 내부에서 `setShopTab('meta')`를 호출하므로 상점 진입 시 `tutorialCheck()`가 두 번 불리지만, 위 중복 방지 가드 덕분에 동작엔 영향 없음.)
- 참고(버그 아님, 설계상 주의): `zone`(6번째, index 5)은 `$('zoneOverlay').classList.contains('on')`이 조건이라, 플레이어가 "지역 정보" 창을 한 번도 열지 않으면 그 뒤 `daily`(7번째) 단계로 영영 못 넘어간다. 의도된 "직접 열어야 진행" 설계로 보이나, 플레이어가 지역 창을 안 열면 일일 보상 안내가 자동으로는 끝까지 안 뜬다는 점은 참고로 남긴다.

### 5. 건너뛰기/다시보기 — 통과
- `tutorialSkip()`(2576~2581행): `save.tutorial.done = true`로 설정하고 `writeSave()` — 영구 종료 확인.
- `btnTutorialReplay`(6715~6723행): `save.tutorial = {step:0, done:false}`로 교체 후 `writeSave()` — 재시작 확인. 클릭 즉시 `tutorialCheck()`를 부르지 않지만, 이 버튼은 메인 화면(menu)에만 있고 0단계 조건(`screen==='game'`)은 메인 화면에서 항상 거짓이라 즉시 뜰 상황이 아니므로 문제 없음. 안내 문구("다음 판부터 하나씩 떠요")도 이 동작과 일치.

### 6. id 중복/충돌 — 통과
`tutBubble`, `tutStepNum`, `tutText`, `tutBtnSkip`, `tutBtnNext`, `btnTutorialReplay`, `tutorialReplayMsg`, `waveChip`, 그리고 앵커 대상(`hpwrap`, `nexusShop`, `shopTabBarrack`, `shopTabHero`, `overCore`, `zoneList`, `zoneOverlay`, `dailyBtn`) 모두 `grep`으로 1회씩만 등장 — 중복/누락 없음.

### 7. 모바일 375px 폭 — **통과, 단 1곳은 실제 기기 확인 권장**
- `#tutBubble`은 `width: min(94vw, 360px)`(176행), `left:50%; transform:translateX(-50%)`로 중앙 고정 — 375px 폭에서 94vw=352.5px, 좌우 여유 합 22.5px로 화면 밖으로 넘치지 않음. `* { box-sizing: border-box }`(38행)라 padding(14px 16px)도 이 안에 포함됨.
- `#waveBtnWrap`(346행)·`#skillArea`(369행)는 `position:absolute`로 `#stage` 기준(bottom:3%)이고, `#stage`는 모바일에서 `#panel`(46dvh, 403~406행) 위의 남는 공간만 차지한다. 즉 이 두 버튼 묶음은 화면 하단이 아니라 캔버스 영역 하단(화면 중간 즈음)에 있어 **뷰포트 바닥에 고정된 `#tutBubble`과 겹치지 않는다** — README 636행의 "아래쪽 버튼도 그대로 보입니다" 주장은 이 두 버튼 기준으로는 맞다.
- 다만 `gold`(1단계)가 가리키는 `#nexusShop`은 `#panel`(모바일에서 뷰포트 하단 46%, 667px 기기 기준 약 307px) 안에 있다. `#tutBubble` 높이를 텍스트·버튼·패딩으로 추산하면 약 140~160px이고 `bottom:14px`로 뷰포트 바닥에 붙으므로, **`#panel` 하단 약 140~160px(≈panel 높이의 절반 가까이)이 말풍선에 가려질 수 있다** — 바로 이 말풍선이 "보라"고 가리키는 `#nexusShop` 목록의 아래쪽 카드가 가려질 가능성이 있다는 뜻이다. 목록이 스크롤 가능(`overflow-y:auto`)해서 완전히 못 보는 건 아니고, README의 "아래쪽 버튼도 그대로 보입니다"라는 일반적 주장과는 다소 어긋난다.
  - 이 항목은 CSS 수치 추론만으로 낸 결론이라 **"확인 필요"**로 남긴다 — 실제 375px 기기(또는 DevTools 모바일 에뮬레이션)에서 `gold` 단계가 뜬 화면을 직접 봐야 최종 판단 가능.

### 8. README 반영 — 통과
`Nexus-Defense/README.md` 618~640행에 "첫 판 안내(2026-10-27 추가)" 절이 있고, 7단계 표·순서 보장·건너뛰기/다시보기·저장 필드(`save.tutorial`)까지 코드와 일치하게 설명돼 있다. 764~766행 "코드 구조" 표에도 `TUTORIAL_STEPS`/`tutorialCheck` 등 함수명이 실제와 일치하게 기재됨.
단, README는 백업 코드 복원 시의 신규 판정 한계(위 3번 항목)는 언급하지 않는다 — 문제가 유지된다면 README에도 한계로 남길지 팀장 판단 필요.

## 팀장 확인 필요 항목
1. **(핵심)** 3번 항목의 "새 기기·새 브라우저에서 백업 코드로 베테랑 세이브를 처음 복원하면 튜토리얼이 뜬다" — 되돌릴지, 다음 작업으로 미룰지, 혹은 "경미하니 그대로 둔다"로 할지 판단 필요. 고친다면 `importSave()` 끝에서 `save.runs`/`save.best`가 복원 후 0보다 크면 `save.tutorial = {step:7, done:true}`로 맞추는 방식이 code 주석의 의도와 일치할 것으로 보인다(수정은 프로그래밍팀 담당).
2. 7번 항목의 모바일 375px `#nexusShop` 가림 정도는 실제 기기/에뮬레이터 확인 후 "문제 없음"으로 확정할지 결정 필요.
3. 4번 항목의 "지역 정보 창을 안 열면 `daily` 단계가 영영 안 뜬다"는 버그는 아니지만 의도된 설계인지 재확인 권장(기획 의도 확인 필요, QA 영역 밖).

## 산출물
- `GameHub/QA/2026-10-27_nexus-defense_첫판안내(튜토리얼) 검증.md` (본 파일)
