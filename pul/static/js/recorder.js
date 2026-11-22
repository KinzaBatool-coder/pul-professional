/** Microphone recorder with live level meter and silence detection. */
export class Recorder {
  constructor({ onLevel = () => {}, autoStop = () => true } = {}) {
    this.onLevel = onLevel;
    this.autoStop = autoStop;
    this.recorder = null;
  }

  get active() { return !!this.recorder; }

  /** Starts recording; resolves with a Blob (or null if no speech) once stopped. */
  async start() {
    const stream = await navigator.mediaDevices.getUserMedia(
      { audio: { echoCancellation: true, noiseSuppression: true } });
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    const chunks = [];
    const rec = new MediaRecorder(stream);
    this.recorder = rec;

    let spoke = false, lastVoice = 0, raf = 0;
    const began = performance.now();

    return new Promise((resolve) => {
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) { const d = (v - 128) / 128; sum += d * d; }
        const rms = Math.sqrt(sum / buf.length);
        this.onLevel(Math.min(rms * 8, 1));
        const now = performance.now();
        if (rms > 0.02) { spoke = true; lastVoice = now; }
        if (this.autoStop()) {
          if (spoke && now - lastVoice > 1500) return rec.stop();
          if (!spoke && now - began > 10000) return rec.stop();
        }
        if (now - began > 60000) return rec.stop();
        raf = requestAnimationFrame(tick);
      };
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((t) => t.stop());
        ctx.close();
        this.onLevel(0);
        this.recorder = null;
        resolve(spoke ? new Blob(chunks, { type: rec.mimeType }) : null);
      };
      rec.start();
      tick();
    });
  }

  stop() { if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop(); }
}
