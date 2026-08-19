/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

let audioCtx: AudioContext | null = null;
/* Sound is on by default; the AudioContext is created lazily on the first
   click so the browser's user-gesture requirement is always satisfied. */
let soundEnabled = true;

export function toggleSound(): boolean {
  soundEnabled = !soundEnabled;
  if (soundEnabled && !audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn("Failed to create AudioContext", e);
    }
  }
  return soundEnabled;
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

export function playTick() {
  if (!soundEnabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    osc.type = 'sine';
    
    // Crisp tick sound: rapid pitch slide with clean exponential decay
    osc.frequency.setValueAtTime(1000, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.04);
    
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    
    osc.start(now);
    osc.stop(now + 0.05);
  } catch (e) {
    console.warn("Audio tick play error", e);
  }
}

/* Falling pieces in the two counting games. Deliberately unlike playTick —
   that is the countdown's voice, and reusing it made a board of thirty
   dropping pieces sound like a timer running out. This is a soft low
   triangle thud with no pitch slide. */
export function playDrop() {
  if (!soundEnabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    osc.type = "triangle";
    /* A touch of jitter so a fast run of pieces does not machine-gun one pitch */
    const base = 190 + Math.random() * 40;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 0.72, now + 0.07);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.075, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    osc.start(now);
    osc.stop(now + 0.1);
  } catch (e) {
    console.warn("Audio drop play error", e);
  }
}

export function playRevealInterval() {
  if (!soundEnabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    const now = audioCtx.currentTime;
    
    // Note 1 (E4 - 329.63Hz)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(329.63, now);
    
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.08, now + 0.06);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    
    osc1.start(now);
    osc1.stop(now + 0.4);
    
    // Note 2 (A4 - 440.00Hz) - Staggered by 60ms
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(440.00, now + 0.06);
    
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.setValueAtTime(0, now + 0.06);
    gain2.gain.linearRampToValueAtTime(0.08, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.41);
    
    osc2.start(now);
    osc2.stop(now + 0.45);
  } catch (e) {
    console.warn("Audio reveal play error", e);
  }
}

export function triggerHaptic() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(10);
    } catch (e) {
      // Ignored
    }
  }
}
