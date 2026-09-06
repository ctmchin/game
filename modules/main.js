// ========================================================
// MODULE: main.js (Master Controller)
// ========================================================
import './firebase.js';
import './profile.js';      // <-- Turn on the profile system
import './quiz-engine.js';   // <-- Turn on the quiz system
import './ui.js';
import './reading.js';      // <-- Reading module (renders passages)
import './auth.js';          // <-- Auth is last, as it depends on the others

// Some legacy code (script.js) defines many global functions and variables
// used by inline onclick handlers and the old UI. Inject it as a plain
// script tag so those globals are available. After it loads, also load
// a small runtime patch (script-patch.js) that hardens selection/highlight
// behavior and memo-saving in case timing issues occur.
function loadLegacyScript() {
  try {
    // script.js is located at the repository root when served on GitHub Pages
    const s = document.createElement('script');
    s.src = './script.js';
    s.defer = false; // load and execute immediately
    s.onload = () => {
      console.log('[main] Legacy script.js loaded from', s.src);
      try {
        const p = document.createElement('script');
        p.src = './script-patch.js';
        p.defer = false;
        p.onload = () => { console.log('[main] script-patch.js loaded'); };
        p.onerror = (e) => { console.warn('[main] Failed to load script-patch.js', e); };
        document.head.appendChild(p);
      } catch (e) {
        console.warn('[main] Failed to inject script-patch.js', e);
      }
    };
    s.onerror = (e) => { console.warn('[main] Failed to load legacy script.js from', s.src, e); };
    document.head.appendChild(s);
  } catch (e) {
    console.warn('[main] Failed to inject legacy script.js', e);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadLegacyScript);
  } else {
    loadLegacyScript();
  }
}

console.log("All systems loaded.");
