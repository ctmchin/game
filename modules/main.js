// ========================================================
// MODULE: main.js
// This is our new "Master Controller" or "Entry Point".
// ========================================================

// 1. We IMPORT from our new modules.
// We use './' because they are in the same 'modules' folder.
import { checkManualLogin } from './auth.js';
import './ui.js'; // We just need to import this to make its window functions available.

// 2. We call the initial functions needed when the page loads.
console.log("Main.js has started...");

// Check if the user is already logged in from a previous session.
checkManualLogin();
