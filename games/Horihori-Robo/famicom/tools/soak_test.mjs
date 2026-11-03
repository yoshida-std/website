// ランダムにボタンを押して長時間動かし、止まらない・おかしくならないことを確かめる(確認用)
// 使い方: node tools/soak_test.mjs build/horihori.nes [フレーム数] [乱数の種]
import fs from 'fs';
import NES from '/tmp/jsnes/src/nes.js';
import Controller from '/tmp/jsnes/src/controller.js';
const [rom, framesArg = '30000', seedArg = '1'] = process.argv.slice(2);
const sym = {};
for (const l of fs.readFileSync(rom.replace(/\.nes$/, '.lbl'), 'utf8').split('\n')) { const m = l.match(/^al ([0-9A-F]+) \.(\w+)/); if (m) sym[m[2]] = parseInt(m[1], 16); }
const nes = new NES({ onFrame: () => {}, onAudioSample: () => {} });
nes.loadROM(fs.readFileSync(rom).toString('binary'));
let seed = +seedArg;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const B = Controller;
const btns = [B.BUTTON_RIGHT, B.BUTTON_LEFT, B.BUTTON_UP, B.BUTTON_DOWN, B.BUTTON_A, B.BUTTON_B];
const mem = a => nes.cpu.mem[sym[a]];
const N = +framesArg;
let held = new Set(), last = { fc: -1, stage: 0 }, maxStage = 0, games = 0, clears = 0, gameovers = 0, minSP = 255, bad = [];
for (let f = 0; f < N; f++) {
  if (f % 20 === 0) {                       // 20フレームごとに押すボタンを選び直す
    for (const b of held) nes.buttonUp(1, b);
    held.clear();
    for (const b of btns) if (rnd() < (b === B.BUTTON_A ? 0.35 : b === B.BUTTON_B ? 0.15 : 0.3)) { held.add(b); nes.buttonDown(1, b); }
    if (mem('title') || mem('gover') || mem('clear')) { held.add(B.BUTTON_START); nes.buttonDown(1, B.BUTTON_START); }
  }
  if (f % 1 === 0 && (mem('gover') || mem('clear'))) { if (mem('gover')) gameovers++; if (mem('clear')) clears++; }
  nes.frame();
  if (f > 10 && mem('stage') > 5 && !last.reported) { last.reported = true; console.log('stage>5 at frame', f, 'stage', mem('stage'), 'title', mem('title'), 'pc', nes.cpu.REG_PC.toString(16)); }
  if (f > 10) maxStage = Math.max(maxStage, mem('stage'));
  minSP = Math.min(minSP, nes.cpu.REG_SP & 255);
  if (f % 600 === 599) {
    const pc = nes.cpu.REG_PC;
    const fc = mem('fc');
    const st = { stage: mem('stage'), lives: mem('lives'), nrob: mem('nrob'), pc: pc.toString(16), fc };
    if (pc < 0x8000) bad.push(['PC範囲外', f, st]);
    if (mem('stage') < 1 || mem('stage') > 5) bad.push(['stage', f, st]);
    if (mem('lives') > 3) bad.push(['lives', f, st]);
    if (!mem('title') && !mem('gover') && !mem('clear') && fc === last.fc) bad.push(['fcが進まない(止まった?)', f, st]);
    last.fc = fc;
  }
}
console.log(JSON.stringify({ frames: N, maxStage, gameoverFrames: gameovers, clearFrames: clears, minSP, problems: bad.length }));
for (const b of bad) console.log('  !', JSON.stringify(b));
