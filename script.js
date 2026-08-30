// ========================================================
// 1. FIREBASE 初始化與登入
// ========================================================
const firebaseConfig = { apiKey: "AIzaSyBXTjkrXmiLhp64MSBU1Ai5Iiv1EJfwA3I", authDomain: "ctm-game.firebaseapp.com", projectId: "ctm-game", storageBucket: "ctm-game.firebasestorage.app", messagingSenderId: "204941638255", appId: "1:204941638255:web:f23470bb681e9dac6eeb9a" };
let currentUser = null; let memos = []; let userScore = 0; let userCoins = 0; let db = null;
let userEmojis = []; let equippedEmoji = ""; // 🎒 稱號背包變數

try {
    firebase.initializeApp(firebaseConfig); db = firebase.firestore(); 
    firebase.auth().onAuthStateChanged((user) => {
        if (user) { const role = (user.email === 'ctmlwsss@gmail.com') ? 'teacher' : 'student'; handleLoginSuccess({ displayName: user.displayName, email: user.email, uid: user.uid, role: role }); } 
        else { checkManualLogin(); }
    });
} catch (error) { checkManualLogin(); }

function checkManualLogin() { const saved = sessionStorage.getItem('manualUser'); if (saved) { handleLoginSuccess(JSON.parse(saved)); } }
function loginWithGoogle() { try { const provider = new firebase.auth.GoogleAuthProvider(); firebase.auth().languageCode = 'zh-HK'; firebase.auth().signInWithPopup(provider).catch((e) => alert("登入失敗: " + e.message)); } catch (e) { alert("無法連線，請使用手動登入！"); } }
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
        const userRef = db.collection('users').doc(user.uid);
        userRef.get().then((doc) => {
            if (doc.exists) {
                userScore = doc.data().score || 0; userCoins = doc.data().coins || 0;
                userEmojis = doc.data().emojis || []; // 讀取已收集的 Emoji
                equippedEmoji = doc.data().equippedEmoji || ""; // 讀取目前裝備的 Emoji
                userRef.update({ lastLogin: new Date().toLocaleString() });
            } else {
                userScore = 0; userCoins = 0; userEmojis = []; equippedEmoji = "";
                userRef.set({ name: user.displayName, email: user.email, score: 0, coins: 0, emojis: [], equippedEmoji: "", role: user.role, lastLogin: new Date().toLocaleString() });
            }
            updateScoreUI(); renderEmojiBackpack(); // 渲染背包
        });
    }
    loadMemos(user.uid); renderQuizzes(); initMatchGame(); initBossGame(); loadSocialDataFromCloud(); loadLeaderboard();
}

function logout() { try { firebase.auth().signOut(); } catch(e) {} sessionStorage.removeItem('manualUser'); window.location.reload(); }
function toggleSidebar() { document.querySelector('.sidebar').classList.toggle('open'); document.getElementById('sidebar-overlay').classList.toggle('active'); }
function switchTab(tabId, event) { document.querySelectorAll('.module').forEach(mod => mod.classList.remove('active')); document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active')); const target = document.getElementById(tabId); if(target) target.classList.add('active'); if(event) event.target.classList.add('active'); if(window.innerWidth <= 768) { document.querySelector('.sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('active'); } }

// ========================================================
// 2. 雙軌貨幣與 UI
// ========================================================
function addPoints(points) { 
    userScore += points; userCoins += points;
    if(db) db.collection('users').doc(currentUser.uid).update({ score: userScore, coins: userCoins });
    updateScoreUI(); 
}
function deductCoins(amount) {
    if(userCoins < amount) return false;
    userCoins -= amount; 
    if(db) db.collection('users').doc(currentUser.uid).update({ coins: userCoins });
    updateScoreUI(); return true;
}
function updateScoreUI() { 
    document.getElementById('score').innerText = userScore; document.getElementById('coins').innerText = userCoins;
    let petObj = { emoji: '🥚', name: '文字幼苗', lv: 1 }; if(userScore >= 100) petObj = { emoji: '🐣', name: '修辭小獸', lv: 2 }; if(userScore >= 300) petObj = { emoji: '🐥', name: '散文大師', lv: 3 }; if(userScore >= 600) petObj = { emoji: '🦅', name: '語文飛龍', lv: 4 }; 
    const levelText = `${petObj.name} (Lv.${petObj.lv})`; 
    document.getElementById('pet-avatar').innerText = petObj.emoji; document.getElementById('pet-level').innerText = levelText; 
    const bigPet = document.getElementById('big-pet-emoji'); if(bigPet) { bigPet.innerText = petObj.emoji; document.getElementById('big-pet-name').innerText = levelText; } 
    
    // 將裝備的 Emoji 加到名字前
    const displayNameWithEmoji = (equippedEmoji ? equippedEmoji + " " : "") + currentUser.displayName;
    document.getElementById('user-display-name').innerText = displayNameWithEmoji;
    document.getElementById('rank-my-name').innerText = displayNameWithEmoji;
}

// 螢光筆系統
let pendingSelectedText = ""; const mobileBar = document.getElementById('mobile-highlight-bar');
document.addEventListener('selectionchange', function() { const selection = window.getSelection(); const selectedStr = selection.toString().trim(); if (selectedStr.length > 0 && isSelectionInsideArticle(selection)) { pendingSelectedText = selectedStr; let displayStr = selectedStr.length > 15 ? selectedStr.substring(0, 8) + " ... " + selectedStr.substring(selectedStr.length - 4) : selectedStr; document.getElementById('highlight-text-preview').innerText = displayStr; mobileBar.classList.remove('hidden'); } else { mobileBar.classList.add('hidden'); } });
function isSelectionInsideArticle(selection) { if (selection.rangeCount === 0) return false; const container = selection.getRangeAt(0).commonAncestorContainer; const articleCard = document.getElementById('article-content'); return articleCard && articleCard.contains(container.nodeType === 3 ? container.parentNode : container); }
function confirmSaveHighlight() { if (pendingSelectedText.length > 0) { const now = new Date(); memos.unshift({ content: pendingSelectedText, time: now.toLocaleDateString() + " " + now.toLocaleTimeString() }); updateMemoUI(); localStorage.setItem(`memos_${currentUser.uid}`, JSON.stringify(memos)); alert("🖍️ 重點已成功收藏！"); window.getSelection().removeAllRanges(); mobileBar.classList.add('hidden'); } }
function closeHighlightBar() { mobileBar.classList.add('hidden'); pendingSelectedText = ""; }
function updateMemoUI() { const list = document.getElementById('memo-list'); if (memos.length === 0) { list.innerHTML = '<p style="color: #888; text-align: center;">暫無筆記</p>'; return; } list.innerHTML = memos.map(m => `<div class="memo-item"><p>${m.content}</p><div class="memo-time">${m.time}</div></div>`).join(''); }
function loadMemos(uid) { const saved = localStorage.getItem(`memos_${uid}`); memos = saved ? JSON.parse(saved) : []; updateMemoUI(); }

// ========================================================
// 3. 靜態題庫引擎
// ========================================================
const idiomsData = [{ question: "【炙手可熱】用法？", options: ["A. 外面炙手可熱", "B. 手機炙手可熱", "C. 門票炙手可熱", "D. 丞相炙手可熱"], correctIndex: 3, explanation: "比喻權勢大，貶義。" }];
const grammarData = [{ question: "修正：「由於暴雨，使到發生水浸。」", options: ["A. 刪去由於或使到", "B. 發生不能配水浸", "C. 嚴重和水浸重複", "D. 暴雨不會導致水浸"], correctIndex: 0, explanation: "濫用介詞導致無主語。" }];
const typoData = [{ question: "錯別字：「這件鎖事，竟然大動干戈。」", options: ["A. 鎖->瑣", "B. 戈->哥", "C. 竟->競", "D. 無錯"], correctIndex: 0, explanation: "「瑣事」才對。" }];
const memeData = [{ emoji: "🤦‍♂️", question: "半途而廢配哪句？", options: ["A. 朽木不可雕也", "B. 燕雀安知鴻鵠之志", "C. 溫故而知新", "D. 己所不欲勿施於人"], correctIndex: 0, explanation: "比喻無可救藥。" }];
const ancientModernData = [{ question: "「其實味不同」中「其實」意思？", options: ["A. 實際上", "B. 它的果實", "C. 道理", "D. 實在"], correctIndex: 1, explanation: "其：它的，實：果實。" }];
const themeData = [{ question: "《微笑以對》立意最深刻？", options: ["A. 失敗勉強微笑", "B. 微笑解決問題", "C. 釋懷面對無常", "D. 對人微笑"], correctIndex: 2, explanation: "C 將微笑昇華。" }];
const materialData = [{ question: "《重遊舊地》想表達「物是人非」？", options: ["A. 設施翻新", "B. 老闆結業", "C. 巧遇同學", "D. 風景美麗"], correctIndex: 1, explanation: "B 有強烈落差感。" }];
const logicData = [{ question: "論點：「逆境激發潛能」。論據：「司馬遷」。", options: ["A. 將悲憤化為動力", "B. 學習他讀歷史", "C. 沒受刑就不會寫", "D. 保持心情愉快"], correctIndex: 0, explanation: "A 解釋了因果。" }];

function renderQuizzes() { renderDailyQuiz('quiz-container-1', idiomsData, 'normal'); renderDailyQuiz('quiz-container-2a', grammarData, 'normal'); renderDailyQuiz('quiz-container-2b', typoData, 'normal'); renderDailyQuiz('quiz-container-3', memeData, 'normal', true); renderDailyQuiz('quiz-container-6', ancientModernData, 'normal'); renderDailyQuiz('quiz-container-16', themeData, 'suggested'); renderDailyQuiz('quiz-container-17', materialData, 'suggested'); renderDailyQuiz('quiz-container-18', logicData, 'suggested'); }
function renderDailyQuiz(containerId, dataArray, type = 'normal', isMeme = false) { const container = document.getElementById(containerId); if(!container) return; const q = dataArray[0]; const memeHtml = isMeme && q.emoji ? `<div style="font-size: 4rem; text-align: center; margin-bottom: 10px;">${q.emoji}</div>` : ''; container.innerHTML = `<div class="card" style="margin-bottom: 20px;">${memeHtml}<p class="question"><strong>📅 今日挑戰：</strong>${q.question}</p><div class="options">${q.options.map((opt, i) => `<button class="btn-option" onclick="checkStaticAnswer(this, ${i}, ${q.correctIndex}, '${q.explanation}', '${type}')">${opt}</button>`).join('')}</div><div class="feedback hidden" style="margin-top:15px;"></div></div>`; }
function checkStaticAnswer(btn, clickedIndex, correctIndex, explanation, type) { const parent = btn.parentElement; const feedback = parent.nextElementSibling; parent.querySelectorAll('.btn-option').forEach(b => b.disabled = true); feedback.classList.remove('hidden'); const labelText = type === 'suggested' ? '💡 建議答案' : '✅ 正確答案'; if (clickedIndex === correctIndex) { btn.style.backgroundColor = '#d4edda'; btn.style.borderColor = '#28a745'; feedback.className = 'feedback success'; feedback.innerHTML = `🎉 選擇極佳！<br><br>💡 解析：${explanation}<br><br>🌟 獲得 20 積分！`; addPoints(20); } else { btn.style.backgroundColor = '#f8d7da'; btn.style.borderColor = '#dc3545'; parent.querySelectorAll('.btn-option')[correctIndex].style.backgroundColor = '#d4edda'; parent.querySelectorAll('.btn-option')[correctIndex].style.borderColor = '#28a745'; feedback.className = 'feedback error'; feedback.innerHTML = `❌ 稍嫌遜色！${labelText}是 <strong>${String.fromCharCode(65 + correctIndex)}</strong>。<br><br>💡 解析：${explanation}`; } }

const matchPairs = [ { ancient: "走", modern: "跑" }, { ancient: "妻子", modern: "妻子與兒女" }, { ancient: "去", modern: "離開" }, { ancient: "股", modern: "大腿" } ]; let selectedAncient = null; let matchedCount = 0; function initMatchGame() { const leftContainer = document.getElementById('match-left'); const rightContainer = document.getElementById('match-right'); if(!leftContainer) return; let ancients = [...matchPairs].sort(() => Math.random() - 0.5); let moderns = [...matchPairs].sort(() => Math.random() - 0.5); leftContainer.innerHTML = ancients.map((p, i) => `<button class="btn-option" id="ancient-${i}" onclick="selectAncient(${i}, '${p.ancient}')">${p.ancient}</button>`).join(''); rightContainer.innerHTML = moderns.map((p, i) => `<button class="btn-option" id="modern-${i}" onclick="selectModern(${i}, '${p.modern}')">${p.modern}</button>`).join(''); } function selectAncient(index, text) { document.querySelectorAll('#match-left .btn-option').forEach(b => b.style.borderColor = '#e0e0e0'); const btn = document.getElementById(`ancient-${index}`); if(!btn.disabled) { btn.style.borderColor = '#1976d2'; selectedAncient = { index, text, btn }; } } function selectModern(index, text) { if(!selectedAncient) return alert("請先點擊左側文字！"); const rightBtn = document.getElementById(`modern-${index}`); const correctPair = matchPairs.find(p => p.ancient === selectedAncient.text); if(correctPair.modern === text) { selectedAncient.btn.style.backgroundColor = '#d4edda'; selectedAncient.btn.disabled = true; rightBtn.style.backgroundColor = '#d4edda'; rightBtn.disabled = true; selectedAncient = null; matchedCount++; if(matchedCount === matchPairs.length) { const fb = document.getElementById('match-feedback'); fb.classList.remove('hidden'); fb.className = 'feedback success'; fb.innerHTML = "🎉 成功！獲得 30 積分！"; addPoints(30); } } else { rightBtn.style.backgroundColor = '#f8d7da'; setTimeout(() => { rightBtn.style.backgroundColor = 'white'; }, 800); } }
const bossQuestions = [ { q: "「輟耕<strong style='color:#d32f2f;'>之</strong>壟上」", options: ["A. 的", "B. 往", "C. 他"], correct: 1 }, { q: "「物外<strong style='color:#d32f2f;'>之</strong>趣」", options: ["A. 的", "B. 往", "C. 他"], correct: 0 }, { q: "「名<strong style='color:#d32f2f;'>之</strong>者誰」", options: ["A. 的", "B. 往", "C. 他"], correct: 2 } ]; let currentBossHp = 3; let currentBossQ = 0; function initBossGame() { if(!document.getElementById('boss-question')) return; if(currentBossQ < bossQuestions.length) { const q = bossQuestions[currentBossQ]; document.getElementById('boss-question').innerHTML = q.q; document.getElementById('boss-options').innerHTML = q.options.map((opt, i) => `<button class="btn-option" onclick="attackBoss(${i}, ${q.correct})">${opt}</button>`).join(''); } } function attackBoss(clicked, correct) { if(clicked === correct) { currentBossHp--; document.getElementById('boss-hp').style.width = (currentBossHp / 3 * 100) + "%"; currentBossQ++; if(currentBossHp === 0) { document.getElementById('boss-emoji').innerText = "💥"; document.getElementById('boss-question').innerText = "Boss 擊敗！"; document.getElementById('boss-options').innerHTML = ""; const fb = document.getElementById('boss-feedback'); fb.classList.remove('hidden'); fb.className = 'feedback success'; fb.innerHTML = "🎉 獲得 50 積分！"; addPoints(50); } else { alert("💥 攻擊成功！"); initBossGame(); } } else { alert("❌ 攻擊無效！"); } }
const readingQuestions = { 1: { level: "🌱 基礎", q: "「徐以杓酌油」的「徐」是？", opts: ["A. 慢慢", "B. 快速", "C. 姓氏"], correct: 0, exp: "解作慢慢地。" }, 2: { level: "🌲 進階", q: "為何錢放葫蘆口？", opts: ["A. 炫耀", "B. 展示技術", "C. 洗錢"], correct: 1, exp: "證明熟能生巧。" }, 3: { level: "🔥 挑戰", q: "賣油翁崇拜陳？", opts: ["A. 對", "B. 錯", "C. 無法判斷"], correct: 1, exp: "他只覺得是手熟。" } }; function loadReadingQuiz(level) { const container = document.getElementById('reading-quiz-container'); const q = readingQuestions[level]; container.innerHTML = `<div style="background: #fff; padding: 20px; border-radius: 8px; border: 2px solid #1976d2;"><p style="color: #1976d2; font-weight: bold; margin-bottom: 10px;">${q.level}</p><p class="question">${q.q}</p><div class="options">${q.opts.map((opt, i) => `<button class="btn-option" style="padding: 10px;" onclick="checkReadingAnswer(this, ${i}, ${q.correct}, '${q.exp}')">${opt}</button>`).join('')}</div><div class="reading-feedback hidden" style="margin-top:15px; font-weight:bold;"></div></div>`; } function checkReadingAnswer(btn, clicked, correct, exp) { const parent = btn.parentElement; const feedback = parent.nextElementSibling; parent.querySelectorAll('.btn-option').forEach(b => b.disabled = true); feedback.classList.remove('hidden'); if(clicked === correct) { btn.style.backgroundColor = '#d4edda'; btn.style.borderColor = '#28a745'; feedback.style.color = '#155724'; feedback.innerHTML = `🎉 答對！解析：${exp} (+15分)`; addPoints(15); } else { btn.style.backgroundColor = '#f8d7da'; btn.style.borderColor = '#dc3545'; feedback.style.color = '#721c24'; feedback.innerHTML = `❌ 答錯！解析：${exp}`; } }

// ========================================================
// 4. 🌟 稱號背包與抽卡系統 🌟
// ========================================================
function drawGacha() { 
    if(!deductCoins(200)) return alert("💰 金幣不足 200 枚！"); 
    const res = document.getElementById('gacha-result'); 
    res.classList.remove('hidden'); res.className = 'feedback info'; res.innerHTML = "🎲 盲盒開啟中..."; 
    
    setTimeout(() => { 
        let r = Math.random() * 100; 
        let card = ""; let color = "";
        
        if (r < 1) { card = "【SP 傳說極罕】抵消現場紅牌 🛑"; color = "#d32f2f"; } 
        else if (r < 2) { card = "【SP 傳說極罕】獲綠色牌(與老師打球) 🍀"; color = "#4caf50"; } 
        else if (r < 5) { card = "【UR 極稀有】自選座位一天 / 點播歌曲 🎵"; color = "#9c27b0"; } 
        else if (r < 10) { card = "【SR 稀有】課堂「免答問題」豁免權 🤫"; color = "#ff9800"; } 
        else if (r < 15) { card = "【R 優良】課堂小懲罰豁免權 🛡️"; color = "#2196f3"; } 
        else { 
            const emojis = ["😎", "👻", "🔥", "✨", "👑", "👽", "💩", "🦄", "🐼", "🚀", "🌟", "💡", "🎯"];
            const gotEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            card = `【N 普通】專屬名稱 Emoji：${gotEmoji} <br><span style="font-size:1rem; color:#888;">(已存入您的稱號背包)</span>`; 
            color = "#757575";
            
            // 存入背包
            if(!userEmojis.includes(gotEmoji)) {
                userEmojis.push(gotEmoji);
                if(db) db.collection('users').doc(currentUser.uid).update({ emojis: userEmojis });
            }
            renderEmojiBackpack(); // 更新背包畫面
        }
        res.className = 'feedback success'; 
        res.innerHTML = `🎉 恭喜抽中：<br><br><span style="font-size:1.4rem; color:${color}; font-weight:bold;">${card}</span>`; 
    }, 1500); 
}

function renderEmojiBackpack() {
    const backpack = document.getElementById('emoji-backpack');
    if(!backpack) return;
    
    backpack.classList.remove('hidden'); // 顯示背包
    const list = document.getElementById('my-emoji-list');
    document.getElementById('current-equipped-emoji').innerText = equippedEmoji || "無";

    if(userEmojis.length === 0) {
        list.innerHTML = "<p style='font-size:1rem; color:#888;'>尚未收集到稱號，快去抽卡吧！</p>";
        return;
    }

    // 渲染擁有的 Emoji，如果正在裝備則加上紅色邊框
    list.innerHTML = userEmojis.map(e => `
        <span onclick="equipEmoji('${e}')" style="display:inline-block; border: 3px solid ${e === equippedEmoji ? '#d32f2f' : 'transparent'}; border-radius:12px; padding:8px; transition:0.2s; background:${e === equippedEmoji ? '#ffebee' : 'transparent'};">
            ${e}
        </span>
    `).join('');
}

function equipEmoji(emojiToEquip) {
    // 點擊已裝備的則卸下，否則裝備
    equippedEmoji = (equippedEmoji === emojiToEquip) ? "" : emojiToEquip;
    
    if(db) db.collection('users').doc(currentUser.uid).update({ equippedEmoji: equippedEmoji });
    
    updateScoreUI(); // 更新名字顯示
    renderEmojiBackpack(); // 更新背包邊框
    alert(equippedEmoji ? `✅ 已裝備稱號：${equippedEmoji}` : `✅ 已卸下稱號`);
}

function generateAI() { if(!deductCoins(10)) return alert("金幣不足 10 枚！"); const input = document.getElementById('ai-input').value.trim(); if(!input) return alert("請輸入文字！"); const res = document.getElementById('ai-result'); res.classList.remove('hidden'); res.className = 'feedback info'; res.innerHTML = "⏳ 魔法施展中..."; setTimeout(() => { res.className = 'feedback success'; res.innerHTML = `🎨 生成成功！<br><br><div style="font-size:6rem; margin:15px 0;">🤖</div><p style="font-weight:normal;">(未來接通 API)</p>`; }, 2000); }

// ========================================================
// 5. 雲端留言系統 (連線)
// ========================================================
let socialData = { 8: [], 9: [], 10: [] };

function loadSocialDataFromCloud() {
    if(!db) return;
    ['8', '9', '10'].forEach(id => {
        db.collection('wall_' + id).orderBy('timestampMs', id === '10' ? 'asc' : 'desc').onSnapshot((snapshot) => {
            socialData[id] = [];
            snapshot.forEach(doc => { let data = doc.data(); data.docId = doc.id; socialData[id].push(data); });
            renderSocial(); 
        });
    });
}

function renderSocial() {
    ['8', '9', '10'].forEach(id => {
        const wall = document.getElementById('wall-' + id);
        if(!wall) return;
        
        wall.innerHTML = socialData[id].map((item) => {
            const teacherBadge = item.teacherLiked ? `<span style="background:#ffecb3; color:#d84315; padding:2px 6px; border-radius:12px; font-size:0.8rem; margin-left:10px; font-weight:bold;">👨‍🏫 老師讚好</span>` : '';
            let actionBtns = "";
            const isAuthor = currentUser.uid === item.authorUid;
            const timePassed = Date.now() - (item.timestampMs || 0);
            
            if (isAuthor && timePassed <= 300000) { actionBtns += `<span style="cursor:pointer; margin-right:10px; color:#4facfe;" onclick="editPost('${id}', '${item.docId}', '${item.text}')">✏️修改</span>`; }
            if (isAuthor || currentUser.role === 'teacher') { actionBtns += `<span style="cursor:pointer; color:#dc3545;" onclick="deletePost('${id}', '${item.docId}')">🗑️刪除</span>`; }

            // 顯示留言時帶上 Emoji 稱號
            const emojiStr = item.nameEmoji ? item.nameEmoji + " " : "";

            return `
            <div class="memo-item" style="border-left-color: #4facfe; margin-bottom: 10px;">
                <p style="font-size:1.15rem; margin-bottom:8px;">${item.text} ${teacherBadge}</p>
                <div style="display:flex; justify-content:space-between; color:#888; font-size:0.9rem;">
                    <span>✍️ ${emojiStr}${item.name} <span style="margin-left:10px;">${actionBtns}</span></span>
                    ${id !== '10' ? `<span style="cursor:pointer;" onclick="likePost('${id}', '${item.docId}', '${item.authorUid}', ${item.likes || 0})">❤️ ${item.likes || 0}</span>` : ''}
                </div>
            </div>`;
        }).join('');
    });
}

function submitSocial(id) {
    if(!currentUser) return alert("請先登入！"); 
    const input = document.getElementById('input-' + id); const text = input.value.trim();
    if(text === "") return alert("請輸入內容！"); 
    
    const displayName = currentUser.role === 'teacher' ? `👑 ${currentUser.displayName}` : currentUser.displayName;
    
    // 把目前裝備的 Emoji 存入留言中
    const newPost = { name: displayName, nameEmoji: equippedEmoji, authorUid: currentUser.uid, text: text, likes: 0, teacherLiked: false, timestampMs: Date.now() };
    
    if(db) {
        db.collection('wall_' + id).add(newPost).then(() => {
            input.value = ""; const points = (id === 8) ? 10 : (id === 9 ? 15 : 20);
            addPoints(points); alert(`🎉 發佈成功！獲得 ${points} 積分/金幣！`);
        });
    }
}

function editPost(id, docId, oldText) { const newText = prompt("修改留言 (5分鐘內)：", oldText); if(newText && newText.trim() !== "" && newText !== oldText) db.collection('wall_' + id).doc(docId).update({ text: newText.trim() }); }
function deletePost(id, docId) { if(confirm("確定刪除嗎？")) db.collection('wall_' + id).doc(docId).delete(); }

function likePost(id, docId, authorUid, currentLikes) { 
    if(!currentUser) return; if(!db) return;
    const postRef = db.collection('wall_' + id).doc(docId); const authorRef = db.collection('users').doc(authorUid);
    if(currentUser.role === 'teacher') {
        postRef.update({ teacherLiked: true }).then(() => { authorRef.update({ score: firebase.firestore.FieldValue.increment(20), coins: firebase.firestore.FieldValue.increment(20) }); alert("👨‍🏫 已送出「老師讚好」！該同學將獲得 20 積分/金幣！"); });
    } else {
        postRef.update({ likes: currentLikes + 1 }).then(() => { authorRef.update({ score: firebase.firestore.FieldValue.increment(2), coins: firebase.firestore.FieldValue.increment(2) }); });
    }
}

function loadLeaderboard() {
    if(!db) return;
    db.collection('users').orderBy('score', 'desc').limit(20).onSnapshot((snapshot) => {
        const table = document.getElementById('global-leaderboard'); if(!table) return;
        let html = `<tr><th>排名</th><th>同學</th>${currentUser.role === 'teacher' ? '<th>電郵/帳號</th>' : ''}<th>積分</th></tr>`;
        let rank = 1;
        snapshot.forEach(doc => {
            const data = doc.data();
            const emailCol = currentUser.role === 'teacher' ? `<td>${data.email || '無'}</td>` : '';
            const isMe = data.email === currentUser.email ? 'background:#e3f2fd; font-weight:bold;' : '';
            // 排行榜顯示稱號
            const nameStr = (data.equippedEmoji ? data.equippedEmoji + " " : "") + data.name;
            html += `<tr style="${isMe}"><td>${rank}</td><td>${nameStr}</td>${emailCol}<td>${data.score}</td></tr>`;
            rank++;
        });
        table.innerHTML = html;
    });
}

function loadAdminDashboard() {
    if(!db || currentUser.role !== 'teacher') return;
    db.collection('users').orderBy('lastLogin', 'desc').onSnapshot((snapshot) => {
        const table = document.getElementById('admin-users-table'); if(!table) return;
        let html = `<tr><th>學生姓名</th><th>電郵/帳號</th><th>積分</th><th>金幣</th><th>最後登入時間</th></tr>`;
        snapshot.forEach(doc => { const data = doc.data(); html += `<tr><td>${data.name}</td><td>${data.email || '無'}</td><td>${data.score}</td><td>${data.coins || 0}</td><td>${data.lastLogin || '未記錄'}</td></tr>`; });
        table.innerHTML = html;
    });
}
