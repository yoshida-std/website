// 迷路をたどってゴールへ向かう簡単なボット。5面まで通して進められるか確かめる(確認用)
// 使い方: node tools/bot_test.mjs build/horihori.nes [フレーム数] [cheat=1で残機をいつも3に]
import fs from 'fs';
import NES from '/tmp/jsnes/src/nes.js';
import Controller from '/tmp/jsnes/src/controller.js';
const [rom, framesArg = '60000', cheat = '0'] = process.argv.slice(2);
const sym = {};
for (const l of fs.readFileSync(rom.replace(/\.nes$/, '.lbl'), 'utf8').split('\n')) { const m = l.match(/^al ([0-9A-F]+) \.(\w+)/); if (m) sym[m[2]] = parseInt(m[1], 16); }
const nes = new NES({ onFrame: () => {}, onAudioSample: () => {} });
nes.loadROM(fs.readFileSync(rom).toString('binary'));
const B = Controller, M = nes.cpu.mem;
const get = (a, o = 0) => M[sym[a] + o];
const keys = [[1, B.BUTTON_RIGHT, 1, 0], [2, B.BUTTON_LEFT, -1, 0], [4, B.BUTTON_DOWN, 0, 1], [8, B.BUTTON_UP, 0, -1]];
let pressed = null, startHold = 0;
const log = [], reached = { max: 0, allClear: 0, stageClears: [0, 0, 0, 0, 0, 0], gameovers: 0 };
let prevClear = 0, prevOver = 0;
function press(b) { if (pressed !== b) { if (pressed != null) nes.buttonUp(1, pressed); if (b != null) nes.buttonDown(1, b); pressed = b; } }
const N = +framesArg;
for (let f = 0; f < N; f++) {
  nes.frame();
  if (f < 20) continue;
  const stage = get('stage'), title = get('title'), over = get('gover'), clr = get('clear');
  if (clr && !prevClear) { reached.stageClears[stage]++; if (stage === 5) reached.allClear++; }
  if (over && !prevOver) reached.gameovers++;
  prevClear = clr; prevOver = over;
  reached.max = Math.max(reached.max, stage);
  if (title || over || clr) {                 // Start を数フレーム押して先へ進む
    if (startHold++ % 40 < 3) { press(null); nes.buttonDown(1, B.BUTTON_START); } else nes.buttonUp(1, B.BUTTON_START);
    continue;
  }
  nes.buttonUp(1, B.BUTTON_START);
  if (cheat === '1') M[sym.lives] = 3;
  // 迷路を読む(1行16バイト、1=壁)
  const base = sym.mapram, cell = (x, y) => M[base + y * 16 + x];
  const px = get('px'), py = get('pylo') + 256 * get('pyhi');
  const cx = Math.round((px - 24) / 16), cy = Math.round(py / 16);
  let goal = null;
  for (let x = 0; x < 13; x++) if (cell(x, 0) === 3) goal = [x, 0];
  if (!goal) { press(null); continue; }
  // 幅優先探索(ゴールから)
  const dist = new Map([[goal[0] + ',' + goal[1], 0]]); const q = [goal];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [, , dx, dy] of keys) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx > 12 || ny < 0 || ny > 30 || cell(nx, ny) === 1 || dist.has(nx + ',' + ny)) continue;
      dist.set(nx + ',' + ny, dist.get(x + ',' + y) + 1); q.push([nx, ny]);
    }
  }
  let best = null, bd = dist.get(cx + ',' + cy) ?? 1e9;
  for (const [bit, btn, dx, dy] of keys) {
    const d = dist.get((cx + dx) + ',' + (cy + dy));
    if (d !== undefined && d < bd) { bd = d; best = btn; }
  }
  press(best);
}
console.log(JSON.stringify({ frames: N, cheat, ...reached }));
