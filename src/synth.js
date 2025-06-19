// Minimal, robust synth.js for frontend-only Tone.js app
import * as Tone from "https://cdn.skypack.dev/tone";

// Map keys to notes
const keyToNote = { a: "A", b: "B", c: "C", d: "D", e: "E", f: "F", g: "G" };

const synthPresets = {
  piano: () => new Tone.Sampler({
    urls: {
      "A3": "A3.mp3",
      "C4": "C4.mp3",
      "D#4": "Ds4.mp3",
      "F#4": "Fs4.mp3",
      "A4": "A4.mp3",
      "C5": "C5.mp3"
    },
    release: 2,
    baseUrl: "https://tonejs.github.io/audio/salamander/"
  }),
  lead: () => {
    // Chiptune/game soundtrack: simple square, fast envelope, minimal FX
    const synth = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: 6,
      options: {
        oscillator: { type: "square" },
        envelope: { attack: 0.01, decay: 0.08, sustain: 0.18, release: 0.12 }
      }
    });
    synth.set({ volume: -20 });
    // Add a touch of vibrato for retro feel
    const vibrato = new Tone.Vibrato(4.5, 0.08).toDestination();
    synth.connect(vibrato);
    return synth;
  },
  organ: () => {
    // Soft/soothing: AMSynth, triangle, gentle envelope, reverb, chorus
    const reverb = new Tone.Reverb({ decay: 3, wet: 0.35 }).toDestination();
    const chorus = new Tone.Chorus(1.5, 1.2, 0.15).start();
    const synth = new Tone.PolySynth(Tone.AMSynth, {
      maxPolyphony: 6,
      options: {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.12, decay: 0.25, sustain: 0.7, release: 1.2 },
        filter: { type: "lowpass", frequency: 1200, Q: 0 },
        filterEnvelope: { attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.5, baseFrequency: 400, octaves: 1 }
      }
    }).connect(chorus).connect(reverb);
    synth.set({ volume: -14 });
    return synth;
  }
};
const reverb = new Tone.Reverb().toDestination();
reverb.decay = 3;
reverb.wet.value = 0.4;
let currentSynth = synthPresets.lead().connect(reverb);

// Global variable declarations
const pressedKeys = new Set();
let heldNoteKey = null;
let heldNotes = [];
let heldArp = false;
let arpeggioInterval = null;
let arpeggioNotes = [];
let arpeggioIndex = 0;
let arpeggioDirection = "up";
let arpeggioActive = false;
let isArpeggiateOn = false;

// --- END GLOBALS ---

function setupInstrumentSelector() {
  document.getElementById('instrument-select').addEventListener('change', function() {
    if (currentSynth) currentSynth.disconnect();
    currentSynth = synthPresets[this.value]().connect(reverb);
  });
}

function getChordNotes(root, type) {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const rootIndex = notes.indexOf(root);
  if (rootIndex === -1) return [];
  let intervals;
  if (type === "major7") intervals = [0, 4, 7, 11];
  else if (type === "minor7") intervals = [0, 3, 7, 10];
  else if (type === "fifth") intervals = [0, 7];
  else if (type === "minor") intervals = [0, 3, 7];
  else intervals = [0, 4, 7];
  const octave = parseInt(document.getElementById('octave-select')?.value || '4');
  return intervals.map(i => notes[(rootIndex + i) % 12] + octave);
}

function getArpBpm() {
  const bpmInput = document.getElementById("bpm-input");
  return bpmInput ? Math.max(30, Math.min(300, parseInt(bpmInput.value) || 120)) : 120;
}
function getArpeggioNotes(notes) {
  if (!notes || !notes.length) return [];
  // Parse each note and ensure strict ascending pitch order
  const parsed = notes.map(n => {
    const m = n.match(/^([A-G]#?)(\d)$/);
    return m ? { note: m[1], octave: parseInt(m[2]) } : null;
  });
  if (parsed.includes(null)) return notes;
  const noteOrder = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  let result = [];
  let lastMidi = null;
  parsed.forEach((n, i) => {
    let octave = n.octave;
    let midi = octave * 12 + noteOrder.indexOf(n.note);
    if (lastMidi !== null && midi <= lastMidi) {
      // Go up octaves until strictly ascending
      while (midi <= lastMidi) {
        octave++;
        midi = octave * 12 + noteOrder.indexOf(n.note);
      }
    }
    result.push(n.note + octave);
    lastMidi = midi;
  });
  // Optionally add the root note in the next octave for a full cycle
  const root = parsed[0].note;
  let nextOctave = parsed[0].octave;
  let lastRootMidi = nextOctave * 12 + noteOrder.indexOf(root);
  while (lastRootMidi <= lastMidi) {
    nextOctave++;
    lastRootMidi = nextOctave * 12 + noteOrder.indexOf(root);
  }
  result.push(root + nextOctave);
  return result;
}
function startAlternatingArpeggio(notes) {
  stopArpeggio();
  const arpNotes = getArpeggioNotes(notes);
  if (!arpNotes || !arpNotes.length) return;
  arpeggioNotes = arpNotes;
  arpeggioDirection = "up";
  arpeggioIndex = 0;
  arpeggioActive = true;
  // Calculate interval so all notes fit in one beat
  const msPerBeat = 60000 / getArpBpm();
  const msPerStep = msPerBeat / arpNotes.length;
  function playStep() {
    if (!arpeggioActive) return;
    highlightSingleKeyboardKey(arpeggioNotes[arpeggioIndex]);
    if (currentSynth) currentSynth.triggerAttackRelease(arpeggioNotes[arpeggioIndex], msPerStep / 1000);
    if (arpeggioDirection === "up") {
      arpeggioIndex++;
      if (arpeggioIndex >= arpeggioNotes.length) {
        arpeggioIndex = arpeggioNotes.length - 2;
        arpeggioDirection = "down";
        if (arpeggioIndex < 0) arpeggioIndex = 0;
      }
    } else {
      arpeggioIndex--;
      if (arpeggioIndex < 0) {
        arpeggioIndex = 1;
        arpeggioDirection = "up";
        if (arpeggioIndex >= arpeggioNotes.length) arpeggioIndex = arpeggioNotes.length - 1;
      }
    }
  }
  playStep();
  arpeggioInterval = setInterval(playStep, msPerStep);
}

function stopArpeggio() {
  if (arpeggioInterval) {
    clearInterval(arpeggioInterval);
    arpeggioInterval = null;
  }
  arpeggioActive = false;
  clearKeyboardHighlights(); // Always clear, no conditions
}

function getCurrentHeldNotes() {
  if (!heldNoteKey) return [];
  let note = keyToNote[heldNoteKey];
  if (pressedKeys.has(" ")) note += "#";
  let chordType = pressedKeys.has("Shift") ? "minor" : "major";
  if (pressedKeys.has("]")) chordType = chordType + "7";
  if (pressedKeys.has("[")) chordType = "fifth";
  return getChordNotes(note, chordType);
}

// Helper: note name to key index in octave
const whiteNotes = ["C", "D", "E", "F", "G", "A", "B"];
const blackNotes = ["C#", "D#", null, "F#", "G#", "A#", null];

function highlightKeyboardKeys(notes) {
  // Remove all previous highlights
  document.querySelectorAll('.octave-wrapper .key').forEach(el => el.classList.remove('active-keyboard-key'));
  if (!notes || !notes.length) return;
  // Highlight all notes, regardless of octave
  notes.forEach(note => {
    const match = note.match(/^([A-G]#?)(\d)$/);
    if (!match) return;
    const [_, n, o] = match;
    const octave = parseInt(o) - 1;
    const octaveWrappers = document.querySelectorAll('.keyboard-octaves .octave-wrapper');
    const octaveEl = octaveWrappers[octave];
    if (!octaveEl) return;
    // White key
    const whiteIdx = whiteNotes.indexOf(n);
    if (whiteIdx !== -1) {
      const whiteKeys = octaveEl.querySelectorAll('.white-keys .white-key');
      if (whiteKeys[whiteIdx]) whiteKeys[whiteIdx].classList.add('active-keyboard-key');
    }
    // Black key
    const blackKeyClassMap = {
      'C#': 'black-key-c-sharp',
      'D#': 'black-key-d-sharp',
      'F#': 'black-key-f-sharp',
      'G#': 'black-key-g-sharp',
      'A#': 'black-key-a-sharp'
    };
    if (blackKeyClassMap[n]) {
      const blackKey = octaveEl.querySelector('.black-keys .' + blackKeyClassMap[n]);
      if (blackKey) blackKey.classList.add('active-keyboard-key');
    }
  });
}

function clearKeyboardHighlights() {
  // Remove all highlights from all octaves, always
  document.querySelectorAll('.octave-wrapper .key').forEach(el => el.classList.remove('active-keyboard-key'));
}

function highlightSingleKeyboardKey(note) {
  clearKeyboardHighlights();
  if (!note) return;
  // Find the octave wrapper for the note's octave
  const match = note.match(/^([A-G]#?)(\d)$/);
  if (!match) return;
  const [_, n, o] = match;
  const octave = parseInt(o) - 1;
  const octaveWrappers = document.querySelectorAll('.keyboard-octaves .octave-wrapper');
  const octaveEl = octaveWrappers[octave];
  if (!octaveEl) return;
  const whiteIdx = whiteNotes.indexOf(n);
  if (whiteIdx !== -1) {
    const whiteKeys = octaveEl.querySelectorAll('.white-keys .white-key');
    if (whiteKeys[whiteIdx]) whiteKeys[whiteIdx].classList.add('active-keyboard-key');
  }
  const blackKeyClassMap = {
    'C#': 'black-key-c-sharp',
    'D#': 'black-key-d-sharp',
    'F#': 'black-key-f-sharp',
    'G#': 'black-key-g-sharp',
    'A#': 'black-key-a-sharp'
  };
  if (blackKeyClassMap[n]) {
    const blackKey = octaveEl.querySelector('.black-keys .' + blackKeyClassMap[n]);
    if (blackKey) blackKey.classList.add('active-keyboard-key');
  }
}

let arpeggioDirectionAuto = "up";
let arpeggioCycleTimer = null;

function startAutoAlternatingArpeggio(notes) {
  if (!notes || !notes.length) return;
  let direction = "up";
  let cycleCount = 0;
  function nextCycle() {
    startArpeggio(notes, direction);
    direction = direction === "up" ? "down" : "up";
    arpeggioDirectionAuto = direction;
    arpeggioCycleTimer = setTimeout(nextCycle, notes.length * (60000 / getArpBpm()));
  }
  nextCycle();
}
function stopAutoAlternatingArpeggio() {
  stopArpeggio();
  if (arpeggioCycleTimer) {
    clearTimeout(arpeggioCycleTimer);
    arpeggioCycleTimer = null;
  }
}

function setupKeyboard() {
  window.addEventListener("keydown", async (e) => {
    // Prevent scrolling for spacebar and arrow keys
    if ([" ", "ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
    }
    if (e.repeat) return;
    pressedKeys.add(e.key);
    if (!window.__audioStarted) return;
    let key = e.key.toLowerCase();
    // --- ARPEGGIATE TOGGLE LOGIC ---
    if (isArpeggiateOn && keyToNote[key]) {
      let note = keyToNote[key];
      if (pressedKeys.has(" ")) note += "#";
      let chordType = pressedKeys.has("Shift") ? "minor" : "major";
      if (pressedKeys.has("]")) chordType = chordType + "7";
      if (pressedKeys.has("[")) chordType = "fifth";
      const notes = getChordNotes(note, chordType);
      await Tone.start();
      if (currentSynth && typeof currentSynth.load === 'function' && typeof currentSynth.loaded !== 'undefined' && !currentSynth.loaded) {
        await currentSynth.load();
      }
      if (!notes.length) return;
      heldNoteKey = key;
      heldNotes = notes;
      heldArp = true;
      startAlternatingArpeggio(notes);
      document.getElementById('status').textContent =
        `keydown: key=${e.key}, code=${e.code}, arpeggiate=ON, heldNotes=${heldNotes.join(',')}`;
      return;
    }
    if ((["Shift", " ", "[", "]"].includes(e.key)) && heldNoteKey) {
      const notes = getCurrentHeldNotes();
      heldNotes = notes;
      highlightKeyboardKeys(notes);
      if (heldArp) {
        if (pressedKeys.has("ArrowUp")) {
          startArpeggio(notes, "up");
        } else if (pressedKeys.has("ArrowDown")) {
          startArpeggio(notes, "down");
        }
      } else {
        stopArpeggio();
        if (currentSynth) currentSynth.triggerAttackRelease(notes, 1.5);
      }
      document.getElementById('status').textContent =
        `keydown: key=${e.key}, code=${e.code}, shift=${pressedKeys.has('Shift')}, spaceMod=${pressedKeys.has(' ')}, heldNoteKey=${heldNoteKey}, heldNotes=${heldNotes.join(',')}`;
      return;
    }
    // Always allow manual arpeggiate with arrow keys if a chord is held
    if ((e.code === "ArrowUp" || e.code === "ArrowDown") && heldNotes.length) {
      startArpeggio(heldNotes, e.code === "ArrowUp" ? "up" : "down");
      heldArp = true;
      return;
    }
    if (["[", "]", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    if (!keyToNote[key]) return;
    let note = keyToNote[key];
    if (pressedKeys.has(" ")) note += "#";
    let chordType = pressedKeys.has("Shift") ? "minor" : "major";
    if (pressedKeys.has("]")) chordType = chordType + "7";
    if (pressedKeys.has("[")) chordType = "fifth";
    const notes = getChordNotes(note, chordType);
    await Tone.start();
    if (currentSynth && typeof currentSynth.load === 'function' && typeof currentSynth.loaded !== 'undefined' && !currentSynth.loaded) {
      await currentSynth.load();
    }
    if (!notes.length) return;
    heldNoteKey = key;
    heldNotes = notes;
    heldArp = false;
    if (arpeggioActive) stopArpeggio(); // Only stop if running
    // Restore: play and highlight only the notes in the current octave
    highlightKeyboardKeys(notes); // Always highlight after stopping arpeggio
    if (pressedKeys.has("ArrowUp")) {
      startArpeggio(notes, "up");
      heldArp = true;
    } else if (pressedKeys.has("ArrowDown")) {
      startArpeggio(notes, "down");
      heldArp = true;
    } else {
      if (currentSynth) currentSynth.triggerAttackRelease(notes, 1.5);
    }
    document.getElementById('status').textContent =
      `keydown: key=${e.key}, code=${e.code}, shift=${pressedKeys.has('Shift')}, spaceMod=${pressedKeys.has(' ')}, heldNoteKey=${heldNoteKey}, heldNotes=${heldNotes.join(',')}`;
  });
  window.addEventListener("keyup", (e) => {
    pressedKeys.delete(e.key);
    let key = e.key.toLowerCase();
    if (isArpeggiateOn && keyToNote[key]) {
      heldArp = false;
      heldNoteKey = null;
      heldNotes = [];
      stopArpeggio();
      // No restore, no extra clear
      document.getElementById('status').textContent =
        `keyup: key=${e.key}, code=${e.code}, arpeggiate=ON`;
      return;
    }
    if ((["Shift", " ", "[", "]"].includes(e.key)) && heldNoteKey) {
      const notes = getCurrentHeldNotes();
      heldNotes = notes;
      highlightKeyboardKeys(notes);
      if (heldArp) {
        if (pressedKeys.has("ArrowUp")) {
          startArpeggio(notes, "up");
        } else if (pressedKeys.has("ArrowDown")) {
          startArpeggio(notes, "down");
        }
      } else {
        stopArpeggio();
      }
      document.getElementById('status').textContent =
        `keyup: key=${e.key}, code=${e.code}, shift=${pressedKeys.has('Shift')}, spaceMod=${pressedKeys.has(' ')}, heldNoteKey=${heldNoteKey}, heldNotes=${heldNotes.join(',')}`;
      return;
    }
    if (e.code === "ArrowUp" || e.code === "ArrowDown") {
      stopArpeggio();
      heldArp = false;
    }
    if (key === heldNoteKey) {
      heldNoteKey = null;
      heldNotes = [];
      stopArpeggio();
      clearKeyboardHighlights();
    }
    // If no chord is held, clear highlights
    if (!heldNoteKey && (!heldNotes || heldNotes.length === 0)) {
      clearKeyboardHighlights();
    }
  });
}

function setupArpeggiateToggle() {
  const toggle = document.getElementById('arpeggiate-toggle');
  if (!toggle) return;
  // Set initial state
  if (isArpeggiateOn) {
    toggle.classList.remove('off');
  } else {
    toggle.classList.add('off');
  }
  // Remove any previous event listeners
  toggle.replaceWith(toggle.cloneNode(true));
  const newToggle = document.getElementById('arpeggiate-toggle');
  newToggle.addEventListener('click', (e) => {
    e.preventDefault();
    isArpeggiateOn = !isArpeggiateOn;
    if (isArpeggiateOn) {
      newToggle.classList.remove('off');
    } else {
      newToggle.classList.add('off');
    }
    // Use isArpeggiateOn in your arpeggio logic as needed
  });
}

function setupApp() {
  const btn = document.getElementById('start-btn');
  const overlay = document.getElementById('start-overlay');
  if (!btn || !overlay) return;
  btn.addEventListener('click', async function handleStartAudio() {
    btn.disabled = true;
    try {
      await Tone.start();
      window.__audioStarted = true;
      overlay.style.display = 'none';
    } catch (err) {
      overlay.innerHTML += '<div style="color:#fff;background:#a00;padding:1em;margin:2em auto;max-width:500px;z-index:9999;">ERROR: Audio context could not be started. ' + (err?.message || err) + '</div>';
      btn.disabled = false;
      return;
    }
    try {
      setupInstrumentSelector();
      setupArpeggiateToggle();
      setupKeyboard();
    } catch (err) {
      document.body.innerHTML += '<div style="color:#fff;background:#a00;padding:1em;margin:2em auto;max-width:500px;z-index:9999;">ERROR: App initialization failed. ' + (err?.message || err) + '</div>';
    }
  }, { once: true });
}

// Set instrument-select to 'lead' by default in the UI
const instrumentSelect = document.getElementById('instrument-select');
if (instrumentSelect) {
  instrumentSelect.value = 'lead';
}

// --- FIXED KEYMAP ---
const keyMap = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6 };
const keyLabels = document.querySelectorAll('.major-chords-row .key-label-box');
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (keyMap[key] !== undefined) {
    keyLabels[keyMap[key]].classList.add('active-key');
  }
});
window.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  if (keyMap[key] !== undefined) {
    keyLabels[keyMap[key]].classList.remove('active-key');
  }
});
// --- PRESET, BPM, OCTAVE BUTTONS ---
const presets = ['piano', 'lead', 'organ'];
let presetIndex = 0;
const presetDisplay = document.getElementById('preset-display');
document.getElementById('preset-left').onclick = () => {
  presetIndex = (presetIndex - 1 + presets.length) % presets.length;
  presetDisplay.textContent = presets[presetIndex].charAt(0).toUpperCase() + presets[presetIndex].slice(1);
  document.getElementById('instrument-select').value = presets[presetIndex];
  document.getElementById('instrument-select').dispatchEvent(new Event('change'));
};
document.getElementById('preset-right').onclick = () => {
  presetIndex = (presetIndex + 1) % presets.length;
  presetDisplay.textContent = presets[presetIndex].charAt(0).toUpperCase() + presets[presetIndex].slice(1);
  document.getElementById('instrument-select').value = presets[presetIndex];
  document.getElementById('instrument-select').dispatchEvent(new Event('change'));
};
// BPM
const bpmDisplay = document.getElementById('bpm-display');
const bpmInput = document.getElementById('bpm-input');
document.getElementById('bpm-left').onclick = () => {
  let bpm = Math.max(30, parseInt(bpmInput.value) - 5);
  bpmInput.value = bpm;
  bpmDisplay.textContent = bpm;
};
document.getElementById('bpm-right').onclick = () => {
  let bpm = Math.min(300, parseInt(bpmInput.value) + 5);
  bpmInput.value = bpm;
  bpmDisplay.textContent = bpm;
};
// Octave
const octaveDisplay = document.getElementById('octave-display');
const octaveSelect = document.getElementById('octave-select');
document.getElementById('octave-left').onclick = () => {
  let octave = Math.max(2, parseInt(octaveSelect.value) - 1);
  octaveSelect.value = octave;
  octaveDisplay.textContent = octave;
};
document.getElementById('octave-right').onclick = () => {
  let octave = Math.min(5, parseInt(octaveSelect.value) + 1);
  octaveSelect.value = octave;
  octaveDisplay.textContent = octave;
};

// Arpeggio manual control
function startArpeggio(notes, direction = "up") {
  stopArpeggio();
  const arpNotes = getArpeggioNotes(notes);
  if (!arpNotes || !arpNotes.length) return;
  arpeggioNotes = direction === "up" ? arpNotes.slice() : arpNotes.slice().reverse();
  arpeggioIndex = 0;
  arpeggioActive = true;
  const msPerBeat = 60000 / getArpBpm();
  const msPerStep = msPerBeat / arpNotes.length;
  function playStep() {
    if (!arpeggioActive) return;
    highlightSingleKeyboardKey(arpeggioNotes[arpeggioIndex]);
    if (currentSynth) currentSynth.triggerAttackRelease(arpeggioNotes[arpeggioIndex], msPerStep / 1000);
    arpeggioIndex++;
    if (arpeggioIndex >= arpeggioNotes.length) {
      arpeggioIndex = 0; // Loop back to start for continuous arpeggio
    }
  }
  playStep();
  arpeggioInterval = setInterval(playStep, msPerStep);
}

function getAscendingChordNotes(notes) {
  if (!notes || !notes.length) return [];
  // Parse each note and ensure strict ascending pitch order
  const parsed = notes.map(n => {
    const m = n.match(/^([A-G]#?)(\d)$/);
    return m ? { note: m[1], octave: parseInt(m[2]) } : null;
  });
  if (parsed.includes(null)) return notes;
  const noteOrder = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  let result = [];
  let lastMidi = null;
  parsed.forEach((n, i) => {
    let octave = n.octave;
    let midi = octave * 12 + noteOrder.indexOf(n.note);
    if (lastMidi !== null && midi <= lastMidi) {
      while (midi <= lastMidi) {
        octave++;
        midi = octave * 12 + noteOrder.indexOf(n.note);
      }
    }
    result.push(n.note + octave);
    lastMidi = midi;
  });
  return result;
}