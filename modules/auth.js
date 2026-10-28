// ========================================================
// MODULE: auth.js
// Handles manual + Google login and persistent user data
// ========================================================

import { auth, db } from './firebase.js';

const secureAccounts = {
    "admin_ctm": { pwd: "K7m@P9q#", role: "teacher", name: "CTM 老師" },
    "stu01": { pwd: "x4V!n8B", role: "student", name: "學生 01" }, "stu02": { pwd: "m2C@z9L", role: "student", name: "學生 02" },
    "stu03": { pwd: "p5R#k3W", role: "student", name: "學生 03" }, "stu04": { pwd: "t8J$y2N", role: "student", name: "學生 04" },
    "stu05": { pwd: "h3F%d7X", role: "student", name: "學生 05" }, "stu06": { pwd: "q9M^b4C", role: "student", name: "學生 06" },
    "stu07": { pwd: "q9M^b4C", role: "student", name: "學生 07" }, "stu08": { pwd: "q9M^b4C", role: "student", name: "學生 08" },
    "stu09": { pwd: "q9M^b4C", role: "student", name: "學生 09" }, "stu10": { pwd: "q9M^b4C", role: "student", name: "學生 10" }
};

const teacherEmails = new Set([
    'ctmlwsss@gmail.com',
    'jimchanchin@gmail.com',
    'admin_ctm'
]);

function normalizeUserInput(input = {}) {
    const uid = ((input.uid || input.id || input.email || '') + '').trim();
    const email = ((input.email || '') + '').trim().toLowerCase();
    const displayName = input.displayName || input.name || (email ? email.split('@')[0] : '學生');
    const role = input.role || (teacherEmails.has(uid) || teacherEmails.has(email) ? 'teacher' : 'student');

    return { uid, email, displayName, role };
}

function applyProfileToGame(profile) {
    if (!profile || !profile.uid) return;

    window.currentUser = {
        ...(window.currentUser || {}),
        uid: profile.uid,
        email: profile.email || '',
        displayName: profile.displayName || '學生',
        role: profile.role || 'student'
    };

    if (typeof currentUser !== 'undefined') {
        currentUser = window.currentUser;
    }

    userScore = Number(profile.score || 0);
    userCoins = Number(profile.coins || 0);
    weeklyScore = Number(profile.weeklyScore || 0);
    memos = Array.isArray(profile.memos) ? profile.memos : [];
    userItems = Array.isArray(profile.items) ? profile.items : [];
    userEmojis = Array.isArray(profile.emojis) ? profile.emojis : [];
    equippedEmoji = profile.equippedEmoji || '';
    userBags = Array.isArray(profile.bags) ? profile.bags : [];

    if (window.updateScoreUI) window.updateScoreUI();
    if (window.loadMemos) window.loadMemos(profile.uid);
    if (window.renderQuizzes) window.renderQuizzes();
}

async function ensureUserProfile(userInput) {
    const base = normalizeUserInput(userInput);
    if (!db || !base.uid) return base;

    const userRef = db.collection('users').doc(base.uid);

    try {
        const snapshot = await userRef.get();
        const existing = snapshot.exists ? snapshot.data() : {};

        const profile = {
            uid: base.uid,
            email: (base.email || existing.email || '').toLowerCase(),
            displayName: base.displayName || existing.displayName || '學生',
            role: base.role || existing.role || 'student',
            score: Number(existing.score || 0),
            coins: Number(existing.coins || 0),
            weeklyScore: Number(existing.weeklyScore || 0),
            memos: Array.isArray(existing.memos) ? existing.memos : [],
            items: Array.isArray(existing.items) ? existing.items : [],
            emojis: Array.isArray(existing.emojis) ? existing.emojis : [],
            equippedEmoji: existing.equippedEmoji || '',
            bags: Array.isArray(existing.bags) ? existing.bags : [],
            lastLogin: Date.now()
        };

        if (base.email && (teacherEmails.has(base.email) || teacherEmails.has(base.uid))) {
            profile.role = 'teacher';
        }

        await userRef.set(profile, { merge: true });
        return profile;
    } catch (error) {
        console.warn('ensureUserProfile failed:', error);
        return {
            uid: base.uid,
            email: base.email,
            displayName: base.displayName,
            role: base.role || 'student',
            score: 0,
            coins: 0,
            weeklyScore: 0,
            memos: [],
            items: [],
            emojis: [],
            equippedEmoji: '',
            bags: []
        };
    }
}

window.saveUserProgress = async function (override = {}) {
    const current = window.currentUser || currentUser || {};
    if (!current.uid || !db) return;

    const profile = {
        uid: current.uid,
        email: (current.email || '').toLowerCase(),
        displayName: current.displayName || '學生',
        role: current.role || 'student',
        score: Number(window.userScore ?? current.score ?? 0),
        coins: Number(window.userCoins ?? current.coins ?? 0),
        weeklyScore: Number(window.weeklyScore ?? current.weeklyScore ?? 0),
        memos: Array.isArray(window.memos) ? window.memos : (Array.isArray(current.memos) ? current.memos : []),
        items: Array.isArray(window.userItems) ? window.userItems : (Array.isArray(current.items) ? current.items : []),
        emojis: Array.isArray(window.userEmojis) ? window.userEmojis : (Array.isArray(current.emojis) ? current.emojis : []),
        equippedEmoji: window.equippedEmoji ?? current.equippedEmoji ?? '',
        bags: Array.isArray(window.userBags) ? window.userBags : (Array.isArray(current.bags) ? current.bags : []),
        lastLogin: Date.now(),
        ...override
    };

    await db.collection('users').doc(current.uid).set(profile, { merge: true });
    window.currentUser = { ...window.currentUser, ...profile };
    if (typeof currentUser !== 'undefined') currentUser = window.currentUser;
    return profile;
};

window.loadUserProgress = async function (uidOverride) {
    const targetUid = uidOverride || (window.currentUser && window.currentUser.uid) || (currentUser && currentUser.uid);
    if (!targetUid || !db) return;

    try {
        const doc = await db.collection('users').doc(targetUid).get();
        if (!doc.exists) return;
        const profile = doc.data();
        applyProfileToGame({
            uid: targetUid,
            email: profile.email || '',
            displayName: profile.displayName || '學生',
            role: profile.role || 'student',
            score: Number(profile.score || 0),
            coins: Number(profile.coins || 0),
            weeklyScore: Number(profile.weeklyScore || 0),
            memos: Array.isArray(profile.memos) ? profile.memos : [],
            items: Array.isArray(profile.items) ? profile.items : [],
            emojis: Array.isArray(profile.emojis) ? profile.emojis : [],
            equippedEmoji: profile.equippedEmoji || '',
            bags: Array.isArray(profile.bags) ? profile.bags : []
        });
    } catch (error) {
        console.warn('loadUserProgress error:', error);
    }
};

function handleLoginSuccess(user) {
    const safeUser = normalizeUserInput(user);
    if (!safeUser.uid) {
        console.warn('handleLoginSuccess called without uid');
        return;
    }

    const loginData = {
        ...safeUser,
        displayName: safeUser.displayName || '學生'
    };

    ensureUserProfile(loginData).then((profile) => {
        applyProfileToGame(profile);
    });

    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('dashboard');
    if (loginScreen) loginScreen.classList.add('hidden');
    if (dashboard) dashboard.classList.remove('hidden');
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
    auth.signOut().catch(() => {});
    sessionStorage.removeItem('manualUser');
    window.location.reload();
}

window.loginManually = loginManually;
window.loginWithGoogle = loginWithGoogle;
window.logout = logout;

auth.onAuthStateChanged(async (user) => {
    if (user) {
        const profile = await ensureUserProfile(user);
        applyProfileToGame(profile);

        const loginScreen = document.getElementById('login-screen');
        const dashboard = document.getElementById('dashboard');
        if (loginScreen) loginScreen.classList.add('hidden');
        if (dashboard) dashboard.classList.remove('hidden');
    } else {
        checkManualLogin();
    }
});

console.log('[auth] Firebase auth initialized with per-user profile storage.');
