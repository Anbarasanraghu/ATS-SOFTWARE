// Shared scanner beep — a loud, crisp supermarket "beep" on every successful
// barcode read (camera or USB/keyboard).
//
// Browsers keep audio SUSPENDED until a user gesture. Because a camera scan
// fires from a detect callback (not a click), the context would never unlock
// and you'd hear nothing. So we unlock the AudioContext on the very first user
// interaction (pointer/key/touch) anywhere on the page, then reuse it.
let _audio: AudioContext | null = null;

function ctx(): AudioContext | null {
  try {
    if (!_audio) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      _audio = new Ctx();
    }
    if (_audio.state === "suspended") void _audio.resume();
    return _audio;
  } catch { return null; }
}

function tone(freq: number, gain: number, dur: number, type: OscillatorType = "square") {
  const c = ctx();
  if (!c) return;
  const now = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain, now + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.connect(g); g.connect(c.destination);
  o.start(now);
  o.stop(now + dur + 0.02);
}

/** Loud success beep on each scan. */
export function beep() {
  tone(1000, 0.9, 0.18);
}

/** Lower error tone for not-found / blocked scans. */
export function errorBeep() {
  tone(220, 0.5, 0.28, "sawtooth");
}

// Unlock the audio context (and warm it with a silent blip) on first gesture.
if (typeof window !== "undefined") {
  const unlock = () => {
    const c = ctx();
    if (c) {
      try {
        const o = c.createOscillator();
        const g = c.createGain();
        g.gain.value = 0.0001;
        o.connect(g); g.connect(c.destination);
        o.start(); o.stop(c.currentTime + 0.01);
      } catch { /* ignore */ }
    }
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  window.addEventListener("touchstart", unlock);
}
