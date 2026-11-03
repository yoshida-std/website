// jsnesでROMを数フレーム動かして画面をPNG用のrawで書き出す(確認用)。
// 使い方: node tools/run_headless.mjs ROM 出力prefix "right:30,down:20" ...
import fs from 'fs';
import NES from '/tmp/jsnes/src/nes.js';
import Controller from '/tmp/jsnes/src/controller.js';
const [rom, prefix, script = ''] = process.argv.slice(2);
// ラベルファイル(ld65 -Ln)から変数のアドレスを読む。SYMS=lives,gover,camlo,pylo,px で表示する値を選ぶ
const sym = {};
const lbl = rom.replace(/\.nes$/, '.lbl');
if (fs.existsSync(lbl)) for (const l of fs.readFileSync(lbl, 'utf8').split('\n')) { const m = l.match(/^al ([0-9A-F]+) \.(\w+)/); if (m) sym[m[2]] = parseInt(m[1], 16); }
const SYMS = (process.env.SYMS || 'lives,gover,camlo,pylo,px').split(',');
let frame = null;
const nes = new NES({ onFrame: b => { frame = b.slice(); }, onAudioSample: () => {} });
nes.loadROM(fs.readFileSync(rom).toString('binary'));
const keys = { right: Controller.BUTTON_RIGHT, left: Controller.BUTTON_LEFT, up: Controller.BUTTON_UP,
  down: Controller.BUTTON_DOWN, a: Controller.BUTTON_A, b: Controller.BUTTON_B, start: Controller.BUTTON_START };
function dump(name) {
  const out = Buffer.alloc(256 * 240 * 3);
  for (let i = 0; i < 256 * 240; i++) { const v = frame[i]; out[i*3] = v & 255; out[i*3+1] = (v >> 8) & 255; out[i*3+2] = (v >> 16) & 255; }
  fs.writeFileSync(`${prefix}_${name}.rgb`, out);
}
for (let i = 0; i < 30; i++) nes.frame();
dump('start');
let n = 0;
for (const step of script.split(',').filter(Boolean)) {
  const [k, f] = step.split(':');
  nes.buttonDown(1, keys[k]);
  for (let i = 0; i < +f; i++) nes.frame();
  nes.buttonUp(1, keys[k]);
  dump(`s${++n}_${k}`);
  console.log(k, f, ...SYMS.map(n => `${n}=${nes.cpu.mem[sym[n]] + (n.endsWith('lo') ? 256 * nes.cpu.mem[sym[n.replace('lo', 'hi')]] : 0)}`));
}

// DUMP=シンボル:バイト数 でRAMの一部をファイルに書き出す(確認用)
if (process.env.DUMP) {
  const [name, len] = process.env.DUMP.split(':');
  const out = Buffer.alloc(+len);
  for (let i = 0; i < +len; i++) out[i] = nes.cpu.mem[sym[name] + i];
  fs.writeFileSync(`${prefix}_${name}.bin`, out);
}
