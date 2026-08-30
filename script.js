// ========================================================
// 1. FIREBASE 初始化與登入
// ========================================================
const firebaseConfig = { apiKey: "AIzaSyBXTjkrXmiLhp64MSBU1Ai5Iiv1EJfwA3I", authDomain: "ctm-game.firebaseapp.com", projectId: "ctm-game", storageBucket: "ctm-game.firebasestorage.app", messagingSenderId: "204941638255", appId: "1:204941638255:web:f23470bb681e9dac6eeb9a" };
let currentUser = null; let memos = []; let userScore = 0; let userCoins = 0; let weeklyScore = 0; let db = null;
let userEmojis = []; let equippedEmoji = ""; let userItems = []; 

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}

try {
    firebase.initializeApp(firebaseConfig); db = firebase.firestore(); 
    firebase.auth().onAuthStateChanged((user) => {
        if (user) { const role = (user.email === 'ctmlwsss@gmail.com') ? 'teacher' : 'student'; handleLoginSuccess({ displayName: user.displayName, email: user.email, uid: user.uid, role: role }); } 
        else { checkManualLogin(); }
    });
} catch (error) { checkManualLogin(); }

function checkManualLogin() { const saved = sessionStorage.getItem('manualUser'); if (saved) { handleLoginSuccess(JSON.parse(saved)); } }
function loginWithGoogle() { try { const provider = new firebase.auth.GoogleAuthProvider(); firebase.auth().languageCode = 'zh-HK'; firebase.auth().signInWithPopup(provider).catch((e) => alert("登入失敗")); } catch (e) { alert("請使用手動登入！"); } }
function loginManually() {
    const username = document.getElementById('username-input').value.trim();
    if (username !== "") {
        const role = (username === 'admin') ? 'teacher' : 'student';
        const nameDisplay = (role === 'teacher') ? "CTM 老師" : username;
        const userObj = { displayName: nameDisplay, email: username+"@local", uid: username, role: role }; 
        sessionStorage.setItem('manualUser', JSON.stringify(userObj)); handleLoginSuccess(userObj);
    } else { alert("請輸入學號！"); }
}

function handleLoginSuccess(user) {
    currentUser = user;
    document.getElementById('login-screen').classList.add('hidden'); document.getElementById('dashboard').classList.remove('hidden');
    if (user.role === 'teacher') { const adminMenu = document.getElementById('admin-menu'); if(adminMenu) adminMenu.classList.remove('hidden'); loadAdminDashboard(); }
    
    if(db) {
        const currentWeek = getWeekNumber(new Date());
        const userRef = db.collection('users').doc(user.uid);
        userRef.get().then((doc) => {
            if (doc.exists) {
                let data = doc.data();
                userScore = data.score || 0; userCoins = data.coins || 0; weeklyScore = data.weeklyScore || 0;
                userEmojis = data.emojis || []; equippedEmoji = data.equippedEmoji || ""; userItems = data.items || [];
                
                // 每週日結算邏輯
                if(data.lastWeek !== currentWeek) { weeklyScore = 0; userRef.update({ weeklyScore: 0, lastWeek: currentWeek }); }
                
                // 老師無敵模式 (不存入資料庫，只在本地生效)
                if(user.role === 'teacher') { userScore = 99999; userCoins = 99999; }
                else { userRef.update({ lastLogin: new Date().toLocaleString() }); }
            } else {
                userScore = user.role === 'teacher' ? 99999 : 0; userCoins = user.role === 'teacher' ? 99999 : 0; weeklyScore = 0;
                if(user.role !== 'teacher') {
                    userRef.set({ name: user.displayName, email: user.email, score: 0, coins: 0, weeklyScore: 0, lastWeek: currentWeek, emojis: [], equippedEmoji: "", items: [], role: user.role, lastLogin: new Date().toLocaleString() });
                }
            }
            updateScoreUI(); renderInventory();
        });
    }
    loadMemos(user.uid); renderQuizzes(); initMatchGame(); initBossGame(); loadSocialDataFromCloud(); loadLeaderboard(); startReadingTimer();
}

function logout() { try { firebase.auth().signOut(); } catch(e) {} sessionStorage.removeItem('manualUser'); window.location.reload(); }
function toggleSidebar() { document.querySelector('.sidebar').classList.toggle('open'); document.getElementById('sidebar-overlay').classList.toggle('active'); }
function switchTab(tabId, event) { 
    document.querySelectorAll('.module').forEach(mod => mod.classList.remove('active')); document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active')); 
    const target = document.getElementById(tabId); if(target) target.classList.add('active'); if(event) event.target.classList.add('active'); 
    if(window.innerWidth <= 768) { document.querySelector('.sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('active'); } 
    if(tabId === 'feature-reading') startReadingTimer();
}

function addPoints(points) { 
    if(currentUser.role === 'teacher') return; // 老師不加分
    userScore += points; userCoins += points; weeklyScore += points;
    if(db) db.collection('users').doc(currentUser.uid).update({ score: userScore, coins: userCoins, weeklyScore: weeklyScore });
    updateScoreUI(); 
}
function deductCoins(amount) {
    if(currentUser.role === 'teacher') return true; // 老師免費
    if(userCoins < amount) return false; userCoins -= amount; 
    if(db) db.collection('users').doc(currentUser.uid).update({ coins: userCoins });
    updateScoreUI(); return true;
}
function updateScoreUI() { 
    document.getElementById('score').innerText = userScore; document.getElementById('coins').innerText = userCoins;
    let petObj = { emoji: '🥚', name: '文字幼苗', lv: 1 }; if(userScore >= 100) petObj = { emoji: '🐣', name: '修辭小獸', lv: 2 }; if(userScore >= 300) petObj = { emoji: '🐥', name: '散文大師', lv: 3 }; if(userScore >= 600) petObj = { emoji: '🦅', name: '語文飛龍', lv: 4 }; 
    const levelText = `${petObj.name} (Lv.${petObj.lv})`; 
    document.getElementById('pet-avatar').innerText = petObj.emoji; document.getElementById('pet-level').innerText = levelText; 
    const bigPet = document.getElementById('big-pet-emoji'); if(bigPet) { bigPet.innerText = petObj.emoji; document.getElementById('big-pet-name').innerText = levelText; } 
    const displayNameWithEmoji = (equippedEmoji ? equippedEmoji + " " : "") + currentUser.displayName;
    document.getElementById('user-display-name').innerText = displayNameWithEmoji;
}

// 螢光筆與自訂備忘錄
let pendingSelectedText = ""; const mobileBar = document.getElementById('mobile-highlight-bar');
document.addEventListener('selectionchange', function() { const selection = window.getSelection(); const selectedStr = selection.toString().trim(); if (selectedStr.length > 0 && document.getElementById('article-content').contains(selection.getRangeAt(0).commonAncestorContainer.nodeType===3?selection.getRangeAt(0).commonAncestorContainer.parentNode:selection.getRangeAt(0).commonAncestorContainer)) { pendingSelectedText = selectedStr; document.getElementById('highlight-text-preview').innerText = selectedStr.length > 15 ? selectedStr.substring(0, 8) + " ... " + selectedStr.substring(selectedStr.length - 4) : selectedStr; mobileBar.classList.remove('hidden'); } else { mobileBar.classList.add('hidden'); } });
function confirmSaveHighlight() { if (pendingSelectedText.length > 0) { memos.unshift({ content: pendingSelectedText, time: new Date().toLocaleString() }); updateMemoUI(); localStorage.setItem(`memos_${currentUser.uid}`, JSON.stringify(memos)); alert("🖍️ 重點已收藏！"); window.getSelection().removeAllRanges(); mobileBar.classList.add('hidden'); } }
function closeHighlightBar() { mobileBar.classList.add('hidden'); pendingSelectedText = ""; }
function addManualMemo() { const input = document.getElementById('manual-memo-input'); const text = input.value.trim(); if(text !== "") { memos.unshift({ content: text, time: new Date().toLocaleString() }); updateMemoUI(); localStorage.setItem(`memos_${currentUser.uid}`, JSON.stringify(memos)); input.value = ""; alert("儲存成功！"); } }
function updateMemoUI() { const list = document.getElementById('memo-list'); if (memos.length === 0) { list.innerHTML = '<p style="color: #888; text-align: center;">暫無筆記</p>'; return; } list.innerHTML = memos.map(m => `<div class="memo-item"><p>${m.content}</p><div class="memo-time">${m.time}</div></div>`).join(''); }
function loadMemos(uid) { const saved = localStorage.getItem(`memos_${uid}`); memos = saved ? JSON.parse(saved) : []; updateMemoUI(); }

// 閱讀計時器
let readingTimer; let readingTime = 0; let dailyReadPoints = 0;
const articles = [
    { title: "《背影》節錄", text: "我與父親不相見已有二年餘了，我最不能忘記的是他的背影。那年冬天，祖母死了，父親的差使也交卸了，正是禍不單行的日子..." },
    { title: "《秋天的懷念》", text: "秋天，是最容易讓人產生懷舊情緒的季節。落葉紛飛，秋風蕭瑟，總能勾起心底最深處的記憶..." },
    { title: "《賣油翁》全文", text: "陳康肅公善射，當世無雙，公亦以此自矜。嘗射於家圃，有賣油翁釋擔而立，睨之久而不去..." }
];
let currentArticleIndex = 0;

function nextArticle() {
    currentArticleIndex = (currentArticleIndex + 1) % articles.length;
    document.getElementById('reading-title').innerText = articles[currentArticleIndex].title;
    document.getElementById('reading-text').innerText = articles[currentArticleIndex].text;
    startReadingTimer(); // 換文章重新計時
}

function startReadingTimer() {
    clearInterval(readingTimer); readingTime = 0;
    const btn = document.getElementById('btn-claim-reading');
    btn.disabled = true; btn.style.background = "#ccc"; btn.innerText = "⏳ 閱讀 30 秒後領取";
    
    // 檢查今天領了多少分
    const today = new Date().toLocaleDateString();
    const savedDaily = localStorage.getItem(`readPoints_${currentUser.uid}_${today}`);
    dailyReadPoints = savedDaily ? parseInt(savedDaily) : 0;
    
    if(dailyReadPoints >= 50) { btn.innerText = "今日閱讀獎勵已達上限 (50/50)"; return; }

    readingTimer = setInterval(() => {
        readingTime++;
        if(readingTime >= 30) {
            clearInterval(readingTimer);
            btn.disabled = false; btn.style.background = "#4caf50"; btn.innerText = "💰 領取 10 積分/金幣";
        } else {
            btn.innerText = `⏳ 閱讀中... (${30 - readingTime}s)`;
        }
    }, 1000);
}

function claimReadingPoints() {
    addPoints(10);
    dailyReadPoints += 10;
    localStorage.setItem(`readPoints_${currentUser.uid}_${new Date().toLocaleDateString()}`, dailyReadPoints);
    const btn = document.getElementById('btn-claim-reading');
    btn.disabled = true; btn.style.background = "#ccc"; btn.innerText = "✅ 已領取！請閱讀下一篇";
}

// ========================================================
// 靜態題庫引擎 (每日1題 vs 無限題)
// ========================================================
const idiomsData = [{ question: "【炙手可熱】正確的用法是？", options: ["A. 外面炙手可熱", "B. 手機炙手可熱", "C. 門票炙手可熱", "D. 丞相炙手可熱"], correctIndex: 3, explanation: "比喻權勢大，貶義。" }]; 
const grammarData = [{ question: "修正：「由於暴雨，使到發生水浸。」", options: ["A. 刪去由於或使到", "B. 發生不能配水浸", "C. 嚴重和水浸重複", "D. 暴雨不會導致水浸"], correctIndex: 0, explanation: "濫用介詞導致無主語。" }]; 
const typoData = [{ question: "錯別字：「他為了這件鎖事，大動干戈。」", options: ["A. 鎖 ➔ 瑣", "B. 戈 ➔ 哥", "C. 竟 ➔ 競", "D. 無錯"], correctIndex: 0, explanation: "「瑣事」才對。" }]; 

const memeData = [
    { emoji: "🤦‍♂️", question: "朋友半途而廢，配哪句最適合？", options: ["A. 朽木不可雕也", "B. 燕雀安知鴻鵠之志", "C. 溫故而知新", "D. 己所不欲勿施於人"], correctIndex: 0, explanation: "比喻無可救藥。" },
    { emoji: "🙄", question: "遇到無法溝通的人，配哪句最適合？", options: ["A. 醉翁之意不在酒", "B. 夏蟲不可以語冰", "C. 項莊舞劍", "D. 司馬昭之心"], correctIndex: 1, explanation: "比喻人見識短淺。" }
]; 
const ancientModernData = [
    { question: "「其實味不同」中「其實」意思？", options: ["A. 實際上", "B. 它的果實", "C. 道理", "D. 實在"], correctIndex: 1, explanation: "其：它的，實：果實。" },
    { question: "「犧牲玉帛」中「犧牲」意思？", options: ["A. 放棄生命", "B. 祭祀用的牲畜", "C. 浪費資源", "D. 無私奉獻"], correctIndex: 1, explanation: "古代專指祭祀用品。" }
]; 
const themeData = [
    { question: "《微笑以對》立意最深刻？", options: ["A. 失敗後，我還是決定在大家面前勉強擠出一個微笑。", "B. 只要我們保持微笑，這世界上的所有問題都會自動解決。", "C. 經歷人生重大挫折後，內心真正釋懷，以豁達、包容的微笑去面對未來的無常。", "D. 看到路人對我微笑，我也決定每天對身邊的同學微笑。"], correctIndex: 2, explanation: "寫作忌諱套路與膚淺。C 選項將具體的『微笑動作』昇華為『豁達的人生態度』，立意最高。" },
    { question: "《一場誤會》立意最深刻？", options: ["A. 誤會同學偷筆，後來發現掉在地上，從此不亂怪人。", "B. 誤會媽媽偏心，後來得知她用心良苦，學會體諒。", "C. 買東西找錯錢產生誤會，後來店員道歉，說明要誠實。", "D. 因刻板印象對弱勢群體產生誤會，深入了解後打破偏見，反思社會標籤的禍害。"], correctIndex: 3, explanation: "D 將個人小事昇華為社會反思，展現考生的宏觀視野。" }
]; 
const materialData = [
    { question: "《重遊舊地》想表達「物是人非」？", options: ["A. 舊地的公園設施翻新了，變得更好玩。", "B. 舊居風景依然美麗如畫，讓我想起童年。", "C. 舊招牌被無情拆除，多年熟悉的雜貨店老闆因租金高昂而黯然結業，人情味蕩然無存。", "D. 在舊地巧遇多年不見的小學同學，開心敘舊。"], correctIndex: 2, explanation: "要寫出『唏噓』，必須有強烈的今昔對比與失落感。C 選項的細節最能觸動人心。" },
    { question: "《一件令我後悔的事》哪種傷害最深刻？", options: ["A. 朋友碰倒我的水杯，我大罵他一頓。", "B. 朋友借了橡皮擦沒還，我生氣說絕交。", "C. 午餐吃什麼吵架，後來覺得沒必要。", "D. 我未經查證就在班群組指責他作弊，導致他被全班孤立，事後才發現他是清白的。"], correctIndex: 3, explanation: "後悔的程度取決於傷害的『不可逆性』。D 選項的網絡欺凌極具現代真實感，比起弄跌水杯深刻得多。" }
]; 
const logicData = [
    { question: "論點：「逆境激發潛能」。論據：「司馬遷」。", options: ["A. 司馬遷是偉大的歷史學家，我們應該學習他在逆境中讀歷史。", "B. 如果司馬遷沒有受宮刑，就不會寫出史記。可見每個人都需要經歷宮刑才能成功。", "C. 司馬遷遭遇極大挫折，但他將悲憤化為寫作動力，這正正證明了逆境能激發出人類無窮的潛能。", "D. 司馬遷雖然遭遇不幸，但依然熱愛生活，告訴我們逆境也要保持愉快。"], correctIndex: 2, explanation: "論證必須像橋樑一樣連接『論點』和『論據』。C 選項完美解釋了『宮刑(逆境)』如何轉化為『動力(激發潛能)』。" },
    { question: "論點：「合作比單打獨鬥更容易成功」。哪個論據【完全不匹配】？", options: ["A. 拔河比賽中，接力隊員步伐一致，最終戰勝對手。", "B. 喬布斯與團隊共同研發，推出了智能手機。", "C. 狼群在捕獵時分工合作，即使面對大型獵物也能拿下。", "D. 愛迪生在實驗室經歷上千次失敗，獨自堅持不懈，終於發明了電燈。"], correctIndex: 3, explanation: "D 選項強調的是『個人堅持、屢敗屢戰』，完全沒有體現『團隊合作』。寫入作文即屬離題！" }
];

function renderQuizzes() { 
    // 每日一題模塊
    renderDailyQuiz('quiz-container-1', idiomsData, 'normal'); 
    renderDailyQuiz('quiz-container-2a', grammarData, 'normal'); 
    renderDailyQuiz('quiz-container-2b', typoData, 'normal'); 
    
    // 無限刷題模塊 (隨機抽取)
    renderInfiniteQuiz('quiz-container-3', memeData, 'normal', true); 
    renderInfiniteQuiz('quiz-container-6', ancientModernData, 'normal'); 
    renderInfiniteQuiz('quiz-container-16', themeData, 'suggested'); 
    renderInfiniteQuiz('quiz-container-17', materialData, 'suggested'); 
    renderInfiniteQuiz('quiz-container-18', logicData, 'suggested'); 
}

function renderDailyQuiz(containerId, dataArray, type = 'normal', isMeme = false) { 
    const container = document.getElementById(containerId); if(!container) return; 
    const q = dataArray[0]; const memeHtml = isMeme && q.emoji ? `<div style="font-size: 4rem; text-align: center; margin-bottom: 10px;">${q.emoji}</div>` : ''; 
    container.innerHTML = `<div class="card" style="margin-bottom: 20px;">${memeHtml}<p class="question"><strong>📅 今日挑戰：</strong>${q.question}</p><div class="options">${q.options.map((opt, i) => `<button class="btn-option" onclick="checkStaticAnswer(this, ${i}, ${q.correctIndex}, '${q.explanation}', '${type}', false)">${opt}</button>`).join('')}</div><div class="feedback hidden" style="margin-top:15px;"></div></div>`; 
}

// 無限刷題渲染器
function renderInfiniteQuiz(containerId, dataArray, type = 'normal', isMeme = false) {
    const container = document.getElementById(containerId); if(!container) return;
    const qIndex = Math.floor(Math.random() * dataArray.length);
    const q = dataArray[qIndex];
    const memeHtml = isMeme && q.emoji ? `<div style="font-size: 4rem; text-align: center; margin-bottom: 10px;">${q.emoji}</div>` : ''; 
    
    container.innerHTML = `<div class="card" style="margin-bottom: 20px;">${memeHtml}<p class="question">${q.question}</p><div class="options">${q.options.map((opt, i) => `<button class="btn-option" onclick="checkStaticAnswer(this, ${i}, ${q.correctIndex}, '${q.explanation}', '${type}', true, '${containerId}')">${opt}</button>`).join('')}</div><div class="feedback hidden" style="margin-top:15px;"></div></div>`; 
}

function checkStaticAnswer(btn, clickedIndex, correctIndex, explanation, type, isInfinite = false, containerId = "") { 
    const parent = btn.parentElement; const feedback = parent.nextElementSibling; const allButtons = parent.querySelectorAll('.btn-option'); 
    allButtons.forEach(b => b.disabled = true); feedback.classList.remove('hidden'); 
    const labelText = type === 'suggested' ? '💡 建議答案' : '✅ 正確答案'; 
    const nextBtnHtml = isInfinite ? `<br><br><button class="btn-primary" onclick="renderQuizzes()">做下一題 ➔</button>` : '';

    if (clickedIndex === correctIndex) { 
        btn.style.backgroundColor = '#d4edda'; btn.style.borderColor = '#28a745'; 
        feedback.className = 'feedback success'; feedback.innerHTML = `🎉 選擇極佳！<br><br>💡 解析：${explanation}<br><br>🌟 獲得 20 積分！${nextBtnHtml}`; addPoints(20); 
    } else { 
        btn.style.backgroundColor = '#f8d7da'; btn.style.borderColor = '#dc3545'; 
        allButtons[correctIndex].style.backgroundColor = '#d4edda'; allButtons[correctIndex].style.borderColor = '#28a745'; allButtons[correctIndex].style.borderWidth = '2px'; 
        feedback.className = 'feedback error'; feedback.innerHTML = `❌ 稍嫌遜色！${labelText}是 <strong>${String.fromCharCode(65 + correctIndex)}</strong>。<br><br>💡 解析：${explanation} ${nextBtnHtml}`; 
    } 
}

const matchPairs = [ { ancient: "走", modern: "跑" }, { ancient: "妻子", modern: "妻子與兒女" }, { ancient: "去", modern: "離開" }, { ancient: "股", modern: "大腿" } ]; let selectedAncient = null; let matchedCount = 0; function initMatchGame() { const leftContainer = document.getElementById('match-left'); const rightContainer = document.getElementById('match-right'); if(!leftContainer) return; let ancients = [...matchPairs].sort(() => Math.random() - 0.5); let moderns = [...matchPairs].sort(() => Math.random() - 0.5); leftContainer.innerHTML = ancients.map((p, i) => `<button class="btn-option" id="ancient-${i}" onclick="selectAncient(${i}, '${p.ancient}')">${p.ancient}</button>`).join(''); rightContainer.innerHTML = moderns.map((p, i) => `<button class="btn-option" id="modern-${i}" onclick="selectModern(${i}, '${p.modern}')">${p.modern}</button>`).join(''); } function selectAncient(index, text) { document.querySelectorAll('#match-left .btn-option').forEach(b => b.style.borderColor = '#e0e0e0'); const btn = document.getElementById(`ancient-${index}`); if(!btn.disabled) { btn.style.borderColor = '#1976d2'; selectedAncient = { index, text, btn }; } } function selectModern(index, text) { if(!selectedAncient) return alert("請先點擊左側文字！"); const rightBtn = document.getElementById(`modern-${index}`); const correctPair = matchPairs.find(p => p.ancient === selectedAncient.text); if(correctPair.modern === text) { selectedAncient.btn.style.backgroundColor = '#d4edda'; selectedAncient.btn.disabled = true; rightBtn.style.backgroundColor = '#d4edda'; rightBtn.disabled = true; selectedAncient = null; matchedCount++; if(matchedCount === matchPairs.length) { const fb = document.getElementById('match-feedback'); fb.classList.remove('hidden'); fb.className = 'feedback success'; fb.innerHTML = "🎉 成功！獲得 30 積分！"; addPoints(30); } } else { rightBtn.style.backgroundColor = '#f8d7da'; setTimeout(() => { rightBtn.style.backgroundColor = 'white'; }, 800); } }
const bossQuestions = [ { q: "「輟耕<strong style='color:#d32f2f;'>之</strong>壟上」", options: ["A. 的", "B. 往", "C. 他"], correct: 1 }, { q: "「物外<strong style='color:#d32f2f;'>之</strong>趣」", options: ["A. 的", "B. 往", "C. 他"], correct: 0 }, { q: "「名<strong style='color:#d32f2f;'>之</strong>者誰」", options: ["A. 的", "B. 往", "C. 他"], correct: 2 } ]; let currentBossHp = 3; let currentBossQ = 0; function initBossGame() { if(!document.getElementById('boss-question')) return; if(currentBossQ < bossQuestions.length) { const q = bossQuestions[currentBossQ]; document.getElementById('boss-question').innerHTML = q.q; document.getElementById('boss-options').innerHTML = q.options.map((opt, i) => `<button class="btn-option" onclick="attackBoss(${i}, ${q.correct})">${opt}</button>`).join(''); } } function attackBoss(clicked, correct) { if(clicked === correct) { currentBossHp--; document.getElementById('boss-hp').style.width = (currentBossHp / 3 * 100) + "%"; currentBossQ++; if(currentBossHp === 0) { document.getElementById('boss-emoji').innerText = "💥"; document.getElementById('boss-question').innerText = "Boss 擊敗！"; document.getElementById('boss-options').innerHTML = ""; const fb = document.getElementById('boss-feedback'); fb.classList.remove('hidden'); fb.className = 'feedback success'; fb.innerHTML = "🎉 獲得 50 積分！"; addPoints(50); } else { alert("💥 攻擊成功！"); initBossGame(); } } else { alert("❌ 攻擊無效！"); } }
const readingQuestions = { 1: { level: "🌱 基礎", q: "「徐以杓酌油」的「徐」是？", opts: ["A. 慢慢", "B. 快速", "C. 姓氏"], correct: 0, exp: "解作慢慢地。" }, 2: { level: "🌲 進階", q: "為何錢放葫蘆口？", opts: ["A. 炫耀", "B. 展示技術", "C. 洗錢"], correct: 1, exp: "證明熟能生巧。" }, 3: { level: "🔥 挑戰", q: "賣油翁崇拜陳？", opts: ["A. 對", "B. 錯", "C. 無法判斷"], correct: 1, exp: "他只覺得是手熟。" } }; function loadReadingQuiz(level) { const container = document.getElementById('reading-quiz-container'); const q = readingQuestions[level]; container.innerHTML = `<div style="background: #fff; padding: 20px; border-radius: 8px; border: 2px solid #1976d2;"><p style="color: #1976d2; font-weight: bold; margin-bottom: 10px;">${q.level}</p><p class="question">${q.q}</p><div class="options">${q.opts.map((opt, i) => `<button class="btn-option" style="padding: 10px;" onclick="checkReadingAnswer(this, ${i}, ${q.correct}, '${q.exp}')">${opt}</button>`).join('')}</div><div class="reading-feedback hidden" style="margin-top:15px; font-weight:bold;"></div></div>`; } function checkReadingAnswer(btn, clicked, correct, exp) { const parent = btn.parentElement; const feedback = parent.nextElementSibling; parent.querySelectorAll('.btn-option').forEach(b => b.disabled = true); feedback.classList.remove('hidden'); if(clicked === correct) { btn.style.backgroundColor = '#d4edda'; btn.style.borderColor = '#28a745'; feedback.style.color = '#155724'; feedback.innerHTML = `🎉 答對！解析：${exp} (+15分)`; addPoints(15); } else { btn.style.backgroundColor = '#f8d7da'; btn.style.borderColor = '#dc3545'; feedback.style.color = '#721c24'; feedback.innerHTML = `❌ 答錯！解析：${exp}`; } }

// ========================================================
// 4. 稱號背包與抽卡系統
// ========================================================
function drawGacha() { 
    if(!deductCoins(500)) return alert("💰 金幣不足 500 枚！"); 
    const res = document.getElementById('gacha-result'); 
    res.classList.remove('hidden'); res.className = 'feedback info'; res.innerHTML = "🎲 盲盒開啟中..."; 
    
    setTimeout(() => { 
        let r = Math.random() * 100; let card = ""; let color = ""; let isItem = true;
        
        if (r < 1) { card = "【R級極罕】抵消現場紅牌 🛑"; color = "#d32f2f"; } 
        else if (r < 2) { card = "【R級極罕】獲綠色牌(與老師打球) 🍀"; color = "#4caf50"; } 
        else if (r < 5) { card = "【S級稀有】自選座位一天 / 點播歌曲 🎵"; color = "#9c27b0"; } 
        else if (r < 10) { card = "【A 級】課堂免被抽問豁免權一次 🤫"; color = "#ff9800"; } 
        else if (r < 15) { card = "【A 級】課堂小懲罰豁免權 🛡️"; color = "#2196f3"; } 
        else { 
            isItem = false;
            const emojis = ["😎", "👻", "🔥", "✨", "👑", "👽", "💩", "🦄", "🐼", "🚀", "🌟", "💡", "🎯"];
            const gotEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            card = `【B 級】專屬名稱 Emoji：${gotEmoji}`; color = "#757575";
            if(!userEmojis.includes(gotEmoji)) { userEmojis.push(gotEmoji); if(db && currentUser.role !== 'teacher') db.collection('users').doc(currentUser.uid).update({ emojis: userEmojis }); }
        }
        if(isItem) { userItems.push(card); if(db && currentUser.role !== 'teacher') db.collection('users').doc(currentUser.uid).update({ items: userItems }); }

        renderInventory(); res.className = 'feedback success'; 
        res.innerHTML = `🎉 恭喜抽中：<br><br><span style="font-size:1.4rem; color:${color}; font-weight:bold;">${card}</span>`; 
    }, 1500); 
}

function renderInventory() {
    const container = document.getElementById('inventory-container'); if(!container) return; container.classList.remove('hidden');
    const itemList = document.getElementById('my-items-list');
    if(userItems.length === 0) { itemList.innerHTML = "<p style='color:#888;'>尚未獲得道具卡。</p>"; } 
    else { itemList.innerHTML = userItems.map((item, index) => `<div style="background:#fff; border:1px solid #ccc; padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;"><span style="font-weight:bold;">${item}</span><button style="background:#dc3545; color:white; border:none; padding:5px 15px; border-radius:5px; cursor:pointer;" onclick="redeemItem(${index}, '${item}')">使用兌換</button></div>`).join(''); }

    const emojiList = document.getElementById('my-emoji-list'); document.getElementById('current-equipped-emoji').innerText = equippedEmoji || "無";
    if(userEmojis.length === 0) { emojiList.innerHTML = "<p style='font-size:1rem; color:#888;'>尚未收集到稱號。</p>"; } 
    else { emojiList.innerHTML = userEmojis.map(e => `<span onclick="equipEmoji('${e}')" style="display:inline-block; border: 3px solid ${e === equippedEmoji ? '#d32f2f' : 'transparent'}; border-radius:12px; padding:8px; transition:0.2s; background:${e === equippedEmoji ? '#ffebee' : 'transparent'};">${e}</span>`).join(''); }
}

function equipEmoji(emojiToEquip) {
    equippedEmoji = (equippedEmoji === emojiToEquip) ? "" : emojiToEquip;
    if(db && currentUser.role !== 'teacher') db.collection('users').doc(currentUser.uid).update({ equippedEmoji: equippedEmoji });
    updateScoreUI(); renderInventory(); alert(equippedEmoji ? `✅ 已裝備稱號：${equippedEmoji}` : `✅ 已卸下稱號`);
}

function redeemItem(index, itemName) {
    if(confirm(`⚠️ 警告：請務必在老師面前按下確認！\n\n您確定要現在兌換\n${itemName} 嗎？`)) {
        userItems.splice(index, 1);
        if(db && currentUser.role !== 'teacher') db.collection('users').doc(currentUser.uid).update({ items: userItems });
        if(db && currentUser.role !== 'teacher') { db.collection('redemptions').add({ name: currentUser.displayName, email: currentUser.email, item: itemName, time: new Date().toLocaleString(), timestamp: firebase.firestore.FieldValue.serverTimestamp() }); }
        alert("✅ 兌換成功！已同步發送紀錄至老師後台。"); renderInventory(); 
    }
}

// 🌟 真實 AI 畫圖 (免費免金鑰) 🌟
function generateRealAI() { 
    if(!deductCoins(100)) return alert("金幣不足 100 枚！"); 
    const input = document.getElementById('ai-input').value.trim(); 
    if(!input) return alert("請輸入文字！"); 
    
    const res = document.getElementById('ai-result'); 
    res.classList.remove('hidden'); res.className = 'feedback info'; res.innerHTML = "⏳ 魔法施展中，AI 正在繪製您的想像..."; 
    
    // 呼叫免費的開源 AI 繪圖 API
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(input)}?width=512&height=512&nologo=true`;
    
    setTimeout(() => { 
        res.className = 'feedback success'; 
        res.innerHTML = `🎨 生成成功！<br><img src="${url}" style="width:100%; max-width:400px; border-radius:8px; margin-top:15px; box-shadow:0 4px 10px rgba(0,0,0,0.2);" onerror="this.innerHTML='生成失敗，請用英文輸入或稍後再試'"/>`; 
    }, 1500); 
}

// ========================================================
// 5. 雲端留言系統
// ========================================================
let socialData = { 8: [], 9: [], 10: [] };
const defaultData = {
    8: [ { name: "CTM 示例", text: "我最不能忘記的是他的背影。這句平淡卻充滿後勁。", likes: 12, teacherLiked: false } ],
    9: [ { name: "CTM 示例", text: "調皮的微風在樹梢間穿梭，惹得樹葉們咯咯嬌笑。", likes: 8, teacherLiked: false } ],
    10: [ { name: "系統", text: "今天放學後，我在課桌抽屜裡發現了一張沒有署名的紙條，上面寫著..." } ]
};

function loadSocialDataFromCloud() {
    if(!db) { renderSocialWithDefault(); return; }
    ['8', '9', '10'].forEach(id => {
        db.collection('wall_' + id).orderBy('timestampMs', id === '10' ? 'asc' : 'desc').onSnapshot((snapshot) => {
            socialData[id] = [];
            snapshot.forEach(doc => { let data = doc.data(); data.docId = doc.id; socialData[id].push(data); });
            renderSocial(); 
        }, () => { renderSocialWithDefault(); });
    });
}
function renderSocialWithDefault() { ['8', '9', '10'].forEach(id => { if(socialData[id].length === 0) socialData[id] = defaultData[id]; }); renderSocial(); }

function renderSocial() {
    ['8', '9', '10'].forEach(id => {
        const wall = document.getElementById('wall-' + id); if(!wall) return;
        wall.innerHTML = socialData[id].map((item, index) => {
            const teacherBadge = item.teacherLiked ? `<span style="background:#ffecb3; color:#d84315; padding:2px 6px; border-radius:12px; font-size:0.8rem; margin-left:10px; font-weight:bold;">👨‍🏫 老師讚好</span>` : '';
            let actionBtns = ""; const isAuthor = currentUser && currentUser.uid === item.authorUid; const isTeacher = currentUser && currentUser.role === 'teacher';
            const timePassed = Date.now() - (item.timestampMs || 0);
            if (isAuthor && timePassed <= 300000) { actionBtns += `<span style="cursor:pointer; margin-right:10px; color:#4facfe;" onclick="editPost('${id}', '${item.docId || index}', '${item.text}')">✏️修改</span>`; }
            if (isAuthor || isTeacher) { actionBtns += `<span style="cursor:pointer; color:#dc3545;" onclick="deletePost('${id}', '${item.docId || index}')">🗑️刪除</span>`; }
            const emojiStr = item.nameEmoji ? item.nameEmoji + " " : "";

            return `<div class="memo-item" style="border-left-color: #4facfe; margin-bottom: 10px;">
                <p style="font-size:1.15rem; margin-bottom:8px;">${item.text} ${teacherBadge}</p>
                <div style="display:flex; justify-content:space-between; color:#888; font-size:0.9rem;">
                    <span>✍️ ${emojiStr}${item.name} <span style="margin-left:10px;">${actionBtns}</span></span>
                    ${id !== '10' ? `<span style="cursor:pointer;" onclick="likePost('${id}', '${item.docId || index}', '${item.authorUid}', ${item.likes || 0})">❤️ ${item.likes || 0}</span>` : ''}
                </div>
            </div>`;
        }).join('');
    });
}

function submitSocial(id) {
    if(!currentUser) return alert("請先登入！"); 
    const input = document.getElementById('input-' + id); const text = input.value.trim(); if(text === "") return alert("請輸入內容！"); 
    const displayName = currentUser.role === 'teacher' ? `👑 ${currentUser.displayName}` : currentUser.displayName;
    const newPost = { name: displayName, nameEmoji: equippedEmoji, authorUid: currentUser.uid, text: text, likes: 0, teacherLiked: false, timestampMs: Date.now() };
    
    if(db) {
        db.collection('wall_' + id).add(newPost).then(() => { input.value = ""; addPoints(20); alert(`🎉 發佈成功！`); });
    }
}
function editPost(id, docId, oldText) { const newText = prompt("修改留言 (5分鐘內)：", oldText); if(newText && newText.trim() !== "" && newText !== oldText) { if(db && typeof docId === 'string') db.collection('wall_' + id).doc(docId).update({ text: newText.trim() }); } }
function deletePost(id, docId) { if(confirm("確定刪除嗎？")) { if(db && typeof docId === 'string') db.collection('wall_' + id).doc(docId).delete(); } }
function likePost(id, docId, authorUid, currentLikes) { 
    if(!currentUser || !db || typeof docId !== 'string') return;
    const postRef = db.collection('wall_' + id).doc(docId); const authorRef = db.collection('users').doc(authorUid);
    if(currentUser.role === 'teacher') {
        postRef.update({ teacherLiked: true }).then(() => { authorRef.update({ score: firebase.firestore.FieldValue.increment(20), coins: firebase.firestore.FieldValue.increment(20) }); alert("已送出「老師讚好」！"); });
    } else { postRef.update({ likes: currentLikes + 1 }).then(() => { authorRef.update({ score: firebase.firestore.FieldValue.increment(2), coins: firebase.firestore.FieldValue.increment(2) }); }); }
}

// 排行榜 (每週更新邏輯)
function loadLeaderboard() {
    if(!db) return;
    db.collection('users').where('role', '==', 'student').orderBy('weeklyScore', 'desc').limit(30).onSnapshot((snapshot) => {
        const table = document.getElementById('global-leaderboard'); if(!table) return;
        let html = `<tr><th>排名</th><th>同學</th>${currentUser && currentUser.role === 'teacher' ? '<th>帳號</th>' : ''}<th style="color:#d84315;">本週積分</th><th>總積分</th></tr>`;
        let rank = 1;
        snapshot.forEach(doc => {
            const data = doc.data();
            const emailCol = currentUser && currentUser.role === 'teacher' ? `<td>${data.email || '無'}</td>` : '';
            const isMe = currentUser && data.email === currentUser.email ? 'background:#e3f2fd; font-weight:bold;' : '';
            const nameStr = (data.equippedEmoji ? data.equippedEmoji + " " : "") + data.name;
            html += `<tr style="${isMe}"><td>${rank}</td><td>${nameStr}</td>${emailCol}<td style="color:#d84315; font-weight:bold;">${data.weeklyScore || 0}</td><td>${data.score}</td></tr>`;
            rank++;
        });
        table.innerHTML = html;
    });
}

function loadAdminDashboard() {
    if(!db || currentUser.role !== 'teacher') return;
    db.collection('users').orderBy('lastLogin', 'desc').onSnapshot((snapshot) => {
        const table = document.getElementById('admin-users-table'); if(!table) return;
        let html = `<tr><th>學生姓名</th><th>帳號</th><th>本週積分</th><th>總積分</th><th>金幣</th><th>最後登入</th></tr>`;
        snapshot.forEach(doc => { const data = doc.data(); html += `<tr><td>${data.name}</td><td>${data.email || '無'}</td><td>${data.weeklyScore||0}</td><td>${data.score}</td><td>${data.coins || 0}</td><td>${data.lastLogin || '未記錄'}</td></tr>`; });
        table.innerHTML = html;
    });
    db.collection('redemptions').orderBy('timestamp', 'desc').limit(50).onSnapshot((snapshot) => {
        const logDiv = document.getElementById('admin-redemption-log'); if(!logDiv) return;
        let html = ""; snapshot.forEach(doc => { const data = doc.data(); html += `<div style="border-bottom: 1px solid #ccc; padding: 8px 0;"><span style="color:#d84315; font-weight:bold;">[${data.time}]</span> <strong>${data.name}</strong> 兌換了 <span style="color:#1976d2;">${data.item}</span></div>`; });
        if(html === "") html = "<p style='color:#888;'>尚無紀錄。</p>"; logDiv.innerHTML = html;
    });
}
