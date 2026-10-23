/* FIELDWORK — no runtime dependencies. State is tab-scoped and versioned. */
(() => {
  'use strict';
  const KEY = 'fieldwork-ladder-v1';
  const labels = ['Introduction', 'Inspect the ladder', 'Make the decision', 'Safe setup', 'Completion'];
  const fresh = () => ({ version: 2, stage: 0, unlocked: 0, inspected: [], inspectionAnswers: {}, active: 0, verdict: null, decision: null, setup: [null, null, null], setupIndex: 0 });
  function restore() {
    try {
      const s = JSON.parse(sessionStorage.getItem(KEY));
      if (!s || !Number.isInteger(s.stage) || !Number.isInteger(s.unlocked) || s.unlocked < 0 || s.unlocked > 4 || s.stage < 0 || s.stage > s.unlocked || !Array.isArray(s.inspected) || !s.inspected.every(n => Number.isInteger(n) && n >= 0 && n < 4) || new Set(s.inspected).size !== s.inspected.length || !Array.isArray(s.setup) || s.setup.length !== 3 || !s.setup.every(n => n === null || [0, 1, 2].includes(n)) || !Number.isInteger(s.active) || s.active < 0 || s.active > 3 || !Number.isInteger(s.setupIndex) || s.setupIndex < 0 || s.setupIndex > 2 || !s.inspectionAnswers || typeof s.inspectionAnswers !== 'object') return fresh();
      if (!s.version) { s.setup = s.setup.map((a,i) => a === null ? null : [[1,0,2],[0,2,1],[0,1,2]][i][a]); s.version = 2; }
      // Validate progress as well as structure: a stale or edited save cannot bypass learning gates.
      if ((s.unlocked >= 2 && (s.inspected.length !== 4 || ![0,1,2,3].every(i => s.inspectionAnswers[i] === 1) || s.verdict !== 1)) || (s.unlocked >= 3 && s.decision !== 2) || (s.unlocked >= 4 && !s.setup.every((n,i) => n === [0,2,1][i]))) return fresh();
      let prefix = 0; while (prefix < 4 && s.inspectionAnswers[prefix] === 1) prefix++;
      s.inspected = Array.from({length:prefix},(_,i)=>i); s.active = Math.min(s.active, Math.min(prefix,3));
      return s;
    } catch { return fresh(); }
  }
  let state = restore();
  let storageFailed = false;
  const main = document.querySelector('main');
  const points = [
    { name: 'Stiles', tag: 'THE LOAD-BEARING SIDES', observation: 'A sharp dent and crease interrupt the left stile. The aluminium is visibly deformed.', why: 'A damaged stile can buckle under load. Do not use this ladder.', visual: 'The left metal face changes direction near the lower end of the extension section. A diagonal line crosses the face.', detail: 'Bent stile', cls: 'stile' },
    { name: 'Rungs', tag: 'YOUR FOOTING', observation: 'One rung is bowed downwards and has pulled away at its right-hand fixing.', why: 'A bent or loose rung can fail beneath your foot. Withdraw the ladder from use.', visual: 'The rung curves down at its centre. At its right end, a gap separates the rung from the metal fixing.', detail: 'Bent, loose rung', cls: 'rung' },
    { name: 'Feet', tag: 'THE GROUND CONTACT', observation: 'The left rubber foot is split and worn through, leaving exposed metal at the base.', why: 'A damaged foot reduces grip and can allow the ladder to slip. It is unsafe to use.', visual: 'The left rubber shoe has an open split and an uneven lower edge. Shiny metal shows through one side.', detail: 'Split rubber foot', cls: 'foot' },
    { name: 'Locking mechanism', tag: 'SECTION SECURITY', observation: 'The extension locking hook is bent and does not seat properly over the rung.', why: 'A damaged locking mechanism may let a section move or collapse. Do not climb it.', visual: 'The right hook angles sideways from its pivot. Its lower cradle sits beside the rung instead of around it.', detail: 'Bent locking hook', cls: 'lock' }
  ];
  const questions = [
    { title: 'Is a ladder suitable?', context: 'The job is a five-minute visual check of a wall-mounted sign. You have a replacement ladder that has passed its pre-use check. What establishes whether you can use it?', options: ['The job takes less than 30 minutes, so a ladder is automatically suitable.', 'Assess the risks and choose a ladder only if it is justified for this task.', 'A ladder is suitable for any task if it has passed inspection.'], feedback: ['Duration alone does not establish suitability. Consider the task, fall risk and whether equipment offering greater protection is needed.', 'Correct. Consider risk first, including safer access equipment. A short, low-risk task may justify a ladder; duration alone does not.', 'Inspection checks condition, not task suitability. The risk assessment must also consider the work and safer alternatives.'] },
    { title: 'Choose the position.', context: 'The risk assessment supports ladder use. The upper resting point will be 4 metres above the ground. Where should you place the base of this leaning ladder?', options: ['2 metres out, with a brick under one foot to level it.', '1 metre out on firm, level, clean ground, against a strong upper resting point.', 'As close to the wall as possible to keep the walkway clear.'], feedback: ['Do not use improvised packing. This angle is also too shallow. Choose firm, level ground and follow the 1-in-4 rule.', 'Correct. One unit out for four units up gives approximately 75°. Both feet need sound, level contact; check manufacturer instructions.', 'A near-vertical ladder can tip backwards. Use the correct angle and control access to the walkway.'] },
    { title: 'Make it stable. Then climb.', context: 'The ladder is positioned correctly near a workplace walkway. Suitable tie points are available. What is the best next action?', options: ['Ask a colleague to hold the base; that is always the first choice.', 'Tie both stiles to suitable points and protect the work area before climbing.', 'Climb carefully and move the ladder sideways while standing on it.'], feedback: ['Footing is a last resort. Where suitable tie points are available, secure both stiles and control the surrounding hazards.', 'Correct. Secure against outward and sideways movement and protect against traffic. Face the ladder, maintain three points of contact and avoid overreaching. Keep off the top three rungs and use a ladder long enough for the job.', 'Never move a ladder while on it. Climb down to reposition. An unsecured ladder and uncontrolled walkway remain hazards.'] }
  ];
  const correctSetup = [0,2,1];
  for (const [i, order] of [[0,[1,0,2]],[1,[0,2,1]]]) {
    questions[i].options = order.map(n=>questions[i].options[n]);
    questions[i].feedback = order.map(n=>questions[i].feedback[n]);
  }
  const fieldNotes = ['Short duration alone does not make a ladder suitable. Assess the risk first.', 'One out for four up: approximately 75°. Use firm, level ground and a strong resting point.', 'Secure both stiles where suitable tie points exist. Protect the work area from people and traffic.'];
  const available = i => i <= state.inspected.length;
  const arrow = '<span class="arrow" aria-hidden="true"></span>';
  const button = (text, action, disabled = false, extra = '') => `<button class="primary" data-action="${action}" ${disabled ? 'disabled' : ''} ${extra}>${text}${arrow}</button>`;
  const feedback = (ok, text) => `<div class="feedback ${ok ? 'correct' : 'incorrect'}" role="status"><strong>${ok ? '✓ Sound judgement.' : '✕ Take another look.'}</strong><p>${text}</p></div>`;
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch { storageFailed = true; } }
  function progress() {
    if (state.unlocked === 4) return 100;
    if (state.unlocked === 3) return 60 + state.setup.filter((n,i) => n === correctSetup[i]).length * 10;
    if (state.unlocked === 2) return 50;
    if (state.unlocked === 1) return 10 + state.inspected.length * 8 + (state.verdict === 1 ? 8 : 0);
    return 0;
  }
  function go(stage, silent = false) {
    if (stage > state.unlocked) return;
    state.stage = stage; save(); render(); narrateStage(!silent);
    document.querySelector('h1').focus();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function next() {
    const allowed = state.stage === 0 || (state.stage === 1 && state.inspected.length === 4 && state.verdict === 1) || (state.stage === 2 && state.decision === 2) || (state.stage === 3 && state.setup.every((n,i) => n === correctSetup[i]));
    if (!allowed) return;
    state.unlocked = Math.max(state.unlocked, state.stage + 1); const enteringSetup = state.stage === 2 && state.setup.every(n=>n===null);
    go(state.stage + 1, enteringSetup);
    if (enteringSetup) narrate([16,17],{key:'setup-first-entry'});
  }
  function choices(items, type, selected, correct = 1) {
    return `<div class="choices" role="group" aria-label="Choose your answer">${items.map((t, i) => `<button class="choice ${selected === i ? 'selected ' + (i === correct ? 'answer-correct' : 'answer-incorrect') : ''}" data-${type}="${i}" aria-pressed="${selected === i}"><span class="choice-letter" aria-hidden="true">${String.fromCharCode(65+i)}</span><span>${t}</span><span class="choice-end" aria-hidden="true">${selected === i ? (i === correct ? '✓' : '✕') : arrow}</span></button>`).join('')}</div>`;
  }
  function intro() {
    return `<section class="intro"><picture class="intro-art"><source srcset="assets/fieldwork-intro-instructor.webp" type="image/webp"><img src="assets/fieldwork-intro-instructor.png" alt="Instructor wearing a hard hat and high-visibility vest beside a ladder in an industrial workplace." width="1672" height="941" fetchpriority="high"></picture><div class="hero-copy"><p class="eyebrow"><span class="live-dot"></span> WORK AT HEIGHT / 3–5 MINUTES</p><h1 tabindex="-1">LADDER<br><span>SAFETY</span><span class="title-period">.</span></h1><h2 class="subtitle">Inspect Before You Climb</h2><p class="intro-description">The safest climb starts on the ground.<br>Four checks. One decision. No shortcuts.</p>${button('BEGIN INSPECTION', 'begin')}<p class="small-note">An interactive field exercise <span aria-hidden="true">—</span> No audio required</p></div><div class="art-caption"><span class="crosshair" aria-hidden="true">+</span><span>CHECK THE EQUIPMENT.<br>THEN MAKE THE CALL.</span></div><span class="vertical-label" aria-hidden="true">FIELDWORK / PRACTICAL SAFETY / VOL. 001</span><div class="intro-bottom"><span>01 <span class="muted">/ THE PRE-USE CHECK</span></span><span>LOOK CLOSER. WORK SAFER.</span></div></section>`;
  }
  function inspection() {
    const p = points[state.active], answer = state.inspectionAnswers[state.active];
    const reviewed = state.inspected.length;
    return `<section class="stage inspection-stage"><div class="section-heading"><div><p class="eyebrow">02 / EQUIPMENT CHECK</p><h1 tabindex="-1">LOOK CLOSER.</h1></div><p>Before use, check the ladder yourself.<br>Inspect these four extension-ladder points in order.</p></div><div class="inspection-grid"><div class="inspection-visual" data-active="${state.active}"><div class="inspection-canvas"><img src="assets/inspection.svg" alt="Front view of the extension ladder. Inspect points 01 to 04 in order using the markers or checklist.">${points.map((p,i)=>`<button class="hotspot hot-${p.cls} ${state.active === i ? 'active' : ''} ${state.inspected.includes(i) ? 'complete' : ''}" data-point="${i}" ${available(i) ? '' : 'disabled'} aria-pressed="${state.active === i}" aria-controls="inspection-detail"><span class="sr-only">Inspection point 0${i+1}: ${p.name}. ${state.inspected.includes(i) ? 'Checked' : available(i) ? 'Available' : 'Locked — complete earlier checks first'}. </span><span class="marker-symbol" aria-hidden="true">${state.inspected.includes(i) ? '✓' : '0'+(i+1)}</span><span class="marker-label" aria-hidden="true">${p.name} <small>${state.inspected.includes(i) ? 'Checked' : 'Inspect'}</small></span></button>`).join('')}</div><span class="image-label">ASSET L-024 / PRE-USE CHECK</span><span class="visual-caption">INSPECT FROM THE GROUND. DO NOT CLIMB.</span></div><div class="inspection-panel"><div class="panel-top"><h2 class="label-heading">Inspection checklist</h2><span role="status">${reviewed} / 4 CHECKED</span></div><div class="checklist" role="group" aria-label="Inspection points — complete 01 to 04 in order. Locked points unlock after a correct judgement on the preceding point.">${points.map((p,i)=>`<button class="check-item ${state.inspected.includes(i) ? 'checked' : ''}" data-point="${i}" ${available(i) ? '' : 'disabled'} aria-pressed="${state.active === i}" aria-controls="inspection-detail"><span class="check-number">0${i+1}</span>${p.name}<span class="check-state">${state.inspected.includes(i) ? '✓ Checked' : available(i) ? 'Inspect +' : 'Locked'}</span></button>`).join('')}</div><div id="inspection-detail" class="inspection-detail" role="region" aria-labelledby="inspection-point-title" tabindex="-1"><p class="eyebrow">0${state.active+1} / ${p.tag}</p><h2 id="inspection-point-title">${p.name}</h2><p>Study the enlarged component, then record your judgement.</p><figure class="inspection-lens ${state.inspected.includes(state.active) ? 'revisited' : ''}" data-lens="${state.active}" aria-label="Magnified inspection point 0${state.active+1}: ${p.name}"><div class="lens-window"><img src="assets/inspection-${p.cls}-detail.svg" alt="${p.visual}"></div><figcaption>0${state.active+1} / INSPECTION VIEW <span aria-hidden="true">＋</span></figcaption></figure>${choices(['Acceptable to use', 'Defect — do not use'], 'inspect-answer', answer)}${answer !== undefined ? feedback(answer === 1, answer === 1 ? `${p.observation} ${p.why}` : `This is a defect. ${p.why} Select “Defect — do not use” to record it.`) : ''}</div></div></div><div class="verdict"><div><h2>Would you climb this ladder?</h2><p>${reviewed < 4 ? 'Record a judgement on all four inspection points first.' : 'Use what you found to make your overall assessment.'}</p></div><div class="verdict-actions"><button class="secondary ${state.verdict === 0 ? 'answer-incorrect' : ''}" data-verdict="0" ${reviewed < 4 ? 'disabled' : ''} aria-pressed="${state.verdict === 0}">Safe to use</button><button class="secondary ${state.verdict === 1 ? 'answer-correct' : ''}" data-verdict="1" ${reviewed < 4 ? 'disabled' : ''} aria-pressed="${state.verdict === 1}">Unsafe to use</button></div></div><div id="verdict-feedback">${state.verdict !== null ? feedback(state.verdict === 1, state.verdict === 1 ? 'Correct. Any one of these defects is enough to stop use. Now decide what to do with the equipment.' : 'Even one defect makes this ladder unsafe. It must not be used. Choose “Unsafe to use”.') : ''}</div><div class="stage-actions"><button class="text-button" data-back>← Introduction</button>${button('MAKE THE CALL', 'next', reviewed < 4 || state.verdict !== 1)}</div></section>`;
  }
  function decision() {
    const responses = ['A short job does not remove the risk of a rung failing. Do not use damaged equipment. Choose a safer action.', 'An improvised repair can conceal damage without restoring strength. Do not attempt an unauthorised repair; remove the equipment from use and report it.', 'Correct. Stop use, follow your workplace procedure to prevent someone else using it, and tell the person in charge. Obtain suitable equipment that has passed inspection.'];
    return `<section class="stage decision-stage"><p class="eyebrow">03 / A MOMENT THAT MATTERS</p><div class="decision-grid"><div><h1 tabindex="-1">FIVE MINUTES.<br><span>STILL A RISK.</span></h1><p class="lead">“It’s only a quick job.<br>Can we use it anyway?”</p><p>You are about to check a sign in the loading bay. Your inspection has found a bent, loose rung. A colleague wants to get the task finished before the next delivery.</p><figure class="defect-card"><img src="assets/rung-detail.svg" alt="Close view of the bent rung, with its right fixing pulled away from the stile."><figcaption><span class="status-mark">!</span> L-024 / BENT, LOOSE RUNG</figcaption></figure></div><div class="decision-panel"><h2>What do you do?</h2><p>The deadline has not changed the condition of the ladder.</p>${choices(['Use it just this once, avoiding the damaged rung.', 'Straighten the rung yourself and tape the loose joint.', 'Withdraw it from service and report the defect.'], 'decision', state.decision, 2)}${state.decision !== null ? feedback(state.decision === 2, responses[state.decision]) : ''}${button('FIND A SAFE SETUP', 'next', state.decision !== 2)}</div></div><div class="stage-actions"><button class="text-button" data-back>← Back to inspection</button><span class="small-note">STOP. WITHDRAW. REPORT.</span></div></section>`;
  }
  function setup() {
    const i = state.setupIndex, q = questions[i], answer = state.setup[i];
    return `<section class="stage"><div class="section-heading"><div><p class="eyebrow">04 / THE REPLACEMENT LADDER</p><h1 tabindex="-1">SET UP FOR SAFETY.</h1></div><p>Sound equipment is the start.<br>The task and setup matter too.</p></div><div class="setup-grid"><div class="setup-illustration"><span class="image-label">REPLACEMENT L-031 / INSPECTION PASSED ✓</span><img src="assets/setup.svg" alt="Side-view setup diagram: a leaning ladder rests against a strong wall, four units up and one unit out, approximately 75 degrees, with a tie at the upper resting point."><div class="field-note"><span>FIELD NOTE / 0${i+1}</span><p>${fieldNotes[i]}</p></div></div><div class="setup-panel"><div class="question-steps" aria-label="Setup decisions">${questions.map((_,n)=>`<span ${n===i?'aria-current="step"':''}>${state.setup[n] === correctSetup[n] ? '✓' : '0'+(n+1)}<span class="sr-only"> ${['Suitability','Position','Stability'][n]}${state.setup[n] === correctSetup[n] ? ' complete' : ''}</span></span>`).join('')}</div><p class="eyebrow">DECISION 0${i+1} / 03</p><h2 tabindex="-1" id="question-title">${q.title}</h2><p>${q.context}</p>${choices(q.options,'setup',answer,correctSetup[i])}${answer !== null ? feedback(answer === correctSetup[i], q.feedback[answer]) : ''}<div class="setup-actions">${i > 0 ? '<button class="text-button" data-question="previous">← Previous decision</button>' : ''}${i < 2 ? button('NEXT DECISION', 'question-next', answer !== correctSetup[i]) : button('COMPLETE FIELDWORK', 'next', !state.setup.every((n,i) => n === correctSetup[i]))}</div></div></div><div class="stage-actions"><button class="text-button" data-back>← Back to the decision</button><span class="small-note">RIGHT EQUIPMENT. RIGHT TASK. RIGHT SETUP.</span></div></section>`;
  }
  function completion() {
    return `<section class="completion stage"><div class="completion-seal" aria-hidden="true">✓</div><p class="eyebrow">05 / FIELD EXERCISE COMPLETE</p><h1 tabindex="-1">GOOD JUDGEMENT.<br><span>SAFER WORK.</span></h1><p class="lead">The most important step happens before you climb.</p><div class="takeaways"><article><span>01 / INSPECT</span><h2>Check before use.</h2><p>Check stiles, rungs, feet and locks. Repeat checks when conditions change. Follow manufacturer instructions.</p></article><article><span>02 / ACT</span><h2>Take defects seriously.</h2><p>Stop use. Withdraw damaged equipment and tell the person in charge. Prevent others from using it.</p></article><article><span>03 / SET UP</span><h2>Make the task safe.</h2><p>Assess suitability, use firm level ground, position at the correct angle and secure the ladder. Avoid overreaching.</p></article></div><p class="completion-note">Awareness is a starting point. Use ladders only when competent, or under competent supervision while training.</p>${button('RESTART INSPECTION', 'restart')}<p class="small-note">FIELDWORK / KNOWLEDGE THAT GOES TO WORK.</p></section>`;
  }
  function syncChrome() {
    document.querySelector('#stage-nav').innerHTML = labels.map((label,i) => `<li><button data-stage="${i}" ${i > state.unlocked ? 'disabled' : ''} ${state.stage === i ? 'aria-current="step"' : ''}><span class="nav-number">${i < state.unlocked ? '✓' : '0'+(i+1)}</span><span>${label}</span><span class="nav-indicator" aria-hidden="true"></span></button></li>`).join('');
    const value = progress();
    document.querySelector('#position').textContent = `0${state.stage+1} / 05`;
    document.querySelector('#progress').value = value;
    document.querySelector('#progress').textContent = `${value}%`;
    document.querySelector('#progress-text').textContent = `${value}%`;
  }
  let inspectionObserver;
  function fitInspection() {
    inspectionObserver?.disconnect();
    const visual = main.querySelector('.inspection-visual');
    const canvas = main.querySelector('.inspection-canvas');
    if (!visual || !canvas) return;
    const fit = () => {
      const width = Math.min(visual.clientWidth, visual.clientHeight * .55);
      canvas.style.width = width + 'px'; canvas.style.height = width / .55 + 'px';
    };
    fit(); inspectionObserver = new ResizeObserver(fit); inspectionObserver.observe(visual);
  }
  function render() {
    syncChrome();
    main.innerHTML = [intro,inspection,decision,setup,completion][state.stage]() + (storageFailed ? '<p class="storage-note" role="status">Session saving is unavailable. Progress will be kept until you reload or close this page.</p>' : '');
    fitInspection();
    window.FieldworkImages?.prepare(state.stage, state.active);
    document.title = `${labels[state.stage]} — Ladder Safety — FIELDWORK`;
  }
  // Keep the ladder and button nodes stable while updating just the inspection UI.
  function updateInspection(reveal = false) {
    const template = document.createElement('template');
    template.innerHTML = inspection();
    const next = template.content;
    main.querySelector('.inspection-visual').dataset.active = String(state.active);
    for (const selector of ['.hotspot', '.check-item']) {
      const originals = main.querySelectorAll(selector);
      next.querySelectorAll(selector).forEach((replacement, i) => {
        originals[i].className = replacement.className;
        originals[i].setAttribute('aria-pressed', replacement.getAttribute('aria-pressed'));
        originals[i].innerHTML = replacement.innerHTML;
        originals[i].disabled = replacement.disabled;
      });
    }
    main.querySelector('.panel-top [role="status"]').textContent = next.querySelector('.panel-top [role="status"]').textContent;
    const detail = main.querySelector('#inspection-detail');
    const lens = detail.querySelector('.inspection-lens');
    const nextDetail = next.querySelector('#inspection-detail');
    if (!reveal && lens?.dataset.lens === String(state.active)) {
      // Leave the lens attached: even removing/reinserting the same node restarts CSS animations.
      detail.querySelector('.choices').replaceWith(nextDetail.querySelector('.choices'));
      detail.querySelector('.feedback')?.remove();
      const result = nextDetail.querySelector('.feedback');
      if (result) detail.append(result);
    } else detail.innerHTML = nextDetail.innerHTML;
    detail.classList.remove('detail-reveal');
    if (reveal) { void detail.offsetWidth; detail.classList.add('detail-reveal'); }
    main.querySelector('.verdict').replaceWith(next.querySelector('.verdict'));
    main.querySelector('#verdict-feedback').innerHTML = next.querySelector('#verdict-feedback').innerHTML;
    main.querySelector('[data-action="next"]').disabled = state.inspected.length < 4 || state.verdict !== 1;
    syncChrome();
    window.FieldworkImages?.prepare(state.stage, state.active);
  }
  const narrate = (ids, options) => window.FieldworkMedia?.setContext(ids, options);
  function narrateStage(play = true) {
    window.FieldworkMedia?.setStage(state.stage);
    const ids = [[1], [3 + state.active], [state.decision === 2 ? 15 : 12], [17 + state.setupIndex], [22]][state.stage];
    narrate(ids, {key:`stage-${state.stage}-${state.stage === 3 ? state.setupIndex : state.active}`, play:play && state.stage !== 0});
  }
  const sound = cue => { window.FieldworkMedia?.effect(cue); window.FieldworkSound?.play(cue); };
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.stage !== undefined) return go(Number(b.dataset.stage));
    if (b.hasAttribute('data-back')) return go(state.stage-1);
    if (b.dataset.action === 'next') return next();
    if (b.dataset.action === 'begin') { if (cinematic.open) return; window.FieldworkImages?.prepare(1, state.active); cinematic.showModal(); cinematicElapsed = 0; cinematicPaused = false; cinematicLast = performance.now(); window.FieldworkMedia?.cinematic(); requestAnimationFrame(cinematicFrame); return; }
    if (b.dataset.action === 'restart') { state = fresh(); save(); go(0); return; }
    if (b.dataset.point !== undefined) {
      if (!available(Number(b.dataset.point))) return;
      state.active = Number(b.dataset.point); save(); updateInspection(true); sound('select'); narrate([3 + state.active], {key:`point-${state.active}`}); document.querySelector('#inspection-detail').focus(); return;
    }
    if (b.dataset.inspectAnswer !== undefined) {
      const newlyCompleted = Number(b.dataset.inspectAnswer) === 1 && !state.inspected.includes(state.active);
      state.inspectionAnswers[state.active] = Number(b.dataset.inspectAnswer);
      if (Number(b.dataset.inspectAnswer) === 1 && !state.inspected.includes(state.active)) state.inspected.push(state.active);
      // A revised unsafe judgement reopens this point and every later check.
      if (Number(b.dataset.inspectAnswer) !== 1) { state.inspected = state.inspected.filter(n => n < state.active); for (let i=state.active+1;i<4;i++) delete state.inspectionAnswers[i]; state.verdict = null; state.unlocked = Math.min(state.unlocked, 1); }
      save(); renderPreservingAnswer('data-inspect-answer', b.dataset.inspectAnswer); sound(newlyCompleted ? 'complete' : Number(b.dataset.inspectAnswer) === 1 ? 'correct' : 'incorrect'); narrate(Number(b.dataset.inspectAnswer) === 1 ? newlyCompleted && state.inspected.length === 4 ? [7,9] : [7] : [8,24], {key:`inspection-${state.active}-${b.dataset.inspectAnswer}`, urgent:Number(b.dataset.inspectAnswer) !== 1}); return;
    }
    if (b.dataset.verdict !== undefined) { if(state.inspected.length !== 4) return; state.verdict = Number(b.dataset.verdict); if(state.verdict !== 1) state.unlocked = Math.min(state.unlocked,1); save(); renderPreservingAnswer('data-verdict',b.dataset.verdict); sound(state.verdict === 1 ? 'correct' : 'incorrect'); narrate([state.verdict === 1 ? 10 : 11], {key:`verdict-${state.verdict}`, urgent:state.verdict !== 1}); return; }
    if (b.dataset.decision !== undefined) { state.decision = Number(b.dataset.decision); if(state.decision !== 2) state.unlocked = Math.min(state.unlocked,2); save(); renderPreservingAnswer('data-decision',b.dataset.decision); sound(state.decision === 2 ? 'correct' : 'incorrect'); narrate([[8,13],[8,14],[15]][state.decision], {key:`decision-${state.decision}`, urgent:state.decision !== 2}); return; }
    if (b.dataset.setup !== undefined) { state.setup[state.setupIndex] = Number(b.dataset.setup); if(Number(b.dataset.setup) !== correctSetup[state.setupIndex]) state.unlocked = Math.min(state.unlocked,3); save(); renderPreservingAnswer('data-setup',b.dataset.setup); sound(Number(b.dataset.setup) === correctSetup[state.setupIndex] ? 'correct' : 'incorrect'); narrate(Number(b.dataset.setup) === correctSetup[state.setupIndex] ? [21] : state.setupIndex === 0 ? [8,24] : [20], {key:`setup-answer-${state.setupIndex}-${b.dataset.setup}`, urgent:Number(b.dataset.setup) !== correctSetup[state.setupIndex]}); return; }
    if (b.dataset.action === 'question-next' && state.setup[state.setupIndex] === correctSetup[state.setupIndex]) { state.setupIndex = Math.min(2,state.setupIndex+1); save(); render(); narrate([17 + state.setupIndex], {key:`setup-question-${state.setupIndex}`}); document.querySelector('#question-title').focus(); return; }
    if (b.dataset.question === 'previous') { state.setupIndex = Math.max(0,state.setupIndex-1); save(); render(); narrate([17 + state.setupIndex], {key:`setup-question-${state.setupIndex}`}); document.querySelector('#question-title').focus(); }
  });
  function renderPreservingAnswer(attr, value) {
    // Keep focus predictable after rendering; announce a single, separately inserted message.
    if (state.stage === 1) updateInspection(false);
    else render();
    main.querySelector(`[${attr}="${value}"]`)?.focus();
    const feedbacks = main.querySelectorAll('.feedback');
    const f = attr === 'data-verdict' ? feedbacks[feedbacks.length-1] : feedbacks[0];
    if(f) { const message = f.innerHTML; f.innerHTML = ''; requestAnimationFrame(() => { if (f.isConnected) f.innerHTML = message; }); }
  }
  const dialog = document.querySelector('#guidance');
  document.querySelector('#guidance-open').addEventListener('click', () => dialog.showModal());
  document.querySelector('#guidance-close').addEventListener('click', () => dialog.close());
  const cinematic = document.querySelector('#cinematic');
  document.querySelector('#cinematic-skip').addEventListener('click', () => cinematic.close());
  document.querySelector('#cinematic-pause').addEventListener('click', () => { cinematicPaused = !cinematicPaused; document.querySelector('#cinematic').dataset.paused = String(cinematicPaused); document.querySelector('#cinematic-pause').textContent = cinematicPaused ? 'Resume intro' : 'Pause intro'; window.FieldworkMedia?.pauseCinematic(cinematicPaused); });
  document.querySelector('#cinematic-mute').addEventListener('click', () => document.querySelector('#narration-toggle').click());
  document.querySelector('#cinematic-music').addEventListener('click', () => document.querySelector('#music-toggle').click());
  let cinematicElapsed = 0, cinematicLast = 0, cinematicPaused = false;
  function cinematicFrame(now) {
    if (!cinematic.open) return;
    if (!cinematicPaused && !document.hidden) cinematicElapsed += Math.min(now-cinematicLast,100);
    cinematicLast = now;
    if (cinematicElapsed >= 14000 && !window.FieldworkMedia?.voicePlaying()) { cinematic.close(); return; }
    requestAnimationFrame(cinematicFrame);
  }
  cinematic.addEventListener('close', () => {
    const firstEntry = state.unlocked === 0;
    window.FieldworkMedia?.stop(); state.unlocked = Math.max(state.unlocked,1); go(1,true);
    narrate(firstEntry ? [2] : [3 + state.active], {key:`inspection-entry-${state.active}`});
  });
  document.querySelector('.brand').addEventListener('click', e => { e.preventDefault(); go(0,true); });
  window.addEventListener('fieldwork:narration-ended', e => { if (e.detail.id === 23 && cinematic.open) cinematic.close(); });
  render();
  // Restore the relevant written/audio context silently. Audible playback still requires opt-in.
  window.FieldworkMedia?.setStage(state.stage);
  narrateStage(false);
})();
