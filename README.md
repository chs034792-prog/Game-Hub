# 🎮 Game Hub

직접 만든 브라우저 게임 네 개를 한곳에서 고르고 바로 플레이하는 허브입니다. `index.html`을 열면 카드 네 장이 뜨고, 누르면 허브 안에서 그 게임이 실행됩니다.

**바로 플레이**: (GitHub Pages 주소를 여기에 적어 두세요)

## 담긴 게임

| 게임 | 장르 | 원본 저장소 |
|---|---|---|
| 슬라임 키우기 | 방치형 | [SlimeGame](https://github.com/chs034792-prog/SlimeGame) |
| 넥서스 디펜스 | 타워 디펜스 | [Nexus-Defense](https://github.com/chs034792-prog/Nexus-Defense) |
| 머니 디펜스 | 경로형 TD | [Money-Defense](https://github.com/chs034792-prog/Money-Defense) |
| 극한 벽짓고 살아남기 | 생존 디펜스 | [Wall-Defense](https://github.com/chs034792-prog/Wall-Defense) |

## 구조

```
index.html        허브 — 게임 카드 네 장과 내 기록
play.html         게임 실행 창 — 위에 얇은 띠(← 허브 · 전체화면 · 새 탭) + 게임 iframe
games/*.html      각 게임 저장소 index.html 의 사본 (직접 고치지 말 것)
tools/sync.js     사본 갱신 스크립트
```

- **게임 코드는 손대지 않습니다.** `games/*.html`은 원본 저장소의 `index.html`을 그대로 복사한 것이고, 허브 기능(돌아가기 버튼 등)은 전부 `play.html` 쪽에 있습니다. 그래서 원본을 고쳐도 충돌 없이 다시 복사만 하면 됩니다.
- **iframe 위에 겹치는 UI가 없습니다.** 게임 화면을 가리지 않도록 위쪽 38px 띠를 비워 두고 그 아래를 통째로 게임에 줍니다.

## 게임 사본 갱신

원본 게임을 고친 뒤:

```bash
node tools/sync.js
```

```bash
node tools/sync.js --check
```

`--check`는 복사하지 않고 어떤 게임이 원본과 다른지만 알려줍니다. 원본 저장소는 이 폴더와 나란히 있다고 봅니다 (`../SlimeIdle`, `../NexusDefense`, `../MoneyDefense`, `../WallDefense`). 게임을 추가하려면 `tools/sync.js`의 `GAMES` 표에 한 줄, `index.html`의 `GAMES` 목록에 카드 하나, `play.html`의 `GAMES`에 한 줄을 넣습니다.

## 기록 이어쓰기

허브 카드에 뜨는 기록은 각 게임이 **브라우저에 저장해 둔 값**을 그대로 읽은 것입니다.

| 게임 | 읽는 키 | 카드에 뜨는 값 |
|---|---|---|
| 슬라임 키우기 | `slime-idle-v1` | 레벨 · 스테이지 · 영혼 |
| 넥서스 디펜스 | `nexusdefense.save` | 최고 웨이브 · 코어 · 출격 |
| 머니 디펜스 | `moneydefense.v4` | 최고 라운드 · 처치 · 플레이 |
| 극한 벽짓고 살아남기 | `wallDefenseMeta`, `wallDefenseRecords2` | 최고 웨이브 · 승리 · 정수 |

같은 사이트(origin)에서 열면 저장 공간을 공유하므로, **게임을 따로 열어 쌓은 기록도 허브에서 그대로 이어집니다.** 예를 들어 `chs034792-prog.github.io`의 게임들과 이 허브는 같은 사이트라 기록이 그대로입니다. 반대로 주소(도메인)가 다르면 브라우저가 저장 공간을 따로 주기 때문에 기록이 보이지 않습니다 — 그럴 땐 게임의 백업 코드 기능으로 옮기세요.

## 실행

`index.html`을 더블클릭해도 열리지만, `file://`에서는 브라우저가 저장 공간을 막아 기록이 보이지 않을 수 있습니다. 그럴 땐 이 폴더에서 로컬 서버를 띄우고 `localhost:8000`으로 접속하세요.

```bash
python -m http.server
```

## 기술 메모

- 의존성 없는 정적 파일 묶음입니다. 빌드 과정이 없고 GitHub Pages에 그대로 올라갑니다.
- 카드 썸네일은 인라인 SVG로 그려서 이미지 파일이 없습니다.
- `play.html`은 띄운 뒤 iframe에 초점을 줘서 Space·단축키가 바로 게임으로 갑니다.
- 게임 안에서 뒤로가기를 누르면 그 게임의 메뉴로, 메뉴에서 한 번 더 누르면 허브로 돌아옵니다.
