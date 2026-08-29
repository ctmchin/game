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
        if (user) { handleLoginSuccess({ displayName: user.displayName, uid: user.uid }); } 
        else { checkManualLogin(); }
    });
} catch (error) { checkManualLogin(); }

function checkManualLogin() {
    const savedManualUser = sessionStorage.getItem('manualUser');
    if (savedManualUser) { handleLoginSuccess(JSON.parse(savedManualUser)); } 
    else { document.getElementById('login-screen').classList.remove('hidden'); }
}

// ========================================================
// 2. 帳號與登入邏輯
// ========================================================
function loginWithGoogle() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().languageCode = 'zh-HK'; 
        firebase.auth().signInWithPopup(provider).catch((e) => alert("登入失敗: " + e.message));
    } catch (e) { alert("無法連線，請先使用手動登入！"); }
}

function loginManually() {
    const username = document.getElementById('username-input').value.trim();
    if (username !== "") {
        const userObj = { displayName: username + " (手動)", uid: username };
        sessionStorage.setItem('manualUser', JSON.stringify(userObj)); 
        handleLoginSuccess(userObj);
    } else { alert("請輸入學號！"); }
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

function closeHighlightBar() { mobileBar.classList.add('hidden'); pendingSelectedText = ""; }

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
// 4. 動態題庫引擎 (為防斷裂，先各保留 1 題測試)
// ========================================================
const idiomsData = [{ question: "【炙手可熱】請判斷以下哪一個句子正確使用了此成語？", options: ["A. 夏天炎熱，外面炙手可熱。", "B. 手機設計新穎，炙手可熱。", "C. 演唱會門票炙手可熱。", "D. 丞相在朝廷中炙手可熱，百官爭相討好。"], correctIndex: 3, explanation: "【炙手可熱】比喻權勢大、氣焰盛，帶貶義。" }];
const grammarData = [{ question: "請找出並修正語病：「由於連日暴雨，使到低窪地區發生了嚴重水浸。」", options: ["A. 應刪去「由於」或「使到」。", "B. 「發生」不能配「水浸」。", "C. 「嚴重」和「水浸」重複。", "D. 「暴雨」不會導致「水浸」。"], correctIndex: 0, explanation: "濫用介詞導致主語缺失。" }];
const themeData = [{ question: "DSE 題目《微笑以對》。以下哪一個寫作立意最深刻？", options: ["A. 比賽失敗勉強擠出微笑。", "B. 只要微笑，問題自動解決。", "C. 經歷挫折後釋懷，以豁達的微笑面對人生。", "D. 別人對我微笑，我也對人微笑。"], correctIndex: 2, explanation: "C 將微笑昇華為「豁達的人生態度」，立意深刻！" }];
const materialData = [{ question: "題目《重遊舊地所見有感》，想表達「物是人非」。哪個素材最切合？", options: ["A. 遊樂設施翻新了，更好玩。", "B. 風景美麗，想起了小時候。", "C. 巧遇小學同學，開心地敘舊。", "D. 舊招牌已拆，老闆換人，人情味蕩然無存。"], correctIndex: 3, explanation: "D 產生了強烈的落差感，緊扣物是人非。" }];
const logicData = [{ question: "論點：「逆境能激發潛能」。論據：「司馬遷受宮刑作史記」。哪段論證最嚴密？", options: ["A. 他將悲憤化為寫作動力，證明逆境能激發潛能。", "B. 我們應該學習他在逆境中讀歷史。", "C. 沒受宮刑就不會寫史記，人人都需經歷宮刑。", "D. 即使在逆境中也要保持心情愉快。"], correctIndex: 0, explanation: "A 精準解釋了「逆境」如何轉化為「動力」。" }];
const memeData = [{ emoji: "🤦‍♂️", question: "朋友做事半途而廢，你想發這個「無奈扶額」的表情，配哪句文言文最適合？", options: ["A. 朽木不可雕也", "B. 燕雀安知鴻鵠之志", "C. 溫故而知新", "D. 己所不欲，勿施於人"], correctIndex: 0, explanation: "【朽木不可雕也】比喻人無可救藥，配無奈扶額的表情最神似！" }];
const ancientModernData = [{ question: "「其實味不同」。請問「其實」在古文中的意思是什麼？", options: ["A. 實際上 (與現代同義)", "B. 它的果實", "C. 其中的道理", "D. 實在、確切"], correctIndex: 1, explanation: "「其」是代詞（它的），「實」是名詞（果實）。這就是古今異義！" }];

function renderQuizzes() {
    renderDailyQuiz('quiz-container-1', idiomsData);
    renderDailyQuiz('quiz-container-2', grammarData);
    renderDailyQuiz('quiz-container-3', memeData, true);
    renderDailyQuiz('quiz-container-6', ancientModernData);
    renderDailyQuiz('quiz-container-16', themeData);
    renderDailyQuiz('quiz-container-17', materialData);
    renderDailyQuiz('quiz-container-18', logicData);
}

function renderDailyQuiz(containerId, dataArray, isMeme = false) {
    const container = document.getElementById(containerId);
    if(!container) return; 
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const q = dataArray[dayOfYear % dataArray.length];
    
    const memeHtml = isMeme && q.emoji ? `<div style="font-size: 4rem; text-align: center; margin-bottom: 10px;">${q.emoji}</div>` : '';
    
    container.innerHTML = `
    <div class="card" style="margin-bottom: 20px;">
        ${memeHtml}
        <p class="question"><strong>📅 今日挑戰：</strong>${q.question}</p>
        <div class="options">
            ${q.options.map((opt, optIndex) => `
                <button class="btn-option" onclick="checkAnswer(this, ${optIndex}, ${q.correctIndex}, '${q.explanation}')">${opt}</button>
            `).join('')}
        </div>
        <div class="feedback hidden" style="margin-top:15px;"></div>
    </div>`;
}

function checkAnswer(btn, clickedIndex, correctIndex, explanation) {
    const parent = btn.parentElement;
    const feedback = parent.nextElementSibling;
    const allButtons = parent.querySelectorAll('.btn-option');
    
    allButtons.forEach(b => b.disabled = true);
    feedback.classList.remove('hidden');
    
    if (clickedIndex === correctIndex) {
        btn.style.backgroundColor = '#d4edda'; btn.style.borderColor = '#28a745';
        feedback.className = 'feedback success';
        feedback.innerHTML = `🎉 答對了！<br><br>💡 解析：${explanation}<br><br>🌟 獲得 20 積分！`;
        userScore += 20; document.getElementById('score').innerText = userScore;
    } else {
        btn.style.backgroundColor = '#f8d7da'; btn.style.borderColor = '#dc3545';
        allButtons[correctIndex].style.backgroundColor = '#d4edda';
        allButtons[correctIndex].style.borderColor = '#28a745'; allButtons[correctIndex].style.borderWidth = '2px';
        feedback.className = 'feedback error';
        feedback.innerHTML = `❌ 答錯了！正確答案是 <strong>${String.fromCharCode(65 + correctIndex)}</strong>。<br><br>💡 解析：${explanation}`;
    }
}
