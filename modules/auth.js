// ========================================================
// MODULE: auth.js
// Stable login flow with UID-based user persistence and teacher visibility.
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

function localProfileKey(uid) {
    return `game_profile_${uid}`;
}

function normalizeUser(input = {}) {
    const uid = String(input.uid || input.id || input.email || '').trim();
    const email = String(input.email || '').trim().toLowerCase();
    const displayName = input.displayName || input.name || (email ? email.split('@')[0] : '學生');
    const role = input.role || (teacherEmails.has(uid) || teacherEmails.has(email) ? 'teacher' : 'student');
    return { uid, email, displayName, role };
}

function readStoredProfile(uid) {
    try {
        if (!uid) return null;
        const raw = localStorage.getItem(localProfileKey(uid));
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn('readStoredProfile failed:', error);
        return null;
    }
}

function writeStoredProfile(profile) {
    try {
        if (!profile || !profile.uid) return;
        localStorage.setItem(localProfileKey(profile.uid), JSON.stringify(profile));
    } catch (error) {
        console.warn('writeStoredProfile failed:', error);
    }
}

function hydrateProfile(profile) {
    if (!profile || !profile.uid) return;

    window.currentUser = {
        uid: profile.uid,
        email: profile.email || '',
        displayName: profile.displayName || '學生',
        role: profile.role || 'student'
    };

    window.userScore = Number(profile.score || 0);
    window.userCoins = Number(profile.coins || 0);
    window.weeklyScore = Number(profile.weeklyScore || 0);
    window.memos = Array.isArray(profile.memos) ? profile.memos : [];
    window.userItems = Array.isArray(profile.items) ? profile.items : [];
    window.userEmojis = Array.isArray(profile.emojis) ? profile.emojis : [];
    window.equippedEmoji = profile.equippedEmoji || '';
    window.userBags = Array.isArray(profile.bags) ? profile.bags : [];

    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('dashboard');
    if (loginScreen) loginScreen.classList.add('hidden');
    if (dashboard) dashboard.classList.remove('hidden');

    if (typeof window.updateScoreUI === 'function') {
        window.updateScoreUI();
    }
    if (typeof window.loadMemos === 'function') {
        window.loadMemos(profile.uid);
    }
    if (typeof window.renderQuizzes === 'function') {
        window.renderQuizzes();
    }
}

async function ensureUserProfile(userInput) {
    const base = normalizeUser(userInput);
    if (!base.uid) return base;

    const stored = readStoredProfile(base.uid) || {};
    const fallback = {
        uid: base.uid,
        email: base.email || stored.email || '',
        displayName: base.displayName || stored.displayName || '學生',
        role: base.role || stored.role || 'student',
        score: Number(stored.score || 0),
        coins: Number(stored.coins || 0),
        weeklyScore: Number(stored.weeklyScore || 0),
        memos: Array.isArray(stored.memos) ? stored.memos : [],
        items: Array.isArray(stored.items) ? stored.items : [],
        emojis: Array.isArray(stored.emojis) ? stored.emojis : [],
        equippedEmoji: stored.equippedEmoji || '',
        bags: Array.isArray(stored.bags) ? stored.bags : [],
        lastLogin: Date.now()
    };

    if (!db) {
        writeStoredProfile(fallback);
        return fallback;
    }

    try {
        const ref = db.collection('users').doc(base.uid);
        const snap = await ref.get();
        const cloud = snap.exists ? snap.data() : {};

        const merged = {
            uid: base.uid,
            email: (base.email || cloud.email || stored.email || '').toLowerCase(),
            displayName: base.displayName || cloud.displayName || stored.displayName || '學生',
            role: base.role || cloud.role || stored.role || 'student',
            score: Number(cloud.score || stored.score || 0),
            coins: Number(cloud.coins || stored.coins || 0),
            weeklyScore: Number(cloud.weeklyScore || stored.weeklyScore || 0),
            memos: Array.isArray(cloud.memos) && cloud.memos.length ? cloud.memos : (Array.isArray(stored.memos) ? stored.memos : []),
            items: Array.isArray(cloud.items) && cloud.items.length ? cloud.items : (Array.isArray(stored.items) ? stored.items : []),
            emojis: Array.isArray(cloud.emojis) && cloud.emojis.length ? cloud.emojis : (Array.isArray(stored.emojis) ? stored.emojis : []),
            equippedEmoji: cloud.equippedEmoji || stored.equippedEmoji || '',
            bags: Array.isArray(cloud.bags) && cloud.bags.length ? cloud.bags : (Array.isArray(stored.bags) ? stored.bags : []),
            lastLogin: Date.now()
        };

        if (teacherEmails.has(merged.email)) {
            merged.role = 'teacher';
        }

        await ref.set(merged, { merge: true });
        writeStoredProfile(merged);
        return merged;
    } catch (error) {
        console.warn('ensureUserProfile failed:', error);
        writeStoredProfile(fallback);
        return fallback;
    }
}

async function handleLoginSuccess(user) {
    const safeUser = normalizeUser(user);
    if (!safeUser.uid) {
        console.warn('handleLoginSuccess called without uid');
        return;
    }

    const profile = await ensureUserProfile(safeUser);
    hydrateProfile(profile);
}

function checkManualLogin() {
    try {
        const saved = sessionStorage.getItem('manualUser');
        if (!saved) return;
        handleLoginSuccess(JSON.parse(saved));
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

window.saveUserProgress = async function (override = {}) {
    const current = window.currentUser || currentUser || {};
    if (!current.uid) return;

    const profile = {
        uid: current.uid,
        email: (current.email || '').toLowerCase(),
        displayName: current.displayName || '學生',
        role: current.role || 'student',
        score: Number(window.userScore ?? 0),
        coins: Number(window.userCoins ?? 0),
        weeklyScore: Number(window.weeklyScore ?? 0),
        memos: Array.isArray(window.memos) ? window.memos : [],
        items: Array.isArray(window.userItems) ? window.userItems : [],
        emojis: Array.isArray(window.userEmojis) ? window.userEmojis : [],
        equippedEmoji: window.equippedEmoji || '',
        bags: Array.isArray(window.userBags) ? window.userBags : [],
        lastLogin: Date.now(),
        ...override
    };

    writeStoredProfile(profile);
    if (db) {
        await db.collection('users').doc(current.uid).set(profile, { merge: true });
    }
    window.currentUser = { ...window.currentUser, ...profile };
    if (typeof currentUser !== 'undefined') currentUser = window.currentUser;
};

window.loadUserProgress = async function (uidOverride) {
    const targetUid = uidOverride || (window.currentUser && window.currentUser.uid);
    if (!targetUid) return;

    const stored = readStoredProfile(targetUid);
    const fromCloud = db ? (await db.collection('users').doc(targetUid).get()).data() : null;
    const profile = fromCloud || stored;
    if (profile) {
        hydrateProfile(profile);
    }
};

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

console.log('[auth] Stable Google login with UID-based profile persistence.');
