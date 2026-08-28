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
// 2. 帳號與登入邏輯
// ========================================================
let currentUser = null;
let memos = [];
let userScore = 0; // 新增積分變數

function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().languageCode = 'zh-HK'; 
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            handleLoginSuccess({ displayName: result.user.displayName, uid: result.user.uid });
        }).catch((error) => alert("登入失敗: " + error.message));
}

function loginManually() {
    const username = document.getElementById('username-input').value.trim();
    if (username !== "") {
        handleLoginSuccess({ displayName: username + " (手動)", uid: username });
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
    renderQuizzes(); // 登入後自動載入題目
}

function logout() {
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
// 3. 螢光筆與備忘錄系統
// ========================================================
let pendingSelectedText = "";
const mobileBar = document.getElementById('mobile-highlight-bar');

document.addEventListener('selectionchange', function() {
    const selection = window.getSelection();
    const selectedStr = selection.toString().trim();
    if (selectedStr.length > 0 && isSelectionInsideArticle(selection)) {
        pendingSelectedText = selectedStr;
        document.getElementById('highlight-text-preview').innerText = selectedStr.substring(0, 15) + "...";
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
// 4. 動態題庫引擎 (老師未來只需在這裡加題目)
// ========================================================

// 模塊 1：成語題庫
const idiomsData = [
    {
        question: "【炙手可熱】請判斷以下哪一個句子正確使用了此成語？",
        options: [
            "A. 今年的夏天特別炎熱，走出冷氣房，外面簡直是炙手可熱。",
            "B. 這款最新推出的智能手機設計新穎，在市場上炙手可熱。",
            "C. 這位新晉歌手的演唱會門票炙手可熱，一票難求。",
            "D. 丞相目前在朝廷中炙手可熱，百官都爭相討好他。"
        ],
        correctIndex: 3, // D是正確答案 (陣列從0開始數)
        explanation: "✅ 正確！【炙手可熱】比喻權勢極大，氣焰很盛。注意，這是一個帶有貶義的成語，不可用於天氣熱或商品/事物受歡迎！"
    },
    {
        question: "【差強人意】請判斷以下哪一個句子正確使用了此成語？",
        options: [
            "A. 這次考試他的成績退步了很多，真是令人差強人意。",
            "B. 雖然這部電影的特效一般，但劇情還算差強人意。",
            "C. 他做事總是馬馬虎虎，表現實在是太差強人意了。",
            "D. 經過多次修改，這份報告依然差強人意，不被接納。"
        ],
        correctIndex: 1,
        explanation: "✅ 正確！【差強人意】是指「大體上還能使人滿意」，是褒義（偏中性）詞。很多學生會誤以為是「不能令人滿意」。"
    }
];

// 模塊 2：語病題庫
const grammarData = [
    {
        question: "請找出並修正以下句子的語病：「由於連日暴雨，使到低窪地區發生了嚴重的水浸。」",
        options: [
            "A. 缺少主語：應刪去「由於」或「使到」。",
            "B. 搭配不當：「發生」不能搭配「水浸」。",
            "C. 詞語冗贅：「嚴重」和「水浸」意思重複。",
            "D. 邏輯矛盾：「連日暴雨」不會導致「水浸」。"
        ],
        correctIndex: 0,
        explanation: "✅ 正確！這是典型的「濫用介詞導致主語缺失」。用了「由於」又用「使到」，整句話就找不到主角了。"
    }
];

// 渲染題目的函數
function renderQuizzes() {
    renderQuizBlock('quiz-container-1', idiomsData, 'idioms');
    renderQuizBlock('quiz-container-2', grammarData, 'grammar');
}

function renderQuizBlock(containerId, dataArray, quizType) {
    const container = document.getElementById(containerId);
    let html = '';
    
    dataArray.forEach((q, index) => {
        html += `
        <div class="card" style="margin-bottom: 20px;">
            <p class="question"><strong>第 ${index + 1} 題：</strong>${q.question}</p>
            <div class="options">
                ${q.options.map((opt, optIndex) => `
                    <button class="btn-option" onclick="checkAnswer(this, ${optIndex === q.correctIndex}, '${q.explanation}')">${opt}</button>
                `).join('')}
            </div>
            <div class="feedback hidden" style="margin-top:15px;"></div>
        </div>`;
    });
    
    container.innerHTML = html;
}

// 檢查答案與計分
function checkAnswer(btn, isCorrect, explanation) {
    const parent = btn.parentElement;
    const feedback = parent.nextElementSibling;
    
    // 鎖定所有選項
    parent.querySelectorAll('.btn-option').forEach(b => b.disabled = true);
    
    feedback.classList.remove('hidden');
    if (isCorrect) {
        btn.style.backgroundColor = '#d4edda';
        btn.style.borderColor = '#28a745';
        feedback.className = 'feedback success';
        feedback.innerHTML = explanation + "<br><br>🌟 獲得 20 積分！";
        userScore += 20;
        document.getElementById('score').innerText = userScore;
    } else {
        btn.style.backgroundColor = '#f8d7da';
        btn.style.borderColor = '#dc3545';
        feedback.className = 'feedback error';
        feedback.innerHTML = "❌ 答錯了！<br><br>" + explanation;
    }
}
