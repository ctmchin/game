// ========================================================
// MODULE: auth.js
// Stable login flow with Google UID-based persistence.
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

function normalizeUser(user = {}) {
    const uid = String(user.uid || user.id || user.email || '').trim();
    const email = String(user.email || '').trim().toLowerCase();
    const displayName = user.displayName || user.name || (email ? email.split('@')[0] : '學生');
    const role = user.role || (teacherEmails.has(uid) || teacherEmails.has(email) ? 'teacher' : 'student');
    return { uid, email, displayName, role };
}

function getStoredProfile(uid) {
    try {
        if (!uid) return null;
        const raw = localStorage.getItem(localProfileKey(uid));
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn('getStoredProfile failed', error);
        return null;
    }
}

function saveStoredProfile(profile) {
    try {
        if (!profile || !profile.uid) return;
        localStorage.setItem(localProfileKey(profile.uid), JSON.stringify(profile));
    } catch (error) {
        console.warn('saveStoredProfile failed', error);
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

    if (typeof window.updateScoreUI === 'function') {
        window.updateScoreUI();
    }
    if (typeof window.loadMemos === 'function') {
        window.loadMemos(profile.uid);
    }
    if (typeof window.renderQuizzes === 'function') {
        window.renderQuizzes();
    }

    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('dashboard');
    if (loginScreen) loginScreen.classList.add('hidden');
    if (dashboard) dashboard.classList.remove('hidden');
}

async function syncCloudProfile(profile) {
    if (!db || !profile || !profile.uid) return profile;

    const userRef = db.collection('users').doc(profile.uid);
    try {
        const snapshot = await userRef.get();
        const existing = snapshot.exists ? snapshot.data() : {};

        const merged = {
            uid: profile.uid,
            email: (profile.email || existing.email || '').toLowerCase(),
            displayName: profile.displayName || existing.displayName || '學生',
            role: profile.role || existing.role || 'student',
            score: Number(existing.score || profile.score || 0),
            coins: Number(existing.coins || profile.coins || 0),
            weeklyScore: Number(existing.weeklyScore || profile.weeklyScore || 0),
            memos: Array.isArray(existing.memos) && existing.memos.length ? existing.memos : (Array.isArray(profile.memos) ? profile.memos : []),
            items: Array.isArray(existing.items) && existing.items.length ? existing.items : (Array.isArray(profile.items) ? profile.items : []),
            emojis: Array.isArray(existing.emojis) && existing.emojis.length ? existing.emojis : (Array.isArray(profile.emojis) ? profile.emojis : []),
            equippedEmoji: existing.equippedEmoji || profile.equippedEmoji || '',
            bags: Array.isArray(existing.bags) && existing.bags.length ? existing.bags : (Array.isArray(profile.bags) ? profile.bags : []),
            lastLogin: Date.now()
        };

        if (profile.email && teacherEmails.has(profile.email)) {
            merged.role = 'teacher';
        }

        await userRef.set(merged, { merge: true });
        return merged;
    } catch (error) {
        console.warn('syncCloudProfile failed', error);
        return profile;
    }
}

async function handleLoginSuccess(user) {
    const safeUser = normalizeUser(user);
    if (!safeUser.uid) {
        console.warn('handleLoginSuccess called without uid');
        return;
    }

    const stored = getStoredProfile(safeUser.uid) || {};
    const baseProfile = {
        uid: safeUser.uid,
        email: safeUser.email || stored.email || '',
        displayName: safeUser.displayName || stored.displayName || '學生',
        role: safeUser.role || stored.role || 'student',
        score: Number(stored.score || 0),
        coins: Number(stored.coins || 0),
        weeklyScore: Number(stored.weeklyScore || 0),
        memos: Array.isArray(stored.memos) ? stored.memos : [],
        items: Array.isArray(stored.items) ? stored.items : [],
        emojis: Array.isArray(stored.emojis) ? stored.emojis : [],
        equippedEmoji: stored.equippedEmoji || '',
        bags: Array.isArray(stored.bags) ? stored.bags : []
    };

    let finalProfile = baseProfile;
    if (db) {
        finalProfile = await syncCloudProfile(baseProfile);
    }

    saveStoredProfile(finalProfile);
    hydrateProfile(finalProfile);
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

console.log('[auth] Stable Google login with UID-based profile persistence enabled.');
