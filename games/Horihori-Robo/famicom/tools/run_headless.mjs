// jsnesでROMを数フレーム動かして画面をPNG用のrawで書き出す(確認用)。
// 使い方: node tools/run_headless.mjs ROM 出力prefix "right:30,down:20" ...
import fs from 'fs';
import NES from '/tmp/jsnes/src/nes.js';
import Controller from '/tmp/jsnes/src/controller.js';
const [rom, prefix, script = ''] = process.argv.slice(2);
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
  console.log(k, f, 'px=', nes.cpu.mem[1], 'py=', nes.cpu.mem[3]*256+nes.cpu.mem[2], 'cam=', nes.cpu.mem[12]*256+nes.cpu.mem[11], 'ltop=', nes.cpu.mem[14]);
}
