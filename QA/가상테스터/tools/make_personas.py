"""가상 테스터 200명 프로필 만들기 (재현 가능하도록 seed 고정):  python -X utf8 tools/make_personas.py"""
import json, random
from pathlib import Path
R = random.Random(20261028)
def pick(table):                       # [(값, 비율), ...]
    x, acc = R.random(), 0
    for v, w in table:
        acc += w
        if x < acc: return v
    return table[-1][0]
AGE = [("10대", .15), ("20대", .30), ("30대", .30), ("40대", .17), ("50대 이상", .08)]
TYPE = [("라이트(캐주얼)", .40), ("미드코어", .35), ("하드코어", .25)]
GENRES = ["방치형/키우기", "타워 디펜스", "RTS(스타·워크)", "RPG", "퍼즐", "로그라이크", "전략 시뮬레이션", "액션", "수집형"]
DEVICE = [("주로 휴대폰", .60), ("주로 PC", .40)]
SESSION = [("한 번에 5분 이하", .30), ("한 번에 10~30분", .45), ("한 번에 1시간 이상", .25)]
PATIENCE = [("낮음 — 처음 3분 안에 재미없으면 끔", .30), ("보통", .45), ("높음 — 복잡해도 파고듦", .25)]
people = []
for i in range(1, 201):
    t = pick(TYPE)
    people.append({
        "id": f"T{i:03d}", "나이": pick(AGE), "게이머 유형": t,
        "좋아하는 장르": R.sample(GENRES, 2), "기기": pick(DEVICE), "플레이 습관": pick(SESSION),
        "인내심": pick(PATIENCE),
        "유즈맵 경험": "워크3·스타 유즈맵(돈타워·벽짓살 등)을 해 봤다" if R.random() < (0.55 if t == "하드코어" else 0.2) else "유즈맵은 잘 모른다",
    })
Path(__file__).resolve().parent.parent.joinpath("personas.json").write_text(json.dumps(people, ensure_ascii=False, indent=1), encoding="utf-8")
print(len(people), "명 생성")
