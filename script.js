// ========================================================
// 1. FIREBASE 老師專屬設定 (ctm-game)
// ========================================================
const firebaseConfig = {
    apiKey: "AIzaSyBXTjkrXmiLhp64MSBU1Ai5Iiv1EJfwA3I",
    authDomain: "ctm-game.firebaseapp.com",
    projectId: "ctm-game",
    storageBucket: "ctm-game.firebasestorage.app",
    messagingSenderId: "204941638255",
    appId: "1:204941638255:web:f23470bb681e9dac6eeb9a"
};

// 初始化 Firebase (使用瀏覽器相容寫法，請勿使用 import)
firebase.initializeApp(firebaseConfig);

// ========================================================
// 2. 帳號與登入邏輯 (Google 登入 與 模擬帳號)
// ========================================================
let currentUser = null;
let memos = [];

// A. 真正的 Google 帳號登入
function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().languageCode = 'zh-HK'; 
    
    // 呼叫彈出視窗
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            const user = result.user;
            handleLoginSuccess({
                displayName: user.displayName,
                uid: user.uid,
                role: "student"
            });
        }).catch((error) => {
            alert("登入失敗: " + error.message);
        });
}

// B. 預設的手動/教師帳號登入 (備用)
const presetAccounts = {
    "admin": { name: "陳老師 (管理員)", role: "teacher" },
    "student1": { name: "中一A 李德華", role: "student" },
    "student2": { name: "中二B 郭富城", role: "student" }
};

function loginManually() {
    const username = document.getElementById('username-input').value.trim();
    const password = document.getElementById('password-input').value;

    if (presetAccounts[username] && password === "123456") {
        handleLoginSuccess({
            displayName: presetAccounts[username].name,
            uid: username,
            role: presetAccounts[username].role
        });
    } else {
        alert("❌ 帳號或密碼錯誤！(測試學號: student1，密碼: 123456)");
    }
}

// 登入成功後的版面處理
function handleLoginSuccess(user) {
    currentUser = user;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    
    document.getElementById('user-display-name').innerText = user.displayName;
    loadMemos(user.uid);
}

function logout() {
    currentUser = null;
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('username-input').value = "";
    document.getElementById('password-input').value = "";
}

// ========================================================
// 3. 跨平台 iPad/手機 螢光筆核心 (自動偵測選取)
// ========================================================
let pendingSelectedText = "";
const mobileBar = document.getElementById('mobile-highlight-bar');
const previewText = document.getElementById('highlight-text-preview');

document.addEventListener('selectionchange', function() {
    const selection = window.getSelection();
    const selectedStr = selection.toString().trim();

    if (selectedStr.length > 0 && isSelectionInsideArticle(selection)) {
        pendingSelectedText = selectedStr;
        const displayStr = selectedStr.length > 15 ? selectedStr.substring(0, 15) + "..." : selectedStr;
        previewText.innerText = displayStr;
        mobileBar.classList.remove('hidden');
    }
});

function isSelectionInsideArticle(selection) {
    if (selection.rangeCount === 0) return false;
    const container = selection.getRangeAt(0).commonAncestorContainer;
    const articleCard = document.getElementById('article-content');
    return articleCard && articleCard.contains(container.nodeType === 3 ? container.parentNode : container);
}

function confirmSaveHighlight() {
    if (pendingSelectedText.length > 0) {
        saveMemo(pendingSelectedText);
        alert("🖍️ 重點已成功收藏到您的備忘錄！");
        window.getSelection().removeAllRanges();
        closeHighlightBar();
    }
}

function closeHighlightBar() {
    mobileBar.classList.add('hidden');
    pendingSelectedText = "";
}

// ========================================================
// 4. 備忘錄儲存邏輯 (依使用者隔離)
// ========================================================
function saveMemo(text) {
    const now = new Date();
    const timeString = now.toLocaleDateString() + " " + now.toLocaleTimeString();

    const newMemo = {
        content: text,
        time: timeString
    };
    memos.unshift(newMemo);

    updateMemoUI();
    
    if (currentUser) {
        localStorage.setItem(`memos_${currentUser.uid}`, JSON.stringify(memos));
    }
}

function updateMemoUI() {
    const list = document.getElementById('memo-list');
    if (memos.length === 0) {
        list.innerHTML = '<p style="color: #888; text-align: center;">暫無筆記，快去閱讀區畫重點吧！</p>';
        return;
    }
    list.innerHTML = memos.map(memo => `
        <div class="memo-item">
            <p>${memo.content}</p>
            <div class="memo-time">收藏於：${memo.time}</div>
        </div>
    `).join('');
}

function loadMemos(uid) {
    const saved = localStorage.getItem(`memos_${uid}`);
    if (saved) {
        memos = JSON.parse(saved);
    } else {
        memos = [];
    }
    updateMemoUI();
}

function switchTab(tabId, event) {
    document.querySelectorAll('.module').forEach(mod => mod.classList.remove('active'));
    document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    if(event) event.target.classList.add('active');
}
