// ========================================================
// 1. FIREBASE 初始化
// ========================================================
const firebaseConfig = {
    apiKey: "AIzaSyBXTjkrXmiLhp64MSBU1Ai5Iiv1EJfwA3I",
    authDomain: "ctm-game.firebaseapp.com",
    projectId: "ctm-game",
    storageBucket: "ctm-game.firebasestorage.app",
    messagingSenderId: "204941638255",
    appId: "1:204941638255:web:f23470bb681e9dac6eeb9a"
};
firebase.initializeApp(firebaseConfig);

// ========================================================
// 2. 帳號狀態持久化 (解決 Refresh 需重新登入的問題)
// ========================================================
let currentUser = null;
let memos = [];
let userScore = 0;

// 監聽登入狀態：刷新網頁也不會登出
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        handleLoginSuccess({ displayName: user.displayName, uid: user.uid });
    } else {
        const savedManualUser = sessionStorage.getItem('manualUser');
        if (savedManualUser) {
            handleLoginSuccess(JSON.parse(savedManualUser));
        } else {
            document.getElementById('login-screen').classList.remove('hidden');
        }
    }
});

function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().languageCode = 'zh-HK'; 
    firebase.auth().signInWithPopup(provider).catch((error) => alert("登入失敗: " + error.message));
}

function loginManually() {
    const username = document.getElementById('username-input').value.trim();
    if (username !== "") {
        const userObj = { displayName: username + " (手動)", uid: username };
        sessionStorage.setItem('manualUser', JSON.stringify(userObj)); 
        handleLoginSuccess(userObj);
    } else {
        alert("請輸入學號！");
    }
}

function handleLoginSuccess(user) {
    currentUser = user;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('user-display-name').innerText = user.displayName;
    loadMemos(user.uid);
    renderQuizzes(); 
}

function logout() {
    firebase.auth().signOut();
    sessionStorage.removeItem('manualUser');
    currentUser = null;
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
}

function switchTab(tabId, event) {
    document.querySelectorAll('.module').forEach(mod => mod.classList.remove('active'));
    document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    if(event) event.target.classList.add('active');
}

// ========================================================
// 3. 螢光筆與備忘錄系統 (顯示開頭...結尾)
// ========================================================
let pendingSelectedText = "";
const mobileBar = document.getElementById('mobile-highlight-bar');

document.addEventListener('selectionchange', function() {
    const selection = window.getSelection();
    const selectedStr = selection.toString().trim();
    if (selectedStr.length > 0 && isSelectionInsideArticle(selection)) {
        pendingSelectedText = selectedStr;
        
        // 優化顯示：保留前 8 字與後 4 字
        let displayStr = selectedStr;
        if (selectedStr.length > 15) {
            displayStr = selectedStr.substring(0, 8) + " ... " + selectedStr.substring(selectedStr.length - 4);
        }
        document.getElementById('highlight-text-preview').innerText = displayStr;
        mobileBar.classList.remove('hidden');
    } else {
        mobileBar.classList.add('hidden');
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
        const now = new Date();
        memos.unshift({ content: pendingSelectedText, time: now.toLocaleDateString() + " " + now.toLocaleTimeString() });
        updateMemoUI();
        localStorage.setItem(`memos_${currentUser.uid}`, JSON.stringify(memos));
        alert("🖍️ 重點已成功收藏！");
        window.getSelection().removeAllRanges();
        mobileBar.classList.add('hidden');
    }
}

function closeHighlightBar() {
    mobileBar.classList.add('hidden');
    pendingSelectedText = "";
}

function updateMemoUI() {
    const list = document.getElementById('memo-list');
    if (memos.length === 0) {
        list.innerHTML = '<p style="color: #888; text-align: center;">暫無筆記</p>';
        return;
    }
    list.innerHTML = memos.map(m => `<div class="memo-item"><p>${m.content}</p><div class="memo-time">${m.time}</div></div>`).join('');
}

function loadMemos(uid) {
    const saved = localStorage.getItem(`memos_${uid}`);
    memos = saved ? JSON.parse(saved) : [];
    updateMemoUI();
}

// ========================================================
// 4. 動態題庫引擎 (測試版 10 題，確認不崩潰)
// ========================================================
const idiomsData = [
    {
        question: "【炙手可熱】請判斷以下哪一個句子正確使用了此成語？",
        options: [
            "A. 夏天特別炎熱，走出冷氣房外面簡直是炙手可熱。",
            "B. 這款智能手機設計新穎，在市場上炙手可熱。",
            "C. 這位歌手的演唱會門票炙手可熱，一票難求。",
            "D. 丞相目前在朝廷中炙手可熱，百官爭相討好。"
        ],
        correctIndex: 3,
        explanation: "✅ 正確！【炙手可熱】比喻權勢大、氣焰盛，帶貶義。不可用於天氣熱或商品受歡迎！"
    },
    {
        question: "【萬人空巷】請判斷以下哪一個句子正確使用了此成語？",
        options: [
            "A. 疫情嚴重期間，街上萬人空巷，冷冷清清毫無人氣。",
            "B. 新年煙花匯演吸引了無數市民，海傍一帶萬人空巷。",
            "C. 這座廢棄的古城已經萬人空巷，只剩下斷壁殘垣。",
            "D. 颱風即將來襲，商店關門，鬧市區頓時萬人空巷。"
        ],
        correctIndex: 1,
        explanation: "✅ 正確！【萬人空巷】指成千上萬的人湧向某處，導致「巷子空了」。這是形容「極度熱鬧」，常被誤用為「冷清」。"
    },
    {
        question: "【首當其衝】請判斷以下哪一個句子正確使用了此成語？",
        options: [
            "A. 金融海嘯來襲，依賴出口的製造業首當其衝受到重創。",
            "B. 學校舉辦徵文比賽，他首當其衝報名參加，非常積極。",
            "C. 當大家都不知所措時，班長首當其衝提出了解決方案。",
            "D. 在推廣環保政策上，政府部門應該首當其衝做好榜樣。"
        ],
        correctIndex: 0,
        explanation: "✅ 正確！【首當其衝】指最先受到攻擊或遭遇災難。常被誤用為「首先、帶頭去做某事」。"
    },
    {
        question: "【空穴來風】請判斷以下哪一個句子正確使用了此成語？",
        options: [
            "A. 這座山谷裡的風很大，常常能聽到空穴來風的聲音。",
            "B. 他說的那些關於公司倒閉的傳言，完全是空穴來風。",
            "C. 警方經過調查，證實這則駭人聽聞的消息並非空穴來風。",
            "D. 他的想法總是空穴來風，充滿了天馬行空的想像力。"
        ],
        correctIndex: 2,
        explanation: "✅ 正確！【空穴來風】原指有孔洞便會進風，比喻「傳言有根據、事出有因」。現常被誤用為「毫無根據」。"
    },
    {
        question: "【差強人意】請判斷以下哪一個句子正確使用了此成語？",
        options: [
            "A. 這次考試他的成績退步了很多，真是令人差強人意。"
