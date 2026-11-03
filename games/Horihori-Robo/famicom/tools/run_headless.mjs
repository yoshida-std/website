// jsnesでROMを数フレーム動かして画面をPNG用のrawで書き出す(確認用)。
// 使い方: node tools/run_headless.mjs ROM 出力prefix "right:30,down:20" ...
import fs from 'fs';
import NES from '/tmp/jsnes/src/nes.js';
import Controller from '/tmp/jsnes/src/controller.js';
const [rom, prefix, script = ''] = process.argv.slice(2);
let frameCount = 0;
// ラベルファイル(ld65 -Ln)から変数のアドレスを読む。SYMS=lives,gover,camlo,pylo,px で表示する値を選ぶ
const sym = {};
const lbl = rom.replace(/\.nes$/, '.lbl');
if (fs.existsSync(lbl)) for (const l of fs.readFileSync(lbl, 'utf8').split('\n')) { const m = l.match(/^al ([0-9A-F]+) \.(\w+)/); if (m) sym[m[2]] = parseInt(m[1], 16); }
const SYMS = (process.env.SYMS || 'lives,gover,camlo,pylo,px').split(',');
let frame = null;
const audio = [];
const nes = new NES({ onFrame: b => { frame = b.slice(); }, onAudioSample: (l, r) => { if (process.env.AUDIO) audio.push((l + r) / 2); } });
nes.loadROM(fs.readFileSync(rom).toString('binary'));
const keys = { right: Controller.BUTTON_RIGHT, left: Controller.BUTTON_LEFT, up: Controller.BUTTON_UP,
  down: Controller.BUTTON_DOWN, a: Controller.BUTTON_A, b: Controller.BUTTON_B, start: Controller.BUTTON_START };
function dump(name) {
  const out = Buffer.alloc(256 * 240 * 3);
  for (let i = 0; i < 256 * 240; i++) { const v = frame[i]; out[i*3] = v & 255; out[i*3+1] = (v >> 8) & 255; out[i*3+2] = (v >> 16) & 255; }
  fs.writeFileSync(`${prefix}_${name}.rgb`, out);
}
for (let i = 0; i < 30; i++) (frameCount++, nes.frame());
dump('start');
let n = 0;
// ステップ: "キー:フレーム数" か、"poke=名前;オフセット;値"(RAMを書き換えてテスト状況を作る)
for (const step of script.split(',').filter(Boolean)) {
  if (step.startsWith('poke=')) { const [nm, off, val] = step.slice(5).split(';'); nes.cpu.mem[sym[nm] + +off] = +val; continue; }
  const [k, f] = step.split(':');
  if (keys[k] !== undefined) nes.buttonDown(1, keys[k]);
  for (let i = 0; i < +f; i++) (frameCount++, nes.frame());
  if (keys[k] !== undefined) nes.buttonUp(1, keys[k]);
  dump(`s${++n}_${k}`);
  if (process.env.VRAM) console.log('  vram', process.env.VRAM.split(',').map(a => nes.ppu.vramMem[parseInt(a, 16)]).join(' '));
  console.log(k, f, ...SYMS.map(n => { const [nm, off = '0'] = n.split(':'); return `${n}=${nes.cpu.mem[sym[nm] + +off] + (nm.endsWith('lo') ? 256 * nes.cpu.mem[sym[nm.replace('lo', 'hi')] + +off] : 0)}`; }));
}

// DUMP=シンボル:バイト数 でRAMの一部をファイルに書き出す(確認用)
if (process.env.DUMP) {
  const [name, len] = process.env.DUMP.split(':');
  const out = Buffer.alloc(+len);
  for (let i = 0; i < +len; i++) out[i] = nes.cpu.mem[sym[name] + i];
  fs.writeFileSync(`${prefix}_${name}.bin`, out);
}

// AUDIO=ファイル名.wav で、鳴った音(モノラル44.1kHz)を書き出す
if (process.env.AUDIO) {
  const n = audio.length, buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); const sr = Math.round(n / frameCount * 60.0988); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(audio[i] * 32767))), 44 + i * 2);
  fs.writeFileSync(process.env.AUDIO, buf);
}
