import fs from 'fs';
import path from 'path';

// Function to generate a simple mono WAV file buffer
function generateWav(frequency, durationMs, type = 'sine') {
  const sampleRate = 44100;
  const numChannels = 1;
  const bitsPerSample = 16;
  
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  
  const buffer = Buffer.alloc(44 + dataSize);
  
  // RIFF chunk descriptor
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  
  // fmt sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  
  // data sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  
  // Generate audio data
  const volume = 32767 * 0.3; // 30% volume
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    
    if (type === 'sine') {
      sample = Math.sin(2 * Math.PI * frequency * t);
    } else if (type === 'square') {
      sample = Math.sin(2 * Math.PI * frequency * t) > 0 ? 1 : -1;
    } else if (type === 'chime') {
      // Simple decaying sine for chime
      const decay = Math.max(0, 1 - (t / (durationMs / 1000)));
      sample = Math.sin(2 * Math.PI * frequency * t) * decay;
    }
    
    const value = Math.max(-32768, Math.min(32767, Math.floor(sample * volume)));
    buffer.writeInt16LE(value, 44 + i * 2);
  }
  
  return buffer;
}

const outDir = path.join(process.cwd(), 'android/app/src/main/res/raw');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. Default / Beep
fs.writeFileSync(path.join(outDir, 'beep.wav'), generateWav(880, 200, 'sine'));

// 2. Bell (higher frequency, short)
fs.writeFileSync(path.join(outDir, 'bell.wav'), generateWav(1200, 300, 'sine'));

// 3. Chime (decaying)
fs.writeFileSync(path.join(outDir, 'chime.wav'), generateWav(1000, 800, 'chime'));

// 4. Electronic (square wave)
fs.writeFileSync(path.join(outDir, 'electronic.wav'), generateWav(600, 150, 'square'));

console.log('Generated notification sounds in android/app/src/main/res/raw/');
