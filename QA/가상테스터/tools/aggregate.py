"""가상 테스터 결과 집계:  python -X utf8 tools/aggregate.py [--themes]
results/*.json → summary.json, 요약.md.  --themes 를 주면 게임마다 sonnet 으로 불만·헷갈림·바람을 유형별로 묶는다(themes_<게임>.json)."""
import json, statistics as st, subprocess, sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
R = HERE / "results"
GAMES = {"slime": "슬라임 키우기", "nexus": "넥서스 디펜스", "money": "머니 디펜스", "wall": "극한 벽짓고 살아남기"}
SCORES = ["첫인상", "이해도", "재미", "난이도", "다시할의향", "추천의향"]
people = {p["id"]: p for p in json.loads((HERE / "personas.json").read_text(encoding="utf-8"))}
SEGS = ["게이머 유형", "기기", "나이", "인내심"]

summary = {}
for key, title in GAMES.items():
    rows = []
    for f in sorted(R.glob(f"{key}_*.json")):
        rows += json.loads(f.read_text(encoding="utf-8"))
    if not rows:
        continue
    g = {"title": title, "n": len(rows)}
    g["평균"] = {k: round(st.mean(r[k] for r in rows), 2) for k in SCORES}
    g["분포"] = {k: dict(sorted(Counter(r[k] for r in rows).items())) for k in SCORES}
    g["10분안_그만둠_비율"] = round(100 * sum(bool(r["10분안에_그만둠"]) for r in rows) / len(rows), 1)
    g["첫판_분_중앙값"] = st.median(float(r["첫판_플레이_분"]) for r in rows)
    g["재방문의향_4이상_비율"] = round(100 * sum(r["다시할의향"] >= 4 for r in rows) / len(rows), 1)
    seg = {}
    for s in SEGS:
        d = defaultdict(list)
        for r in rows:
            d[people[r["id"]][s]].append(r)
        seg[s] = {v: {"n": len(rs), "재미": round(st.mean(x["재미"] for x in rs), 2),
                      "다시할의향": round(st.mean(x["다시할의향"] for x in rs), 2),
                      "10분안_그만둠%": round(100 * sum(bool(x["10분안에_그만둠"]) for x in rs) / len(rs))} for v, rs in d.items()}
    g["유형별"] = seg
    summary[key] = g

(HERE / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=1), encoding="utf-8")

if "--themes" in sys.argv:
    for key, g in summary.items():
        out = HERE / f"themes_{key}.json"
        if out.exists():
            continue
        rows = []
        for f in sorted(R.glob(f"{key}_*.json")):
            rows += json.loads(f.read_text(encoding="utf-8"))
        slim = [{k: r[k] for k in ("id", "싫었던점", "헷갈린점", "바라는점", "좋았던점", "그만둔_이유")} for r in rows]
        prompt = f"""아래는 '{g['title']}' 가상 테스터 {len(rows)}명의 의견이다. 비슷한 말끼리 묶어 유형별로 정리하라.
각 항목(싫었던점·헷갈린점·바라는점·좋았던점·그만둔 이유)마다 많이 나온 순서로 최대 6개 유형, 유형마다 대표 문장 1개와 해당 인원 수(직접 세어라).
JSON 만 출력: {{"싫었던점":[{{"유형":"...","인원":N,"예":"..."}}],"헷갈린점":[...],"바라는점":[...],"좋았던점":[...],"그만둔이유":[...]}}
의견:
{json.dumps(slim, ensure_ascii=False)}"""
        # 의견 200개는 명령줄 길이 제한(Windows)을 넘으므로 표준 입력으로 넘긴다
        r = subprocess.run(["claude", "-p", "--model", "sonnet", "--output-format", "json", "--permission-mode", "dontAsk",
                            "--name", f"가상 테스터 의견 묶기 {g['title']}"], cwd=HERE, input=prompt, capture_output=True, text=True,
                           encoding="utf-8", timeout=2400)
        res = json.loads(r.stdout); txt = res["result"]
        out.write_text(txt[txt.find("{"):txt.rfind("}") + 1], encoding="utf-8")
        print(f"{g['title']} 묶기 완료 (사용량 환산 ${res.get('total_cost_usd', 0):.2f})", flush=True)

lines = ["# 가상 테스터 200명 결과 요약", "", "> AI 가 흉내 낸 가상 유저 의견이다 (실제 유저 아님). 경향 파악용.", "",
         "| 게임 | 첫인상 | 이해도 | 재미 | 난이도(3=적당) | 다시 할 의향 | 추천 | 10분 안에 그만둠 | 첫 판 중앙값 |", "|---|---|---|---|---|---|---|---|---|"]
for g in summary.values():
    a = g["평균"]
    lines.append(f"| {g['title']} | {a['첫인상']} | {a['이해도']} | {a['재미']} | {a['난이도']} | {a['다시할의향']} | {a['추천의향']} | {g['10분안_그만둠_비율']}% | {g['첫판_분_중앙값']}분 |")
(HERE / "요약.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines))
