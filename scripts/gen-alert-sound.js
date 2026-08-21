// One-off generator for the loud expert job-offer alert tone.
// Produces assets/sounds/job_alert.wav (16-bit PCM mono, ~3s buzzer).
// Run with: node scripts/gen-alert-sound.js
const fs = require("fs");
const path = require("path");

const sampleRate = 44100;
const durationSec = 3;
const numSamples = sampleRate * durationSec;
const amplitude = 0.92 * 32767;

// Alternating two-tone buzzer (like an urgent alarm) with short on/off bursts.
const toneA = 880; // Hz
const toneB = 1245; // Hz
const burstMs = 180; // length of each beep + gap cycle

const data = Buffer.alloc(numSamples * 2);
for (let i = 0; i < numSamples; i++) {
  const t = i / sampleRate;
  const cyclePos = (t * 1000) % (burstMs * 2);
  const on = cyclePos < burstMs; // beep then rest
  const freq = Math.floor((t * 1000) / (burstMs * 2)) % 2 === 0 ? toneA : toneB;
  // Square wave for a harsh, attention-grabbing buzzer.
  const square = Math.sin(2 * Math.PI * freq * t) >= 0 ? 1 : -1;
  const sample = on ? square * amplitude : 0;
  data.writeInt16LE(Math.round(sample), i * 2);
}

const byteRate = sampleRate * 2;
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(sampleRate, 24);
header.writeUInt32LE(byteRate, 28);
header.writeUInt16LE(2, 32); // block align
header.writeUInt16LE(16, 34); // bits per sample
header.write("data", 36);
header.writeUInt32LE(data.length, 40);

const outDir = path.join(__dirname, "..", "assets", "sounds");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "job_alert.wav");
fs.writeFileSync(outPath, Buffer.concat([header, data]));
console.log("Wrote", outPath, (header.length + data.length), "bytes");
