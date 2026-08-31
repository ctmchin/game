// ========================================================
// 1. FIREBASE 初始化 & 絕對安全帳號認證
// ========================================================
const firebaseConfig = { apiKey: "AIzaSyBXTjkrXmiLhp64MSBU1Ai5Iiv1EJfwA3I", authDomain: "ctm-game.firebaseapp.com", projectId: "ctm-game", storageBucket: "ctm-game.firebasestorage.app", messagingSenderId: "204941638255", appId: "1:204941638255:web:f23470bb681e9dac6eeb9a" };
let currentUser = null; let memos = []; let userScore = 0; let userCoins = 0; let weeklyScore = 0; let db = null;
let userEmojis = []; let equippedEmoji = ""; let userItems = []; let userBags = []; 
let engineStarted = false; let engine, render, runner, world;

// 🔒 11組嚴格白名單帳號
const secureAccounts = {
    "admin_ctm": { pwd: "K7m@P9q#", role: "teacher", name: "CTM 老師" },
    "stu01": { pwd: "x4V!n8B", role: "student", name: "學生 01" }, "stu02": { pwd: "m2C@z9L", role: "student", name: "學生 02" },
    "stu03": { pwd: "p5R#k3W", role: "student", name: "學生 03" }, "stu04": { pwd: "t8J$y2N", role: "student", name: "學生 04" },
    "stu05": { pwd: "h3F%d7X", role: "student", name: "學生 05" }, "stu06": { pwd: "q9M^b4C", role: "student", name: "學生 06" },
    "stu07": { pwd: "q9M^b4C", role: "student", name: "學生 07" }, "stu08": { pwd: "q9M^b4C", role: "student", name: "學生 08" },
    "stu09": { pwd: "q9M^b4C", role: "student", name: "學生 09" }, "stu10": { pwd: "q9M^b4C", role: "student", name: "學生 10" }
};

function getWeekNumber(d) { d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7)); var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1)); return Math.ceil((((d - yearStart) / 86400000) + 1)/7); }

try { firebase.initializeApp(firebaseConfig); db = firebase.firestore(); 
    firebase.auth().onAuthStateChanged((user) => { if (user) { handleLoginSuccess({ displayName: user.displayName, email: user.email, uid: user.uid, role: 'teacher' }); } else { checkManualLogin(); } });
} catch (error) { checkManualLogin(); }

function checkManualLogin() { const saved = sessionStorage.getItem('manualUser'); if (saved) { handleLoginSuccess(JSON.parse(saved)); } }
function loginWithGoogle() { try { const provider = new firebase.auth.GoogleAuthProvider(); firebase.auth().languageCode = 'zh-HK'; firebase.auth().signInWithPopup(provider).catch(()=>alert("維護中，請用手動登入")); } catch (e) { alert("請使用手動登入！"); } }

function loginManually() {
    const username = document.getElementById('username-input').value.trim();
    const password = document.getElementById('password-input').value.trim();
    if (secureAccounts[username] && secureAccounts[username].pwd === password) {
        const userObj = { displayName: secureAccounts[username].name, email: username+"@local", uid: username, role: secureAccounts[username].role }; 
        sessionStorage.setItem('manualUser', JSON.stringify(userObj)); handleLoginSuccess(userObj);
    } else { alert("❌ 帳號或密碼錯誤！"); }
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
            updateScoreUI(); renderInventory(); renderLevelTable();
        });
    }
    loadMemos(user.uid); renderQuizzes(); initMatchGame(); initBossGame(); loadSocialDataFromCloud(); loadLeaderboard(); setupSandbox();
    document.getElementById('reading-title').innerText = articles[0].title; document.getElementById('reading-text').innerHTML = articles[0].text;
}

function logout() { try { firebase.auth().signOut(); } catch(e) {} sessionStorage.removeItem('manualUser'); window.location.reload(); }
function toggleSidebar() { document.querySelector('.sidebar').classList.toggle('open'); document.getElementById('sidebar-overlay').classList.toggle('active'); }
function switchTab(tabId, event) { 
    document.querySelectorAll('.module').forEach(mod => mod.classList.remove('active')); document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active')); 
    const target = document.getElementById(tabId); if(target) target.classList.add('active'); if(event) event.target.classList.add('active'); 
    if(window.innerWidth <= 768) { document.querySelector('.sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('active'); } 
    if(tabId === 'feature-reading') startReadingTimer();
    if(tabId === 'feature-13') setTimeout(initPhysicsEngine, 500); 
}

// ========================================================
// 2. 🐉 100級 指數動態稱號系統
// ========================================================
const prefixes = ["見習", "尚學", "勤奮", "通達", "睿智", "超凡", "入聖", "登峰", "造極", "傳說"];
const nouns = ["書童", "墨客", "秀才", "舉人", "探花", "榜眼", "狀元", "大師", "宗師", "泰斗"];

function getPetInfo(score) {
    if(score >= 99999) return { lv: 100, name: "🌟 中文宇宙真神", emoji: "👑", nextScore: 99999 };
    // 公式: Lv = √(Score/20) + 1。逆推: Score = 20 * (Lv-1)^2
    let lv = Math.floor(Math.sqrt(score / 20)) + 1; if (lv > 99) lv = 99;
    let nextScore = 20 * Math.pow(lv, 2); 
    
    let emoji = '🌱';
    if(lv >= 10) emoji = '🌿'; if(lv >= 20) emoji = '📚'; if(lv >= 30) emoji = '✍️'; if(lv >= 40) emoji = '🖋️'; 
    if(lv >= 50) emoji = '🦄'; if(lv >= 60) emoji = '🦅'; if(lv >= 70) emoji = '🎓'; if(lv >= 80) emoji = '📜'; if(lv >= 90) emoji = '🐉';
    
    let name = prefixes[Math.floor((lv-1)/10)] + nouns[(lv-1)%10];
    return { lv, name, emoji, nextScore };
}

function renderLevelTable() {
    const tbody = document.getElementById('level-table-body'); if(!tbody) return;
    let html = "";
    for(let i=1; i<=99; i++) {
        let name = prefixes[Math.floor((i-1)/10)] + nouns[(i-1)%10];
        let reqScore = 20 * Math.pow(i-1, 2);
        html += `<tr><td>Lv.${i}</td><td>${name}</td><td>${reqScore}</td></tr>`;
    }
    tbody.innerHTML = html;
}

function addPoints(points) { if(currentUser.role === 'teacher') return; userScore += points; userCoins += points; weeklyScore += points; if(db) db.collection('users').doc(currentUser.uid).update({ score: userScore, coins: userCoins, weeklyScore: weeklyScore }); updateScoreUI(); }
function deductCoins(amount) { if(currentUser.role === 'teacher') return true; if(userCoins < amount) return false; userCoins -= amount; if(db) db.collection('users').doc(currentUser.uid).update({ coins: userCoins }); updateScoreUI(); return true; }
function updateScoreUI() { 
    document.getElementById('score').innerText = userScore; document.getElementById('coins').innerText = userCoins;
    const pet = getPetInfo(userScore); const levelText = `${pet.name} (Lv.${pet.lv})`; 
    document.getElementById('pet-avatar').innerText = pet.emoji; document.getElementById('pet-level').innerText = levelText; 
    const bigPet = document.getElementById('big-pet-emoji'); 
    if(bigPet) { bigPet.innerText = pet.emoji; document.getElementById('big-pet-name').innerText = levelText; document.getElementById('next-level-req').innerText = (pet.nextScore - userScore > 0) ? (pet.nextScore - userScore) : 0; } 
    const displayNameWithEmoji = (equippedEmoji ? equippedEmoji + " " : "") + currentUser.displayName;
    document.getElementById('user-display-name').innerText = displayNameWithEmoji;
}

// 螢光筆
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
    { title: "《秋天的懷念》 (史鐵生)", text: "雙腿癱瘓後，我的脾氣變得暴怒無常。望著天上北歸的雁陣，我會突然把面前的玻璃砸碎；聽著李谷一甜美的歌聲，我會猛地把手邊的東西摔向四周的牆壁。母親就悄悄地躲出去，在我看不見的地方偷偷地聽著我的動靜。<br><br>「聽說北海的花兒都開了，我推著你去走走。」她總是這麼說。母親喜歡花，可自從我的腿癱瘓後，她侍弄的那些花都死了。「不，我不去！」我狠命地捶打這兩條可恨的腿，喊著：「我活著有什麼勁！」母親撲過來抓住我的手，忍住哭聲說：「咱娘兒倆在一塊兒，好好兒活，好好兒活……」<br><br>那天我又獨自坐在屋裡，看著窗外的樹葉唰唰啦啦地飄落。母親進來了，擋在窗前：「北海的菊花開了，我推著你去看看吧。」她憔悴的臉上現出央求般的神色。「什麼時候？」「你要是願意，就明天?」她說。我的回答已經讓她喜出望外了。「好吧，就明天。」我說。她高興得一會兒坐下，一會兒站起：「那就趕緊準備準備。」「哎呀，煩不煩？幾步路，有什麼好準備的！」她也笑了，坐在我身邊，絮絮叨叨地說著：「看完菊花，咱們就去『仿膳』，你小時候最愛吃那兒的豌豆黃兒。還記得那回我帶你去北海嗎？你偏說那楊樹花是毛毛蟲，跑著，一腳踩扁一個……」她忽然不說了。對於「跑」和「踩」一類的字眼兒，她比我還敏感。她又悄悄地出去了。<br><br>她出去了，就再也沒回來。鄰居們把她抬上車時，她還在大口大口地吐著鮮血。我沒想到她已經病成那樣。看著三輪車遠去，也絕沒有想到那竟是永遠的訣別。<br><br>又是秋天，妹妹推著我去北海看了菊花。黃色的花淡雅，白色的花高潔，紫紅色的花熱烈而深沉，潑潑灑灑，秋風中正開得爛漫。我懂得母親沒有說完的話。妹妹也懂。我倆在一塊兒，要好好兒活……" },
    { title: "《匆匆》 (朱自清)", text: "燕子去了，有再來的時候；楊柳枯了，有再青的時候；桃花謝了，有再開的時候。但是，聰明的，你告訴我，我們的日子為什麼一去不復返呢？——是有人偷了他們罷：那是誰？又藏在何處呢？是他們自己逃走罷：現在又到了哪裡呢？<br><br>我不知道他們給了我多少日子；但我的手確乎是漸漸空虛了。在默默裡算著，八千多日子已經從我手中溜去；像針尖上一滴水滴在大海裡，我的日子滴在時間的流裡，沒有聲音，也沒有影子。我不禁頭涔涔而淚潸潸了。<br><br>去的儘管去了，來的儘管來著；去來的中間，又怎樣地匆匆呢？早上我起來的時候，小屋裡射進兩三方斜斜的太陽。太陽他有腳啊，輕輕悄悄地挪移了；我也茫茫然跟著旋轉。於是——洗手的時候，日子從水盆裡過去；吃飯的時候，日子從飯碗裡過去；默默時，便從凝然的雙眼前過去。我覺察他去的匆匆了，伸出手遮挽時，他又從遮挽著的手邊過去，天黑時，我躺在床上，他便伶伶俐俐地從我身上跨過，從我腳邊飛去了。等我睜開眼和太陽再見，這算又溜走了一日。" },
    { title: "《背影》節錄 (朱自清)", text: "我與父親不相見已有二年餘了，我最不能忘記的是他的背影。那年冬天，祖母死了，父親的差使也交卸了，正是禍不單行的日子，我從北京到徐州，打算跟著父親奔喪回家。到徐州見著父親，看見滿院狼藉的東西，又想起祖母，不禁簌簌地流下眼淚。父親說：「事已如此，不必難過，好在天無絕人之路！」<br><br>我們過了江，進了車站。我買票，他忙著照看行李。行李太多了，得向腳夫行些小費，纔可過去。他便又忙著和他們講價錢。我那時真是聰明過分，總覺他說話不大漂亮，非自己插嘴不可。但他終於講定了價錢；就送我上車。<br><br>我看見他戴著黑布小帽，穿著黑布大馬褂，深青布棉袍，蹣跚地走到鐵道邊，慢慢探身下去，尚不大難。可是他穿過鐵道，要爬上那邊月台，就不容易了。他用兩手攀著上面，兩腳再向上縮；他肥胖的身子向左微傾，顯出努力的樣子。這時我看見他的背影，我的淚很快地流下來了。" }
];

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
// 4. 題庫引擎 (加上引號與任務完成提示)
// ========================================================
const idiomsData = [
    {
        question: "【破釜沉舟】正確的用法是？",
        options: [
            "A. 他的身體狀況已經_____，必須馬上進入開刀房動手術。",
            "B. 為了這次的科技創業，他決定_____，把僅有的房子也抵押給銀行了。",
            "C. 面對數量龐大的敵軍，我們只能_____，立刻舉白旗投降。",
            "D. 他做事總是_____，按部就班，所以主管非常信任他。"
        ],
        correctIndex: 1,
        explanation: "【成語性質】：褒義詞<br><br>【出處與含意】：典故出自項羽討伐秦軍時，渡河後下令打破煮飯的鍋子（破釜），鑿沉渡河的船隻（沉舟），以此向士兵表示有去無回、決一死戰的決心。現用來比喻下定極大的決心，不顧一切幹到底。<br><br>【選項分析】：<br>A 句形容病情嚴重，應填「病入膏肓」。<br>B 句形容為了創業不留退路、下定決心，使用「破釜沉舟」完全正確。<br>C 句是投降，與「破釜沉舟」死戰到底的意義完全相反。<br>D 句形容做事踏實，應填「腳踏實地」。"
    },
    {
        question: "【濫竽充數】正確的用法是？",
        options: [
            "A. 這家米其林星級餐廳的每一道菜都是_____，令人回味無窮。",
            "B. 他的繪畫技巧真是_____，畫出來的動物彷彿會動一樣。",
            "C. 為了湊足合唱團的參賽人數，完全不會看五線譜的小明只好去_____。",
            "D. 這項跨國專案非常重要，我們必須找一個_____的人才來負責領導。"
        ],
        correctIndex: 2,
        explanation: "【成語性質】：貶義詞<br><br>【出處與含意】：齊宣王喜歡聽大編制的吹竽交響樂，南郭先生完全不會吹竽，卻混在樂隊裡裝模作樣領取薪水。比喻沒有真才實學的人，混在行家裡面充數；或比喻拿不好的東西混在好的東西裡面充數。<br><br>【選項分析】：<br>A 句形容菜餚美味，應填「山珍海味」。<br>B 句形容技藝高超，應填「出神入化」。<br>C 句形容沒有能力的人混入團隊湊人數，使用非常貼切。<br>D 句形容傑出的人才，應填「出類拔萃」。"
    },
    {
        question: "【杞人憂天】正確的用法是？",
        options: [
            "A. 既然系統漏洞已經完全修復，你就別再_____了，今晚好好睡一覺吧。",
            "B. 面對即將到來的大學聯考，他_____地每天苦讀到凌晨三點。",
            "C. 他的音樂才華在班上簡直是_____，大家都非常崇拜他。",
            "D. 突如其來的強烈地震讓全體員工都_____，尖叫著跑出大樓。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義詞（帶有嘲諷意味）<br><br>【出處與含意】：相傳古時候杞國有一個人，整天擔心天會塌下來、地會陷下去，自己會無處安身，為此愁得睡不著覺、吃不下飯。後用來比喻缺乏根據、毫無必要的瞎擔心。<br><br>【選項分析】：<br>A 句勸人事情已解決不要再瞎擔心，使用非常正確。<br>B 句形容極度專心努力，應填「廢寢忘食」。<br>C 句形容才能出眾，應填「鶴立雞群」。<br>D 句形容受到驚嚇而慌亂，應填「驚慌失措」。"
    },
    {
        question: "【絡繹不絕】正確的用法是？",
        options: [
            "A. 這位作家的寫作靈感_____，每年都能出版兩本暢銷小說。",
            "B. 逢年過節的迪化街裡，前來採買年貨的民眾_____，擠得水洩不通。",
            "C. 這場梅雨下得_____，導致低窪地區出現了嚴重的積水。",
            "D. 面對面試官一連串刁鑽的提問，他_____地回答了出來，毫無怯色。"
        ],
        correctIndex: 1,
        explanation: "【成語性質】：中性詞<br><br>【出處與含意】：「絡繹」指的是往來不斷、前後相連的樣子。形容人、馬、車、船等連續不斷。（注意：通常專門用來形容「人潮」或「車流、交通」）。<br><br>【選項分析】：<br>A 句形容靈感不斷，應填「源源不絕」。<br>B 句用來形容採買年貨的「人潮」連續不斷，完全正確。<br>C 句形容雨下不停，應填「連綿不斷」。<br>D 句形容說話流暢，應填「對答如流」。"
    },
    {
        question: "【畫蛇添足】正確的用法是？",
        options: [
            "A. 這篇報告的結論已經非常精準，你再加這段廢話簡直是_____。",
            "B. 老師在黑板上的解說非常生動，如同_____一般，讓我們瞬間明白了複雜的物理原理。",
            "C. 只要我們整個團隊齊心協力、_____，就一定能順利度過這次的財務危機。",
            "D. 這位大師的書法寫得極好，每一個字都_____，展現出極高的藝術造詣。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義詞<br><br>【出處與含意】：楚國有幾個人比賽畫蛇，先畫好的人原本可以贏得一壺酒，但他看別人還沒畫完，就得意忘形地給自己畫的蛇加上了腳，結果反而失去了喝酒的資格。比喻多此一舉，不但無益，反而有害。<br><br>【選項分析】：<br>A 句形容做多餘且破壞原本完美的事情，使用最為合適。<br>B 句形容加上關鍵的一筆使事物變得更好，應填「畫龍點睛」。<br>C 句形容共同努力，應填「同舟共濟」。<br>D 句形容書法筆力雄健，應填「力透紙背」。"
    },
    {
        question: "【杯弓蛇影】正確的用法是？",
        options: [
            "A. 剛看完恐怖電影後，他獨自走在暗巷裡，總是_____，覺得背後有人跟著。",
            "B. 為了慶祝他考上理想大學，親友們紛紛舉起酒杯，現場_____，好不熱鬧。",
            "C. 這位魔術師的手法極為高超，_____，讓台下觀眾看得目瞪口呆。",
            "D. 這條山路蜿蜒崎嶇，形狀猶如_____，開車經過時必須特別小心。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義詞<br><br>【出處與含意】：晉代樂廣請朋友喝酒，朋友看到酒杯裡有一條蛇的影子，喝下後覺得噁心便生病了。後來發現那只是牆上一張弓倒映在酒杯裡的影子。比喻為不存在的虛幻事物而疑神疑鬼、徒自驚擾。<br><br>【選項分析】：<br>A 句形容因為害怕而疑神疑鬼，非常貼切。<br>B 句形容酒席熱鬧，應填「觥籌交錯」。<br>C 句形容魔術或技藝巧妙，應填「變化莫測」。<br>D 句形容道路彎曲，應填「九彎十八拐」。"
    },
    {
        question: "【指鹿為馬】正確的用法是？",
        options: [
            "A. 這位昏庸的主管總是_____，把員工的功勞說成是自己的，把過錯全推給下屬。",
            "B. 歷史課本上清楚記載著，秦朝的趙高為了測試群臣的忠誠，竟然在朝堂上_____。",
            "C. 他在動物園裡看到了一隻罕見的動物，興奮地_____，結果被導覽員糾正。",
            "D. 為了追求效率，這家工廠的老闆_____，要求員工每天工作十六個小時。"
        ],
        correctIndex: 1,
        explanation: "【成語性質】：貶義詞<br><br>【出處與含意】：秦朝丞相趙高企圖篡位，牽了一隻鹿獻給秦二世，卻硬說這是一匹馬來測試朝臣。比喻顛倒是非，指黑為白；也形容人仗勢欺人、胡作非為。<br><br>【選項分析】：<br>A 句形容搶功諉過，應填「顛倒是非」。<br>B 句完全符合歷史典故，為最佳選項。<br>C 句是單純認錯，應填「張冠李戴」。<br>D 句形容壓榨員工，應填「草菅人命」。"
    },
    {
        question: "【雪中送炭】正確的用法是？",
        options: [
            "A. 他已經是世界首富了，你再送他這點錢，不過是_____，他根本不會在意。",
            "B. 就在這家孤兒院面臨斷炊之際，某位匿名善心人士捐贈了一大筆物資，這真是_____啊！",
            "C. 外頭正下著大雪，他卻_____地跑去山上露營，真是不怕凍壞身體。",
            "D. 兩家公司原本就競爭激烈，現在又為了搶奪專利而互相提告，簡直是_____。"
        ],
        correctIndex: 1,
        explanation: "【成語性質】：褒義詞<br><br>【出處與含意】：在下大雪非常寒冷的時候，送木炭給別人取暖。比喻在別人急需之時，給予物質上或精神上的幫助。<br><br>【選項分析】：<br>A 句形容好上加好，應填反義詞「錦上添花」。<br>B 句形容在危急困難時給予關鍵幫助，使用非常正確。<br>C 句形容冒險或不合常理的行為，應填「不自量力」。<br>D 句形容情況更加惡化，應填「雪上加霜」。"
    },
    {
        question: "【守株待兔】正確的用法是？",
        options: [
            "A. 在這瞬息萬變的科技時代，企業如果只會_____，遲早會被市場淘汰。",
            "B. 警方經過半個月的_____，終於在嫌犯住處附近將他逮捕歸案。",
            "C. 為了考試取得好成績，他每天_____，連假日時都不曾休息。",
            "D. 這位獵人有著_____的本領，只要被他盯上的獵物絕對逃不掉。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義詞<br><br>【出處與含意】：戰國時宋國有一個農夫，偶然看到兔子撞死在樹幹上，從此放下農具守在樹旁希望能再撿到死兔子。比喻拘泥守成，不知變通；也比喻妄想不勞而獲。<br><br>【選項分析】：<br>A 句形容不知變通、不主動尋求改變，最為貼切。<br>B 句形容警方埋伏，應填「埋伏守候」（守株待兔帶有貶義，不適合形容警方辦案）。<br>C 句形容勤奮用功，應填「懸梁刺股」。<br>D 句形容打獵技術高超，應填「百發百中」。"
    },
    {
        question: "【掩耳盜鈴】正確的用法是？",
        options: [
            "A. 他明明犯了嚴重的錯誤，卻把相關文件全鎖在抽屜裡，這種_____的做法遲早會被揭穿。",
            "B. 演唱會現場的音響實在太大聲了，觀眾們只好_____，以免聽力受損。",
            "C. 小偷趁著夜色_____，輕易地潛入了豪宅並偷走了保險箱。",
            "D. 這位官員表面上清廉，私底下卻_____，收受了大量的企業賄賂。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義詞<br><br>【出處與含意】：想偷鐘卻怕敲碎時發出聲響被抓，於是急忙把自己的耳朵摀起來。比喻自欺欺人。<br><br>【選項分析】：<br>A 句形容以為把證據藏起來別人就不知道（自欺欺人），完全正確。<br>B 句是真的摀住耳朵防噪音，不是比喻義。<br>C 句形容偷偷摸摸，應填「鬼鬼祟祟」。<br>D 句形容貪污受賄，應填「中飽私囊」。"
    },
    {
        question: "【亡羊補牢】正確的用法是？",
        options: [
            "A. 這次的資安外洩事件雖然造成了損失，但只要我們現在_____，加強防護，還不算太晚。",
            "B. 他在賭場裡輸光了所有積蓄，現在才來後悔，已經是_____，於事無補了。",
            "C. 牧場裡的羊群因為染上傳染病而大量死亡，老闆看著空蕩蕩的羊圈，感到_____。",
            "D. 這項工程因為偷工減料而倒塌，建商試圖_____，掩蓋真相，卻被媒體踢爆。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：褒義 / 中性詞（多用於正面勸勉）<br><br>【出處與含意】：羊逃跑了再去修補羊圈，還不算晚。比喻犯錯後及時更正，尚能補救，防止更大的損失。<br><br>【選項分析】：<br>A 句形容發生損失後及時補救以免後患，極為合適。<br>B 句強調「太遲了、沒救了」，應填「噬臍莫及」。<br>C 句形容極度悲傷絕望，應填「欲哭無淚」。<br>D 句形容掩飾罪過，應填「欲蓋彌彰」。"
    },
    {
        question: "【對牛彈琴】正確的用法是？",
        options: [
            "A. 這位鋼琴家在國家音樂廳的表演簡直是_____，讓全場聽眾如痴如醉。",
            "B. 農場主人每天早上都會對著乳牛播放古典音樂，這種_____的做法據說能增加產乳量。",
            "C. 我跟他講了半天投資理財的風險管理，他卻滿腦子只想著買彩券暴富，簡直是_____！",
            "D. 他們兩人的默契極佳，只要一個眼神就能明白對方的心意，真可謂是_____。"
        ],
        correctIndex: 2,
        explanation: "【成語性質】：貶義詞<br><br>【出處與含意】：古人公明儀對著牛彈奏高雅的琴曲，牛卻低頭吃草完全不理會。比喻對不懂道理的人講道理，或是說話不看對象。<br><br>【選項分析】：<br>A 句形容音樂美妙，應填「天籟之音」。<br>B 句是字面上的對著牛放音樂，並非比喻義。<br>C 句形容跟聽不懂或無法溝通的人講深奧的道理，非常正確。<br>D 句形容心意相通，應填「心有靈犀」。"
    },
    {
        question: "【狐假虎威】正確的用法是？",
        options: [
            "A. 他只不過是總經理的特助，卻常常_____，在公司裡對其他部門的主管頤指氣使。",
            "B. 這兩支棒球隊的實力相當，比賽過程中雙方_____，互不相讓，戰況十分激烈。",
            "C. 雖然他身形瘦弱，但面對歹徒時卻能_____，勇敢地保護了身旁的孩童。",
            "D. 他們兩人聯手創辦了這家科技公司，在業界可說是_____，無人不知。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義詞<br><br>【出處與含意】：狐狸走在老虎前面，百獸看到老虎嚇得逃跑，老虎卻以為百獸是害怕狐狸。比喻藉著有權者（或強者）的威勢去欺壓、嚇唬別人。<br><br>【選項分析】：<br>A 句形容助理藉著總經理的權勢欺壓他人，是標準用法。<br>B 句形容實力相當，應填「勢均力敵」。<br>C 句形容英勇無畏，應填「臨危不亂」。<br>D 句形容名聲響亮，應填「如雷貫耳」。"
    },
    {
        question: "【釜底抽薪】正確的用法是？",
        options: [
            "A. 為了趕緊把這鍋湯煮沸，媽媽不斷地往爐子裡_____，火勢越來越旺。",
            "B. 銀行拒絕繼續貸款給這家瀕臨破產的企業，無疑是_____，讓他們立刻倒閉。",
            "C. 想要解決市區塞車的問題，與其加派交警，不如_____，建立完善的捷運系統。",
            "D. 在敵軍猛烈的砲火下，我軍決定_____，悄悄從後山的小路撤退。"
        ],
        correctIndex: 2,
        explanation: "【成語性質】：褒義 / 中性詞<br><br>【出處與含意】：把柴火從鍋底抽掉，才能讓鍋裡的水停止沸騰。比喻從根本上解決問題，不留後患。<br><br>【選項分析】：<br>A 句是字面上的加柴火（火上加油），與釜底抽薪相反。<br>B 句形容使情況更糟或斷絕生路，應填「雪上加霜」。<br>C 句形容從根本解決交通問題，非常貼切。<br>D 句形容悄悄撤退，應填「金蟬脫殼」。"
    },
    {
        question: "【刻舟求劍】正確的用法是？",
        options: [
            "A. 市場消費習慣早就變了，你還用十年前的行銷企劃案，無疑是_____，怎麼可能成功？",
            "B. 他在古董市場裡仔細翻找，希望能有_____的好運氣，用低價買到珍貴的文物。",
            "C. 這位雕刻師父的手藝精湛，能夠在小小的橄欖核上_____，令人嘆為觀止。",
            "D. 為了尋找失落在海裡的傳家寶，他不惜花費重金租了一艘潛水艇去_____。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義詞<br><br>【出處與含意】：楚國人渡江時劍掉入水中，在船身上刻記號，等船靠岸後才從記號處下水找劍。比喻做事拘泥死板，不知隨著情勢的變化而改變。<br><br>【選項分析】：<br>A 句形容死守著舊方法而不知變通，完全正確。<br>B 句形容碰運氣尋寶，應填「海底撈針」。<br>C 句形容雕刻極其精巧，應填「鬼斧神工」。<br>D 句只是字面上的「開船找劍」，不是比喻義。"
    },
    {
        question: "【班門弄斧】正確的用法是？",
        options: [
            "A. 在這群資深軟體工程師面前談論基礎程式碼，我簡直是_____，讓大家見笑了。",
            "B. 他憑藉著_____的技藝，用一塊爛木頭雕刻出了栩栩如生巨龍。",
            "C. 老師傅拿起工具_____，三兩下就把這台故障的機器修好了。",
            "D. 這項工程浩大，若不召集百名工匠_____，是很難在期限內完工的。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義詞（多用作自謙詞）<br><br>【出處與含意】：魯班是古代著名的巧匠。在魯班門前賣弄使用斧頭的技巧。比喻在行家面前賣弄本領，不自量力。<br><br>【選項分析】：<br>A 句形容在專家面前賣弄基本功，常做自謙之用，完全正確。<br>B 句形容雕刻技藝高超，應填「鬼斧神工」。<br>C 句形容技術熟練，應填「駕輕就熟」。<br>D 句形容共同努力，應填「齊心協力」。"
    },
    {
        question: "【揠苗助長】正確的用法是？",
        options: [
            "A. 為了讓孩子早日成才，她給五歲的兒子報了十個補習班，這種_____的做法只會累垮孩子。",
            "B. 春雨綿綿，農夫們看著田裡的秧苗_____，心裡充滿了豐收的喜悅。",
            "C. 這家企業靠著政府的_____，在短短三年內就成為了產業龍頭。",
            "D. 為了提升團隊士氣，主管決定_____，舉辦了一場盛大的慶功宴。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義詞<br><br>【出處與含意】：嫌田裡的秧苗長得太慢，就把秧苗往上拔高，結果秧苗全都枯死。比喻為求速成而未顧及事物發展的客觀規律，反而把事情弄砸。<br><br>【選項分析】：<br>A 句形容過度逼迫孩子學習反而有害，最為貼切。<br>B 句形容植物茂盛生長，應填「欣欣向榮」。<br>C 句形容給予幫助支持，應填「大力扶持」。<br>D 句形容趁熱打鐵或犒賞，應填「打鐵趁熱」。"
    },
    {
        question: "【未雨綢繆】正確的用法是？",
        options: [
            "A. 氣象局發布了颱風警報，我們應該_____，提早準備好沙包和糧食。",
            "B. 事情都已經發展到這個無法挽回的地步了，你現在才來_____還有什麼用？",
            "C. 這場大雨下得又急又快，路上的行人紛紛_____，跑到屋簷下躲雨。",
            "D. 他做事總是_____，想到什麼就做什麼，完全沒有計畫。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：褒義詞<br><br>【出處與含意】：趁著天還沒下雨，就先把門窗綁牢。比喻事先做好準備工作，防患未然。<br><br>【選項分析】：<br>A 句形容颱風來臨前先做好準備，完全正確。<br>B 句形容事後補救太遲了，應填「亡羊補牢」或「事後諸葛」。<br>C 句形容驚慌逃避，應填「抱頭鼠竄」。<br>D 句形容沒有計畫，應填「隨心所欲」。"
    },
    {
        question: "【緣木求魚】正確的用法是？",
        options: [
            "A. 想要在沙漠裡找到豐富的地下水資源，簡直就是_____，根本不可能實現。",
            "B. 他爬到高高的樹上_____，希望能看到遠方歸來的船隻。",
            "C. 這家餐廳的招牌菜是_____，每天都有許多饕客慕名而來。",
            "D. 只要我們堅持不懈，即使是_____般困難的任務，也一定能完成。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義詞<br><br>【出處與含意】：爬到樹上去找魚。比喻方向、方法錯誤，必定勞而無功，徒勞無益。<br><br>【選項分析】：<br>A 句形容在沙漠找水方法或方向根本錯誤，非常正確。<br>B 句形容爬高看遠，應填「登高望遠」。<br>C 句只需填具體的菜名，不是成語。<br>D 句形容極度困難，應填「難如登天」。"
    },
    {
        question: "【望梅止渴】正確的用法是？",
        options: [
            "A. 在酷熱的沙漠中迷路，他們只能看著地圖上的綠洲_____，繼續艱難地前進。",
            "B. 這種特效藥一吃下去就能_____，讓他劇烈的頭痛瞬間消失了。",
            "C. 看到滿桌的豐盛佳餚，飢腸轆轆的他不禁_____，口水直流。",
            "D. 他為了買到那限量版的公仔，在烈日下排隊排得_____，差點暈倒。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：中性詞<br><br>【出處與含意】：曹操帶兵出征時士兵口渴，便騙說前方有梅林，士兵聽到梅子嘴裡就分泌唾液解渴。比喻用空想來安慰自己。<br><br>【選項分析】：<br>A 句形容看著地圖上的水源來產生希望、自我安慰，非常貼切。<br>B 句形容藥效迅速，應填「藥到病除」。<br>C 句形容看見美食而貪饞，應填「垂涎三尺」。<br>D 句形容口渴極了，應填「口乾舌燥」。"
    },
    {
        question: "【南轅北轍】正確的用法是？",
        options: [
            "A. 針對如何解決公司的財務危機，兩位董事提出的方案簡直是_____，完全無法達成共識。",
            "B. 兄弟兩人雖然分隔兩地，但他們的心卻是_____，常常透過視訊聊天。",
            "C. 經過幾個月的努力，這項計畫的目標和進度已經_____，完美契合。",
            "D. 這輛列車的行駛路線是_____，橫跨了整個國家的版圖。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義詞 / 中性詞<br><br>【出處與含意】：心裡想往南邊的楚國去，卻駕著車子往北走。比喻行動和目的剛好相反；也比喻雙方意見大相逕庭，完全不一致。<br><br>【選項分析】：<br>A 句形容兩人提出的方案方向完全相反，完全正確。<br>B 句形容感情緊密，應填「緊緊相連」。<br>C 句形容步調一致，應填「步調一致」。<br>D 句形容往來各地，應填「南來北往」。"
    },
    {
        question: "【東施效顰】正確的用法是？",
        options: [
            "A. 這家小店_____，完全照抄對面知名咖啡廳的裝潢與菜單，卻因為服務極差而顯得十分可笑。",
            "B. 她為了在晚會上展現最完美的一面，特地去上了化妝課，把自己打扮得_____。",
            "C. 這位大師的畫作極具個人風格，許多學生都想_____，學習他的筆法。",
            "D. 聽到這個悲慘的故事，她忍不住_____，流下了同情的眼淚。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義詞<br><br>【出處與含意】：醜女東施刻意模仿西施捧心皺眉的樣子，結果反而看起來更醜。比喻盲目模仿別人，不但模仿不好，反而出醜。<br><br>【選項分析】：<br>A 句形容盲目照抄別人反而弄巧成拙，是標準的「東施效顰」。<br>B 句形容打扮得艷麗，應填「花枝招展」。<br>C 句形容觀摩學習，應填「私淑其人」。<br>D 句形容皺眉憂愁，應填「眉頭深鎖」。"
    },
    {
        question: "【一曝十寒】正確的用法是？",
        options: [
            "A. 學習外語必須持之以恆，如果你總是_____，三天打魚兩天曬網，是永遠學不好的。",
            "B. 最近的天氣真是_____，昨天還穿短袖，今天就要穿羽絨衣了。",
            "C. 這位農夫非常勤勞，每天_____地在田裡工作，從來不喊累。",
            "D. 經過他_____的努力，終於在全國數學競賽中拿到了金牌。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義詞<br><br>【出處與含意】：曝：曬。植物如果曬一天太陽，卻被凍十天，也無法存活生長。比喻做事沒有恆心，時而勤奮，時而懈怠。<br><br>【選項分析】：<br>A 句形容學習沒有恆心，與「三天打魚兩天曬網」意思相近，非常契合。<br>B 句形容天氣忽冷忽熱，應填「乍暖還寒」。<br>C 句形容勤奮辛勞，應填「披星戴月」。<br>D 句形容有恆心毅力，應填「鍥而不捨」。"
    },
    {
        question: "【邯鄲學步】正確的用法是？",
        options: [
            "A. 企業在轉型時若一味地模仿外國成功的模式，恐怕會_____，最後連自己原本的核心競爭力都喪失了。",
            "B. 剛滿一歲的小寶寶正在客廳裡_____，搖搖晃晃的模樣非常可愛。",
            "C. 這位舞蹈家融合了中西方的舞蹈元素，創造出_____的新舞步，驚豔全場。",
            "D. 他為了考上理想的大學，每天_____，日夜苦讀。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義詞<br><br>【出處與含意】：燕國人到趙國學習走路的姿勢，結果沒學好，連自己原本走路的方法都忘了。比喻模仿別人不到家，反而把自己原有的長處也丟失了。<br><br>【選項分析】：<br>A 句形容企業盲目模仿別人，結果失去自身優勢，最為準確。<br>B 句形容小嬰兒學走路，應填「蹣跚學步」。<br>C 句形容獨創一格，應填「別出心裁」。<br>D 句形容專心苦讀，應填「發憤忘食」。"
    },
    {
        question: "【草木皆兵】正確的用法是？",
        options: [
            "A. 敵軍在經歷了幾次慘敗後，士氣低落，現在只要一聽到風吹草動就_____，驚恐萬分。",
            "B. 春天一到，山坡上_____，生機盎然，吸引了許多遊客前來賞花。",
            "C. 這位將軍治軍嚴明，手下的士兵個個訓練有素，在戰場上簡直是_____。",
            "D. 颱風過後，整個社區被吹得_____，滿地都是斷瓦殘垣。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義詞<br><br>【出處與含意】：淝水之戰時前秦皇帝苻堅兵敗，看到遠方山上草木的影子都以為是敵軍士兵。比喻人在極度驚恐或疑慮時，產生錯覺，神經極度緊張。<br><br>【選項分析】：<br>A 句形容戰敗後極度恐懼、疑神疑鬼，完全正確。<br>B 句形容花草茂盛，應填「百花齊放」。<br>C 句形容軍隊無敵，應填「所向披靡」。<br>D 句形容破壞嚴重，應填「滿目瘡痍」。"
    },
    {
        question: "【門可羅雀】正確的用法是？",
        options: [
            "A. 自從這家餐廳爆出嚴重的食安危機後，生意一落千丈，如今已是_____。",
            "B. 逢年過節，市中心的百貨公司裡總是_____，擠滿了前來購物的人潮。",
            "C. 他的演講非常精彩，台下觀眾_____，掌聲與歡呼聲不斷。",
            "D. 這棟古厝的雕刻精美，連門口的柱子都_____，極具藝術價值。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義 / 中性詞<br><br>【出處與含意】：形容官員被罷官後賓客絕跡，門外冷清得可以張網捕捉麻雀。用來比喻做官的人失勢後，賓客稀少；或形容門庭冷清、生意慘淡。<br><br>【選項分析】：<br>A 句形容餐廳生意慘淡、無人問津，非常精準。<br>B 句形容人潮擁擠，應填「人山人海」。<br>C 句形容觀眾滿座，應填「座無虛席」。<br>D 句形容建築裝飾華麗，應填「雕梁畫棟」。"
    },
    {
        question: "【買櫝還珠】正確的用法是？",
        options: [
            "A. 他花了高價買下這幅名畫，卻只把精美的畫框掛在牆上，把畫作丟進儲藏室，真是_____！",
            "B. 在二手古董市場裡掏寶，必須要有_____的好眼力，才能用低價買到真品。",
            "C. 商家為了吸引顧客，經常推出_____的促銷活動，讓人忍不住掏出錢包。",
            "D. 這件珠寶的設計非常精緻，簡直是_____，讓所有在場的女士都為之瘋狂。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義詞<br><br>【出處與含意】：「櫝」指的是木匣子。有人買了裝珍珠的華麗木匣，卻把裡面的珍珠退還給賣家。比喻沒有眼光，取捨不當，只看重外表而忽略了事物的本質。<br><br>【選項分析】：<br>A 句形容人只看重外在（畫框）卻拋棄了真正有價值的事物（名畫），是標準的「買櫝還珠」。<br>B 句形容眼光獨到，應填「慧眼獨具」。<br>C 句形容商品繁多，應填「琳瑯滿目」。<br>D 句形容工藝極其巧妙，應填「巧奪天工」。"
    },
    {
        question: "【洛陽紙貴】正確的用法是？",
        options: [
            "A. 這位暢銷作家的最新奇幻小說一上市就引發搶購熱潮，甚至造成了_____的現象。",
            "B. 由於近期通貨膨脹嚴重，現在的民生物價簡直是_____，讓平民百姓苦不堪言。",
            "C. 這幅古代名畫在秋季拍賣會上以天價成交，可以說是_____，令人讚嘆。",
            "D. 他寫的文章內容空洞、邏輯混亂，完全不值一顧，簡直是_____。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：褒義詞<br><br>【出處與含意】：晉代左思寫作《三都賦》大受歡迎，人們爭相抄寫，導致洛陽紙張供不應求，價格大漲。比喻著作受人歡迎，廣泛流傳，風行一時。<br><br>【選項分析】：<br>A 句形容書籍大賣、廣受歡迎，完全正確。<br>B 句形容物價飆漲，應填「物價飛漲」。<br>C 句形容物品極為珍貴，應填「價值連城」。<br>D 句形容言論毫無價值，應填「廢話連篇」。"
    },
    {
        question: "【完璧歸趙】正確的用法是？",
        options: [
            "A. 經過警方的全力追查，這批被跨國集團盜走的博物館珍貴文物終於_____，回到了展示櫃中。",
            "B. 敵軍被打得落花流水，最後只好_____，交出所有武器舉白旗投降。",
            "C. 這位資深工匠將破碎的古董花瓶修補得完好如初，這項技藝簡直是_____。",
            "D. 他的身體在經過長達一年的調養後，終於_____，恢復了往日生龍活虎的模樣。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：褒義 / 中性詞<br><br>【出處與含意】：戰國時代藺相如識破秦王沒有誠意，憑著機智把「和氏璧」完好無缺地帶回趙國。比喻把原物完整無損地歸還給本人。<br><br>【選項分析】：<br>A 句形容失竊物品完整地找回並歸還，極為合適。<br>B 句形容慘敗投降，應填「棄甲曳兵」。<br>C 句形容修補技術，完璧歸趙強調「歸還原主」，不適合修復物品，應填「修舊如舊」。<br>D 句形容恢復健康，應填「康復如初」。"
    },
    {
        question: "【盲人摸象】正確的用法是？",
        options: [
            "A. 在處理複雜的國際經濟議題時，我們必須全面考量，不能_____，只看見問題的一小部分。",
            "B. 突然停電後，他在黑暗的房間裡_____，試圖找到手電筒的開關。",
            "C. 面對突如其來的公關危機，主管冷靜地分析局勢，展現出_____的卓越眼光。",
            "D. 他對待弱勢族群充滿同情心，經常舉辦慈善義賣活動，真可謂是_____。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義詞<br><br>【出處與含意】：幾個盲人摸一頭大象，摸到不同部位就說象像什麼。比喻只憑對事物的一部分了解，就妄下結論，未能掌握事物的全貌。<br><br>【選項分析】：<br>A 句形容看問題片面、不夠全面，非常正確。<br>B 句是字面上在黑暗中摸索，非比喻義，應填「瞎子摸魚」。<br>C 句形容眼光長遠，應填「高瞻遠矚」。<br>D 句形容極具同情心，應填「悲天憫人」。"
    },
    {
        question: "【井底之蛙】正確的用法是？",
        options: [
            "A. 他從沒離開過自己的小村莊，卻總是對國際局勢大放厥詞，自以為是，簡直就是_____。",
            "B. 只要我們齊心協力，就算面對再大的困難，也不會像_____一樣坐以待斃。",
            "C. 這位學者博覽群書，學識淵博，在學術界就像_____一樣受人景仰。",
            "D. 為了躲避敵軍的追捕，他只好躲在陰暗的地窖裡，過著_____般不見天日的生活。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義詞<br><br>【出處與含意】：住在井底的青蛙，以為天只有井口那麼大。比喻見識淺薄、眼界狹窄的人。<br><br>【選項分析】：<br>A 句形容人見識短淺卻愛高談闊論，最為精準。<br>B 句形容陷入困境無法逃脫，應填「甕中之鱉」。<br>C 句形容地位崇高受人敬仰，應填「泰山北斗」。<br>D 句形容躲躲藏藏的生活，應填「鼠輩」或「穴居野處」。"
    },
    {
        question: "【拋磚引玉】正確的用法是？",
        options: [
            "A. 我今天在會議上提出的這個初步構想，只是想_____，希望能激發大家更多、更好的點子。",
            "B. 他為了爭取這個幾百萬的工程項目，不惜_____，送給負責人一輛昂貴的名車。",
            "C. 這位雕刻家擅長將普通的廢棄木材雕成精美的藝術品，真可謂是_____。",
            "D. 既然大家都不願意先發言，那就讓我來_____，直接宣佈今天的會議到此結束吧。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：褒義 / 中性詞（多用作自謙之詞）<br><br>【出處與含意】：拋出磚頭，引來玉石。比喻自己先發表粗淺的意見或文章，目的是為了引出別人更精彩、更高明的見解。<br><br>【選項分析】：<br>A 句作為發言前的自謙之詞，表示希望引出別人的好主意，是標準用法。<br>B 句形容用不正當手段討好別人，應填「投其所好」。<br>C 句形容化腐朽為神奇，應填「點石成金」。<br>D 句「直接結束會議」無法引出別人的意見，與成語含意矛盾。"
    },
    {
        question: "【破鏡重圓】正確的用法是？",
        options: [
            "A. 經過多年的誤會與分離，這對夫妻終於解開了心結，_____，重新建立美滿的家庭。",
            "B. 這面碎裂的古董銅鏡在修復師的巧手下，終於_____，恢復了往日的光澤與價值。",
            "C. 我們兩個原本是無話不談的好朋友，卻因為一次嚴重的爭吵而_____，從此形同陌路。",
            "D. 警方經過連日的追查，終於將這個詐騙集團一網打盡，讓受害者的金錢得以_____。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：褒義詞<br><br>【出處與含意】：南朝陳駙馬把一面銅鏡破成兩半交給妻子，後來兩人果然憑半面銅鏡團聚。比喻夫妻失散或決裂後重新團聚與和好。（注意：專門用於「夫妻」關係）。<br><br>【選項分析】：<br>A 句形容夫妻復合，完全正確。<br>B 句是字面上修補鏡子，不是比喻義。<br>C 句形容朋友絕交，應填「分道揚鑣」。<br>D 句形容失去的東西找回來，應填「失而復得」。"
    },
    {
        question: "【瓜田李下】正確的用法是？",
        options: [
            "A. 為了避免_____的嫌疑，身為評審的他主動迴避了有自己親屬參賽的項目。",
            "B. 這裡的鄉村風景優美，到處都是_____，吸引了許多都市人前來體驗農家樂。",
            "C. 他在退休後買了一塊農地，過著_____的悠閒生活，不再過問世事。",
            "D. 只要我們行事坦蕩，就算遇到_____的危險，也能憑藉著智慧化險為夷。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：中性詞<br><br>【出處與含意】：古人說：「瓜田不納履，李下不整冠。」經過瓜田不要彎腰提鞋，李樹下不要舉手整理帽子，以免被懷疑偷瓜果。比喻容易引起嫌疑的場合或情況。<br><br>【選項分析】：<br>A 句形容主動避開容易引人懷疑的場合，非常貼切。<br>B 句形容風景美麗，應填「鳥語花香」。<br>C 句形容隱居閒適的生活，應填「採菊東籬」。<br>D 句形容極度危險的地方，應填「龍潭虎穴」。"
    },
    {
        question: "【畫龍點睛】正確的用法是？",
        options: [
            "A. 這篇文章原本平淡無奇，但結尾的那句名人語錄卻有_____之效，瞬間提升了整篇文章的境界。",
            "B. 他的演講冗長且毫無重點，最後甚至還加了一段無關緊要的笑話，簡直是_____。",
            "C. 雖然這項計畫的架構已經很完整，但由於缺乏資金的_____，遲遲無法正式啟動。",
            "D. 為了讓這場跨年晚會更加精彩，主辦單位特地請來了亞洲天王_____，擔任開場嘉賓。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：褒義詞<br><br>【出處與含意】：畫家在牆上畫龍，點上眼睛龍就破壁飛上天。比喻繪畫、作文或說話時，在最重要之處加上一筆，使全體更加生動傳神。<br><br>【選項分析】：<br>A 句形容加上關鍵的一筆讓事物變得更出色，是完美的應用。<br>B 句形容多此一舉、弄巧成拙，應填「畫蛇添足」。<br>C 句形容需要關鍵的推動，應填「臨門一腳」。<br>D 句形容增加光彩，應填「錦上添花」或「壓軸登場」。"
    },
    {
        question: "【如魚得水】正確的用法是？",
        options: [
            "A. 他到了新的研發部門後簡直是_____，充分發揮了他在科技領域的專長。",
            "B. 這次無情的水災讓整個村莊的居民_____，紛紛爬上屋頂等待直升機救援。",
            "C. 他在商場上總是_____，為了個人利益可以隨時背叛多年的合作夥伴。",
            "D. 經過幾個月的魔鬼訓練，他現在游泳的速度已經_____，比以前快太多了。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：褒義詞<br><br>【出處與含意】：劉備形容自己得到諸葛亮的輔佐，就像魚得到了水。比喻得到跟自己十分投合的人，或是進入十分適合自己發揮的絕佳環境。<br><br>【選項分析】：<br>A 句形容人進入了最適合發揮的環境，非常完美。<br>B 句形容遭受災難的痛苦處境，應填「水深火熱」。<br>C 句形容只圖謀利益不顧道義，應填「唯利是圖」。<br>D 句形容進步極快，應填「突飛猛進」。"
    },
    {
        question: "【兔死狐悲】正確的用法是？",
        options: [
            "A. 看到與自己處境相似的同事被公司無情裁員，他不禁生出_____之感，擔心自己會是下一個。",
            "B. 這對雙胞胎兄弟從小感情極好，只要其中一人受傷，另一人也會_____，跟著大哭起來。",
            "C. 面對競爭對手的倒閉，他不僅沒有伸出援手，反而_____，趁機搶奪了對方的客戶。",
            "D. 這位老練的獵人設下陷阱，成功抓到了罕見的獵物，展現出_____的高超技巧。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義 / 中性詞<br><br>【出處與含意】：兔子死了，狐狸為之悲傷。比喻因同類的不幸遭遇而感到悲傷與同情，有時也帶有對自身未來命運的擔憂。<br><br>【選項分析】：<br>A 句看到處境相似的同伴遭殃而感到擔憂，極為精準。<br>B 句形容感情深厚能體會痛苦，應填「感同身受」。<br>C 句形容別人遭遇災禍自己反而高興，應填「幸災樂禍」。<br>D 句形容打獵技術高超，應填「百發百中」。"
    },
    {
        question: "【鋌而走險】正確的用法是？",
        options: [
            "A. 為了籌措母親龐大的醫藥費，走投無路的他竟然_____，跑去搶劫了街角的便利商店。",
            "B. 這座深山裡的吊橋年久失修，他在上面走得_____，深怕一不小心就摔下深淵。",
            "C. 他不畏懼任何艱難，_____地攀登上了世界最高峰，創下了人類的新紀錄。",
            "D. 警方經過縝密的部署，終於讓這個跨國犯罪集團_____，將所有嫌犯一網打盡。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義詞<br><br>【出處與含意】：鋌：快走、走投無路。比喻在無路可走或走投無路時，採取冒險的行動或做出違法的行為。<br><br>【選項分析】：<br>A 句形容因絕望而採取非法的冒險行為，是標準情境。<br>B 句形容非常害怕不安，應填「膽戰心驚」。<br>C 句形容勇敢前進，應填「勇往直前」。<br>D 句形容無路可逃，應填「插翅難飛」。"
    },
    {
        question: "【抱薪救火】正確的用法是？",
        options: [
            "A. 經濟不景氣時，政府如果不設法振興產業，反而大幅度加稅，這無疑是_____。",
            "B. 勇敢的消防隊員們在烈火中_____，奮不顧身地救出了受困在頂樓的居民。",
            "C. 朋友遭遇低潮時，他總是能適時地給予安慰與實質幫助，絕對不會做出_____的行為。",
            "D. 為了趕緊把森林大火撲滅，全村居民紛紛提著水桶_____，終於控制了災情。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義詞<br><br>【出處與含意】：抱著柴火去救火。比喻用錯誤的方法去消除災禍，結果不但無法解決問題，反而使災禍擴大。<br><br>【選項分析】：<br>A 句形容用錯誤政策解決經濟反而讓情況更糟，完全契合。<br>B 句形容不避艱險，應填「赴湯蹈火」。<br>C 句形容趁人危難加以陷害，應填「落井下石」。<br>D 句形容眾人共同努力，應填「齊心協力」。"
    },
    {
        question: "【勢如破竹】正確的用法是？",
        options: [
            "A. 公司的女子籃球隊在這次聯賽中_____，連贏十場，順利奪下全國總冠軍。",
            "B. 這場夏季暴風雨來得_____，瞬間就將路旁的行道樹連根拔起，造成嚴重災情。",
            "C. 他只要一發脾氣就會_____，把桌上的文件和水杯全掃到地上，讓人不敢靠近。",
            "D. 由於缺乏資金和專業人才，這項新計畫的推動過程_____，進展十分緩慢。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：褒義詞<br><br>【出處與含意】：劈竹子時，只要劈開上端，下面就會順著刀勢劈開。比喻作戰或工作節節勝利，毫無阻礙。<br><br>【選項分析】：<br>A 句形容比賽連勝、氣勢無法阻擋，最為傳神。<br>B 句形容來勢兇猛，應填「來勢洶洶」。<br>C 句形容非常憤怒，應填「暴跳如雷」。<br>D 句形容遭遇重重阻礙，應填「困難重重」。"
    },
    {
        question: "【欲蓋彌彰】正確的用法是？",
        options: [
            "A. 他越是急著向大家解釋自己沒有收賄，越是顯得_____，反而引起了檢調單位的深度懷疑。",
            "B. 這篇評論文章的觀點非常銳利，_____地指出了當前社會福利制度的重大缺失。",
            "C. 為了讓這幅油畫看起來更完美，他不斷地在背景塗抹修改，最後卻是_____，破壞了原本的美感。",
            "D. 警方經過長達半年的縝密調查，終於讓這起懸案_____，將潛逃在外的真兇繩之以法。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義詞<br><br>【出處與含意】：想要掩蓋壞事，結果反而暴露得更加明顯。（蓋：掩蓋；彌：更加；彰：明顯）。<br><br>【選項分析】：<br>A 句形容越想掩飾反而越顯得可疑，正是核心含意。<br>B 句形容說話命中要害，應填「一針見血」。<br>C 句形容多此一舉把事情弄糟，應填「畫蛇添足」。<br>D 句形容真相大白，應填「水落石出」。"
    },
    {
        question: "【螳臂當車】正確的用法是？",
        options: [
            "A. 這家剛成立的小型本土企業想要挑戰跨國集團的市場壟斷地位，在業界看來簡直是_____。",
            "B. 面對失控衝向人群的卡車，他_____地推開了路旁的小孩，自己卻受了重傷。",
            "C. 這位重量級拳王在擂台上_____，連續擊敗了五位挑戰者，順利衛冕冠軍寶座。",
            "D. 經過連夜的奮戰，這群工程師終於發揮了_____的精神，修復了整個國家的網路系統。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義詞<br><br>【出處與含意】：螳螂舉起雙臂想阻擋車子前進。比喻不自量力，企圖阻擋無法抗拒的強大力量，注定會失敗。<br><br>【選項分析】：<br>A 句形容弱小的一方挑戰強大的對手，非常精確。<br>B 句形容為了救人奮不顧身，應填「奮不顧身」。<br>C 句形容力量強大無人能敵，應填「所向披靡」。<br>D 句形容解決困難的強大力量，應填「移山倒海」。"
    },
    {
        question: "【喧賓奪主】正確的用法是？",
        options: [
            "A. 電影中那位配角的演技實在太過出色，甚至到了_____的地步，讓觀眾幾乎忘了男主角的存在。",
            "B. 在這場盛大的婚宴上，伴郎們熱情地穿梭在各桌之間招待客人，善盡了_____的責任。",
            "C. 這家知名網美餐廳的裝潢極其華麗，但餐點菜色卻非常普通，真可說是_____。",
            "D. 兩家科技公司的談判代表在會議桌上_____，為了各自的專利利益爭論不休。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義 / 中性詞<br><br>【出處與含意】：客人的聲音壓過了主人。比喻次要的事物佔據了主要事物的位置，或是外來勢力奪取了原本主導者的地位。<br><br>【選項分析】：<br>A 句形容配角的風頭蓋過了主角，是最常見的用法。<br>B 句形容主人的職責與招待，應填「地主之誼」。<br>C 句形容外表好看但內容空虛，應填「華而不實」。<br>D 句形容言語交鋒激烈，應填「唇槍舌劍」。"
    },
    {
        question: "【揚湯止沸】正確的用法是？",
        options: [
            "A. 面對日益嚴重的交通壅塞問題，單靠增加違規罰款只是_____，唯有建立完善的大眾運輸系統才是根本之道。",
            "B. 國宴即將開始，主廚在廚房裡忙得_____，連喝口水的時間都沒有。",
            "C. 他的競選演講極具煽動力，讓台下的支持者情緒激昂，現場氣氛如_____般熱烈。",
            "D. 為了徹底消滅敵軍的勢力，將軍決定採取_____的策略，直接派兵切斷對方的糧草補給線。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義詞<br><br>【出處與含意】：把鍋裡沸騰的水舀起來再倒回去，想讓水停止沸騰。比喻治標不治本，無法從根本上解決問題（與「釜底抽薪」意思相對）。<br><br>【選項分析】：<br>A 句形容只做表面處理而未解決根本問題，完全符合。<br>B 句形容極度忙碌，應填「焦頭爛額」。<br>C 句形容氣氛熱烈，應填「如火如荼」。<br>D 句形容從根本解決問題，應填相反的「釜底抽薪」。"
    },
    {
        question: "【黔驢技窮】正確的用法是？",
        options: [
            "A. 詐騙集團的各種招數早就被警方一一識破，如今他們已經_____，只能乖乖在藏匿處束手就擒。",
            "B. 這位街頭魔術師的表演花樣百出，讓圍觀的民眾看得_____，拍手叫好。",
            "C. 面對考卷上艱澀的幾何難題，他絞盡腦汁卻依然_____，半小時過去了還是一題也寫不出來。",
            "D. 他的口才極佳，邏輯清晰，在辯論台上總是能把對手逼得_____，完全無力反擊。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義詞<br><br>【出處與含意】：貴州的驢子面對老虎時，用盡了只會踢和叫的本領，最後被老虎吃掉。比喻人拙劣的本領或計謀已經用盡，再也無計可施了。<br><br>【選項分析】：<br>A 句形容壞人招數用盡、無計可施，最為貼切。<br>B 句形容事物繁多讓人看不過來，應填「眼花撩亂」。<br>C 句形容毫無辦法，應填「一籌莫展」（黔驢技窮強調用盡方法後，此處是指一開始就不會）。<br>D 句形容被反駁得說不出話，應填「啞口無言」。"
    },
    {
        question: "【罄竹難書】正確的用法是？",
        options: [
            "A. 那位殘酷的獨裁者在位期間，迫害百姓的暴行簡直是_____，歷史會永遠記下他的罪惡。",
            "B. 這位慈善家一生致力於偏鄉教育，對社會的貢獻與好人好事多到_____。",
            "C. 這位歷史學家家裡收藏了無數珍貴的古籍，藏書量之大可以說是_____。",
            "D. 國家公園裡的自然景觀極美，各種奇花異草令人目不暇給，風景_____。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義詞<br><br>【出處與含意】：把所有竹子做成竹簡都寫不完。比喻罪狀極多，寫也寫不完。（極易錯重點：只能用來形容罪惡極多，不能形容好事）<br><br>【選項分析】：<br>A 句形容獨裁者的暴行與罪惡極多，是唯一正確用法。<br>B 句形容好人好事，絕對不能用，應填「不勝枚舉」。<br>C 句形容藏書極多，應填「汗牛充棟」。<br>D 句形容美景多，應填「美不勝收」。"
    },
    {
        question: "【望洋興嘆】正確的用法是？",
        options: [
            "A. 面對如此龐大且複雜的程式原始碼，完全沒有資工背景的他只能_____，不知從何下手。",
            "B. 站在玉山山頂，看著壯闊的雲海與日出，他不禁_____，讚嘆大自然的鬼斧神工。",
            "C. 經過多年的努力，他終於在國際音樂大賽中_____，取得了空前的成就。",
            "D. 他這篇文章寫得極好，文采飛揚，讓人讀了_____，久久無法忘懷。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義 / 中性詞<br><br>【出處與含意】：河伯望著海洋感嘆自己的渺小。比喻因力量不夠或缺乏條件，而感到無可奈何。<br><br>【選項分析】：<br>A 句形容面對超出能力範圍的事物感到無奈，非常精確。<br>B 句形容看到美好事物而極度讚賞，應填「嘆為觀止」。<br>C 句形容表現出色，應填「大放異彩」。<br>D 句形容令人回味，應填「回味無窮」。"
    },
    {
        question: "【飲鴆止渴】正確的用法是？",
        options: [
            "A. 公司出現嚴重財務虧損時，竟然去借高利貸來發放年終獎金，這無疑是_____，遲早會面臨破產。",
            "B. 在沙漠中迷路了三天，他終於找到了一灘綠洲，立刻_____地大口喝起水來。",
            "C. 為了讓這個產品迅速上市，團隊決定_____，從根本上解決了所有的設計缺陷。",
            "D. 面對惡劣的工作環境與不合理的規定，他決定_____，直接向董事長提出改革方案。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義詞<br><br>【出處與含意】：「鴆」是劇毒鳥。喝毒酒來解渴。比喻只求解決眼前的困難，而不顧將來極大的禍患。<br><br>【選項分析】：<br>A 句借高利貸補洞只會引來更大災難，是完美的範例。<br>B 句形容極度渴望，應填「迫不及待」。<br>C 句形容從根本解決，應填「釜底抽薪」。<br>D 句形容下定決心，應填「破釜沉舟」。"
    },
    {
        question: "【投鼠忌器】正確的用法是？",
        options: [
            "A. 警方雖然知道歹徒就躲在屋內，但因為裡面有幾名人質，只能_____，不敢貿然攻堅。",
            "B. 面對強大的競爭對手，我們不能_____，必須主動出擊才能贏得市場。",
            "C. 為了消滅家裡的蟑螂，他不惜_____，把整個廚房噴滿了劇毒殺蟲劑，結果差點害家人中毒。",
            "D. 這位主管在處理員工糾紛時總是_____，偏袒自己的親戚，讓其他員工非常不滿。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：中性詞<br><br>【出處與含意】：想拿東西打老鼠，又怕打壞了老鼠旁邊的器物。比喻想要打擊壞人，卻又有所顧忌，不敢放手去做。<br><br>【選項分析】：<br>A 句形容想抓歹徒但顧忌人質安危，極為貼切。<br>B 句形容膽小怕事，應填「畏首畏尾」。<br>C 句形容不計代價，應填「玉石俱焚」。<br>D 句形容包庇私情，應填「徇私舞弊」。"
    },
    {
        question: "【殺雞取卵】正確的用法是？",
        options: [
            "A. 為了眼前短暫的龐大利益而將百年原始林全數砍伐，這種_____的做法將會帶來嚴重的生態浩劫。",
            "B. 廚房裡的學徒經過多年的磨練，如今已經可以_____，獨立負責整場宴席的菜色了。",
            "C. 雖然這次投資失敗損失慘重，但只要我們不放棄，總有_____、重新站起來的一天。",
            "D. 面對市場上對手惡意的削價競爭，我們應該_____，降低成本來應對。"
        ],
        correctIndex: 0,
        explanation: "【成語性質】：貶義詞<br><br>【出處與含意】：殺掉會生蛋的雞來取出肚子裡的蛋。比喻貪圖眼前微小的利益，而損害了長遠的大利益。<br><br>【選項分析】：<br>A 句為了眼前利益破壞長期生態，完全符合含意。<br>B 句形容獨力承擔重任，應填「獨當一面」。<br>C 句形容重新來過，應填「東山再起」。<br>D 句形容順應情勢，應填「見招拆招」。"
    },
    {
        question: "【門庭若市】正確的用法是？",
        options: ["A. 這家老字號的牛肉麵店只要一到用餐時間，總是_____，排隊的人龍綿延了好幾十公尺。", "B. 由於經濟不景氣，這條曾經繁華的商業街如今已是_____，許多店家都拉下了鐵門倒閉了。", "C. 這個社區的治安非常好，到了夜晚依然是_____，居民們連睡覺都不用鎖門。", "D. 經過這次的收賄醜聞風波，這位政治人物的支持度大跌，家中_____，無人問津。"],
        correctIndex: 0,
        explanation: "形容交遊廣闊、賓客眾多，或生意興隆、人潮擁擠。"
    },
    {
        question: "【巧言令色】正確的用法是？",
        options: ["A. 這位詐騙集團的推銷員_____地把一件劣質商品說得天花亂墜，騙取了不少老人家畢生的積蓄。", "B. 在全國演講比賽中，他憑藉著_____的口才和豐富的肢體語言，贏得了評審的一致好評。", "C. 這位藝術家的畫作色彩豐富、_____，完美捕捉了春天的生機與活力。", "D. 面對主管的嚴厲指責，他只能_____，低著頭不敢為自己的失誤多做任何辯解。"],
        correctIndex: 0,
        explanation: "形容人虛偽討好，為了達到目的而裝出友善親切的模樣。"
    },
    {
        question: "【汗牛充棟】正確的用法是？",
        options: ["A. 國家圖書館裡的各類文獻典籍多到_____，是學者們做研究的珍貴寶庫。", "B. 這間老舊的倉庫裡堆滿了廢棄的機器零件和垃圾，簡直是_____，連走路的空間都沒有。", "C. 夏天在烈日下從事營造工作，工人們個個_____，衣服都能擰出水來了。", "D. 這篇文章的字數雖然多達數萬字，但內容卻_____，沒有什麼實質的見解和重點。"],
        correctIndex: 0,
        explanation: "比喻書籍極多。"
    },
    {
        question: "【噤若寒蟬】正確的用法是？",
        options: ["A. 總經理在會議上大發雷霆，摔了幾份財報後，底下的主管們全都_____，沒有人敢吭一聲。", "B. 秋天到了，森林裡的蟬鳴聲_____，讓人感受到一股濃濃的秋意與淒涼。", "C. 即使面對敵人的嚴刑拷打，這位英勇的情報員依然_____，堅決不透露半點國家機密。", "D. 這裡的氣候非常寒冷，即使到了夏天，居民們出門依然_____，穿著厚重的外套。"],
        correctIndex: 0,
        explanation: "比喻因為害怕或有所顧忌而不敢說話。"
    },
    {
        question: "【剛愎自用】正確的用法是？",
        options: ["A. 這位董事長性格_____，從來不聽取其他高階主管的風險警告，導致公司在這次投資中慘賠。", "B. 面對突發的公關危機，他能夠_____，迅速且果斷地做出正確的決策，穩定軍心。", "C. 這位年輕人雖然才華洋溢，但為人卻非常_____，總是謙虛地向長輩與同行請教。", "D. 他對自己的能力極度缺乏自信，做事情總是_____，需要別人不斷的鼓勵才敢跨出第一步。"],
        correctIndex: 0,
        explanation: "指人性格倔強固執，只憑自己的意思行事，不聽從別人的意見。"
    },
    {
        question: "【趨之若鶩】正確的用法是？",
        options: ["A. 聽說那家新開幕的甜點店推出限量五折優惠，網美與饕客們紛紛_____，排起長長的人龍。", "B. 面對突如其來的強烈地震，購物中心裡的民眾_____地往一樓的空曠處逃生。", "C. 他對這項枯燥的考古研究工作_____，一頭栽進去就是三十年，從不喊苦。", "D. 遇到金融風暴時，全體國民應該_____，共同支持國產品牌度過難關。"],
        correctIndex: 0,
        explanation: "比喻大家爭相奔向某個事物（多指追逐名利或盲目跟風）。"
    },
    {
        question: "【虛懷若谷】正確的用法是？",
        options: ["A. 這位資深院士雖然學識淵博，為人卻_____，經常耐心聽取年輕研究員的意見。", "B. 他這人心胸狹窄，_____，別人不經意的一句玩笑話他都要記恨很久。", "C. 太魯閣的峽谷風景秀麗，_____，每年都吸引了大量國內外遊客前來朝聖。", "D. 他的演講內容空洞，簡直是_____，聽了半小時還抓不到任何重點。"],
        correctIndex: 0,
        explanation: "形容人極度謙虛，能容納別人的意見。"
    },
    {
        question: "【三人成虎】正確的用法是？",
        options: ["A. 關於經理要被裁員的傳聞原本只是無稽之談，但_____，講的人多了，連老闆都信以為真。", "B. 他們三兄弟齊心協力，_____，只花了五年就把街角的小麵攤經營成連鎖餐飲企業。", "C. 面對市場上強大的競爭品牌，只要我們全公司_____，就一定能打贏這場商戰。", "D. 這位警官非常英勇，曾經在未配槍的情況下_____，獨自制伏了三名持刀歹徒。"],
        correctIndex: 0,
        explanation: "比喻謠言重複多次，就能掩蓋真相，使人信以為真。"
    },
    {
        question: "【怙惡不悛】正確的用法是？",
        options: ["A. 這個慣竊出獄後不僅沒學乖，反而_____，繼續用更狡猾的新手法去騙取老人家的錢財。", "B. 經過這次生意破產的慘痛教訓，他終於_____，決定戒除賭博的惡習，重新做人。", "C. 他做事總是_____，從來不聽取其他部門的專業建議，最後導致專案徹底失敗。", "D. 面對黑道勢力的恐嚇，這位檢察官_____，堅決要將所有犯罪集團成員繩之以法。"],
        correctIndex: 0,
        explanation: "形容犯罪者死不認錯、屢教不改。"
    },
    {
        question: "【鞭長莫及】正確的用法是？",
        options: ["A. 總公司雖然在亞洲規模龐大，但對於管理遠在南美的分公司卻感到_____，常有溝通落差。", "B. 這位短跑選手的速度極快，一開局就拉開了距離，讓後方的選手_____。", "C. 他對這門艱深的量子力學一直_____，花了幾十年的時間日夜鑽研，終於發表了重要論文。", "D. 老師的教導總是_____，能精準指出我們在學習上的盲點，讓我們受益良多。"],
        correctIndex: 0,
        explanation: "比喻力量達不到，或是距離太遠而無法給予幫助或管理。"
    },
    {
        question: "【投筆從戎】正確的用法是？",
        options: ["A. 國家面臨外患入侵之際，許多充滿愛國熱血的大學生決定_____，休學報考軍校報效國家。", "B. 他原本是個小有名氣的作家，後來覺得寫作收入太不穩定，於是_____，改行開了餐廳。", "C. 經過一番深思熟慮，這位將軍決定_____，辭去軍職，回到故鄉過著種菜的田園生活。", "D. 這位專欄作家才思敏捷，_____，一天就能寫出上萬字的精彩文章。"],
        correctIndex: 0,
        explanation: "比喻文人放棄文職或學業，參加軍隊報效國家。"
    },
    {
        question: "【削足適履】正確的用法是？",
        options: ["A. 為了迎合這套早就過時的舊系統，公司竟然要求所有部門裁減業務流程，這簡直是_____。", "B. 在網路上購買鞋子時，我們必須看清楚尺寸表，千萬不能_____，以免買來穿了腳痛。", "C. 為了在短期內達到減肥目標，她每天只喝水不吃東西，這種_____的做法非常傷害身體。", "D. 他能夠根據不同的客戶需求，靈活調整企劃案的內容，從來不會_____，因此業績一直很好。"],
        correctIndex: 0,
        explanation: "比喻不顧具體條件，勉強遷就，或指用不合理的方法來妥協。"
    },
    {
        question: "【曲高和寡】正確的用法是？",
        options: ["A. 這部實驗性電影的意境實在太過深奧，難免_____，一般大眾很難看懂導演想表達的意涵。", "B. 他的脾氣非常古怪，在辦公室裡總是_____，同事們都不太敢主動跟他講話。", "C. 這首流行歌曲旋律優美，歌詞貼近人心，因此_____，很快就紅遍了各大音樂排行榜。", "D. 會議上他提出的方案因為完全沒有考慮到成本預算而_____，最後被全體董事否決。"],
        correctIndex: 0,
        explanation: "比喻言行卓越不凡，知音難求；或比喻作品過於深奧，一般人難以理解與接受。"
    },
    {
        question: "【登堂入室】正確的用法是？",
        options: ["A. 經過二十年來的刻苦練習，他的小提琴技藝已經達到了_____的境界，獲邀至世界各地巡演。", "B. 可惡的小偷趁著全家人出國旅遊時_____，把保險箱裡的名貴手錶與現金洗劫一空。", "C. 既然你是今天晚宴最尊貴的客人，理所當然應該_____，坐在宴會廳的主桌正中央。", "D. 這棟剛落成的豪宅內部裝潢極其考究，_____，讓人彷彿置身於歐洲的皇室宮廷。"],
        correctIndex: 0,
        explanation: "比喻學問或技藝由淺入深，循序漸進，達到了很高深的境界。（極易錯重點：絕非指小偷進屋）"
    },
    {
        question: "【涇渭分明】正確的用法是？",
        options: ["A. 對於公私事務的界線，他向來_____，絕不會佔用上班時間處理私事。", "B. 這對雙胞胎姊妹長得極為相似，穿上一樣的衣服時更是讓人難以_____。", "C. 這場政策辯論賽雙方各執一詞，直到最後依然沒有_____，難分高下。", "D. 氣象預報指出，由於鋒面過境，今天下午會有一場_____的雷陣雨。"],
        correctIndex: 0,
        explanation: "比喻彼此界線清楚，是非、好壞分得非常明確。"
    },
    {
        question: "【捨本逐末】正確的用法是？",
        options: ["A. 學習語言不注重最核心的聽說讀寫，卻只是一味地背誦冷僻單字，根本是_____。", "B. 面對公司的嚴重虧損，政府決定_____，直接注資百億元來拯救這家企業。", "C. 遇到複雜的問題時，我們應該冷靜下來_____，找出最核心的癥結所在。", "D. 他做事總是_____，從不半途而廢，因此深得主管的信任與賞識。"],
        correctIndex: 0,
        explanation: "比喻做事不抓重點，輕重倒置。"
    },
    {
        question: "【魚目混珠】正確的用法是？",
        options: ["A. 這家無良商家經常在高級茶葉中摻雜劣等茶葉，企圖_____，欺騙不知情的消費者。", "B. 他的廚藝極佳，能夠將普通的食材烹調得_____，讓所有評審讚不絕口。", "C. 在這場激烈的海選活動中，他憑藉著獨特的嗓音_____，成功晉級決賽。", "D. 博物館裡展出的這批古代珠寶，每一件都_____，閃耀著迷人的光芒。"],
        correctIndex: 0,
        explanation: "比喻拿假的東西冒充真的東西，或拿壞的東西冒充好的東西。"
    },
    {
        question: "【飲水思源】正確的用法是？",
        options: ["A. 他在事業飛黃騰達後，不忘_____，捐了一大筆錢回饋母校和家鄉的建設。", "B. 在沙漠中迷路了三天，他一看到綠洲的水池便_____，瘋狂地大口喝了起來。", "C. 這家連鎖餐廳的食材產地標示非常透明，讓顧客能夠_____，吃得更加安心。", "D. 學習歷史可以讓我們_____，從過去的錯誤中吸取教訓，避免重蹈覆轍。"],
        correctIndex: 0,
        explanation: "比喻人不要忘本，要懂得感恩圖報。"
    },
    {
        question: "【野人獻曝】正確的用法是？",
        options: ["A. 各位業界前輩好，我這點粗淺的投資心得只是_____，希望能對大家有一點點參考價值。", "B. 他為人粗魯無禮，在高級宴會上竟然_____，大聲喧嘩，讓主人非常尷尬。", "C. 這件精美的雕刻藝術品可是大師的_____之作，極具歷史與收藏價值。", "D. 面對歹徒的持刀威脅，他展現出_____的勇氣，成功保護了車上所有乘客的安全。"],
        correctIndex: 0,
        explanation: "比喻平凡人貢獻微薄但出於真誠的事物；常作為提出意見或贈送禮物時的自謙詞。"
    },
    {
        question: "【蓬蓽生輝】正確的用法是？",
        options: ["A. 董事長今天能親臨我們這個偏遠的小辦公室視察，真是讓此地_____啊！", "B. 經過百萬元的重新裝潢，這間原本破舊的老屋子煥然一新，簡直是_____。", "C. 這位好萊塢女星的穿著打扮總是_____，無論走到哪裡都是眾人攝影機的焦點。", "D. 他的脫口秀表演生動有趣，讓整個劇院都_____，觀眾的笑聲完全沒有停過。"],
        correctIndex: 0,
        explanation: "常用於歡迎客人或感謝別人贈送字畫的客套話/敬辭。（極易錯重點：尊稱別人的到來讓自己的家感到光榮，不可用在自己去別人家）"
    },
    {
        question: "【望塵莫及】正確的用法是？",
        options: ["A. 這位天才作家的文采之高、出書速度之快，讓許多同時代的文人都感到_____，自嘆不如。", "B. 看著窗外漫天飛舞的恐怖沙塵暴，他只能_____，完全不敢踏出家門一步。", "C. 經過警方一整晚的全力追捕，終於讓這名搶匪_____，在小巷子裡乖乖束手就擒。", "D. 這座古代皇陵的內部通道錯綜複雜，讓人看了一不小心就_____，迷失在裡面。"],
        correctIndex: 0,
        explanation: "比喻遠遠落後，能力或成就完全比不上對方。"
    },
    {
        question: "【夜郎自大】正確的用法是？",
        options: ["A. 他不過是在地區性的業餘比賽拿了個小獎，就到處炫耀、目中無人，簡直是_____。", "B. 面對浩瀚無垠的宇宙，人類不應該_____，而是要心存敬畏地繼續探索未知。", "C. 到了夜晚，這座城市的觀光夜市開始_____，充滿了各種美食和擁擠的人潮。", "D. 他在商場上的作風總是_____，為了利益不擇手段地打壓對手，惹人厭惡。"],
        correctIndex: 0,
        explanation: "比喻人見識短淺，卻又自以為了不起、狂妄自大。"
    },
    {
        question: "【狗尾續貂】正確的用法是？",
        options: ["A. 這部經典電影的續集劇本寫得極差，完全是_____，徹底砸了原作的招牌。", "B. 為了讓這件衣服更有特色，設計師在裙擺的後方_____，增添了幾分俏皮的感覺。", "C. 他做事總是虎頭蛇尾，經常_____，把原本完美的計畫搞得一團糟。", "D. 這家知名老店的招牌菜「紅燒獅子頭」真是_____，每天都有大批饕客排隊購買。"],
        correctIndex: 0,
        explanation: "比喻拿不好的東西接在好東西的後面，多用於指文學作品的續集極差；也可用作謙虛說自己的作品接在別人大作之後。"
    },
    {
        question: "【汗馬功勞】正確的用法是？",
        options: ["A. 這位老臣年輕時跟隨先帝南征北討，為國家的建立立下了無數的_____，因此深受皇上器重。", "B. 經過一整天在烈日下的田間勞動，農夫們都已經_____，只想趕快回家洗澡休息。", "C. 他為了準備這次的大學入學考試，付出了_____，終於如願考上第一志願的醫學系。", "D. 這批剛從國外重金引進的純種賽馬，匹匹都是_____，預計能在明年的賽事中奪冠。"],
        correctIndex: 0,
        explanation: "原指在戰場上立下的功績，現多指在工作或事業上做出的重大貢獻。"
    },
    {
        question: "【南柯一夢】正確的用法是？",
        options: ["A. 他原本以為中了樂透頭獎可以從此無憂無慮，沒想到卻是一場詐騙，最終成了_____。", "B. 昨晚他做了一個非常奇怪的夢，夢見自己飛上了太空，這真是_____。", "C. 只要我們腳踏實地地努力工作，夢想就絕對不會只是_____，終有實現的一天。", "D. 為了追求長生不老，古代皇帝們耗費重金尋仙問藥，結果證明只是_____。"],
        correctIndex: 0,
        explanation: "比喻人生富貴得失無常，或比喻空歡喜一場。"
    },
    {
        question: "【口蜜腹劍】正確的用法是？",
        options: ["A. 面對這種_____的小人，你千萬要提高警覺，別被他表面上的甜言蜜語給騙了。", "B. 這位名嘴的口才極佳，在政論節目上總是_____，把對手批評得體無完膚。", "C. 這家甜點店主打純手工製作，每一口巧克力都讓人感受到_____的幸福滋味。", "D. 他的演講雖然幽默風趣、逗得大家哈哈大笑，但內容卻是_____，充滿了諷刺。"],
        correctIndex: 0,
        explanation: "比喻人嘴甜心狠，表面無比和善，私底下卻極其陰險狡詐。"
    },
    {
        question: "【作繭自縛】正確的用法是？",
        options: ["A. 為了防範小偷而把家裡裝滿了各種複雜的防盜鎖，結果連自己出門都極度不便，真是_____。", "B. 這裡的冬天非常寒冷，他出門前特地用厚重的圍巾將自己_____，包得密不透風。", "C. 面對敵軍的包圍，我方將領決定_____，主動出擊，成功殺出了一條血路。", "D. 只要我們能夠打破舊有的思維框架，就不會_____，一定能找到創新的解決方案。"],
        correctIndex: 0,
        explanation: "比喻人做事機巧反害了自己，或是自己製造規矩、限制，讓自己陷入困境。"
    },
    {
        question: "【分道揚鑣】正確的用法是？",
        options: ["A. 兩位創辦人因為對公司未來的發展理念完全不同，最終決定_____，各自成立新公司。", "B. 在這條蜿蜒崎嶇的山路上，兩輛越野車在十字路口_____，朝著同一個終點疾馳而去。", "C. 這對原本恩愛無比的夫妻，在經過多年的爭吵後，終於決定_____，重修舊好。", "D. 隨著捷運系統的開通，原本壅塞的車流開始_____，大幅緩解了市區的交通壓力。"],
        correctIndex: 0,
        explanation: "比喻志趣、目標不同而各奔前程，或各幹各的。"
    },
    {
        question: "【世外桃源】正確的用法是？",
        options: ["A. 穿過這條狹窄的陰暗隧道後，眼前豁然開朗，一片美麗的幽靜山谷宛如_____。", "B. 自從他迷上了網路遊戲後，每天躲在房間裡，過著_____、不與任何人交流的生活。", "C. 這座大都市的商業區繁華熱鬧，高樓林立，簡直就是現代人的_____。", "D. 雖然外面的世界戰火連天，但這個小島上的居民依然過著_____的安穩日子。"],
        correctIndex: 0,
        explanation: "比喻風景優美、生活安樂而與世隔絕的地方；也用來比喻超脫現實的理想境界。"
    },
    {
        question: "【胸有成竹】正確的用法是？",
        options: ["A. 面對這場難度極高的全國數學競賽，他早就準備充分，因此_____地走進了考場。", "B. 他的胸口上刺青了一幅精美的大自然圖案，看起來真是_____，栩栩如生。", "C. 這位畫家最擅長畫植物，他畫出來的竹子簡直是_____，深受收藏家喜愛。", "D. 遇到突如其來的公關危機，他居然_____，完全不知道該如何應對，最後只好辭職。"],
        correctIndex: 0,
        explanation: "比喻在做事之前，心中早已有完整、成熟的計畫或成功的把握。"
    },
    {
        question: "【重蹈覆轍】正確的用法是？",
        options: ["A. 我們必須認真檢討這次專案失敗的原因，吸取教訓，以免下次_____，造成更大的損失。", "B. 經過幾個月的魔鬼訓練，他終於_____，重新奪回了失去多年的全國拳王寶座。", "C. 這條山路因為剛下過暴雨而泥濘不堪，車輪在上面_____，開起來非常吃力。", "D. 只要我們跟著前人的腳步前進，就一定能_____，順利找到通往山頂的正確道路。"],
        correctIndex: 0,
        explanation: "比喻不吸取教訓，再次犯下同樣的錯誤。"
    },
    {
        question: "【指桑罵槐】正確的用法是？",
        options: ["A. 經理在開會時雖然沒有指名道姓，但明眼人都聽得出來他是在_____，拐著彎批評小王。", "B. 這裡的果農非常辛勤，春天時在山坡上_____，到了秋天就能收穫滿滿的果實。", "C. 他做人一向光明磊落，有話直說，絕對不會做出_____、當面不說真話的行為。", "D. 這部諷刺喜劇透過幽默的對白_____，無情地揭露了當時政客們的虛偽嘴臉。"],
        correctIndex: 0,
        explanation: "比喻拐彎抹角地罵人，或表面上罵這個人，實際上是在罵另一個人。"
    },
    {
        question: "【得隴望蜀】正確的用法是？",
        options: ["A. 他明明已經分到了最大間的辦公室，卻還_____地想要爭奪總經理的專用車位。", "B. 站在甘肅的隴山山頂，_____，看著四川盆地的美景，真是令人心曠神怡。", "C. 只要我們能夠踏出第一步，取得階段性的成果，就一定能_____，實現最終的目標。", "D. 他的學習態度非常積極，_____，在掌握了基礎理論後，又主動去鑽研高深的研究。"],
        correctIndex: 0,
        explanation: "比喻人貪得無厭，得到這個，還想要那個。"
    },
    {
        question: "【目空一切】正確的用法是？",
        options: ["A. 自從他升任部門經理後，變得極度傲慢，簡直是_____，連總經理的意見都不放在眼裡。", "B. 這位盲人演奏家雖然雙眼失明、_____，但他的琴聲卻充滿了對生命的無窮熱愛。", "C. 站在高聳的摩天大樓觀景台上，_____，整座城市的美景盡收眼底。", "D. 經過這場突如其來的意外，他看透了名利的虛無，如今已是_____，過著平淡的生活。"],
        correctIndex: 0,
        explanation: "形容人高傲自大，瞧不起任何人。"
    },
    {
        question: "【蛛絲馬跡】正確的用法是？",
        options: ["A. 警方不放過案發現場任何的_____，經過縝密的搜查，終於找到了破案的關鍵線索。", "B. 這間廢棄的舊倉庫裡布滿了_____，顯然已經有十幾年沒有人來過了。", "C. 他做事的效率極高，有如_____，一下子就把老闆交代的艱鉅任務完成了。", "D. 這篇學術論文的結構錯綜複雜，猶如_____，讓非專業領域的人難以理解。"],
        correctIndex: 0,
        explanation: "比喻可供尋查推求的隱蔽線索或微小痕跡。"
    },
        {
        question: "【投桃報李】正確的用法是？",
        options: ["A. 既然你上次在我公司最困難時伸出援手，這次你需要幫忙，我理當_____，全力相助。", "B. 敵軍既然先發動了無情的攻擊，我們也必須_____，給予他們迎頭痛擊。", "C. 果園裡的果樹今年大豐收，農夫們紛紛_____，互相交換彼此種植的農產品。", "D. 為了順利爭取到這個大型工程案，他竟然對評審委員_____，送了許多名貴的禮物。"],
        correctIndex: 0,
        explanation: "比喻朋友之間友好往來或互相贈答；也引申為受人恩惠而懂得報答。"
    },
    {
        question: "【虛張聲勢】正確的用法是？",
        options: ["A. 敵軍的兵力其實所剩無幾，他們現在不斷鳴槍放砲，只不過是在_____，企圖嚇退我們罷了。", "B. 這場跨年造勢晚會的場面非常浩大，簡直是_____，吸引了數萬名熱情的支持者。", "C. 經理在會議上_____，拍桌大罵，讓所有員工都嚇得不敢作聲。", "D. 他的才華被媒體過度包裝，已經到了_____的地步，其實他的實力根本沒有那麼厲害。"],
        correctIndex: 0,
        explanation: "比喻本來沒有什麼實力，卻故意裝出強大的陣勢來嚇唬人。"
    },
    {
        question: "【走馬看花】正確的用法是？",
        options: ["A. 這次的歐洲五國十日遊行程實在太趕，我們對許多知名景點只能_____，完全無法深入了解。", "B. 春天到了，山坡上百花齊放，他騎著腳踏車_____，享受著美麗的風景與和煦的微風。", "C. 他看書的速度極快，有如_____，一天就能看完十本厚厚的小說。", "D. 上課時他總是_____，看著窗外發呆，完全沒有聽進去老師說的任何重點。"],
        correctIndex: 0,
        explanation: "比喻匆忙、粗略地觀察事物，沒有深入了解。"
    },
    {
        question: "【萍水相逢】正確的用法是？",
        options: ["A. 我和他在旅途中不過是_____，連真實姓名都不知道，怎麼可能會借他那麼大一筆錢？", "B. 我們兩人從小一起長大，可以說是_____，有著極度深厚且無可取代的革命情感。", "C. 這場豪雨過後，湖面上漂浮著許多落葉，呈現出一種_____的淒涼景象。", "D. 經過十多年的分離，這對好朋友終於在國外的街頭_____，兩人激動地擁抱在一起。"],
        correctIndex: 0,
        explanation: "比喻原本互不相識的人偶然相遇。"
    },
    {
        question: "【司空見慣】正確的用法是？",
        options: ["A. 台北市尖峰時段的塞車現象對當地居民來說早已是_____，大家都不會為此感到驚訝了。", "B. 這件古代的青花瓷器非常罕見，連博物館的館長都說這是他_____的稀世珍品。", "C. 這幾位政府高官在會議上為了預算問題爭論不休，互相指責，這場面真是_____。", "D. 站在高山上欣賞天空中絢麗的極光，這群遊客們不禁讚嘆這真是_____的奇景。"],
        correctIndex: 0,
        explanation: "比喻經常看到，不足為奇。"
    },
    {
        question: "【玩物喪志】正確的用法是？",
        options: ["A. 他自從迷上收集限量球鞋與打電動後，就不把心思放在課業上，導致成績一落千丈，真是_____。", "B. 他最心愛的模型不小心被弟弟打破了，氣得他_____，把弟弟狠狠地大罵了一頓。", "C. 這次搬家他不小心弄丟了許多陪伴他童年的珍貴紀念品，讓他感到非常_____。", "D. 這位雕刻師對木雕藝術有著_____的熱情，即使雙手長滿了厚厚的繭也從不輕言放棄。"],
        correctIndex: 0,
        explanation: "沉迷於所喜好的事物，而喪失了原本積極進取的志向。"
    },
    {
        question: "【鳩佔鵲巢】正確的用法是？",
        options: ["A. 這位狠毒的親戚不但把孤兒趕出家門，還_____，霸佔了他們父母留下的所有家產與豪宅。", "B. 春天一到，樹林裡的鳥兒們紛紛_____，忙著在樹枝上築巢，準備繁衍下一代。", "C. 既然你今天忘了帶傘，我們就_____，一起撐這把傘走到公車站吧。", "D. 這家知名咖啡廳雖然裝潢得很美，但裡面的客人總是_____，非常吵鬧，毫無氣氛可言。"],
        correctIndex: 0,
        explanation: "比喻強佔別人的住處、位置或財產。"
    },
    {
        question: "【刻骨銘心】正確的用法是？",
        options: ["A. 九二一大地震所帶來的傷痛與生離死別，對許多台灣人來說是一段_____的記憶，永遠無法忘懷。", "B. 這位雕刻大師在歷史紀念碑的石頭上_____地刻下了一首詩，字體非常優美大氣。", "C. 他對這個曾經嚴重陷害過他的仇人_____，發誓總有一天一定要報仇雪恨。", "D. 為了準備這次難度極高的國家考試，他每天_____地讀書，連週末假日都不肯休息。"],
        correctIndex: 0,
        explanation: "形容感受極其深刻，永遠無法忘記（多用於刻骨的愛、恨、恩情或悲痛的記憶）。"
    },
    {
        question: "【昭然若揭】正確的用法是？",
        options: ["A. 經過檢調單位連日的嚴密搜查，這家公司長期逃漏稅的犯罪事實已經_____，負責人再也無法狡辯。", "B. 早晨的太陽剛升起，把大地照得_____，讓整個大自然都充滿了生機與活力。", "C. 這位新生代作家的名氣_____，他的新書一出版就立刻登上了各大排行榜的冠軍。", "D. 關於宇宙的起源，科學家們提出了許多理論，但真相至今依然_____，沒有最終定論。"],
        correctIndex: 0,
        explanation: "形容真相完全顯露，清清楚楚地擺在大家面前（多用於指罪惡、陰謀被揭露）。"
    },
    {
        question: "【越俎代庖】正確的用法是？",
        options: ["A. 我只是個外部顧問，不便_____，替總經理做出這麼重大的公司決策。", "B. 廚房裡的廚師們忙得_____，為了準備今晚的百人國宴而滿頭大汗。", "C. 他對這項軟體開發工作早已_____，處理起來得心應手，完全不需要別人幫忙。", "D. 遇到困難時，同部門的同事本來就應該_____，互相幫忙解決問題。"],
        correctIndex: 0,
        explanation: "比喻超出自己的職責範圍，去處理別人所管的事情。"
    },
    {
        question: "【唇亡齒寒】正確的用法是？",
        options: ["A. 這兩家企業在供應鏈上是_____的關係，如果上游零件廠倒閉，下游組裝廠也撐不久。", "B. 冬天到了，強烈的寒流來襲，大家出門時都凍得_____，直發抖。", "C. 他們兩兄弟的感情極好，簡直是_____，去哪裡都要黏在一起。", "D. 他的演講非常生動有趣，而且_____，讓台下的觀眾聽得津津有味。"],
        correctIndex: 0,
        explanation: "比喻雙方關係密切，利害相關，一方遭到災禍，另一方也無法倖免。"
    },
    {
        question: "【破綻百出】正確的用法是？",
        options: ["A. 嫌犯在警方的反覆盤問下，前後供詞_____，最終只好承認了所有的罪行。", "B. 他身上這件舊外套穿了許多年，已經_____，到處都是補丁。", "C. 這位武術大師的防守動作極為嚴密，簡直是_____，讓對手找不到任何攻擊的機會。", "D. 這座老舊的吊橋在狂風中劇烈搖晃，看起來_____，非常危險。"],
        correctIndex: 0,
        explanation: "比喻說話或做事漏洞極多，很容易被識破。"
    },
    {
        question: "【欲擒故縱】正確的用法是？",
        options: ["A. 警方故意在路口撤掉攔檢點，其實是_____，為了讓歹徒放鬆警惕，藉此跟蹤到他們的首腦巢穴。", "B. 既然你已經抓到了這隻受傷的保育類動物，就應該_____，把牠治好後放回大自然。", "C. 他對這份工作完全沒有興趣，做事總是_____，敷衍了事。", "D. 面對敵軍的猛烈挑釁，我方將軍決定_____，立刻發動全面反擊。"],
        correctIndex: 0,
        explanation: "比喻為了更好地控制或達到目的，故意先放寬一步、退讓一下。"
    },
    {
        question: "【鄭人買履】正確的用法是？",
        options: ["A. 制定政策必須考量當前的社會現況，如果只會死守百年前的舊法條，那就是_____，絕對行不通。", "B. 他到百貨公司去買鞋，挑了半天還是_____，不知道到底該買哪一雙才好。", "C. 這位商人非常誠實，做生意從來不會_____，因此贏得了許多老顧客的信任。", "D. 為了趕上最新的潮流，他經常去買各種昂貴的限量版名牌鞋，簡直是_____。"],
        correctIndex: 0,
        explanation: "比喻只知死守教條，不知變通，不顧實際狀況。"
    },
    {
        question: "【鏡花水月】正確的用法是？",
        options: ["A. 沒有具體計畫與行動的夢想，到頭來終究只是_____，永遠無法在現實中實現。", "B. 這座高山湖泊的景色極美，到了夜晚更是_____，吸引了許多攝影愛好者前來取景。", "C. 她在梳妝台前把自己打扮得_____，準備參加今晚的盛大舞會。", "D. 經過多年的修練，這位大師的心境已經達到了_____的境界，不再為世俗煩惱所擾。"],
        correctIndex: 0,
        explanation: "比喻虛幻不實、空幻的景象，看得到卻摸不到、得不到。"
    },
    {
        question: "【膠柱鼓瑟】正確的用法是？",
        options: ["A. 在瞬息萬變的科技產業中，如果只會_____地套用舊有的行銷模式，公司遲早會被淘汰。", "B. 這位音樂家演奏的琴聲非常優美，猶如_____，讓全場聽眾聽得如痴如醉。", "C. 他們兩人的感情就像_____一樣緊密，任何流言蜚語都無法破壞這段友誼。", "D. 遇到突發的危機狀況時，主管總是能_____，冷靜地想出最適合的解決方案。"],
        correctIndex: 0,
        explanation: "比喻做事拘泥死板，不知變通。"
    },
    {
        question: "【臨渴掘井】正確的用法是？",
        options: ["A. 平時完全不複習，到了期末考前一晚才熬夜死背，這種_____的做法是很難拿到高分的。", "B. 在沙漠中迷路了三天，就在他們快要放棄時，終於_____，找到了一處地下水源。", "C. 為了防範未來的嚴重旱災，政府提早兩年規劃了水庫擴建，這真是_____的明智之舉。", "D. 他對這項任務早就_____，連備用方案都寫好了，所以執行起來輕鬆愉快。"],
        correctIndex: 0,
        explanation: "比喻事到臨頭才倉促想辦法，已經來不及了。"
    },
    {
        question: "【舉案齊眉】正確的用法是？",
        options: ["A. 這對老夫妻結婚五十多年來，始終_____，互相敬重，從來沒有為家務事紅過臉。", "B. 在這場舉重錦標賽中，兩位選手的實力_____，直到最後一次試舉才分出勝負。", "C. 他是一個非常有禮貌的年輕人，見到長輩總是_____，深深鞠躬問好。", "D. 這兩棟剛落成的摩天大樓建得_____，成為了這座城市最受矚目的新地標。"],
        correctIndex: 0,
        explanation: "專用於形容「夫妻」之間互相敬重。"
    },
    {
        question: "【膾炙人口】正確的用法是？",
        options: ["A. 李白的詩歌意境深遠且情感真摯，許多作品至今依然_____，被廣泛傳誦。", "B. 這家新開的燒烤店生意極好，他們的招牌烤肉真是_____，讓人忍不住垂涎三尺。", "C. 這位政客在造勢晚會上總是說些_____的口號，讓台下的年輕選民感到十分厭煩。", "D. 這種殘忍的跨國詐騙手法真是_____，引起了社會大眾與媒體的強烈譴責。"],
        correctIndex: 0,
        explanation: "比喻詩文或美好的事物受到眾人的讚賞與喜愛，廣泛流傳。"
    },
    {
        question: "【錙銖必較】正確的用法是？",
        options: ["A. 他為人極度小氣，連和朋友吃飯時幾塊錢的零頭都要_____，實在讓人難以和他深交。", "B. 他做事非常細心，對於建築圖紙上的每一個數據都_____，絕不容許有任何差錯。", "C. 為了能在奧運會上奪得金牌，這位田徑選手每天_____，拼命練習超過十個小時。", "D. 這兩家科技企業的實力相當，在市場上的競爭_____，誰也不讓誰。"],
        correctIndex: 0,
        explanation: "形容對極微小的利益或金錢都計較得非常清楚。多用來形容人小氣、斤斤計較。"
    },
    {
        question: "【飛蛾撲火】正確的用法是？",
        options: ["A. 明知道這項投資是個龐氏騙局，他卻還是_____般地把畢生積蓄全砸了進去，最後血本無歸。", "B. 夏天的夜晚，路燈下聚集了許多昆蟲，呈現出_____的自然生態現象。", "C. 消防隊員們在烈焰中_____，勇敢地衝進火場，成功救出了受困的孩童。", "D. 只要我們全體員工齊心協力，就像_____一樣，必定能為公司創造巨大的利潤。"],
        correctIndex: 0,
        explanation: "比喻人受到某種致命的誘惑，盲目地自取滅亡或自找死路。"
    },
    {
        question: "【懸梁刺股】正確的用法是？",
        options: ["A. 為了考上理想的大學醫學系，他每天_____地苦讀，就算睏了也硬撐著不肯休息。", "B. 這位雜技演員在空中表演了高難度的_____，讓台下觀眾看得心驚肉跳。", "C. 這名兇手的手法極度殘忍，竟然用_____的方式對待無辜的受害者，令人髮指。", "D. 他受到老闆的破格提拔，深受感動，決定_____，誓死效忠這家公司。"],
        correctIndex: 0,
        explanation: "比喻人為了求學而發憤苦讀，極度刻苦。"
    },
    {
        question: "【刮目相看】正確的用法是？",
        options: ["A. 以前那個總愛在班上搗蛋的小男孩，如今竟然成了揚名國際的科學家，真令人_____。", "B. 他的眼疾突然發作，醫生正在手術室裡為他_____，希望能保住他的視力。", "C. 由於他最近常常遲到早退、業績墊底，主管對他的工作態度_____，給了最差的考績。", "D. 這位名模今天的穿著實在太奇特暴露了，讓路上的行人紛紛_____，指指點點。"],
        correctIndex: 0,
        explanation: "別人已經有了顯著的進步，不能再用老眼光去看待，必須用全新的眼光來看待對方。"
    },
    {
        question: "【殺雞儆猴】正確的用法是？",
        options: ["A. 為了整頓公司渙散的紀律，總經理決定_____，嚴厲開除了幾個經常曠職的資深主管。", "B. 屠宰場裡的工人們正忙著_____，準備將新鮮的肉品運送到各大傳統市場。", "C. 他為了討好長官，竟然做出_____的事情，把同事的功勞全攬在自己身上。", "D. 這位保育人士致力於保護野生動物，堅決反對任何_____的殘忍虐待行為。"],
        correctIndex: 0,
        explanation: "比喻懲罰一個或少數幾個人，來恐嚇、警告其他人，讓他們不敢犯錯。"
    },
    {
        question: "【畫餅充飢】正確的用法是？",
        options: ["A. 老闆承諾五年後要給大家千萬分紅，但在公司連年虧損的情況下，這不過是_____罷了。", "B. 由於在深山中迷路了好幾天，他們只能靠著_____來度過飢寒交迫的夜晚。", "C. 畫家在紙上畫了一個栩栩如生的大餅，這簡直是_____，讓人看了食指大動。", "D. 這間人氣餐廳的招牌點心是_____，每天限量供應，想吃還得提早一個月預約。"],
        correctIndex: 0,
        explanation: "比喻用空想來安慰自己，或用不切實際的承諾來欺騙別人，實際上無濟於事。"
    },
    {
        question: "【覆水難收】正確的用法是？",
        options: ["A. 既然你當初在生氣時說出了那麼絕情的話，現在又想挽回這段婚姻，恐怕已經是_____了。", "B. 昨天晚上下了一場百年罕見的大暴雨，導致整個城市_____，交通完全癱瘓。", "C. 這杯果汁不小心打翻在昂貴的地毯上，真是_____，趕快拿抹布來擦乾淨吧。", "D. 面對敵軍強大的火力壓制，我方將軍決定_____，暫時撤退到後方基地防守。"],
        correctIndex: 0,
        explanation: "比喻事情已成定局，無法挽回；特別常指夫妻離異或感情破裂後難以重修舊好。"
    },
    {
        question: "【請君入甕】正確的用法是？",
        options: ["A. 警方早已識破詐騙集團的詭計，故意將計就計、_____，趁他們出面取款時將其一網打盡。", "B. 為了慶祝好友順利升遷，他特地買了一罈珍貴的女兒紅，_____，邀請大家一起痛飲。", "C. 他對客人的招待非常周到，只要有朋友來訪總是_____，讓人有賓至如歸的感覺。", "D. 這位陶藝家製作了一個精美的大陶甕，並_____，邀請各界藝術愛好者來欣賞他的作品。"],
        correctIndex: 0,
        explanation: "比喻用某人自己發明的方法來懲治他自己；或指設下圈套讓對方自己跳進來。"
    },
    {
        question: "【紙上談兵】正確的用法是？",
        options: ["A. 這些行銷理論聽起來很完美，但如果沒有實際去市場上測試消費者的反應，終究只是_____。", "B. 兩國的將軍在會議桌上_____，為了邊界的領土爭議爭論不休，氣氛十分緊張。", "C. 這位書法大師在宣紙上_____，寫下了氣勢磅礡、筆力蒼勁的千古名句。", "D. 既然合約條款都已經確認並簽訂，我們就不能再_____，必須立刻派工人動工。"],
        correctIndex: 0,
        explanation: "比喻空談理論，不能解決實際問題。"
    },
    {
        question: "【草菅人命】正確的用法是？",
        options: ["A. 那個冷血的獨裁者在統治期間_____，無數無辜的百姓未經審判就慘遭軍隊屠殺。", "B. 這位神醫的醫術高超，能夠_____，把垂死的重病患者從鬼門關前救回來。", "C. 法官在審理這起複雜的案件時_____，仔細調查了每一個證據細節，絕不冤枉好人。", "D. 為了保護國家公園裡這片珍貴的高山草地，政府下令嚴格禁止任何_____的破壞行為。"],
        correctIndex: 0,
        explanation: "形容統治者或有權勢的人隨意殘殺人民，極度輕視人命。"
    },
    {
        question: "【老馬識途】正確的用法是？",
        options: ["A. 在這片原始森林裡迷路時，幸好有這位_____的當地嚮導帶領，我們才能平安脫險。", "B. 這匹剛出生的小馬雖然跌跌撞撞，但_____，很快就學會了如何奔跑與尋找水源。", "C. 他對這項新技術完全不了解，卻硬要裝作一副_____的樣子，到處對工程師指手畫腳。", "D. 這匹名貴的賽馬在賽道上_____，把其他對手遠遠甩在後頭，順利奪冠。"],
        correctIndex: 0,
        explanation: "比喻經歷豐富、經驗老到的人熟悉情況，能在工作或困境中起引導作用。"
    },
    {
        question: "【金蟬脫殼】正確的用法是？",
        options: ["A. 警方正準備破門攻堅時，狡猾的詐騙集團首腦竟然使用了_____的計謀，留下假人後從後門溜走了。", "B. 夏天到了，樹上的昆蟲們紛紛_____，展現出大自然生生不息的奇妙生態。", "C. 他因為投資失敗而負債累累，最後落得_____的下場，連僅有的房子都被法院拍賣了。", "D. 經過十年的刻苦訓練，這位芭蕾舞者的舞技終於_____，成為了家喻戶曉的國際明星。"],
        correctIndex: 0,
        explanation: "比喻用計謀製造假象，使人產生錯覺，自己卻乘機暗中逃脫。"
    },
    {
        question: "【杯水車薪】正確的用法是？",
        options: ["A. 面對公司高達數千萬的龐大債務，他每個月只能湊出幾千塊錢來還，簡直是_____，根本無濟於事。", "B. 炎炎夏日，他在路邊買了一大杯冰水一飲而盡，這種_____的感覺真是太爽快了。", "C. 只要我們大家願意捐出_____，積少成多，一定能幫助這個貧困家庭度過這次難關。", "D. 消防隊員面對這場嚴重的森林大火，展現了_____的精神，連續奮戰了三天三夜。"],
        correctIndex: 0,
        explanation: "比喻力量太小，對於解決困難根本無濟於事。"
    },
    {
        question: "【按圖索驥】正確的用法是？",
        options: ["A. 警方根據歹徒留在現場的發票地址_____，很快就在附近的一間小旅館裡將嫌犯逮捕歸案。", "B. 這位天才畫家_____，在畫布上畫出了一匹栩栩如生的駿馬，讓人看了讚嘆不已。", "C. 他做事情總是_____，完全不遵守公司的規定和流程，讓主管非常頭痛。", "D. 面對千變萬化的國際市場，如果企業只會_____，死守著十年前的行銷教條，遲早會倒閉。"],
        correctIndex: 0,
        explanation: "比喻按照線索去尋找事物。"
    },
    {
        question: "【中流砥柱】正確的用法是？",
        options: ["A. 在公司面臨破產與高層人事大地震的動盪時刻，這位資深經理猶如_____，穩定了全體員工的軍心。", "B. 這裡的河水非常湍急，水中央有一塊巨大的石頭，真是一塊天然的_____。", "C. 他們兩人在團隊中總是_____，常常為了一點芝麻綠豆大的小事就吵得不可開交。", "D. 這位年輕球員雖然天賦異稟，但在關鍵比賽中卻總是_____，無法發揮出應有的實力。"],
        correctIndex: 0,
        explanation: "比喻在動盪艱難的環境中，能夠獨立承擔重任、起支柱作用的堅強人物或力量。"
    },
    {
        question: "【對症下藥】正確的用法是？",
        options: ["A. 在處理學生的學習障礙時，老師必須先仔細了解其家庭與心理背景，才能_____，給予最有效的輔導。", "B. 他最近感冒發燒得很嚴重，急忙跑到巷口的藥局去_____，買了一大堆成藥吞下肚。", "C. 遇到這麼棘手的困難，我們不能再_____了，必須立刻放棄原有的計畫並認賠殺出。", "D. 這位密醫不僅沒有把病人的病治好，反而_____，給了錯誤的處方，差點害出了人命。"],
        correctIndex: 0,
        explanation: "比喻針對事物的問題所在，採取有效的解決辦法。"
    },
    {
        question: "【沐猴而冠】正確的用法是？",
        options: ["A. 那個沒文化的暴發戶雖然穿著昂貴的名牌西裝，但舉止粗俗無禮，看起來就像_____，十分可笑。", "B. 動物園裡的猴子被訓練員訓練得_____，甚至會模仿人類戴上帽子，逗得遊客哈哈大笑。", "C. 這位新郎在婚禮上打扮得_____，帥氣挺拔的模樣吸引了全場賓客的目光。", "D. 將軍帶領軍隊凱旋歸來，皇帝親自為他_____，並賞賜了無數的金銀財寶。"],
        correctIndex: 0,
        explanation: "比喻虛有其表，外表裝扮得像個人樣，但本質依然低劣粗俗。"
    },
    {
        question: "【引狼入室】正確的用法是？",
        options: ["A. 他好心收留那位無家可歸的朋友住進家裡，沒想到對方竟然偷走了他所有的積蓄，這真是_____啊！", "B. 這座野生動物園的設計非常特別，遊客可以親自體驗_____的刺激感，在車內近距離觀察猛獸。", "C. 面對敵軍強大的攻勢，我方守將決定_____，把敵人誘騙到狹窄的峽谷中再一網打盡。", "D. 為了防範最近猖獗的社區小偷，他特地買了一隻兇猛的狼犬養在院子裡，這簡直是_____。"],
        correctIndex: 0,
        explanation: "比喻自己不小心把壞人招引進來，給自己帶來了災禍與危險。"
    },
    {
        question: "【作壁上觀】正確的用法是？",
        options: ["A. 看到兩位好朋友因為一點誤會而激烈爭吵，他不僅不幫忙勸解，反而_____，在一旁看熱鬧。", "B. 博物館裡的這幅巨大古羅馬壁畫非常精美，吸引了許多遊客前來_____。", "C. 既然大家都已經對這個複雜的問題束手無策了，我們不如_____，靜待事情的後續發展。", "D. 將軍站在高聳的城牆上_____，遠方的敵軍動態盡收眼底，讓軍隊能提早做好防禦準備。"],
        correctIndex: 0,
        explanation: "比喻在旁袖手旁觀，不給予任何幫助。"
    },
    {
        question: "【如火如荼】正確的用法是？",
        options: ["A. 為了迎接即將到來的建校百年校慶，全校師生正在_____地進行各項表演與場地的籌備工作。", "B. 這場可怕的森林大火延燒了三天三夜，火勢_____，把整座山頭都燒成了灰燼。", "C. 秋天到了，京都滿山的楓葉紅得_____，美不勝收，吸引了大批外國遊客前來賞楓。", "D. 他的脾氣非常暴躁，只要一不順心就會發火罵人，性格簡直是_____，讓人難以忍受。"],
        correctIndex: 0,
        explanation: "比喻事物或活動的氣氛極度熱烈、聲勢浩大。"
    },
    {
        question: "【虛與委蛇】正確的用法是？",
        options: ["A. 面對這些難纏的推銷員，他只好_____，隨便敷衍了幾句便趕緊找藉口脫身。", "B. 森林裡出現了一條巨大的毒蛇，探險隊員們只好_____，小心翼翼地繞道而行。", "C. 他的身體非常虛弱，走沒兩步路就_____，需要別人攙扶才能繼續前進。", "D. 為了這件案子，雙方律師在法庭上_____，展開了非常激烈的言辭交鋒。"],
        correctIndex: 0,
        explanation: "指假意殷勤，敷衍應付。"
    },
    {
        question: "【趨炎附勢】正確的用法是？",
        options: ["A. 那個_____的小人，看見主管就百般奉承，對待基層員工卻總是趾高氣揚。", "B. 夏天的太陽非常毒辣，大家出門時都盡量避開，絕對不會_____地走在烈日下。", "C. 遇到不公平的事情時，他總是_____，勇敢地站出來替弱勢群體發聲。", "D. 為了達到減肥的效果，她每天_____地在悶熱的健身房裡瘋狂鍛鍊。"],
        correctIndex: 0,
        explanation: "比喻奉承依附有權有勢的人。"
    },
    {
        question: "【探囊取物】正確的用法是？",
        options: ["A. 以他這幾年累積的雄厚實力和豐富經驗，要拿下這次地方比賽的冠軍簡直是_____。", "B. 他走到家門口時，把手伸進背包裡_____，拿出了一把鑰匙準備開門。", "C. 警方經過連日的埋伏守候，終於_____，將這名潛逃多年的通緝犯逮捕歸案。", "D. 這件古代青銅器的作工極其精美，真是令人想要_____，據為己有。"],
        correctIndex: 0,
        explanation: "比喻事情極容易辦到，或是目標非常容易達到。"
    },
    {
        question: "【暴虎馮河】正確的用法是？",
        options: ["A. 他做事總是不經大腦，這種_____的莽撞行為，遲早會給整個團隊帶來致命的大麻煩。", "B. 探險隊在非洲叢林裡看見了_____的驚險畫面，嚇得所有人趕緊躲起來不敢出聲。", "C. 只要我們_____，團結一致，就一定能度過這次公司面臨的嚴重財務危機。", "D. 面對百年罕見的暴風雨侵襲，堤防終於承受不住，發生了_____的嚴重水災。"],
        correctIndex: 0,
        explanation: "比喻人做事有勇無謀、魯莽冒險。"
    },
    {
        question: "【尾大不掉】正確的用法是？",
        options: ["A. 這家跨國企業因為各地分公司的權力過度膨脹，導致總公司面臨了_____的管轄危機，難以指揮。", "B. 這隻恐龍的尾巴非常巨大，走起路來_____，看起來十分笨重且遲緩。", "C. 他的個性優柔寡斷，做事總是_____，拖拖拉拉，因此錯失了許多升遷的良機。", "D. 這艘貨船因為在船尾載了太多貨物而_____，在海浪中搖搖晃晃，險象環生。"],
        correctIndex: 0,
        explanation: "比喻部下勢力強大，不聽從上級的指揮調度；也比喻事物龐大複雜，難以控制或改變。"
    },
    {
        question: "【欲速不達】正確的用法是？",
        options: ["A. 學習外語必須按部就班地打好基礎，如果一味地追求速成，往往會_____，最後什麼都沒學好。", "B. 這輛最新款的跑車速度極快，在賽道上簡直是_____，瞬間就衝過了終點線。", "C. 面對即將到來的重要考試，他每天_____地苦讀，連吃飯睡覺的時間都不願意浪費。", "D. 由於快遞公司的嚴重失誤，這個原本應該昨天送到的重要包裹至今_____，讓客戶非常生氣。"],
        correctIndex: 0,
        explanation: "比喻過分追求速度，不顧客觀規律，結果反而把事情弄糟了。"
    },
    {
        question: "【割雞焉用牛刀】正確的用法是？",
        options: ["A. 處理這種芝麻綠豆大的小糾紛，何必請出董事長親自出面協調？簡直是_____！", "B. 廚房裡的學徒因為找不到小刀，只好_____，結果不小心切到了手。", "C. 面對強大的敵軍，我們必須_____，集中所有的兵力給予他們致命的一擊。", "D. 他的廚藝非常精湛，即使是普通的食材也能_____，做出一桌色香味俱全的美味佳餚。"],
        correctIndex: 0,
        explanation: "比喻辦小事情不需要動用龐大的人力或資源（大材小用）。"
    },
    {
        question: "【畫虎類犬】正確的用法是？",
        options: ["A. 缺乏核心技術卻硬要抄襲別人的創新產品，結果往往是_____，做出來的東西四不像，反而被人嘲笑。", "B. 這位動物畫家在畫布上_____，畫了一隻威風凜凜的老虎和一隻可愛的黃狗，栩栩如生。", "C. 他為人處事總是_____，當面一套背後一套，讓人難以看透他的真心。", "D. 為了追求刺激，他竟然跑去深山裡獨自打獵，這種_____的行為實在太危險了。"],
        correctIndex: 0,
        explanation: "比喻模仿不到家，反而弄得不倫不類、貽笑大方。"
    },
    {
        question: "【抱殘守缺】正確的用法是？",
        options: ["A. 在這個數位化的時代，企業若還是_____，堅持只用純紙本來處理帳務而不肯升級，必定會被市場淘汰。", "B. 這位老爺爺非常念舊，家裡_____，堆滿了各種壞掉的家電和破銅爛鐵，連走路的地方都沒有。", "C. 即使身受重傷，他依然_____，堅持要爬到終點線完成這場馬拉松比賽。", "D. 這座古蹟雖然已經破敗不堪，但當地居民依然_____，努力籌措資金來將它修復。"],
        correctIndex: 0,
        explanation: "比喻思想保守，固守著老舊的事物或觀念，不肯接受新事物。"
    },
    {
        question: "【信口雌黃】正確的用法是？",
        options: ["A. 身為一位專業的新聞記者，報導新聞必須講求真憑實據，絕不能為了收視率而_____，隨便造謠。", "B. 面對法官的嚴厲審問，嫌犯嚇得_____，半天說不出一句完整的話來。", "C. 這位演講者的口才極佳，在台上_____，內容幽默風趣，贏得了全場觀眾的熱烈掌聲。", "D. 他在合約上不小心寫錯了字，只好拿出_____來，把錯字塗改掉重新填寫。"],
        correctIndex: 0,
        explanation: "比喻不顧事實，隨口亂說、任意捏造或批評。"
    },
    {
        question: "【名落孫山】正確的用法是？",
        options: ["A. 由於考試前沒有好好複習，這次的高考他遺憾地_____，只好準備明年重考。", "B. 這位登山客在攀登百岳時不慎_____，幸好被搜救隊及時發現，沒有生命危險。", "C. 這位大明星的緋聞事件鬧得沸沸揚揚，如今已是_____，無人不知無人不曉。", "D. 他的名字不小心從邀請名單上_____了，導致他無法參加這場盛大的晚宴。"],
        correctIndex: 0,
        explanation: "比喻考試沒有考中、落榜。"
    },
        {
        question: "【管鮑之交】正確的用法是？",
        options: ["A. 他們兩人從大學時代就一起創業，歷經無數風雨依然互相扶持，真可謂是_____。", "B. 昨天的海鮮大餐非常豐盛，尤其是那道_____，更是讓所有賓客讚不絕口。", "C. 這兩家公司在市場上為了爭奪市佔率，展開了_____，雙方互不相讓。", "D. 他對待部屬極為嚴厲，在公司裡實施_____，讓員工們感到壓力非常大。"],
        correctIndex: 0,
        explanation: "比喻交情深厚、互相了解且能互相包容的知心好友。"
    },
    {
        question: "【李代桃僵】正確的用法是？",
        options: ["A. 公司爆發嚴重的公關危機時，高層竟然讓基層員工出面_____，承擔所有的法律責任。", "B. 這裡的果園種滿了各種水果，到了春天，_____，景色美不勝收。", "C. 這位不肖商人為了賺取暴利，經常在高級茶葉裡_____，混入便宜的劣等茶。", "D. 經過了一整天的辛勞工作，他的四肢已經_____，連動都無法動彈。"],
        correctIndex: 0,
        explanation: "比喻頂替別人受過，或以此代彼、代人受罪。"
    },
    {
        question: "【防微杜漸】正確的用法是？",
        options: ["A. 對於公司的財務漏洞，我們必須_____，在問題還小的時候就立刻修補，以免日後釀成大禍。", "B. 面對敵軍的百萬大軍，我們只能_____，退守到堅固的城堡裡等待援軍。", "C. 他做事情總是_____，小心翼翼到了極點，反而錯失了許多投資的良機。", "D. 這條河流的污染問題已經到了_____的地步，所有的魚蝦都翻肚死亡了。"],
        correctIndex: 0,
        explanation: "在不良事物剛露出苗頭時就加以防範和制止，不讓它發展下去。"
    },
    {
        question: "【水落石出】正確的用法是？",
        options: ["A. 經過警方幾個月的抽絲剝繭與努力追查，這起複雜的連環殺人案終於_____，真相大白。", "B. 由於長達半年沒有下雨，水庫見底，原本淹沒在水下的古老村落終於_____。", "C. 這位雕刻大師能夠將堅硬的岩石雕成精美的藝術品，展現出_____的驚人技藝。", "D. 他對待這份工作總是_____，敷衍塞責，完全沒有把老闆的交代放在心上。"],
        correctIndex: 0,
        explanation: "比喻事情的真相完全顯露出來。"
    },
    {
        question: "【分庭抗禮】正確的用法是？",
        options: ["A. 這兩大科技巨頭在人工智慧領域的實力相當，已經到了可以_____的地步，誰也不讓誰。", "B. 他們兩人在大庭廣眾之下_____，為了一點小事吵得面紅耳赤，十分難看。", "C. 為了爭奪這份豐厚的遺產，兄弟兩人在法院裡_____，徹底撕破了臉。", "D. 他是一個非常有原則的人，對於別人送來的貴重禮物總是_____，絕不收受賄賂。"],
        correctIndex: 0,
        explanation: "比喻雙方地位、實力相當，平起平坐，相互對立或抗衡。"
    },
    {
        question: "【一鼓作氣】正確的用法是？",
        options: ["A. 既然企劃案的架構已經完成，我們就應該_____，今晚加班把它全部寫完，不要再拖延了。", "B. 看到自己的車子被別人刮傷，他忍不住_____，衝上前去理論。", "C. 這位太鼓達人在舞台上_____，震撼的鼓聲讓全場觀眾都熱血沸騰。", "D. 他的脾氣非常暴躁，只要遇到一點不順心的事情就會_____，把桌上的東西全砸了。"],
        correctIndex: 0,
        explanation: "比喻趁著士氣高昂、幹勁十足的時候，一口氣把事情做完。"
    },
    {
        question: "【心血來潮】正確的用法是？",
        options: ["A. 昨天晚上他突然_____，決定買張機票，今天一早就飛去日本吃拉麵了。", "B. 這部科幻小說是他花了十年時間、_____寫成的巨作，因此內容非常扎實。", "C. 看到這部感人的電影結局，她不禁_____，在電影院裡哭得泣不成聲。", "D. 他最近因為工作壓力太大，經常感到頭暈目眩、_____，醫生建議他多休息。"],
        correctIndex: 0,
        explanation: "心裡突然產生某個念頭或想法。"
    },
    {
        question: "【見風轉舵】正確的用法是？",
        options: ["A. 這位政客是個標準的機會主義者，總是_____，哪邊有利益就往哪邊靠攏。", "B. 這位經驗豐富的老船長在暴風雨中_____，成功帶領整艘船平安回到港口。", "C. 遇到千載難逢的創業機會，我們必須_____，緊緊抓住，千萬不能讓它溜走。", "D. 他的頭暈症狀發作時，只要一站起來就會覺得_____，必須馬上躺下休息。"],
        correctIndex: 0,
        explanation: "比喻看著情勢的變化來改變自己的態度或立場，多指見機行事、迎合有勢力的一方。"
    },
    {
        question: "【病入膏肓】正確的用法是？",
        options: ["A. 這家企業的內部貪腐問題早已_____，即使現在換了新的董事長，恐怕也無力回天了。", "B. 他昨天只是淋了點雨，今天覺得有點頭痛，於是趕緊去醫院看醫生，深怕自己_____。", "C. 護理師小心翼翼地把_____塗抹在病人的傷口上，希望能減輕他的疼痛。", "D. 經過長達半年的細心調養，他原本虛弱的身體終於_____，恢復了往日的健康。"],
        correctIndex: 0,
        explanation: "比喻病重到了無法醫治的地步；也比喻事情嚴重到了無可挽救的程度。"
    },
    {
        question: "【望其項背】正確的用法是？",
        options: ["A. 他的程式設計實力實在太強大了，同輩之中根本無人能夠_____。", "B. 經過多年的刻苦努力，他終於在成績上_____，把曾經的冠軍遠遠拋在腦後。", "C. 站在山頂上_____，看著壯麗的雲海與遠方的山峰，真是令人心曠神怡。", "D. 因為他做錯了事不敢面對，看到主管走過來，只能_____地趕快轉身逃跑。"],
        correctIndex: 0,
        explanation: "能夠望見別人的頸項和背脊，表示差距不大、趕得上。幾乎只用在否定句（如：無人能望其項背），形容差距極大，完全趕不上。"
    },
    {
        question: "【巧奪天工】正確的用法是？",
        options: ["A. 這件木雕花瓶的細節精緻到了極點，紋路栩栩如生，簡直是_____。", "B. 太魯閣峽谷的風景壯麗無比，大自然的_____，讓所有遊客都讚嘆不已。", "C. 這個商業間諜不擇手段地_____，終於把對手的企劃案偷過來當作自己的。", "D. 為了在期限內趕完這個龐大的工程，工人們每天_____，日夜不休地蓋房子。"],
        correctIndex: 0,
        explanation: "形容人類的技藝極其精巧、高超。（極易錯重點：只能用來形容「人造」的工藝，不能形容大自然）"
    },
    {
        question: "【固步自封】正確的用法是？",
        options: ["A. 企業在面對數位轉型時若一味地_____，不願接受新科技，遲早會被市場淘汰。", "B. 警方為了保護刑案現場的證據，立刻將這棟大樓_____，禁止任何人進出。", "C. 為了不讓自己受到外界干擾，他決定_____，獨自隱居在深山裡修練。", "D. 他的舞步非常獨特，在台上_____，展現出極高的藝術天分。"],
        correctIndex: 0,
        explanation: "比喻只憑舊有的成就或方法，安於現狀，不求進步。"
    },
    {
        question: "【莫衷一是】正確的用法是？",
        options: ["A. 關於這項新經濟政策的成效，與會的專家學者們_____，至今依然無法達成共識。", "B. 他明明做錯了事情，卻_____，死不認錯，讓主管非常生氣。", "C. 面對這麼多誘人的工作機會，他實在_____，最後決定全盤放棄。", "D. 經過警方的詳細調查，這件命案的真相已經_____，兇手也俯首認罪了。"],
        correctIndex: 0,
        explanation: "意思是指大家的意見分歧，無法得出一個一致的結論。"
    },
    {
        question: "【咎由自取】正確的用法是？",
        options: ["A. 他因為平時沉迷賭博而弄得傾家蕩產，這完全是_____，怨不得任何人。", "B. 這位消防員為了拯救火場中的孩童而犧牲，真是_____，令人無限敬佩。", "C. 遇到困難時，我們應該_____，努力自己想辦法解決，不能總是依賴別人。", "D. 這家超商今天舉辦大拍賣，許多商品都可以讓顧客_____，免費帶回家。"],
        correctIndex: 0,
        explanation: "災禍或罪過是自己招惹來的。比喻自作自受。"
    },
    {
        question: "【臥薪嘗膽】正確的用法是？",
        options: ["A. 經歷了公司破產的慘痛打擊後，他_____，歷經十年的努力，終於重新奪回了市場龍頭的寶座。", "B. 為了體驗古人的刻苦生活，他特地跑到深山裡_____，過著不用電器的原始日子。", "C. 他生了嚴重的重病，每天都要_____，喝下好幾碗非常苦澀的中藥湯。", "D. 為了治療他的失眠症，醫生建議他換一張好一點的床墊，不要再_____了。"],
        correctIndex: 0,
        explanation: "比喻刻苦自勵，發憤圖強，以期報仇雪恨或復興事業。"
    },
    {
        question: "【滄海一粟】正確的用法是？",
        options: ["A. 在浩瀚無垠的宇宙與悠久的歷史長河中，我們每個人的一生都不過是_____，極其微小。", "B. 這場突如其來的海底大地震引發了_____，瞬間淹沒了整個沿海的城鎮。", "C. 這位將軍憑藉著_____的勇氣，獨自一人衝入敵陣，成功斬殺了敵軍首領。", "D. 為了度過即將到來的寒冬，農夫們把穀倉裡裝滿了_____，足夠全村人吃上一整年。"],
        correctIndex: 0,
        explanation: "大海裡的一粒小米。比喻事物非常渺小，微不足道。"
    },
    {
        question: "【拾人牙慧】正確的用法是？",
        options: ["A. 他發表的這篇評論文章毫無創見，通篇都是_____，全都是抄襲網路上別人的觀點。", "B. 這位專業的牙醫師在診所裡_____，細心地幫病人清理牙齒上的牙結石與污垢。", "C. 看到地上有別人掉落的名貴錢包，他毫不猶豫地_____，偷偷塞進自己的口袋裡。", "D. 他非常聰明機警，總是能_____，從對手的話語中找出破綻並給予反擊。"],
        correctIndex: 0,
        explanation: "比喻抄襲別人的言論或竊取別人的創見，當作自己的說辭。"
    },
    {
        question: "【待價而沽】正確的用法是？",
        options: ["A. 這位老收藏家手裡握著一幅絕世名畫，目前正_____，等著在秋季拍賣會上賣個好價錢。", "B. 股市傳出重大利空消息，投資人紛紛恐慌地_____，急著把手上的持股全部倒貨賣出。", "C. 這家連鎖超市的生鮮商品今天晚上全面五折，婆婆媽媽們都在_____，準備搶購便宜貨。", "D. 為了買到那雙全球限量的名牌球鞋，他每天在店門口_____，排了好幾個小時的隊。"],
        correctIndex: 0,
        explanation: "比喻有才能的人等待受到賞識重用才肯出仕；現多用來比喻等待好的時機或條件才肯答應某事，或真的指商品等待高價出售。"
    },
    {
        question: "【萬人空巷】正確的用法是？",
        options: ["A. 知名棒球明星奪下世界冠軍後回到家鄉遊行，造成了_____的盛況，大家都跑去街上歡呼了。", "B. 由於嚴重的傳染病肆虐，政府下令封鎖整座城市，原本繁華的市中心如今_____，冷清得可怕。", "C. 經過那場毀滅性的強烈地震後，這條巷子裡的房屋全倒了，變成了一條_____的廢墟。", "D. 他為人極度孤僻，脾氣又壞，導致身邊的朋友都離他而去，落得_____的孤單下場。"],
        correctIndex: 0,
        explanation: "比喻轟動一時的盛況，極度熱鬧，人潮擁擠。（極易錯重點：形容人多、極度熱鬧，絕非冷清！）"
    },
    {
        question: "【美侖美奐】正確的用法是？",
        options: ["A. 這棟剛落成的歌劇院外觀設計極具現代感，內部裝潢更是_____，令人嘆為觀止。", "B. 她今天穿著一身名家設計的晚禮服，顯得_____，一出場就奪取了全場的目光。", "C. 這位新生代歌手的嗓音清亮甜美，歌聲簡直是_____，聽了讓人身心舒暢。", "D. 為了慶祝交往三週年，他送給女友一條_____的鑽石項鍊當作紀念禮物。"],
        correctIndex: 0,
        explanation: "形容房屋、建築物等高大宏偉、裝飾華麗。（極易錯重點：只能用來形容「建築物」，不能形容人或衣服）"
    },
    {
        question: "【不孚眾望】正確的用法是？",
        options: ["A. 由於這項新產品在上市後陸續爆出嚴重的品質瑕疵，這家品牌終究_____，失去了消費者的信任。", "B. 他在這次的短跑決賽中一舉奪下金牌，_____，成功為國家爭取了最高的榮譽。", "C. 雖然遭遇了重重的阻礙與困難，他依然_____，帶領著全體隊員完成了這項艱鉅的任務。", "D. 為了答謝支持者，這名候選人承諾當選後一定會_____，為地方爭取更多的建設預算。"],
        correctIndex: 0,
        explanation: "不能使群眾信服，或不符合大家的期望。（與褒義的「不負眾望」意思相反）"
    },
    {
        question: "【明日黃花】正確的用法是？",
        options: ["A. 這款手機在三年前雖然紅極一時，但在科技迭代迅速的今天，早就成了_____，無人問津。", "B. 經過了一整晚的大雨摧殘，花園裡的菊花紛紛凋謝，呈現出一片_____的淒涼景象。", "C. 氣象局預報指出，明天的天氣會非常晴朗，山坡上將會是一片_____，極適合出遊。", "D. 只要我們能夠跟上時代的潮流，就不會被社會淘汰，甚至能成為_____，引領風騷。"],
        correctIndex: 0,
        explanation: "比喻過時的事物，或失去新聞價值的消息。"
    },
    {
        question: "【胸無點墨】正確的用法是？",
        options: ["A. 他雖然表面上裝得像個滿腹經綸的學者，但只要一開口談論學術，就會暴露出他_____的本質。", "B. 這位書法家下筆極為乾淨俐落，寫出來的字跡_____，卻顯得氣勢磅礡、力透紙背。", "C. 他做事情總是光明磊落、大公無私，心中_____，因此深得同事與下屬的敬重。", "D. 由於他不小心把墨水倒在了名貴的西裝上，導致他的衣服上_____，看起來十分狼狽。"],
        correctIndex: 0,
        explanation: "比喻人毫無學問，缺乏文化素養。"
    },
    {
        question: "【推心置腹】正確的用法是？",
        options: ["A. 經理對待員工一向真誠，經常找大家_____地談心，因此團隊凝聚力非常強。", "B. 這位外科醫生的手術技術極其高超，在處理難度極高的_____手術時從未失手。", "C. 在這場激烈的生存遊戲中，他居然_____，把自己的弱點暴露給對手，導致被淘汰。", "D. 面對主管不合理的嚴厲指責，他_____，低著頭不敢為自己做任何辯解。"],
        correctIndex: 0,
        explanation: "比喻以真誠的心意對待他人，毫無保留。"
    },
    {
        question: "【首當其衝】正確的用法是？",
        options: ["A. 隨著這波強烈寒流來襲，地處最北端的山區小鎮_____，氣溫瞬間驟降到了零度以下。", "B. 在這次的全國馬拉松大賽中，他一開局就_____，以驚人的速度一路領先到終點。", "C. 這項新研發的科技項目非常重要，是我們公司今年_____的核心任務。", "D. 為了爭取最新的商機，身為業務經理的他決定_____，親自飛去美國拜訪客戶。"],
        correctIndex: 0,
        explanation: "比喻最先受到攻擊，或第一步遭受到災害、衝擊、打擊。"
    },
    {
        question: "【無懈可擊】正確的用法是？",
        options: ["A. 他的這篇學術論文推導邏輯極度嚴密、論據充足，在同行審查中被評價為_____。", "B. 由於他的防守動作非常緩慢，在比賽中破綻百出，簡直是_____，輕易被對手擊倒。", "C. 兩家公司因為嚴重的合約糾紛而撕破臉，在商場上展開了_____的惡意訴訟。", "D. 雖然他這人脾氣很壞、人緣極差，但在專業技能上卻是_____，根本沒人想僱用他。"],
        correctIndex: 0,
        explanation: "沒有任何漏洞或破綻可讓人攻擊。形容十分嚴密，找不到任何破綻或缺點。"
    },
    {
        question: "【不脛而走】正確的用法是？",
        options: ["A. 關於公司即將被跨國集團收購的傳聞，一天之內就在辦公室裡_____，鬧得人心惶惶。", "B. 這個小偷非常狡猾，趁著夜色悄悄潛入民宅，_____地偷走了保險箱裡的金條。", "C. 自從他遭遇了嚴重的車禍後，雙腿不幸殘疾，從此只能過著_____的輪椅生活。", "D. 面對歹徒的持刀威脅，他嚇得魂飛魄散，立刻_____，拼命往派出所的方向跑去。"],
        correctIndex: 0,
        explanation: "比喻事物或消息不待推行，就迅速傳播、流傳開來。"
    },
    {
        question: "【差強人意】正確的用法是？",
        options: ["A. 雖然這部電影的特效做得很棒，但劇情卻只是_____，勉強算及格而已。", "B. 他這次的期末考成績退步太多，簡直是_____，讓父母大失所望。", "C. 歹徒的犯案手法極度殘酷，做出的事情令人_____，引起了社會公憤。", "D. 這家米其林餐廳的菜色豐富且美味，服務態度更是_____，非常值得推薦。"],
        correctIndex: 0,
        explanation: "大體上還算能使人滿意，勉強及格。（極易錯重點：絕對不是「令人失望」！）"
    },
    {
        question: "【不以為然】正確的用法是？",
        options: ["A. 大家都覺得這項投資計畫大有可為，只有他_____，認為風險太高不該投資。", "B. 對於網路上那些酸民的惡意批評，他總是_____，完全不放在心上。", "C. 事情既然已經發生了，我們就_____吧，別再追究到底是誰的責任了。", "D. 他做錯事卻還_____，甚至覺得自己很了不起，這種態度真是厚顏無恥。"],
        correctIndex: 0,
        explanation: "表示「不同意、不贊同」對方的觀點或做法。"
    },
    {
        question: "【空穴來風】正確的用法是？",
        options: ["A. 關於這家公司即將破產的傳聞並非_____，因為許多供應商都已經連續三個月收不到貨款了。", "B. 炎炎夏日，他打開窗戶希望能有一絲_____，好讓室內涼爽一點。", "C. 遇到困難時我們不能_____，必須腳踏實地去找出解決問題的方法。", "D. 為了掩飾自己的過錯，他竟然在會議上_____，編造了一套謊言來欺騙老闆。"],
        correctIndex: 0,
        explanation: "原指消息和傳言事出有因；現代多引申為憑空捏造、毫無根據的謠言（常以否定句「並非空穴來風」表示有根據）。"
    },
    {
        question: "【休戚與共】正確的用法是？",
        options: ["A. 這兩家企業簽署了深度合作的戰略同盟，承諾在未來的市場競爭中_____，互相支援。", "B. 他們兩兄弟為了爭奪龐大的家產而撕破臉，從此_____，不相往來。", "C. 這對夫妻雖然經常為了小事吵架，但很快就能_____，感情依然很好。", "D. 經過多年的努力，這家本土公司終於在技術上與國際大廠_____，平起平坐。"],
        correctIndex: 0,
        explanation: "彼此之間的歡樂與悲哀共同分享與承受。比喻關係密切，利害一致。"
    },
    {
        question: "【振聾發聵】正確的用法是？",
        options: ["A. 這位思想家在論壇上發表了一場_____的演說，徹底喚醒了當時迷惘的年輕一代。", "B. 這場重金屬搖滾演唱會的音響開得太大了，簡直是_____，讓人耳朵受不了。", "C. 聽到這個突如其來的悲慘消息，他整個人_____，久久無法回神。", "D. 每天早晨鬧鐘的聲音雖然_____，但他還是習慣賴在床上不肯起來。"],
        correctIndex: 0,
        explanation: "發出極大的聲音，使耳聾的人也能聽見。比喻用語言或文字喚醒糊塗、麻木的人。"
    },
    {
        question: "【春風化雨】正確的用法是？",
        options: ["A. 在王老師_____的教導下，許多原本調皮搗蛋的學生都改過自新，走上了正途。", "B. 經過一場_____的洗禮，乾旱已久的農田終於得到了滋潤，秧苗重新抬起了頭。", "C. 遇到這麼大的挫折，幸好有朋友_____般的安慰，他才重新振作起來。", "D. 今天的氣候非常宜人，_____，正是全家人出外郊遊、踏青的好時機。"],
        correctIndex: 0,
        explanation: "比喻良好的教育普及各地；專用於讚美師長和藹親切的教導。"
    },
    {
        question: "【曲突徙薪】正確的用法是？",
        options: ["A. 為了防止機密資料再次外洩，資訊部門決定_____，全面升級公司的資安防火牆系統。", "B. 發生森林大火時，消防隊員們_____，冒著生命危險衝進火場救出受困民眾。", "C. 他做事情總是拖拖拉拉，不到最後關頭絕不_____，讓人非常頭痛。", "D. 這家餐廳的生意原本很好，後來因為換了主廚而_____，顧客漸漸流失了。"],
        correctIndex: 0,
        explanation: "將直的煙囪改彎，把灶旁的柴草移開。比喻事先採取預防措施，防患未然。"
    },
    {
        question: "【大相逕庭】正確的用法是？",
        options: ["A. 針對如何解決交通壅塞的問題，兩位學者的看法_____，完全無法達成共識。", "B. 這座古代皇宮的建築風格極其宏偉，尤其是那座_____，更是令人嘆為觀止。", "C. 他們兩兄弟雖然長相十分神似，但個性卻_____，因此經常為了一點小事吵架。", "D. 經過長途跋涉，他們終於穿越了沙漠，來到了一個宛如_____般美麗的綠洲。"],
        correctIndex: 0,
        explanation: "比喻兩者相差極遠，或彼此的觀點、意見完全不同。"
    },
    {
        question: "【相形見絀】正確的用法是？",
        options: ["A. 他的攝影技術雖然不錯，但在這位國際級藝術大師的名作旁邊，就顯得_____了。", "B. 為了掩飾自己在專業知識上的無知，他總是_____，假裝自己什麼都懂。", "C. 這兩家跨國公司的實力相當，在國際市場上的表現可說是_____，難分高下。", "D. 他做錯事被主管當眾抓包後，羞愧得_____，恨不得立刻找個地洞鑽進去。"],
        correctIndex: 0,
        explanation: "互相比較之下，顯得自己的不足或遜色。"
    },
    {
        question: "【三令五申】正確的用法是？",
        options: ["A. 儘管公司高層已經_____禁止員工在上班時間炒股，但他依然故我，最後遭到開除。", "B. 為了成功推銷這項產品，他每天_____地去拜訪那位固執的客戶，毫不氣餒。", "C. 面對敵軍的嚴刑拷打，這位英勇的情報員依然_____，堅決不透露半句國家機密。", "D. 為了讓新產品曝光，公司在各大電視媒體上_____，花了大筆預算進行宣傳。"],
        correctIndex: 0,
        explanation: "多次發布命令，一再告誡。通常用於具有權力或管理地位的人對下屬發出的嚴厲警告。"
    },
    {
        question: "【胸無城府】正確的用法是？",
        options: ["A. 小明性格直爽、_____，有什麼就說什麼，從來不會在背後耍心機，深受大家喜愛。", "B. 像他這種整天只想著打電動、_____的人，這輩子是不可能會有什麼大成就的。", "C. 這位建築師因為_____，一連修改了十幾次設計圖，還是蓋不出一棟穩固的大樓。", "D. 由於對這門學問_____，他在研討會上完全回答不出評審委員提出的任何專業問題。"],
        correctIndex: 0,
        explanation: "胸中沒有城池防防。形容人性格坦率真誠，毫無心機。（極易錯重點：常被誤認為是「胸無大志」的貶義詞，其實是褒義詞）"
    },
    {
        question: "【作法自斃】正確的用法是？",
        options: ["A. 他為了偷懶而寫了一套自動化程式來應付工作，沒想到系統出錯導致所有資料被刪除，真是_____。", "B. 這位老中醫一生研究各種養生法門，並_____，每天清晨在公園裡鍛鍊身體，活到了一百歲。", "C. 面對敵軍強大的攻勢，我方將軍決定_____，主動撤去所有的城防防禦，誘敵深入。", "D. 為了徹底消滅這群狡猾的害蟲，農夫們決定_____，在田裡噴灑大量的劇毒殺蟲劑。"],
        correctIndex: 0,
        explanation: "比喻自己制定的法律或方法，結果反而害了自己。"
    },
    {
        question: "【分秒必爭】正確的用法是？",
        options: ["A. 考前倒數最後一週，所有考生都在_____地複習功課，希望能多記下一個重點。", "B. 他在商場上非常有原則，對於每一筆帳目的金錢零頭都_____，絕不吃虧。", "C. 這兩位短跑好手在賽道上展開了_____的激烈對決，直到最後一刻才分出勝負。", "D. 由於他的脾氣非常暴躁，只要遇到別人稍微遲到，就會在現場_____，大發雷霆。"],
        correctIndex: 0,
        explanation: "形容時間非常珍貴，哪怕是一分一秒都要積極爭取。"
    },
    {
        question: "【一葉障目】正確的用法是？",
        options: ["A. 在評估投資風險時，我們必須全面考量，千萬不能_____，只因為眼前的蠅頭小利而忽略了巨大的危機。", "B. 這裡的森林非常茂密，抬頭望去，滿眼都是巨大的綠葉，真可謂是_____。", "C. 這位魔術師的手法極其高超，在舞台上表演了_____的精彩魔術，瞞過了全場觀眾的眼睛。", "D. 為了不讓刺眼的陽光影響視線，他在開車時特地戴上了墨鏡來_____。"],
        correctIndex: 0,
        explanation: "一片樹葉擋住了眼睛，就看不見外面的泰山。比喻被眼前的局部或暫時的現象所迷惑，無法看清事物的全貌或本質。"
    },
    {
        question: "【出神入化】正確的用法是？",
        options: ["A. 這位鋼琴大師的演奏技巧已經達到了_____的境界，琴聲流暢得彷彿具有靈魂。", "B. 自從他迷上了寫恐怖小說後，每天躲在房間裡過著_____、不與人交往的生活。", "C. 昨晚他做了一個非常離奇的夢，夢見自己居然有了_____、穿越時空的超能力。", "D. 這部科幻電影的特效做得非常差，畫面粗糙，看起來簡直是_____，讓人大失所望。"],
        correctIndex: 0,
        explanation: "形容技藝高超達到了神妙、超凡的絕佳境界。"
    },
    {
        question: "【口是心非】正確的用法是？",
        options: ["A. 他表面上答應會全力支持我的企劃，私底下卻到處說我的壞話，這種_____的小人真不值得信任。", "B. 雖然他這次考得很差，但他還是_____地告訴大家，自己一定會繼續努力，不會放棄。", "C. 面對主管不合理的指責，他雖然覺得很委屈，但還是_____地承認了自己的錯誤。", "D. 他的口才極佳，邏輯清晰，在辯論會上講得_____，讓對手完全無法反駁。"],
        correctIndex: 0,
        explanation: "嘴上說的是一套，心裡想的卻是另一套。形容言行不一、虛偽欺騙。"
    },
    {
        question: "【一鳴驚人】正確的用法是？",
        options: ["A. 他平時在班上默默無聞，這次竟然在全國物理競賽中一舉奪下金牌，真是_____！", "B. 他的脾氣非常暴躁，只要一不順心就會在大庭廣眾之下_____，嚇壞所有人。", "C. 突如其來的強烈地震發出巨大的聲響，_____，整棟大樓的人都尖叫著逃了出來。", "D. 他的歌聲非常宏亮，只要一開口唱歌就能_____，甚至連百公尺外的教室都聽得到。"],
        correctIndex: 0,
        explanation: "比喻平時默默無聞，一旦有機會施展才華，就做出驚人的成績。"
    },
    {
        question: "【落井下石】正確的用法是？",
        options: ["A. 在他公司宣告破產、四面楚歌的時候，昔日的合作夥伴居然聯合提告逼債，這種_____的行為太無良了。", "B. 為了測試這口古井的深度，他順手拿起了路邊的一塊_____，用力丟了下去。", "C. 就在這家孤兒院即將面臨斷炊的困難危機之際，他_____地送來了一大筆捐款與物資。", "D. 面對敵軍在山谷中設下的埋伏，我方將軍決定採取_____的戰術，將敵人全數殲滅。"],
        correctIndex: 0,
        explanation: "看見別人掉進井裡，不但不拉他上來，反而往井裡丟石頭。比喻乘人有危難時，加以陷害或打擊。"
    },
    {
        question: "【不恥下問】正確的用法是？",
        options: ["A. 他雖然是學術界的資深教授，但遇到不熟悉的新科技領域時依然_____，向年輕的大學生請教。", "B. 他做錯事不但不承認，反而_____，大聲反駁別人，真是毫無羞恥心。", "C. 身為學生的我們，遇到不懂的問題就應該_____，多向老師或長輩請益。", "D. 遇到不懂的問題就該自己查書，千萬不能_____，養成過度依賴別人的壞習慣。"],
        correctIndex: 0,
        explanation: "不以向身分較低、或是學問較差的人請教為恥。形容人極度謙虛好學。（極易錯重點：必須是上對下請教，不能倒過來用！）"
    },
    {
        question: "【杯盤狼藉】正確的用法是？",
        options: ["A. 盛大的婚宴結束後，賓客紛紛散去，只留下桌上的_____，服務生們正忙著清理打掃。", "B. 他的房間已經好幾個月沒打掃了，到處都是垃圾與舊衣服，簡直是_____。", "C. 這些小混混在餐廳裡吃霸王餐，還把店裡砸得_____，老闆氣得立刻報警。", "D. 颱風過後，整個社區的樹木被連根拔起，招牌散落一地，呈現出一片_____的景象。"],
        correctIndex: 0,
        explanation: "形容宴會結束後，桌上酒杯、盤子等餐具雜亂不整的樣子。（極易錯重點：專指「宴飲後」的餐具凌亂，不能形容房間或環境的雜亂）"
    },
    {
        question: "【韋編三絕】正確的用法是？",
        options: ["A. 為了考上理想的大學，他每天_____地苦讀，把參考書都翻得破舊不堪了。", "B. 這位工匠的手藝極差，編織的竹簍沒用幾次就_____，完全不能裝東西。", "C. 他們兩人的感情非常脆弱，只要一吵架就會_____，鬧著要分手。", "D. 他的武術動作非常猛烈，甚至能_____，展現出驚人的破壞力。"],
        correctIndex: 0,
        explanation: "孔子因為太常翻閱《易經》，把串竹簡的牛皮繩都翻斷了好幾次。比喻讀書非常勤奮刻苦。"
    },
    {
        question: "【如坐針氈】正確的用法是？",
        options: ["A. 由於他不小心弄丟了公司的重要文件，現在坐在老闆辦公室門口等待處分，簡直是_____。", "B. 這張沙發的材質非常粗糙，_____，坐上去一點都不舒服。", "C. 經過了一整天的辛勞工作，他現在只想_____，好好地休息一下。", "D. 這位中醫師的針灸技術極好，讓病人_____，瞬間解除了腰酸背痛的毛病。"],
        correctIndex: 0,
        explanation: "像坐在插滿針的墊子上。比喻人心中極度焦慮、害怕或不安，坐立難安。"
    },
    {
        question: "【白雲蒼狗】正確的用法是？",
        options: ["A. 十年後重新回到家鄉，發現當初的農田已經變成了高樓大廈，真令人感嘆世事_____。", "B. 抬頭仰望天空，只見_____，天氣非常晴朗，正是全家出遊的好日子。", "C. 他養了一隻非常可愛的_____，每天傍晚都會帶牠去公園散步。", "D. 這位藝術家的畫筆下，_____，描繪出了一幅幅生動的農村美景。"],
        correctIndex: 0,
        explanation: "天上的浮雲原本像白衣，瞬間又變成了灰狗的形狀。比喻世事變幻無常，變化極快。"
    },
        {
        question: "【目無全牛】正確的用法是？",
        options: ["A. 這位資深外科醫生的開刀技術已經達到了_____的境界，動作極度精準且迅速，從未失誤。", "B. 他自從當上主管後就變得非常傲慢，簡直是_____，連老闆的命令都不放在眼裡。", "C. 這家牛排館的廚師因為沒有看清楚菜單，竟然_____，上錯了客人的餐點。", "D. 這頭巨大的水牛在草原上狂奔，氣勢驚人，讓人看了_____。"],
        correctIndex: 0,
        explanation: "比喻技藝純熟高超，得心應手。（極易錯重點：這是極度的讚美詞，絕對不是「目中無人」的貶義詞！）"
    },
    {
        question: "【投鞭斷流】正確的用法是？",
        options: ["A. 敵軍號稱有百萬大軍，軍容壯盛，氣勢之大簡直可以_____，讓我方守軍感到十分畏懼。", "B. 這位武術大師力大無窮，只要一揮動手中的鞭子，就能_____，威力驚人。", "C. 面對洶湧的洪水，村民們_____，終於成功堵住了決堤的缺口。", "D. 這條河流水勢湍急，想要徒步涉水而過根本是_____，太危險了。"],
        correctIndex: 0,
        explanation: "比喻軍隊數量極多、兵力強大。"
    },
    {
        question: "【大快朵頤】正確的用法是？",
        options: ["A. 看到滿桌豐盛的海鮮大餐，大家紛紛拿起碗筷，準備_____一番。", "B. 他在這次的比賽中幸運地獲得了冠軍，心情_____，高興地在台上跳了起來。", "C. 這位牙醫師正在幫病人拔牙，動作迅速，讓病人_____，一點都不覺得痛。", "D. 讀了這本精彩絕倫的武俠小說，真是讓人_____，拍案叫絕。"],
        correctIndex: 0,
        explanation: "指痛痛快快地大吃一頓。"
    },
    {
        question: "【瓜熟蒂落】正確的用法是？",
        options: ["A. 只要我們平時努力累積實力，等到機會來臨時，成功自然是_____的事。", "B. 秋天到了，果園裡的_____，農夫們正忙著採收豐碩的果實。", "C. 因為缺乏資金，這項原本被看好的科技投資案最終_____，被迫中途放棄。", "D. 他的脾氣非常暴躁，就像_____一樣，說發火就發火，完全沒有任何預兆。"],
        correctIndex: 0,
        explanation: "比喻客觀條件成熟了，事情自然就會成功。"
    },
    {
        question: "【不刊之論】正確的用法是？",
        options: ["A. 這篇社論見解精闢，字字珠璣，堪稱_____，值得所有人細細品讀與收藏。", "B. 這篇文章內容充滿了不實的造謠與低俗的謾罵，是一篇_____，雜誌社絕對不會採用。", "C. 他在會議上被主管問得啞口無言，最後只能發表了一番_____，讓大家十分尷尬。", "D. 這本小說的劇情無聊透頂，簡直是_____，難怪出版後賣得這麼差。"],
        correctIndex: 0,
        explanation: "比喻文章或言論極其正確、精準，無法再做任何修改，不可磨滅。（極易錯重點：表示不能更改的精確言論，絕對不是不能刊登！）"
    },
    {
        question: "【文不加點】正確的用法是？",
        options: ["A. 這位天才作家才思敏捷，寫作時總是_____，不到半小時就完成了一篇精彩的千字長文。", "B. 這位小學生的作文寫得密密麻麻，整篇_____，連個逗號都沒有，讓老師看得喘不過氣來。", "C. 這幅水墨畫的構圖極簡，_____，沒有多餘的裝飾，卻有一種獨特的留白之美。", "D. 他說話總是結結巴巴、_____，讓人很難理解他到底想表達什麼。"],
        correctIndex: 0,
        explanation: "形容人的文思敏捷，寫作技巧極高。（極易錯重點：表示文思敏捷、寫作一氣呵成，絕對不是不加標點符號！）"
    },
    {
        question: "【陽春白雪】正確的用法是？",
        options: ["A. 這部抽象派的實驗電影藝術性極高，但難免有_____之憾，一般大眾很難看懂，票房並不理想。", "B. 經過了一整晚的強烈寒流，清晨的山頭覆蓋著一層_____，風景十分迷人。", "C. 這家平價小吃店的滷肉飯雖然便宜，卻是當地居民心中的_____，每天都大排長龍。", "D. 遇到挫折時，朋友的一句溫暖安慰就像_____，瞬間融化了我心中的冰冷。"],
        correctIndex: 0,
        explanation: "比喻高深、不通俗的文學藝術作品。"
    },
    {
        question: "【曾參殺人】正確的用法是？",
        options: ["A. 網路上的假新聞傳播速度極快，常常造成_____的效應，連無辜的好人都會被社會大眾定罪。", "B. 這起震驚社會的連環命案手法兇殘，簡直是_____，讓附近的居民人心惶惶。", "C. 他雖然是個剛入職的新手，但在這次專案中卻能_____，獨自解決了所有技術難題。", "D. 警方經過仔細的搜查與推理，終於找到了_____的關鍵證據，將潛逃的真兇逮捕歸案。"],
        correctIndex: 0,
        explanation: "比喻流言可畏，謊言重複多次就能使人信以為真。"
    },
    {
        question: "【首鼠兩端】正確的用法是？",
        options: ["A. 面對這兩個條件同樣優渥的跨國工作機會，他_____，猶豫了好幾週都遲遲無法做出最終決定。", "B. 這間廢棄的舊倉庫裡環境非常髒亂，常常可以看到_____在四處竄逃，十分嚇人。", "C. 他做事情總是_____，沒有把細節顧好就急著交差，因此被老闆狠狠地罵了一頓。", "D. 雙方軍隊在狹窄的峽谷中相遇，展開了_____的激烈戰鬥，雙方死傷都非常慘重。"],
        correctIndex: 0,
        explanation: "比喻人遲疑不決，動搖不定，在兩者之間猶豫。"
    },
    {
        question: "【罪不容誅】正確的用法是？",
        options: ["A. 這個殘酷的叛國賊出賣了無數國家機密，導致前線將士死傷慘重，簡直是_____，死不足惜。", "B. 他雖然偷了超商的麵包，但也是為了救病重挨餓的母親，情有可原，實屬_____，法官應該輕判。", "C. 警方在案發現場找不到任何指紋與線索，讓這起命案變得_____，陷入了長時間的膠著。", "D. 他在商場上總是_____，不留給對手任何活路，惡劣的商業手段讓同行非常畏懼。"],
        correctIndex: 0,
        explanation: "罪惡極大，就算把他殺了也無法抵償他的罪過。形容罪大惡極。（極易錯重點：表示罪大惡極，絕對不是罪不該死！）"
    },
    {
        question: "【屢試不爽】正確的用法是？",
        options: ["A. 奶奶傳授的這個治療打嗝的民間偏方非常有效，我每次用都_____，立刻就能止住打嗝。", "B. 他這次參加汽車駕照考試又因為壓線而失敗了，真是_____，讓他感到非常沮喪與憤怒。", "C. 這件衣服的尺寸實在太小了，我_____，穿脫都非常卡，最後只好拿去百貨公司退貨。", "D. 面對同事們週末去唱歌看電影的熱情邀約，他總是_____，從來不參加任何社交聚會。"],
        correctIndex: 0,
        explanation: "多次試驗都沒有差錯。比喻方法非常有效，每次用都靈驗。（極易錯重點：表示每次試都很成功/準確，絕對不是試了很不爽！）"
    },
    {
        question: "【侃侃而談】正確的用法是？",
        options: ["A. 面對眾多資深學者的嚴厲提問，這位年輕的研究員依然_____，展現出極高的自信與專業度。", "B. 那個詐騙集團的首腦在說明會上_____，用各種誇大不實的話術騙取老人家購買假藥。", "C. 他為人非常害羞內向，一走上講台就_____，緊張到半天擠不出一句完整的話。", "D. 兩位久別重逢的老朋友坐在咖啡廳裡_____，一邊喝茶一邊互相傾訴著這幾年來的心酸。"],
        correctIndex: 0,
        explanation: "形容人說話理直氣壯，從容不迫。"
    },
    {
        question: "【不瘟不火】正確的用法是？",
        options: ["A. 這部文藝片的劇情發展_____，雖然沒有好萊塢大片的刺激特效，卻能讓人細細品味生活的美好。", "B. 最近秋天的天氣_____，非常涼爽舒適，最適合全家人一起去山上野餐踏青了。", "C. 只要大家平時落實消毒與居家安全檢查，就能保證整個社區_____，沒有任何災難發生。", "D. 他的脾氣極度暴躁，遇到一點點不順心的小事就會_____，把桌上的東西全掃到地上。"],
        correctIndex: 0,
        explanation: "原形容戲曲表演既不沉悶也不急促，恰到好處。現多用來形容事情發展平淡、沒有波瀾，或人的性格溫和。"
    },
    {
        question: "【萬馬齊喑】正確的用法是？",
        options: ["A. 在那段極權統治的白色恐怖時期，整個社會_____，知識分子們都不敢公開發表任何言論。", "B. 凌晨的賽馬場馬廄裡非常安靜，_____，所有的動物都在舒適的草堆中熟睡。", "C. 這次的校慶拔河比賽，全班同學_____，大聲吶喊為場上的選手加油打氣。", "D. 隨著疫情結束、經濟快速復甦，這座城市又恢復了_____的熱鬧繁華景象。"],
        correctIndex: 0,
        explanation: "比喻人們沉默不語，或社會政治沉悶，缺乏言論自由與生機。"
    },
    {
        question: "【空前絕後】正確的用法是？",
        options: ["A. 這位傳奇球星在同一屆奧運上創下的八面金牌紀錄，可說是_____，至今無人能打破。", "B. 這場演唱會的宣傳做得太差，導致開唱時現場_____，連前排的座位都沒坐滿。", "C. 那個惡霸在鄉里間做盡了壞事，最後落得_____的淒慘下場，沒有留下任何子嗣。", "D. 發生了這麼嚴重的失誤，他嚇得腦袋一片空白，_____，完全不知道該怎麼辦才好。"],
        correctIndex: 0,
        explanation: "形容成就極高或情況極為特殊，超越古今，獨一無二。"
    },
    {
        question: "【按部就班】正確的用法是？",
        options: ["A. 學習一門新的程式語言必須_____，從最基礎的語法開始練起，妄想一步登天是會失敗的。", "B. 自從他升上業務經理後，每天都_____，準時在早上八點打卡進辦公室處理公務。", "C. 學校規定遇到火災警報時，所有學生必須_____，跟著導師走到操場集合。", "D. 這家公司的管理制度非常死板，遇到緊急狀況也只能_____，結果錯失了搶救的黃金時間。"],
        correctIndex: 0,
        explanation: "指做事依照一定的條理和步驟來進行。"
    },
    {
        question: "【好高騖遠】正確的用法是？",
        options: ["A. 他剛畢業就想創業當跨國企業的老闆，完全不願意從基層學起，這種_____的心態很容易讓他吃虧。", "B. 這位知名的極限登山家非常_____，他立志要在五年內征服世界上所有海拔超過八千公尺的高峰。", "C. 身為一位優秀的企業領導人，必須要有_____的眼光，才能帶領公司在未來十年保持競爭力。", "D. 為了追求卓越，他在學術研究上總是_____，希望能發表震驚世界的劃時代論文。"],
        correctIndex: 0,
        explanation: "形容人不切實際，不安於現狀，沒有腳踏實地。"
    },
    {
        question: "【心猿意馬】正確的用法是？",
        options: ["A. 他坐在書桌前準備明天的期末考，看著窗外的大好天氣，頓時_____，根本無法專心看書。", "B. 這家野生動物園裡養了許多猴子和斑馬，孩子們一進去就_____，開心得在園區裡跑來跑去。", "C. 為了完成這幅巨型壁畫，他_____地在工作室裡畫了一整個月，從來沒有踏出大門一步。", "D. 他的寫作靈感非常豐富，_____地寫出了許多風格迥異的奇幻小說，深受讀者喜愛。"],
        correctIndex: 0,
        explanation: "比喻心思浮躁不定，無法集中精神。"
    },
    {
        question: "【不遺餘力】正確的用法是？",
        options: ["A. 為了拯救這些瀕臨絕種的野生動物，許多環保人士_____地在世界各地奔走宣導，募措資金。", "B. 那個黑心建商為了賺取暴利，_____地在工程中偷工減料，最後導致大樓在地震中倒塌。", "C. 他為人非常寬厚，在處理基層員工犯錯時總是_____，願意給對方改過自新的機會。", "D. 搬了一整天的沉重磚頭後，工人們都已經_____，連說話的力氣都沒有了，只想趕快回家睡覺。"],
        correctIndex: 0,
        explanation: "形容把所有的力量都用出來了，毫無保留。"
    },
    {
        question: "【以管窺天】正確的用法是？",
        options: ["A. 如果只憑藉一份地方性的小問卷就斷定全國的經濟趨勢，無疑是_____，結論必定有失偏頗。", "B. 天文學家們透過山頂上巨大的天文望遠鏡_____，發現了許多距離地球數光年之外的未知星系。", "C. 他研究這門學問非常專注，每天都在實驗室裡_____，完全不理會外界的政治紛擾與八卦。", "D. 那個小偷躲在暗巷的角落裡_____，仔細觀察這戶人家平時的作息時間，準備伺機下手行竊。"],
        correctIndex: 0,
        explanation: "比喻見識狹窄，只看到事物的一小部分，看不清全貌。"
    },
    {
        question: "【未卜先知】正確的用法是？",
        options: ["A. 諸葛亮在赤壁之戰中彷彿_____，準確地算出了幾天後會颳起東風，幫助聯軍取得大勝。", "B. 這件震驚社會的連環命案真相至今依然_____，警方還在努力尋找關鍵的目擊證人。", "C. 這位老教授博覽群書，在歷史領域可說是_____，沒有任何他回答不出來的冷門歷史問題。", "D. 事情都已經發生了你才說你早就知道，這種_____的馬後炮行為，真的很難讓人信服。"],
        correctIndex: 0,
        explanation: "形容有先見之明，能預先知道未來將會發生的事情。"
    },
    {
        question: "【投機取巧】正確的用法是？",
        options: ["A. 他不肯踏踏實實地做生意，總想靠著逃漏稅和走私來賺大錢，這種_____的行為遲早會被抓去關。", "B. 這家科技公司看準了AI技術的未來發展趨勢，_____地推出了新產品，成功搶佔了極大的市佔率。", "C. 這台最新款的掃地機器人設計得非常_____，內建感測器能夠自動避開家裡所有的障礙物。", "D. 這位木雕師傅的手藝極佳，_____地將一塊原本沒人要的朽木雕成了一件價值連城的藝術珍品。"],
        correctIndex: 0,
        explanation: "利用時機，耍小聰明，用不正當的手段謀取個人利益或躲避困難。"
    },
    {
        question: "【如法炮製】正確的用法是？",
        options: ["A. 詐騙集團見這個假交友投資的手法非常成功，便_____，在其他縣市繼續用同一招行騙。", "B. 中藥行的老闆將這些剛採收下來的珍貴藥材_____，熬煮成了能夠滋補強身的十全大補湯。", "C. 這家工廠完全遵守國家的環保法規，_____地處理了所有的工業廢水，沒有造成任何污染。", "D. 他發揮了極大的創意，_____出了一套全新的企業管理系統，大幅提升了公司的營運效率。"],
        correctIndex: 0,
        explanation: "現代多用來比喻照著現成的模式、方法去做（多帶有缺乏創意或照抄不良手法的意味）。"
    },
    {
        question: "【老生常談】正確的用法是？",
        options: ["A. 校長在朝會上說的那些「要用功讀書、孝順父母」的大道理，對學生來說早就成了_____，沒人想聽。", "B. 公園裡的涼亭下，幾位退休的爺爺奶奶正坐在一起_____，開心地回憶著年輕時的往事。", "C. 這部探討人性的文學名著歷久彌新，是學術界裡公認的_____，值得每一代人細細品味與閱讀。", "D. 這位歷史學家專門研究古代宮廷裡的奇聞軼事，他的新書裡寫滿了許多令人驚奇的_____。"],
        correctIndex: 0,
        explanation: "比喻聽慣了的、沒有新意的話，或是經常被提起的老話題。"
    },
    {
        question: "【移花接木】正確的用法是？",
        options: ["A. 這名騙子利用修圖軟體將名人的照片_____，合成在自己的投資廣告上，企圖騙取大家的信任。", "B. 這裡的園藝工人技術極佳，春天時在花園裡_____，成功培育出了新品種的玫瑰花。", "C. 為了改善社區的居住環境，居民們主動在街道兩旁_____，種植了許多美麗的花草。", "D. 這位魔術師的手法極其高超，在舞台上表演了_____的精彩魔術，讓觀眾看得目瞪口呆。"],
        correctIndex: 0,
        explanation: "比喻暗中使用手段，更換人、事、物以欺騙他人，或指暗中剽竊、套用。"
    },
        {
        question: "【一馬當先】正確的用法是？",
        options: ["A. 在這次的全國馬拉松大賽中，他一開局就_____，以驚人的速度一路領先到終點。", "B. 隨著這波強烈寒流來襲，地處最北端的山區小鎮_____，氣溫瞬間驟降到了零度以下。", "C. 這項新研發的科技項目非常重要，是我們公司今年_____的核心任務。", "D. 為了爭取最新的商機，身為業務經理的他決定_____，親自飛去美國拜訪客戶。"],
        correctIndex: 0,
        explanation: "戰場上策馬衝鋒在最前面。比喻領先、帶頭或在競賽中奪得第一。"
    },
    {
        question: "【令人髮指】正確的用法是？",
        options: ["A. 那個歹徒竟然對無辜的幼童痛下殺手，這種冷血殘酷的行徑簡直是_____，全民皆曰可殺。", "B. 他今天特地去沙龍做了造型，把頭髮梳得高高的，看起來真是_____，十分前衛。", "C. 這位美髮師的手藝極佳，剪出來的髮型居然能_____，讓客人都非常滿意。", "D. 剛看完這部驚悚的鬼片後，他被嚇得_____，整個人躲在被子裡瑟瑟發抖。"],
        correctIndex: 0,
        explanation: "憤怒得頭髮直豎，頂起了帽子。形容憤怒到了極點。"
    },
    {
        question: "【穿鑿附會】正確的用法是？",
        options: ["A. 他總喜歡把兩件完全無關的事情_____在一起，藉此編造出一些聳人聽聞的陰謀論。", "B. 這位工匠在牆壁上_____，花了一整天的時間，終於把冷氣的管線安裝好了。", "C. 這件衣服的設計非常特別，裁縫師_____，將中式旗袍與西式洋裝完美結合。", "D. 為了順利通過這條狹窄的隧道，大家只能_____，小心翼翼地慢慢往前擠。"],
        correctIndex: 0,
        explanation: "把講不通的道理硬拗，把沒有關係的事物硬扯在一起。比喻勉強解釋。"
    },
    {
        question: "【敬謝不敏】正確的用法是？",
        options: ["A. 對於擔任社區主委這份吃力不討好的重任，我實在是才疏學淺，只能_____了。", "B. 面對網路上那些無理的酸民謾罵，他總是_____，完全不把那些話放在心上。", "C. 這種設計早就過時的老舊款式，現在的年輕消費者對它都是_____，根本賣不出去。", "D. 他的反應非常遲鈍，做事又_____，讓同組的同事們都對他感到非常頭痛。"],
        correctIndex: 0,
        explanation: "恭敬地推辭，表示自己能力不足，無法勝任。是推辭事情時的自謙之詞。"
    },
    {
        question: "【虛應故事】正確的用法是？",
        options: ["A. 他對待這份工作總是_____，老闆交代的事情都隨便做做，完全沒有用心。", "B. 為了哄孩子睡覺，媽媽每天晚上都會在床邊_____，編造一些有趣的童話。", "C. 遇到緊急的客訴事件，客服人員必須冷靜地_____，不能帶著私人情緒。", "D. 這部科幻電影的特效做得非常差，場景看起來十分_____，讓人無法入戲。"],
        correctIndex: 0,
        explanation: "依照成規，敷衍了事。比喻做事敷衍塞責，隨便應付。"
    },
    {
        question: "【尾生抱柱】正確的用法是？",
        options: ["A. 在這瞬息萬變的商場上，如果只會_____、死守著合約的字面規定而不知變通，是會吃大虧的。", "B. 颱風天風強雨驟，他在路上被吹得站不穩，只好_____，深怕被狂風吹走。", "C. 這對兄弟的感情極好，從小到大都是_____，不管去哪裡都要黏在一起。", "D. 他的武功高強，在戰場上能夠_____，一人抵擋住數十名敵軍的攻擊。"],
        correctIndex: 0,
        explanation: "原比喻堅守信約；後多用來諷刺人固執拘泥，不知變通。"
    },
    {
        question: "【見微知著】正確的用法是？",
        options: ["A. 一位優秀的企業家必須具備_____的能力，才能在市場剛出現細微變化時就搶佔先機。", "B. 這台電子顯微鏡的倍率極高，能夠_____，讓科學家清楚看見細胞的構造。", "C. 這位作家的文筆極佳，只要稍微寫幾篇文章就能_____，在文壇上享有盛名。", "D. 他的視力非常敏銳，即使在黑暗中也能_____，看清楚遠方的微小字體。"],
        correctIndex: 0,
        explanation: "看到事物微小的跡象，就能知道其發展的明顯趨勢或本質。形容觀察力敏銳。"
    },
    {
        question: "【振振有辭】正確的用法是？",
        options: ["A. 他明明遲到還做錯了報表，卻在會議上_____地為自己狡辯，將責任全推給別人。", "B. 這位教授在研討會上_____，將複雜的經濟學理論解說得非常清楚，獲得滿堂彩。", "C. 這位魔術師的手法極其高超，在舞台上表演了_____的精彩魔術，讓觀眾大開眼界。", "D. 突如其來的強烈地震讓整棟大樓_____，嚇得所有人趕緊躲到桌子底下。"],
        correctIndex: 0,
        explanation: "形容自以為理由充分，而說個沒完。現代多帶有貶義，用於指人強詞奪理、狡辯。"
    },
    {
        question: "【米珠薪桂】正確的用法是？",
        options: ["A. 在這座物價高昂的國際大都會裡，一般上班族常有_____的感嘆，每個月的薪水根本不夠花。", "B. 這家米其林餐廳的菜色非常奢華，菜單上盡是些_____的頂級食材，讓人看了食指大動。", "C. 這間珠寶店的櫥窗裡擺滿了_____，每一件首飾都價值連城，閃耀著奪目的光芒。", "D. 他在科技公司擔任高階主管，過著_____的富裕生活，完全不用為錢發愁。"],
        correctIndex: 0,
        explanation: "米貴得像珍珠，柴火貴得像桂木。比喻物價極度昂貴，生活非常困難。"
    },
    {
        question: "【屢見不鮮】正確的用法是？",
        options: ["A. 在現今網路發達的時代，各種光怪陸離的詐騙手法已是_____，大家早就見怪不怪了。", "B. 這家餐廳的海鮮已經放了好幾天，吃起來_____，導致許多客人食物中毒。", "C. 他參加了好幾次汽車駕照考試都失敗，真是_____，讓他感到非常挫折。", "D. 為了追求時尚，她總是穿著_____的奇異服裝出門，吸引了路人的目光。"],
        correctIndex: 0,
        explanation: "常常見到，就不覺得新奇了。比喻事物很常見，不足為奇。"
    },
    {
        question: "【不落窠臼】正確的用法是？",
        options: ["A. 這部科幻小說的設定_____，完全跳脫了傳統外星人入侵的刻板套路，令人耳目一新。", "B. 颱風過後，樹上的鳥巢被狂風吹得_____，裡面的幼鳥也幸運地沒有受傷。", "C. 走路時要看路，千萬要小心_____，不然摔斷了腿可就麻煩了。", "D. 這家百年老店一直_____，堅持使用傳統手工製作糕點，絕不使用機器量產。"],
        correctIndex: 0,
        explanation: "窠臼比喻陳舊的模式或老套。比喻文章或藝術作品有獨創風格，不落入俗套。"
    },
    {
        question: "【改弦易轍】正確的用法是？",
        options: ["A. 面對連年虧損的業績，公司高層決定_____，全面更換原有的行銷策略與產品定位。", "B. 他的吉他弦斷了，於是跑到樂器行去_____，準備晚上的樂團表演。", "C. 這輛老舊的汽車在高速公路上爆胎了，司機只好停在路肩_____，換上備胎。", "D. 遇到困難時，我們應該堅持到底，絕對不能_____，輕易放棄原本的夢想。"],
        correctIndex: 0,
        explanation: "比喻改變原來的制度、做法或方向。"
    },
    {
        question: "【捉襟見肘】正確的用法是？",
        options: ["A. 他因為過度消費而負債累累，每個月的薪水根本不夠還卡債，生活早已_____。", "B. 這位設計師推出的秋冬新款服裝造型非常獨特，_____，展現出前衛的時尚感。", "C. 遇到困難時，團隊成員應該互相幫助、同舟共濟，絕對不能_____，袖手旁觀。", "D. 這位畫家的素描技巧高超，畫出的人物動作_____，栩栩如生，充滿動態美。"],
        correctIndex: 0,
        explanation: "衣服破爛，拉一下衣襟，就露出了手肘。比喻生活極度貧困，或是顧此失彼、窮於應付的窘迫處境。"
    },
    {
        question: "【畫地自限】正確的用法是？",
        options: ["A. 在這瞬息萬變的AI時代，如果我們_____，不肯學習新技術，遲早會被職場淘汰。", "B. 為了防範傳染病擴散，政府下令_____，嚴格限制所有居民離開自己的居住區域。", "C. 他的畫工極其精細，能夠在極小的紙張上_____，畫出氣勢磅礡的壯麗山水。", "D. 面對敵軍的惡意挑釁，我方將軍_____，冷靜地看著對方，絲毫不為所動。"],
        correctIndex: 0,
        explanation: "比喻自己設定了界限，阻礙了自己的發展與進步。"
    },
    {
        question: "【玩火自焚】正確的用法是？",
        options: ["A. 那個貪官長期收受黑心建商的龐大賄賂，最後東窗事發被判重刑，完全是_____。", "B. 這位勇敢的消防員在火場中_____，不顧自身安危，成功救出了好幾名受困的孩童。", "C. 冬天天氣寒冷，幾個小孩子在空地上_____，結果不小心燒破了自己的外套。", "D. 他的廚藝極佳，即使是_____的高難度法式火焰料理，也能輕鬆完美地完成。"],
        correctIndex: 0,
        explanation: "玩弄火的人，最終會燒死自己。比喻做危險或惡劣的事情，最後反而害了自己。"
    },
    {
        question: "【出爾反爾】正確的用法是？",
        options: ["A. 他昨天才信誓旦旦地答應要投資我們公司，今天卻_____說資金周轉不靈，真是讓人難以信任。", "B. 面對敵軍的猛烈火砲攻擊，我方守軍立刻_____，給予他們最嚴厲的迎頭痛擊。", "C. 這兩位好朋友因為一點小誤會而激烈吵架，後來經過溝通終於_____，和好如初。", "D. 他的性格非常直爽，做事總是_____，從來不拖泥帶水，深受老闆的賞識。"],
        correctIndex: 0,
        explanation: "現代多引申為說話不算話、反覆無常、違背自己的承諾。"
    },
    {
        question: "【金玉其外，敗絮其中】正確的用法是？",
        options: ["A. 這棟新建的豪宅外表富麗堂皇，裡面卻因為建商偷工減料而嚴重漏水，簡直是_____。", "B. 這件傳家古董珠寶盒不僅外觀雕刻精美，裡面也裝滿了珍貴的紅寶石，真是_____。", "C. 他雖然長得相貌平平、不修邊幅，但心地非常善良且樂於助人，可以說是_____。", "D. 這位詐騙集團首腦為了掩飾自己的罪行，總是_____，假裝成一位熱心公益的慈善家。"],
        correctIndex: 0,
        explanation: "外表像金玉般華美，裡面卻裝著破舊的棉絮。比喻外表華麗好看，但實際上內部卻空虛腐敗。"
    },
    {
        question: "【司馬青衫】正確的用法是？",
        options: ["A. 聽到這位單親媽媽為了撫養重病孩子而四處奔波的辛酸故事，在場的人都不禁_____，流下同情的眼淚。", "B. 為了參加這場盛大的跨國企業晚宴，他特地穿上了一件昂貴的_____，顯得非常帥氣。", "C. 他在政壇上打滾多年，如今已經位高權重，穿著_____走在路上，威風凜凜，無人不曉。", "D. 這位歷史學家專門研究三國時代的歷史，對司馬懿的生平事蹟_____，瞭若指掌。"],
        correctIndex: 0,
        explanation: "典故出自白居易《琵琶行》。比喻對別人的悲慘遭遇感到極度同情而傷心流淚。"
    },
    {
        question: "【三顧茅廬】正確的用法是？",
        options: ["A. 為了邀請這位頂尖的軟體工程師加入新創團隊，老闆不惜_____，親自到他家拜訪了好幾次。", "B. 這裡的高山湖泊風景極美，宛如仙境，他每年春天都會_____，來這裡享受大自然的寧靜。", "C. 這家知名老字號牛肉麵店的生意太好了，我_____才終於訂到位子，吃到他們的招牌菜。", "D. 面對創業初期的重重困難，他依然_____，堅持到底不肯放棄，最後終於取得了巨大成功。"],
        correctIndex: 0,
        explanation: "比喻對賢才真心誠意地邀請、拜訪。"
    },
    {
        question: "【海市蜃樓】正確的用法是？",
        options: ["A. 這些聽起來很美好的快速致富方案，往往只是_____，實際上根本無法實現，還會騙光你的錢。", "B. 為了促進當地的觀光發展，市長花費鉅資在海邊蓋了一棟名為_____的大型豪華購物中心。", "C. 這位建築師的設計風格非常前衛，他蓋的房子就像_____一樣，充滿了高科技的未來感。", "D. 只要我們腳踏實地地努力工作，夢想就不會是_____，終有在現實中實現的一天。"],
        correctIndex: 0,
        explanation: "光線經過大氣折射而產生的虛幻景象。比喻虛幻、不存在、不切實際的事物。"
    },
    {
        question: "【狗急跳牆】正確的用法是？",
        options: ["A. 警方已經將這棟大樓團團包圍，歹徒在_____之下，竟然挾持了無辜的住戶當作人質企圖逃跑。", "B. 這隻流浪狗被路邊突如其來的鞭炮聲嚇到，_____，瞬間消失在暗巷的盡頭。", "C. 他的脾氣非常暴躁，只要遇到一點不順心的事情就會_____，在辦公室裡大發雷霆。", "D. 為了在明天的體育考試中獲得好成績，他每天_____地練習跳高，連休息的時間都沒有。"],
        correctIndex: 0,
        explanation: "狗被逼急了，連高牆也跳得過去。比喻人在走投無路、被逼急時，會不顧一切地採取極端的冒險行動。"
    },
    {
        question: "【走火入魔】正確的用法是？",
        options: ["A. 他最近迷上了投資虛擬貨幣，簡直到了_____的地步，不但辭去工作，連房子都拿去抵押了。", "B. 這位特技演員在舞台上表演噴火時不小心_____，導致自己的手臂受到嚴重的燒燙傷。", "C. 經過警方幾個月的追查，這名縱火犯終於_____，在自己的藏匿處被警方逮捕歸案。", "D. 他的廚藝極佳，對於火候的掌握可說是_____，烤出來的肉外酥內嫩，讓客人讚不絕口。"],
        correctIndex: 0,
        explanation: "現代多比喻過度沉迷於某種事物，失去了理智，達到有害的地步。"
    },
    {
        question: "【糟糠之妻】正確的用法是？",
        options: ["A. 他在事業飛黃騰達後，依然非常疼愛他的_____，兩人感情甜蜜，從未有過花邊新聞。", "B. 這位老太太雖然年過八旬、_____，但身體依然非常硬朗，天天都去公園散步。", "C. 他在商場上作風狠毒，為了個人利益竟然連相伴多年的_____都能無情背叛。", "D. 為了感謝母親多年來的辛勞付出，他決定在母親節送給這位_____一份昂貴的禮物。"],
        correctIndex: 0,
        explanation: "指共同度過貧困日子的妻子。常用於形容夫妻相濡以沫、不離不棄。"
    },
    {
        question: "【不以為意】正確的用法是？",
        options: ["A. 對於網路上那些酸民的惡意批評與冷嘲熱諷，他總是_____，專心做好自己的本分。", "B. 大家都覺得這項投資計畫大有可為，只有他_____，認為風險太高不該投資。", "C. 事情既然已經發生了，我們就_____吧，別再追究到底是誰的責任了。", "D. 他做錯事卻還_____，甚至覺得自己很了不起，這種態度真是厚顏無恥。"],
        correctIndex: 0,
        explanation: "不把它放在心上。表示不在乎、不介意。"
    },
    {
        question: "【夸夸其談】正確的用法是？",
        options: ["A. 他在會議上_____，把未來的願景說得天花亂墜，但實際上根本拿不出任何具體的執行方案。", "B. 面對眾多資深學者的嚴厲提問，這位年輕的研究員依然_____，展現出極高的自信與專業度。", "C. 為了表揚這位員工的傑出貢獻，總經理在頒獎典禮上_____，給予他極高的評價。", "D. 兩位久別重逢的老朋友坐在咖啡廳裡_____，一邊喝茶一邊互相傾訴著這幾年來的心酸。"],
        correctIndex: 0,
        explanation: "形容說話浮誇，大話連篇，沒有實質內容。"
    },
   {
        question: "【如履薄冰】正確的用法是？",
        options: ["A. 負責這項涉及數十億資金的跨國投資案，他每天都_____，深怕任何一個小失誤會導致全盤皆輸。", "B. 到了冬天，北方的湖面結了一層冰，孩子們在上面開心地溜冰，真是_____。", "C. 寒流來襲，氣溫降到了零下十度，他走在街上冷得_____，全身不停地發抖。", "D. 只要掌握了正確的學習方法，準備這場考試對他來說就像_____一樣簡單輕鬆。"],
        correctIndex: 0,
        explanation: "像走在薄冰上一樣。比喻處境極為危險，所以做事極度小心謹慎、戰戰兢兢。"
    },
    {
        question: "【鶼鰈情深】正確的用法是？",
        options: ["A. 這對老夫妻結婚五十多年來，始終_____，互相扶持，是鄰里間公認的模範夫妻。", "B. They 兩兄弟從小一起長大，_____，不管遇到什麼困難都會互相幫助。", "C. 我們是認識了十年的好閨蜜，_____，彼此之間沒有任何秘密。", "D. 湖面上的水鳥與魚兒和諧共處，呈現出一幅_____的自然生態美景。"],
        correctIndex: 0,
        explanation: "比喻夫妻之間的感情極為深厚、形影不離。（極易錯重點：專指「夫妻」恩愛，不能用在其他關係）"
    },
    {
        question: "【如坐春風】正確的用法是？",
        options: ["A. 聽了這位國學大師精闢入理的講學後，讓我有一種_____的感覺，瞬間解開了許多學術上的疑惑。", "B. 春天到了，我們一家人去公園野餐，微風徐徐吹來，_____，非常愜意。", "C. 他這次期末考拿了全校第一名，走在校園裡心情_____，非常得意。", "D. 這輛最新款的敞篷跑車速度極快，開在濱海公路上簡直是_____，刺激無比。"],
        correctIndex: 0,
        explanation: "比喻受到良好老師的教導與學識薰陶，感到十分愉悅和受益。（極易錯重點：不是指天氣好）"
    },
    {
        question: "【擢髮難數】正確的用法是？",
        options: ["A. 這個跨國詐騙集團的首腦騙取了無數老人的畢生積蓄，害得許多人家破人亡，其罪狀之多，簡直是_____。", "B. 這位大慈善家一生捐款無數，幫助了成千上萬的弱勢群體，做的好事真是_____。", "C. 他最近因為工作壓力太大，掉髮非常嚴重，洗頭時掉落的頭髮已經到了_____的地步。", "D. 國家圖書館裡的各類學術典籍與珍貴文獻多到_____，是學者們做研究的寶庫。"],
        correctIndex: 0,
        explanation: "拔下所有的頭髮也數不清。比喻罪惡極多，難以計數。（極易錯重點：只能形容罪惡極多，不可形容好事或毛髮）"
    },
    {
        question: "【南腔北調】正確的用法是？",
        options: ["A. 來自全國各地的大一新生齊聚在宿舍裡，大家操著_____聊著天，氣氛非常熱鬧。", "B. 為了拓展公司的海外業務，身為業務主管的他每天_____地到處出差，非常辛苦。", "C. 這場國家音樂會演奏了許多_____的古典樂曲，讓台下的聽眾聽得如痴如醉。", "D. They 兩人的意見完全不合，在會議上_____地吵了起來，誰也不肯退讓。"],
        correctIndex: 0,
        explanation: "比喻各地的口音夾雜在一起。也形容含有南方和北方各種不同地區口音的混合語音。"
    },
    {
        question: "【大言不慚】正確的用法是？",
        options: ["A. 他明明對這個專業領域一竅不通，卻還_____地自稱是權威專家，真是笑死人了。", "B. 雖然他犯了嚴重的錯誤，但在主管的開導下，他終於_____地低頭認錯了。", "C. 為了讓後排的觀眾也能聽見，他只好_____地對著麥克風大聲吼叫。", "D. 這位將軍在戰場上總是_____，身先士卒地帶領士兵衝鋒陷陣。"],
        correctIndex: 0,
        explanation: "說大話吹牛，卻一點也不覺得難為情。"
    },
    {
        question: "【分身乏術】正確的用法是？",
        options: ["A. 身兼跨國專案經理與新手爸爸兩職，他最近忙得_____，連好好吃頓飯的時間都沒有。", "B. 這位魔術師在舞台上表演了精彩的_____，瞬間變出三個一模一樣的自己，讓觀眾驚呼連連。", "C. 經過一整天高強度的體力勞動，工人們都累得_____，倒在地上直接睡著了。", "D. 這位外科醫生在手術台上展現了精湛的_____，成功將連體嬰安全分割。"],
        correctIndex: 0,
        explanation: "比喻一個人極度忙碌，同時有很多事情要處理，無法兼顧。"
    },
    {
        question: "【不翼而飛】正確的用法是？",
        options: ["A. 我明明把剛領出來的現金放在書桌上，怎麼轉個身就_____了？難道家裡遭小偷了嗎？", "B. 關於這家公司即將被惡意併購的傳聞，一天之內就_____，傳遍了整個業界。", "C. 這隻企鵝雖然屬於鳥類，但卻是_____的動物，只能在冰層上行走或在水裡游。", "D. 他的事業發展迅速，簡直是_____，短短幾年就成了身價破億的企業家。"],
        correctIndex: 0,
        explanation: "沒有翅膀卻飛走了。比喻物品突然離奇遺失或被偷走。（極易錯重點：常與「不脛而走（消息傳播）」搞混）"
    },
    {
        question: "【諱疾忌醫】正確的用法是？",
        options: ["A. 公司的財務已經出現大漏洞，老闆卻依然_____，不願聽取專業顧問的建議，最終導致破產。", "B. 他最近一直咳嗽發燒，為了不讓病情惡化，他決定不再_____，趕緊去醫院掛號。", "C. 這位醫生醫術非常糟糕，常常把病人的小感冒治成大病，讓附近的居民都_____。", "D. 為了保護病人的隱私，這家診所對於病歷資料的保密工作做得非常好，絕不_____。"],
        correctIndex: 0,
        explanation: "比飾自己的缺點或錯誤，不願接受別人的批評與勸告。"
    },
    {
        question: "【本末倒置】正確的用法是？",
        options: ["A. 為了省下一點點飯錢而三餐吃泡麵，結果搞壞了身體花更多錢看醫生，這根本是_____。", "B. 他在職裝這組櫃子時不小心_____，把底部的木板裝到了最上面，只好拆掉重組。", "C. 這位作家寫小說時總是_____，先把結局寫好，然後才開始構思開頭的劇情。", "D. 遇到複雜的問題時，我們必須_____，從源頭開始尋找解決的方法，不能只看表面。"],
        correctIndex: 0,
        explanation: "比喻不知事情的輕重緩急，把次要的事當成主要的。"
    },
    {
        question: "【張冠李戴】正確的用法是？",
        options: ["A. 他在報告時沒把資料核對清楚，竟然_____地把A公司的業績算到了B公司頭上，鬧了大笑話。", "B. 參加這場化裝舞會時，大家故意_____，互相交換帽子和衣服，玩得非常開心。", "C. 這對雙胞胎兄弟長得實在太像了，連他們的父母有時候都會_____，認錯人。", "D. 為了掩飾自己的真實身分，這名通緝犯_____，拿著假護照成功潛逃出境。"],
        correctIndex: 0,
        explanation: "把姓張的帽子戴到姓李的頭上。比喻弄錯了對象，或弄混了事實。"
    },
    {
        question: "【無的放矢】正確的用法是？",
        options: ["A. 你在會議上對我的指控完全拿不出任何證據，純屬_____，我絕對不接受這種惡意抹黑。", "B. 這位射箭選手在今天的比賽中失常，連續三箭都_____，連靶的邊緣都沒碰到。", "C. 面對敵軍的猛烈進攻，我方守軍_____，將所有的箭矢如雨點般射向敵陣。", "D. 他做事總是_____，毫無計畫和目標，難怪這幾年來事業一事無成。"],
        correctIndex: 0,
        explanation: "沒有目標就亂射箭。比喻說話或做事沒有目的，或是毫無事實根據地胡亂指控、批評。"
    },
    {
        question: "【捕風捉影】正確的用法是？",
        options: ["A. 這家八卦雜誌最喜歡_____，隨便拍到一張模糊的照片就能捏造出一整篇緋聞報導。", "B. 這位攝影大師的技術極高，能夠_____，拍下風吹過草原時那種無形的動態美。", "C. 警察在辦案時絕不能_____，必須講求科學證據，才能讓嫌犯定罪。", "D. 為了抓到那隻狡猾的老鼠，他每天晚上都在廚房裡_____，卻始終一無所獲。"],
        correctIndex: 0,
        explanation: "比喻說話或做事毫無事實根據，憑空捏造。"
    },
    {
        question: "【空中樓閣】正確的用法是？",
        options: ["A. 如果沒有穩定的資金與技術支援，你這份實施的創業計畫終究只是_____，無法在現實中實現。", "B. 這座建在懸崖頂端的觀景台，雲霧繚繞，看起來宛如_____，美得令人屏息。", "C. 為了緩解都市的交通壅塞，政府決定建造一座_____，讓行人可以在上面安全行走。", "D. 這位魔術師在舞台上施展了神奇的法術，讓一座_____瞬間出現在觀眾眼前。"],
        correctIndex: 0,
        explanation: "懸在半空中的亭臺樓閣。比喻虛幻不實的事物，或脫離實際的理論、計畫。"
    },
    {
        question: "【同日而語】正確的用法是？",
        options: ["A. 現代的醫療科技非常發達，與一百年前的落後環境相比，早已不可_____。", "B. They 兩人雖然是同一天出生的雙胞胎，但個性卻截然不同，完全不能_____。", "C. 這兩家公司的實力相當，在這次的競標案中，雙方代表_____，爭論得非常激烈。", "D. 為了節省會議時間，主管要求大家把這兩個不相關的專案_____，一起在今天討論完畢。"],
        correctIndex: 0,
        explanation: "通常用在否定句「不可同日而語」，表示兩者差距極大，根本不能相提並論。"
    },
    {
        question: "【相提並論】正確的用法是？",
        options: ["A. 這兩位藝術大師在畫壇上的成就都不分軒輊、各有千秋，完全可以_____。", "B. They 兩人在會議上_____，為了一個小小的數據錯誤爭吵了整整一個小時。", "C. 遇到困難時，大家應該_____，共同想出解決的方法，而不是互相推卸責任。", "D. 這位大力士的力氣驚人，竟然能夠_____，同時舉起兩個超過百公斤的沙袋。"],
        correctIndex: 0,
        explanation: "把不同的人或事物放在一起談論、比較。"
    },
    {
        question: "【風聲鶴唳】正確的用法是？",
        options: ["A. 自從爆發嚴重的金融危機後，股市裡的投資人_____，只要有一點點壞消息就嚇得瘋狂拋售股票。", "B. 秋天的夜晚，走在深山的樹林裡，耳邊傳來_____，讓人感到十分心曠神怡。", "C. 這場演講非常精彩，台下的觀眾聽得_____，結束時爆發出如雷的掌聲。", "D. 颱風登陸時，狂風暴雨夾雜著_____，把許多路樹和招牌都吹斷了。"],
        correctIndex: 0,
        explanation: "形容人極度驚慌恐懼，疑神疑鬼、自相驚擾。"
    },
    {
        question: "【唾手可得】正確的用法是？",
        options: ["A. 以他目前在業界無人能敵的雄厚實力，要拿下這次的跨國大訂單簡直是_____。", "B. 他對待部屬非常嚴苛，動不動就_____，讓所有員工都對他感到十分畏懼。", "C. 在這座乾旱的沙漠中，水源是非常珍貴的，絕對不是_____的東西。", "D. 這件古董花瓶非常脆弱，搬運時必須非常小心，千萬不能_____，以免摔破。"],
        correctIndex: 0,
        explanation: "往手上吐口水，就能輕鬆把東西拿起來。比喻極容易取得或達成目標。"
    },
    {
        question: "【嘆為觀止】正確的用法是？",
        options: ["A. 太魯閣峽谷壯麗的自然景觀，鬼斧神工，讓所有前來旅遊的外國遊客都_____。", "B. 看到兒子這次期末考滿江紅的悲慘成績，父親不禁_____，搖了搖頭轉身離開。", "C. 因為前面排隊的人實在太多了，他只好_____，放棄了購買限量球鞋的念頭。", "D. 這部電影的劇情實在太沉悶無聊了，讓觀眾們在電影院裡_____，紛紛睡著了。"],
        correctIndex: 0,
        explanation: "形容讚嘆所見的事物好到了極點。（極易錯重點：表示讚美看到的事物好到了極點，絕對不是「嘆氣」或「停止觀看」！）"
    },
    {
        question: "【鎩羽而歸】正確的用法是？",
        options: ["A. 雖然這支球隊在賽前被寄予厚望，但卻在預賽中連輸三場，最後只能_____。", "B. 傍晚時分，天空中出現了一大群候鳥，牠們_____，準備回到溫慢的南方過冬。", "C. 這位將軍帶領著百萬大軍在戰場上所向披靡，最後_____，受到了皇帝的盛大迎接。", "D. 為了準備這場服裝秀，設計師們用各種華麗的羽毛將模特兒打扮得_____，非常吸睛。"],
        correctIndex: 0,
        explanation: "比喻失意、失敗或遭受挫折而退縮回來。"
    },
    {
        question: "【海闊天空】正確的用法是？",
        options: ["A. 遇到人際關係的摩擦時，只要學會退一步替對方想，心境自然就能_____，不再煩惱。", "B. 我們坐在沙灘上，看著眼前_____的美景，吹著海風，感覺非常放鬆。", "C. 他做事情總是_____，沒有一個具體的計畫與目標，最後往往什麼都做不成。", "D. 颱風過後，原本平靜的海面突然變得_____，掀起了十幾公尺高的驚濤駭浪。"],
        correctIndex: 0,
        explanation: "形容心胸開闊、毫無拘束；或比喻言談議論漫無邊際。"
    },
    {
        question: "【心照不宣】正確的用法是？",
        options: ["A. 兩人對這個商業機密的默契極佳，在會議上交換了一個眼神便_____，誰也沒有把話說破。", "B. 他做人向來光明磊落、_____，從來不會在背後搞小動作，深受同事們的信任。", "C. 這顆夜明珠在黑暗的房間裡_____，散發出柔和且迷人的光芒。", "D. 為了證明自己的清白，他決定在法庭上_____，把所有的真相都公諸於世。"],
        correctIndex: 0,
        explanation: "彼此心裡明白，而不公開說出來。"
    },
    {
        question: "【高瞻遠矚】正確的用法是？",
        options: ["A. 這位企業家憑藉著_____的眼光，在十年前就投入了AI技術的研發，如今取得了巨大的成功。", "B. 站在這座城市最高的大樓觀景台上_____，底下的車水馬龍與繁華夜景盡收眼底。", "C. 他為人非常傲慢，總是_____，看不起身邊那些職位比他低的基層員工。", "D. 這隻老鷹在天空中_____，銳利的雙眼緊緊盯著草地上的獵物，隨時準備俯衝。"],
        correctIndex: 0,
        explanation: "站得高，看得遠。比喻眼光遠大，能預測未來發展的趨勢。"
    },
    {
        question: "【虛有其表】正確的用法是？",
        options: ["A. 這台進口跑車外觀雖然炫麗拉風，但引擎卻常常故障，根本是_____，不值得花大錢買。", "B. 他在履歷表上捏造了許多不實的學歷與經歷，這份_____的資料很快就被面試官識破了。", "C. 這位魔術師的手法極為精妙，能夠在觀眾面前變出_____的幻象，讓人分不清真假。", "D. 為了應付衛生局的檢查，這家餐廳的廚房打掃得_____，一點灰塵都找不到。"],
        correctIndex: 0,
        explanation: "只有華麗的外表，卻沒有實際的內容。形容事物華而不實。"
    },
    {
        question: "【一丘之貉】正確的用法是？",
        options: ["A. 這兩個政客表面上互相攻擊，私底下卻聯手貪污國家預算，根本就是_____，沒一個好東西。", "B. 木柵動物園裡引進了_____，牠們可愛的模樣吸引了許多小朋友隔著玻璃觀賞。", "C. 雖然他們兩人的性格截然不同，但在工作上的默契卻是_____，合作無間。", "D. 這片山丘上的風景十分秀麗，宛如_____，是週末假日踏青郊遊的好去處。"],
        correctIndex: 0,
        explanation: "比喻彼此同屬一類，都是一樣的壞人。"
    },
    {
        question: "【按兵不動】正確的用法是？",
        options: ["A. 警方在歹徒的交易地點周圍埋伏，長官下令大家先_____，等對方開始交錢時再一網打盡。", "B. 這位士兵在戰場上腿部中彈，只能躺在原地_____，等待醫療兵前來救援。", "C. 這位將軍帶領軍隊_____，以迅雷不及掩耳的速度攻下了敵人的城池。", "D. 他做事總是_____，動作慢吞吞的，嚴重拖垮了整個團隊的進度。"],
        correctIndex: 0,
        explanation: "控制軍隊，暫不行動。比喻暫時不採取行動，等待時機。"
    },
    {
        question: "【防患未然】正確的用法是？",
        options: ["A. 為了_____，社區管委會決定在颱風季節來臨前，先將所有老舊的招牌與路樹進行加固。", "B. 這場嚴重的工廠大火發生後，消防局才開始要求周邊企業加強安檢，已經是_____了。", "C. 這位醫生醫術精湛，能夠將垂死的病患從鬼門關前救回來，真是_____。", "D. 他的個性非常悲觀，總是_____，擔心一些根本不可能發生的災難。"],
        correctIndex: 0,
        explanation: "在災禍還沒有發生之前就加以防備。"
    },
    {
        question: "【期期艾艾】正確的用法是？",
        options: ["A. 他因為極度緊張，一站上講台就_____，半天擠不出一句完整的話來。", "B. 粉絲們在機場外_____，希望能早點看到這位國際巨星的身影。", "C. 父母對即將出國留學的兒子_____，希望他能學成歸國、光宗耀祖。", "D. 春天到了，山坡上的野草長得_____，呈現出一片生機盎然的景象。"],
        correctIndex: 0,
        explanation: "形容人說話口吃、結結巴巴的樣子。（極易錯重點：表示「口吃、說話不流暢」，絕對不是「充滿期待」！）"
    },
    {
        question: "【不足為訓】正確的用法是？",
        options: ["A. 他這種為了賺大錢而不擇手段、犧牲健康的作法，實在是_____，年輕人千萬別學。", "B. 這次考試失敗只是一點小挫折，對他來說_____，他很快就振作起來了。", "C. 這次的車禍事故_____，我們下次開車還是可能會犯同樣的錯誤。", "D. 經過老師嚴厲的_____，他終於明白了自己錯在哪裡，決定痛改前非。"],
        correctIndex: 0,
        explanation: "不值得當作效法的準則或榜樣。（極易錯重點：「訓」是準則、典範。表示「不值得作為效法的標準」，不是「不夠當作教訓」！）"
    },
    {
        question: "【無遠弗屆】正確的用法是？",
        options: ["A. 現代網際網路的力量_____，讓身處世界各地的我們能隨時隨地進行視訊通話。", "B. 他的視力極差，連眼前的字都看不清，更別說是_____的地方了。", "C. 這條荒野中的山路崎嶇難行，_____，讓人走得非常吃力且絕望。", "D. 他做事情總是_____，沒有一個明確的目標與方向，導致一事無成。"],
        correctIndex: 0,
        explanation: "沒有遙遠的地方是到達不了的。形容影響力、傳播能力極廣，無所不達。"
    },
    {
        question: "【一言九鼎】正確的用法是？",
        options: ["A. 老董事長在業界向來_____，只要他親口答應的合作案，就絕對不會反悔。", "B. 他的口才極佳，在演講台上_____，滔滔不絕地講了兩個小時。", "C. 為了買到這件全球限量的名牌外套，他甘願花費_____的重金。", "D. 這裡的國家博物館展出了許多_____，每一件都是價值連城的國寶。"],
        correctIndex: 0,
        explanation: "形容說話極有分量，能起決定性作用；也形容人極度守信用。（極易錯重點：形容說話極有份量、守信用。不是指「話很多」！）"
    },
    {
        question: "【老驥伏櫪】正確的用法是？",
        options: ["A. 這位高齡八十歲的企業家依然_____，充滿熱情地計畫著要拓展海外的新市場。", "B. 爺爺年紀大了，身體大不如前，只能_____，每天躺在病床上需要人照顧。", "C. 這匹退役的老賽馬如今_____，在農場的馬廄裡安享牠平靜的晚年。", "D. 他做事情總是拖拖拉拉、慢吞吞的，像個_____一樣，嚴重影響了團隊效率。"],
        correctIndex: 0,
        explanation: "比喻年紀雖老，但仍懷有雄心壯志。"
    },
    {
        question: "【不可理喻】正確的用法是？",
        options: ["A. 他只要一生氣就固執己見，完全聽不進別人的勸告，簡直是_____。", "B. 這道高等微積分的數學題實在太複雜了，對小學生來說根本是_____。", "C. 大自然的鬼斧神工，創造出了許多令人_____的奇妙景觀，美不勝收。", "D. 他的外語能力極差，到了國外與當地人溝通時總是_____，鬧了不少笑話。"],
        correctIndex: 0,
        explanation: "不能用道理使他明白。形容人態度蠻橫、固執己見，不講道理。（極易錯重點：表示「固執、不講理」，不是「無法理解」！）"
    },
    {
        question: "【不容置喙】正確的用法是？",
        options: ["A. 總經理在會議上做出的最終決策_____，底下的員工只能乖乖服從，沒人敢有意見。", "B. 監視器畫面拍得清清楚楚，兇手的罪行已經是_____的事實了，他再也無法抵賴。", "C. 這裡的鳥類生態非常豐富，許多鳥兒在樹枝上_____，唱著悅耳的歌曲。", "D. 這部科幻小說的情節荒謬至極，內容破綻百出，簡直_____，讓人看不下去。"],
        correctIndex: 0,
        explanation: "不容許別人插嘴發表意見。形容態度強硬、專斷，不讓別人說話。（極易錯重點：表示「不容許別人插嘴」，不是「不容懷疑」！）"
    },
    {
        question: "【彈冠相慶】正確的用法是？",
        options: ["A. 自從那位貪污的政客當選後，他身邊那些勾結的黑道勢力便_____，準備大撈一筆。", "B. 中華隊在這次奧運棒球賽中勇奪金牌，全國人民_____，熱烈地在街頭狂歡。", "C. 哥哥終於考上了第一志願的醫學系，全家人_____，特地去吃了一頓大餐慶祝。", "D. 這位音樂家在台上_____，用精湛的吉他彈奏技巧為朋友的婚禮獻上祝福。"],
        correctIndex: 0,
        explanation: "比喻壞人得勢、準備升官發財而互相慶賀。（極易錯重點：形容壞人得勢而互相慶賀，絕對不能用來稱讚好人升官或運動員奪冠！）"
    },
    {
        question: "【不贊一詞】正確的用法是？",
        options: ["A. 面對大家在會議上激烈的爭論，經理始終坐在角落_____，讓人猜不透他的想法。", "B. 雖然這部電影的特效非常精彩，但那位嚴苛的影評人卻_____，給了零顆星的負評。", "C. 看到同事有了出色的業績表現，他因為嫉妒而_____，連一句恭喜都不肯說。", "D. 為了舉辦這場大型公益活動，許多企業紛紛出錢出力，只有那家大公司_____。"],
        correctIndex: 0,
        explanation: "多用來指「保持沉默，一句話也不說」。（極易錯重點：表示「一句話都不說」，絕對不是「不稱讚」！）"
    },
    {
        question: "【細大不捐】正確的用法是？",
        options: ["A. 這位學者在編纂這部百科全書時，對於史料的收集_____，無論多微小的資料都完整收錄。", "B. 那個守財奴一毛不拔，每次遇到慈善募款活動總是_____，連一塊錢都不肯拿出來。", "C. 這位企業家雖然很有錢，但他做善事卻是_____，只捐給大機構，不理會小團體。", "D. 他對待朋友非常小氣，連吃飯的零頭都要算得清清楚楚，真是個_____的人。"],
        correctIndex: 0,
        explanation: "小的大的都不拋棄。形容對事物兼容並蓄，或做事巨細靡遺，什麼都不遺漏。（極易錯重點：表示「大小事物全都包容或兼顧」，絕對不是「大錢小錢都不捐」！）"
    },
    {
        question: "【求全責備】正確的用法是？",
        options: ["A. 新手難免會犯錯，身為主管應該多給予指導，而不是一味地_____，這樣只會讓員工壓力更大。", "B. 發生這麼嚴重的失誤，他感到非常內疚，每天在房間裡_____，甚至吃不下飯。", "C. 為了顧全大局，他不惜_____，主動向客戶低頭道歉，希望能保住這張訂單。", "D. 警方在案發現場_____，終於找到了歹徒留留下關鍵指紋，順利破案。"],
        correctIndex: 0,
        explanation: "對人要求完美無缺，只要有一點小錯就嚴厲苛責。（極易錯重點：表示「對別人要求太完美、太苛刻」，絕對不是「責備自己」！）"
    },
    {
        question: "【信手拈來】正確的用法是？",
        options: ["A. 這位文學大師學識淵博，寫作時各種古典詩詞與歷史典故都能_____，毫不費力。", "B. 他看到桌上有一支名貴的鋼筆，便_____地放進自己的口袋裡，假裝沒事發生。", "C. 在超級市場購物時，她總是_____，把喜歡的零食全都丟進購物車裡。", "D. 這項任務對他來說非常簡單，簡直是_____，一天就能順利完成。"],
        correctIndex: 0,
        explanation: "形容寫作、說話時，辭藻或典故極其豐富，順手就能拿來使用。（極易錯重點：不能用來形容隨便拿東西或偷東西！）"
    },
    {
        question: "【文過飾非】正確的用法是？",
        options: ["A. 事情搞砸了就應該勇敢承認，如果只會一味地_____，把責任推給別人，是無法獲得原諒的。", "B. 這位設計師擅長_____，把原本單調無聊的客廳裝潢得充滿藝術氣息。", "C. 她的文筆極佳，寫出來的文章總是_____，使用了許多華麗的辭藻。", "D. 這名女子在出門前花了一個小時_____，把自己打扮得光鮮亮麗。"],
        correctIndex: 0,
        explanation: "用漂亮的言詞來掩飾自己的過失與錯誤。"
    },
    {
        question: "【火中取栗】正確的用法是？",
        options: ["A. 詐騙集團首腦躲在幕後，卻慫恿年輕車手去銀行領錢，這些車手根本是在_____，最後全被警察抓了。", "B. 這位英勇的消防員在熊熊烈焰中_____，成功救出了被困在屋內的嬰兒。", "C. 糖炒栗子的老闆技術純熟，能夠在滾燙的鐵鍋裡_____，完全不會燙傷手。", "D. 遇到千載難逢的好機會，我們必須_____，立刻採取行動，千萬不能猶豫。"],
        correctIndex: 0,
        explanation: "比喻被別人利用去冒險出力，自己卻一無所獲，還吃了大虧。"
    },
    {
        question: "【一文不名】正確的用法是？",
        options: ["A. 他因為投資失敗而宣告破產，如今已是_____，連買個便當的錢都湊不出來。", "B. 這位臨時演員在演藝圈打滾了十年，至今依然是_____，走在路上根本沒人認識他。", "C. 他寫的這篇科幻小說劇情無聊、文筆極差，簡直是_____，被出版社直接退稿。", "D. 經過專家的鑑定，這個看似古董的花瓶其實是個假貨，根本是_____。"],
        correctIndex: 0,
        explanation: "連一文錢都沒有佔有。形容人極度貧窮。（極易錯重點：表示「極度貧窮」，絕對不是「沒有名氣」！）"
    },
    {
        question: "【首如飛蓬】正確的用法是？",
        options: ["A. 這位單親媽媽每天忙著照顧三個年幼的孩子，根本無暇打理自己，常常是_____就出門買菜了。", "B. 這位田徑選手的速度極快，在賽道上_____，瞬間就衝過了終點線。", "C. 颱風來襲時，海邊的帳篷被狂風吹得_____，散落一地。", "D. 他的文章寫得文采飛揚、_____，讓評審老師看了讚不絕口。"],
        correctIndex: 0,
        explanation: "頭髮散亂得像飛散的蓬草。形容無心化妝打扮，頭髮凌亂。"
    },
    {
        question: "【春蘭秋菊】正確的用法是？",
        options: ["A. 這兩位女主角的演技都非常出色，一個溫婉，一個冷艷，真可謂是_____，各有千秋。", "B. 他在花園裡種滿了各種花草，到了春天，_____，景色美不勝收。", "C. 由於全球暖化的影響，現在的氣候異常，經常出現_____的混亂天氣。", "D. 這家老字號糕餅店的招牌甜點是_____，每天都有大批顧客排隊搶購。"],
        correctIndex: 0,
        explanation: "比喻各自有各自的特點與美好，各有所長，難分高下。"
    },
    {
        question: "【危言聳聽】正確的用法是？",
        options: ["A. 為了騙取選票，這位政客在造勢晚會上_____，誇大國內的經濟危機，搞得人心惶惶。", "B. 這位英勇的記者在戰地前線_____，冒著生命危險傳遞了最真實的報導。", "C. 這棟摩天大樓建在懸崖邊上，看起來_____，讓人看了不禁捏一把冷汗。", "D. 夜晚的森林裡傳來陣陣_____的野獸吼叫聲，讓露營的遊客們嚇得不敢睡覺。"],
        correctIndex: 0,
        explanation: "故意說些誇大、嚇人的話，使人聽了感到驚恐。"
    },
    {
        question: "【孤芳自賞】正確的用法是？",
        options: ["A. 他因為性格清高又不願與人交流，在公司裡總是_____，導致沒有同事願意和他合作。", "B. 春天到了，他在花園裡種了一盆珍貴的蘭花，每天下班後都會對著它_____。", "C. 這款香水的味道非常獨特，噴在身上會散發出一種_____的迷人香氣。", "D. 為了在選美比賽中脫穎而出，她每天對著鏡子_____，練習最完美的笑容。"],
        correctIndex: 0,
        explanation: "比喻自命清高，自我欣賞，不願與世俗同流合污。"
    },
    {
        question: "【出水芙蓉】正確的用法是？",
        options: ["A. 她今天只化了淡淡的妝，穿著一襲白色的洋裝，宛如_____般清新脫俗，氣質非凡。", "B. 夏天到了，植物園裡的池塘裡開滿了_____，吸引了許多遊客前來拍照打卡。", "C. 這道名為_____的宮廷御膳湯品，不僅名字好聽，喝起來更是清甜爽口。", "D. 這位游泳選手的動作極為優美，每一次換氣都像_____一樣，在水中靈活自如。"],
        correctIndex: 0,
        explanation: "比喻詩文清新可愛，也常用來形容女子的容貌清秀美麗，不施濃粉。"
    },
    {
        question: "【桃李滿門】正確的用法是？",
        options: ["A. 王教授在大學任教三十餘年，如今已是_____，許多傑出的科學家都曾經是他的學生。", "B. 春天一到，鄉下的果園裡_____，開滿了粉紅色的桃花與白色的李花，美不勝收。", "C. 這家水果攤的老闆非常熱情，每天早上都會把新鮮的_____擺放在門口吸引顧客。", "D. 為了感謝客戶的支持，公司在中秋節時送出了許多_____的禮盒，大受好評。"],
        correctIndex: 0,
        explanation: "比喻學生極多，到處都有。"
    },
    {
        question: "【浩如煙海】正確的用法是？",
        options: ["A. 中華文化歷史悠久，留下來的古籍文獻_____，窮盡一生也難以全部讀完。", "B. 清晨的湖面上起了一層大霧，看起來_____，讓在湖中划船的遊客迷失了方向。", "C. 跨年夜的廣場上擠滿了數十萬名群眾，_____，大家都在等待煙火釋放的那一刻。", "D. 這場可怕的森林大火延燒了三天三夜，整座山頭_____，空氣中充滿了湯人的味道。"],
        correctIndex: 0,
        explanation: "廣大繁多得像煙霧籠罩的大海一樣。形容文獻、典籍、資料等極其豐富浩雜。"
    },
    {
        question: "【雪泥鴻爪】正確的用法是？",
        options: ["A. 翻開這本泛黃的舊相簿，裡面紀錄的點點滴滴，都是我們青春歲月留下的_____。", "B. 寒流來襲，高山上降下了大雪，地上留下了許多野生動物的_____，吸引了生態學家的注意。", "C. 這家法式甜點店推出了一款名為_____的冬季限定甜點，造型精美，深受女性顧客喜愛。", "D. 在冰天雪地中，這位獵人憑藉著_____的追蹤技術，成功捕獲了罕見的雪豹。"],
        correctIndex: 0,
        explanation: "比喻往事遺留下來的痕跡。"
    },
    {
        question: "【水中撈月】正確的用法是？",
        options: ["A. 他不肯努力工作，卻整天妄想著能中樂透頭獎成為億萬富翁，這簡直是_____，白費心機。", "B. 昨晚的月色極美，他獨自劃著小船在湖面上_____，享受著這難得的靜謐時光。", "C. 為了找回掉進河裡的手機，他不顧危險地跳進水裡_____，最後卻什麼也沒找到。", "D. 警方在案發現場附近的河裡_____，希望能找到歹徒丟棄的犯案凶器。"],
        correctIndex: 0,
        explanation: "比喻去做根本不可能做到的事情，只會白費力氣、徒勞無功。"
    },
        {
        question: "【勢均力敵】正確的用法是？",
        options: ["A. 在這場網球冠軍賽中，兩位選手的技巧與體力都_____，比賽打到第五盤還難分勝負。", "B. 面對敵軍的百萬大軍，我方僅有的幾千名守軍簡直是_____，很快就被徹底擊潰了。", "C. 他憑藉著_____的強大火力，瞬間就摧毀了敵人的防禦工事，取得了壓倒性的勝利。", "D. 為了平息這場群眾抗議，政府決定派出鎮暴警察，以_____的方式強行驅離示威者。"],
        correctIndex: 0,
        explanation: "雙方的勢力和力量相等。形容雙方力量相當，不分高下。"
    },
    {
        question: "【勞燕分飛】正確的用法是？",
        options: ["A. 這對原本人人稱羨的銀色夫妻，最後因為個性不合而_____，讓許多粉絲感到惋惜。", "B. 畢業典禮結束後，全班同學即將_____，各自前往不同的大學就讀。", "C. 秋天到了，天空中的候鳥們_____，準備成群結隊地飛往南方過冬。", "D. 兩位合夥人因為公司股權分配不均而撕破臉，從此_____，各自成立新公司。"],
        correctIndex: 0,
        explanation: "伯勞鳥和燕子分飛。比喻夫妻、情侶的分離。（極易錯重點：不能用於一般朋友或同學！）"
    },
    {
        question: "【敬陪末座】正確的用法是？",
        options: ["A. 這次能和各位業界大老一起參加這場高峰會，小弟才疏學淺，理當_____，多向各位學習。", "B. 他因為平時不努力讀書，這次期末考的成績在全班_____，被老師狠狠訓斥了一頓。", "C. 這位選手在馬拉松比賽中體力不支，最後只能_____，成了最後一個抵達終點的人。", "D. 為了懲罰那些經常遲到的員工，經理規定他們開會時只能_____，沒有發言權。"],
        correctIndex: 0,
        explanation: "恭敬地坐在最後的位子。常作為參加宴會或活動時的自謙之詞。（極易錯重點：是客套的自謙詞，不能用來嘲笑別人成績墊底！）"
    },
    {
        question: "【眾口鑠金】正確的用法是？",
        options: ["A. 雖然他真的沒有做這件事，但在網路酸民的瘋狂轉發與造謠下，_____，他最終還是被迫辭職了。", "B. 這家知名餐廳的招牌菜非常好吃，顧客們_____，紛紛在網路上留下五顆星的評價。", "C. 這位金匠的手藝極佳，能夠在極短的時間內_____，打造出精美的黃金飾品。", "D. 大家集資了一筆龐大的金額，真可謂是_____，成功幫助這家孤兒院重建。"],
        correctIndex: 0,
        explanation: "眾人的言論力量極大，連堅硬的金屬都能熔化。比喻謠言極具破壞力，眾口一詞可以混淆是非，甚至毀滅一個人。"
    },
    {
        question: "【無出其右】正確的用法是？",
        options: ["A. 他在量子物理領域的研究成果極為卓越，當今學術界中可說是_____，無人能與他匹敵。", "B. 這條單行道非常狹窄，開車經過時只能一直往前開，_____，完全沒有轉彎的餘地。", "C. 他做事情總是猶豫不決、_____，常常錯失了許多投資的黃金時機。", "D. 面對主管不合理的指責，他只能低著頭_____，完全不敢替自己辯解半句。"],
        correctIndex: 0,
        explanation: "形容某人在某方面的才華或成就極高，沒有人能超越他。"
    },
    {
        question: "【大張旗鼓】正確的用法是？",
        options: ["A. 為了宣傳這款即將上市的新手機，公司_____地在各大電視台與網路平台上投放了上億元的廣告。", "B. 國慶大典上，儀隊的士兵們在廣場上_____，展現出氣勢磅礡、整齊劃一的操演。", "C. 這位工匠正在修理一面巨大的鼓，他拿起工具_____，試圖把鼓皮繃得更緊。", "D. 為了掩飾自己的罪行，他竟然在法庭上_____，大聲咆哮，企圖干擾法官的判決。"],
        correctIndex: 0,
        explanation: "比喻聲勢浩大，規模排場很大（多用於舉辦活動、宣傳或採取行動）。"
    },
    {
        question: "【分崩離析】正確的用法是？",
        options: ["A. 這個曾經不可一世的龐大帝國，在經歷了多年的內戰與貪腐後，最終走向了_____的結局。", "B. 他不小心把一個珍貴的古董花瓶摔在地上，花瓶瞬間_____，碎成了無數的陶片。", "C. 經過這場激烈的辯論，雙方的意見依然_____，完全沒有辦法達成任何共識。", "D. 由於這台機器的零件嚴重老化，運轉時發出了_____的怪聲音，隨時都有可能爆炸。"],
        correctIndex: 0,
        explanation: "形容國家或集團四分五裂，到了不可收拾的地步。"
    },
    {
        question: "【無疾而終】正確的用法是？",
        options: ["A. 由於雙方在合約條款上始終無法達成共識，這樁原本被外界看好的跨國併購案最後只好_____。", "B. 這位高齡九十歲的老爺爺在睡夢中安詳地離世了，走得非常平靜，可說是_____。", "C. 這位醫生醫術非常高明，能夠讓許多重病患者_____，重新恢復健康的身體。", "D. 他的演講毫無重點，台下聽眾聽得一頭霧水，最後這場演講就在_____的氣氛中結束了。"],
        correctIndex: 0,
        explanation: "現代比喻事情或計畫沒有任何結果，就不了了之、半途而廢。"
    },
    {
        question: "【馬首是瞻】正確的用法是？",
        options: ["A. 在這個新創團隊中，大家都對總監的決策能力深信不疑，凡事都對他_____，完全服從指揮。", "B. 這位將軍騎在戰馬上，士兵們看著他的_____，跟隨著他一起衝向敵軍的陣營。", "C. 這匹名貴的賽馬在馬廄裡高昂著頭，_____，看起來非常有精神。", "D. 面對敵軍強大的火力，我方軍隊嚇得_____，紛紛轉頭向後方逃跑。"],
        correctIndex: 0,
        explanation: "比喻毫無條件地服從指揮，跟隨別人進退。"
    },
    {
        question: "【暗箭傷人】正確的用法是？",
        options: ["A. 他表面上跟你稱兄道弟，私底下卻向老闆打小報告說你壞話，這種_____的行為真是太卑劣了。", "B. 刺客躲在漆黑的樹林裡，趁著將軍經過時_____，成功完成了暗殺任務。", "C. 這位神射手的箭法極高，即使在夜晚也能夠_____，百發百中。", "D. 他的言語非常尖酸刻薄，常常在會議上_____，讓同事們下不了台。"],
        correctIndex: 0,
        explanation: "比喻暗中用陰險的手段陷害別人。"
    },
    {
        question: "【醍醐灌頂】正確的用法是？",
        options: ["A. 聽了大師這番深入淺出的人生哲理後，他頓時覺得_____，多年來的煩惱與困惑瞬間煙消雲散。", "B. 炎炎夏日，他拿起一整桶冰涼的礦泉水從頭上倒下去，這種_____的感覺真是太爽快了。", "C. 由於他不小心打翻了桌上的熱湯，滾燙的湯汁_____，燙得他哇哇大叫。", "D. 他做事總是迷迷糊糊，需要老闆每天對他_____，他才會記得把工作做完。"],
        correctIndex: 0,
        explanation: "比喻灌輸智慧，使人徹底醒悟，或形容聽了高明的意見後，瞬間茅塞頓開。"
    },
    {
        question: "【暴殄天物】正確的用法是？",
        options: ["A. 昨晚的強烈颱風摧毀了南部大片的果園，這種_____的自然災害讓農民損失慘重。", "B. 他脾氣一來就喜歡亂摔家裡的東西，這種_____的行為非常不可取。", "C. 這麼頂級的A5和牛，你竟然把它拿去煮成泡麵，這簡直是_____啊！", "D. 這位藝術家利用廢棄的寶特瓶做出了美麗的裝置藝術，真可謂是_____。"],
        correctIndex: 2,
        explanation: "泛指任意糟蹋、浪費物品，不知道珍惜好東西。"
    },
    {
        question: "【朝三暮四】正確的用法是？",
        options: ["A. 在這段感情中，他總是_____，今天說愛這個，明天又愛上另一個，讓人非常沒有安全感。", "B. 為了考上理想的大學，他每天_____地在圖書館裡苦讀，從來不敢懈怠。", "C. 這家早餐店的老闆非常勤勞，每天_____就起床準備食材，生意非常好。", "D. 他的薪水非常微薄，每個月賺的錢_____，根本無法負擔台北市高昂的房租。"],
        correctIndex: 0,
        explanation: "比喻心意不定，反覆無常。"
    },
    {
        question: "【背道而馳】正確的用法是？",
        options: ["A. 這位極限運動員喜歡挑戰自我，他經常在懸崖邊上_____，展現驚人的平衡感。", "B. 他明明答應要好好讀書，但每天晚上卻跑去網咖打電動，這種行為完全與他的承諾_____。", "C. 遇到危險時，這隻受驚的野兔立刻轉過身來，_____，瞬間消失在森林深處。", "D. 這兩位好朋友因為一點小事吵架後，在十字路口_____，各自走回家了。"],
        correctIndex: 1,
        explanation: "比喻彼此的目標、行動或方向完全相反。"
    },
    {
        question: "【同流合污】正確的用法是？",
        options: ["A. 這裡的兩條大河在城市邊緣_____，形成了一個生態非常豐富的河口濕地。", "B. 面對公司內部嚴重的貪腐文化，他寧可辭職也不願_____，堅持守住自己的道德底線。", "C. 工廠排放的有毒廢水與生活污水_____，導致這條河川散發出陣陣惡臭。", "D. 只要我們大家_____，團結一致，就一定能把社區的環境打掃得乾乾淨淨。"],
        correctIndex: 1,
        explanation: "比喻跟壞人一起做壞事，或隨世俗沉浮而同化於惡劣的環境中。"
    },
    {
        question: "【自欺欺人】正確的用法是？",
        options: ["A. 這位心理醫生非常有耐心，總能洞察病患的心思，絕對不會讓病患有_____的機會。", "B. 警方在辦案時必須講求證據，不能憑空猜測，否則就是一種_____的行為。", "C. 他明明知道這項投資是個騙局，卻為了面子硬說自己賺大錢，這根本是_____。", "D. 這位魔術師的手法非常高明，在舞台上表演了_____的把戲，讓全場觀眾都信以為真。"],
        correctIndex: 2,
        explanation: "欺騙自己，也欺騙別人。形容明知道真相，卻不肯面對現實，還試圖用謊言去掩飾。"
    },
    {
        question: "【車水馬龍】正確的用法是？",
        options: ["A. 經過一場百年罕見的暴雨，市區的街道嚴重積水，呈現出一片_____的慘狀。", "B. 每逢農曆新年，這條知名的年貨大街總是_____，擠滿了前來採買的民眾。", "C. 這家汽車美容店提供非常專業的服務，能把客人的愛車洗得_____，煥然一新。", "D. 為了慶祝元宵節，社區舉辦了盛大的晚會，還有_____的精彩民俗表演。"],
        correctIndex: 1,
        explanation: "形容車馬往來不絕，交通繁忙，市區繁華熱鬧。（極易錯重點：絕對不是街道淹水！）"
    },
    {
        question: "【鸚鵡學舌】正確的用法是？",
        options: ["A. 他在這場會議中完全沒有提出自己的見解，只是_____地重複老闆剛才說過的話，讓人覺得很沒主見。", "B. 這位外國朋友的語言天分極佳，學習中文時簡直是_____，不到半年就能流利對話了。", "C. 他養的這隻寵物鳥非常聰明，經過訓練後已經能_____，每天早上都會跟主人問好。", "D. 他的口才非常好，說起話來_____，邏輯清晰，讓台下的觀眾都聽得非常入迷。"],
        correctIndex: 0,
        explanation: "比喻人沒有自己的主見，只會盲目跟著別人說，或是人云亦云。"
    },
    {
        question: "【大義滅親】正確的用法是？",
        options: ["A. 那個冷血的歹徒為了一點點遺產，竟然做出_____的惡行，殘忍殺害了自己的親生父母。", "B. 當這位警官發現自己的親弟弟參與販毒集團後，他選擇了_____，親自將弟弟逮捕歸案。", "C. 遇到這種百年難得一見的大地震，許多家庭不幸遭遇了_____的悲劇，令人鼻酸。", "D. 為了不被連累，他在朋友陷入困境時立刻選擇_____，與對方劃清界線。"],
        correctIndex: 1,
        explanation: "為了維護國家或社會的正義，不惜制裁或舉發犯罪的親屬。"
    },
    {
        question: "【如影隨形】正確的用法是？",
        options: ["A. 他喜歡在漆黑的夜晚穿著黑衣走在路上，看起來_____，經常嚇到路過的鄰居。", "B. 為了臨摹這幅古代名畫，他每天在畫室裡_____，連每一個筆觸都模仿得一模一樣。", "C. 他們兩兄弟的感情極好，不管去哪裡都_____，從來沒有分開過。", "D. 這個小偷在作案時總是_____，動作極其輕巧，警方很難找到他留下的任何證據。"],
        correctIndex: 2,
        explanation: "比喻兩個人關係非常親密，經常在一起；或比喻兩件事物緊密相連，無法分離。"
    },
    {
        question: "【一針見血】正確的用法是？",
        options: ["A. 這位評論家在政論節目上的發言總是_____，幾句話就點出了這項政策最致命的缺失。", "B. 護理師在幫病人抽血時技術不太熟練，結果_____，讓病人痛得大叫起來。", "C. 這部恐怖電影的畫面非常血腥暴力，呈現出_____的恐怖視覺效果，不適合兒童觀看。", "D. 這位刺客的武功極高，他在黑暗中發射的暗器總是能_____，瞬間奪走敵人的性命。"],
        correctIndex: 0,
        explanation: "比喻說話或寫文章簡潔明快，直截了當，精準地指出問題的本質與核心。"
    },
    {
        question: "【明珠暗投】正確的用法是？",
        options: ["A. 這麼有才華且經驗豐富的資深工程師，居然被安排去做最基礎的影印打雜工作，真是_____。", "B. 停電的時候，她不小心把手上的珍珠項鍊掉在地上，這下_____，不知滾到哪裡去了。", "C. 這位棒球投手在比賽中表現失常，連續投出好幾個壞球，簡直是_____。", "D. 他為了討好上司，暗中送了許多名貴的珠寶，這種_____的行為非常不可取。"],
        correctIndex: 0,
        explanation: "比喻懷才不遇，或是貴重的物品落入不識貨的人手裡，遭到埋沒或蹧蹋。"
    },
    {
        question: "【開門揖盜】正確的用法是？",
        options: ["A. 企業如果不做好資安防護，隨意開放內部網路權限給外部人員，無疑是_____，遲早會被駭客入侵。", "B. 這位警官非常英勇，親自到嫌犯的住處_____，將潛逃多日的歹徒逮捕歸案。", "C. 這家商店的保全系統非常嚴密，就算有小偷想來_____，也會立刻被警報器嚇跑。", "D. 為了展現好客之道，他每天早上都會打開大門，_____地歡迎所有來訪的客人。"],
        correctIndex: 0,
        explanation: "比喻引進壞人，自招禍患。（與「引狼入室」意思相近）。"
    },
    {
        question: "【紙醉金迷】正確的用法是？",
        options: ["A. 這位富二代整天流連於高級夜總會與賭場，過著_____的荒唐生活，很快就把家產敗光了。", "B. 為了完成這幅巨大的金箔畫作，這位藝術家每天在工作室裡_____，非常專注。", "C. 這位書法大師的字寫得極好，讓人看了_____，讚嘆不已。", "D. 他喝了太多酒，看著桌上的鈔票覺得_____，最後醉倒在路邊。"],
        correctIndex: 0,
        explanation: "比喻奢侈浮華、享樂揮霍的糜爛生活。"
    },
    {
        question: "【居安思危】正確的用法是？",
        options: ["A. 雖然公司目前的業績屢創新高，但老闆依然_____，積極佈局未來的轉型計畫以應對市場變化。", "B. 這棟大樓建在地震斷層帶上，居民們每天都_____，深怕哪天大樓會倒塌。", "C. 他做壞事被警察通緝，現在只能四處躲藏，過著_____的逃亡生活。", "D. 看到別人發生嚴重的車禍，他不禁_____，覺得自己以後開車也要非常小心。"],
        correctIndex: 0,
        explanation: "處在平安的環境中，要想到可能出現的危險。形容人有遠見，隨時保持警惕，防患未然。"
    },
    {
        question: "【冠蓋雲集】正確的用法是？",
        options: ["A. 今晚的國慶晚宴上_____，各國使節與政商名流齊聚一堂，場面非常盛大。", "B. 遇到連續的梅雨季，天空總是_____，陰沉沉的讓人心情不好。", "C. 這家知名的帽子專賣店裡_____，展示了來自世界各地的特色帽款。", "D. 為了爭取限量商品，百貨公司門口_____，擠滿了排隊搶購的民眾。"],
        correctIndex: 0,
        explanation: "形容達官貴人或政商名流聚集在一起，像雲一樣多。（極易錯重點：專指政商名流聚集，不能用於一般群眾！）"
    },
    {
        question: "【含沙射影】正確的用法是？",
        options: ["A. 經理在會議上雖然沒有點名，但那番_____的言論，明眼人都知道他是在針對小李。", "B. 孩子們在海邊的沙灘上玩耍，開心地_____，堆出了許多美麗的沙堡。", "C. 這位攝影師的技術極佳，在沙漠中拍出了_____的絕美夕陽風景照。", "D. 面對歹徒的攻擊，這位武術大師_____，迅速從地上抓起一把沙子灑向對方的眼睛。"],
        correctIndex: 0,
        explanation: "比喻暗中誹謗、攻擊或陷害別人。"
    },
    {
        question: "【為虎作倀】正確的用法是？",
        options: ["A. 這些無良的律師不幫受害者伸張正義，反而_____，替那些詐騙集團尋找逃脫法律制裁的漏洞。", "B. 為了保護瀕臨絕種的石虎，這群保育人士_____，在山區設立了許多生態保護區。", "C. 這位畫家最擅長畫野生動物，他_____，在畫布上描繪出了老虎威風凜凜的姿態。", "D. 在這齣舞台劇中，他_____，穿上布偶裝扮演了一隻會說話的可愛小老虎。"],
        correctIndex: 0,
        explanation: "比喻幫助惡人做壞事。（與「助紂為虐」意思相同）。"
    },
    {
        question: "【佛頭著糞】正確的用法是？",
        options: ["A. 在這座擁有百年歷史的精美古蹟牆上隨意塗鴉，簡直是_____，嚴重褻瀆了文化遺產。", "B. 廣場上的偉人銅像因為長期沒有人清理，常常被鳥類_____，看起來非常髒亂。", "C. 他做事情總是毛手毛腳，不小心把墨水滴在便宜的廢紙上，真是_____。", "D. 這位藝術家利用廢棄物來創作，化腐朽為神奇，即使是_____也能變成藝術品。"],
        correctIndex: 0,
        explanation: "比喻美好的事物被褻瀆、玷污；或指好文章被加上了拙劣的修改。"
    },
    {
        question: "【庸人自擾】正確的用法是？",
        options: ["A. 醫生的檢查報告都說你很健康了，你還每天擔心自己得了絕症，這根本是_____。", "B. 遇到這麼大的挫折，他不僅沒有放棄，反而_____，積極尋找解決的方法。", "C. 這裡的治安非常好，到了晚上依然_____，居民們連睡覺都不用鎖門。", "D. 這個社區裡住著許多無業遊民，經常在半夜_____，大聲喧嘩影響別人休息。"],
        correctIndex: 0,
        explanation: "比喻本來沒有問題，卻自己瞎擔心、自找麻煩。"
    },
    {
        question: "【因噎廢食】正確的用法是？",
        options: ["A. 我們不能因為曾經發生過一次小小的資安漏洞，就_____地全面禁止員工使用網路。", "B. 他因為生了重病，喉嚨非常痛，這幾天只能_____，完全無法吞下任何固體食物。", "C. 為了在短時間內瘦下來，她採取了極端的_____減肥法，每天只喝水不吃東西。", "D. 這家餐廳的衛生條件極差，顧客吃完後紛紛_____，跑到醫院掛急診。"],
        correctIndex: 0,
        explanation: "比喻因為出了點小毛病，或怕出問題，就把重要的事情整個停下來不做了。"
    },
    {
        question: "【三緘其口】正確的用法是？",
        options: ["A. 對於公司即將進行大規模裁員的內部機密，知情的主管們都_____，絕不向外界透露半點風聲。", "B. 這位外科醫生的技術極佳，在幫病患處理傷口時_____，縫合得非常完美，幾乎看不出疤痕。", "C. 看到這道美味的麻辣火鍋，他餓得_____，立刻拿起筷子大口吃了起來。", "D. 為了在辯論賽中贏得勝利，他_____，用極其銳利的言辭把對手批評得體無完膚。"],
        correctIndex: 0,
        explanation: "比喻說話非常謹慎，或者緊閉嘴巴，一句話也不說。"
    },
    {
        question: "【投其所好】正確的用法是？",
        options: ["A. 得知董事長特別喜歡收集古董字畫後，他立刻_____，送上了一幅名貴的唐代山水畫以求升遷。", "B. 這位籃球選手在最後三秒鐘_____，成功投進了一顆決定勝負的三分球。", "C. 遇到千載難逢的創業機會，我們必須_____，將所有的資金都投入這個有潛力的項目。", "D. 他的學習態度非常認真，每天在圖書館裡_____，把所有的精力都放在準備考試上。"],
        correctIndex: 0,
        explanation: "指為了討好別人，故意順著對方喜歡的事物去迎合他。"
    },
    {
        question: "【金科玉律】正確的用法是？",
        options: ["A. 對這位虔誠的信徒來說，宗教經典上的每一字每一句都是_____，絕對不能有絲毫違背。", "B. 這家銀樓的櫥窗裡擺滿了各種_____，在燈光的照射下閃閃發光，吸引了許多顧客。", "C. 這位貪官汙吏在任期間收受了大量的_____，最後東窗事發，被法院判處無期徒刑。", "D. 他在大學裡主修法律系，每天都要背誦許多_____，準備未來的國家司法考試。"],
        correctIndex: 0,
        explanation: "比喻不可更改、必須嚴格遵守的信條或準則。"
    },
    {
        question: "【如雷貫耳】正確的用法是？",
        options: ["A. 這位國際知名導演的大名在電影圈早已是_____，今天能親眼見到他本人，真是三生有幸。", "B. 昨晚的颱風夜裡，天空中響起了一陣_____的巨響，把睡夢中的孩子們都嚇哭了。", "C. 他習慣戴著耳機聽重金屬音樂，而且音量開得_____，長期下來導致聽力嚴重受損。", "D. 由於他在工廠裡沒有戴上防護耳罩，機器的運轉聲_____，讓他感到非常不舒服。"],
        correctIndex: 0,
        explanation: "比喻人的名氣極大，大家都聽過他的名字。"
    },
    {
        question: "【如釋重負】正確的用法是？",
        options: ["A. 經歷了長達一個月的高壓專案後，在成功交付給客戶的那一刻，全體團隊成員都感到_____。", "B. 這位舉重選手在奧運舞台上_____，成功舉起了超過他體重兩倍的槓鈴，奪下金牌。", "C. 他因為投資失敗而破產，現在身上_____，每天都被銀行和債主追著跑，生活苦不堪言。", "D. 國王為了慶祝王子的誕生，下令大赦天下，許多囚犯因此_____，獲得了自由。"],
        correctIndex: 0,
        explanation: "比喻責任已盡或繁重的工作完成後，身心感到極度輕鬆愉快的狀態。"
    },
    {
        question: "【走馬上任】正確的用法是？",
        options: ["A. 在前任總經理閃電辭職後，董事會緊急指派了這位資深副總_____，接手處理公司的大小事務。", "B. 這位古代的將軍騎著心愛的戰馬，在戰場上_____，率領軍隊打敗了無數的敵軍。", "C. 這次的歐洲旅遊行程安排得太過緊湊，我們對於許多著名的博物館只能_____，無法深入參觀。", "D. 由於他在公司裡犯了嚴重的錯誤，老闆氣得當場要他_____，立刻收拾東西離開公司。"],
        correctIndex: 0,
        explanation: "比喻新官上任，或接手新的職位。"
    },
    {
        question: "【破天荒】正確的用法是？",
        options: ["A. 那個一向一毛不拔的鐵公雞，今天居然_____地主動請大家喝飲料，讓所有同事都嚇了一跳。", "B. 這幾個月來都沒有下雨，導致南部地區出現了_____的嚴重旱災，農作物全面枯死。", "C. 這群年輕的拓荒者來到這片無人居住的島嶼，準備_____，建立一個屬於自己的新家園。", "D. 弟弟在客廳玩球時，不小心_____，把媽媽最心愛的古董花瓶給砸碎了。"],
        correctIndex: 0,
        explanation: "比喻從來沒有出現過的事物，或第一次發生的罕見情況。"
    },
    {
        question: "【別出心裁】正確的用法是？",
        options: ["A. 這場服裝秀的舞台設計_____，模特兒們從水面下的透明隧道走出來，驚豔了全場觀眾。", "B. 這家成衣工廠的裁縫師們每天加班，_____，趕製出了一大批準備出口的冬季外套。", "C. 為了報復曾經得罪過他的同事，他_____，設下了一個惡毒的陷阱來陷害對方。", "D. 公司因為營運不善，老闆決定_____，解雇了將近一半的員工來節省人事成本。"],
        correctIndex: 0,
        explanation: "形容構思、設計獨創一格，與眾不同。"
    },
    {
        question: "【千篇一律】正確的用法是？",
        options: ["A. 現在的偶像劇劇情幾乎都是_____，不外乎是霸道總裁愛上平凡女孩的套路，讓人看得很膩。", "B. 這位學生非常有毅力，為了準備國文考試，他竟然把_____古文全都背得滾瓜爛熟。", "C. 法官在判案時必須嚴格遵守_____，絕對不能因為個人的情感而做出偏袒的判決。", "D. 他的打字速度極快，只要一個小時就能打出_____，是辦公室裡效率最高的員工。"],
        correctIndex: 0,
        explanation: "比喻文章、說話或事物的形式呆板，毫無變化、缺乏新意。"
    },
    {
        question: "【千鈞一髮】正確的用法是？",
        options: ["A. 就在卡車快要撞上小女孩的_____之際，路人奮不顧身地撲上前將她推開，化解了一場悲劇。", "B. 這位奧運舉重選手力大無窮，在比賽中舉起了_____的槓鈴，成功打破了世界紀錄。", "C. 他最近因為工作壓力太大，導致嚴重的掉髮問題，每天洗頭時都會掉下_____，讓他非常煩惱。", "D. 這家理髮店的生意非常好，設計師每天都要幫幾十位客人_____，忙得不可開交。"],
        correctIndex: 0,
        explanation: "比喻情況極度危急、危險到了極點。（與「迫在眉睫」意思相近）。"
    },
    {
        question: "【目不識丁】正確的用法是？",
        options: ["A. 牆上的釘子實在太小了，他因為老花眼嚴重，根本_____，什麼也看不見。", "B. 爺爺小時候因為家裡貧困無法去學校上學，成了一個_____的人，連自己的名字都不會寫。", "C. 他剛轉學來這個班級，對所有同學都_____，甚至連坐在旁邊的班長小丁都不認識。", "D. 由於他在國外長大，對台灣的歷史文化_____，完全無法參與大家的討論。"],
        correctIndex: 1,
        explanation: "比喻人完全不識字，是個文盲。"
    },
    {
        question: "【諱莫如深】正確的用法是？",
        options: ["A. 這口百年古井的深度_____，就算丟石頭下去，也聽不到任何回音。", "B. 這位國學大師的學問_____，他寫出來的文章意境太高，一般人根本無法理解。", "C. 對於公司即將被惡意併購的傳聞，高層主管們都_____，不肯對媒體透露半點口風。", "D. 他們兩人之間的感情_____，無論遇到多大的困難都不離不棄，讓人十分羨慕。"],
        correctIndex: 2,
        explanation: "把事情隱瞞得很緊，不讓別人知道。比喻嚴守秘密。"
    },
    {
        question: "【江郎才盡】正確的用法是？",
        options: ["A. 這位暢銷作家自從上一本小說爆紅後，似乎就_____了，這幾年再也寫不出任何好作品。", "B. 他因為過度沉迷於賭博，不到半年就_____，連買個便當的錢都湊不出來了。", "C. 跑完這場高強度的全馬比賽，他已經_____，癱倒在終點線上無法動彈。", "D. 由於長達半年沒有下雨，這條原本水量豐沛的大河已經_____，露出了乾涸的河床。"],
        correctIndex: 0,
        explanation: "比喻人的文采減退，才華用盡。"
    },
    {
        question: "【寅吃卯糧】正確的用法是？",
        options: ["A. 他因為嚴重偏食，竟然_____，只吃特定生肖年份出產的食物，讓媽媽非常頭痛。", "B. 他每個月都刷卡買昂貴的名牌包，這種_____的消費習慣，讓他積欠了龐大的卡債。", "C. 他餓了整整一天，一看到桌上的豐盛大餐立刻_____，三兩下就把食物全吃光了。", "D. 為了在秋天迎來大豐收，農夫們每天_____，天還沒亮就趕著下田去工作了。"],
        correctIndex: 1,
        explanation: "比喻入不敷出，預先透支了未來的收入。"
    },
    {
        question: "【畫地為牢】正確的用法是？",
        options: ["A. 警察為了保護命案現場的證據不被破壞，在地上_____，拉起了黃色的封鎖線。", "B. 在進行創意發想時，我們必須勇於突破框架，千萬不要_____，限制了自己的想像力。", "C. 小孩子們在沙灘上_____，開心地玩著蓋沙雕城堡的遊戲。", "D. 這位富豪花了大筆資金買下這塊土地，準備_____，蓋一座守衛森嚴的私人別墅。"],
        correctIndex: 1,
        explanation: "現代多比喻思想保守，自己限制了自己的發展（與「畫地自限」相似）。"
    },
    {
        question: "【程門立雪】正確的用法是？",
        options: ["A. 他為了向心儀已久的女孩告白，在對方家門口_____，站了一整夜都不肯離去。", "B. 這場突如其來的暴風雪，讓許多登山客_____，被困在山屋裡無法下山。", "C. 為了向這位退休的國學大師請益，他展現出_____的誠意，在門外恭敬地等候大師醒來。", "D. 冬天的北京故宮非常美麗，尤其是那_____的雪景，吸引了無數攝影師前來取景。"],
        correctIndex: 2,
        explanation: "比喻尊師重道，恭敬地向老師求教。（極易錯重點：專指尊師重道，絕對不能用在等情人！）"
    },
    {
        question: "【一觸即發】正確的用法是？",
        options: ["A. 兩國軍隊在邊界集結了重兵，雙方外交關係降至冰點，一場毀滅性的戰爭似乎_____。", "B. 這支新款智慧型手機的觸控螢幕非常靈敏，只要_____，就能瞬間打開任何應用程式。", "C. 這輛超級跑車的引擎性能極佳，駕駛踩下油門後_____，瞬間飆出最高時速。", "D. 他是一位極具天分的詩人，只要看到美麗的風景，靈感就會_____，馬上寫出一首好詩。"],
        correctIndex: 0,
        explanation: "比喻情勢極度緊張，隨時都會發生危機或衝突。"
    },
    {
        question: "【如膠似漆】正確的用法是？",
        options: ["A. 這對新婚夫妻感情非常甜蜜，整天_____地黏在一起，羨煞了周遭所有的親友。", "B. 他正在重新裝潢房間，把牆壁塗得_____，非常平整漂亮。", "C. 他不小心踩到地上的口香糖，鞋底變得_____，怎麼拔都拔不掉。", "D. 連假期間的高速公路塞滿了車子，車流_____，完全動彈不得。"],
        correctIndex: 0,
        explanation: "形容感情極度深厚、親密，難以分離。（多用於形容夫妻或情侶）。"
    },
    {
        question: "【觥籌交錯】正確的用法是？",
        options: ["A. 市區的交通動線非常複雜，各種高架橋_____，讓外地人開車時很容易迷路。", "B. 在這場盛大的公司尾牙宴上，大家_____，互相敬酒，氣氛十分熱絡與歡樂。", "C. 兩位武林高手在擂台上_____，刀光劍影，打得難分難解。", "D. 回憶起過去的種種，無數的畫面在他腦海中_____，讓他百感交集。"],
        correctIndex: 1,
        explanation: "形容宴會中熱鬧、頻繁敬酒的歡樂場景。"
    },
    {
        question: "【盲人瞎馬】正確的用法是？",
        options: ["A. 這位_____，每天靠著訓練有素的導盲犬的帶領，安全地穿越馬路去上班。", "B. 遊行隊伍遇到大雨，群眾就像_____一樣四處亂竄，場面非常混亂。", "C. 他對股市完全外行，卻把畢生積蓄投入高風險的期貨市場，這簡直是_____，隨時會傾家蕩產。", "D. 停電時，他在黑暗的房間裡_____地尋找手電筒，結果不小心撞倒了昂貴的花瓶。"],
        correctIndex: 2,
        explanation: "比喻人對客觀情況一無所知，卻盲目行動，面臨著極度危險的處境而不自知。"
    }
];
const grammarData = [
    { question: "修正：「夏天的陽明山，真是我們納涼避暑、休閒娛樂的好季節。」", options: ["A. 「納涼」與「避暑」語意重複", "B. 主語「陽明山」不能與賓語「好季節」搭配", "C. 「休閒娛樂」不適合在夏天進行", "D. 句子缺乏謂語動詞"], correctIndex: 1, explanation: "主賓搭配不當。「陽明山」是地方，不是「季節」，應改為「好去處」。" },
    { question: "修正：「為了防止類似的校園霸凌事件不再發生，校長頒布了新規定。」", options: ["A. 「防止」與「不再發生」雙重否定導致語意相反", "B. 「類似」與「事件」重複", "C. 「頒布」不能搭配「規定」", "D. 缺乏主語"], correctIndex: 0, explanation: "否定不當。「防止」本身已有否定意味，加上「不再」，就變成了「希望它繼續發生」，應刪去「不」。" },
    { question: "修正：「通過這次的防震演習，使同學們學會了逃生技能。」", options: ["A. 「演習」不能搭配「防震」", "B. 「學會了」與「技能」不配", "C. 濫用「通過」與「使」，導致句子缺乏主語", "D. 「同學們」指代不明"], correctIndex: 2, explanation: "成分殘缺（無主語）。刪去「通過」或「使」，讓句子有明確的主語。" },
    { question: "修正：「這篇文章的作者，是出自於一位年僅十五歲的中學生之手。」", options: ["A. 「年僅」與「十五歲」重複", "B. 將「作者是...」與「出自...之手」兩種句型雜糅", "C. 「作者」與「中學生」搭配不當", "D. 缺乏賓語"], correctIndex: 1, explanation: "句式雜糅。應改為「作者是一位中學生」或「文章出自中學生之手」。" },
    { question: "修正：「在圖書館裡，大家都能聽到翻書的聲音和專注的眼神。」", options: ["A. 「圖書館裡」不能用作狀語", "B. 「專注的」不能修飾「眼神」", "C. 動詞「聽到」不能搭配賓語「眼神」", "D. 「聽到」與「聲音」重複"], correctIndex: 2, explanation: "動賓搭配不當。「聽到」只能配「聲音」，不能配「眼神」，應改為「聽到聲音，看到眼神」。" },
    { question: "修正：「他非常喜歡這件昨天剛買的藍色條紋的男裝純棉襯衫。」", options: ["A. 多項定語語序不當", "B. 「喜歡」缺乏受詞", "C. 「純棉」不能形容「襯衫」", "D. 主客體顛倒"], correctIndex: 0, explanation: "語序不當。正確順序應為：領屬/時間 + 特徵 + 質料，改為「這件昨天剛買的男裝藍色條紋純棉襯衫」。" },
    { question: "修正：「我們必須認真克服並隨時發現學習上的缺點。」", options: ["A. 「認真」不能修飾「克服」", "B. 「克服」與「發現」邏輯先後順序顛倒", "C. 「缺點」不能被「發現」", "D. 句子缺乏主語"], correctIndex: 1, explanation: "邏輯不合（語序顛倒）。必須先「發現」缺點，然後才能「克服」缺點。" },
    { question: "修正：「能否培養良好的閱讀習慣，是提升國文成績的關鍵。」", options: ["A. 前面是兩面詞「能否」，後面是一面詞「提升」，前後邏輯失衡", "B. 「培養」不能搭配「習慣」", "C. 「提升」不能搭配「成績」", "D. 缺乏主語"], correctIndex: 0, explanation: "兩面與一面搭配不當。應改為「能否培養...，是能否提升...的關鍵」或刪除「能否」。" },
    { question: "修正：「看到他滑稽的模樣，我忍不住差點笑了出來。」", options: ["A. 「滑稽的」不能修飾「模樣」", "B. 「忍不住」與「差點」語意矛盾重複", "C. 缺乏謂語", "D. 「笑了出來」時態錯誤"], correctIndex: 1, explanation: "自相矛盾/語意重複。「忍不住」代表已經笑了，「差點」代表沒笑，兩者不能並用。" },
    { question: "修正：「他穿著一件灰色上衣，一頂藍色棒球帽。」", options: ["A. 「穿著」不能同時搭配「上衣」和「帽子」", "B. 缺乏主語", "C. 「灰色」與「藍色」色彩衝突", "D. 句子缺乏賓語"], correctIndex: 0, explanation: "謂語殘缺/搭配不當。「穿著」不能配「帽子」，應在「一頂」前加上動詞「戴著」。" },
    { 
        question: "修正：「經過這次的深刻教訓，使他終於明白了遵守交通規則的重要性。」", 
        options: ["A. 「深刻」與「教訓」搭配不當，應改為「嚴重教訓」", "B. 「終於明白了」語意重複，應刪去「終於」", "C. 濫用「經過」與「使」，導致句子缺乏主語，應刪除其中一個", "D. 句尾缺乏賓語，應在句末加上「的道理」"], 
        correctIndex: 2, 
        explanation: "成分殘缺（無主語）。濫用介詞「經過」與使動詞「使」，導致找不到主語。" 
    },
    { 
        question: "修正：「這項最新推出的青年安居政策，其初衷是為了旨在減輕年輕人的購屋負擔。」", 
        options: ["A. 「初衷」與「是為了旨在」語意重複，應刪去「是為了旨在」或「初衷」", "B. 句子缺乏謂語動詞，邏輯不通", "C. 「減輕」與「負擔」搭配不當，應改為「減少負擔」", "D. 「青年」與「年輕人」指代不明，產生歧義"], 
        correctIndex: 0, 
        explanation: "語意重複/贅餘。「初衷」與「旨在」意思重疊，保留一個即可。" 
    },
    { 
        question: "修正：「為了迎接即將到來的百年校慶，同學們都在熱烈地培養各項表演節目。」", 
        options: ["A. 「即將」與「到來」語意重複", "B. 「熱烈」不能用來修飾同學的動作", "C. 句子缺乏主語，不知道是誰在迎接校慶", "D. 「培養」不能搭配「節目」，動賓搭配不當，應改為「排練」"], 
        correctIndex: 3, 
        explanation: "搭配不當。「培養」不能修飾「節目」，應改為「排練」。" 
    },
    { 
        question: "修正：「經過點名確認，會議室裡大約有五十個人左右在參加這場跨部門會議。」", 
        options: ["A. 「經過點名確認」是多餘的廢話", "B. 「大約」和「左右」語意重複，且與「點名確認」的精確性自相矛盾", "C. 「在參加」缺乏賓語，語意不完整", "D. 「五十個人」量詞使用錯誤，應改為「五十位」"], 
        correctIndex: 1, 
        explanation: "自相矛盾/語意重複。「大約」和「左右」重複，且與「確認」的精確性矛盾。" 
    },
    { 
        question: "修正：「這次國際航班嚴重延誤的原因，是因為受到強烈颱風影響所造成的。」", 
        options: ["A. 「延誤」不能用來形容「航班」", "B. 把「...的原因是...」與「是由於...所造成的」兩種句型混雜在一起", "C. 缺乏主語，不知道是誰導致了延誤", "D. 「強烈颱風」與「影響」搭配不當"], 
        correctIndex: 1, 
        explanation: "句式雜糅。將兩種句型硬湊在一起，應拆解回單一結構。" 
    },
    { 
        question: "修正：「為了提升團隊效率，我們必須認真克服並隨時發現工作流程中的缺點。」", 
        options: ["A. 「認真」不能修飾「克服」，應改為「努力」", "B. 「提升」與「效率」搭配不當", "C. 「克服」與「發現」的語序顛倒，不合邏輯，應先發現才能克服", "D. 句子缺乏主語"], 
        correctIndex: 2, 
        explanation: "語序不當/不合邏輯。必須先「發現」問題，然後才能「克服」。" 
    },
    { 
        question: "修正：「李明剛走進辦公室，就看見張華正在和他的父親激烈地爭吵。」", 
        options: ["A. 「看見」與「爭吵」搭配不當", "B. 「他」這個代詞指代不明，產生歧義，不知道是指李明的父親還是張華的父親", "C. 「激烈地」不能用來修飾爭吵", "D. 句子缺乏謂語"], 
        correctIndex: 1, 
        explanation: "表意不明/歧義。代名詞「他」指代不清，需明確指出是誰的父親。" 
    },
    { 
        question: "修正：「儘管外頭下著傾盆大雨，所以搜救隊員依然沒有放棄尋找失蹤的登山客。」", 
        options: ["A. 「傾盆大雨」與「下著」語意重複", "B. 「儘管」表轉折讓步，「所以」表因果，兩者搭配不當，應把「所以」改為「但是/依然」", "C. 「放棄」與「尋找」動賓搭配不當", "D. 句子缺乏主語"], 
        correctIndex: 1, 
        explanation: "關聯詞搭配不當。「儘管」表轉折，應搭配「但是」或「依然」，不能配表因果的「所以」。" 
    },
    { 
        question: "修正：「一家企業能否在激烈的市場中永續經營，關鍵在於該企業擁有強大的核心競爭力。」", 
        options: ["A. 前半句是兩面詞「能否」，後半句是一面詞「擁有」，前後無法對應", "B. 「永續」與「經營」語意重複", "C. 「激烈」不能用來修飾「市場」，應改為「競爭」", "D. 句子缺乏賓語"], 
        correctIndex: 0, 
        explanation: "兩面與一面失衡。前半句「能否」有兩種可能，後半句「擁有」只有一種，邏輯面沒有對齊。" 
    },
    { 
        question: "修正：「為了防止這類嚴重的工安意外不再發生，廠長下令全面升級消防設備。」", 
        options: ["A. 「防止」與「不再」構成雙重否定，導致句子變成了『希望意外繼續發生』的意思", "B. 「全面升級」與「消防設備」搭配不當", "C. 句子缺乏主語，不知道是誰在防止意外", "D. 「這類嚴重」語序顛倒，應改為「嚴重這類」"], 
        correctIndex: 0, 
        explanation: "否定不當/不合邏輯。「防止」已有否定意味，加「不再」會變成負負得正，與原意相反。" 
    },

    // --- 第 11 到 20 題 ---
    { 
        question: "修正：「夏天的陽明山，真是我們納涼避暑、休閒娛樂的好季節。」", 
        options: ["A. 「納涼」與「避暑」語意重複", "B. 主語「陽明山」不能與賓語「好季節」搭配", "C. 「休閒娛樂」不適合在夏天進行", "D. 句子缺乏謂語動詞"], 
        correctIndex: 1, 
        explanation: "主賓搭配不當。「陽明山」是地方，不是「季節」，應改為「好去處」。" 
    },
    { 
        question: "修正：「為了防止類似的校園霸凌事件不再發生，校長頒布了新規定。」", 
        options: ["A. 「防止」與「不再發生」雙重否定導致語意相反", "B. 「類似」與「事件」重複", "C. 「頒布」不能搭配「規定」", "D. 缺乏主語"], 
        correctIndex: 0, 
        explanation: "否定不當。「防止」本身已有否定意味，加上「不再」，就變成了「希望它繼續發生」，應刪去「不」。" 
    },
    { 
        question: "修正：「通過這次的防震演習，使同學們學會了逃生技能。」", 
        options: ["A. 「演習」不能搭配「防震」", "B. 「學會了」與「技能」不配", "C. 濫用「通過」與「使」，導致句子缺乏主語", "D. 「同學們」指代不明"], 
        correctIndex: 2, 
        explanation: "成分殘缺（無主語）。刪去「通過」或「使」，讓句子有明確的主語。" 
    },
    { 
        question: "修正：「這篇文章的作者，是出自於一位年僅十五歲的中學生之手。」", 
        options: ["A. 「年僅」與「十五歲」重複", "B. 將『作者是...』與『出自...之手』兩種句型雜糅", "C. 「作者」與「中學生」搭配不當", "D. 缺乏賓語"], 
        correctIndex: 1, 
        explanation: "句式雜糅。應改為「作者是一位中學生」或「文章出自中學生之手」。" 
    },
    { 
        question: "修正：「在圖書館裡，大家都能聽到翻書的聲音和專注的眼神。」", 
        options: ["A. 「圖書館裡」不能用作狀語", "B. 「專注的」不能修飾「眼神」", "C. 動詞「聽到」不能搭配賓語「眼神」", "D. 「聽到」與「聲音」重複"], 
        correctIndex: 2, 
        explanation: "動賓搭配不當。「聽到」只能配「聲音」，不能配「眼神」，應改為「聽到聲音，看到眼神」。" 
    },
    { 
        question: "修正：「他非常喜歡這件昨天剛買的藍色條紋的男裝純棉襯衫。」", 
        options: ["A. 多項定語語序不當", "B. 「喜歡」缺乏受詞", "C. 「純棉」不能形容「襯衫」", "D. 主客體顛倒"], 
        correctIndex: 0, 
        explanation: "語序不當。正確順序應為：領屬/時間 + 特徵 + 質料，改為「這件昨天剛買的男裝藍色條紋純棉襯衫」。" 
    },
    { 
        question: "修正：「我們必須認真克服並隨時發現學習上的缺點。」", 
        options: ["A. 「認真」不能修飾「克服」", "B. 「克服」與「發現」邏輯先後順序顛倒", "C. 「缺點」不能被「發現」", "D. 句子缺乏主語"], 
        correctIndex: 1, 
        explanation: "邏輯不合（語序顛倒）。必須先「發現」缺點，然後才能「克服」缺點。" 
    },
    { 
        question: "修正：「能否培養良好的閱讀習慣，是提升國文成績的關鍵。」", 
        options: ["A. 前面是兩面詞「能否」，後面是一面詞「提升」，前後邏輯失衡", "B. 「培養」不能搭配「習慣」", "C. 「提升」不能搭配「成績」", "D. 缺乏主語"], 
        correctIndex: 0, 
        explanation: "兩面與一面搭配不當。應改為「能否培養...，是能否提升...的關鍵」或刪除「能否」。" 
    },
    { 
        question: "修正：「看到他滑稽的模樣，我忍不住差點笑了出來。」", 
        options: ["A. 「滑稽的」不能修飾「模樣」", "B. 「忍不住」與「差點」語意矛盾重複", "C. 缺乏謂語", "D. 「笑了出來」時態錯誤"], 
        correctIndex: 1, 
        explanation: "自相矛盾/語意重複。「忍不住」代表已經笑了，「差點」代表沒笑，兩者不能並用。" 
    },
    { 
        question: "修正：「他穿著一件灰色上衣，一頂藍色棒球帽。」", 
        options: ["A. 「穿著」不能同時搭配「上衣」和「帽子」", "B. 缺乏主語", "C. 「灰色」與「藍色」色彩衝突", "D. 句子缺乏賓語"], 
        correctIndex: 0, 
        explanation: "謂語殘缺/搭配不當。「穿著」不能配「帽子」，應在「一頂」前加上動詞「戴著」。" 
    },
    { 
        question: "修正：「他的晚年，仍然精力充沛，充滿了創作的熱情。」", 
        options: ["A. 「晚年」與「精力充沛」主謂搭配不當，應改為「他在晚年」", "B. 「精力充沛」與「充滿」語意重複", "C. 缺乏賓語，不知道創作什麼", "D. 「熱情」不能被「充滿」"], 
        correctIndex: 0, 
        explanation: "主謂搭配不當。「精力充沛」的應該是「他（人）」，而不是「晚年（時間）」，主語錯置。" 
    },
    { 
        question: "修正：「這是一個多麼令人無比難忘的回憶啊！」", 
        options: ["A. 「多麼」與「無比」語意重複，保留其一即可", "B. 「難忘」不能修飾「回憶」", "C. 「這」指代不明", "D. 句子缺乏主語"], 
        correctIndex: 0, 
        explanation: "語意重複 / 贅餘。「多麼」和「無比」都表示程度極深，兩者疊用造成語意累贅。" 
    },
    { 
        question: "修正：「幾個學校的老師今天下午會來參觀我們的科展。」", 
        options: ["A. 句子缺乏謂語", "B. 「幾個」指代不明，產生歧義，不知道是指「幾所學校」還是「幾位老師」", "C. 「參觀」與「科展」搭配不當", "D. 時間副詞「今天下午」位置錯誤"], 
        correctIndex: 1, 
        explanation: "表意不明（歧義）。數量詞「幾個」修飾對象不明確，可理解為「幾個（學校的）老師」或「（幾個學校）的老師」。" 
    },
    { 
        question: "修正：「這次活動之所以能舉辦得如此成功，是由於大家共同努力的結果。」", 
        options: ["A. 「之所以」不能搭配「是由於」", "B. 「舉辦」與「成功」搭配不當", "C. 把『之所以能成功，是由於...』與『是...的結果』兩種句型雜糅", "D. 句子缺乏主語"], 
        correctIndex: 2, 
        explanation: "句式雜糅。作者將兩種因果句式混用，應改為「是由於大家的共同努力」或「是大家共同努力的結果」。" 
    },
    { 
        question: "修正：「我們班的同學將來都希望成為一個對社會有貢獻的。」", 
        options: ["A. 「希望」與「成為」語序顛倒", "B. 句子結尾成分殘缺，缺乏賓語中心語，應補上『人』", "C. 「將來」位置錯誤，應放在句首", "D. 「對社會」不能修飾「有貢獻」"], 
        correctIndex: 1, 
        explanation: "成分殘缺。句末「成為一個對社會有貢獻的」缺少了名詞賓語，應該補上「人才」或「人」。" 
    },
    { 
        question: "修正：「蘇軾的詩詞對我們中學生是不陌生的。」", 
        options: ["A. 「蘇軾的詩詞」與「中學生」主客體顛倒，應改為「我們中學生對蘇軾的詩詞是不陌生的」", "B. 句子缺乏謂語動詞", "C. 「不陌生」與「熟悉」語意矛盾", "D. 濫用介詞「對」導致無主語"], 
        correctIndex: 0, 
        explanation: "不合邏輯（主客顛倒）。人為主體，事物為客體。應該是「人對事物不陌生」，而不是「事物對人不陌生」。" 
    },
    { 
        question: "修正：「有沒有堅定的意志，是一個人獲得成功的關鍵。」", 
        options: ["A. 「意志」不能被「堅定」修飾", "B. 前半句是兩面詞「有沒有」，後半句是一面詞「獲得成功」，前後邏輯失衡", "C. 「獲得」與「成功」動賓搭配不當", "D. 缺乏主語"], 
        correctIndex: 1, 
        explanation: "兩面與一面搭配不當。前半句有「有/沒有」兩種情況，後半句只有「成功」一種情況，應改為「有沒有...是能否成功的關鍵」或刪去「沒有」。" 
    },
    { 
        question: "修正：「誰也不能否認地球不是繞著太陽轉的。」", 
        options: ["A. 「不能否認」與「不是」構成多重否定，導致句意變成『地球不繞太陽轉』，違反常理", "B. 「繞著」與「轉的」語意重複", "C. 句子缺乏賓語", "D. 主語「誰」指代不明"], 
        correctIndex: 0, 
        explanation: "否定不當 / 不合邏輯。「不能否認」本身是雙重否定表肯定，後面又加了「不是」，變成三重否定，讓句意完全顛倒了事實。" 
    },
    { 
        question: "修正：「他用無微不至的語氣，向我們述說了事情的經過。」", 
        options: ["A. 「述說」不能配「經過」", "B. 「無微不至」修飾不當，不能用來修飾「語氣」，應改為「親切」或「溫和」", "C. 句子缺乏主語", "D. 「向我們」位置錯誤"], 
        correctIndex: 1, 
        explanation: "搭配不當（修飾語與中心語）。「無微不至」通常用來形容照顧、關懷非常周到，不能用來修飾「語氣」。" 
    },
    { 
        question: "修正：「不但他在學習上很努力，而且在體育方面也有出色的表現。」", 
        options: ["A. 「而且」不能搭配「不但」", "B. 「表現」不能用「出色」修飾", "C. 關聯詞位置錯誤，前後分句主語相同（他），主語應放在「不但」之前", "D. 句子缺乏賓語"], 
        correctIndex: 2, 
        explanation: "語序不當。當兩個分句的主語相同時（都是「他」），主語必須放在第一個關聯詞（不但）的前面，即「他不但...而且...」。" 
    },
    { 
        question: "修正：「秋天的陽明山，到處是五顏六色的紅葉。」", 
        options: ["A. 「到處是」與「五顏六色」語意重複", "B. 「五顏六色」不能修飾「紅葉」，兩者自相矛盾", "C. 句子缺乏謂語動詞", "D. 「陽明山」不能作為主語"], 
        correctIndex: 1, 
        explanation: "自相矛盾 / 修飾不當。「紅葉」顧名思義是紅色的，不可能「五顏六色」，修飾語與中心語互相矛盾。" 
    },
    { 
        question: "修正：「這是一本他昨天剛從圖書館借來的很有意思的歷史小說。」", 
        options: ["A. 多項定語語序不當，應改為『他昨天剛從圖書館借來的一本很有意思的歷史小說』", "B. 「一本」與「歷史小說」量詞搭配不當", "C. 「很有意思的」不能修飾「歷史小說」", "D. 句子缺乏主語"], 
        correctIndex: 0, 
        explanation: "語序不當。多項定語的正確排列順序通常是：領屬/時間處所 + 數量 + 特徵 + 名詞。將表數量的「一本」放在最前面會導致語氣不順。" 
    },
    { 
        question: "修正：「看到這幅感人的畫面，使我流下了眼淚。」", 
        options: ["A. 「感人」不能修飾「畫面」", "B. 「流下了」與「眼淚」搭配不當", "C. 濫用隱含介詞與使動詞「使」，導致句子缺乏主語", "D. 「看到」缺乏賓語"], 
        correctIndex: 2, 
        explanation: "成分殘缺（無主語）。「看到...」是動作狀語，加上「使...」後整句話找不到執行動作的主語。應刪除「使」，改為「看到這幅感人的畫面，我流下了眼淚。」" 
    },
    { 
        question: "修正：「這個問題的解決，非得需要大家齊心協力不可。」", 
        options: ["A. 「問題」與「解決」搭配不當", "B. 句子缺乏主語", "C. 「齊心協力」不能修飾「大家」", "D. 「非得...不可」與「需要」語意重複贅餘"], 
        correctIndex: 3, 
        explanation: "語意重複 / 句式雜糅。「非得...不可」本身就包含了「必須/需要」的意思，加上「需要」造成累贅。應改為「非得大家齊心協力不可」或「需要大家齊心協力」。" 
    },
    { 
        question: "修正：「他背著總經理和副總經理偷偷把這筆錢存入了銀行。」", 
        options: ["A. 「偷偷」與「背著」語意重複", "B. 「和」字造成歧義，不知道是『他背著這兩個人』還是『他與副總一起背著總經理』", "C. 「存入」與「銀行」搭配不當", "D. 缺乏謂語"], 
        correctIndex: 1, 
        explanation: "表意不明（歧義）。連接詞「和」造成語意不清。可以理解為「他背著（總經理和副總經理）」，也可以理解為「他背著總經理，並和副總經理一起（把錢存入）」。" 
    },
    { 
        question: "修正：「能否取得好成績，取決於平時的努力。」", 
        options: ["A. 前半句是兩面詞『能否』，後半句是一面詞『努力』，前後邏輯失衡", "B. 「取得」不能搭配「好成績」", "C. 「取決於」使用錯誤，應改為「決定於」", "D. 缺乏主語"], 
        correctIndex: 0, 
        explanation: "兩面與一面搭配不當。前半句「能否」包含好與壞兩種可能，後半句「努力」只有一種單向條件，前後不對稱。應改為「能否取得好成績，取決於平時是否努力」。" 
    },
    { 
        question: "修正：「我們學校的規模正在不斷地改善和擴大。」", 
        options: ["A. 「不斷地」與「正在」語意重複", "B. 「擴大」不能用來形容「規模」", "C. 主語「規模」與謂語「改善」搭配不當", "D. 缺乏賓語"], 
        correctIndex: 2, 
        explanation: "主謂搭配不當。「規模」可以「擴大」，但不能「改善」。（改善通常搭配「環境」、「生活」等）。應改為「規模正在不斷擴大，環境正在不斷改善」。" 
    },
    { 
        question: "修正：「我們應該盡量避免不發生這類嚴重的交通事故。」", 
        options: ["A. 「盡量」與「避免」語意衝突", "B. 「避免」與「不發生」構成雙重否定，導致句意變成『盡量讓它發生』", "C. 句子缺乏主語", "D. 「嚴重」不能修飾「交通事故」"], 
        correctIndex: 1, 
        explanation: "否定不當 / 不合邏輯。「避免」已經含有「不要讓它發生」的意思，再加上「不」，負負得正，反而變成「要讓事故發生」。應刪除「不」。" 
    },
    { 
        question: "修正：「數學這門學科，對小明是非常感興趣的。」", 
        options: ["A. 「數學這門學科」分類錯誤", "B. 「非常」不能修飾「感興趣」", "C. 主客體顛倒，應改為「小明對數學這門學科是非常感興趣的」", "D. 句子缺乏謂語"], 
        correctIndex: 2, 
        explanation: "不合邏輯（主客顛倒）。人才是產生興趣的「主體」，學科是「客體」。不能說「學科對人感興趣」，而應該是「人對學科感興趣」。" 
    },
    { 
        question: "修正：「隨著社會的發展，人們的生活水平也在不斷地改善。」", 
        options: ["A. 濫用「隨著」，導致句子缺乏主語", "B. 「生活水平」與「改善」搭配不當，應改為「提高」", "C. 「不斷地」與「在」語意重複", "D. 句子缺乏賓語"], 
        correctIndex: 1, 
        explanation: "搭配不當。「生活水平」通常搭配「提高」；「改善」通常用來搭配「生活環境」或「生活條件」。" 
    },
    { 
        question: "修正：「為了響應環保，我們應當積極推行減少塑膠吸管的使用。」", 
        options: ["A. 「推行」缺少對應的賓語，應在句末加上『的政策』或『的活動』", "B. 「減少」與「使用」搭配不當", "C. 「積極」不能修飾「推行」", "D. 缺乏主語，不知道是誰在響應"], 
        correctIndex: 0, 
        explanation: "成分殘缺（賓語殘缺）。動詞「推行」的賓語不能是「使用」，應該是推行某種「政策」、「活動」或「措施」。" 
    },
    { 
        question: "修正：「局長、副局長和其他局領導出席了這次表彰會。」", 
        options: ["A. 「出席」不能搭配「表彰會」", "B. 「其他局領導」指代不明產生歧義，不知是『本局的其他領導』還是『別局的領導』", "C. 「和」字使用錯誤", "D. 缺乏謂語"], 
        correctIndex: 1, 
        explanation: "表意不明（歧義）。「其他局領導」的斷句不同會產生不同意思，應改為「局內的其他領導」或「其他局的領導」以消除歧義。" 
    },
    { 
        question: "修正：「這本暢銷小說的作者是出自一位退休教師之手。」", 
        options: ["A. 「作者」與「退休教師」搭配不當", "B. 缺乏主語", "C. 把『作者是...』與『出自...之手』兩種句式雜糅", "D. 「這本暢銷小說」不能作為主語"], 
        correctIndex: 2, 
        explanation: "句式雜糅。作者將兩種句型硬湊在一起，應修改為「這本書的作者是一位退休教師」或「這本書出自一位退休教師之手」。" 
    },
    { 
        question: "修正：「聽完這個笑話，他忍不住不禁笑了出來。」", 
        options: ["A. 缺乏主語", "B. 「聽完這個笑話」位置錯誤", "C. 「忍不住」與「不禁」語意重複贅餘", "D. 「笑了出來」時態錯誤"], 
        correctIndex: 2, 
        explanation: "語意重複 / 贅餘。「忍不住」和「不禁」意思相同，同時使用造成語意累贅，刪去其一即可。" 
    },
    { 
        question: "修正：「只要經常鍛鍊身體，才會擁有健康的體魄。」", 
        options: ["A. 「經常」不能修飾「鍛鍊」", "B. 關聯詞搭配不當，「只要」應搭配「就」，或把「只要」改為「只有」", "C. 「擁有」與「體魄」搭配不當", "D. 缺乏賓語"], 
        correctIndex: 1, 
        explanation: "關聯詞搭配不當。「只要...就...」表充分條件，「只有...才...」表必要條件，兩套關聯詞不能混搭。" 
    },
    { 
        question: "修正：「超市的貨架上擺滿了蘋果、香蕉、橘子、高麗菜等各種水果。」", 
        options: ["A. 「擺滿了」缺乏主語", "B. 「高麗菜」不屬於「水果」類別，分類不當，不合邏輯", "C. 「蘋果、香蕉、橘子」順序錯誤", "D. 「各種」與「水果」語意重複"], 
        correctIndex: 1, 
        explanation: "不合邏輯（分類不當）。高麗菜屬於蔬菜，不能被概括在「等各種水果」這個大類別之中。" 
    },
    { 
        question: "修正：「學生素質的高低，是提升學校整體升學率的保證。」", 
        options: ["A. 「素質」不能用「高低」形容", "B. 「提升」與「保證」搭配不當", "C. 前半句是兩面詞『高低』，後半句是一面詞『提升』，前後邏輯失衡", "D. 缺乏謂語"], 
        correctIndex: 2, 
        explanation: "兩面與一面搭配不當。「高低」包含兩面（高與低），但後半句「提升」只針對單一面。應改為「學生素質的提高，是提升學校...的保證」。" 
    },
    { 
        question: "修正：「許多附近的居民都跑來觀看這場罕見的流星雨。」", 
        options: ["A. 句子缺乏主語", "B. 多項定語語序不當，應改為『附近的許多居民』", "C. 「觀看」不能搭配「流星雨」", "D. 「罕見」不能修飾「流星雨」"], 
        correctIndex: 1, 
        explanation: "語序不當。「許多」是表數量的定語，「附近」是表處所的定語。依照中文語法習慣，表處所的定語應放在數量定語前面。" 
    },
    { 
        question: "修正：「為了避免不再發生類似的溺水事故，學校加強了安全教育。」", 
        options: ["A. 「避免」與「不再」構成雙重否定，導致句意變成『要讓事故發生』", "B. 「加強」與「安全教育」搭配不當", "C. 缺乏主語", "D. 「類似」與「事故」語意重複"], 
        correctIndex: 0, 
        explanation: "否定不當 / 不合邏輯。「避免」本身已經有否定的意思，加上「不再」，負負得正，反而變成了要讓溺水事故發生。應刪去「不」。" 
    },
    { 
        question: "修正：「我們必須努力提高和培養自己的專業寫作水平。」", 
        options: ["A. 「努力」不能修飾「提高」", "B. 謂語動詞與賓語搭配不當，「培養」不能搭配「水平」", "C. 「專業」與「寫作」語意衝突", "D. 缺乏主語"], 
        correctIndex: 1, 
        explanation: "動賓搭配不當。動詞「提高」可以搭配「水平」，但動詞「培養」不能搭配「水平」（培養通常配『能力』或『習慣』）。應改為「提高專業寫作水平，培養寫作能力」。" 
    },
    { 
        question: "修正：「這件精美的藝術品大約價值十萬元左右。」", 
        options: ["A. 缺乏主語", "B. 「大約」和「左右」語意重複贅餘，應刪去其一", "C. 「價值」與「十萬元」搭配不當", "D. 多項定語語序不當"], 
        correctIndex: 1, 
        explanation: "語意重複 / 贅餘。「大約」和「左右」都是表示估計的概數詞，兩者同時使用造成了語意上的重複與累贅。" 
    },
    { 
        question: "修正：「秋天的墾丁，是一個賞鳥的好季節。」", 
        options: ["A. 缺乏謂語", "B. 主語「墾丁」與賓語「季節」搭配不當，應改為「好去處」", "C. 「賞鳥」不合邏輯", "D. 主客體顛倒"], 
        correctIndex: 1, 
        explanation: "主賓搭配不當。「墾丁」是一個地方，不能和表示時間的「季節」搭配作賓語，應改為「是一個賞鳥的好去處」。" 
    },
    { 
        question: "修正：「看到大家熱烈參與，更加堅定了我們舉辦這項活動。」", 
        options: ["A. 「堅定」與「舉辦」語意矛盾", "B. 濫用「看到」導致無主語", "C. 句末缺乏賓語中心語，應加上『的決心』", "D. 「熱烈參與」修飾不當"], 
        correctIndex: 2, 
        explanation: "成分殘缺（缺賓語）。動詞「堅定」後面缺少對應的名詞賓語，不能只說「堅定了我們舉辦」，應補上「的決心」或「的信念」。" 
    },
    { 
        question: "修正：「為了防止這類傳染病不再蔓延，衛生局採取了嚴格的隔離措施。」", 
        options: ["A. 「防止」與「不再」構成雙重否定導致語意相反，應刪去「不」", "B. 缺乏主語", "C. 「蔓延」與「傳染病」搭配不當", "D. 句式雜糅"], 
        correctIndex: 0, 
        explanation: "否定不當 / 不合邏輯。「防止」本身帶有阻止發生的意思，加上「不再」會變成「負負得正」，句意反而變成「希望傳染病蔓延」。" 
    },
    { 
        question: "修正：「昨天我遇到兩個醫院的護理師，她們正在討論排班的問題。」", 
        options: ["A. 「遇到」與「護理師」動賓不配", "B. 「兩個」指代不明產生歧義，不知是『兩間醫院』還是『兩位護理師』", "C. 缺乏謂語", "D. 「討論」不能配「問題」"], 
        correctIndex: 1, 
        explanation: "表意不明（歧義）。數量詞「兩個」修飾的對象不明確，會讓讀者搞不清楚到底是醫院有兩間，還是護理師有兩位。" 
    },
    { 
        question: "修正：「我們能不能在這次比賽中獲勝，關鍵在於平時的刻苦訓練。」", 
        options: ["A. 前半句兩面詞『能不能』，後半句一面詞『訓練』，前後邏輯失衡", "B. 缺乏主語", "C. 「獲勝」與「比賽」語意重複", "D. 句式雜糅"], 
        correctIndex: 0, 
        explanation: "兩面與一面搭配不當。前半句包含了「能」與「不能」兩種可能性，後半句的「訓練」只有單一情況，應改為「關鍵在於平時有沒有刻苦訓練」。" 
    },
    { 
        question: "修正：「他之所以成績退步的原因，是因為他最近沉迷於網路遊戲所造成的。」", 
        options: ["A. 缺乏賓語", "B. 將『之所以...是因為...』與『...的原因是...造成的』多種句式雜糅", "C. 「沉迷」不能搭配「網路遊戲」", "D. 主客體顛倒"], 
        correctIndex: 1, 
        explanation: "句式雜糅。這句話把太多種表達因果關係的句型硬湊在一起，應簡化為「他成績退步的原因，是沉迷於網路遊戲」或「他之所以成績退步，是因為沉迷於網路遊戲」。" 
    },
    { 
        question: "修正：「他不僅會彈鋼琴，而且他的弟弟也會彈鋼琴。」", 
        options: ["A. 關聯詞位置錯誤，前後主語不同，關聯詞「不僅」應放在主語「他」的前面", "B. 「而且」不能搭配「不僅」", "C. 缺乏謂語", "D. 語意重複"], 
        correctIndex: 0, 
        explanation: "語序不當（關聯詞位置錯誤）。當兩個分句的「主語不同」（他是第一個主語，弟弟是第二個主語）時，關聯詞必須放在主語的前面，即「不僅他會彈鋼琴，而且他的弟弟也會」。" 
    },
    { 
        question: "修正：「水果攤上擺滿了蘋果、香蕉、葡萄和蔬菜等各種新鮮水果。」", 
        options: ["A. 缺乏主語", "B. 「蔬菜」不屬於「水果」類別，分類不當，不合邏輯", "C. 「擺滿了」與「水果」搭配不當", "D. 語序顛倒"], 
        correctIndex: 1, 
        explanation: "不合邏輯（分類不當）。蔬菜不屬於水果的範疇，不能把它和蘋果、香蕉並列在「等各種新鮮水果」的總結詞之內。" 
    },
    { 
        question: "修正：「我們應該發揚和繼承中華民族的優良傳統。」", 
        options: ["A. 「發揚」與「繼承」邏輯語序顛倒，應先「繼承」再「發揚」", "B. 「優良」不能修飾「傳統」", "C. 缺乏主語", "D. 句式雜糅"], 
        correctIndex: 0, 
        explanation: "語序不當（邏輯先後顛倒）。按照事理的邏輯順序，我們必須先「繼承」前人留下來的傳統，然後才能將其「發揚」光大。" 
    },
    { 
        question: "修正：「聽了校長的演講，使我受益匪淺。」", 
        options: ["A. 「演講」與「受益」搭配不當", "B. 濫用介詞「聽了」與使動詞「使」，導致缺乏主語", "C. 「受益匪淺」用詞不當", "D. 句子缺乏賓語"], 
        correctIndex: 1, 
        explanation: "成分殘缺（無主語）。前半句是動作狀語，後半句加上「使」，導致整句話找不到執行動作的主語。應刪除「使」或「聽了」。" 
    },
    { 
        question: "修正：「弟弟非常酷愛打籃球，每天下課都往球場跑。」", 
        options: ["A. 「非常」和「酷愛」語意重複贅餘", "B. 句子缺乏主語", "C. 「酷愛」不能搭配「打籃球」", "D. 句式雜糅"], 
        correctIndex: 0, 
        explanation: "語意重複 / 贅餘。「酷」本身就有「非常、極度」的意思，與前面的「非常」疊用造成了語意上的累贅。" 
    },
    { 
        question: "修正：「機器質量的好壞，是保證生產安全的一個重要條件。」", 
        options: ["A. 句子缺乏謂語", "B. 前半句兩面詞『好壞』，後半句一面詞『保證』，前後邏輯失衡", "C. 「質量」不能用「好壞」來修飾", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "兩面與一面搭配不當。前半句「好壞」包含兩面，但後半句只有單一結果。應改為「機器質量的好，是保證...的條件」或「機器質量的好壞，關係到生產是否安全」。" 
    },
    { 
        question: "修正：「警方這次能迅速破案，是靠了廣大市民的線索提供的。」", 
        options: ["A. 句子缺乏主語", "B. 將『是靠了...』與『是...提供的』兩種句式雜糅", "C. 「破案」與「線索」搭配不當", "D. 語序顛倒"], 
        correctIndex: 1, 
        explanation: "句式雜糅。作者將兩種句型硬湊在一起，應該改成「是靠了廣大市民提供的線索」或「是廣大市民提供線索的結果」。" 
    },
    { 
        question: "修正：「為了準備園遊會，班長佈置了許多工作和人力。」", 
        options: ["A. 謂語與賓語搭配不當，「佈置」可以配「工作」，但不能配「人力」", "B. 句子缺乏主語", "C. 「準備」不能搭配「園遊會」", "D. 構成雙重否定，語意錯誤"], 
        correctIndex: 0, 
        explanation: "動賓搭配不當。一個動詞「佈置」不能同時帶兩個不同屬性的賓語。應改為「佈置了許多工作，調配了許多人力」。" 
    },
    { 
        question: "修正：「他的這篇文章，基本上全部都是抄襲來的。」", 
        options: ["A. 「這篇」與「文章」搭配不當", "B. 「基本上」與「全部」自相矛盾，不合邏輯", "C. 句子缺乏主語", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "自相矛盾 / 不合邏輯。「基本上」代表大體上如此（可能有例外），而「全部」代表百分之百。兩詞放在一起產生了邏輯衝突。" 
    },
    { 
        question: "修正：「幾個電視台的記者昨天來學校採訪了校長。」", 
        options: ["A. 主語不明確", "B. 「幾個」指代不明產生歧義，不知是『幾家電視台』還是『幾位記者』", "C. 「採訪」與「校長」搭配不當", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "表意不明（歧義）。數量詞「幾個」位置不當，會讓人誤解到底是電視台有幾個，還是記者有幾位。應改為「電視台的幾位記者」以釐清句意。" 
    },
    { 
        question: "修正：「焦糖瑪奇朵這種飲料，對年輕人是很受歡迎的。」", 
        options: ["A. 句子缺乏主語", "B. 句子缺乏賓語", "C. 句式雜糅", "D. 主客體顛倒，應改為「年輕人對焦糖瑪奇朵這種飲料是很歡迎的」"], 
        correctIndex: 3, 
        explanation: "不合邏輯（主客顛倒）。人才是產生喜好情緒的「主體」，飲料是「客體」。不能說是飲料對年輕人受歡迎。" 
    },
    { 
        question: "修正：「博物館裡展出了一件兩千多年前的新出土的文物。」", 
        options: ["A. 多項定語語序不當，應改為『一件新出土的兩千多年前的文物』", "B. 「展出」不能搭配「文物」", "C. 句子缺乏主語", "D. 句式雜糅"], 
        correctIndex: 0, 
        explanation: "語序不當。多項定語排列時，通常表狀態或特徵的修飾語應放在表示時間的修飾語之前，讀起來才符合中文語感邏輯。" 
    },
    { 
        question: "修正：「為了避免不再發生食物中毒事件，學校餐廳進行了全面消毒。」", 
        options: ["A. 「全面」不能修飾「消毒」", "B. 「避免」與「不再」構成雙重否定，導致語意變成『希望發生』", "C. 句子缺乏主語", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "否定不當 / 不合邏輯。「避免」本身已經有否定的意思，加上「不再」，負負得正，反而變成了要讓事故發生。應刪除「不」。" 
    },
    { 
        question: "修正：「他目前的當務之急是趕快把病治好。」", 
        options: ["A. 句子缺乏主語", "B. 「目前」和「當務之急」語意重複贅餘，應刪除「目前的」", "C. 「趕快」與「治好」搭配不當", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "語意重複 / 贅餘。「當務之急」的「當」就是「當前、目前」的意思，加上「目前」造成了語意上的累贅。" 
    },
    { 
        question: "修正：「在學習中，我們應該注意培養自己觀察問題、解決問題和分析問題的能力。」", 
        options: ["A. 「培養」不能搭配「能力」", "B. 「注意」和「培養」語意衝突", "C. 「觀察」、「解決」、「分析」的邏輯語序顛倒，應改為『觀察問題、分析問題和解決問題』", "D. 句子缺乏賓語"], 
        correctIndex: 2, 
        explanation: "邏輯不合（語序不當）。依照人類認識事物的邏輯，應該是先「觀察」，接著「分析」，最後才能「解決」，順序不能顛倒。" 
    },
    { 
        question: "修正：「一個人學習成績的好壞，取決於他平時的認真努力。」", 
        options: ["A. 缺乏謂語動詞", "B. 前半句是兩面詞『好壞』，後半句是一面詞『認真努力』，前後邏輯失衡", "C. 「取決於」使用不當", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "兩面與一面搭配不當。前半句「好壞」包含兩種可能，後半句「努力」只有一種情況，應改為「學習成績的好壞，取決於他平時是否認真努力」。" 
    },
    { 
        question: "修正：「這件慘劇的發生，是由於司機酒駕而引起的。」", 
        options: ["A. 「慘劇」與「發生」搭配不當", "B. 句子缺乏主語", "C. 「司機」指代不明", "D. 將『是由於...』與『是...引起的』兩種句式雜糅"], 
        correctIndex: 3, 
        explanation: "句式雜糅。作者將兩種表達原因的句型硬湊在一起，應簡化為「是由於司機酒駕」或「是司機酒駕而引起的」。" 
    },
    { 
        question: "修正：「桌子上放著許多朋友送來的生日禮物。」", 
        options: ["A. 缺乏謂語", "B. 「許多」指代不明產生歧義，不知是『許多位朋友』還是『許多份禮物』", "C. 「放著」與「桌子上」語序顛倒", "D. 主客體顛倒"], 
        correctIndex: 1, 
        explanation: "表意不明（歧義）。數量詞「許多」位置不當，會讓人誤解到底是朋友很多個，還是送來的禮物很多份。應改為「許多份朋友送來的...」或「許多位朋友送來的...」。" 
    },
    { 
        question: "修正：「我們不能不否認，環保是當前最重要的全球議題。」", 
        options: ["A. 「不能不否認」構成多重否定，導致句意變成『必須否認環保重要』，違反常理", "B. 「當前」與「最重要」語意重複", "C. 缺乏主語", "D. 句式雜糅"], 
        correctIndex: 0, 
        explanation: "否定不當 / 不合邏輯。「不能不」是雙重否定表肯定（必須），加上「否認」，等於「必須否認（不認同）」，與原意完全相反。應改為「我們不能否認」或「我們必須承認」。" 
    },
    { 
        question: "修正：「小時候，報紙與我接觸的機會是很少的。」", 
        options: ["A. 「接觸」與「機會」搭配不當", "B. 「小時候」時間副詞位置錯誤", "C. 主客體顛倒，人才是主體，應改為『我與報紙接觸的機會是很少的』", "D. 缺乏賓語"], 
        correctIndex: 2, 
        explanation: "不合邏輯（主客顛倒）。人才是產生動作的「主體」，報紙是「客體」。不能說是報紙主動來接觸我，而是我接觸報紙。" 
    },
    { 
        question: "修正：「從這件平凡的小事中，說明了一個深刻的人生道理。」", 
        options: ["A. 「說明」不能搭配「道理」", "B. 「平凡」與「小事」語意重複", "C. 句式雜糅", "D. 濫用介詞「從...中」，導致句子缺乏主語"], 
        correctIndex: 3, 
        explanation: "成分殘缺（無主語）。「從...中」構成了介詞片語作狀語，導致動詞「說明」找不到真正的主語。應刪除「從」和「中」，改為「這件平凡的小事，說明了...」。" 
    },
    { 
        question: "修正：「出門前，他在背包裡準備了餅乾、麵包、礦泉水等食物。」", 
        options: ["A. 缺乏主語", "B. 「礦泉水」不屬於「食物」類別，分類不當，不合邏輯", "C. 「餅乾、麵包、礦泉水」順序錯誤", "D. 「背包裡」不能作為狀語"], 
        correctIndex: 1, 
        explanation: "不合邏輯（分類不當）。礦泉水屬於「飲料」，不能被概括在「等食物」這個類別之中。應改為「等食物和飲料」。" 
    },
    { 
        question: "修正：「小明不僅知道這件事，而且全班同學也都已經知道了。」", 
        options: ["A. 「不僅」與「而且」搭配不當", "B. 句子缺乏賓語", "C. 關聯詞位置錯誤，前後分句主語不同，關聯詞「不僅」應放在主語「小明」的前面", "D. 語意重複"], 
        correctIndex: 2, 
        explanation: "語序不當（關聯詞位置錯誤）。當兩個分句的主語「不同」（小明 vs 全班同學）時，關聯詞必須放在主語的前面，即「不僅小明知道這件事，而且全班...」。" 
    },
    { 
        question: "修正：「聽完這個悲慘的故事，他忍不住不禁流下了眼淚。」", 
        options: ["A. 缺乏主語", "B. 「忍不住」和「不禁」語意重複贅餘", "C. 「流下了」與「眼淚」搭配不當", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "語意重複 / 贅餘。「忍不住」與「不禁」意思相同，兩者疊用造成語意累贅，保留一個即可。" 
    },
    { 
        question: "修正：「我們必須努力解決並隨時發現工作中的潛在危險。」", 
        options: ["A. 「努力」不能修飾「解決」", "B. 「危險」不能被「發現」", "C. 「解決」與「發現」邏輯語序顛倒，應先發現才能解決", "D. 句子缺乏主語"], 
        correctIndex: 2, 
        explanation: "語序不當（邏輯先後顛倒）。按照事理邏輯，必須先「發現」潛在的危險，然後才能針對危險去「解決」它。" 
    },
    { 
        question: "修正：「由於這場突如其來的暴風雪，使救援直升機無法按時起飛。」", 
        options: ["A. 「暴風雪」與「突如其來」搭配不當", "B. 缺乏賓語", "C. 濫用介詞「由於」與使動詞「使」，導致句子缺乏主語", "D. 句式雜糅"], 
        correctIndex: 2, 
        explanation: "成分殘缺（無主語）。「由於...」構成了介詞片語作狀語，加上「使...」後整句話找不到執行動作的主語。應刪除「由於」或「使」。" 
    },
    { 
        question: "修正：「能否具備良好的心理素質，是運動員在奧運會上奪金的重要條件。」", 
        options: ["A. 前半句是兩面詞『能否』，後半句是一面詞『奪金』，前後邏輯失衡", "B. 「具備」不能搭配「心理素質」", "C. 「重要」不能修飾「條件」", "D. 句子缺乏謂語"], 
        correctIndex: 0, 
        explanation: "兩面與一面搭配不當。「能否」包含具備和不具備兩面，而後半句「奪金」只有肯定的一面。應改為「能否奪金」或刪除「能否」。" 
    },
    { 
        question: "修正：「這起嚴重火災事故的原因，是因為老舊電線走火所造成的。」", 
        options: ["A. 「原因」與「事故」語意重複", "B. 缺乏主語", "C. 「火災」不能與「嚴重」搭配", "D. 將『原因是因為...』與『是由於...造成的』兩種句式雜糅"], 
        correctIndex: 3, 
        explanation: "句式雜糅。作者將兩種表達原因的句型硬湊在一起，應修改為「火災事故的原因是電線走火」或「火災事故是由於電線走火造成的」。" 
    },
    { 
        question: "修正：「在樹林裡，我發現敵人的哨兵正在偷偷抽菸。」", 
        options: ["A. 缺乏主語", "B. 「發現」與「哨兵」動賓不配", "C. 「敵人的哨兵」指代不明產生歧義，不知是『發現敵人』的哨兵，還是『屬於敵人』的哨兵", "D. 「偷偷」不能修飾「抽菸」"], 
        correctIndex: 2, 
        explanation: "表意不明（歧義）。「發現敵人的哨兵」有兩種解讀：一是「我方的哨兵發現了敵人」，二是「我發現了敵方的哨兵」。" 
    },
    { 
        question: "修正：「古典音樂這門藝術，對許多年輕人是不太感興趣的。」", 
        options: ["A. 「古典音樂」分類錯誤", "B. 主客體顛倒，應改為『許多年輕人對古典音樂這門藝術是不太感興趣的』", "C. 「感興趣」缺乏賓語", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "不合邏輯（主客顛倒）。人才是產生興趣的「主體」，音樂是「客體」。不能說是音樂對人感興趣。" 
    },
    { 
        question: "修正：「為了防止詐騙案件不再發生，警方加強了社區防詐宣導。」", 
        options: ["A. 「防止」與「不再發生」雙重否定導致句意變成『希望發生』", "B. 句子缺乏主語", "C. 「加強」與「宣導」搭配不當", "D. 句式雜糅"], 
        correctIndex: 0, 
        explanation: "否定不當 / 不合邏輯。「防止」已經有阻止的意思，加上「不再」，負負得正，意思反而變成了要讓詐騙案件發生。應刪除「不」。" 
    },
    { 
        question: "修正：「中秋節連假，遊樂園裡到處都是老人、小孩和遊客。」", 
        options: ["A. 缺乏謂語", "B. 「到處都是」與「遊客」搭配不當", "C. 「老人、小孩」與「遊客」概念有包含關係，分類不當，不合邏輯", "D. 語序顛倒"], 
        correctIndex: 2, 
        explanation: "不合邏輯（分類不當）。「老人」和「小孩」來到遊樂園本身就是「遊客」的一部分，兩者存在包含關係，不能放在一起並列。" 
    },
    { 
        question: "修正：「那位老師是一位有著二十多年教學經驗的優秀的國文科的。」", 
        options: ["A. 句尾成分殘缺，缺乏賓語中心語，應補上「老師」", "B. 定語語序不當", "C. 主語不明確", "D. 「二十多年」與「經驗」搭配不當"], 
        correctIndex: 0, 
        explanation: "成分殘缺（缺賓語）。句子的主幹是「那位老師是...」，但是「是」後面的賓語中心詞缺失了，應在句尾補上名詞「老師」。" 
    },
     { 
        question: "修正：「同學們在迎新晚會上互相彼此交流著各自的家鄉文化。」", 
        options: ["A. 「互相」和「彼此」語意重複贅餘", "B. 「交流」與「文化」搭配不當", "C. 缺乏主語", "D. 語序不當"], 
        correctIndex: 0, 
        explanation: "語意重複 / 贅餘。「互相」和「彼此」意思完全相同，疊用造成語意累贅，應刪除其中一個。" 
    },
    { 
        question: "修正：「經過一學期的努力，小明的學習態度和成績都有了顯著的提高。」", 
        options: ["A. 「顯著」不能修飾「提高」", "B. 「學習態度」不能與「提高」搭配，主謂不配", "C. 缺乏謂語", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "主謂搭配不當。「成績」可以「提高」，但「學習態度」只能「端正」或「改善」，不能用「提高」來形容。" 
    },
    { 
        question: "修正：「在這部感人的紀錄片中，講述了野生動物在極端環境下求生的故事。」", 
        options: ["A. 「講述」與「故事」搭配不當", "B. 濫用介詞結構「在...中」，導致句子缺乏主語", "C. 「極端」不能修飾「環境」", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "成分殘缺（無主語）。「在...中」把「紀錄片」變成了狀語，使得動詞「講述」沒有了執行動作的主語。應刪除「在」和「中」。" 
    },
    { 
        question: "修正：「這場大規模停電之所以發生，主要是因為設備老化而造成的。」", 
        options: ["A. 將『是因為...』與『是...造成的』兩種句式雜糅", "B. 「大規模」與「停電」搭配不當", "C. 缺乏賓語", "D. 語序顛倒"], 
        correctIndex: 0, 
        explanation: "句式雜糅。作者把「主要是因為設備老化」與「主要是由設備老化造成的」兩種句型混在一起使用。應刪去「因為」或「造成的」。" 
    },
    { 
        question: "修正：「難道你能否認這件善行不是他默默在背後做的嗎？」", 
        options: ["A. 「默默」與「在背後」語意重複", "B. 「難道...嗎」加上「否認」與「不是」構成三重否定，導致語意變成『這不是他做的』", "C. 缺乏主語", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "否定不當 / 不合邏輯。「難道...嗎」是反問語氣（表否定），加上「否認」與「不是」，變成了三重否定，句意反轉成了「這不是他做的」。應刪除「不」。" 
    },
    { 
        question: "修正：「政府是否重視基礎建設，是提升國家經濟競爭力的先決條件。」", 
        options: ["A. 「重視」不能搭配「基礎建設」", "B. 前半句是兩面詞『是否』，後半句是一面詞『提升』，前後邏輯失衡", "C. 「先決條件」用詞不當", "D. 缺乏主語"], 
        correctIndex: 1, 
        explanation: "兩面與一面搭配不當。「是否」包含重視與不重視兩面情況，但後半句「提升」只有肯定的一面。應改為「政府是否重視...是能否提升...的條件」。" 
    },
    { 
        question: "修正：「他昨天在公園裡發現了弟弟和妹妹的同學正在一起打籃球。」", 
        options: ["A. 「發現」不能配「打籃球」", "B. 「弟弟和妹妹的同學」指代不明產生歧義，不知是『兩人的同學』還是『弟弟本人及妹妹的同學』", "C. 缺乏謂語", "D. 語序顛倒"], 
        correctIndex: 1, 
        explanation: "表意不明（歧義）。連接詞「和」造成斷句困難。可以理解為「(弟弟和妹妹)的同學」，也可以理解為「(弟弟) 與 (妹妹的同學)」。" 
    },
    { 
        question: "修正：「這項具有劃時代意義的科技發明，不僅影響了全世界，也影響了我們這個小鎮。」", 
        options: ["A. 「劃時代」不能修飾「發明」", "B. 句子缺乏主語", "C. 「不僅...也...」表遞進，範圍應由小到大，語序應改為『不僅影響了小鎮，也影響了全世界』", "D. 句式雜糅"], 
        correctIndex: 2, 
        explanation: "不合邏輯（語序顛倒，遞進關係錯誤）。「不僅...也...」的句型應該從程度淺到深、範圍小到大。應先說「小鎮」，再說「全世界」。" 
    },
    { 
        question: "修正：「莎士比亞的許多經典文學作品，對我們這些熱愛閱讀的人是很熟悉的。」", 
        options: ["A. 「經典」與「文學」語意重複", "B. 缺乏謂語", "C. 主客體顛倒，人是認知主體，應改為『我們對莎士比亞的作品是很熟悉的』", "D. 句式雜糅"], 
        correctIndex: 2, 
        explanation: "不合邏輯（主客顛倒）。人是產生認知的主體，作品是被認知的客體。不能說「作品對人熟悉」，應是「人對作品熟悉」。" 
    },
    { 
        question: "修正：「這家書店的書架上擺滿了各類文學書、歷史書、哲學書和圖書。」", 
        options: ["A. 「擺滿了」缺乏主語", "B. 「圖書」包含了前三者，大概念與小概念不能並列，分類不當", "C. 語序顛倒", "D. 「各類」與「圖書」語意重複"], 
        correctIndex: 1, 
        explanation: "不合邏輯（分類不當）。「圖書」是一個大類概念，已經包含了前面的文學書、歷史書和哲學書，兩者不能放在一起並列。應刪除「和圖書」或改為「等各類圖書」。" 
    },
    { 
        question: "修正：「由於教練的嚴格指導，使我們球隊在決賽中獲得了總冠軍。」", 
        options: ["A. 「由於」與「使」濫用，導致句子缺乏主語", "B. 「嚴格指導」不能搭配", "C. 「獲得」與「總冠軍」搭配不當", "D. 缺乏賓語"], 
        correctIndex: 0, 
        explanation: "成分殘缺（無主語）。「由於...」作為介詞片語當狀語，後面又接「使...」，造成整句話沒有執行「獲得」這個動作的主語。應刪除「由於」或「使」。" 
    },
    { 
        question: "修正：「看到這部電影的悲慘結局，我們的心情十分非常激動。」", 
        options: ["A. 「悲慘」不能修飾「結局」", "B. 「十分」和「非常」語意重複贅餘", "C. 缺乏主語", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "語意重複 / 贅餘。「十分」和「非常」都是表示程度深的副詞，疊用會造成語意累贅，應刪除其中一個。" 
    },
    { 
        question: "修正：「閱讀經典文學名著，我們不僅能學到高超的寫作技巧，還能認識古代的社會歷史。」", 
        options: ["A. 缺乏主語", "B. 「認識」與「歷史」搭配不當", "C. 遞進關係的語序顛倒，應改為『不僅能認識古代的社會歷史，還能學到高超的寫作技巧』", "D. 句式雜糅"], 
        correctIndex: 2, 
        explanation: "不合邏輯（遞進語序顛倒）。「不僅...還...」表遞進關係，認知上應從廣泛/基礎的「認識歷史」，推進到具體/高階的「學到技巧」。" 
    },
    { 
        question: "修正：「有沒有健康的身體，是我們完成這項艱鉅任務的關鍵條件。」", 
        options: ["A. 「有沒有」是兩面詞，「完成」是一面詞，前後邏輯失衡", "B. 「艱鉅」不能修飾「任務」", "C. 缺乏謂語", "D. 句式雜糅"], 
        correctIndex: 0, 
        explanation: "兩面與一面搭配不當。前半句「有沒有」包含正反兩面，後半句「完成」只有肯定的一面。應改為「是我們能否完成...」以對應兩面邏輯。" 
    },
    { 
        question: "修正：「局長在會議上囑咐幾個學校的領導，務必要重視學生的校園安全。」", 
        options: ["A. 「囑咐」與「領導」搭配不當", "B. 「幾個學校的領導」指代不明產生歧義", "C. 缺乏賓語", "D. 「務必」與「要」語意重複"], 
        correctIndex: 1, 
        explanation: "表意不明（歧義）。數量詞「幾個」位置不當，會讓人誤解到底是「幾所學校」的領導，還是某一所學校的「幾位領導」。" 
    },
    { 
        question: "修正：「為了避免強烈地震發生時不再造成嚴重傷亡，政府大力推廣了防震建築。」", 
        options: ["A. 「推廣」與「防震建築」搭配不當", "B. 「強烈」不能修飾「地震」", "C. 「避免」與「不再」構成雙重否定，導致句意變成『希望造成傷亡』", "D. 缺乏主語"], 
        correctIndex: 2, 
        explanation: "否定不當 / 不合邏輯。「避免」已經含有「不要讓其發生」的意思，加上「不再」，負負得正，反而變成要讓傷亡發生。應刪除「不」。" 
    },
    { 
        question: "修正：「這家大型量販店販售各種文具、文具盒、筆記本與辦公用品。」", 
        options: ["A. 缺乏主語", "B. 語序顛倒", "C. 句式雜糅", "D. 「文具」是大概念，包含了文具盒與筆記本，大小概念並列導致分類不當"], 
        correctIndex: 3, 
        explanation: "不合邏輯（分類不當）。「文具盒」和「筆記本」本來就屬於「文具」的一種，不能與大概念的「文具」並列。" 
    },
    { 
        question: "修正：「這個地區之所以常發生土石流的原因，是因為過度開發山林所造成的。」", 
        options: ["A. 「常發生」與「土石流」搭配不當", "B. 把『之所以...是因為...』與『...的原因，是...造成的』多種句式雜糅", "C. 缺乏主語", "D. 「過度」與「開發」語意重複"], 
        correctIndex: 1, 
        explanation: "句式雜糅。作者將太多表達因果關係的句型混在一起，造成結構混亂。應簡化為「之所以常發生土石流，是因為過度開發山林」。" 
    },
    { 
        question: "修正：「展覽館裡展出了一件兩千多年前的剛出土的精美陶器。」", 
        options: ["A. 多項定語語序不當，應改為『一件剛出土的兩千多年前的精美陶器』", "B. 句子缺乏主語", "C. 「展出」不能搭配「陶器」", "D. 句式雜糅"], 
        correctIndex: 0, 
        explanation: "語序不當。在多項定語中，表示時間/狀態的修飾語（剛出土的）通常要放在表示具體時間/年代（兩千多年前的）之前，語氣才順暢。" 
    },
    { 
        question: "修正：「這本介紹台灣歷史的暢銷書籍，對小明是非常感興趣的。」", 
        options: ["A. 缺乏賓語", "B. 「暢銷」不能修飾「書籍」", "C. 句式雜糅", "D. 主客體顛倒，應改為『小明對這本介紹台灣歷史的暢銷書籍是非常感興趣的』"], 
        correctIndex: 3, 
        explanation: "不合邏輯（主客顛倒）。人（小明）是產生興趣的主體，書籍是被產生興趣的客體。不能把物當作主體說「書對人感興趣」。" 
    },
    { 
        question: "修正：「他非常渴望希望能盡快回到學校，和同學們一起上課。」", 
        options: ["A. 句子缺乏主語", "B. 「渴望」和「希望」語意重複贅餘，應刪除其中一個", "C. 「盡快」不能修飾「回到」", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "語意重複 / 贅餘。「渴望」本身就包含了強烈「希望」的意思，兩詞疊用造成語意累贅。" 
    },
    { 
        question: "修正：「我們必須認真改善和提高自己的知識水平，才能適應未來社會的發展。」", 
        options: ["A. 動詞與賓語搭配不當，「改善」不能搭配「知識水平」", "B. 「認真」不能修飾「改善」", "C. 缺乏主語", "D. 「適應」與「發展」語意衝突"], 
        correctIndex: 0, 
        explanation: "動賓搭配不當。「提高」可以搭配「水平」，但「改善」通常用來搭配「生活」、「環境」或「關係」，不能搭配「水平」。" 
    },
    { 
        question: "修正：「隨著科技的飛速發展，使人類的生活方式發生了巨大的變化。」", 
        options: ["A. 「飛速發展」不能修飾「科技」", "B. 句式雜糅", "C. 濫用介詞「隨著」與使動詞「使」，導致句子缺乏主語", "D. 「發生」與「變化」搭配不當"], 
        correctIndex: 2, 
        explanation: "成分殘缺（無主語）。「隨著...」作為介詞片語當狀語，後面又接「使...」，導致整句話找不到主語。應刪除「隨著」或刪除「使」。" 
    },
    { 
        question: "修正：「為了防止不再發生這類嚴重的交通事故，警方決定加強路檢力度。」", 
        options: ["A. 「加強」與「力度」搭配不當", "B. 「防止」與「不再」構成雙重否定，導致句意變成『希望事故發生』，違反常理", "C. 缺乏主語", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "否定不當 / 不合邏輯。「防止」已經有阻止的意思，加上「不再」，負負得正，意思反而變成了要讓交通事故繼續發生。應刪除「不」。" 
    },
    { 
        question: "修正：「我昨天在研討會上，遇到了三個學校的老師。」", 
        options: ["A. 缺乏賓語", "B. 「遇到」不能搭配「老師」", "C. 句式雜糅", "D. 「三個學校的老師」指代不明產生歧義，不知是『三所學校』還是『三位老師』"], 
        correctIndex: 3, 
        explanation: "表意不明（歧義）。數量詞「三個」位置不當，會讓人誤解到底是「三所學校」的老師，還是同一所學校的「三位老師」。" 
    },
    { 
        question: "修正：「這次森林大火的發生，是由於極端乾旱的天氣造成的。」", 
        options: ["A. 「大火」與「發生」搭配不當", "B. 缺乏主語", "C. 將『是由於...引起的』與『是...造成的』兩種句式雜糅", "D. 語序顛倒"], 
        correctIndex: 2, 
        explanation: "句式雜糅。作者將兩種表達原因的句型硬湊在一起，應簡化為「是由於極端乾旱的天氣」或「是極端乾旱的天氣造成的」。" 
    },
    { 
        question: "修正：「能否養成良好的作息習慣，是提高學習效率的保證。」", 
        options: ["A. 前半句是兩面詞『能否』，後半句是一面詞『提高』，前後邏輯失衡", "B. 「養成」不能搭配「習慣」", "C. 缺乏主語", "D. 句式雜糅"], 
        correctIndex: 0, 
        explanation: "兩面與一面搭配不當。「能否」包含好與壞兩面情況，但後半句「提高...保證」只有單一肯定的情況，前後不對稱。應刪除「能否」。" 
    },
    { 
        question: "修正：「傳統市場裡擺滿了豬肉、牛肉、雞肉和肉類等新鮮食材。」", 
        options: ["A. 缺乏主語", "B. 「新鮮」不能修飾「食材」", "C. 「肉類」是大概念，包含了前三者，大概念與小概念不能並列，分類不當", "D. 語序顛倒"], 
        correctIndex: 2, 
        explanation: "不合邏輯（分類不當）。「肉類」是一個大類別，已經包含了豬肉、牛肉、雞肉，不能把它們放在一起並列。應刪除「和肉類」。" 
    },
    { 
        question: "修正：「這部剛上映的賣座電影，對我們年輕人是不陌生的。」", 
        options: ["A. 缺乏謂語", "B. 主客體顛倒，人才是主體，應改為『我們年輕人對這部剛上映的賣座電影是不陌生的』", "C. 「賣座」不能修飾「電影」", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "不合邏輯（主客顛倒）。人是產生認知的主體，電影是客體。不能說電影主動對人「不陌生」，應該是人對電影「不陌生」。" 
    },
    { 
        question: "修正：「她穿著一件昨天剛買的漂亮的法國進口的純棉洋裝。」", 
        options: ["A. 「穿著」不能搭配「洋裝」", "B. 缺乏主語", "C. 句式雜糅", "D. 多項定語語序不當，應改為『一件昨天剛買的法國進口的漂亮純棉洋裝』"], 
        correctIndex: 3, 
        explanation: "語序不當。多個修飾語排列時，依照中文語感應為：數量(一件) + 時間(昨天剛買) + 處所(法國進口) + 特徵(漂亮) + 質料(純棉) + 名詞(洋裝)。" 
    },
     { 
        question: "修正：「他大約估計這項浩大的工程需要花費半年左右的時間。」", 
        options: ["A. 「大約」和「左右」語意重複贅餘，應刪除其中之一", "B. 「估計」與「工程」搭配不當", "C. 缺乏主語", "D. 句式雜糅"], 
        correctIndex: 0, 
        explanation: "語意重複 / 贅餘。「大約」和「左右」都是表示估計與概數的副詞，兩者疊用會造成語意累贅。" 
    },
    { 
        question: "修正：「這次連環交通事故的原因，是由於駕駛員疲勞駕駛所造成的。」", 
        options: ["A. 缺乏賓語", "B. 將『原因，是...』與『是由於...造成的』兩種句式雜糅", "C. 主客顛倒", "D. 「事故」與「發生」搭配不當"], 
        correctIndex: 1, 
        explanation: "句式雜糅。作者把兩種解釋原因的句型硬湊在一塊，應簡化為「原因是駕駛員疲勞駕駛」或「是由於駕駛員疲勞駕駛造成的」。" 
    },
    { 
        question: "修正：「透過這次的社會服務活動，使我們深刻體會到了助人的快樂。」", 
        options: ["A. 「體會」與「快樂」搭配不當", "B. 語序顛倒", "C. 濫用介詞「透過」與使動詞「使」，導致句子缺乏主語", "D. 語意重複"], 
        correctIndex: 2, 
        explanation: "成分殘缺（無主語）。「透過...」形成了介詞片語當狀語，後面又接「使...」，導致整句話找不到執行「體會」的主語。應刪除「透過」或刪除「使」。" 
    },
    { 
        question: "修正：「誰也不能否認成功不是靠著汗水和不懈的努力換來的。」", 
        options: ["A. 構成三重否定，導致句意變成『成功不是靠努力換來的』，違反常理", "B. 缺乏主語", "C. 關聯詞誤用", "D. 「汗水」與「努力」不能並列"], 
        correctIndex: 0, 
        explanation: "否定不當 / 不合邏輯。「不能否認」本身是雙重否定表肯定，後面又加了一個「不是」，變成了三重否定，讓句意完全顛倒了事實。應刪除「不是」。" 
    },
    { 
        question: "修正：「產品品質的好壞，決定了企業能否在市場上立足。」", 
        options: ["A. 主謂不配", "B. 本句沒有語病", "C. 缺乏賓語", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "無語病。前半句「好壞」是兩面詞，後半句「能否」也是兩面詞，前後邏輯完美對應失衡。（這是一題反向測試題，若要出有語病的版本，後半句會少掉「能否」）。\n(註：此題若需必定有錯的版本，可將題目改為「產品品質的好壞，決定了企業能在市場上立足」，則答案為「兩面與一面失衡」。我們以此邏輯修改下題選項。)" 
    },
    { 
        question: "修正：「員工工作態度的積極與否，決定了公司未來的發展。」", 
        options: ["A. 缺乏賓語", "B. 前半句『積極與否』是兩面詞，後半句『發展』是一面詞，前後邏輯失衡", "C. 「決定」不能搭配「發展」", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "兩面與一面搭配不當。「積極與否」包含好與壞兩面，但後半句只有單一情況。應改為「決定了公司未來的發展好壞」。" 
    },
    { 
        question: "修正：「網路暴力這項嚴重的社會議題，對我們是絕對不能容忍的。」", 
        options: ["A. 語意重複", "B. 缺乏謂語", "C. 主客體顛倒，人是認知主體，應改為『我們對網路暴力這項嚴重的社會議題，是絕對不能容忍的』", "D. 搭配不當"], 
        correctIndex: 2, 
        explanation: "不合邏輯（主客顛倒）。人才是產生「容忍」情緒的主體，議題是客體。不能把事物當作主體去容忍人。" 
    },
    { 
        question: "修正：「昨天下午，我看到了三個醫院的醫生在會議室裡討論病情。」", 
        options: ["A. 缺乏主語", "B. 「三個醫院的醫生」指代不明產生歧義，不知是『三間醫院』還是『三位醫生』", "C. 搭配不當", "D. 語意重複"], 
        correctIndex: 1, 
        explanation: "表意不明（歧義）。數量詞「三個」位置不當，會讓人誤解到底是醫院有三所，還是醫生有三位。應改為「醫院的三位醫生」來釐清。" 
    },
    { 
        question: "修正：「圖書館新進了一批中國文學、外國文學、古典詩詞等文學作品。」", 
        options: ["A. 分類不當，「古典詩詞」包含在「中國文學」之內，大概念與小概念不能並列", "B. 缺乏主語", "C. 句式雜糅", "D. 語序顛倒"], 
        correctIndex: 0, 
        explanation: "不合邏輯（分類不當）。「古典詩詞」本來就屬於「中國文學」的一部分，兩者存在包含關係，不能放在一起並列。" 
    },
    { 
        question: "修正：「不但哥哥順利考上了理想的大學，而且在校的各項成績也非常優異。」", 
        options: ["A. 缺乏主語", "B. 關聯詞位置錯誤，前後分句主語相同（哥哥），主語應放在「不但」之前", "C. 搭配不當", "D. 語意重複"], 
        correctIndex: 1, 
        explanation: "語序不當（關聯詞位置錯誤）。當兩個分句的主語相同時（都是講哥哥），主語必須放在第一個關聯詞（不但）的前面，即「哥哥不但...而且...」。" 
    },
     { 
        question: "修正：「我們必須養成隨時發現並努力改正工作中的缺點。」", 
        options: ["A. 「發現」與「改正」語序顛倒", "B. 「養成」缺乏對應的名詞賓語，應在句末加上『的習慣』", "C. 「努力」不能修飾「改正」", "D. 缺乏主語"], 
        correctIndex: 1, 
        explanation: "成分殘缺（缺賓語）。動詞「養成」後面必須接名詞作為賓語，例如「養成...的習慣」或「養成...的態度」，不能直接把「缺點」當作養成的受詞。" 
    },
    { 
        question: "修正：「他非常酷愛這項充滿挑戰的戶外極限運動。」", 
        options: ["A. 「非常」和「酷愛」語意重複贅餘，應刪除「非常」", "B. 「充滿」不能搭配「挑戰」", "C. 「極限」與「運動」分類不當", "D. 缺乏主語"], 
        correctIndex: 0, 
        explanation: "語意重複 / 贅餘。「酷愛」的「酷」本身就帶有「非常、極度」的意思，前面再加「非常」會造成語意累贅。" 
    },
    { 
        question: "修正：「他那宏亮的聲音和期待的眼神，不斷在我的腦海中浮現。」", 
        options: ["A. 主客體顛倒", "B. 句子缺乏謂語", "C. 主謂搭配不當，「聲音」不能用「浮現」來修飾，應改為『聲音在耳邊迴盪，眼神在腦海中浮現』", "D. 句式雜糅"], 
        correctIndex: 2, 
        explanation: "主謂搭配不當。「眼神」可以「在腦海中浮現」，但是「聲音」只能「在耳邊迴盪」，共用同一個謂語動詞會造成搭配不當。" 
    },
    { 
        question: "修正：「為了避免不再發生類似的火災，工廠全面更換了老舊電線。」", 
        options: ["A. 「避免」與「不再」構成雙重否定，導致句意變成『希望火災發生』", "B. 「更換」與「電線」搭配不當", "C. 「全面」不能修飾「更換」", "D. 缺乏主語"], 
        correctIndex: 0, 
        explanation: "否定不當 / 不合邏輯。「避免」本身已有阻止的負面涵義，加上「不再」，負負得正，反而變成「要讓火災繼續發生」。應刪除「不」。" 
    },
    { 
        question: "修正：「這本暢銷書的作者，是出自一位年輕的網路作家之手。」", 
        options: ["A. 「年輕」與「網路作家」搭配不當", "B. 將『作者是...』與『是出自...之手』兩種句式雜糅", "C. 缺乏主語", "D. 語意重複"], 
        correctIndex: 1, 
        explanation: "句式雜糅。作者將兩種表達來源的句型硬湊在一起，應簡化為「這本書的作者是一位年輕的網路作家」或「這本書出自一位年輕的網路作家之手」。" 
    },
    { 
        question: "修正：「智慧型手機這項劃時代的發明，對現代人是不可或缺的。」", 
        options: ["A. 「劃時代」不能修飾「發明」", "B. 缺乏賓語", "C. 句式雜糅", "D. 主客體顛倒，應改為『現代人對智慧型手機這項劃時代的發明是不可或缺的』"], 
        correctIndex: 3, 
        explanation: "不合邏輯（主客顛倒）。人才是產生需求與依賴的「主體」，手機是被需求的「客體」。不能把客體當作主體來說。" 
    },
    { 
        question: "修正：「能否培養良好的運動習慣，是保持身體健康的關鍵。」", 
        options: ["A. 前半句『能否』是兩面詞，後半句『保持』是一面詞，前後邏輯失衡", "B. 「培養」不能搭配「習慣」", "C. 「保持」不能搭配「健康」", "D. 缺乏主語"], 
        correctIndex: 0, 
        explanation: "兩面與一面搭配不當。前半句「能否」包含能與不能兩面，後半句「保持健康」只有肯定的一面。應改為「能否培養...，是能否保持...的關鍵」或刪除「能否」。" 
    },
    { 
        question: "修正：「我們必須努力解決並及時發現學習上存在的種種問題。」", 
        options: ["A. 「努力」不能修飾「解決」", "B. 「問題」不能被「發現」", "C. 邏輯語序顛倒，應先「發現」問題，才能「解決」問題", "D. 缺乏主語"], 
        correctIndex: 2, 
        explanation: "語序不當（邏輯先後顛倒）。按照事理邏輯，必須先「發現」潛在的問題，然後才能針對問題去「解決」它，兩者的順序不能互換。" 
    },
    { 
        question: "修正：「局長叮囑幾個派出所的警察，夜間巡邏時務必提高警覺。」", 
        options: ["A. 「叮囑」與「警察」搭配不當", "B. 「幾個派出所的警察」指代不明產生歧義，不知是『幾間派出所』還是『幾位警察』", "C. 缺乏賓語", "D. 「務必」與「提高」語意重複"], 
        correctIndex: 1, 
        explanation: "表意不明（歧義）。數量詞「幾個」位置不當，會讓人誤解到底是派出所有幾間，還是警察有幾位。應改為「派出所的幾位警察」以釐清句意。" 
    },
    { 
        question: "修正：「菜市場的攤位上擺滿了高麗菜、青江菜、豬肉和蔬菜等新鮮食材。」", 
        options: ["A. 缺乏主語", "B. 「高麗菜、青江菜」與「蔬菜」存在包含關係，大概念與小概念並列，分類不當", "C. 「擺滿了」與「食材」搭配不當", "D. 語序顛倒"], 
        correctIndex: 1, 
        explanation: "不合邏輯（分類不當）。「高麗菜」和「青江菜」本來就屬於「蔬菜」的一種，不能與大概念的「蔬菜」並列，應刪除「和蔬菜」。" 
    },
    { 
        question: "修正：「經過這次的社區服務，使他體會到了助人的快樂。」", 
        options: ["A. 缺乏賓語", "B. 濫用介詞「經過」與使動詞「使」，導致缺乏主語", "C. 「體會」不能搭配「快樂」", "D. 語序不當"], 
        correctIndex: 1, 
        explanation: "成分殘缺（無主語）。濫用介詞「經過」與使動詞「使」，導致句子找不到執行動作的主語，應刪去其中一個。" 
    },
    { 
        question: "修正：「中華隊在國際賽事中大獲全勝，隊員們紛紛凱旋歸來。」", 
        options: ["A. 「凱旋」與「歸來」語意重複，應刪去「歸來」", "B. 主客顛倒", "C. 「大獲全勝」不能修飾「中華隊」", "D. 缺乏謂語"], 
        correctIndex: 0, 
        explanation: "語意重複 / 贅餘。「凱旋」本身就已經包含了「戰勝歸來」的意思，後面再加「歸來」即為語意累贅。" 
    },
    { 
        question: "修正：「我們必須充分發揮並建立一套完善的校園安全機制。」", 
        options: ["A. 「完善」不能修飾「機制」", "B. 「發揮」不能搭配「機制」，動賓不配", "C. 缺乏主語", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "動賓搭配不當。動詞「建立」可以搭配「機制」，但動詞「發揮」不能搭配「機制」（通常是發揮『作用』）。" 
    },
    { 
        question: "修正：「這項計畫能否順利推行，是公司今年轉虧為盈的保證。」", 
        options: ["A. 缺乏主語", "B. 句式雜糅", "C. 前半句「能否」是兩面詞，後半句「保證」是一面詞，邏輯失衡", "D. 「推行」與「計畫」搭配不當"], 
        correctIndex: 2, 
        explanation: "兩面與一面搭配不當。前半句包含了「能」與「否」兩面，後半句「保證」只代表單一肯定的結果。應改為「是公司能否轉虧為盈的關鍵」。" 
    },
    { 
        question: "修正：「這次的校外教學活動，學校是本著以安全第一為原則來策劃的。」", 
        options: ["A. 將『本著...的原則』與『以...為原則』兩種句式雜糅", "B. 「策劃」不能搭配「活動」", "C. 缺乏賓語", "D. 語序顛倒"], 
        correctIndex: 0, 
        explanation: "句式雜糅。作者把「本著安全第一的原則」和「以安全第一為原則」兩種句型混在一起使用了，應刪去「本著」或「以...為」。" 
    },
    { 
        question: "修正：「小華借了小明五百塊錢，打算明天再去買那套參考書。」", 
        options: ["A. 缺乏主語", "B. 「借了」產生歧義，不知是小華借錢給小明，還是小華向小明借錢", "C. 「打算」與「買」動賓不配", "D. 時態錯誤"], 
        correctIndex: 1, 
        explanation: "表意不明（歧義）。動詞「借」既可以是借出，也可以是借入。無法確定錢是誰給誰的，應改為「借給」或「向...借了」。" 
    },
    { 
        question: "修正：「這個深刻的歷史教訓，對我們現代人是一定要記住的。」", 
        options: ["A. 缺乏謂語", "B. 句式雜糅", "C. 主客體顛倒，應改為『我們現代人對這個深刻的歷史教訓是一定要記住的』", "D. 「深刻」不能修飾「教訓」"], 
        correctIndex: 2, 
        explanation: "不合邏輯（主客顛倒）。人才是記憶和認知的主體，教訓是被記憶的客體。不能把客體當主語說它對人如何。" 
    },
    { 
        question: "修正：「為了避免不再重蹈覆轍，他每天都把錯誤記錄在筆記本上。」", 
        options: ["A. 缺乏主語", "B. 「避免」與「不再」構成雙重否定，導致句意變成『希望重蹈覆轍』", "C. 「重蹈覆轍」使用錯誤", "D. 語意重複"], 
        correctIndex: 1, 
        explanation: "否定不當 / 不合邏輯。「避免」已有否定的意思，加上「不再」負負得正，變成要讓錯誤繼續發生。應刪去「不」。" 
    },
    { 
        question: "修正：「圖書館的閱覽室裡，準備了報紙、雜誌、電視和各類出版物供學生使用。」", 
        options: ["A. 「出版物」包含了報紙與雜誌，大概念與小概念並列導致分類不當", "B. 缺乏賓語", "C. 「準備」不能搭配「電視」", "D. 語序顛倒"], 
        correctIndex: 0, 
        explanation: "不合邏輯（分類不當）。「報紙」和「雜誌」本身就是出版物，不能與大概念的「出版物」並列。且電視也不屬於出版物。" 
    },
    { 
        question: "修正：「他手中握著一把剛剛撿到的生鏽的鐵製的沉重鑰匙。」", 
        options: ["A. 缺乏主語", "B. 「握著」與「鑰匙」搭配不當", "C. 多項定語語序不當，應改為『一把剛剛撿到的沉重的生鏽鐵製鑰匙』", "D. 句式雜糅"], 
        correctIndex: 2, 
        explanation: "語序不當。多重定語的順序一般為：數量(一把) + 時間/來源(剛剛撿到的) + 形狀/特徵(沉重的) + 狀態(生鏽) + 材質(鐵製) + 名詞(鑰匙)。" 
    },
    { 
        question: "修正：「由於連日來的傾盆大雨，使到山區多處發生嚴重的土石流。」", 
        options: ["A. 「傾盆大雨」與「連日來」語意矛盾", "B. 濫用介詞「由於」與使動詞「使到」，導致句子缺乏主語", "C. 「發生」與「土石流」搭配不當", "D. 缺乏賓語"], 
        correctIndex: 1, 
        explanation: "成分殘缺（無主語）。「由於」讓前半句變成狀語，「使到」又把主語隱藏了。應刪去「由於」或「使到」。" 
    },
    { 
        question: "修正：「聽完他講的笑話，大家都忍俊不禁地笑了出來。」", 
        options: ["A. 「忍俊不禁」與「笑了出來」語意重複贅餘", "B. 缺乏主語", "C. 「聽完」與「笑話」搭配不當", "D. 句式雜糅"], 
        correctIndex: 0, 
        explanation: "語意重複 / 贅餘。「忍俊不禁」的意思就是忍不住笑出來，後面再加「笑了出來」造成語意累贅，應改為「大家都忍俊不禁」或「大家都忍不住笑了出來」。" 
    },
    { 
        question: "修正：「學校舉辦的這項課外活動，大大擴大和提高了學生的視野。」", 
        options: ["A. 「大大」不能修飾「擴大」", "B. 缺乏主語", "C. 動詞與賓語搭配不當，「提高」不能搭配「視野」", "D. 句式雜糅"], 
        correctIndex: 2, 
        explanation: "動賓搭配不當。「擴大」可以搭配「視野」，但是「提高」不能搭配「視野」（通常搭配『水平』或『成績』）。應改為「擴大了視野，提高了能力」。" 
    },
    { 
        question: "修正：「學生是否有良好的讀書習慣，是國文成績優異的關鍵。」", 
        options: ["A. 缺乏賓語", "B. 前半句『是否』是兩面詞，後半句『優異』是一面詞，前後邏輯失衡", "C. 「優異」不能修飾「成績」", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "兩面與一面搭配不當。前半句「是否」包含了有與沒有兩面，後半句「優異」只有肯定的一面。應改為「是國文成績能否優異的關鍵」。" 
    },
    { 
        question: "修正：「這款手機之所以銷量慘淡的原因，是因為定價過高造成的。」", 
        options: ["A. 「慘淡」不能修飾「銷量」", "B. 缺乏主語", "C. 主客體顛倒", "D. 將『之所以...是因為』與『...的原因是...造成的』多種句式雜糅"], 
        correctIndex: 3, 
        explanation: "句式雜糅。作者將太多表達因果的句型湊在一起，顯得冗長且結構混亂。應簡化為「這款手機之所以銷量慘淡，是因為定價過高」。" 
    },
    { 
        question: "修正：「昨天下午，校長在辦公室會見了三個學校的家長代表。」", 
        options: ["A. 缺乏謂語", "B. 「三個學校的家長代表」指代不明產生歧義，不知是『三所學校』還是『三位代表』", "C. 「會見」不能搭配「代表」", "D. 語序顛倒"], 
        correctIndex: 1, 
        explanation: "表意不明（歧義）。數量詞「三個」的位置會讓人誤解到底是「三個學校」的代表，還是同一個學校的「三位」家長代表。" 
    },
    { 
        question: "修正：「這部剛上映的科幻大片，對廣大影迷是不會感到陌生的。」", 
        options: ["A. 主客體顛倒，人才是認知主體，應改為『廣大影迷對這部剛上映的科幻大片是不會感到陌生的』", "B. 缺乏賓語", "C. 「賣座」不能修飾「電影」", "D. 句式雜糅"], 
        correctIndex: 0, 
        explanation: "不合邏輯（主客顛倒）。影迷（人）才是感到陌生的主體，電影是客體。不能把電影當作主體去對人產生感覺。" 
    },
    { 
        question: "修正：「我們應該盡量避免不發生這種令人遺憾的低級錯誤。」", 
        options: ["A. 「盡量」與「避免」語意重複", "B. 缺乏主語", "C. 「避免」與「不發生」構成雙重否定，導致句意變成『要讓錯誤發生』", "D. 「低級」不能修飾「錯誤」"], 
        correctIndex: 2, 
        explanation: "否定不當 / 不合邏輯。「避免」本身已經有設法不讓其發生的意思，加上「不」，負負得正，反而變成「盡量讓它發生」。應刪除「不」。" 
    },
    { 
        question: "修正：「超市的冰櫃裡擺滿了豬肉、牛肉、白菜和各種肉類。」", 
        options: ["A. 缺乏主語", "B. 「白菜」不屬於肉類，分類不當；且「豬肉、牛肉」已包含在肉類中，大小概念不能並列", "C. 「擺滿了」與「肉類」搭配不當", "D. 語序顛倒"], 
        correctIndex: 1, 
        explanation: "不合邏輯（分類不當）。白菜是蔬菜，不能歸類在「各種肉類」中；且豬肉牛肉本就是肉類，不能與大概念並列。" 
    },
    { 
        question: "修正：「不但他能流利地說英語，而且還能寫出優美的英文文章。」", 
        options: ["A. 「流利」不能修飾「說」", "B. 缺乏賓語", "C. 語意重複", "D. 關聯詞位置錯誤，前後分句主語相同（他），主語應放在「不但」之前"], 
        correctIndex: 3, 
        explanation: "語序不當（關聯詞位置錯誤）。當前後分句的主語都是「他」時，主語必須放在關聯詞前面，改為「他不但能...而且還能...」。" 
    },
    { 
        question: "修正：「為了防止校園暴力事件不再發生，教育局頒布了新規定。」", 
        options: ["A. 「防止」與「不再發生」雙重否定導致語意變成『希望發生』", "B. 「頒布」不能搭配「規定」", "C. 缺乏主語", "D. 句式雜糅"], 
        correctIndex: 0, 
        explanation: "否定不當 / 不合邏輯。「防止」已經有阻止的意思，加上「不再」，負負得正，意思反而變成了要讓校園暴力繼續發生。應刪除「不」。" 
    },
    { 
        question: "修正：「能不能掌握正確的讀書方法，是我們考上理想大學的關鍵。」", 
        options: ["A. 缺乏賓語", "B. 前半句『能不能』是兩面詞，後半句『考上』是一面詞，前後邏輯失衡", "C. 「掌握」不能搭配「方法」", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "兩面與一面搭配不當。前半句「能不能」包含正反兩面，後半句「考上」只有肯定的一面。應改為「是我們能否考上理想大學的關鍵」。" 
    },
    { 
        question: "修正：「他之所以遲到的原因，是因為路上發生嚴重車禍造成的。」", 
        options: ["A. 「嚴重」不能修飾「車禍」", "B. 缺乏主語", "C. 主客體顛倒", "D. 將『之所以...是因為』與『...的原因是...造成的』多種句式雜糅"], 
        correctIndex: 3, 
        explanation: "句式雜糅。這句話把太多種表達因果關係的句型湊在一起，結構混亂。應簡化為「他之所以遲到，是因為路上發生嚴重車禍」或「他遲到的原因，是路上發生嚴重車禍」。" 
    },
    { 
        question: "修正：「在這次跨部門會議上，大家對這個問題交換了廣泛的意見。」", 
        options: ["A. 缺乏主語", "B. 語序不當，應改為『廣泛地交換了意見』", "C. 「交換」不能搭配「意見」", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "語序不當。「廣泛」在這裡應該是作為副詞來修飾動詞「交換」（廣泛地交換），而不是作為形容詞去修飾名詞「意見」。" 
    },
    { 
        question: "修正：「蘇軾的文學作品，對我們現代人是不陌生的。」", 
        options: ["A. 主客體顛倒，人才是認知主體，應改為『我們現代人對蘇軾的文學作品是不陌生的』", "B. 缺乏謂語", "C. 「不陌生」與「熟悉」語意重複", "D. 句式雜糅"], 
        correctIndex: 0, 
        explanation: "不合邏輯（主客顛倒）。人才是產生認知的主體，作品是被認知的客體。不能把作品當作主體去對人產生感覺。" 
    },
    { 
        question: "修正：「我們應該盡力改善和提高偏鄉地區的教育水準。」", 
        options: ["A. 「盡力」不能修飾「改善」", "B. 動詞與賓語搭配不當，「改善」不能搭配「教育水準」", "C. 缺乏主語", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "動賓搭配不當。「提高」可以搭配「教育水準」，但是「改善」通常搭配「環境」或「生活條件」，不能搭配「水準」。" 
    },
    { 
        question: "修正：「昨天下午，我看到了三個醫院的醫生在急診室裡討論病情。」", 
        options: ["A. 缺乏謂語", "B. 「三個醫院的醫生」指代不明產生歧義，不知是『三所醫院』還是『三位醫生』", "C. 「討論」不能搭配「病情」", "D. 語意重複"], 
        correctIndex: 1, 
        explanation: "表意不明（歧義）。數量詞「三個」的位置會讓人誤解到底是「三所不同醫院」的醫生，還是同一個醫院的「三位」醫生。" 
    },
    { 
        question: "修正：「我們必須認真解決並隨時發現工作中的潛在問題。」", 
        options: ["A. 邏輯先後順序顛倒，應先「發現」問題，才能「解決」問題", "B. 「潛在」不能修飾「問題」", "C. 缺乏主語", "D. 句式雜糅"], 
        correctIndex: 0, 
        explanation: "不合邏輯（語序顛倒）。按照人類認知事物的邏輯，必須先「發現」潛在的問題，然後才能針對問題去「解決」它。" 
    },
    { 
        question: "修正：「這是一套多麼令人無比感動的自然生態紀錄片啊！」", 
        options: ["A. 缺乏主語", "B. 「令人」與「感動」搭配不當", "C. 「多麼」和「無比」語意重複贅餘，應刪去其中一個", "D. 句式雜糅"], 
        correctIndex: 2, 
        explanation: "語意重複 / 贅餘。「多麼」和「無比」都是表示程度極深的副詞，兩者疊用造成了語意上的累贅。" 
    },
    { 
        question: "修正：「透過觀看這部環保紀錄片，使我深刻體會到了保護地球的重要性。」", 
        options: ["A. 「體會」與「重要性」搭配不當", "B. 語序顛倒", "C. 濫用介詞「透過」與使動詞「使」，導致句子缺乏主語", "D. 語意重複"], 
        correctIndex: 2, 
        explanation: "成分殘缺（無主語）。「透過...」形成了介詞片語當作狀語，後面又接「使...」，導致整句話找不到執行「體會」這個動作的主語。應刪除「透過」或刪除「使」。" 
    },
    { 
        question: "修正：「無論天氣多麼惡劣，所以搜救隊員始終沒有放棄尋找失蹤者。」", 
        options: ["A. 「無論」表條件，「所以」表因果，關聯詞搭配不當，應將「所以」改為「都」", "B. 「惡劣」不能修飾「天氣」", "C. 缺乏主語", "D. 句式雜糅"], 
        correctIndex: 0, 
        explanation: "關聯詞搭配不當。「無論」引導的是無條件條件句，後面必須搭配「都」或「也」，不能搭配表因果關係的「所以」。" 
    },
    { 
        question: "修正：「我們必須養成隨時保持環境整潔。」", 
        options: ["A. 「養成」與「保持」語意衝突", "B. 「保持」不能搭配「環境」", "C. 句末成分殘缺，缺乏賓語中心語，應補上『的習慣』", "D. 缺乏主語"], 
        correctIndex: 2, 
        explanation: "成分殘缺（缺賓語）。及物動詞「養成」後面必須接名詞性的賓語。這裡只有「隨時保持環境整潔」這個動詞片語，因此必須在句末加上「的習慣」或「的態度」。" 
    },
    { 
        question: "修正：「菜市場裡賣著各式各樣的蔬菜、水果、高麗菜和農產品。」", 
        options: ["A. 缺乏謂語", "B. 「農產品」包含了蔬菜與水果，大概念與小概念不能並列，分類不當", "C. 「各式各樣」不能修飾「蔬菜」", "D. 語序顛倒"], 
        correctIndex: 1, 
        explanation: "不合邏輯（分類不當）。「高麗菜」是蔬菜的一種，「蔬菜、水果」又都屬於「農產品」。這種存在包含與被包含關係的詞語，不能放在一起並列。" 
    },
    { 
        question: "修正：「他大約花了將近一個小時左右才把這份考卷寫完。」", 
        options: ["A. 「花費」不能搭配「時間」", "B. 「大約」、「將近」與「左右」語意重複贅餘，保留一個即可", "C. 缺乏主語", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "語意重複 / 贅餘。「大約」、「將近」和「左右」全都是用來表示估計的概數詞，同時疊用造成了嚴重的語意累贅。" 
    },
    { 
        question: "修正：「有沒有強大的毅力，是一個人獲得事業成功的基礎。」", 
        options: ["A. 前半句『有沒有』是兩面詞，後半句『獲得成功』是一面詞，前後邏輯失衡", "B. 「強大」不能修飾「毅力」", "C. 缺乏賓語", "D. 句式雜糅"], 
        correctIndex: 0, 
        explanation: "兩面與一面搭配不當。前半句包含了「有」與「沒有」正反兩面，但後半句只有肯定的一面。應改為「有沒有強大的毅力，是一個人能否獲得事業成功的基礎」。" 
    },
    { 
        question: "修正：「這件慘劇的發生，是由於司機酒後駕車而引起的。」", 
        options: ["A. 缺乏主語", "B. 「慘劇」與「發生」動賓不配", "C. 將『是由於...』與『是...引起的』兩種句式雜糅", "D. 語序顛倒"], 
        correctIndex: 2, 
        explanation: "句式雜糅。作者將兩種表達原因的句型硬湊在一起，造成結構混亂。應簡化為「這件慘劇是由於司機酒駕」或「這件慘劇是司機酒駕引起的」。" 
    },
    { 
        question: "修正：「對於小明來說，數學這門學科是非常感興趣的。」", 
        options: ["A. 「非常」不能修飾「感興趣」", "B. 缺乏謂語", "C. 句式雜糅", "D. 主客體顛倒，應改為『小明對數學這門學科是非常感興趣的』"], 
        correctIndex: 3, 
        explanation: "不合邏輯（主客顛倒）。人（小明）是產生興趣的主體，學科是被產生興趣的客體。不能說「學科對人感興趣」。" 
    },
    { 
        question: "修正：「局長在今天的會議上表揚了三個學校的老師。」", 
        options: ["A. 「三個學校的老師」指代不明產生歧義，不知是『三所學校』還是『三位老師』", "B. 缺乏賓語", "C. 「表揚」不能搭配「老師」", "D. 語序顛倒"], 
        correctIndex: 0, 
        explanation: "表意不明（歧義）。數量詞「三個」位置不當，會讓人誤解到底是學校有三所，還是同一個學校的老師有三位。應改為「學校的三位老師」或「三所學校的老師」。" 
    },
    { 
        question: "修正：「為了防止不再重蹈覆轍，他每天都寫檢討日記。」", 
        options: ["A. 缺乏主語", "B. 「防止」與「不再」構成雙重否定，導致句意變成『希望重蹈覆轍』", "C. 「重蹈覆轍」使用錯誤", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "否定不當 / 不合邏輯。「防止」本身已經有設法不讓其發生的否定意味，加上「不再」，負負得正，反而變成要讓錯誤繼續發生。應刪除「不再」。" 
    },
    { 
        question: "修正：「她手中拿著一個剛買的紅色的精緻的蘋果。」", 
        options: ["A. 多項定語語序不當，應改為『一個剛買的精緻的紅色蘋果』", "B. 「精緻」不能修飾「蘋果」", "C. 缺乏主語", "D. 句式雜糅"], 
        correctIndex: 0, 
        explanation: "語序不當。多項定語排列時，依照中文語感應為：數量(一個) + 時間/來源(剛買的) + 形狀/評價特徵(精緻的) + 顏色/性質(紅色) + 名詞(蘋果)。" 
    },
    { 
        question: "修正：「我們如果把問題不解決，就會引發公司更大的財務危機。」", 
        options: ["A. 「如果」位置錯誤，應放在句首", "B. 否定副詞「不」位置不當，應放在「把」字前面，改為『如果不把問題解決』", "C. 「解決」與「問題」搭配不當", "D. 缺乏主語"], 
        correctIndex: 1, 
        explanation: "語序不當（否定副詞位置錯誤）。在「把」字句中，否定詞（不、沒有、未）必須放在「把」字的前面，不能放在動詞前面。" 
    },
    { 
        question: "修正：「誰也不能否認這部電影沒有深遠的教育意義。」", 
        options: ["A. 構成三重否定，導致句意變成『這部電影沒有教育意義』，違反常理", "B. 「深遠」不能修飾「教育意義」", "C. 缺乏主語", "D. 句式雜糅"], 
        correctIndex: 0, 
        explanation: "否定不當 / 不合邏輯。「不能否認」是雙重否定表肯定，加上後面的「沒有」，變成了三重否定，句意反轉成了「必須否認它有教育意義（即沒有意義）」。應刪除「沒有」。" 
    },
    { 
        question: "修正：「這篇文章深刻地刻畫了主角的內心世界和無私的精神。」", 
        options: ["A. 「深刻」不能修飾「刻畫」", "B. 動賓搭配不當，「刻畫」可以搭配「內心世界」，但不能搭配「精神」", "C. 缺乏謂語", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "動賓搭配不當。一個動詞「刻畫」帶了兩個賓語，雖然能配「內心世界」，但「精神」是不能被「刻畫」的（通常是『表現』或『發揚』精神）。" 
    },
    { 
        question: "修正：「看到運動員在奧運賽場上奮力拚搏，使我深受感動。」", 
        options: ["A. 缺乏賓語", "B. 「奮力」與「拚搏」語意重複", "C. 濫用「看到」與使動詞「使」，導致句子缺乏主語", "D. 語序顛倒"], 
        correctIndex: 2, 
        explanation: "成分殘缺（無主語）。「看到...」是動作狀語，後面又接了「使...」，導致整句話沒有主語。應改為「運動員的奮力拚搏，使我深受感動」或刪除「使」。" 
    },
    { 
        question: "修正：「關於這件事情的處理方法，我們還需要進一步探討與研究的必要。」", 
        options: ["A. 「探討」與「研究」語意重複", "B. 缺乏主語", "C. 句式雜糅，將『還需要進一步探討與研究』和『還有進一步探討與研究的必要』混在一起", "D. 語序顛倒"], 
        correctIndex: 2, 
        explanation: "句式雜糅。作者心裡同時想著兩種表達方式，結果把它們硬湊成了一句累贅的話。應刪去「需要」或刪去「的必要」。" 
    },
    { 
        question: "修正：「這本暢銷雜誌的讀者對象，主要是面向年輕的大學生。」", 
        options: ["A. 缺乏賓語", "B. 「讀者對象」與「面向」語意重複贅餘，應刪去其一", "C. 「暢銷」不能修飾「雜誌」", "D. 主客體顛倒"], 
        correctIndex: 1, 
        explanation: "語意重複 / 句式雜糅。「對象」本身就包含了「面向...群體」的意思。應改為「讀者對象是年輕的大學生」或「主要是面向年輕的大學生」。" 
    },
    { 
        question: "修正：「一個人是否有足夠的自信，是在事業上取得成功的關鍵。」", 
        options: ["A. 缺乏主語", "B. 前半句是兩面詞『是否』，後半句是一面詞『取得成功』，前後邏輯失衡", "C. 「足夠」不能修飾「自信」", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "兩面與一面搭配不當。前半句包含了「有自信」與「沒自信」兩面，後半句卻只有「成功」這一單一結果。應改為「是在事業上能否取得成功的關鍵」。" 
    },
    { 
        question: "修正：「我昨天去醫院探望了正在住院的林醫生的母親。」", 
        options: ["A. 「探望」不能搭配「母親」", "B. 缺乏謂語", "C. 「正在住院的林醫生的母親」指代不明產生歧義，不知是『林醫生在住院』還是『母親在住院』", "D. 語序顛倒"], 
        correctIndex: 2, 
        explanation: "表意不明（歧義）。修飾語「正在住院的」位置不當，會讓人誤解到底是「林醫生」在住院，還是林醫生的「母親」在住院。應調整語序以釐清。" 
    },
    { 
        question: "修正：「參加這次校務會議的有老師、學生、校長和全校教職員。」", 
        options: ["A. 缺乏主語", "B. 「校長和教職員」包含了老師，大概念與小概念不能並列，分類不當", "C. 語序顛倒", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "不合邏輯（分類不當）。「教職員」是一個大概念，本身就包含了「老師」與「校長」，它們之間存在包含關係，不能放在一起並列。" 
    },
    { 
        question: "修正：「這首經典的老歌，對許多中年人來說是充滿青春回憶的。」", 
        options: ["A. 缺乏賓語", "B. 主客體顛倒，人才是產生回憶的主體，應改為『許多中年人對這首經典的老歌是充滿青春回憶的』", "C. 「經典」與「老歌」語意重複", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "不合邏輯（主客顛倒）。人才是擁有記憶、產生情感的主體，歌曲是被記憶的客體。不能把歌曲當作主體去對人產生回憶。" 
    },
    { 
        question: "修正：「由於全球暖化的影響，使到北極冰川加速融化。」", 
        options: ["A. 缺乏賓語", "B. 濫用「由於」與「使到」導致無主語，應刪去其一", "C. 「加速」不能修飾「融化」", "D. 語序顛倒"], 
        correctIndex: 1, 
        explanation: "成分殘缺（無主語）。「由於」讓前半句變成狀語，「使到」又把主語隱藏了，導致整個句子找不到主語。應刪去「由於」或「使到」。" 
    },
    { 
        question: "修正：「我們必須要互相彼此尊重，才能建立良好的人際關係。」", 
        options: ["A. 「互相」與「彼此」語意重複贅餘，應刪除其中一個", "B. 缺乏主語", "C. 句式雜糅", "D. 「建立」不能搭配「關係」"], 
        correctIndex: 0, 
        explanation: "語意重複 / 贅餘。「互相」和「彼此」意義完全相同，疊加使用會造成語意累贅。" 
    },
    { 
        question: "修正：「能不能按時完成工程，是我們節約成本的關鍵。」", 
        options: ["A. 缺乏主語", "B. 句式雜糅", "C. 前半句「能不能」是兩面詞，後半句「節約成本」是一面詞，邏輯失衡", "D. 「按時」不能修飾「完成」"], 
        correctIndex: 2, 
        explanation: "兩面與一面搭配不當。前半句有「能」與「不能」兩面情況，後半句卻只有單一肯定的結果。應改為「是我們能否節約成本的關鍵」。" 
    },
    { 
        question: "修正：「這件工安意外發生的原因，是由於工人操作不當所造成的。」", 
        options: ["A. 「意外」與「發生」搭配不當", "B. 將『原因是...』與『是由於...造成的』兩種句式雜糅", "C. 缺乏賓語", "D. 語序顛倒"], 
        correctIndex: 1, 
        explanation: "句式雜糅。這句話將兩種表達原因的句型混雜在一起，顯得冗長不通。應改為「原因是工人操作不當」或「是由於工人操作不當所造成的」。" 
    },
    { 
        question: "修正：「中國的書法藝術，對我是非常熱愛的。」", 
        options: ["A. 主客體顛倒，人才是產生熱愛的主體，應改為『我對中國的書法藝術是非常熱愛的』", "B. 「書法」與「藝術」語意重複", "C. 缺乏謂語", "D. 句式雜糅"], 
        correctIndex: 0, 
        explanation: "不合邏輯（主客顛倒）。人是主體，藝術是客體，不能把客體當作主體，說事物「熱愛」人。" 
    },
    { 
        question: "修正：「我們應該培養並發揚愛護環境的好習慣。」", 
        options: ["A. 「培養」與「發揚」語序顛倒", "B. 缺乏主語", "C. 動詞「發揚」不能搭配賓語「好習慣」", "D. 語意重複"], 
        correctIndex: 2, 
        explanation: "動賓搭配不當。「培養」可以搭配「好習慣」，但「發揚」通常搭配「傳統」或「精神」，不能搭配「習慣」。應改為「培養好習慣並發揚環保精神」。" 
    },
    { 
        question: "修正：「我昨天在超級市場遇到了小明的哥哥和弟弟的朋友。」", 
        options: ["A. 缺乏謂語", "B. 搭配不當", "C. 「小明的哥哥和弟弟的朋友」指代不明產生歧義", "D. 語序顛倒"], 
        correctIndex: 2, 
        explanation: "表意不明（歧義）。「和」連接的對象不明確，可能是「(小明的哥哥) 和 (弟弟的朋友)」，也可能是「小明的 (哥哥和弟弟) 的朋友」。" 
    },
    { 
        question: "修正：「這間大賣場販售家電、冰箱、電視和各式各樣的日用品。」", 
        options: ["A. 缺乏主語", "B. 「家電」包含了冰箱和電視，大概念與小概念不能並列，分類不當", "C. 「販售」不能搭配「日用品」", "D. 語序顛倒"], 
        correctIndex: 1, 
        explanation: "不合邏輯（分類不當）。「冰箱」和「電視」本來就屬於「家電」，兩者有包含與被包含的關係，不能放在一起並列。" 
    },
    { 
        question: "修正：「為了防止不法分子不再利用網路詐騙，警方決定加強打擊力度。」", 
        options: ["A. 「防止」與「不再」構成雙重否定，導致句意變成『希望詐騙發生』，違反常理", "B. 「打擊」與「力度」搭配不當", "C. 缺乏主語", "D. 句式雜糅"], 
        correctIndex: 0, 
        explanation: "否定不當 / 不合邏輯。「防止」已經包含否定的意思，加上「不」變成負負得正，違背了要防範犯罪的初衷。應刪除「不」。" 
    },
    { 
        question: "修正：「他戴著一頂昨天剛買的黑色的毛線的棒球帽。」", 
        options: ["A. 「戴著」不能搭配「棒球帽」", "B. 多項定語語序不當，應改為『一頂昨天剛買的黑色毛線棒球帽』", "C. 缺乏主語", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "語序不當。多項定語的排列順序應為：數量(一頂) + 時間/來源(昨天剛買的) + 顏色(黑色) + 材質(毛線) + 名詞中心語(棒球帽)。修飾材質的詞語通常最靠近名詞。" 
    },
    { 
        question: "修正：「經過教練的悉心指導，使我的球技有了很大的進步。」", 
        options: ["A. 缺乏賓語", "B. 「指導」與「進步」搭配不當", "C. 濫用介詞「經過」與使動詞「使」，導致句子缺乏主語", "D. 語序顛倒"], 
        correctIndex: 2, 
        explanation: "成分殘缺（無主語）。「經過...」把前半句變成狀語，後面又加了「使...」，導致整句話找不到主體。應刪除「經過」或「使」。" 
    },
    { 
        question: "修正：「在戶外進行水上活動時，我們必須要時刻隨時注意自身安全。」", 
        options: ["A. 「時刻」和「隨時」語意重複贅餘，應刪去其中一個", "B. 缺乏主語", "C. 「注意」與「安全」搭配不當", "D. 句式雜糅"], 
        correctIndex: 0, 
        explanation: "語意重複 / 贅餘。「時刻」和「隨時」意思完全相同，疊加使用會造成語意累贅，保留一個即可。" 
    },
    { 
        question: "修正：「學習態度端正與否，是提升學業成績的保證。」", 
        options: ["A. 缺乏謂語", "B. 前半句『與否』是兩面詞，後半句『提升』是一面詞，前後邏輯失衡", "C. 「端正」不能修飾「態度」", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "兩面與一面搭配不當。前半句「與否」包含端正和不端正兩面，後半句「提升」只有肯定的一面。應改為「是能否提升學業成績的保證」。" 
    },
    { 
        question: "修正：「這次比賽失敗的原因，是因為平時訓練不足所造成的。」", 
        options: ["A. 「失敗」不能修飾「比賽」", "B. 將『原因是...』與『是因為...造成的』兩種句式雜糅", "C. 缺乏賓語", "D. 主客體顛倒"], 
        correctIndex: 1, 
        explanation: "句式雜糅。這句話將兩種表達原因的句型混在一起，顯得冗長且結構混亂。應改為「原因是平時訓練不足」或「是因為平時訓練不足所造成的」。" 
    },
    { 
        question: "修正：「這本引人入勝的人物傳記，對我們是非常喜歡的。」", 
        options: ["A. 主客體顛倒，人才是產生喜歡的主體，應改為『我們對這本引人入勝的人物傳記是非常喜歡的』", "B. 「引人入勝」不能修飾「傳記」", "C. 缺乏謂語", "D. 句式雜糅"], 
        correctIndex: 0, 
        explanation: "不合邏輯（主客體顛倒）。人才是產生情感（喜歡）的主體，書籍是客體。不能說書籍主動對人「喜歡」。" 
    },
    { 
        question: "修正：「我們應該多多培養和提高學生的閱讀興趣。」", 
        options: ["A. 「培養」與「提高」語序顛倒", "B. 缺乏主語", "C. 動詞「提高」不能搭配賓語「興趣」", "D. 語意重複"], 
        correctIndex: 2, 
        explanation: "動賓搭配不當。「培養」可以搭配「興趣」，但「提高」通常搭配「水準」、「能力」或「成績」，不能用來搭配「興趣」。" 
    },
    { 
        question: "修正：「剛走進大廳，我就看見幾間公司的工程師正在熱烈討論。」", 
        options: ["A. 缺乏謂語", "B. 「熱烈」不能修飾「討論」", "C. 「幾間公司的工程師」指代不明產生歧義", "D. 語序顛倒"], 
        correctIndex: 2, 
        explanation: "表意不明（歧義）。數量詞「幾間」位置不當，會讓人誤解到底是「幾間不同公司」的工程師，還是同一間公司的「幾位」工程師。" 
    },
    { 
        question: "修正：「這家文具店陳列著各種琳瑯滿目的商品、文具和書籍。」", 
        options: ["A. 缺乏主語", "B. 「商品」包含了文具和書籍，大概念與小概念不能並列，分類不當", "C. 「陳列著」與「商品」搭配不當", "D. 語序顛倒"], 
        correctIndex: 1, 
        explanation: "不合邏輯（分類不當）。「商品」是一個大概念，本身就包含了在店內販售的「文具」與「書籍」，它們之間存在包含關係，不能放在一起並列。" 
    },
    { 
        question: "修正：「為了防止這類傳染病不再爆發，衛生局呼籲民眾戴好口罩。」", 
        options: ["A. 「防止」與「不再」構成雙重否定，導致句意變成『希望疾病爆發』，違反常理", "B. 「爆發」與「傳染病」搭配不當", "C. 缺乏主語", "D. 句式雜糅"], 
        correctIndex: 0, 
        explanation: "否定不當 / 不合邏輯。「防止」已經包含否定的意思，加上「不」變成負負得正，違背了要防範疾病的初衷。應刪除「不再」。" 
    },
    { 
        question: "修正：「不僅這本書內容豐富，而且插圖也很精美。」", 
        options: ["A. 「豐富」不能修飾「內容」", "B. 關聯詞位置錯誤，前後分句主語相同（這本書），主語應放在「不僅」之前", "C. 缺乏主語", "D. 句式雜糅"], 
        correctIndex: 1, 
        explanation: "語序不當（關聯詞位置錯誤）。當前後分句都是在描述「這本書」時（主語相同），主語必須放在關聯詞的前面，改為「這本書不僅內容豐富，而且...」。" 
    },
    
    
]; 
const typoData = [{ question: "錯別字：「他為了這件鎖事，大動干戈。」", options: ["A. 鎖 (改:瑣)", "B. 戈 (改:哥)", "C. 竟 (改:競)", "D. 無錯"], correctIndex: 0, explanation: "「瑣事」才對。" }]; 

const memeData = [{ emoji: "🤦‍♂️", question: "朋友半途而廢，配哪句最適合？", options: ["A. 朽木不可雕也", "B. 燕雀安知鴻鵠之志", "C. 溫故而知新", "D. 己所不欲勿施於人"], correctIndex: 0, explanation: "比喻無可救藥。" }, { emoji: "🙄", question: "遇到無法溝通的人，配哪句最適合？", options: ["A. 醉翁之意不在酒", "B. 夏蟲不可以語冰", "C. 項莊舞劍", "D. 司馬昭之心"], correctIndex: 1, explanation: "比喻人見識短淺。" }]; 
const ancientModernData = [{ question: "「其實味不同」中「其實」意思？", options: ["A. 實際上", "B. 它的果實", "C. 道理", "D. 實在"], correctIndex: 1, explanation: "其：它的，實：果實。" }]; 

const themeData = [{ question: "《微笑以對》立意最深刻？", options: ["A. 失敗後，我決定在大家面前勉強擠出一個微笑，掩飾悲傷。", "B. 只要我們保持微笑，這世界上的所有問題都會自動解決。", "C. 經歷人生挫折後，內心真正釋懷，以豁達的態度微笑面對無常。", "D. 看到路人對我微笑覺得很溫暖，我決定每天對同學微笑。"], correctIndex: 2, explanation: "C 將『微笑動作』昇華為『豁達的人生態度』，立意最高。" }]; 
const materialData = [{ question: "《重遊舊地》想表達「物是人非」？", options: ["A. 舊地的公園設施全部翻新了，生鏽鞦韆換成了繽紛的滑梯。", "B. 舊居風景美麗如畫，果樹結滿果實，回憶瞬間湧現。", "C. 舊招牌被無情拆除，熟悉的雜貨店老闆黯然結業，人情味蕩然無存。", "D. 在舊地巧遇多年不見的小學同學和班主任，大家開心地敘舊。"], correctIndex: 2, explanation: "C 的細節最能觸動人心，展現強烈的今昔對比與失落感。" }]; 
const logicData = [{ question: "論點：「逆境激發潛能」。論據：「司馬遷」。", options: ["A. 他是偉大的歷史學家，我們應該學習他在逆境中讀歷史。", "B. 如果他沒有受刑，就不會寫史記。每個人都要經歷殘酷才能成功。", "C. 遭遇極大挫折，但他將悲憤化為寫作動力，證明逆境能激發潛能。", "D. 雖然遭遇不幸，但依然熱愛生活，告訴我們逆境也要保持愉快。"], correctIndex: 2, explanation: "C 完美解釋了『逆境』如何轉化為『潛能』。" }];
// 🌟 新增邏輯：計算從每年的 9 月 1 日算起，經過了多少天
function getDaysSinceSept1() {
    const now = new Date();
    let currentYear = now.getFullYear();
    if (now.getMonth() < 8) { currentYear--; }
    const sept1 = new Date(currentYear, 8, 1);
    return Math.floor(Math.abs(now - sept1) / 86400000);
}

function renderQuizzes() { 
    renderDailyQuiz('quiz-container-1', idiomsData, 'normal'); 
    renderDailyQuiz('quiz-container-2a', grammarData, 'normal'); 
    renderDailyQuiz('quiz-container-2b', typoData, 'normal'); 
    renderInfiniteQuiz('quiz-container-3', memeData, 'normal', true); 
    renderInfiniteQuiz('quiz-container-6', ancientModernData, 'normal'); 
    renderInfiniteQuiz('quiz-container-16', themeData, 'suggested'); 
    renderInfiniteQuiz('quiz-container-17', materialData, 'suggested'); 
    renderInfiniteQuiz('quiz-container-18', logicData, 'suggested'); 
}

function renderDailyQuiz(containerId, dataArray, type = 'normal', isMeme = false) { 
    const container = document.getElementById(containerId); if(!container) return; 
    if (!dataArray || dataArray.length === 0) {
        container.innerHTML = `<div class="card"><p class="question">⏳ 題庫準備中...</p></div>`;
        return;
    }
    // 🌟 使用 9 月 1 日重設計算邏輯
    const dayIndex = getDaysSinceSept1();
    const q = dataArray[dayIndex % dataArray.length];
    const memeHtml = isMeme && q.emoji ? `<div style="font-size: 4rem; text-align: center; margin-bottom: 10px;">${q.emoji}</div>` : ''; 
    container.innerHTML = `<div class="card" style="margin-bottom: 20px;">${memeHtml}<p class="question"><strong>📅 今日挑戰：</strong>${q.question}</p><div class="options">${q.options.map((opt, i) => `<button class="btn-option" style="line-height:1.6;" onclick="checkStaticAnswer(this, ${i}, ${q.correctIndex}, '${q.explanation}', '${type}', false, '${q.question.substring(0,20)}')">${opt}</button>`).join('')}</div><div class="feedback hidden" style="margin-top:15px;"></div></div>`; 
}

function renderInfiniteQuiz(containerId, dataArray, type = 'normal', isMeme = false) {
    const container = document.getElementById(containerId); if(!container) return;
    const qIndex = Math.floor(Math.random() * dataArray.length);
    const q = dataArray[qIndex];
    const memeHtml = isMeme && q.emoji ? `<div style="font-size: 4rem; text-align: center; margin-bottom: 10px;">${q.emoji}</div>` : ''; 
    container.innerHTML = `<div class="card" style="margin-bottom: 20px;">${memeHtml}<p class="question">${q.question}</p><div class="options">${q.options.map((opt, i) => `<button class="btn-option" style="line-height:1.6;" onclick="checkStaticAnswer(this, ${i}, ${q.correctIndex}, '${q.explanation}', '${type}', true, '${containerId}')">${opt}</button>`).join('')}</div><div class="feedback hidden" style="margin-top:15px;"></div></div>`; 
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
    const nextBtnHtml = isInfinite ? `<br><br><button class="btn-primary" onclick="renderQuizzes()">做下一題 ➔</button>` : `<br><br><div style="padding:15px; background:#e3f2fd; color:#1976d2; border-radius:8px; text-align:center; font-weight:bold;">✅ 已經完成今天本部分任務！請明天再來。</div>`;

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
const readingQuestions = { 
    1: [ { q: "「徐以杓酌油」的「徐」是？", opts: ["A. 慢慢", "B. 快速", "C. 姓氏"], correct: 0, exp: "解作慢慢地。" }, { q: "「釋擔而立」的「釋」是？", opts: ["A. 解釋", "B. 放下", "C. 挑起"], correct: 1, exp: "放下擔子。" }, { q: "「公亦以此自矜」的「矜」是？", opts: ["A. 矜持", "B. 憐憫", "C. 自誇"], correct: 2, exp: "指驕傲自誇。" } ],
    2: [ { q: "為何錢放葫蘆口？", opts: ["A. 炫耀", "B. 展示技術", "C. 洗錢"], correct: 1, exp: "證明熟能生巧。" }, { q: "陳堯咨對賣油翁的態度發生了什麼變化？", opts: ["A. 驕傲 -> 憤怒 -> 佩服", "B. 佩服 -> 憤怒 -> 鄙視", "C. 驕傲 -> 憤怒 -> 笑著打發"], correct: 2, exp: "最後是笑著把他打發走。" }, { q: "本文主要說明的道理是？", opts: ["A. 驕兵必敗", "B. 熟能生巧", "C. 尊老愛幼"], correct: 1, exp: "無他，但手熟爾。" } ],
    3: [ { q: "【對/錯/無從判斷】賣油翁崇拜陳堯咨？", opts: ["A. 對", "B. 錯", "C. 無從判斷"], correct: 1, exp: "他只覺得是手熟。" }, { q: "【對/錯/無從判斷】陳堯咨射箭百發百中。", opts: ["A. 對", "B. 錯", "C. 無從判斷"], correct: 1, exp: "錯誤。是十中八九。" }, { q: "【對/錯/無從判斷】賣油翁以前也練過射箭。", opts: ["A. 對", "B. 錯", "C. 無從判斷"], correct: 2, exp: "無從判斷。文中未提及。" } ]
}; 
function loadReadingQuiz(level) { 
    const container = document.getElementById('reading-quiz-container'); 
    const qArray = readingQuestions[level];
    const q = qArray[Math.floor(Math.random() * qArray.length)]; // 隨機抽一題
    const points = level === 1 ? 10 : (level === 2 ? 15 : 20);
    const lvName = level === 1 ? "🌱 基礎" : (level === 2 ? "🌲 進階" : "🔥 挑戰");
    container.innerHTML = `<div style="background: #fff; padding: 20px; border-radius: 8px; border: 2px solid #1976d2;"><p style="color: #1976d2; font-weight: bold; margin-bottom: 10px;">${lvName} (+${points}分)</p><p class="question">${q.q}</p><div class="options">${q.opts.map((opt, i) => `<button class="btn-option" style="padding: 10px;" onclick="checkReadingAnswer(this, ${i}, ${q.correct}, '${q.exp}', ${points})">${opt}</button>`).join('')}</div><div class="reading-feedback hidden" style="margin-top:15px; font-weight:bold;"></div></div>`; 
} 
function checkReadingAnswer(btn, clicked, correct, exp, points) { const parent = btn.parentElement; const feedback = parent.nextElementSibling; parent.querySelectorAll('.btn-option').forEach(b => b.disabled = true); feedback.classList.remove('hidden'); if(clicked === correct) { btn.style.backgroundColor = '#d4edda'; btn.style.borderColor = '#28a745'; feedback.style.color = '#155724'; feedback.innerHTML = `🎉 答對！解析：${exp} (+${points}分)`; addPoints(points); } else { btn.style.backgroundColor = '#f8d7da'; btn.style.borderColor = '#dc3545'; feedback.style.color = '#721c24'; feedback.innerHTML = `❌ 答錯！解析：${exp}`; } }

// ========================================================
// 5. 🌟 沙盒與社群 (老師可刪除畫廊作品) 🌟
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

// 🌟 真實 AI 畫圖 (與分享至畫廊) 🌟
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
// 6. 🌟 Google Gravity 物理文具書包系統 🌟
// ========================================================
function drawGacha() { 
    if(!deductCoins(500)) return alert("💰 金幣不足 500 枚！"); 
    const res = document.getElementById('gacha-result'); 
    res.classList.remove('hidden'); res.className = 'feedback info'; res.innerHTML = "🎲 盲盒開啟中..."; 
    
    setTimeout(() => { 
        let r = Math.random() * 100; let card = ""; let color = ""; let isItem = true; let isBag = false; let bagData = null;
        if (r < 1) { card = "【R級極罕】抵消現場紅牌 🛑"; color = "#d32f2f"; } 
        else if (r < 2) { card = "【R級極罕】獲綠色牌(與老師打球) 🍀"; color = "#4caf50"; } 
        else if (r < 5) { card = "【S級稀有】自選座位一天 🎵"; color = "#9c27b0"; } 
        else if (r < 10) { card = "【A 級】免答問題一次 🤫"; color = "#ff9800"; } 
        else if (r < 15) { card = "【A 級】小懲罰豁免權 🛡️"; color = "#2196f3"; } 
        else if (r < 55) { 
            isItem = false; isBag = true;
            const bags = [
                {n: "書包", u: "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f392.svg", w: 60},
                {n: "課本", u: "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f4d8.svg", w: 50},
                {n: "筆記本", u: "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f4d3.svg", w: 45},
                {n: "水瓶", u: "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f9e4.svg", w: 30},
                {n: "直尺", u: "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f4cf.svg", w: 60},
                {n: "原子筆", u: "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f58a.svg", w: 20}
            ];
            bagData = bags[Math.floor(Math.random() * bags.length)];
            card = `【B 級】物理裝備：${bagData.n}`; color = "#00796b";
            userBags.push(bagData); if(db && currentUser.role !== 'teacher') db.collection('users').doc(currentUser.uid).update({ bags: userBags });
        } else { 
            isItem = false;
            const emojis = ["😎", "👻", "🔥", "✨", "👑", "👽", "💩", "🦄", "🐼", "🚀", "🌟"];
            const gotEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            card = `【B 級】專屬稱號 Emoji：${gotEmoji}`; color = "#757575";
            if(!userEmojis.includes(gotEmoji)) { userEmojis.push(gotEmoji); if(db && currentUser.role !== 'teacher') db.collection('users').doc(currentUser.uid).update({ emojis: userEmojis }); }
        }

        if(isItem) { userItems.push(card); if(db && currentUser.role !== 'teacher') db.collection('users').doc(currentUser.uid).update({ items: userItems }); }
        
        res.className = 'feedback success'; 
        res.innerHTML = `🎉 恭喜抽中：<br><br><span style="font-size:1.4rem; color:${color}; font-weight:bold;">${card}</span>`; 
        
        renderInventory(); 
        if(isBag && engineStarted) { addPhysicsBody(bagData); }
    }, 1500); 
}

// 物理引擎初始化 (修復手機與滑鼠觸控)
function initPhysicsEngine() {
    if(engineStarted) return;
    const container = document.getElementById('physics-canvas-container');
    if(!container) return;
    
    engineStarted = true;
    engine = Matter.Engine.create(); world = engine.world;
    render = Matter.Render.create({
        element: container, engine: engine,
        options: { width: container.clientWidth, height: 300, wireframes: false, background: 'transparent', pixelRatio: window.devicePixelRatio || 1 }
    });
    
    const ground = Matter.Bodies.rectangle(container.clientWidth/2, 310, container.clientWidth, 20, { isStatic: true, render: { fillStyle: 'transparent' } });
    const leftWall = Matter.Bodies.rectangle(-10, 150, 20, 300, { isStatic: true });
    const rightWall = Matter.Bodies.rectangle(container.clientWidth+10, 150, 20, 300, { isStatic: true });
    Matter.World.add(world, [ground, leftWall, rightWall]);
    
    const mouse = Matter.Mouse.create(render.canvas);
    mouse.pixelRatio = window.devicePixelRatio || 1; // 修復手機觸控偏移
    const mouseConstraint = Matter.MouseConstraint.create(engine, { mouse: mouse, constraint: { stiffness: 0.2, render: { visible: false } } });
    Matter.World.add(world, mouseConstraint);
    render.mouse = mouse;
    
    Matter.Render.run(render); runner = Matter.Runner.create(); Matter.Runner.run(runner, engine);
    
    userBags.forEach(b => { setTimeout(() => { addPhysicsBody(b); }, Math.random()*1000); });
}

function addPhysicsBody(bagData) {
    const container = document.getElementById('physics-canvas-container');
    const x = Math.random() * (container.clientWidth - 50) + 25;
    const body = Matter.Bodies.rectangle(x, -50, bagData.w, bagData.w, { restitution: 0.8 }); 
    Matter.World.add(world, body);
    
    const el = document.createElement('img');
    el.src = bagData.u; el.className = 'physics-item'; el.style.width = bagData.w + 'px';
    container.appendChild(el);
    
    Matter.Events.on(engine, 'afterUpdate', function() {
        el.style.left = body.position.x + 'px'; el.style.top = body.position.y + 'px';
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
function redeemItem(index, itemName) { if(confirm(`⚠️ 請在老師面前按下確認！\n\n確定現在兌換\n${itemName} 嗎？`)) { userItems.splice(index, 1); if(db && currentUser.role !== 'teacher') db.collection('users').doc(currentUser.uid).update({ items: userItems }); if(db) db.collection('redemptions').add({ name: currentUser.displayName, item: itemName, timeMs: Date.now(), time: new Date().toLocaleString() }); alert("✅ 兌換成功！已發送紀錄至老師後台。"); renderInventory(); } }

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
