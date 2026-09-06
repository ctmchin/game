// ========================================================
// MODULE: main.js (Master Controller)
// ========================================================
import './firebase.js';
import './profile.js';      // <-- Turn on the profile system
import { renderQuizzes as renderQuizzesFromModule } from './quiz-engine.js';   // <-- Turn on the quiz system
import './ui.js';
import './reading.js';      // <-- Reading module (renders passages)
import './auth.js';          // <-- Auth is last, as it depends on the others

// Load legacy script only if it is not already present. Some deployments
// include a direct <script src="script.js"></script> in index.html; in
// that case do not inject again or you will get duplicate-declaration
// SyntaxErrors (e.g., 'Identifier "currentUser" has already been declared').
function loadLegacyScript() {
  try {
    // Check for an existing script tag that already loads script.js
    const existing = Array.from(document.getElementsByTagName('script')).find(s => {
      try { return s.getAttribute && (s.getAttribute('src') === './script.js' || s.getAttribute('src') === 'script.js'); } catch(e){return false;}
    });
    if (existing) {
      console.log('[main] legacy script.js already present in document; skipping injection');
      // still attempt to load patch if not present
      const patchExists = Array.from(document.getElementsByTagName('script')).some(s => { try { return s.getAttribute && (s.getAttribute('src') === './script-patch.js' || s.getAttribute('src') === 'script-patch.js'); } catch(e){return false;} });
      if (!patchExists) {
        const p = document.createElement('script'); p.src = './script-patch.js'; document.head.appendChild(p);
      }
      // if module render available, call it (guarded)
      try { if (typeof renderQuizzesFromModule === 'function') { setTimeout(()=>{ try{ renderQuizzesFromModule(); window.renderQuizzes = renderQuizzesFromModule; }catch(e){console.warn('[main] renderQuizzesFromModule after existing script failed', e);} }, 50); } } catch(e){console.warn('[main] after-existing render attempt failed', e);}
      return;
    }

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
      // after legacy script finished, attempt to call module renderQuizzes
      try {
        if (typeof renderQuizzesFromModule === 'function') {
          // call the module's render function to populate containers
          setTimeout(() => {
            try { renderQuizzesFromModule(); window.renderQuizzes = renderQuizzesFromModule; } catch(e){ console.warn('[main] renderQuizzesFromModule failed', e); }
          }, 50);
        }
      } catch(e) { console.warn('[main] post-legacy render attempt failed', e); }
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
    document.addEventListener('DOMContentLoaded', () => {
      try {
        // also call the module render in case legacy script is unavailable
        if (typeof renderQuizzesFromModule === 'function') { renderQuizzesFromModule(); window.renderQuizzes = renderQuizzesFromModule; }
      } catch(e){ console.warn('DOMContentLoaded module render failed', e); }
    });
  } else {
    loadLegacyScript();
    try { if (typeof renderQuizzesFromModule === 'function') { renderQuizzesFromModule(); window.renderQuizzes = renderQuizzesFromModule; } } catch(e){ console.warn('Immediate module render failed', e); }
  }
}

console.log("All systems loaded.");
