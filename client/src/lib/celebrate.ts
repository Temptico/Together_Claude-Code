import confetti from "canvas-confetti";

// Little celebration for an advent day marked done: sleigh bells and a
// burst of confetti. The bells are synthesized (no audio file to load).
//
// iOS only lets a page make sound after an AudioContext was started inside
// a tap, so call unlockAudio() in the click handler and celebrate() once
// the request succeeds.

let ctx: AudioContext | null = null;

export function unlockAudio() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

// One bell strike: a few inharmonic high partials that die away fast.
function strike(at: number, gain: number) {
  if (!ctx) return;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, at);
  out.gain.linearRampToValueAtTime(gain, at + 0.004);
  out.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
  out.connect(ctx.destination);
  const base = 2300 + Math.random() * 300;
  for (const ratio of [1, 1.47, 2.09, 2.76]) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = base * ratio;
    osc.connect(out);
    osc.start(at);
    osc.stop(at + 0.25);
  }
}

function jingle() {
  if (!ctx || ctx.state !== "running") return;
  const t0 = ctx.currentTime + 0.02;
  // Two shakes of the sleigh bells, each a quick cluster of strikes.
  for (const shake of [0, 0.38]) {
    for (let i = 0; i < 9; i++) {
      strike(t0 + shake + i * 0.028 + Math.random() * 0.015, 0.05 + Math.random() * 0.04);
    }
  }
}

export function celebrate() {
  jingle();
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;
  const colors = ["#c8102e", "#e8a33d", "#2f7d4f", "#ffffff", "#f4c542"];
  void confetti({ particleCount: 90, spread: 75, startVelocity: 38, origin: { y: 0.65 }, colors, zIndex: 9999, disableForReducedMotion: true });
  setTimeout(() => {
    void confetti({ particleCount: 40, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors, zIndex: 9999, disableForReducedMotion: true });
    void confetti({ particleCount: 40, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors, zIndex: 9999, disableForReducedMotion: true });
  }, 180);
}
