import confetti from "canvas-confetti";

// Little celebration for an advent day marked done: a few bars of Jingle
// Bells with sleigh bells, and a burst of confetti. All synthesized, so
// there is no audio file to load.
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

// A glockenspiel note: a pure tone with a soft octave and a bright
// overtone, ringing out for about a second.
function chime(at: number, freq: number, gain: number) {
  if (!ctx) return;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, at);
  out.gain.linearRampToValueAtTime(gain, at + 0.005);
  out.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
  out.connect(ctx.destination);
  for (const [ratio, level] of [[1, 1], [2, 0.25], [2.76, 0.12]] as const) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq * ratio;
    g.gain.value = level;
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + 1.15);
  }
}

// Sleigh bells: a short burst of bright, high noise.
let noise: AudioBuffer | null = null;
function sleigh(at: number, gain: number) {
  if (!ctx) return;
  if (!noise) {
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 6500;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, at);
  out.gain.linearRampToValueAtTime(gain, at + 0.01);
  out.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
  src.connect(hp).connect(out).connect(ctx.destination);
  src.start(at);
  src.stop(at + 0.2);
}

// The opening of "Jingle Bells" (traditional) on chimes, with the sleigh
// bells shaking on every beat. About three and a half seconds.
const E = 659.25, G = 783.99, C = 523.25, D = 587.33;
const TUNE: [number, number][] = [
  [E, 1], [E, 1], [E, 2],
  [E, 1], [E, 1], [E, 2],
  [E, 1], [G, 1], [C, 1.5], [D, 0.5], [E, 4],
];

// Plays once the context is running (the first tap may still be resuming it).
function whenRunning(play: () => void) {
  if (!ctx) return;
  if (ctx.state === "running") play();
  else void ctx.resume().then(play, () => {});
}

function jingle() {
  if (!ctx) return;
  const beat = 0.2;
  const t0 = ctx.currentTime + 0.03;
  let t = t0;
  for (const [freq, len] of TUNE) {
    chime(t, freq, 0.22);
    t += len * beat;
  }
  for (let i = 0; i < 16; i++) sleigh(t0 + i * beat, i % 2 === 0 ? 0.09 : 0.05);
}

// A locked door: two falling chimes, a friendly "uh-oh".
export function denied() {
  whenRunning(() => {
    const t0 = ctx!.currentTime + 0.03;
    chime(t0, 783.99, 0.25);
    chime(t0 + 0.25, 622.25, 0.25);
  });
}

export function celebrate() {
  whenRunning(jingle);
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;
  const colors = ["#c8102e", "#e8a33d", "#2f7d4f", "#ffffff", "#f4c542"];
  void confetti({ particleCount: 90, spread: 75, startVelocity: 38, origin: { y: 0.65 }, colors, zIndex: 9999, disableForReducedMotion: true });
  setTimeout(() => {
    void confetti({ particleCount: 40, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors, zIndex: 9999, disableForReducedMotion: true });
    void confetti({ particleCount: 40, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors, zIndex: 9999, disableForReducedMotion: true });
  }, 180);
}

// Everyday wins (a bucket list item, a quiz result): a bright rising
// arpeggio and warm-coloured confetti, no Christmas bells.
export function cheer() {
  whenRunning(() => {
    const t0 = ctx!.currentTime + 0.03;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => chime(t0 + i * 0.11, f, 0.2));
  });
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#cc3a3a", "#f08a5d", "#f4c542", "#ffffff", "#e85d75"];
  void confetti({ particleCount: 100, spread: 80, startVelocity: 40, origin: { y: 0.7 }, colors, zIndex: 9999, disableForReducedMotion: true });
}

// "Thinking of you": one soft, high note.
export function heartPing() {
  whenRunning(() => chime(ctx!.currentTime + 0.02, 1046.5, 0.15));
}
