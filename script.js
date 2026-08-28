// ========================================================
// 1. FIREBASE 初始化與斷線保護
// ========================================================
const firebaseConfig = {
    apiKey: "AIzaSyBXTjkrXmiLhp64MSBU1Ai5Iiv1EJfwA3I",
    authDomain: "ctm-game.firebaseapp.com",
    projectId: "ctm-game",
    storageBucket: "ctm-game.firebasestorage.app",
    messagingSenderId: "204941638255",
    appId: "1:204941638255:web:f23470bb681e9dac6eeb9a"
};

let currentUser = null;
let memos = [];
let userScore = 0;

try {
    firebase.initializeApp(firebaseConfig);
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            handleLoginSuccess({ displayName: user.displayName, uid: user.uid });
        } else {
            checkManualLogin();
        }
    });
} catch (error) {
    console.error("Firebase 連線失敗：", error);
    checkManualLogin();
}

function checkManualLogin() {
    const savedManualUser = sessionStorage.getItem('manualUser');
    if (savedManualUser) {
        handleLoginSuccess(JSON.parse(savedManualUser));
    } else {
        document.getElementById('login-screen').classList.remove('hidden');
    }
}

// ========================================================
// 2. 帳號與登入邏輯
// ========================================================
function loginWithGoogle() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().languageCode = 'zh-HK'; 
        firebase.auth().signInWithPopup(provider).catch((error) => alert("登入失敗: " + error.message));
    } catch (e) {
        alert("無法連線到 Google 伺服器，請先使用手動登入！");
    }
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
    try { firebase.auth().signOut(); } catch(e) {}
    sessionStorage.removeItem('manualUser');
    currentUser = null;
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
}

// ========================================================
// 2.5 手機版側邊欄開合邏輯
// ========================================================
function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('active');
}

function switchTab(tabId, event) {
    document.querySelectorAll('.module').forEach(mod => mod.classList.remove('active'));
    document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));
    
    const target = document.getElementById(tabId);
    if(target) target.classList.add('active');
    
    if(event) event.target.classList.add('active');
    
    // 如果是手機版，點擊後自動收起選單
    if(window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('active');
    }
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
// 4. 動態題庫引擎
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
            "A. 這次考試他的成績退步了很多，真是令人差強人意。",
            "B. 雖然這部電影的特效一般，但劇情還算差強人意。",
            "C. 他做事總是馬馬虎虎，表現實在是太差強人意了。",
            "D. 經過多次修改，這份報告依然差強人意，不被接納。"
        ],
        correctIndex: 1,
        explanation: "✅ 正確！【差強人意】指「大體上還能使人滿意」，是褒義/中性詞。常被誤解為「不能令人滿意」。"
    }
];

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
        explanation: "✅ 正確！濫用介詞導致主語缺失。用了「由於」又用「使到」，句子就沒有主角了。"
    },
    {
        question: "請找出並修正以下句子的語病：「為了防止類似的校園欺凌事件不再發生，學校加強了輔導工作。」",
        options: [
            "A. 搭配不當：「加強」不能配「輔導工作」。",
            "B. 邏輯矛盾：刪去「不」字，否則變成防止它「不發生」。",
            "C. 詞語冗贅：「類似的」與「事件」意思重複。",
            "D. 語序不當：「學校加強了」應放在句子的最開頭。"
        ],
        correctIndex: 1,
        explanation: "✅ 正確！否定詞誤用。「防止」加上「不再」，負負得正，變成了「鼓勵它發生」。"
    },
    {
        question: "請找出並修正以下句子的語病：「閱讀這本名著，大約需要兩星期左右的時間。」",
        options: [
            "A. 缺少主語：句首應加入「我」。",
            "B. 詞語冗贅：「大約」和「左右」語意重複，應刪其一。",
            "C. 搭配不當：「閱讀」不能配「時間」。",
            "D. 邏輯矛盾：「這本名著」不可能在兩星期內讀完。"
        ],
        correctIndex: 1,
        explanation: "✅ 正確！「大約」和「左右」都是表示估計，兩個一起用造成了語意重複（冗贅）。"
    },
    {
        question: "請找出並修正以下句子的語病：「經過教練的悉心指導，令我的游泳技術有了明顯的進步。」",
        options: [
            "A. 搭配不當：「明顯」不能形容「進步」。",
            "B. 詞性誤用：「指導」不能作名詞使用。",
            "C. 缺少主語：應刪除「經過」或「令」。",
            "D. 語意不明：「技術」一詞太過空泛。"
        ],
        correctIndex: 2,
        explanation: "✅ 正確！這與「由於...使到...」同理。句首用了「經過」，掩蓋了主語，後面又接「令」，導致沒有主語發出動作。"
    },
    {
        question: "請找出並修正以下句子的語病：「香港的空氣污染問題日益嚴重，情況實在令人堪憂。」",
        options: [
            "A. 詞語冗贅：「堪憂」已包含「令人擔憂」，應刪去「令人」。",
            "B. 邏輯矛盾：空氣污染「日益嚴重」不代表「堪憂」。",
            "C. 缺少賓語：應在句末加上「的地步」。",
            "D. 搭配不當：「情況」不能用「實在」來修飾。"
        ],
        correctIndex: 0,
        explanation: "✅ 正確！「堪憂」的意思就是「值得擔憂/令人擔憂」。加上「令人」，就造成了語意重疊。"
    }
];

function renderQuizzes() {
    renderQuizBlock('quiz-container-1', idiomsData);
    renderQuizBlock('quiz-container-2', grammarData);
}

function renderQuizBlock(containerId, dataArray) {
    const container = document.getElementById(containerId);
    if(!container) return; 
    
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

function checkAnswer(btn, isCorrect, explanation) {
    const parent = btn.parentElement;
    const feedback = parent.nextElementSibling;
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
