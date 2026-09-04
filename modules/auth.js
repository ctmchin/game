// ========================================================
// MODULE: auth.js
// Handles all user login, logout, and session management.
// ========================================================

// We will import these from other modules we create later.
// For now, they are commented out.
// import { loadAdminDashboard } from './admin.js';
// import { updateScoreUI, renderInventory, renderLevelTable } from './profile.js';
// import { loadMemos } from './memo.js';
// import { renderQuizzes } from './quiz-engine.js';
// import { initMatchGame, initBossGame } from './games.js';
// import { loadSocialDataFromCloud, setupSandbox } from './social.js';
// import { loadLeaderboard } from './leaderboard.js';
// import { startReadingTimer } from './reading.js';

// This is the hardcoded list of users.
const secureAccounts = {
    "admin_ctm": { pwd: "K7m@P9q#", role: "teacher", name: "CTM 老師" },
    "stu01": { pwd: "x4V!n8B", role: "student", name: "學生 01" }, "stu02": { pwd: "m2C@z9L", role: "student", name: "學生 02" },
    "stu03": { pwd: "p5R#k3W", role: "student", name: "學生 03" }, "stu04": { pwd: "t8J$y2N", role: "student", name: "學生 04" },
    "stu05": { pwd: "h3F%d7X", role: "student", name: "學生 05" }, "stu06": { pwd: "q9M^b4C", role: "student", name: "學生 06" },
    "stu07": { pwd: "q9M^b4C", role: "student", name: "學生 07" }, "stu08": { pwd: "q9M^b4C", role: "student", name: "學生 08" },
    "stu09": { pwd: "q9M^b4C", role: "student", name: "學生 09" }, "stu10": { pwd: "q9M^b4C", role: "student", name: "學生 10" }
};

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export function checkManualLogin() {
    const saved = sessionStorage.getItem('manualUser');
    if (saved) {
        handleLoginSuccess(JSON.parse(saved));
    }
}

function loginWithGoogle() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().languageCode = 'zh-HK';
        firebase.auth().signInWithPopup(provider).catch(() => alert("維護中，請用手動登入"));
    } catch (e) {
        alert("請使用手動登入！");
    }
}

function loginManually() {
    const username = document.getElementById('username-input').value.trim();
    const password = document.getElementById('password-input').value.trim();

    if (secureAccounts[username] && secureAccounts[username].pwd === password) {
        const userObj = { displayName: secureAccounts[username].name, email: username + "@local", uid: username, role: secureAccounts[username].role };
        sessionStorage.setItem('manualUser', JSON.stringify(userObj));
        handleLoginSuccess(userObj);
    } else {
        alert("❌ 帳號或密碼錯誤！");
    }
}

function handleLoginSuccess(user) {
    // We will make currentUser global for now to fix onclick issues.
    window.currentUser = user;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');

    // This part will be uncommented and fixed as we create more modules.
    // if (user.role === 'teacher') {
    //     const adminMenu = document.getElementById('admin-menu');
    //     if (adminMenu) adminMenu.classList.remove('hidden');
    //     loadAdminDashboard();
    // }
    
    // ... a lot of function calls here that we will fix later ...
    console.log("Login success! User:", user.displayName);
    // For now, we just call the quiz renderer
    window.renderQuizzes();
}

function logout() {
    try {
        firebase.auth().signOut();
    } catch (e) { /* ignore */ }
    sessionStorage.removeItem('manualUser');
    window.location.reload();
}

// ========================================================
// THE FIX: Make the functions called by HTML public again.
// ========================================================
window.loginManually = loginManually;
window.loginWithGoogle = loginWithGoogle;
window.logout = logout;
