// ========================================================
// MODULE: auth.js
// Stable Google + manual login flow, restored to the last known working version.
// ========================================================

import { auth, db } from './firebase.js';

const secureAccounts = {
    "admin_ctm": { pwd: "K7m@P9q#", role: "teacher", name: "CTM 老師" },
    "stu01": { pwd: "x4V!n8B", role: "student", name: "學生 01" },
    "stu02": { pwd: "m2C@z9L", role: "student", name: "學生 02" },
    "stu03": { pwd: "p5R#k3W", role: "student", name: "學生 03" },
    "stu04": { pwd: "t8J$y2N", role: "student", name: "學生 04" },
    "stu05": { pwd: "h3F%d7X", role: "student", name: "學生 05" },
    "stu06": { pwd: "q9M^b4C", role: "student", name: "學生 06" },
    "stu07": { pwd: "q9M^b4C", role: "student", name: "學生 07" },
    "stu08": { pwd: "q9M^b4C", role: "student", name: "學生 08" },
    "stu09": { pwd: "q9M^b4C", role: "student", name: "學生 09" },
    "stu10": { pwd: "q9M^b4C", role: "student", name: "學生 10" }
};

const teacherEmails = new Set([
    'ctmlwsss@gmail.com',
    'jimchanchin@gmail.com',
    'admin_ctm'
]);

function normalizeUser(user) {
    const uid = String(user && (user.uid || user.id || user.email || '') || '').trim();
    const email = String(user && (user.email || '') || '').trim().toLowerCase();
    const displayName = user && (user.displayName || user.name) ? (user.displayName || user.name) : (email ? email.split('@')[0] : '學生');
    const role = user && user.role ? user.role : (teacherEmails.has(uid) || teacherEmails.has(email) ? 'teacher' : 'student');
    return { uid, email, displayName, role };
}

function handleLoginSuccess(user) {
    const safeUser = normalizeUser(user);
    console.log('Login success! User:', safeUser.displayName);

    window.currentUser = {
        uid: safeUser.uid,
        email: safeUser.email,
        displayName: safeUser.displayName,
        role: safeUser.role || 'student'
    };

    if (safeUser.uid && db) {
        const profileRef = db.collection('users').doc(safeUser.uid);
        profileRef.get().then((doc) => {
            const data = doc.exists ? doc.data() : {};
            const profile = {
                uid: safeUser.uid,
                email: safeUser.email || (data.email || ''),
                displayName: safeUser.displayName || (data.displayName || '學生'),
                role: safeUser.role || data.role || 'student',
                score: Number(data.score || 0),
                coins: Number(data.coins || 0),
                weeklyScore: Number(data.weeklyScore || 0),
                memos: Array.isArray(data.memos) ? data.memos : [],
                items: Array.isArray(data.items) ? data.items : [],
                emojis: Array.isArray(data.emojis) ? data.emojis : [],
                equippedEmoji: data.equippedEmoji || '',
                bags: Array.isArray(data.bags) ? data.bags : []
            };

            userScore = Number(profile.score || 0);
            userCoins = Number(profile.coins || 0);
            weeklyScore = Number(profile.weeklyScore || 0);
            memos = profile.memos;
            userItems = profile.items;
            userEmojis = profile.emojis;
            equippedEmoji = profile.equippedEmoji || '';
            userBags = profile.bags;

            return profileRef.set(profile, { merge: true });
        }).catch((err) => {
            console.warn('profile load failed', err);
        });
    }

    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('dashboard');
    if (loginScreen) loginScreen.classList.add('hidden');
    if (dashboard) dashboard.classList.remove('hidden');

    if (window.updateScoreUI) window.updateScoreUI();
    if (window.renderQuizzes) window.renderQuizzes();
    if (window.loadMemos) window.loadMemos(safeUser.uid);
}

function checkManualLogin() {
    const saved = sessionStorage.getItem('manualUser');
    if (!saved) return;
    try {
        const parsed = JSON.parse(saved);
        handleLoginSuccess(parsed);
    } catch (error) {
        console.warn('manual session parse failed', error);
    }
}

function loginWithGoogle() {
    if (!auth || !firebase || !firebase.auth) {
        alert('Firebase 尚未準備完成，請重新整理頁面。');
        return;
    }

    const provider = new firebase.auth.GoogleAuthProvider();
    auth.languageCode = 'zh-HK';
    auth.signInWithPopup(provider).catch((error) => {
        console.error('Google Login Error:', error);
        alert('Google 登入失敗，請稍後再試。');
    });
}

function loginManually() {
    const username = document.getElementById('username-input').value.trim();
    const password = document.getElementById('password-input').value.trim();

    if (secureAccounts[username] && secureAccounts[username].pwd === password) {
        const userObj = {
            displayName: secureAccounts[username].name,
            email: username + '@local',
            uid: username,
            role: secureAccounts[username].role
        };
        sessionStorage.setItem('manualUser', JSON.stringify(userObj));
        handleLoginSuccess(userObj);
    } else {
        alert('❌ 帳號或密碼錯誤！');
    }
}

function logout() {
    if (auth && typeof auth.signOut === 'function') {
        auth.signOut().catch(() => {});
    }
    sessionStorage.removeItem('manualUser');
    window.location.reload();
}

window.loginManually = loginManually;
window.loginWithGoogle = loginWithGoogle;
window.logout = logout;

auth.onAuthStateChanged((user) => {
    if (user) {
        const email = (user.email || '').toLowerCase();
        const isTeacher = teacherEmails.has(email) || teacherEmails.has(user.uid || '');
        handleLoginSuccess({
            displayName: user.displayName || 'Google User',
            email,
            uid: user.uid,
            role: isTeacher ? 'teacher' : 'student'
        });
    } else {
        checkManualLogin();
    }
});

console.log('[auth] Restored stable Google login flow.');
