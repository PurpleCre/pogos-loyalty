// Browser audio starts only after an explicit staff gesture. No remote service.
let context: AudioContext | null = null;
export async function prepareBranchSound() {
  if (typeof AudioContext === 'undefined') throw new Error('Sound is unavailable in this browser.');
  context ??= new AudioContext();
  await context.resume();
  if (context.state !== 'running') throw new Error('Browser sound is blocked.');
}
export async function playBranchSound(isCurrent: () => boolean) {
  if (!isCurrent()) return;
  if (!context || context.state !== 'running') throw new Error('Enable sound again to resume audible alerts.');
  const oscillator = context.createOscillator(); const gain = context.createGain();
  oscillator.connect(gain); gain.connect(context.destination);
  oscillator.frequency.value = 740;
  gain.gain.setValueAtTime(.1, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .35);
  oscillator.start(); oscillator.stop(context.currentTime + .35);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}
export async function clearBranchSounds() { if (context) { const previous = context; context = null; await previous.close(); } }
