// ========================================================
// MODULE: main.js (Master Controller)
// ========================================================
import './firebase.js';
import './profile.js';      // <-- Turn on the profile system
import './quiz-engine.js';   // <-- Turn on the quiz system
import './ui.js';
import './auth.js';          // <-- Auth is last, as it depends on the others

console.log("All systems loaded.");
