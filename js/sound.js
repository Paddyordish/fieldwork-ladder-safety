/* Optional interface audio. Channels default on; contexts and playback require learner interaction.
   This module owns presentation only; it never reads or changes learning state. */
(() => {
  'use strict';
  const control = document.querySelector('#sound-toggle');
  const label = document.querySelector('#sound-state');
  const status = document.querySelector('#sound-status');
  let context, master, enabled = true, generation = 0;
  try { enabled = sessionStorage.getItem('fieldwork-effects-v2') !== 'off'; } catch { /* Optional storage. */ }
  const voices = new Set();
  const savePreference = () => { try { sessionStorage.setItem('fieldwork-effects-v2',enabled ? 'on' : 'off'); } catch { /* Optional storage. */ } };

  function update() {
    control.setAttribute('aria-pressed', String(enabled));
    label.textContent = enabled ? 'ON' : 'OFF';
  }
  function stopVoices() {
    for (const source of voices) { try { source.stop(); } catch { /* Already ended. */ } }
    voices.clear();
  }
  function unavailable() {
    enabled = false;
    if (master) master.gain.value = 0;
    stopVoices();
    update();
    label.textContent = 'N/A';
    control.disabled = true;
    control.title = 'Sound is unavailable in this browser. The course remains fully usable.';
    status.textContent = control.title;
  }
  // Every voice has a short attack/release to avoid discontinuities and pops.
  function connect(source, frequency, start, duration, level, type = 'sine') {
    const envelope = context.createGain();
    if (source.frequency) { source.type = type; source.frequency.setValueAtTime(frequency, start); }
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(level, start + .006);
    envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
    source.connect(envelope); envelope.connect(master);
    voices.add(source);
    source.onended = () => { voices.delete(source); source.disconnect(); envelope.disconnect(); };
    source.start(start); source.stop(start + duration + .012);
  }
  function tone(frequency, offset, duration, level, type) {
    connect(context.createOscillator(), frequency, context.currentTime + offset, duration, level, type);
  }
  function mechanicalClick() {
    // A small, filtered noise transient over a damped metal resonance.
    const frames = Math.ceil(context.sampleRate * .035);
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 147;
    for (let i = 0; i < frames; i++) {
      seed = (seed * 16807) % 2147483647;
      samples[i] = (seed / 1073741823.5 - 1) * (1 - i / frames);
    }
    const noise = context.createBufferSource(); noise.buffer = buffer;
    const filter = context.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 1250; filter.Q.value = .7;
    // Route the noise through a filter while using the same bounded envelope.
    const output = context.createGain();
    output.gain.setValueAtTime(0, context.currentTime);
    output.gain.linearRampToValueAtTime(.10, context.currentTime + .003);
    output.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .045);
    noise.connect(filter); filter.connect(output); output.connect(master);
    voices.add(noise);
    noise.onended = () => { voices.delete(noise); noise.disconnect(); filter.disconnect(); output.disconnect(); };
    noise.start(); noise.stop(context.currentTime + .05);
    tone(760, 0, .055, .045, 'sine');
    tone(1520, .004, .035, .012, 'sine');
  }
  function play(cue) {
    if (!enabled || !context || context.state !== 'running' || document.hidden) return;
    try {
      stopVoices(); // Rapid activations cannot accumulate loud overlapping cues.
      if (cue === 'select') mechanicalClick();
      else if (cue === 'complete') {
        tone(620, 0, .12, .08, 'sine'); tone(930, .065, .16, .065, 'sine');
      } else if (cue === 'correct') {
        tone(520, 0, .13, .065, 'triangle'); tone(780, .055, .17, .05, 'sine');
      } else if (cue === 'incorrect') {
        tone(240, 0, .12, .07, 'sine'); tone(195, .065, .15, .055, 'sine');
      }
    } catch { unavailable(); } // Audio failure must never interrupt the course.
  }
  async function activate() {
    if (!enabled) return;
    const ticket = ++generation;
    try {
      if (!context) { const Audio = window.AudioContext || window.webkitAudioContext; context = new Audio(); master = context.createGain(); master.gain.value = 0; master.connect(context.destination); }
      await context.resume();
      if (ticket !== generation || !enabled) return;
      if (context.state !== 'running') throw new Error('Audio context did not resume');
      master.gain.setValueAtTime(.24,context.currentTime);
    } catch { if (ticket === generation) unavailable(); }
  }
  control.addEventListener('click', async () => {
    const ticket = ++generation;
    if (enabled) {
      enabled = false;
      if (master) master.gain.setValueAtTime(0, context.currentTime);
      stopVoices(); savePreference(); update(); return;
    }
    enabled = true; savePreference(); update();
    try {
      if (!context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) throw new Error('Web Audio is unavailable');
        context = new Audio(); master = context.createGain(); master.gain.value = 0; master.connect(context.destination);
      }
      // Called directly from the learner gesture for browser autoplay policies.
      await context.resume();
      if (ticket !== generation || !enabled) return; // A later mute wins over a pending resume.
      if (context.state !== 'running') throw new Error('Audio context did not resume');
      master.gain.setValueAtTime(.24, context.currentTime);
      play('select');
    } catch { if (ticket === generation) unavailable(); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopVoices(); });
  window.addEventListener('pagehide', () => { enabled = false; ++generation; stopVoices(); update(); });
  window.FieldworkSound = Object.freeze({ play, activate, enabled: () => enabled && context?.state === 'running' });
  update();
})();
