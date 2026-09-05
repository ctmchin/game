// ========================================================
// MODULE: auth.js (Final, Correct Version)
// This handles BOTH manual and Google login.
// ========================================================

// Import the auth service from our firebase module
import { auth } from './firebase.js';

const secureAccounts = {
    "admin_ctm": { pwd: "K7m@P9q#", role: "teacher", name: "CTM 老師" },
    "stu01": { pwd: "x4V!n8B", role: "student", name: "學生 01" }, "stu02": { pwd: "m2C@z9L", role: "student", name: "學生 02" },
    "stu03": { pwd: "p5R#k3W", role: "student", name: "學生 03" }, "stu04": { pwd: "t8J$y2N", role: "student", name: "學生 04" },
    "stu05": { pwd: "h3F%d7X", role: "student", name: "學生 05" }, "stu06": { pwd: "q9M^b4C", role: "student", name: "學生 06" },
    "stu07": { pwd: "q9M^b4C", role: "student", name: "學生 07" }, "stu08": { pwd: "q9M^b4C", role: "student", name: "學生 08" },
    "stu09": { pwd: "q9M^b4C", role: "student", name: "學生 09" }, "stu10": { pwd: "q9M^b4C", role: "student", name: "學生 10" }
};

// This function is called after any successful login
function handleLoginSuccess(user) {
    console.log("Login success! User:", user.displayName);
    window.currentUser = user;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');

    // --- THE FIX: Call the functions to display user info and quizzes ---
    if (window.updateScoreUI) {
        window.updateScoreUI();
    }
    if (window.renderQuizzes) {
        window.renderQuizzes();
    }
}


// This function checks for a saved manual login session
function checkManualLogin() {
    const saved = sessionStorage.getItem('manualUser');
    if (saved) {
        handleLoginSuccess(JSON.parse(saved));
    }
}

// --- GOOGLE LOGIN FUNCTION ---
function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.languageCode = 'zh-HK';
    // We will handle the result with the onAuthStateChanged listener
    auth.signInWithPopup(provider).catch((error) => {
        console.error("Google Login Error:", error);
        alert("Google 登入失敗，請稍後再試。");
    });
}

// --- MANUAL LOGIN FUNCTION ---
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

// --- LOGOUT FUNCTION ---
function logout() {
    auth.signOut().catch(() => {});
    sessionStorage.removeItem('manualUser');
    window.location.reload();
}

// --- MAKE FUNCTIONS PUBLIC FOR HTML BUTTONS ---
window.loginManually = loginManually;
window.loginWithGoogle = loginWithGoogle; // <-- This makes the Google button work
window.logout = logout;

// --- MASTER AUTH LISTENER ---
// This one listener handles everything: Google login, and initial page load.
auth.onAuthStateChanged((user) => {
    if (user) {
        // This will run after a successful Google login
        handleLoginSuccess({ displayName: user.displayName, email: user.email, uid: user.uid, role: 'teacher' });
    } else {
        // This will run on the initial page load to check for a manual session
        checkManualLogin();
    }
});
