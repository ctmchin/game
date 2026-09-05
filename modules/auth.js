// ========================================================
// MODULE: auth.js (New Simplified Version)
// ========================================================

// Import the auth service from our new firebase module
import { auth } from './firebase.js';

// This is the hardcoded list of users.
const secureAccounts = {
    "admin_ctm": { pwd: "K7m@P9q#", role: "teacher", name: "CTM 老師" },
    "stu01": { pwd: "x4V!n8B", role: "student", name: "學生 01" }, "stu02": { pwd: "m2C@z9L", role: "student", name: "學生 02" },
    "stu03": { pwd: "p5R#k3W", role: "student", name: "學生 03" }, "stu04": { pwd: "t8J$y2N", role: "student", name: "學生 04" },
    "stu05": { pwd: "h3F%d7X", role: "student", name: "學生 05" }, "stu06": { pwd: "q9M^b4C", role: "student", name: "學生 06" },
    "stu07": { pwd: "q9M^b4C", role: "student", name: "學生 07" }, "stu08": { pwd: "q9M^b4C", role: "student", name: "學生 08" },
    "stu09": { pwd: "q9M^b4C", role: "student", name: "學生 09" }, "stu10": { pwd: "q9M^b4C", role: "student", name: "學生 10" }
};

// This function is called when the page loads to check if we are already logged in.
function checkManualLogin() {
    const saved = sessionStorage.getItem('manualUser');
    if (saved) {
        handleLoginSuccess(JSON.parse(saved));
    }
}

function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.languageCode = 'zh-HK';
    auth.signInWithPopup(provider).catch(() => alert("維護中，請用手動登入"));
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
    console.log("Login success! User:", user.displayName);
    window.currentUser = user; // Make user info available globally
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    // We have temporarily removed the call to renderQuizzes() to prevent errors.
}

function logout() {
    auth.signOut().catch(() => {});
    sessionStorage.removeItem('manualUser');
    window.location.reload();
}

// Make the functions public so the HTML buttons can find them.
window.loginManually = loginManually;
window.loginWithGoogle = loginWithGoogle;
window.logout = logout;

// Listen for authentication state changes
auth.onAuthStateChanged((user) => {
    if (user) {
        // This handles Google login success
        handleLoginSuccess({ displayName: user.displayName, email: user.email, uid: user.uid, role: 'teacher' });
    } else {
        // This handles the initial page load
        checkManualLogin();
    }
});
