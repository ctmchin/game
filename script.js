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
let db = null; 

try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore(); 
    
    firebase.auth().onAuthStateChanged((user) => {
        if (user) { 
            const role = (user.email === 'ctmlwsss@gmail.com') ? 'teacher' : 'student';
            handleLoginSuccess({ displayName: user.displayName, uid: user.uid, role: role }); 
        } 
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
        const role = (username === 'admin') ? 'teacher' : 'student';
        const nameDisplay = (role === 'teacher') ? "CTM 老師 (管理員)" : username;
        const userObj = { displayName: nameDisplay, uid: username, role: role }; 
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
    
    if (user.role === 'teacher') {
        const adminMenu = document.getElementById('admin-menu');
        if(adminMenu) adminMenu.classList.remove('hidden');
    }

    const savedScore = localStorage.getItem(`score_${user.uid}`);
    userScore = savedScore ? parseInt(savedScore) : 0;
    
    loadMemos(user.uid);
    updateScoreUI();
    renderQuizzes(); 
    initMatchGame();
    initBossGame();
    
    // 🌟 登入後，立刻從雲端讀取留言牆資料！
    loadSocialDataFromCloud(); 
}

function logout() {
    try { firebase.auth().signOut(); } catch(e) {}
    sessionStorage.removeItem('manualUser');
    currentUser = null;
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
}

function toggleSidebar() { document.querySelector('.sidebar').classList.toggle('open'); document.getElementById('sidebar-overlay').classList.toggle('active'); }
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

function addPoints(points) { userScore += points; localStorage.setItem(`score_${currentUser.uid}`, userScore); updateScoreUI(); }
function updateScoreUI() { document.getElementById('score').innerText = userScore; document.getElementById('rank-my-score').innerText = userScore; let petObj = { emoji: '🥚', name: '文字幼苗', lv: 1 }; if(userScore >= 100) petObj = { emoji: '🐣', name: '修辭小獸', lv: 2 }; if(userScore >= 300) petObj = { emoji: '🐥', name: '散文大師', lv: 3 }; if(userScore >= 600) petObj = { emoji: '🦅', name: '語文飛龍', lv: 4 }; const levelText = `${petObj.name} (Lv.${petObj.lv})`; document.getElementById('pet-avatar').innerText = petObj.emoji; document.getElementById('pet-level').innerText = levelText; document.getElementById('rank-my-level').innerText = petObj.name; const bigPet = document.getElementById('big-pet-emoji'); if(bigPet) { bigPet.innerText = petObj.emoji; document.getElementById('big-pet-name').innerText = levelText; } }

// 螢光筆系統
let pendingSelectedText = ""; const mobileBar = document.getElementById('mobile-highlight-bar');
document.addEventListener('selectionchange', function() { const selection = window.getSelection(); const selectedStr = selection.toString().trim(); if (selectedStr.length > 0 && isSelectionInsideArticle(selection)) { pendingSelectedText = selectedStr; let displayStr = selectedStr.length > 15 ? selectedStr.substring(0, 8) + " ... " + selectedStr.substring(selectedStr.length - 4) : selectedStr; document.getElementById('highlight-text-preview').innerText = displayStr; mobileBar.classList.remove('hidden'); } else { mobileBar.classList.add('hidden'); } });
function isSelectionInsideArticle(selection) { if (selection.rangeCount === 0) return false; const container = selection.getRangeAt(0).commonAncestorContainer; const articleCard = document.getElementById('article-content'); return articleCard && articleCard.contains(container.nodeType === 3 ? container.parentNode : container); }
function confirmSaveHighlight() { if (pendingSelectedText.length > 0) { const now = new Date(); memos.unshift({ content: pendingSelectedText, time: now.toLocaleDateString() + " " + now.toLocaleTimeString() }); updateMemoUI(); localStorage.setItem(`memos_${currentUser.uid}`, JSON.stringify(memos)); alert("🖍️ 重點已成功收藏！"); window.getSelection().removeAllRanges(); mobileBar.classList.add('hidden'); } }
function closeHighlightBar() { mobileBar.classList.add('hidden'); pendingSelectedText = ""; }
function updateMemoUI() { const list = document.getElementById('memo-list'); if (memos.length === 0) { list.innerHTML = '<p style="color: #888; text-align: center;">暫無筆記</p>'; return; } list.innerHTML = memos.map(m => `<div class="memo-item"><p>${m.content}</p><div class="memo-time">${m.time}</div></div>`).join(''); }
function loadMemos(uid) { const saved = localStorage.getItem(`memos_${uid}`); memos = saved ? JSON.parse(saved) : []; updateMemoUI(); }

// 題庫與遊戲引擎
const idiomsData = [{ question: "【炙手可熱】正確的用法是？", options: ["A. 外面炙手可熱。", "B. 手機炙手可熱。", "C. 門票炙手可熱。", "D. 丞相在朝廷中炙手可熱。"], correctIndex: 3, explanation: "比喻權勢大、氣焰盛，帶貶義。" }];
const grammarData = [{ question: "修正語病：「由於連日暴雨，使到低窪地區發生了嚴重水浸。」", options: ["A. 應刪去「由於」或「使到」。", "B. 「發生」不能配「水浸」。", "C. 「嚴重」和「水浸」重複。", "D. 「暴雨」不會導致「水浸」。"], correctIndex: 0, explanation: "濫用介詞導致主語缺失。" }];
const typoData = [{ question: "找出句子中的錯別字：「他為了這件鎖事，竟然大動干戈。」", options: ["A. 鎖 -> 瑣", "B. 戈 -> 哥", "C. 竟 -> 競", "D. 朋 -> 朋 (無錯)"], correctIndex: 0, explanation: "「瑣事」才對，意思是細小零碎的事情。" }];
const memeData = [{ emoji: "🤦‍♂️", question: "朋友做事半途而廢，配哪句最適合？", options: ["A. 朽木不可雕也", "B. 燕雀安知鴻鵠之志", "C. 溫故而知新", "D. 己所不欲，勿施於人"], correctIndex: 0, explanation: "比喻人無可救藥。" }];
const ancientModernData = [{ question: "「其實味不同」。請問「其實」在古文中意思是什麼？", options: ["A. 實際上", "B. 它的果實", "C. 其中的道理", "D. 實在"], correctIndex: 1, explanation: "「其」是代詞（它的），「實」是名詞（果實）。" }];
const themeData = [{ question: "《微笑以對》。以下哪一個寫作立意最深刻？", options: ["A. 比賽失敗勉強微笑。", "B. 微笑能解決所有問題。", "C. 釋懷與豁達的面對人生無常。", "D. 對身邊的人微笑。"], correctIndex: 2, explanation: "C 將微笑昇華為人生態度，立意深刻！" }];
const materialData = [{ question: "《重遊舊地所見有感》，想表達「物是人非」。哪個素材最切合？", options: ["A. 設施翻新了，更好玩。", "B. 舊招牌拆除，老闆結業，人情味蕩然無存。", "C. 巧遇小學同學。", "D. 風景依然美麗。"], correctIndex: 1, explanation: "B 產生了強烈的落差感。" }];
const logicData = [{ question: "論點：「逆境能激發潛能」。論據：「司馬遷受宮刑作史記」。哪段論證最嚴密？", options: ["A. 將悲憤化為寫作動力，證明逆境激發潛能。", "B. 學習他在逆境中讀歷史。", "C. 沒受宮刑就不會寫史記。", "D. 逆境中也要保持心情愉快。"], correctIndex: 0, explanation: "A 精準解釋了因果關係。" }];

function renderQuizzes() { renderDailyQuiz('quiz-container-1', idiomsData, 'normal'); renderDailyQuiz('quiz-container-2a', grammarData, 'normal'); renderDailyQuiz('quiz-container-2b', typoData, 'normal'); renderDailyQuiz('quiz-container-3', memeData, 'normal', true); renderDailyQuiz('quiz-container-6', ancientModernData, 'normal'); renderDailyQuiz('quiz-container-16', themeData, 'suggested'); renderDailyQuiz('quiz-container-17', materialData, 'suggested'); renderDailyQuiz('quiz-container-18', logicData, 'suggested'); }
function renderDailyQuiz(containerId, dataArray, type = 'normal', isMeme = false) { const container = document.getElementById(containerId); if(!container) return; const q = dataArray[0]; const memeHtml = isMeme && q.emoji ? `<div style="font-size: 4rem; text-align: center; margin-bottom: 10px;">${q.emoji}</div>` : ''; container.innerHTML = `<div class="card" style="margin-bottom: 20px;">${memeHtml}<p class="question"><strong>📅 今日挑戰：</strong>${q.question}</p><div class="options">${q.options.map((opt, i) => `<button class="btn-option" onclick="checkStaticAnswer(this, ${i}, ${q.correctIndex}, '${q.explanation}', '${type}')">${opt}</button>`).join('')}</div><div class="feedback hidden" style="margin-top:15px;"></div></div>`; }
function checkStaticAnswer(btn, clickedIndex, correctIndex, explanation, type) { const parent = btn.parentElement; const feedback = parent.nextElementSibling; const allButtons = parent.querySelectorAll('.btn-option'); allButtons.forEach(b => b.disabled = true); feedback.classList.remove('hidden'); const labelText = type === 'suggested' ? '💡 建議答案' : '✅ 正確答案'; if (clickedIndex === correctIndex) { btn.style.backgroundColor = '#d4edda'; btn.style.borderColor = '#28a745'; feedback.className = 'feedback success'; feedback.innerHTML = `🎉 選擇極佳！<br><br>💡 解析：${explanation}<br><br>🌟 獲得 20 積分！`; addPoints(20); } else { btn.style.backgroundColor = '#f8d7da'; btn.style.borderColor = '#dc3545'; allButtons[correctIndex].style.backgroundColor = '#d4edda'; allButtons[correctIndex].style.borderColor = '#28a745'; allButtons[correctIndex].style.borderWidth = '2px'; feedback.className = 'feedback error'; feedback.innerHTML = `❌ 稍嫌遜色！${labelText}是 <strong>${String.fromCharCode(65 + correctIndex)}</strong>。<br><br>💡 解析：${explanation}`; } }

const matchPairs = [ { ancient: "走", modern: "跑" }, { ancient: "妻子", modern: "妻子與兒女" }, { ancient: "去", modern: "離開" }, { ancient: "股", modern: "大腿" } ]; let selectedAncient = null; let matchedCount = 0;
function initMatchGame() { const leftContainer = document.getElementById('match-left'); const rightContainer = document.getElementById('match-right'); if(!leftContainer) return; let ancients = [...matchPairs].sort(() => Math.random() - 0.5); let moderns = [...matchPairs].sort(() => Math.random() - 0.5); leftContainer.innerHTML = ancients.map((p, i) => `<button class="btn-option" id="ancient-${i}" onclick="selectAncient(${i}, '${p.ancient}')">${p.ancient}</button>`).join(''); rightContainer.innerHTML = moderns.map((p, i) => `<button class="btn-option" id="modern-${i}" onclick="selectModern(${i}, '${p.modern}')">${p.modern}</button>`).join(''); }
function selectAncient(index, text) { document.querySelectorAll('#match-left .btn-option').forEach(b => b.style.borderColor = '#e0e0e0'); const btn = document.getElementById(`ancient-${index}`); if(!btn.disabled) { btn.style.borderColor = '#1976d2'; selectedAncient = { index, text, btn }; } }
function selectModern(index, text) { if(!selectedAncient) return alert("請先點擊左側的文言字詞！"); const rightBtn = document.getElementById(`modern-${index}`); const correctPair = matchPairs.find(p => p.ancient === selectedAncient.text); if(correctPair.modern === text) { selectedAncient.btn.style.backgroundColor = '#d4edda'; selectedAncient.btn.disabled = true; rightBtn.style.backgroundColor = '#d4edda'; rightBtn.disabled = true; selectedAncient = null; matchedCount++; if(matchedCount === matchPairs.length) { const fb = document.getElementById('match-feedback'); fb.classList.remove('hidden'); fb.className = 'feedback success'; fb.innerHTML = "🎉 全部配對成功！獲得 30 積分！"; addPoints(30); } } else { rightBtn.style.backgroundColor = '#f8d7da'; setTimeout(() => { rightBtn.style.backgroundColor = 'white'; }, 800); } }

const bossQuestions = [ { q: "「輟耕<strong style='color:#d32f2f;'>之</strong>壟上」", options: ["A. 的 (助詞)", "B. 去、往 (動詞)", "C. 他 (代詞)"], correct: 1 }, { q: "「物外<strong style='color:#d32f2f;'>之</strong>趣」", options: ["A. 的 (助詞)", "B. 去、往 (動詞)", "C. 他 (代詞)"], correct: 0 }, { q: "「名<strong style='color:#d32f2f;'>之</strong>者誰」", options: ["A. 的 (助詞)", "B. 去、往 (動詞)", "C. 他 (代詞)"], correct: 2 } ]; let currentBossHp = 3; let currentBossQ = 0;
function initBossGame() { if(!document.getElementById('boss-question')) return; if(currentBossQ < bossQuestions.length) { const q = bossQuestions[currentBossQ]; document.getElementById('boss-question').innerHTML = q.q; document.getElementById('boss-options').innerHTML = q.options.map((opt, i) => `<button class="btn-option" onclick="attackBoss(${i}, ${q.correct})">${opt}</button>`).join(''); } }
function attackBoss(clicked, correct) { if(clicked === correct) { currentBossHp--; document.getElementById('boss-hp').style.width = (currentBossHp / 3 * 100) + "%"; currentBossQ++; if(currentBossHp === 0) { document.getElementById('boss-emoji').innerText = "💥"; document.getElementById('boss-question').innerText = "Boss 已被擊敗！"; document.getElementById('boss-options').innerHTML = ""; const fb = document.getElementById('boss-feedback'); fb.classList.remove('hidden'); fb.className = 'feedback success'; fb.innerHTML = "🎉 成功擊敗怪獸！獲得 50 積分！"; addPoints(50); } else { alert("💥 攻擊成功！怪獸扣血！進入下一題。"); initBossGame(); } } else { alert("❌ 攻擊無效！這句的「之」不是這個意思喔！"); } }

const readingQuestions = { 1: { level: "🌱 基礎 (字譯)", q: "「徐以杓酌油瀝之」中的「徐」意思是？", opts: ["A. 慢慢地", "B. 快速地", "C. 姓氏"], correct: 0, exp: "「徐」字在古文中常解作「緩慢地」。" }, 2: { level: "🌲 進階 (選擇)", q: "賣油翁為什麼要把錢幣放在葫蘆口？", opts: ["A. 為了炫耀", "B. 作為倒油的標靶，展示技術", "C. 洗錢"], correct: 1, exp: "他以此證明「無他，但手熟爾」。" }, 3: { level: "🔥 挑戰 (DSE)", q: "【正確/錯誤/無從判斷】賣油翁非常崇拜陳堯咨的射箭技術。", opts: ["A. 正確", "B. 錯誤", "C. 無從判斷"], correct: 1, exp: "錯誤。賣油翁看陳堯咨射箭只是微微點頭，並不崇拜。" } };
function loadReadingQuiz(level) { const container = document.getElementById('reading-quiz-container'); const q = readingQuestions[level]; container.innerHTML = `<div style="background: #fff; padding: 20px; border-radius: 8px; border: 2px solid #1976d2;"><p style="color: #1976d2; font-weight: bold; margin-bottom: 10px;">${q.level} 挑戰</p><p class="question" style="font-size: 1.1rem; margin-bottom: 15px;">${q.q}</p><div class="options">${q.opts.map((opt, i) => `<button class="btn-option" style="padding: 10px;" onclick="checkReadingAnswer(this, ${i}, ${q.correct}, '${q.exp}')">${opt}</button>`).join('')}</div><div class="reading-feedback hidden" style="margin-top:15px; font-weight:bold;"></div></div>`; }
function checkReadingAnswer(btn, clicked, correct, exp) { const parent = btn.parentElement; const feedback = parent.nextElementSibling; parent.querySelectorAll('.btn-option').forEach(b => b.disabled = true); feedback.classList.remove('hidden'); if(clicked === correct) { btn.style.backgroundColor = '#d4edda'; btn.style.borderColor = '#28a745'; feedback.style.color = '#155724'; feedback.innerHTML = `🎉 答對了！<br>💡 解析：${exp} (+15分)`; addPoints(15); } else { btn.style.backgroundColor = '#f8d7da'; btn.style.borderColor = '#dc3545'; feedback.style.color = '#721c24'; feedback.innerHTML = `❌ 答錯了！<br>💡 解析：${exp}`; } }

// ========================================================
// 🌟 6. 真・雲端留言系統 (Firestore) 🌟
// ========================================================
let socialData = { 8: [], 9: [], 10: [] };

const defaultData = {
    8: [ { name: "CTM 系統示例", text: "我最不能忘記的是他的背影。這句平淡卻充滿後勁。", likes: 12, teacherLiked: false } ],
    9: [ { name: "CTM 系統示例", text: "調皮的微風在樹梢間穿梭，惹得樹葉們咯咯嬌笑。", likes: 8, teacherLiked: false } ],
    10: [ { name: "系統", text: "我們在學校後山發現了一個生鏽的寶箱，上面刻著奇怪的圖騰..." } ]
};

function loadSocialDataFromCloud() {
    if(!db) { console.log("No DB, loading default"); renderSocialWithDefault(); return; }

    ['8', '9', '10'].forEach(id => {
        db.collection('wall_' + id).orderBy('timestamp', id === '10' ? 'asc' : 'desc').onSnapshot((snapshot) => {
            socialData[id] = [];
            snapshot.forEach(doc => {
                let data = doc.data();
                data.docId = doc.id; 
                socialData[id].push(data);
            });
            renderSocial(); 
        }, (error) => {
            console.warn("雲端讀取失敗，使用預設資料", error);
            renderSocialWithDefault();
        });
    });
}

function renderSocialWithDefault() {
    ['8', '9', '10'].forEach(id => { if(socialData[id].length === 0) socialData[id] = defaultData[id]; });
    renderSocial();
}

function renderSocial() {
    ['8', '9', '10'].forEach(id => {
        const wall = document.getElementById('wall-' + id);
        if(!wall) return;
        
        wall.innerHTML = socialData[id].map((item, index) => {
            const teacherBadge = item.teacherLiked ? `<span style="background:#ffecb3; color:#d84315; padding:2px 6px; border-radius:12px; font-size:0.8rem; margin-left:10px; font-weight:bold;">👨‍🏫 老師讚好</span>` : '';
            return `
            <div class="memo-item" style="border-left-color: #4facfe; margin-bottom: 10px;">
                <p style="font-size:1.15rem; margin-bottom:8px;">${item.text} ${teacherBadge}</p>
                <div style="display:flex; justify-content:space-between; color:#888; font-size:0.9rem;">
                    <span>✍️ ${item.name}</span>
                    ${id !== '10' ? `<span style="cursor:pointer;" onclick="likePost('${id}', '${item.docId}', ${item.likes || 0})">❤️ ${item.likes || 0}</span>` : ''}
                </div>
            </div>`;
        }).join('');
    });
}

function submitSocial(id) {
    if(!currentUser) return alert("請先登入！"); 
    const input = document.getElementById('input-' + id);
    const text = input.value.trim();
    if(text === "") return alert("請輸入內容喔！"); 
    
    const displayName = currentUser.role === 'teacher' ? `👑 ${currentUser.displayName}` : currentUser.displayName;
    const newPost = { name: displayName, text: text, likes: 0, teacherLiked: false, timestamp: firebase.firestore.FieldValue.serverTimestamp() };
    
    if(db) {
        db.collection('wall_' + id).add(newPost).then(() => {
            input.value = ""; 
            const points = (id === 8) ? 10 : (id === 9 ? 15 : 20);
            addPoints(points); 
            alert(`🎉 成功發佈到全校雲端牆！獲得 ${points} 積分！`);
        }).catch(err => alert("發佈失敗：" + err.message));
    } else {
        alert("資料庫尚未連接，無法發佈！");
    }
}

function likePost(id, docId, currentLikes) { 
    if(!currentUser) return alert("請先登入！");
    if(!db || !docId) return alert("預設範例無法點讚！請自己發佈一句話試試看！");

    const postRef = db.collection('wall_' + id).doc(docId);
    
    if(currentUser.role === 'teacher') {
        postRef.update({ teacherLiked: true }).then(() => alert("👨‍🏫 已為該學生送出「老師讚好」！"));
    } else {
        postRef.update({ likes: currentLikes + 1 });
    }
}

function generateAI() { const input = document.getElementById('ai-input').value.trim(); if(!input) return alert("請輸入文字！"); const res = document.getElementById('ai-result'); res.classList.remove('hidden'); res.className = 'feedback info'; res.innerHTML = "⏳ 魔法施展中..."; setTimeout(() => { res.className = 'feedback success'; res.innerHTML = `🎨 生成成功！<br><br><div style="font-size:6rem; margin:15px 0;">🤖</div><p style="font-weight:normal;">(未來接通 API 後顯示真實圖片)</p>`; addPoints(30); }, 2000); }
function drawGacha() { if(userScore < 50) return alert("積分不足 50 分！"); addPoints(-50); const res = document.getElementById('gacha-result'); res.classList.remove('hidden'); res.className = 'feedback info'; res.innerHTML = "🎲 抽卡中..."; setTimeout(() => { const r = Math.random(); let card = r > 0.9 ? "【UR 傳說】免做一次功課金牌" : (r > 0.6 ? "【SR 稀有】遲交豁免權" : "【N 普通】詞彙卡：躊躇"); res.className = 'feedback success'; res.innerHTML = `🎉 恭喜抽中：<br><br><span style="font-size:1.5rem; color:#d32f2f;">${card}</span>`; }, 1000); }
