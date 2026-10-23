/* Independent narration and music, gesture-gated playback. Presentation only: no learning gates.
   One narration element, generation-guarded requests, and cancellable cue gaps. */
(() => {
  'use strict';
  const clips = window.FieldworkNarration;
  const voice = document.querySelector('#narration-player');
  const music = document.querySelector('#music-player');
  const narrationToggle = document.querySelector('#narration-toggle');
  const musicToggle = document.querySelector('#music-toggle');
  const pauseButton = document.querySelector('#narration-pause');
  const replayButton = document.querySelector('#narration-replay');
  const title = document.querySelector('#narration-title');
  const text = document.querySelector('#narration-copy');
  const status = document.querySelector('#media-status');
  let prefs = {}; try { prefs = JSON.parse(sessionStorage.getItem('fieldwork-audio-v2')) || {}; } catch { /* Storage is optional. */ }
  let narrationOn = prefs.narration !== false, musicOn = prefs.music !== false, paused = false, active = false, armed = false;
  let musicVolume = typeof prefs.musicVolume === 'number' ? Math.max(0,Math.min(1,prefs.musicVolume)) : .8;
  voice.volume = typeof prefs.voiceVolume === 'number' ? Math.max(0,Math.min(1,prefs.voiceVolume)) : 1;
  document.querySelector('#narration-volume').value = voice.volume * 100;
  document.querySelector('#music-volume').value = musicVolume * 100;
  function savePreferences() { try { sessionStorage.setItem('fieldwork-audio-v2',JSON.stringify({narration:narrationOn,music:musicOn,voiceVolume:voice.volume,musicVolume})); } catch { /* Non-blocking. */ } }
  let queue = [1], index = 0, key = 'stage-0', stage = 0;
  let generation = 0, musicGeneration = 0, gapTimer, releaseTimer, musicStopTimer;
  const nativeMusic = location.protocol === 'file:' || !(window.AudioContext || window.webkitAudioContext);
  music.dataset.route = nativeMusic ? 'native' : 'web-audio';
  let nativeFade, effectMultiplier = .75;
  let context, gain, urgent = false, reserved = false, effectUntil = 0, effectTimer;
  const id = () => queue[index];

  // Native preload="auto" is only a hint (and is often ignored on mobile Safari).
  // Fetch original bytes for the current/next hotspot and short correct feedback, then
  // reuse a local Blob URL with the same single, gesture-started narration player.
  const narrationCache = new Map();
  let wanted = [], loading, lastHotspot = 3;
  const hotspot = n => n >= 3 && n <= 6;
  const cacheable = n => hotspot(n) || n === 7;
  const canWarm = location.protocol !== 'file:' && window.fetch && window.AbortController && URL.createObjectURL;
  function warmNarration(ids) {
    wanted = narrationOn && !document.hidden ? [...new Set(ids)].filter(n => cacheable(n) && !narrationCache.has(n)) : [];
    if (loading && !wanted.includes(loading.id)) { loading.cancelled = true; loading.controller.abort(); }
    pumpNarration();
  }
  function pumpNarration() {
    if (!canWarm || loading || !wanted.length) return;
    // Protect an active native stream on constrained connections. readyState=4
    // can be optimistic: wait for its actual buffered range to cover the clip.
    if (voice.getAttribute('src') && !voice.src.startsWith('blob:') && !voice.paused && !voice.ended && !voice.error &&
        (!Number.isFinite(voice.duration) || !voice.buffered.length || voice.buffered.end(voice.buffered.length - 1) < voice.duration - .1)) return;
    const next = wanted[0], controller = new AbortController();
    const task = loading = { id: next, controller };
    const timeout = setTimeout(() => controller.abort(), 30000);
    fetch('assets/audio/' + clips[next].file, { signal: controller.signal, priority: 'low' })
      .then(response => { if (!response.ok) throw new Error('Narration preload unavailable'); return response.blob(); })
      .then(blob => {
        if (controller.signal.aborted || !blob.size || blob.size > 1024 * 1024) return;
        // Explicit MP3 MIME also supports servers that return application/octet-stream.
        narrationCache.set(next, URL.createObjectURL(new Blob([blob], { type: 'audio/mpeg' })));
      })
      .catch(() => { /* A speculative failure never interrupts the course or current audio. */ })
      .finally(() => {
        clearTimeout(timeout);
        if (loading !== task) return;
        loading = undefined;
        if (!task.cancelled) wanted = wanted.filter(n => n !== next);
        pumpNarration();
      });
  }
  function discardNarration(n) {
    const url = narrationCache.get(n);
    if (url) { narrationCache.delete(n); URL.revokeObjectURL(url); }
  }
  function warmNextNarration() {
    if (stage !== 0 && stage !== 1) return;
    if (id() === 23 || id() === 2) warmNarration([7, lastHotspot, lastHotspot + 1]);
    else if (hotspot(id())) warmNarration([7, id() + 1]);
    else if (id() === 7) warmNarration(hotspot(lastHotspot + 1) ? [lastHotspot + 1] : []);
  }

  function updateControls() {
    narrationToggle.setAttribute('aria-pressed', String(narrationOn));
    document.querySelector('#narration-state').textContent = narrationOn ? 'ON' : 'OFF';
    musicToggle.setAttribute('aria-pressed', String(musicOn));
    document.querySelector('#music-state').textContent = musicOn ? 'ON' : 'OFF';
    pauseButton.disabled = !narrationOn || !id();
    replayButton.disabled = !narrationOn || !id();
    pauseButton.textContent = paused ? 'Resume narration' : 'Pause narration';
    // Cinematic visual timing is independent of the narration preference.

    document.querySelector('#cinematic-mute').textContent = narrationOn ? 'Mute narration' : 'Enable narration';
    document.querySelector('#cinematic-music').textContent = musicOn ? 'Music ON' : 'Music OFF';
    document.querySelector('#audio-bar').dataset.narration = active ? 'playing' : paused ? 'paused' : 'idle';
  }
  function reading() {
    const clip = clips[id()];
    title.textContent = clip ? clip.title : 'Narration';
    text.textContent = clip ? clip.text : 'Written guidance is available throughout the course.';
  }
  function musicLevel() {
    if (!musicOn) return 0;
    // The limited replacement master is 13dB louder than the previous source.
    // Keep a comfortable bed, then duck gently rather than suppressing it.
    let duckLevel = active || reserved ? (urgent ? .5 : .65) : 1;
    if (performance.now() < effectUntil) duckLevel = Math.min(duckLevel,effectMultiplier);
    return musicVolume * (stage === 0 || stage === 4 ? .25 : .22) * duckLevel;
  }
  function fadeMusic(seconds = .3) {
    const target = musicLevel();
    music.dataset.targetVolume = String(target);
    if (nativeMusic) {
      // file:// origins can be opaque: MediaElementAudioSource may silently output zero.
      // Native media playback avoids that routing restriction. Use cancellable volume ramps.
      cancelAnimationFrame(nativeFade);
      const from = music.volume, started = performance.now();
      const ramp = now => {
        const fraction = Math.min(1,(now-started)/(seconds*1000));
        music.volume = Math.max(0,Math.min(1,from+(target-from)*fraction));
        if (fraction < 1) nativeFade = requestAnimationFrame(ramp);
      };
      nativeFade = requestAnimationFrame(ramp);
      return;
    }
    if (!gain || !context) return;
    const now = context.currentTime;
    if (gain.gain.cancelAndHoldAtTime) gain.gain.cancelAndHoldAtTime(now);
    else { const current = gain.gain.value; gain.gain.cancelScheduledValues(now); gain.gain.setValueAtTime(current, now); }
    gain.gain.linearRampToValueAtTime(musicLevel(), now + seconds);
    // Expose the intended mix as readable state, useful for UI and integration tests.
    music.dataset.targetVolume = String(musicLevel());
  }
  function duck() { clearTimeout(releaseTimer); reserved = true; fadeMusic(.12); }
  function release() {
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => { reserved = false; urgent = false; fadeMusic(.65); }, 400);
  }
  function stop() {
    ++generation; clearTimeout(gapTimer); clearTimeout(releaseTimer);
    voice.pause(); active = false; paused = false; reserved = false; urgent = false;
    voice.removeAttribute('src'); delete voice.dataset.clip; voice.load();
    fadeMusic(performance.now() < effectUntil ? .08 : .35); updateControls();
  }
  function failed(message) {
    active = false; paused = true; reserved = false; urgent = false;
    status.dataset.channel = 'narration';
    status.textContent = message + ' You can continue using the written guidance.';
    fadeMusic(.5); updateControls();
  }
  function playClip(delay = 0) {
    const clip = clips[id()]; if (!armed || !narrationOn || !clip || document.hidden) return;
    const ticket = ++generation; clearTimeout(gapTimer);
    voice.pause(); active = false; paused = false; duck(); reading(); updateControls();
    const start = () => {
      if (ticket !== generation || !narrationOn || paused || document.hidden) return;
      const buffered = narrationCache.get(clip.id);
      // A fast learner may beat preloading. Stream immediately rather than waiting
      // for a whole file, and cancel competing speculative work on a cold hotspot.
      if (!buffered) warmNarration([]);
      if (hotspot(clip.id)) lastHotspot = clip.id;
      const source = buffered || 'assets/audio/' + clip.file;
      if (voice.getAttribute('src') !== source) voice.src = source;
      voice.dataset.clip = String(clip.id);
      // A newly assigned source starts at zero. Avoid seeking before metadata on Safari.
      if (voice.readyState > 0) voice.currentTime = 0;
      const promise = voice.play();
      if (promise) promise.catch(error => {
        if (ticket === generation && error.name === 'NotSupportedError') discardNarration(clip.id);
        if (ticket === generation && error.name !== 'AbortError') failed('Narration could not start. Use Replay to try again.');
      });
    };
    if (delay) gapTimer = setTimeout(start, delay); else start();
  }
  function setContext(ids, options = {}) {
    const nextKey = options.key || ids.join('-');
    if (nextKey === key) return; // Repeat clicks do not restart the same performance.
    stop(); queue = ids.filter(n => clips[n]); index = 0; key = nextKey; urgent = !!options.urgent;
    reading(); updateControls();
    if (options.play === false && stage === 0 && id() === 1) warmNarration([7, lastHotspot]);
    if (options.play === false && stage === 1 && hotspot(id())) { lastHotspot = id(); warmNarration([7, id(), id() + 1]); }
    if (armed && narrationOn && options.play !== false) playClip(urgent ? 240 : 0);
  }
  voice.addEventListener('playing', () => { if (!narrationOn || paused || document.hidden) { voice.pause(); return; } active = true; if (status.dataset.channel === 'narration') status.textContent = ''; duck(); updateControls(); warmNextNarration(); });
  voice.addEventListener('progress', pumpNarration);
  voice.addEventListener('durationchange', pumpNarration);
  voice.addEventListener('ended', () => {
    const endedId = id(); active = false;
    window.dispatchEvent(new CustomEvent('fieldwork:narration-ended', {detail:{id:endedId}}));
    // A cinematic close may have changed the context synchronously.
    if (id() !== endedId || !voice.getAttribute('src')) return;
    if (index + 1 < queue.length && narrationOn) { ++index; playClip(urgent ? 400 : 260); }
    else { paused = true; release(); updateControls(); }
  });
  voice.addEventListener('error', () => { if (voice.getAttribute('src')) { discardNarration(Number(voice.dataset.clip)); failed('This narration recording is unavailable.'); } });
  narrationToggle.addEventListener('click', () => {
    if (narrationOn) { narrationOn = false; warmNarration([]); stop(); status.textContent = 'Narration off.'; }
    else { narrationOn = true; armed = true; status.textContent = ''; playClip(); }
    savePreferences(); updateControls();
  });
  pauseButton.addEventListener('click', () => {
    if (!narrationOn || !id()) return;
    armed = true;
    if (paused) {
      paused = false; duck(); updateControls();
      if (voice.getAttribute('src') && !voice.ended) {
        const ticket = generation;
        voice.play().catch(() => { if (ticket === generation) failed('Narration could not resume.'); });
      } else playClip();
    } else {
      ++generation; clearTimeout(gapTimer); voice.pause(); active = false; paused = true; release(); updateControls();
    }
  });
  replayButton.addEventListener('click', () => { if (narrationOn) { armed = true; playClip(urgent ? 240 : 0); } });
  function musicState() {
    const label = document.querySelector('#music-playback-state');
    label.textContent = !musicOn ? 'Music off.' : !armed ? 'Audio ready — starts after Begin Inspection.' : !nativeMusic && context?.state !== 'running' ? 'Music paused — select Resume audio to continue.' : music.paused ? 'Music paused — select Resume audio to continue.' : 'Music playing.';
    document.querySelector('#music-resume').hidden = !musicOn || !armed || ((nativeMusic || context?.state === 'running') && !music.paused);
  }
  async function startMusic() {
    if (!musicOn || !armed || document.hidden) return;
    const ticket = ++musicGeneration; clearTimeout(musicStopTimer);
    try {
      if (!music.getAttribute('src')) {
        if (!nativeMusic) {
          const Audio = window.AudioContext || window.webkitAudioContext;
          context = new Audio(); gain = context.createGain(); gain.gain.value = 0;
          context.createMediaElementSource(music).connect(gain); gain.connect(context.destination);
          context.addEventListener('statechange', musicState);
        } else music.volume = 0;
        // Prepared from the replacement master: full musical bed, trimmed silence, baked seam.
        music.src = 'assets/audio/fieldwork_ambient_1_loop.' + (!nativeMusic && music.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3');
      }
      const resumed = nativeMusic ? Promise.resolve() : context.resume();
      const playing = music.play(); // Both unlock requests stay inside the learner gesture.
      fadeMusic(.8);
      await Promise.all([resumed, playing]);
      if (ticket !== musicGeneration || !musicOn) return;
      if (!nativeMusic && context.state !== 'running') throw new Error('Music device unavailable');
      if (status.dataset.channel === 'music') status.textContent = '';
      musicState();
    } catch (error) {
      if (ticket !== musicGeneration) return;
      music.pause(); fadeMusic(.1); updateControls(); musicState();
      status.dataset.channel = 'music';
      status.textContent = 'Music could not start. Use Resume audio to try again. The course remains available.';
    }
  }
  musicToggle.addEventListener('click', () => {
    armed = true; musicOn = !musicOn; savePreferences(); updateControls();
    if (musicOn) startMusic();
    else {
      const ticket = ++musicGeneration; clearTimeout(musicStopTimer); fadeMusic(.24);
      musicStopTimer = setTimeout(() => { if (ticket === musicGeneration) music.pause(); }, 260);
    }
    musicState();
  });
  document.querySelector('#music-resume').addEventListener('click',startMusic);
  for (const event of ['playing','pause','ended']) music.addEventListener(event,musicState);
  document.querySelector('#narration-volume').addEventListener('input',e=>{ voice.volume = Number(e.target.value)/100; savePreferences(); });
  document.querySelector('#music-volume').addEventListener('input',e=>{ musicVolume = Number(e.target.value)/100; savePreferences(); fadeMusic(.2); });
  music.addEventListener('error', () => { if (music.getAttribute('src')) { music.pause(); fadeMusic(.1); updateControls(); musicState(); status.dataset.channel = 'music'; status.textContent = 'Music is unavailable. You can continue without it.'; } });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    warmNarration([]);
    if (active || reserved) { ++generation; clearTimeout(gapTimer); voice.pause(); active = false; paused = true; reserved = false; urgent = false; updateControls(); }
    music.pause(); // Never resume audible content merely because a tab becomes visible.
    ++musicGeneration; clearTimeout(musicStopTimer); fadeMusic(.1); updateControls(); musicState();
  });
  window.addEventListener('pagehide', () => { narrationOn = false; warmNarration([]); ++musicGeneration; clearTimeout(musicStopTimer); stop(); music.pause(); for (const n of narrationCache.keys()) discardNarration(n); });
  window.FieldworkMedia = Object.freeze({
    setContext,
    setStage(nextStage) { stage = nextStage; if (stage !== 0 && stage !== 1) warmNarration([]); fadeMusic(.5); },
    stop,
    effect(cue) {
      if (!window.FieldworkSound?.enabled()) return;
      effectMultiplier = cue === 'incorrect' ? .5 : .75;
      effectUntil = performance.now() + 320; clearTimeout(effectTimer); fadeMusic(.08);
      effectTimer = setTimeout(() => { effectUntil = 0; fadeMusic(.5); },320);
    },
    voicePlaying() { return active || reserved; },
    pauseCinematic(value) {
      if (value && !paused && narrationOn) pauseButton.click();
      else if (!value && paused && narrationOn) pauseButton.click();
    },
    cinematic() { armed = true; updateControls(); startMusic(); window.FieldworkSound?.activate(); setContext([23], {key:'cinematic-' + generation}); }
  });
  reading(); updateControls(); musicState();
})();
