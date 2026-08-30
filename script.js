// ========================================================
// 1. FIREBASE 初始化 & 絕對安全帳號認證
// ========================================================
const firebaseConfig = { apiKey: "AIzaSyBXTjkrXmiLhp64MSBU1Ai5Iiv1EJfwA3I", authDomain: "ctm-game.firebaseapp.com", projectId: "ctm-game", storageBucket: "ctm-game.firebasestorage.app", messagingSenderId: "204941638255", appId: "1:204941638255:web:f23470bb681e9dac6eeb9a" };
let currentUser = null; let memos = []; let userScore = 0; let userCoins = 0; let weeklyScore = 0; let db = null;
let userEmojis = []; let equippedEmoji = ""; let userItems = []; let userBags = []; 
let engineStarted = false; // 控制物理引擎只啟動一次

// 🔒 白名單帳號與高強度密碼 (11組)
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

function getWeekNumber(d) { d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7)); var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1)); return Math.ceil((((d - yearStart) / 86400000) + 1)/7); }

try { firebase.initializeApp(firebaseConfig); db = firebase.firestore(); 
    firebase.auth().onAuthStateChanged((user) => {
        if (user) { const role = (user.email === 'ctmlwsss@gmail.com') ? 'teacher' : 'student'; handleLoginSuccess({ displayName: user.displayName, email: user.email, uid: user.uid, role: role }); } 
        else { checkManualLogin(); }
    });
} catch (error) { checkManualLogin(); }

function checkManualLogin() { const saved = sessionStorage.getItem('manualUser'); if (saved) { handleLoginSuccess(JSON.parse(saved)); } }
function loginWithGoogle() { try { const provider = new firebase.auth.GoogleAuthProvider(); firebase.auth().languageCode = 'zh-HK'; firebase.auth().signInWithPopup(provider).catch(() => alert("Google 登入遭拒")); } catch (e) { alert("請使用手動登入！"); } }

function loginManually() {
    const username = document.getElementById('username-input').value.trim();
    const password = document.getElementById('password-input').value.trim();
    
    // 🔒 嚴格驗證機制
    if (secureAccounts[username] && secureAccounts[username].pwd === password) {
        const userObj = { displayName: secureAccounts[username].name, email: username+"@local", uid: username, role: secureAccounts[username].role }; 
        sessionStorage.setItem('manualUser', JSON.stringify(userObj)); 
        handleLoginSuccess(userObj);
    } else { 
        alert("❌ 帳號或密碼錯誤！請聯絡老師。"); 
    }
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
                userEmojis = data.emojis || []; equippedEmoji = data.equippedEmoji || ""; userItems = data.items || []; userBags = data.bags || [];
                if(data.lastWeek !== currentWeek) { weeklyScore = 0; userRef.update({ weeklyScore: 0, lastWeek: currentWeek }); }
                if(user.role === 'teacher') { userScore = 99999; userCoins = 99999; } else { userRef.update({ lastLogin: new Date().toLocaleString() }); }
            } else {
                userScore = user.role === 'teacher' ? 99999 : 0; userCoins = user.role === 'teacher' ? 99999 : 0; weeklyScore = 0; userBags = [];
                if(user.role !== 'teacher') { userRef.set({ name: user.displayName, email: user.email, score: 0, coins: 0, weeklyScore: 0, lastWeek: currentWeek, emojis: [], equippedEmoji: "", items: [], bags: [], role: user.role, lastLogin: new Date().toLocaleString() }); }
            }
            updateScoreUI(); renderInventory();
        });
    }
    loadMemos(user.uid); renderQuizzes(); initMatchGame(); initBossGame(); loadSocialDataFromCloud(); loadLeaderboard(); setupSandbox();
    
    // 確保閱讀區文字正確載入
    document.getElementById('reading-title').innerText = articles[0].title;
    document.getElementById('reading-text').innerHTML = articles[0].text;
}

function logout() { try { firebase.auth().signOut(); } catch(e) {} sessionStorage.removeItem('manualUser'); window.location.reload(); }
function toggleSidebar() { document.querySelector('.sidebar').classList.toggle('open'); document.getElementById('sidebar-overlay').classList.toggle('active'); }
function switchTab(tabId, event) { 
    document.querySelectorAll('.module').forEach(mod => mod.classList.remove('active')); document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active')); 
    const target = document.getElementById(tabId); if(target) target.classList.add('active'); if(event) event.target.classList.add('active'); 
    if(window.innerWidth <= 768) { document.querySelector('.sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('active'); } 
    if(tabId === 'feature-reading') startReadingTimer();
    if(tabId === 'feature-13') setTimeout(initPhysicsEngine, 500); // 切換到背包時載入物理引擎
}

// ========================================================
// 2. 🐉 99級 靈獸指數進化系統
// ========================================================
const adjs = ["初學", "勤奮", "靈動", "通達", "睿智", "超凡", "入聖", "登峰", "造極", "宇宙"];
const nouns = ["書童", "青苗", "行者", "精靈", "大師", "宗師", "泰斗", "飛龍", "神獸", "霸主"];

function getPetInfo(score) {
    if(score >= 99999) return { lv: 99, name: "🌟 中文宇宙真神", emoji: "👑", nextScore: 99999 };
    
    // 指數公式：Lv = √(Score / 20) + 1
    // 換算所需積分：Score = 20 * (Lv - 1)^2
    let lv = Math.floor(Math.sqrt(score / 20)) + 1;
    if (lv > 99) lv = 99;
    
    let nextScore = 20 * Math.pow(lv, 2); 
    
    let emoji = '🌱';
    if(lv >= 10) emoji = '🌿'; if(lv >= 20) emoji = '📚'; if(lv >= 30) emoji = '✍️';
    if(lv >= 40) emoji = '🖋️'; if(lv >= 50) emoji = '🦄'; if(lv >= 60) emoji = '🦅';
    if(lv >= 70) emoji = '🎓'; if(lv >= 80) emoji = '📜'; if(lv >= 90) emoji = '🐉';
    
    let prefix = adjs[Math.floor((lv-1)/10)];
    let suffix = nouns[Math.floor((lv-1)/10)];
    
    return { lv, name: prefix + suffix, emoji, nextScore };
}

function addPoints(points) { if(currentUser.role === 'teacher') return; userScore += points; userCoins += points; weeklyScore += points; if(db) db.collection('users').doc(currentUser.uid).update({ score: userScore, coins: userCoins, weeklyScore: weeklyScore }); updateScoreUI(); }
function deductCoins(amount) { if(currentUser.role === 'teacher') return true; if(userCoins < amount) return false; userCoins -= amount; if(db) db.collection('users').doc(currentUser.uid).update({ coins: userCoins }); updateScoreUI(); return true; }
function updateScoreUI() { 
    document.getElementById('score').innerText = userScore; document.getElementById('coins').innerText = userCoins;
    const pet = getPetInfo(userScore); const levelText = `${pet.name} (Lv.${pet.lv})`; 
    document.getElementById('pet-avatar').innerText = pet.emoji; document.getElementById('pet-level').innerText = levelText; 
    const bigPet = document.getElementById('big-pet-emoji'); 
    if(bigPet) { 
        bigPet.innerText = pet.emoji; document.getElementById('big-pet-name').innerText = levelText; 
        document.getElementById('next-level-req').innerText = (pet.nextScore - userScore > 0) ? (pet.nextScore - userScore) : 0;
    } 
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

// ========================================================
// 3. 散文閱讀 (輪換與 30秒計時)
// ========================================================
let readingTimer; let readingTime = 0; let dailyReadPoints = 0;
const articles = [
    { title: "《秋天的懷念》 (史鐵生)", text: "雙腿癱瘓後，我的脾氣變得暴怒無常。望著天上北歸的雁陣，我會突然把面前的玻璃砸碎；聽著李谷一甜美的歌聲，我會猛地把手邊的東西摔向四周的牆壁。母親就悄悄地躲出去，在我看不見的地方偷偷地聽著我的動靜。當一切恢復沉寂，她又悄悄地進來，眼邊紅紅的，看著我。<br><br>「聽說北海的花兒都開了，我推著你去走走。」她總是這麼說。母親喜歡花，可自從我的腿癱瘓後，她侍弄的那些花都死了。「不，我不去！」我狠命地捶打這兩條可恨的腿，喊著：「我活著有什麼勁！」母親撲過來抓住我的手，忍住哭聲說：「咱娘兒倆在一塊兒，好好兒活，好好兒活……」<br><br>那天我又獨自坐在屋裡，看著窗外的樹葉唰唰啦啦地飄落。母親進來了，擋在窗前：「北海的菊花開了，我推著你去看看吧。」她憔悴的臉上現出央求般的神色。「什麼時候？」「你要是願意，就明天?」她說。我的回答已經讓她喜出望外了。「好吧，就明天。」我說。她高興得一會兒坐下，一會兒站起：「那就趕緊準備準備。」「哎呀，煩不煩？幾步路，有什麼好準備的！」她也笑了，坐在我身邊，絮絮叨叨地說著：「看完菊花，咱們就去『仿膳』，你小時候最愛吃那兒的豌豆黃兒。還記得那回我帶你去北海嗎？你偏說那楊樹花是毛毛蟲，跑著，一腳踩扁一個……」她忽然不說了。對於「跑」和「踩」一類的字眼兒，她比我還敏感。她又悄悄地出去了。<br><br>她出去了，就再也沒回來。鄰居們把她抬上車時，她還在大口大口地吐著鮮血。我沒想到她已經病成那樣。看著三輪車遠去，也絕沒有想到那竟是永遠的訣別。<br><br>又是秋天，妹妹推著我去北海看了菊花。黃色的花淡雅，白色的花高潔，紫紅色的花熱烈而深沉，潑潑灑灑，秋風中正開得爛漫。我懂得母親沒有說完的話。妹妹也懂。我倆在一塊兒，要好好兒活……" },
    { title: "《匆匆》 (朱自清)", text: "燕子去了，有再來的時候；楊柳枯了，有再青的時候；桃花謝了，有再開的時候。但是，聰明的，你告訴我，我們的日子為什麼一去不復返呢？——是有人偷了他們罷：那是誰？又藏在何處呢？是他們自己逃走罷：現在又到了哪裡呢？<br><br>我不知道他們給了我多少日子；但我的手確乎是漸漸空虛了。在默默裡算著，八千多日子已經從我手中溜去；像針尖上一滴水滴在大海裡，我的日子滴在時間的流裡，沒有聲音，也沒有影子。我不禁頭涔涔而淚潸潸了。<br><br>去的儘管去了，來的儘管來著；去來的中間，又怎樣地匆匆呢？早上我起來的時候，小屋裡射進兩三方斜斜的太陽。太陽他有腳啊，輕輕悄悄地挪移了；我也茫茫然跟著旋轉。於是——洗手的時候，日子從水盆裡過去；吃飯的時候，日子從飯碗裡過去；默默時，便從凝然的雙眼前過去。我覺察他去的匆匆了，伸出手遮挽時，他又從遮挽著的手邊過去，天黑時，我躺在床上，他便伶伶俐俐地從我身上跨過，從我腳邊飛去了。等我睜開眼和太陽再見，這算又溜走了一日。" },
    { title: "《背影》節錄 (朱自清)", text: "我與父親不相見已有二年餘了，我最不能忘記的是他的背影。那年冬天，祖母死了，父親的差使也交卸了，正是禍不單行的日子，我從北京到徐州，打算跟著父親奔喪回家。到徐州見著父親，看見滿院狼藉的東西，又想起祖母，不禁簌簌地流下眼淚。父親說：「事已如此，不必難過，好在天無絕人之路！」<br><br>我們過了江，進了車站。我買票，他忙著照看行李。行李太多了，得向腳夫行些小費，纔可過去。他便又忙著和他們講價錢。我那時真是聰明過分，總覺他說話不大漂亮，非自己插嘴不可。但他終於講定了價錢；就送我上車。<br><br>我看見他戴著黑布小帽，穿著黑布大馬褂，深青布棉袍，蹣跚地走到鐵道邊，慢慢探身下去，尚不大難。可是他穿過鐵道，要爬上那邊月台，就不容易了。他用兩手攀著上面，兩腳再向上縮；他肥胖的身子向左微傾，顯出努力的樣子。這時我看見他的背影，我的淚很快地流下來了。" }
];
let currentArticleIndex = 0;

function nextArticle() {
    currentArticleIndex = (currentArticleIndex + 1) % articles.length;
    document.getElementById('reading-title').innerText = articles[currentArticleIndex].title;
    document.getElementById('reading-text').innerHTML = articles[currentArticleIndex].text;
    startReadingTimer(); 
}

function startReadingTimer() {
    clearInterval(readingTimer); readingTime = 0;
    const btn = document.getElementById('btn-claim-reading'); if(!btn) return;
    btn.disabled = true; btn.style.background = "#ccc"; btn.innerText = "⏳ 閱讀 30 秒後領取";
    const today = new Date().toLocaleDateString();
    const savedDaily = localStorage.getItem(`readPoints_${currentUser.uid}_${today}`);
    dailyReadPoints = savedDaily ? parseInt(savedDaily) : 0;
    if(dailyReadPoints >= 50) { btn.innerText = "今日閱讀獎勵已達上限 (50/50)"; return; }

    readingTimer = setInterval(() => {
        readingTime++;
        if(readingTime >= 30) {
            clearInterval(readingTimer);
            btn.disabled = false; btn.style.background = "#4caf50"; btn.innerText = "💰 領取 10 積分/金幣";
        } else { btn.innerText = `⏳ 閱讀中... (${30 - readingTime}s)`; }
    }, 1000);
}

function claimReadingPoints() {
    addPoints(10); dailyReadPoints += 10;
    localStorage.setItem(`readPoints_${currentUser.uid}_${new Date().toLocaleDateString()}`, dailyReadPoints);
    const btn = document.getElementById('btn-claim-reading');
    btn.disabled = true; btn.style.background = "#ccc"; btn.innerText = "✅ 已領取！請換下一篇";
}

// ========================================================
// 4. 動態題庫引擎 (每日任務完成提示 + 引號處理)
// ========================================================
const idiomsData = [{ question: "【炙手可熱】正確的用法是？", options: ["A. 外面「炙手可熱」", "B. 手機「炙手可熱」", "C. 門票「炙手可熱」", "D. 丞相「炙手可熱」"], correctIndex: 3, explanation: "比喻權勢大，貶義。" }]; 
const grammarData = [{ question: "修正：「由於暴雨，使到發生水浸。」", options: ["A. 刪去「由於」或「使到」", "B. 「發生」不能配「水浸」", "C. 「嚴重」和「水浸」重複", "D. 「暴雨」不會導致「水浸」"], correctIndex: 0, explanation: "濫用介詞導致無主語。" }]; 
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
    { question: "《微笑以對》立意最深刻？", options: ["A. 失敗後，我決定在大家面前勉強擠出一個微笑，掩飾悲傷。", "B. 只要我們保持微笑，這世界上的所有問題都會自動解決。", "C. 經歷挫折後，內心真正釋懷，以豁達的微笑去面對未來。", "D. 看到路人對我微笑覺得很溫暖，我決定每天對同學微笑。"], correctIndex: 2, explanation: "C 將『微笑動作』昇華為『豁達的人生態度』，立意最高。" },
    { question: "《一場誤會》立意最深刻？", options: ["A. 誤會同學偷筆，後來發現掉在地上，知道不能隨便亂怪人。", "B. 誤會媽媽偏心，後來得知她用心良苦，學會體諒與溝通。", "C. 買東西找錯錢產生誤會，店員道歉後，說明做人要誠實。", "D. 因刻板印象對群體產生誤會，深入了解後反思社會標籤。"], correctIndex: 3, explanation: "D 將個人小事昇華為社會層面的反思，展現考生的宏觀視野。" }
]; 
const materialData = [
    { question: "《重遊舊地》想表達「物是人非」？", options: ["A. 公園設施全部翻新了，生鏽鞦韆換成了繽紛的滑梯。", "B. 舊居風景美麗如畫，果樹結滿果實，回憶瞬間湧現。", "C. 舊招牌被拆，熟悉的雜貨店老闆黯然結業，人情味蕩然無存。", "D. 巧遇多年不見的小學同學和班主任，大家開心地敘舊。"], correctIndex: 2, explanation: "要寫出『唏噓』必須有強烈對比與失落感。C 的細節最觸動人心。" }
]; 
const logicData = [
    { question: "論點：「逆境激發潛能」。論據：「司馬遷」。", options: ["A. 他是偉大的歷史學家，我們應該學習他在逆境中讀歷史。", "B. 如果他沒有受刑，就不會寫史記。每個人都要經歷殘酷才能成功。", "C. 遭遇極大挫折，但他將悲憤化為寫作動力，證明逆境能激發潛能。", "D. 雖然遭遇不幸，但依然熱愛生活，告訴我們逆境也要保持愉快。"], correctIndex: 2, explanation: "論證必須連接論點和論據。C 完美解釋了『逆境』如何轉化為『潛能』。" }
];

function renderQuizzes() { 
    // 日更題
    renderDailyQuiz('quiz-container-1', idiomsData, 'normal'); 
    renderDailyQuiz('quiz-container-2a', grammarData, 'normal'); 
    renderDailyQuiz('quiz-container-2b', typoData, 'normal'); 
    
    // 無限題
    renderInfiniteQuiz('quiz-container-3', memeData, 'normal', true); 
    renderInfiniteQuiz('quiz-container-6', ancientModernData, 'normal'); 
    renderInfiniteQuiz('quiz-container-16', themeData, 'suggested'); 
    renderInfiniteQuiz('quiz-container-17', materialData, 'suggested'); 
    renderInfiniteQuiz('quiz-container-18', logicData, 'suggested'); 
}

function renderDailyQuiz(containerId, dataArray, type = 'normal', isMeme = false) { 
    const container = document.getElementById(containerId); if(!container) return; 
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const q = dataArray[dayOfYear % dataArray.length];
    const memeHtml = isMeme && q.emoji ? `<div style="font-size: 4rem; text-align: center; margin-bottom: 10px;">${q.emoji}</div>` : ''; 
    container.innerHTML = `<div class="card" style="margin-bottom: 20px;">${memeHtml}<p class="question"><strong>📅 今日挑戰：</strong>${q.question}</p><div class="options">${q.options.map((opt, i) => `<button class="btn-option" style="line-height:1.6;" onclick="checkStaticAnswer(this, ${i}, ${q.correctIndex}, '${q.explanation}', '${type}', false, '${q.question.substring(0,20)}')">${opt}</button>`).join('')}</div><div class="feedback hidden" style="margin-top:15px;"></div></div>`; 
}

function renderInfiniteQuiz(containerId, dataArray, type = 'normal', isMeme = false) {
    const container = document.getElementById(containerId); if(!container) return;
    const qIndex = Math.floor(Math.random() * dataArray.length);
    const q = dataArray[qIndex];
    const memeHtml = isMeme && q.emoji ? `<div style="font-size: 4rem; text-align: center; margin-bottom: 10px;">${q.emoji}</div>` : ''; 
    container.innerHTML = `<div class="card" style="margin-bottom: 20px;">${memeHtml}<p class="question">${q.question}</p><div class="options">${q.options.map((opt, i) => `<button class="btn-option" style="line-height:1.6;" onclick="checkStaticAnswer(this, ${i}, ${q.correctIndex}, '${q.explanation}', '${type}', true, '${containerId}', 'dataArray')">${opt}</button>`).join('')}</div><div class="feedback hidden" style="margin-top:15px;"></div></div>`; 
}

function logWrongAnswer(questionText) {
    if(!db || currentUser.role === 'teacher') return;
    db.collection('error_stats').where('q', '==', questionText).get().then(snap => {
        if(snap.empty) { db.collection('error_stats').add({ q: questionText, count: 1 }); }
        else { snap.docs[0].ref.update({ count: firebase.firestore.FieldValue.increment(1) }); }
    });
}

function checkStaticAnswer(btn, clickedIndex, correctIndex, explanation, type, isInfinite = false, questionText = "") { 
    const parent = btn.parentElement; const feedback = parent.nextElementSibling; const allButtons = parent.querySelectorAll('.btn-option'); 
    allButtons.forEach(b => b.disabled = true); feedback.classList.remove('hidden'); 
    const labelText = type === 'suggested' ? '💡 建議答案' : '✅ 正確答案'; 
    const nextBtnHtml = isInfinite ? `<br><br><button class="btn-primary" onclick="renderQuizzes()">做下一題 ➔</button>` : `<br><br><div style="padding:10px; background:#e3f2fd; color:#1976d2; border-radius:8px; text-align:center;">✅ 已經完成今天本部分任務，請明天再來！</div>`;

    if (clickedIndex === correctIndex) { 
        btn.style.backgroundColor = '#d4edda'; btn.style.borderColor = '#28a745'; 
        feedback.className = 'feedback success'; feedback.innerHTML = `🎉 選擇極佳！<br><br>💡 解析：${explanation}<br><br>🌟 獲得 20 積分/金幣！${nextBtnHtml}`; addPoints(20); 
    } else { 
        btn.style.backgroundColor = '#f8d7da'; btn.style.borderColor = '#dc3545'; 
        allButtons[correctIndex].style.backgroundColor = '#d4edda'; allButtons[correctIndex].style.borderColor = '#28a745'; allButtons[correctIndex].style.borderWidth = '2px'; 
        feedback.className = 'feedback error'; feedback.innerHTML = `❌ 稍嫌遜色！${labelText}是 <strong>${String.fromCharCode(65 + correctIndex)}</strong>。<br><br>💡 解析：${explanation} ${nextBtnHtml}`; 
        if(!isInfinite) logWrongAnswer(questionText);
    }
    if(!isInfinite) { parent.querySelector('.options').style.display = 'none'; }
}

const matchPairs = [ { ancient: "走", modern: "跑" }, { ancient: "妻子", modern: "妻子與兒女" }, { ancient: "去", modern: "離開" }, { ancient: "股", modern: "大腿" } ]; let selectedAncient = null; let matchedCount = 0; function initMatchGame() { const leftContainer = document.getElementById('match-left'); const rightContainer = document.getElementById('match-right'); if(!leftContainer) return; let ancients = [...matchPairs].sort(() => Math.random() - 0.5); let moderns = [...matchPairs].sort(() => Math.random() - 0.5); leftContainer.innerHTML = ancients.map((p, i) => `<button class="btn-option" id="ancient-${i}" onclick="selectAncient(${i}, '${p.ancient}')">${p.ancient}</button>`).join(''); rightContainer.innerHTML = moderns.map((p, i) => `<button class="btn-option" id="modern-${i}" onclick="selectModern(${i}, '${p.modern}')">${p.modern}</button>`).join(''); } function selectAncient(index, text) { document.querySelectorAll('#match-left .btn-option').forEach(b => b.style.borderColor = '#e0e0e0'); const btn = document.getElementById(`ancient-${index}`); if(!btn.disabled) { btn.style.borderColor = '#1976d2'; selectedAncient = { index, text, btn }; } } function selectModern(index, text) { if(!selectedAncient) return alert("請先點擊左側文字！"); const rightBtn = document.getElementById(`modern-${index}`); const correctPair = matchPairs.find(p => p.ancient === selectedAncient.text); if(correctPair.modern === text) { selectedAncient.btn.style.backgroundColor = '#d4edda'; selectedAncient.btn.disabled = true; rightBtn.style.backgroundColor = '#d4edda'; rightBtn.disabled = true; selectedAncient = null; matchedCount++; if(matchedCount === matchPairs.length) { const fb = document.getElementById('match-feedback'); fb.classList.remove('hidden'); fb.className = 'feedback success'; fb.innerHTML = "🎉 成功！獲得 30 積分！"; addPoints(30); } } else { rightBtn.style.backgroundColor = '#f8d7da'; setTimeout(() => { rightBtn.style.backgroundColor = 'white'; }, 800); } }
const bossQuestions = [ { q: "「輟耕<strong style='color:#d32f2f;'>之</strong>壟上」", options: ["A. 的", "B. 往", "C. 他"], correct: 1 }, { q: "「物外<strong style='color:#d32f2f;'>之</strong>趣」", options: ["A. 的", "B. 往", "C. 他"], correct: 0 }, { q: "「名<strong style='color:#d32f2f;'>之</strong>者誰」", options: ["A. 的", "B. 往", "C. 他"], correct: 2 } ]; let currentBossHp = 3; let currentBossQ = 0; function initBossGame() { if(!document.getElementById('boss-question')) return; if(currentBossQ < bossQuestions.length) { const q = bossQuestions[currentBossQ]; document.getElementById('boss-question').innerHTML = q.q; document.getElementById('boss-options').innerHTML = q.options.map((opt, i) => `<button class="btn-option" onclick="attackBoss(${i}, ${q.correct})">${opt}</button>`).join(''); } } function attackBoss(clicked, correct) { if(clicked === correct) { currentBossHp--; document.getElementById('boss-hp').style.width = (currentBossHp / 3 * 100) + "%"; currentBossQ++; if(currentBossHp === 0) { document.getElementById('boss-emoji').innerText = "💥"; document.getElementById('boss-question').innerText = "Boss 擊敗！"; document.getElementById('boss-options').innerHTML = ""; const fb = document.getElementById('boss-feedback'); fb.classList.remove('hidden'); fb.className = 'feedback success'; fb.innerHTML = "🎉 獲得 50 積分！"; addPoints(50); } else { alert("💥 攻擊成功！"); initBossGame(); } } else { alert("❌ 攻擊無效！"); } }
const readingQuestions = { 1: { level: "🌱 基礎", q: "「徐以杓酌油」的「徐」是？", opts: ["A. 慢慢", "B. 快速", "C. 姓氏"], correct: 0, exp: "解作慢慢地。", points: 10 }, 2: { level: "🌲 進階", q: "為何錢放葫蘆口？", opts: ["A. 炫耀", "B. 展示技術", "C. 洗錢"], correct: 1, exp: "證明熟能生巧。", points: 15 }, 3: { level: "🔥 挑戰", q: "【對/錯/無從判斷】賣油翁崇拜陳？", opts: ["A. 對", "B. 錯", "C. 無從判斷"], correct: 1, exp: "只覺得手熟。", points: 20 } }; 
function loadReadingQuiz(level) { const container = document.getElementById('reading-quiz-container'); const q = readingQuestions[level]; container.innerHTML = `<div style="background: #fff; padding: 20px; border-radius: 8px; border: 2px solid #1976d2;"><p style="color: #1976d2; font-weight: bold; margin-bottom: 10px;">${q.level} (+${q.points}分)</p><p class="question">${q.q}</p><div class="options">${q.opts.map((opt, i) => `<button class="btn-option" style="padding: 10px;" onclick="checkReadingAnswer(this, ${i}, ${q.correct}, '${q.exp}', ${q.points})">${opt}</button>`).join('')}</div><div class="reading-feedback hidden" style="margin-top:15px; font-weight:bold;"></div></div>`; } 
function checkReadingAnswer(btn, clicked, correct, exp, points) { const parent = btn.parentElement; const feedback = parent.nextElementSibling; parent.querySelectorAll('.btn-option').forEach(b => b.disabled = true); feedback.classList.remove('hidden'); if(clicked === correct) { btn.style.backgroundColor = '#d4edda'; btn.style.borderColor = '#28a745'; feedback.style.color = '#155724'; feedback.innerHTML = `🎉 答對！解析：${exp} (+${points}分)`; addPoints(points); } else { btn.style.backgroundColor = '#f8d7da'; btn.style.borderColor = '#dc3545'; feedback.style.color = '#721c24'; feedback.innerHTML = `❌ 答錯！解析：${exp}`; } }

// ========================================================
// 5. 🌟 沙盒盲改與社群系統 (老師可刪除 AI 畫廊)
// ========================================================
const sandboxQuestions = [ "將「風吹過樹梢」加入擬人法", "將「這間教室很小」加入誇張法", "將「媽媽看著我」加入細緻的神態描寫" ];
function setupSandbox() {
    const qSpan = document.getElementById('sandbox-daily-q'); if(!qSpan) return;
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    qSpan.innerText = sandboxQuestions[dayOfYear % sandboxQuestions.length];
}

let socialData = { 8: [], 9: [], 10: [], 11: [] };

function loadSocialDataFromCloud() {
    if(!db) return;
    ['8', '9', '10', '11'].forEach(id => {
        db.collection('wall_' + id).orderBy('timestampMs', id === '10' ? 'asc' : 'desc').limit(50).onSnapshot((snapshot) => {
            socialData[id] = [];
            snapshot.forEach(doc => { let data = doc.data(); data.docId = doc.id; socialData[id].push(data); });
            renderSocial(); 
        });
    });
}

function renderSocial() {
    ['8', '9', '10'].forEach(id => {
        const wall = document.getElementById('wall-' + id); if(!wall) return;
        wall.innerHTML = socialData[id].map((item) => {
            const teacherBadge = item.teacherLiked ? `<span style="background:#ffecb3; color:#d84315; padding:2px 6px; border-radius:12px; font-size:0.8rem; margin-left:10px; font-weight:bold;">👨‍🏫 老師讚好</span>` : '';
            let actionBtns = ""; const isAuthor = currentUser && currentUser.uid === item.authorUid; const isTeacher = currentUser && currentUser.role === 'teacher';
            const timePassed = Date.now() - (item.timestampMs || 0);
            if (isAuthor && timePassed <= 300000) { actionBtns += `<span style="cursor:pointer; margin-right:10px; color:#4facfe;" onclick="editPost('${id}', '${item.docId}', '${item.text}')">✏️修改</span>`; }
            if (isAuthor || isTeacher) { actionBtns += `<span style="cursor:pointer; color:#dc3545;" onclick="deletePost('${id}', '${item.docId}')">🗑️刪除</span>`; }
            const emojiStr = item.nameEmoji ? item.nameEmoji + " " : "";
            return `<div class="memo-item" style="border-left-color: #4facfe; margin-bottom: 10px;">
                <p style="font-size:1.15rem; margin-bottom:8px;">${item.text} ${teacherBadge}</p>
                <div style="display:flex; justify-content:space-between; color:#888; font-size:0.9rem;">
                    <span>✍️ ${emojiStr}${item.name} <span style="margin-left:10px;">${actionBtns}</span></span>
                    ${id !== '10' ? `<span style="cursor:pointer;" onclick="likePost('${id}', '${item.docId}', '${item.authorUid}', ${item.likes || 0})">❤️ ${item.likes || 0}</span>` : ''}
                </div>
            </div>`;
        }).join('');
    });

    const aiWall = document.getElementById('wall-11');
    if(aiWall) {
        aiWall.innerHTML = socialData['11'].map(item => {
            const isAuthor = currentUser && currentUser.uid === item.authorUid; const isTeacher = currentUser && currentUser.role === 'teacher';
            let delBtn = (isAuthor || isTeacher) ? `<span style="cursor:pointer; color:#dc3545;" onclick="deletePost('11', '${item.docId}')">🗑️刪除</span>` : '';
            return `
            <div style="width: 45%; min-width:250px; background: #fff; padding: 10px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                <img src="${item.imgUrl}" style="width: 100%; border-radius: 8px; margin-bottom: 10px;">
                <p style="font-size: 0.9rem; color: #555; margin-bottom: 5px;">"${item.text}"</p>
                <div style="font-size: 0.8rem; color: #888; display:flex; justify-content:space-between;">
                    <span>✍️ ${item.nameEmoji || ""}${item.name} <span style="margin-left:5px;">${delBtn}</span></span>
                    <span style="cursor:pointer;" onclick="likePost('11', '${item.docId}', '${item.authorUid}', ${item.likes || 0})">❤️ ${item.likes || 0}</span>
                </div>
            </div>`;
        }).join('');
    }
}

function submitSandbox() {
    if(!currentUser) return alert("請先登入！"); 
    const input = document.getElementById('input-9'); const text = input.value.trim(); if(text === "") return alert("請輸入內容！"); 
    document.getElementById('sandbox-lock').classList.add('hidden'); document.getElementById('wall-9').classList.remove('hidden');
    const displayName = currentUser.role === 'teacher' ? `👑 ${currentUser.displayName}` : currentUser.displayName;
    const newPost = { name: displayName, nameEmoji: equippedEmoji, authorUid: currentUser.uid, text: text, likes: 0, teacherLiked: false, timestampMs: Date.now() };
    if(db) { db.collection('wall_9').add(newPost).then(() => { input.value = ""; addPoints(15); alert(`🎉 成功解鎖觀摩區！`); }); }
}

function submitSocial(id) {
    if(!currentUser) return alert("請先登入！"); 
    const input = document.getElementById('input-' + id); const text = input.value.trim(); if(text === "") return alert("請輸入內容！"); 
    const displayName = currentUser.role === 'teacher' ? `👑 ${currentUser.displayName}` : currentUser.displayName;
    const newPost = { name: displayName, nameEmoji: equippedEmoji, authorUid: currentUser.uid, text: text, likes: 0, teacherLiked: false, timestampMs: Date.now() };
    if(db) { db.collection('wall_' + id).add(newPost).then(() => { input.value = ""; addPoints(20); alert(`🎉 發佈成功！`); }); }
}

function editPost(id, docId, oldText) { const newText = prompt("修改留言 (5分鐘內)：", oldText); if(newText && newText.trim() !== "" && newText !== oldText) { if(db) db.collection('wall_' + id).doc(docId).update({ text: newText.trim() }); } }
function deletePost(id, docId) { if(confirm("確定刪除嗎？")) { if(db) db.collection('wall_' + id).doc(docId).delete(); } }
function likePost(id, docId, authorUid, currentLikes) { 
    if(!currentUser || !db) return;
    const postRef = db.collection('wall_' + id).doc(docId); const authorRef = db.collection('users').doc(authorUid);
    if(currentUser.role === 'teacher') { postRef.update({ teacherLiked: true }).then(() => { authorRef.update({ score: firebase.firestore.FieldValue.increment(20), coins: firebase.firestore.FieldValue.increment(20) }); alert("已送出「老師讚好」！"); });
    } else { postRef.update({ likes: currentLikes + 1 }).then(() => { authorRef.update({ score: firebase.firestore.FieldValue.increment(2), coins: firebase.firestore.FieldValue.increment(2) }); }); }
}

// 🌟 真實 AI 畫圖 🌟
let lastAiText = ""; let lastAiUrl = "";
function generateRealAI() { 
    if(!deductCoins(100)) return alert("金幣不足 100 枚！"); 
    const input = document.getElementById('ai-input').value.trim(); 
    if(!input) return alert("請輸入文字！"); 
    const res = document.getElementById('ai-result'); 
    res.classList.remove('hidden'); res.className = 'feedback info'; res.innerHTML = "⏳ 魔法施展中，AI 正在繪製您的想像..."; 
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(input)}?width=512&height=512&nologo=true`;
    lastAiText = input; lastAiUrl = url;
    setTimeout(() => { 
        res.className = 'feedback success'; 
        res.innerHTML = `🎨 生成成功！<br><img src="${url}" style="width:100%; max-width:300px; border-radius:8px; margin-top:15px; box-shadow:0 4px 10px rgba(0,0,0,0.2);"/><br><button class="btn-primary" style="margin-top:15px; background:#4caf50;" onclick="shareToAIGallery()">將作品公開分享至畫廊</button>`; 
    }, 1500); 
}
function shareToAIGallery() {
    if(!currentUser || !db || !lastAiUrl) return;
    const displayName = currentUser.role === 'teacher' ? `👑 ${currentUser.displayName}` : currentUser.displayName;
    const newPost = { name: displayName, nameEmoji: equippedEmoji, authorUid: currentUser.uid, text: lastAiText, imgUrl: lastAiUrl, likes: 0, timestampMs: Date.now() };
    db.collection('wall_11').add(newPost).then(() => { alert("🎉 作品已發佈到畫廊！"); document.getElementById('ai-result').innerHTML = "✅ 已分享至畫廊"; });
}

// ========================================================
// 6. 🌟 Google Gravity 物理書包系統 🌟
// ========================================================
function drawGacha() { 
    if(!deductCoins(500)) return alert("💰 金幣不足 500 枚！"); 
    const res = document.getElementById('gacha-result'); 
    res.classList.remove('hidden'); res.className = 'feedback info'; res.innerHTML = "🎲 盲盒開啟中..."; 
    
    setTimeout(() => { 
        let r = Math.random() * 100; let card = ""; let color = ""; let isItem = true; let isBag = false; let bagEmoji = "";
        if (r < 1) { card = "【R級極罕】抵消現場紅牌 🛑"; color = "#d32f2f"; } 
        else if (r < 2) { card = "【R級極罕】獲綠色牌(與老師打球) 🍀"; color = "#4caf50"; } 
        else if (r < 5) { card = "【S級稀有】自選座位一天 🎵"; color = "#9c27b0"; } 
        else if (r < 10) { card = "【A 級】免答問題一次 🤫"; color = "#ff9800"; } 
        else if (r < 15) { card = "【A 級】小懲罰豁免權 🛡️"; color = "#2196f3"; } 
        else if (r < 55) { 
            isItem = false; isBag = true;
            const bags = ["🎒", "👜", "💼", "📘", "📓", "💧", "🖊️", "🖍️", "✏️", "📼", "📏"];
            bagEmoji = bags[Math.floor(Math.random() * bags.length)];
            card = `【B 級】物理書包裝備：${bagEmoji}`; color = "#00796b";
            userBags.push(bagEmoji); if(db && currentUser.role !== 'teacher') db.collection('users').doc(currentUser.uid).update({ bags: userBags });
        } else { 
            isItem = false;
            const emojis = ["😎", "👻", "🔥", "✨", "👑", "👽", "💩", "🦄", "🐼", "🚀", "🌟"];
            const gotEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            card = `【B 級】專屬名稱 Emoji：${gotEmoji}`; color = "#757575";
            if(!userEmojis.includes(gotEmoji)) { userEmojis.push(gotEmoji); if(db && currentUser.role !== 'teacher') db.collection('users').doc(currentUser.uid).update({ emojis: userEmojis }); }
        }

        if(isItem) { userItems.push(card); if(db && currentUser.role !== 'teacher') db.collection('users').doc(currentUser.uid).update({ items: userItems }); }
        
        res.className = 'feedback success'; 
        res.innerHTML = `🎉 恭喜抽中：<br><br><span style="font-size:1.4rem; color:${color}; font-weight:bold;">${card}</span>`; 
        
        renderInventory(); 
        if(isBag && engineStarted) { addPhysicsBody(bagEmoji); } // 如果抽到文具，直接掉進畫布裡！
    }, 1500); 
}

// 物理引擎初始化
let engine, render, runner, world;
function initPhysicsEngine() {
    if(engineStarted) return;
    const container = document.getElementById('physics-canvas-container');
    if(!container) return;
    
    engineStarted = true;
    engine = Matter.Engine.create(); world = engine.world;
    render = Matter.Render.create({
        element: container, engine: engine,
        options: { width: container.clientWidth, height: 300, wireframes: false, background: 'transparent' }
    });
    
    const ground = Matter.Bodies.rectangle(container.clientWidth/2, 310, container.clientWidth, 20, { isStatic: true, render: { fillStyle: 'transparent' } });
    const leftWall = Matter.Bodies.rectangle(-10, 150, 20, 300, { isStatic: true });
    const rightWall = Matter.Bodies.rectangle(container.clientWidth+10, 150, 20, 300, { isStatic: true });
    Matter.World.add(world, [ground, leftWall, rightWall]);
    
    // 讓滑鼠可以抓取物品
    const mouse = Matter.Mouse.create(render.canvas);
    const mouseConstraint = Matter.MouseConstraint.create(engine, { mouse: mouse, constraint: { stiffness: 0.2, render: { visible: false } } });
    Matter.World.add(world, mouseConstraint);
    render.mouse = mouse;
    
    Matter.Render.run(render); runner = Matter.Runner.create(); Matter.Runner.run(runner, engine);
    
    // 把背包裡的文具全部掉下來
    userBags.forEach(emoji => { setTimeout(() => { addPhysicsBody(emoji); }, Math.random()*1000); });
}

function addPhysicsBody(emoji) {
    const container = document.getElementById('physics-canvas-container');
    const x = Math.random() * (container.clientWidth - 50) + 25;
    const body = Matter.Bodies.rectangle(x, -50, 40, 40, { restitution: 0.8 }); // restitution=彈性
    Matter.World.add(world, body);
    
    // 建立一個 HTML 元素來蓋在剛體上面顯示 Emoji
    const el = document.createElement('div');
    el.className = 'physics-item'; el.innerText = emoji;
    container.appendChild(el);
    
    // 同步座標
    Matter.Events.on(engine, 'afterUpdate', function() {
        el.style.left = body.position.x + 'px';
        el.style.top = body.position.y + 'px';
        el.style.transform = `translate(-50%, -50%) rotate(${body.angle}rad)`;
    });
}

function renderInventory() {
    const container = document.getElementById('inventory-container'); if(!container) return; container.classList.remove('hidden');
    
    const itemList = document.getElementById('my-items-list');
    if(userItems.length === 0) { itemList.innerHTML = "<p style='color:#888;'>尚未獲得道具卡。</p>"; } 
    else { itemList.innerHTML = userItems.map((item, index) => `<div style="background:#fff; border:1px solid #ccc; padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;"><span style="font-weight:bold;">${item}</span><button style="background:#dc3545; color:white; border:none; padding:5px 15px; border-radius:5px; cursor:pointer;" onclick="redeemItem(${index}, '${item}')">核銷</button></div>`).join(''); }

    const emojiList = document.getElementById('my-emoji-list'); document.getElementById('current-equipped-emoji').innerText = equippedEmoji || "無";
    if(userEmojis.length === 0) { emojiList.innerHTML = "<p style='font-size:1rem; color:#888;'>尚未收集到稱號。</p>"; } 
    else { emojiList.innerHTML = userEmojis.map(e => `<span onclick="equipEmoji('${e}')" style="display:inline-block; border: 3px solid ${e === equippedEmoji ? '#d32f2f' : 'transparent'}; border-radius:12px; padding:8px; transition:0.2s; background:${e === equippedEmoji ? '#ffebee' : 'transparent'};">${e}</span>`).join(''); }
}

function equipEmoji(emojiToEquip) { equippedEmoji = (equippedEmoji === emojiToEquip) ? "" : emojiToEquip; if(db && currentUser.role !== 'teacher') db.collection('users').doc(currentUser.uid).update({ equippedEmoji: equippedEmoji }); updateScoreUI(); renderInventory(); alert(equippedEmoji ? `✅ 已裝備稱號：${equippedEmoji}` : `✅ 已卸下稱號`); }
function redeemItem(index, itemName) { if(confirm(`⚠️ 請務必在老師面前按下確認！\n\n確定現在兌換\n${itemName} 嗎？`)) { userItems.splice(index, 1); if(db && currentUser.role !== 'teacher') db.collection('users').doc(currentUser.uid).update({ items: userItems }); if(db) db.collection('redemptions').add({ name: currentUser.displayName, item: itemName, timeMs: Date.now(), time: new Date().toLocaleString() }); alert("✅ 兌換成功！已發送紀錄至老師後台。"); renderInventory(); } }

function loadLeaderboard() {
    if(!db) return;
    db.collection('users').where('role', '==', 'student').orderBy('weeklyScore', 'desc').limit(20).onSnapshot((snapshot) => {
        const table = document.getElementById('global-leaderboard'); if(!table) return;
        let html = `<tr><th>排名</th><th>同學</th><th style="color:#d84315;">本週積分</th><th>總積分</th></tr>`;
        let rank = 1;
        snapshot.forEach(doc => { const data = doc.data(); const isMe = currentUser && data.email === currentUser.email ? 'background:#e3f2fd; font-weight:bold;' : ''; const nameStr = (data.equippedEmoji ? data.equippedEmoji + " " : "") + data.name; html += `<tr style="${isMe}"><td>${rank}</td><td>${nameStr}</td><td style="color:#d84315; font-weight:bold;">${data.weeklyScore || 0}</td><td>${data.score}</td></tr>`; rank++; });
        table.innerHTML = html;
    });
}

function loadAdminDashboard() {
    if(!db || currentUser.role !== 'teacher') return;
    db.collection('users').where('role', '==', 'student').orderBy('lastLogin', 'desc').onSnapshot((snapshot) => {
        const table = document.getElementById('admin-users-table'); if(!table) return;
        let html = `<tr><th>學生姓名</th><th>帳號</th><th>本週積分</th><th>總積分</th><th>金幣</th><th>最後登入</th></tr>`;
        snapshot.forEach(doc => { const data = doc.data(); html += `<tr><td>${data.name}</td><td>${data.email || '無'}</td><td>${data.weeklyScore||0}</td><td>${data.score}</td><td>${data.coins || 0}</td><td>${data.lastLogin || '未記錄'}</td></tr>`; });
        table.innerHTML = html;
    });
    db.collection('redemptions').orderBy('timeMs', 'desc').limit(50).onSnapshot((snapshot) => {
        const logDiv = document.getElementById('admin-redemption-log'); if(!logDiv) return;
        let html = ""; snapshot.forEach(doc => { const data = doc.data(); html += `<div style="border-bottom: 1px solid #ccc; padding: 8px 0;"><span style="color:#d84315; font-weight:bold;">[${data.time}]</span> <strong>${data.name}</strong> 兌換了 <span style="color:#1976d2;">${data.item}</span></div>`; });
        logDiv.innerHTML = html || "<p style='color:#888;'>尚無紀錄。</p>";
    });
    db.collection('error_stats').orderBy('count', 'desc').limit(10).onSnapshot((snapshot) => {
        const errDiv = document.getElementById('admin-error-log'); if(!errDiv) return;
        let html = ""; snapshot.forEach(doc => { const data = doc.data(); html += `<li><strong style="color:#d32f2f;">錯 ${data.count} 次</strong>：${data.q}</li>`; });
        errDiv.innerHTML = html || "<p style='color:#888;'>太棒了！目前沒有學生答錯任何題目。</p>";
    });
}
