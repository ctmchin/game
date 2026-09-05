// ========================================================
// MODULE: main.js
// ========================================================

// 1. We IMPORT from all our new modules to make sure they are loaded in the correct order.
import { checkManualLogin } from './auth.js';
import './ui.js';
import './quiz-engine.js'; // <-- THE FIX: This line was missing.

// 2. We call the initial functions needed when the page loads.
console.log("Main.js has started...");

// Check if the user is already logged in from a previous session.
checkManualLogin();
