'use strict';
/* The hidden page that listens to one tab for the music button (src/main.js, songListen).
   The browser hands it that tab's sound (and only that tab's: not the computer's), while the tab keeps playing
   it normally. It keeps 16 kHz mono samples, at most 12 seconds; main takes them while it listens. */
(() => {
  const MAX = 16000 * 12;
  let ctx = null, stream = null, buf = null, n = 0;
  const stop = () => {
    try { if (ctx) ctx.close(); } catch (e) {}
    try { if (stream) stream.getTracks().forEach(t => t.stop()); } catch (e) {}
    ctx = null; stream = null;
  };
  window.rec = {
    async start() {
      stop(); buf = new Int16Array(MAX); n = 0;
      try { stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }); }
      catch (e) { return 'denied: ' + (e && e.name || e); }
      stream.getVideoTracks().forEach(t => t.stop());   // only the sound is wanted
      const a = stream.getAudioTracks();
      if (!a.length) { stop(); return 'no-audio'; }
      ctx = new AudioContext({ sampleRate: 16000 });
      const src = ctx.createMediaStreamSource(new MediaStream(a));
      const proc = ctx.createScriptProcessor(4096, 1, 1);   // one input channel: the browser mixes stereo down
      proc.onaudioprocess = e => {
        const d = e.inputBuffer.getChannelData(0);
        for (let i = 0; i < d.length && n < MAX; i++) { const v = Math.max(-1, Math.min(1, d[i])); buf[n++] = v < 0 ? v * 32768 : v * 32767; }
      };
      src.connect(proc); proc.connect(ctx.destination);   // (its output is silent; it only has to run)
      if (ctx.state !== 'running') { try { await ctx.resume(); } catch (e) {} }
      return 'ok';
    },
    // what was heard so far, as base64 of 16-bit little-endian samples
    take() {
      if (!buf) return '';
      const b = new Uint8Array(buf.buffer, 0, n * 2);
      let s = '';
      for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
      return btoa(s);
    },
    seconds() { return n / 16000; },
    stop
  };
})();
