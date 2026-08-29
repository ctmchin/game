// ========================================================
// 1. FIREBASE 初始化與登入邏輯
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
}

function loginWithGoogle() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().languageCode = 'zh-HK'; 
        firebase.auth().signInWithPopup(provider).catch((e) => alert("登入失敗: " + e.message));
    } catch (e) { alert("無法連線，請使用手動登入！"); }
}

function loginManually() {
    const username = document.getElementById('username-input').value.trim();
    if (username !== "") {
        const userObj = { displayName: username, uid: username };
        sessionStorage.setItem('manualUser', JSON.stringify(userObj)); 
        handleLoginSuccess(userObj);
    } else { alert("請輸入學號！"); }
}

function handleLoginSuccess(user) {
    currentUser = user;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('user-display-name').innerText = user.displayName;
    document.getElementById('rank-my-name').innerText = user.displayName;
    
    // 讀取積分
    const savedScore = localStorage.getItem(`score_${user.uid}`);
    userScore = savedScore ? parseInt(savedScore) : 0;
    
    loadMemos(user.uid);
    updateScoreUI();
    renderQuizzes(); 
    renderSocial();
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
// 2. 積分與靈獸進化系統
// ========================================================
function addPoints(points) {
    userScore += points;
    localStorage.setItem(`score_${currentUser.uid}`, userScore);
    updateScoreUI();
}

function updateScoreUI() {
    document.getElementById('score').innerText = userScore;
    document.getElementById('rank-my-score').innerText = userScore;
    
    // 計算等級
    let petObj = { emoji: '🥚', name: '文字幼苗', lv: 1 };
    if(userScore >= 100) petObj = { emoji: '🐣', name: '修辭小獸', lv: 2 };
    if(userScore >= 300) petObj = { emoji: '🐥', name: '散文大師', lv: 3 };
    if(userScore >= 600) petObj = { emoji: '🦅', name: '語文飛龍', lv: 4 };
    
    const levelText = `${petObj.name} (Lv.${petObj.lv})`;
    
    // 更新側邊欄
    document.getElementById('pet-avatar').innerText = petObj.emoji;
    document.getElementById('pet-level').innerText = levelText;
    document.getElementById('rank-my-level').innerText = petObj.name;
    
    // 更新圖鑑模塊
    const bigPet = document.getElementById('big-pet-emoji');
    if(bigPet) {
        bigPet.innerText = petObj.emoji;
        document.getElementById('big-pet-name').innerText = levelText;
    }
}

// ========================================================
// 3. 螢光筆系統
// ========================================================
let pendingSelectedText = "";
const mobileBar = document.getElementById('mobile-highlight-bar');

document.addEventListener('selectionchange', function() {
    const selection = window.getSelection();
    const selectedStr = selection.toString().trim();
    if (selectedStr.length > 0 && isSelectionInsideArticle(selection)) {
        pendingSelectedText = selectedStr;
        let displayStr = selectedStr.length > 15 ? selectedStr.substring(0, 8) + " ... " + selectedStr.substring(selectedStr.length - 4) : selectedStr;
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
    if (memos.length === 0) { list.innerHTML = '<p style="color: #888; text-align: center;">暫無筆記</p>'; return; }
    list.innerHTML = memos.map(m => `<div class="memo-item"><p>${m.content}</p><div class="memo-time">${m.time}</div></div>`).join('');
}
function loadMemos(uid) {
    const saved = localStorage.getItem(`memos_${uid}`);
    memos = saved ? JSON.parse(saved) : [];
    updateMemoUI();
}

// ========================================================
// 4. 動態題庫引擎 (新增 2b 錯別字)
// ========================================================
const idiomsData = [{ question: "【炙手可熱】正確的用法是？", options: ["A. 外面炙手可熱。", "B. 手機炙手可熱。", "C. 門票炙手可熱。", "D. 丞相在朝廷中炙手可熱。"], correctIndex: 3, explanation: "比喻權勢大、氣焰盛，帶貶義。" }];
const grammarData = [{ question: "修正語病：「由於連日暴雨，使到低窪地區發生了嚴重水浸。」", options: ["A. 應刪去「由於」或「使到」。", "B. 「發生」不能配「水浸」。", "C. 「嚴重」和「水浸」重複。", "D. 「暴雨」不會導致「水浸」。"], correctIndex: 0, explanation: "濫用介詞導致主語缺失。" }];
const typoData = [{ question: "找出句子中的錯別字：「他為了這件鎖事，竟然和好朋友大動干戈。」", options: ["A. 鎖 -> 瑣", "B. 戈 -> 哥", "C. 竟 -> 競", "D. 朋 -> 朋 (無錯)"], correctIndex: 0, explanation: "「瑣事」才對，意思是細小零碎的事情。" }];
const memeData = [{ emoji: "🤦‍♂️", question: "朋友做事半途而廢，配哪句最適合？", options: ["A. 朽木不可雕也", "B. 燕雀安知鴻鵠之志", "C. 溫故而知新", "D. 己所不欲，勿施於人"], correctIndex: 0, explanation: "比喻人無可救藥。" }];
const ancientModernData = [{ question: "「其實味不同」。請問「其實」在古文中意思是什麼？", options: ["A. 實際上", "B. 它的果實", "C. 其中的道理", "D. 實在"], correctIndex: 1, explanation: "「其」是代詞（它的），「實」是名詞（果實）。" }];
const themeData = [{ question: "《微笑以對》。以下哪一個寫作立意最深刻？", options: ["A. 比賽失敗勉強微笑。", "B. 微笑能解決所有問題。", "C. 釋懷與豁達的面對人生無常。", "D. 對身邊的人微笑。"], correctIndex: 2, explanation: "C 將微笑昇華為人生態度，立意深刻！" }];
const materialData = [{ question: "《重遊舊地所見有感》，想表達「物是人非」。哪個素材最切合？", options: ["A. 設施翻新了，更好玩。", "B. 舊招牌拆除，老闆結業，人情味蕩然無存。", "C. 巧遇小學同學。", "D. 風景依然美麗。"], correctIndex: 1, explanation: "B 產生了強烈的落差感。" }];
const logicData = [{ question: "論點：「逆境能激發潛能」。論據：「司馬遷受宮刑作史記」。哪段論證最嚴密？", options: ["A. 將悲憤化為寫作動力，證明逆境激發潛能。", "B. 學習他在逆境中讀歷史。", "C. 沒受宮刑就不會寫史記。", "D. 逆境中也要保持心情愉快。"], correctIndex: 0, explanation: "A 精準解釋了因果關係。" }];

function renderQuizzes() {
    renderDailyQuiz('quiz-container-1', idiomsData, 'normal');
    renderDailyQuiz('quiz-container-2a', grammarData, 'normal');
    renderDailyQuiz('quiz-container-2b', typoData, 'normal');
    renderDailyQuiz('quiz-container-3', memeData, 'normal', true);
    renderDailyQuiz('quiz-container-6', ancientModernData, 'normal');
    renderDailyQuiz('quiz-container-16', themeData, 'suggested');
    renderDailyQuiz('quiz-container-17', materialData, 'suggested');
    renderDailyQuiz('quiz-container-18', logicData, 'suggested');
}

function renderDailyQuiz(containerId, dataArray, type = 'normal', isMeme = false) {
    const container = document.getElementById(containerId);
    if(!container) return; 
    const q = dataArray[0];
    const memeHtml = isMeme && q.emoji ? `<div style="font-size: 4rem; text-align: center; margin-bottom: 10px;">${q.emoji}</div>` : '';
    
    container.innerHTML = `
    <div class="card" style="margin-bottom: 20px;">
        ${memeHtml}
        <p class="question"><strong>📅 今日挑戰：</strong>${q.question}</p>
        <div class="options">
            ${q.options.map((opt, optIndex) => `
                <button class="btn-option" onclick="checkAnswer(this, ${optIndex}, ${q.correctIndex}, '${q.explanation}', '${type}')">${opt}</button>
            `).join('')}
        </div>
        <div class="feedback hidden" style="margin-top:15px;"></div>
    </div>`;
}

function checkAnswer(btn, clickedIndex, correctIndex, explanation, type) {
    const parent = btn.parentElement;
    const feedback = parent.nextElementSibling;
    const allButtons = parent.querySelectorAll('.btn-option');
    allButtons.forEach(b => b.disabled = true);
    feedback.classList.remove('hidden');
    const labelText = type === 'suggested' ? '💡 建議答案' : '✅ 正確答案';
    const correctLetter = String.fromCharCode(65 + correctIndex); 
    if (clickedIndex === correctIndex) {
        btn.style.backgroundColor = '#d4edda'; btn.style.borderColor = '#28a745';
        feedback.className = 'feedback success';
        feedback.innerHTML = `🎉 選擇極佳！<br><br>💡 解析：${explanation}<br><br>🌟 獲得 20 積分！`;
        addPoints(20);
    } else {
        btn.style.backgroundColor = '#f8d7da'; btn.style.borderColor = '#dc3545';
        allButtons[correctIndex].style.backgroundColor = '#d4edda'; allButtons[correctIndex].style.borderColor = '#28a745'; allButtons[correctIndex].style.borderWidth = '2px';
        feedback.className = 'feedback error';
        feedback.innerHTML = `❌ 稍嫌遜色！${labelText}是 <strong>${correctLetter}</strong>。<br><br>💡 解析：${explanation}`;
    }
}

// ========================================================
// 5. 社群留言與新模塊功能 (11, 13)
// ========================================================

// 預設假資料 (改為 CTM 示例)
let socialData = {
    8: [ { name: "CTM 示例", text: "我最不能忘記的是他的背影。這句平淡卻充滿後勁。", likes: 12 } ],
    9: [ { name: "CTM 示例", text: "調皮的微風在樹梢間穿梭，惹得樹葉們咯咯嬌笑。", likes: 8 } ],
    10: [ { name: "系統", text: "我們在學校後山發現了一個生鏽的寶箱，寶箱上面刻著一個奇怪的圖騰..." } ]
};

function renderSocial() {
    ['8', '9', '10'].forEach(id => {
        const wall = document.getElementById('wall-' + id);
        if(!wall) return;
        wall.innerHTML = socialData[id].map((item, index) => `
            <div class="memo-item" style="border-left-color: #4facfe; margin-bottom: 10px;">
                <p style="font-size:1.15rem; margin-bottom:8px;">${item.text}</p>
                <div style="display:flex; justify-content:space-between; color:#888; font-size:0.9rem;">
                    <span>✍️ ${item.name}</span>
                    ${id !== '10' ? `<span style="cursor:pointer;" onclick="likePost(${id}, ${index})">❤️ ${item.likes}</span>` : ''}
                </div>
            </div>
        `).join('');
    });
}

function submitSocial(id) {
    if(!currentUser) return; 
    const input = document.getElementById('input-' + id);
    const text = input.value.trim();
    if(text === "") return alert("請輸入內容喔！"); 
    
    if(id === 10) socialData[id].push({ name: currentUser.displayName, text: text });
    else socialData[id].unshift({ name: currentUser.displayName, text: text, likes: 0 });
    
    input.value = "";
    renderSocial();
    
    const points = (id === 8) ? 10 : (id === 9 ? 15 : 20);
    addPoints(points);
    alert(`🎉 發佈成功！獲得 ${points} 積分！`);
}

function likePost(id, index) { socialData[id][index].likes++; renderSocial(); }

// 模塊 11：AI 生成器
function generateAI() {
    const input = document.getElementById('ai-input').value.trim();
    if(!input) return alert("請先輸入文字描寫！");
    const res = document.getElementById('ai-result');
    res.classList.remove('hidden');
    res.className = 'feedback info';
    res.innerHTML = "⏳ 魔法施展中，請稍候...";
    
    setTimeout(() => {
        res.className = 'feedback success';
        res.innerHTML = `🎨 生成成功！<br><br><div style="font-size:6rem; margin:15px 0;">🤖</div><p style="font-weight:normal;">(未來接通 API 後，這裡將顯示真實的 AI 圖片)</p>`;
        addPoints(30);
    }, 2000);
}

// 模塊 13：抽卡盲盒
function drawGacha() {
    if(userScore < 50) return alert("積分不足 50 分！快去解題賺積分吧。");
    addPoints(-50); // 扣 50 分
    
    const res = document.getElementById('gacha-result');
    res.classList.remove('hidden');
    res.className = 'feedback info';
    res.innerHTML = "🎲 抽卡中...";
    
    setTimeout(() => {
        const r = Math.random();
        let card = r > 0.9 ? "【UR 傳說】免做一次功課金牌" : (r > 0.6 ? "【SR 稀有】遲交豁免權" : "【N 普通】詞彙卡：躊躇");
        res.className = 'feedback success';
        res.innerHTML = `🎉 恭喜抽中：<br><br><span style="font-size:1.5rem; color:#d32f2f;">${card}</span>`;
    }, 1000);
}
