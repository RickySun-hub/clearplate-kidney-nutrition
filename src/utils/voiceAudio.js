export async function recordingToWav(blob) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass || !window.OfflineAudioContext) throw new Error('This browser cannot prepare bounded audio. Please type instead.');
  const context = new AudioContextClass();
  let audio;
  try { audio = await context.decodeAudioData(await blob.arrayBuffer()); } finally { await context.close(); }
  if (!Number.isFinite(audio.duration) || audio.duration <= 0 || audio.duration > 60.25) throw new Error('Record at most 60 seconds.');
  const length = Math.min(960000, Math.ceil(audio.duration * 16000));
  const offline = new OfflineAudioContext(1, length, 16000);
  const source = offline.createBufferSource(); source.buffer = audio; source.connect(offline.destination); source.start();
  const rendered = await offline.startRendering();
  const samples = rendered.getChannelData(0); const bytes = new ArrayBuffer(44 + samples.length * 2); const view = new DataView(bytes);
  const label = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  label(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true); label(8, 'WAVE'); label(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); label(36, 'data'); view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) { const sample = Math.max(-1, Math.min(1, samples[i])); view.setInt16(44 + i * 2, sample < 0 ? sample * 32768 : sample * 32767, true); }
  return { blob: new Blob([bytes], { type: 'audio/wav' }), duration: samples.length / 16000 };
}
