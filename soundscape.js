/* Levuzo — original bowed-string soundscape with a single mute control. No external audio. */
(() => {
  'use strict';
  const toggle = document.querySelector('#sound-toggle');
  if (!toggle) return;
  const status = document.querySelector('#sound-status');
  const invitations = [...document.querySelectorAll('[data-sound-enable]')];
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const voices = new Set();
  const midi = n => 440 * 2 ** ((n - 69) / 12);
  let context, master, compressor, musicBus, effectsBus, reverbInput, reverb, wet;
  let stringWave, bowNoise, enabled = true, revision = 0, scheduler = 0, resumePending = 0;
  let suspendTimer = 0, nextStep = 0, step = 0;
  let lastEffect = -Infinity, disposed = false;

  const level = () => .34;
  const musicOn = () => true;
  const canPlay = () => enabled && !document.hidden && context?.state === 'running';
  function announce(message) { if (status) status.textContent = message; }

  function renderState() {
    const playing = canPlay();
    document.documentElement.dataset.sound = playing ? 'on' : enabled ? 'ready' : 'off';
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.setAttribute('aria-label', enabled ? 'Mute sound' : 'Enable sound');
    toggle.title = enabled && !playing ? 'Sound will begin with your next tap. Tap here to mute.' : enabled ? 'Mute sound' : 'Enable sound';
    const label = toggle.querySelector('.sound-label');
    if (label) label.textContent = enabled ? 'Sound on' : 'Sound off';
    invitations.forEach(button => {
      button.setAttribute('aria-pressed', String(enabled));
      button.setAttribute('aria-label', enabled ? 'Mute sound' : 'Enable sound');
      const text = button.querySelector('.sound-enable-label');
      if (text) text.textContent = enabled ? 'Sound on · tap to mute' : 'Sound off · tap to listen';
    });
    announce(!enabled ? 'Sound is muted.' : document.hidden ? 'Sound is paused while this page is hidden.' : playing ? 'Sound is on.' : 'Sound will begin with your first tap or key press.');
  }

  // A seeded impulse produces a quiet, diffuse stereo room without an audio download.
  function makeReverb() {
    const duration = 2.65;
    const buffer = context.createBuffer(2, Math.ceil(context.sampleRate * duration), context.sampleRate);
    let seed = 190719;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let softened = 0;
      for (let i = 0; i < data.length; i++) {
        softened = softened * .62 + (random() * 2 - 1) * .38;
        const time = i / context.sampleRate;
        data[i] = softened * Math.exp(-time * 2.6) * Math.min(1, time / .025);
      }
    }
    return buffer;
  }

  function makeAudio() {
    if (context) return;
    if (!AudioContextClass) throw new Error('Audio is not supported by this browser.');
    context = new AudioContextClass({ latencyHint: 'interactive' });
    master = context.createGain(); master.gain.value = 0;
    musicBus = context.createGain(); musicBus.gain.value = .8;
    effectsBus = context.createGain(); effectsBus.gain.value = .9;
    reverbInput = context.createGain(); reverbInput.gain.value = .28;
    reverb = context.createConvolver(); reverb.buffer = makeReverb();
    wet = context.createGain(); wet.gain.value = .34;
    const roomFilter = context.createBiquadFilter();
    roomFilter.type = 'lowpass'; roomFilter.frequency.value = 3500;
    compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -15; compressor.knee.value = 16;
    compressor.ratio.value = 3; compressor.attack.value = .012; compressor.release.value = .3;
    musicBus.connect(master); effectsBus.connect(master);
    reverbInput.connect(reverb); reverb.connect(roomFilter); roomFilter.connect(wet); wet.connect(master);
    master.connect(compressor); compressor.connect(context.destination);

    // Rolled-off bowed harmonics retain a string-like body without a sharp sawtooth edge.
    const real = new Float32Array(17), imaginary = new Float32Array(17);
    for (let harmonic = 1; harmonic < 17; harmonic++) {
      imaginary[harmonic] = Math.pow(harmonic, -1.35) * Math.exp(-harmonic * .065);
      if (harmonic >= 3 && harmonic <= 6) imaginary[harmonic] *= 1.16;
    }
    stringWave = context.createPeriodicWave(real, imaginary);
    bowNoise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const noiseData = bowNoise.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;
    context.onstatechange = () => {
      if (context.state === 'interrupted') resumePending = 0;
      if (!canPlay()) {
        hush();
        // A pending autoplay resume may resolve after a user has already muted.
        if (context.state === 'running' && (!enabled || document.hidden || disposed)) context.suspend().catch(() => {});
      }
      else if (!resumePending) {
        hold(master.gain, context.currentTime);
        master.gain.setTargetAtTime(level() * .58, context.currentTime, .18);
        if (!scheduler) startMusic();
      }
      renderState();
    };
    duckMusic();
  }

  // Let the collection drawers come forward while the room gently recedes.
  function duckMusic() {
    if (!context || !musicBus) return;
    musicBus.gain.setTargetAtTime(document.querySelector('dialog[open]') ? .48 : .8, context.currentTime, .35);
  }
  const drawerObserver = new MutationObserver(duckMusic);
  drawerObserver.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['open'] });

  function hold(parameter, time) {
    if (typeof parameter.cancelAndHoldAtTime === 'function') parameter.cancelAndHoldAtTime(time);
    else { const value = parameter.value; parameter.cancelScheduledValues(time); parameter.setValueAtTime(value, time); }
  }

  // Each finite voice owns and disconnects all its nodes, including its vibrato oscillator.
  function trackVoice(kind, nodes, sources, envelope, end) {
    const voice = { kind, ended: false, stop() {
      if (voice.ended) return;
      const now = context.currentTime;
      hold(envelope.gain, now);
      envelope.gain.setTargetAtTime(0, now, .025);
      sources.forEach(source => { try { source.stop(now + .12); } catch (_) { /* Already ended. */ } });
    } };
    voices.add(voice);
    sources[0].onended = () => {
      voice.ended = true;
      nodes.forEach(node => { try { node.disconnect(); } catch (_) { /* Already disconnected. */ } });
      voices.delete(voice);
    };
    sources.forEach(source => source.stop(end));
    return voice;
  }

  function bowed(note, when, duration, gain = .15, pan = 0, kind = 'music') {
    const frequency = midi(note), attack = Math.min(1.35, duration * .23);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, when);
    envelope.gain.linearRampToValueAtTime(gain, when + attack);
    envelope.gain.linearRampToValueAtTime(gain * .77, when + duration * .6);
    envelope.gain.exponentialRampToValueAtTime(.0001, when + duration);
    const filter = context.createBiquadFilter(); filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(2900, frequency * 7), when); filter.Q.value = .45;
    const panner = context.createStereoPanner(); panner.pan.value = pan;
    filter.connect(envelope); envelope.connect(panner);
    panner.connect(kind === 'music' ? musicBus : effectsBus); panner.connect(reverbInput);
    const first = context.createOscillator(), second = context.createOscillator();
    first.setPeriodicWave(stringWave); second.setPeriodicWave(stringWave);
    first.frequency.value = frequency; second.frequency.value = frequency;
    first.detune.value = -2.3; second.detune.value = 2.3;
    const pairLevel = context.createGain(); pairLevel.gain.value = .5;
    first.connect(pairLevel); second.connect(pairLevel); pairLevel.connect(filter);
    const vibrato = context.createOscillator(), depth = context.createGain();
    vibrato.frequency.value = 4.65 + (note % 5) * .085;
    depth.gain.setValueAtTime(0, when); depth.gain.linearRampToValueAtTime(kind === 'music' ? 6 : 3, when + attack + .2);
    vibrato.connect(depth); depth.connect(first.detune); depth.connect(second.detune);
    const noise = context.createBufferSource(); noise.buffer = bowNoise; noise.loop = true;
    const noiseFilter = context.createBiquadFilter(); noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1650; noiseFilter.Q.value = .7;
    const texture = context.createGain(); texture.gain.value = .014;
    noise.connect(noiseFilter); noiseFilter.connect(texture); texture.connect(filter);
    const sources = [first, second, vibrato, noise];
    sources.forEach(source => source.start(when));
    return trackVoice(kind, [envelope, filter, panner, first, second, pairLevel, vibrato, depth, noise, noiseFilter, texture], sources, envelope, when + duration + .06);
  }

  function chime(note, when, duration = .4, gain = .09) {
    const oscillator = context.createOscillator(), overtone = context.createOscillator();
    oscillator.type = 'sine'; overtone.type = 'sine';
    oscillator.frequency.value = midi(note); overtone.frequency.value = midi(note) * 2;
    const shimmer = context.createGain(); shimmer.gain.value = .16;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, when);
    envelope.gain.linearRampToValueAtTime(gain, when + .012);
    envelope.gain.exponentialRampToValueAtTime(.0001, when + duration);
    oscillator.connect(envelope); overtone.connect(shimmer); shimmer.connect(envelope);
    envelope.connect(effectsBus); envelope.connect(reverbInput);
    oscillator.start(when); overtone.start(when);
    trackVoice('effect', [oscillator, overtone, shimmer, envelope], [oscillator, overtone], envelope, when + duration + .03);
  }

  function breath(when, gain = .09, direction = 1) {
    const noise = context.createBufferSource(); noise.buffer = bowNoise;
    const filter = context.createBiquadFilter(); filter.type = 'bandpass'; filter.Q.value = .55;
    filter.frequency.setValueAtTime(direction > 0 ? 700 : 1250, when);
    filter.frequency.exponentialRampToValueAtTime(direction > 0 ? 1250 : 700, when + .23);
    const envelope = context.createGain(); envelope.gain.setValueAtTime(0, when);
    envelope.gain.linearRampToValueAtTime(gain, when + .065);
    envelope.gain.exponentialRampToValueAtTime(.0001, when + .28);
    noise.connect(filter); filter.connect(envelope); envelope.connect(effectsBus); envelope.connect(reverbInput);
    noise.start(when, .31);
    trackVoice('effect', [noise, filter, envelope], [noise], envelope, when + .3);
  }

  // An original 102-second phrase, voiced in D minor pentatonic; space is part of the music.
  const chords = [[50, 57], [53, 60], [48, 55], [55, 62], [50, 57], [53, 60], [48, 55], [50, 57]];
  const melody = [74, null, 69, null, 72, null, 77, null, 79, null, 77, null, 72, null, null, null,
    74, null, 77, null, 81, null, 79, null, 77, null, 72, null, 69, null, null, null];
  function scheduleMusic() {
    if (!canPlay() || !musicOn()) return;
    const now = context.currentTime;
    if (nextStep < now - .5) nextStep = now + .08;
    while (nextStep < now + .55) {
      if (step % 4 === 0) {
        const chord = chords[Math.floor(step / 4) % chords.length];
        bowed(chord[0], nextStep, 13.25, .105, -.24);
        bowed(chord[1], nextStep + .12, 13.1, .075, .27);
      }
      const note = melody[step % melody.length];
      if (note !== null) bowed(note, nextStep + .42, 4.3, .13, Math.sin(step * .8) * .12);
      step = (step + 1) % melody.length;
      nextStep += 3.2;
    }
  }
  function stopMusic() {
    clearInterval(scheduler); scheduler = 0;
    voices.forEach(voice => { if (voice.kind === 'music') voice.stop(); });
  }
  function startMusic() {
    stopMusic();
    if (!canPlay() || !musicOn()) return;
    nextStep = context.currentTime + .18;
    // Resume on a chord boundary so returning to the page never leaves a melody unsupported.
    step -= step % 4;
    scheduleMusic(); scheduler = window.setInterval(scheduleMusic, 180);
  }

  function hush() {
    stopMusic();
    if (!context) return;
    voices.forEach(voice => voice.stop());
    hold(master.gain, context.currentTime);
    master.gain.setTargetAtTime(0, context.currentTime, .025);
  }

  async function synchronize() {
    const ticket = ++revision;
    resumePending = 0;
    clearTimeout(suspendTimer);
    renderState();
    if (!enabled || document.hidden || disposed) {
      hush();
      suspendTimer = window.setTimeout(() => {
        if (ticket === revision && context?.state === 'running' && (!enabled || document.hidden || disposed)) {
          context.suspend().catch(() => {});
        }
      }, 160);
      return;
    }
    try {
      makeAudio();
      resumePending = ticket;
      // Called synchronously from the enabling click before the first await (autoplay-safe).
      await context.resume();
      if (resumePending === ticket) resumePending = 0;
      if (ticket !== revision || !enabled || document.hidden || disposed) return;
      hold(master.gain, context.currentTime);
      master.gain.setTargetAtTime(level() * .58, context.currentTime, .18);
      startMusic(); renderState();
    } catch (_) {
      if (ticket !== revision) return;
      resumePending = 0;
      hush(); renderState();
      announce('Tap the page to start sound, or use the sound button to mute.');
    }
  }

  function toggleSound(button) {
    if (button.disabled) return;
    enabled = !enabled;
    synchronize();
  }
  toggle.addEventListener('click', () => toggleSound(toggle));
  invitations.forEach(button => button.addEventListener('click', () => toggleSound(button)));
  // Browsers gate audible autoplay. Retry on a genuine gesture without overriding mute.
  function unlock(event) {
    if (!event.isTrusted || !enabled || document.hidden || context?.state === 'running') return;
    if (event.target instanceof Element && event.target.closest('#sound-toggle, [data-sound-enable]')) return;
    synchronize();
  }
  document.addEventListener('pointerup', unlock, { capture: true, passive: true });
  document.addEventListener('keydown', unlock, { capture: true });
  document.addEventListener('visibilitychange', synchronize);
  window.addEventListener('pagehide', () => { disposed = true; synchronize(); });
  window.addEventListener('pageshow', event => { if (event.persisted) { disposed = false; synchronize(); } });

  function effect(type, direction = 1) {
    if (!canPlay() || level() === 0) return;
    const now = context.currentTime;
    if (now - lastEffect < .23 || voices.size > 30) return;
    lastEffect = now;
    const time = now + .01;
    switch (type) {
      case 'gallery': breath(time, .075, direction); chime(direction > 0 ? 81 : 77, time + .045, .29, .055); break;
      case 'select': chime(74, time, .22, .075); chime(81, time + .055, .32, .035); break;
      case 'bag': [62, 69, 74].forEach((note, i) => chime(note, time + i * .065, .67, .08)); break;
      case 'close': breath(time, .06, -1); chime(69, time, .26, .035); break;
      case 'open': breath(time, .065); chime(74, time + .05, .42, .045); break;
      case 'night': bowed(69, time, 1.05, .14, -.1, 'effect'); chime(81, time + .11, .7, .035); break;
      case 'day': bowed(74, time, .95, .12, .1, 'effect'); break;
      case 'studio': chime(direction > 0 ? 74 : 69, time, .35, .06); breath(time, .035, direction); break;
      default: chime(81, time, .24, .04);
    }
  }

  // Clicks only: no hover or scrolling sounds, and native disabled controls stay silent.
  document.addEventListener('click', event => {
    if (!event.isTrusted || !canPlay()) return;
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest('button, a, input');
    if (!control || control.disabled || control.getAttribute('aria-disabled') === 'true') return;
    if (control === toggle || control.matches('[data-sound-enable]')) return;
    if (control.matches('#add-bag, #sticky-add-bag, [data-checkout]')) effect('bag');
    else if (control.matches('[data-orbit-view]')) effect('gallery', control.dataset.orbitView==='profile' ? -1 : 1);
    else if (control.matches('[data-material], [data-size]')) effect('select');
    else if (control.matches('[data-light]')) effect(control.dataset.light === 'night' ? 'night' : 'day');
    else if (control.matches('[id^="studio-"]')) effect('studio', /back|out/.test(control.id) ? -1 : 1);
    else if (control.matches('[data-close]')) effect('close');
    else if (control.matches('[data-open], [data-info]')) effect('open');
    else if (control.matches('a[href^="#"], .search-result')) effect('navigation');
  }, true);
  document.querySelector('#watch-canvas')?.addEventListener('pointerdown', event => {
    if (event.isTrusted && event.isPrimary) effect('studio');
  });
  document.addEventListener('keydown', event => {
    if (!event.isTrusted || event.repeat) return;
    if (!(event.target instanceof Element)) return;
    if (event.target.id === 'watch-canvas' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '=', 'Home', ' '].includes(event.key)) effect('studio', ['ArrowLeft', 'ArrowDown', '-'].includes(event.key) ? -1 : 1);
  });

  // Read-only diagnostics contain no controls and cannot start audio programmatically.
  Object.defineProperty(window, 'LevuzoSound', { value: Object.freeze({
    get state() { return Object.freeze({ enabled, ambience: musicOn(), volume: Math.round(level() * 100), context: context?.state || 'not-created', voices: voices.size, scheduling: Boolean(scheduler) }); }
  }), configurable: true });
  renderState();
  if (!AudioContextClass) {
    toggle.disabled = true; invitations.forEach(button => { button.disabled = true; });
    enabled = false; renderState();
    announce('Audio is not supported by this browser.');
  } else synchronize();
})();
