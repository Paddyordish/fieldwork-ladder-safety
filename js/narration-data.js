/* Authored reading equivalents, checked against local transcription and course context.
   The supplied recordings are preserved; see AUDIO-MAP.md for provenance and triggers. */
(() => {
  'use strict';
  const clips = [
    [1,'01_welcome.mp3','Welcome','Welcome to FIELDWORK — Ladder Safety. Inspect Before You Climb. Before you get off the ground, check your equipment. Four inspection points. One decision.'],
    [2,'02_inspection_intro.mp3','Inspect from the ground','Before climbing, give the ladder a proper inspection. Select each of the four points and decide whether the finding is safe. Carry out the check on the ground. Do not climb yet.'],
    [3,'03_stiles.mp3','Stiles','The stiles are the two long sides of the ladder. The left stile has a crease in the metal. This is structural damage. Would you trust it under load?'],
    [4,'04_rungs.mp3','Rungs','The rungs support your feet. This rung is bent and its fixing is starting to pull away. Consider what could happen when you put your weight on it.'],
    [5,'05_feet.mp3','Feet','The feet help prevent the ladder from slipping. The left rubber foot is split, exposing the metal underneath. Its grip is compromised.'],
    [6,'06_locks.mp3','Locking mechanism','The locking mechanism keeps the extension section in place. This hook is bent and is not sitting properly. The section could move while someone is climbing. How would you classify it?'],
    [7,'07_correct.mp3','Correct judgement','That’s the one.'],
    [8,'08_incorrect.mp3','Take another look','NAH, MATE!'],
    [9,'09_inspection_complete.mp3','Four checks complete','All four points have been checked. You found serious problems. Now make the call: would you climb this ladder?'],
    [10,'10_unsafe_correct.mp3','Unsafe to use','Any one of these defects would be enough to stop use. You found four. This ladder must not be used for the job.'],
    [11,'11_safe_incorrect.mp3','Reconsider the verdict','Damaged metal, a bent rung, a broken foot and a faulty lock make this ladder unsafe. Have another think.'],
    [12,'12_decision_intro.mp3','Make the decision','There is a quick job in the loading bay. A colleague says it will only take five minutes, but you have found a damaged rung. Use it, attempt a repair, or withdraw it from service?'],
    [13,'13_decision_wrong_use.mp3','A quick job is still a risk','Five minutes or five seconds: the damaged rung could fail beneath you. A quick job is not worth a trip to A&E.'],
    [14,'14_decision_wrong_repair.mp3','Do not improvise a repair','Structural damage cannot be made safe with tape. An improvised repair does not make the ladder safe. Try another action.'],
    [15,'15_decision_correct.mp3','Withdraw and report','Take the ladder out of service. Follow your workplace procedure to prevent someone else using it and report the defect. Then obtain suitable equipment that has passed inspection.'],
    [16,'16_setup_intro.mp3','The replacement ladder','The replacement ladder has passed inspection. That does not automatically make it suitable for the job. Three setup decisions remain.'],
    [17,'17_suitability.mp3','Suitability','Does a five-minute check of a wall-mounted sign automatically make a ladder the right choice? Consider the risks before deciding.'],
    [18,'18_position.mp3','Position','For a resting point four metres above the ground, use the one-in-four rule: approximately one metre out for every four metres up. The ground needs to be firm and level.'],
    [19,'19_stability.mp3','Stability','You are working near a busy walkway and suitable tie points are available. How will you secure the ladder and protect people nearby?'],
    [20,'20_setup_wrong.mp3','Reconsider the setup','Have another look. The ladder needs to be properly positioned and secured before anyone climbs it.'],
    [21,'21_setup_correct.mp3','Safe setup choice','Sound. That’s the one.'],
    [22,'22_completion.mp3','Field exercise complete','You inspected the equipment, found the defects, made the right decision and set up a replacement ladder safely. Ladder safety starts before your feet leave the ground. Check it, assess the risks and set it up properly. If something looks wrong, do not chance it.'],
    [23,'23_fieldworld_intro.mp3','FIELDWORK — cinematic introduction','FIELDWORK, by Paddy Ordish. In a world where danger lurks around every corner, one man must confront the ultimate workplace threat: a ladder.'],
    [24,'24_try_again.mp3','Try again','Go on, give it another go.']
  ].map(([id,file,title,text]) => Object.freeze({id,file,title,text}));
  window.FieldworkNarration = Object.freeze(Object.fromEntries(clips.map(clip => [clip.id, clip])));
})();
