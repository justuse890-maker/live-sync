#!/usr/bin/env node
/**
 * generate-sounds.mjs — builds the reminder alert sounds from scratch.
 *
 * Every sample is computed here from sine waves and envelopes. No recordings, samples, loops or third-party
 * audio are used, so the resulting WAV files are original to this project and carry no outside copyright.
 * They are released under CC0 1.0 (public domain) — free for any commercial or non-commercial use.
 *
 * Run:  node scripts/generate-sounds.mjs
 * Output: android/app/src/main/res/raw/{chime,bell,beep,electronic}.wav  (Android notification channel sounds)
 */
import fs from "fs";
import path from "path";

const RATE = 44100;

/** One struck, bell-like note: a few partials that each fade at their own rate. */
function strike(freq, startS, lengthS, partials, gain, buf) {
  const start = Math.floor(startS * RATE);
  const n = Math.floor(lengthS * RATE);
  for (let i = 0; i < n && start + i < buf.length; i++) {
    const t = i / RATE;
    const attack = Math.min(1, t / 0.004);                      // 4 ms click-free attack
    let s = 0;
    for (const [ratio, amp, decay] of partials) s += amp * Math.exp(-t * decay) * Math.sin(2 * Math.PI * freq * ratio * t);
    buf[start + i] += s * attack * gain;
  }
}

function toWav(samples) {
  // gentle peak normalisation to 0.7 of full scale, 16-bit mono
  let peak = 0;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  const k = peak > 0 ? 0.7 / peak : 1;
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * k * 32767))), i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const BELL = [[1, 1, 3.2], [2.76, 0.45, 5.5], [5.4, 0.18, 9], [8.93, 0.07, 14]];   // inharmonic partials = bell timbre
const SOFT = [[1, 1, 4.5], [2, 0.25, 8], [3, 0.08, 12]];                          // mellow, near-harmonic

const sounds = {
  // Soft rising three-note chime (C6 · E6 · G6) — the default reminder sound.
  chime: () => { const b = new Float32Array(Math.floor(RATE * 1.5)); [[1046.5, 0], [1318.5, 0.2], [1568, 0.4]].forEach(([f, t]) => strike(f, t, 1.1, BELL, 0.5, b)); return b; },
  // One clear struck bell.
  bell: () => { const b = new Float32Array(Math.floor(RATE * 1.6)); strike(880, 0, 1.5, BELL, 0.7, b); return b; },
  // Two short, soft beeps.
  beep: () => { const b = new Float32Array(Math.floor(RATE * 0.6)); strike(988, 0, 0.18, SOFT, 0.7, b); strike(988, 0.24, 0.22, SOFT, 0.7, b); return b; },
  // Three quick ascending pips ("Pulse").
  electronic: () => { const b = new Float32Array(Math.floor(RATE * 0.7)); [[784, 0], [988, 0.16], [1175, 0.32]].forEach(([f, t]) => strike(f, t, 0.3, SOFT, 0.6, b)); return b; },
};

const outDir = path.join(process.cwd(), "android/app/src/main/res/raw");
fs.mkdirSync(outDir, { recursive: true });
for (const [name, make] of Object.entries(sounds)) {
  const wav = toWav(make());
  fs.writeFileSync(path.join(outDir, `${name}.wav`), wav);
  console.log(`${name}.wav  ${(wav.length / 1024).toFixed(0)} KB`);
}
