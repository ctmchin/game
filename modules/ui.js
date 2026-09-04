// ========================================================
// MODULE: ui.js
// Handles general user interface interactions.
// ========================================================

// We will import this later
// import { initPhysicsEngine } from './gacha.js';

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('active');
}

function switchTab(tabId, event) {
    document.querySelectorAll('.module').forEach(mod => mod.classList.remove('active'));
    document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));
    
    const target = document.getElementById(tabId);
    if (target) target.classList.add('active');
    if (event) event.target.classList.add('active');
    
    if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('active');
    }
    
    if (tabId === 'feature-reading') {
        // We will call this properly later
        if (window.startReadingTimer) window.startReadingTimer();
    }
    if (tabId === 'feature-13') {
        // We will call this properly later
        // setTimeout(initPhysicsEngine, 500);
    }
}

// ========================================================
// THE FIX: Make the functions called by HTML public again.
// ========================================================
window.toggleSidebar = toggleSidebar;
window.switchTab = switchTab;
