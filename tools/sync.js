/* 게임 사본 동기화 — 각 게임 저장소의 index.html 을 games/<id>.html 로 복사한다.
   허브는 사본을 담고만 있고 게임 코드는 손대지 않는다. 원본을 고친 뒤
   `node tools/sync.js` 한 번이면 허브도 최신이 된다.

   사용법:
     node tools/sync.js            허브 안의 원본 폴더에서 복사
     node tools/sync.js --check    복사하지 않고 다른 점만 알려준다 */
const fs = require('fs');
const path = require('path');

const HUB = path.resolve(__dirname, '..');
const SRC_ROOT = HUB;                              // 원본 저장소를 허브 폴더 안에 받아 둔다
const GAMES = [
  { id: 'slime', dir: 'SlimeGame',     name: '슬라임 키우기' },
  { id: 'nexus', dir: 'Nexus-Defense', name: '넥서스 디펜스' },
  { id: 'money', dir: 'Money-Defense', name: '머니 디펜스' },
  { id: 'wall',  dir: 'Wall-Defense',  name: '극한 벽짓고 살아남기' },
];

const check = process.argv.includes('--check');
let changed = 0, missing = 0;

for (const g of GAMES) {
  const src = path.join(SRC_ROOT, g.dir, 'index.html');
  const dst = path.join(HUB, 'games', g.id + '.html');
  if (!fs.existsSync(src)) {
    console.log(`  ?  ${g.name} — 원본 없음 (${src})`);
    missing++;
    continue;
  }
  const a = fs.readFileSync(src);
  const b = fs.existsSync(dst) ? fs.readFileSync(dst) : null;
  if (b && a.equals(b)) {
    console.log(`  =  ${g.name} — 그대로`);
    continue;
  }
  changed++;
  if (check) {
    console.log(`  *  ${g.name} — 원본이 다르다 (사본 ${b ? b.length : 0} → 원본 ${a.length} 바이트)`);
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, a);
    console.log(`  →  ${g.name} — 갱신 (${a.length} 바이트)`);
  }
}

console.log(check
  ? `\n다른 게임 ${changed}개${missing ? `, 원본을 못 찾은 게임 ${missing}개` : ''}`
  : `\n갱신 ${changed}개${missing ? `, 건너뜀 ${missing}개` : ''}`);
if (missing) process.exitCode = 1;
