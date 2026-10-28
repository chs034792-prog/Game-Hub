"""가상 테스터 패널 실행:  python -X utf8 tools/run_panel.py [게임...]   (기본: slime nexus money wall)
테스터 200명을 25명씩 묶어 게임마다 8번 sonnet 에게 평가를 받는다 (동시에 4개).
결과: results/<게임>_<묶음>.json, 사용량 기록: results/_usage.json
※ AI 가 흉내 낸 가상 유저 의견이다. 실제 유저 데이터가 아니므로 '경향 파악용'으로만 쓴다."""
import json, subprocess, sys, threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
OUT = HERE / "results"; OUT.mkdir(exist_ok=True)
GAMES = {"slime": "슬라임 키우기", "nexus": "넥서스 디펜스", "money": "머니 디펜스", "wall": "극한 벽짓고 살아남기"}
BATCH = 25
people = json.loads((HERE / "personas.json").read_text(encoding="utf-8"))
lock = threading.Lock()

PROMPT = """너는 게임 사용자 조사 진행자다. 아래 '테스터 {n}명'이 각자 처음으로 '{title}'을(를) 해 본다고 가정하고, 각 사람의 반응을 그 사람의 성향대로 정직하게 써라.

먼저 Read 도구로 packets/{key}.md 를 읽고, 그 안에 적힌 화면 그림(img/...)을 모두 Read 로 열어 본다. 게임에 대해서는 이 자료에 있는 사실만 근거로 쓰고, 자료에 없는 기능을 지어내지 마라.

규칙:
- 사람마다 다르게: 나이·게이머 유형·좋아하는 장르·기기·플레이 습관·인내심·유즈맵 경험을 반영한다. 모두 칭찬하거나 모두 비슷한 말을 하면 안 된다. 성향상 안 맞으면 낮은 점수와 빨리 끄는 반응이 나와야 한다.
- 휴대폰 위주인 사람은 휴대폰에서 연다고 가정한다 (자료에 휴대폰 지원이 약하다고 적혀 있으면 그대로 반영).
- 점수는 1~5 정수. 난이도는 1=너무 쉬움, 3=적당, 5=너무 어려움.
- 문장은 한국어, 각 항목 한 문장(40자 안팎), 그 사람 말투로.

테스터:
{people}

출력: 아래 형식의 JSON 배열만 출력한다 (설명·코드블록 표시 없이). 테스터 수만큼, 같은 순서로.
[{{"id":"T001","첫인상":1-5,"이해도":1-5,"재미":1-5,"난이도":1-5,"다시할의향":1-5,"추천의향":1-5,
"첫판_플레이_분":숫자(처음 앉아서 몇 분 할지),"10분안에_그만둠":true/false,"그만둔_이유":"없으면 빈 문자열",
"좋았던점":"...","싫었던점":"...","헷갈린점":"없으면 '없음'","바라는점":"..."}}]"""

def run(key, b):
    f = OUT / f"{key}_{b + 1}.json"
    if f.exists():
        return
    group = people[b * BATCH:(b + 1) * BATCH]
    prompt = PROMPT.format(n=len(group), title=GAMES[key], key=key, people=json.dumps(group, ensure_ascii=False))
    for attempt in range(2):
        r = subprocess.run(["claude", "-p", prompt, "--model", "sonnet", "--output-format", "json", "--permission-mode", "dontAsk",
                            "--allowedTools", "Read", "--name", f"가상 테스터 {GAMES[key]} {b + 1}/8"],
                           cwd=HERE, capture_output=True, text=True, encoding="utf-8", stdin=subprocess.DEVNULL, timeout=1200)
        try:
            res = json.loads(r.stdout)
            txt = res.get("result", "")
            data = json.loads(txt[txt.find("["):txt.rfind("]") + 1])
            assert len(data) == len(group)
        except Exception as e:
            print(f"  ! {key} {b + 1} 다시 시도 ({e})", flush=True)
            continue
        f.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        with lock:
            u = OUT / "_usage.json"
            usage = json.loads(u.read_text(encoding="utf-8")) if u.exists() else {}
            usage[f"{key}_{b + 1}"] = res.get("total_cost_usd", 0)
            u.write_text(json.dumps(usage, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"  {key} {b + 1}/8 완료 (사용량 환산 ${res.get('total_cost_usd', 0):.2f})", flush=True)
        return
    print(f"  ✗ {key} {b + 1} 실패", flush=True)

if "--pilot" in sys.argv:                  # 시험 삼아 슬라임 첫 묶음 하나만
    run("slime", 0); sys.exit()
keys = sys.argv[1:] or list(GAMES)
with ThreadPoolExecutor(4) as ex:
    for k in keys:
        for b in range((len(people) + BATCH - 1) // BATCH):
            ex.submit(run, k, b)
