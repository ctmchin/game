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
        options: ["A. 他的身體狀況已經_____，必須馬上進入開刀房動手術。", "B. 為了這次的科技創業，他決定_____，把僅有的房子也抵押給銀行了。", "C. 面對數量龐大的敵軍，我們只能_____，立刻舉白旗投降。", "D. 他做事總是_____，按部就班，所以主管非常信任他。"],
        correctIndex: 1,
        explanation: "典故出自項羽討伐秦軍。比喻下定極大的決心，不顧一切幹到底。"
    },
    {
        question: "【濫竽充數】正確的用法是？",
        options: ["A. 這家米其林星級餐廳的每一道菜都是_____，令人回味無窮。", "B. 他的繪畫技巧真是_____，畫出來的動物彷彿會動一樣。", "C. 為了湊足合唱團的參賽人數，完全不會看五線譜的小明只好去_____。", "D. 這項跨國專案非常重要，我們必須找一個_____的人才來負責領導。"],
        correctIndex: 2,
        explanation: "比喻沒有真才實學的人，混在行家裡面充數；或比喻拿不好的東西混在好的東西裡面充數。"
    },
    {
        question: "【杞人憂天】正確的用法是？",
        options: ["A. 既然系統漏洞已經完全修復，你就別再_____了，今晚好好睡一覺吧。", "B. 面對即將到來的大學聯考，他_____地每天苦讀到凌晨三點。", "C. 他的音樂才華在班上簡直是_____，大家都非常崇拜他。", "D. 突如其來的強烈地震讓全體員工都_____，尖叫著跑出大樓。"],
        correctIndex: 0,
        explanation: "比喻缺乏根據、毫無必要的瞎擔心。"
    },
    {
        question: "【絡繹不絕】正確的用法是？",
        options: ["A. 這位作家的寫作靈感_____，每年都能出版兩本暢銷小說。", "B. 逢年過節的迪化街裡，前來採買年貨的民眾_____，擠得水洩不通。", "C. 這場梅雨下得_____，導致低窪地區出現了嚴重的積水。", "D. 面對面試官一連串刁鑽的提問，他_____地回答了出來，毫無怯色。"],
        correctIndex: 1,
        explanation: "形容人、馬、車、船等連續不斷。通常專門用來形容「人潮」或「車流、交通」。"
    },
    {
        question: "【畫蛇添足】正確的用法是？",
        options: ["A. 這篇報告的結論已經非常精準，你再加這段廢話簡直是_____。", "B. 老師在黑板上的解說非常生動，如同_____一般，讓我們瞬間明白了複雜的物理原理。", "C. 只要我們整個團隊齊心協力、_____，就一定能順利度過這次的財務危機。", "D. 這位大師的書法寫得極好，每一個字都_____，展現出極高的藝術造詣。"],
        correctIndex: 0,
        explanation: "比喻多此一舉，不但無益，反而有害。"
    },
    {
        question: "【杯弓蛇影】正確的用法是？",
        options: ["A. 剛看完恐怖電影後，他獨自走在暗巷裡，總是_____，覺得背後有人跟著。", "B. 為了慶祝他考上理想大學，親友們紛紛舉起酒杯，現場_____，好不熱鬧。", "C. 這位魔術師的手法極為高超，_____，讓台下觀眾看得目瞪口呆。", "D. 這條山路蜿蜒崎嶇，形狀猶如_____，開車經過時必須特別小心。"],
        correctIndex: 0,
        explanation: "比喻為不存在的虛幻事物而疑神疑鬼、徒自驚擾。"
    },
    {
        question: "【指鹿為馬】正確的用法是？",
        options: ["A. 這位昏庸的主管總是_____，把員工的功勞說成是自己的，把過錯全推給下屬。", "B. 歷史課本上清楚記載著，秦朝的趙高為了測試群臣的忠誠，竟然在朝堂上_____。", "C. 他在動物園裡看到了一隻罕見的動物，興奮地_____，結果被導覽員糾正。", "D. 為了追求效率，這家工廠的老闆_____，要求員工每天工作十六個小時。"],
        correctIndex: 1,
        explanation: "比喻顛倒是非，指黑為白；也形容人仗勢欺人、胡作非為。"
    },
    {
        question: "【雪中送炭】正確的用法是？",
        options: ["A. 他已經是世界首富了，你再送他這點錢，不過是_____，他根本不會在意。", "B. 就在這家孤兒院面臨斷炊之際，某位匿名善心人士捐贈了一大筆物資，這真是_____啊！", "C. 外頭正下著大雪，他卻_____地跑去山上露營，真是不怕凍壞身體。", "D. 兩家公司原本就競爭激烈，現在又為了搶奪專利而互相提告，簡直是_____。"],
        correctIndex: 1,
        explanation: "比喻在別人急需之時，給予物質上或精神上的幫助。"
    },
    {
        question: "【守株待兔】正確的用法是？",
        options: ["A. 在這瞬息萬變的科技時代，企業如果只會_____，遲早會被市場淘汰。", "B. 警方經過半個月的_____，終於在嫌犯住處附近將他逮捕歸案。", "C. 為了考試取得好成績，他每天_____，連假日時都不曾休息。", "D. 這位獵人有著_____的本領，只要被他盯上的獵物絕對逃不掉。"],
        correctIndex: 0,
        explanation: "比喻拘泥守成，不知變通；也比喻妄想不勞而獲或等著目標自己送上門來。"
    },
    {
        question: "【掩耳盜鈴】正確的用法是？",
        options: ["A. 他明明犯了嚴重的錯誤，卻把相關文件全鎖在抽屜裡，這種_____的做法遲早會被揭穿。", "B. 演唱會現場的音響實在太大聲了，觀眾們只好_____，以免聽力受損。", "C. 小偷趁著夜色_____，輕易地潛入了豪宅並偷走了保險箱。", "D. 這位官員表面上清廉，私底下卻_____，收受了大量的企業賄賂。"],
        correctIndex: 0,
        explanation: "比喻自欺欺人。"
    },
    {
        question: "【亡羊補牢】正確的用法是？",
        options: ["A. 這次的資安外洩事件雖然造成了損失，但只要我們現在_____，加強防護，還不算太晚。", "B. 他在賭場裡輸光了所有積蓄，現在才來後悔，已經是_____，於事無補了。", "C. 牧場裡的羊群因為染上傳染病而大量死亡，老闆看著空蕩蕩的羊圈，感到_____。", "D. 這項工程因為偷工減料而倒塌，建商試圖_____，掩蓋真相，卻被媒體踢爆。"],
        correctIndex: 0,
        explanation: "羊逃跑了再去修補羊圈，還不算晚。比喻犯錯後及時更正，尚能補救，防止更大的損失。"
    },
    {
        question: "【對牛彈琴】正確的用法是？",
        options: ["A. 這位鋼琴家在國家音樂廳的表演簡直是_____，讓全場聽眾如痴如醉。", "B. 農場主人每天早上都會對著乳牛播放古典音樂，這種_____的做法據說能增加產乳量。", "C. 我跟他講了半天投資理財的風險管理，他卻滿腦子只想著買彩券暴富，簡直是_____！", "D. 他們兩人的默契極佳，只要一個眼神就能明白對方的心意，真可謂是_____。"],
        correctIndex: 2,
        explanation: "比喻對不懂道理的人講道理，或是說話不看對象。"
    },
    {
        question: "【狐假虎威】正確的用法是？",
        options: ["A. 他只不過是總經理的特助，卻常常_____，在公司裡對其他部門的主管頤指氣使。", "B. 這兩支棒球隊的實力相當，比賽過程中雙方_____，互不相讓，戰況十分激烈。", "C. 雖然他身形瘦弱，但面對歹徒時卻能_____，勇敢地保護了身旁的孩童。", "D. 他們兩人聯手創辦了這家科技公司，在業界可說是_____，無人不知。"],
        correctIndex: 0,
        explanation: "比喻藉著有權者（或強者）的威勢去欺壓、嚇唬別人。"
    },
    {
        question: "【釜底抽薪】正確的用法是？",
        options: ["A. 為了趕緊把這鍋湯煮沸，媽媽不斷地往爐子裡_____，火勢越來越旺。", "B. 銀行拒絕繼續貸款給這家瀕臨破產的企業，無疑是_____，讓他們立刻倒閉。", "C. 想要解決市區塞車的問題，與其加派交警，不如_____，建立完善的捷運系統。", "D. 在敵軍猛烈的砲火下，我軍決定_____，悄悄從後山的小路撤退。"],
        correctIndex: 2,
        explanation: "把柴火從鍋底抽掉，才能讓鍋裡的水停止沸騰。比喻從根本上解決問題，不留後患。"
    },
    {
        question: "【刻舟求劍】正確的用法是？",
        options: ["A. 市場消費習慣早就變了，你還用十年前的行銷企劃案，無疑是_____，怎麼可能成功？", "B. 他在古董市場裡仔細翻找，希望能有_____的好運氣，用低價買到珍貴的文物。", "C. 這位雕刻師父的手藝精湛，能夠在小小的橄欖核上_____，令人嘆為觀止。", "D. 為了尋找失落在海裡的傳家寶，他不惜花費重金租了一艘潛水艇去_____。"],
        correctIndex: 0,
        explanation: "比喻做事拘泥死板，不知隨著情勢的變化而改變。"
    },
        {
        question: "【班門弄斧】正確的用法是？",
        options: ["A. 在這群資深軟體工程師面前談論基礎程式碼，我簡直是_____，讓大家見笑了。", "B. 他憑藉著_____的技藝，用一塊爛木頭雕刻出了栩栩如生的巨龍。", "C. 老師傅拿起工具_____，三兩下就把這台故障的機器修好了。", "D. 這項工程浩大，若不召集百名工匠_____，是很難在期限內完工的。"],
        correctIndex: 0,
        explanation: "比喻在行家面前賣弄本領，不自量力。"
    },
    {
        question: "【揠苗助長】正確的用法是？",
        options: ["A. 為了讓孩子早日成才，她給五歲的兒子報了十個補習班，這種_____的做法只會累垮孩子。", "B. 春雨綿綿，農夫們看著田裡的秧苗_____，心裡充滿了豐收的喜悅。", "C. 這家企業靠著政府的_____，在短短三年內就成為了產業龍頭。", "D. 為了提升團隊士氣，主管決定_____，舉辦了一場盛大的慶功宴。"],
        correctIndex: 0,
        explanation: "比喻為求速成而未顧及事物發展的客觀規律，反而把事情弄砸。"
    },
    {
        question: "【未雨綢繆】正確的用法是？",
        options: ["A. 氣象局發布了颱風警報，我們應該_____，提早準備好沙包和糧食。", "B. 事情都已經發展到這個無法挽回的地步了，你現在才來_____還有什麼用？", "C. 這場大雨下得又急又快，路上的行人紛紛_____，跑到屋簷下躲雨。", "D. 他做事總是_____，想到什麼就做什麼，完全沒有計畫。"],
        correctIndex: 0,
        explanation: "比喻事先做好準備工作，防患未然。"
    },
    {
        question: "【緣木求魚】正確的用法是？",
        options: ["A. 想要在沙漠裡找到豐富的地下水資源，簡直就是_____，根本不可能實現。", "B. 他爬到高高的樹上_____，希望能看到遠方歸來的船隻。", "C. 這家餐廳的招牌菜是_____，每天都有許多饕客慕名而來。", "D. 只要我們堅持不懈，即使是_____般困難的任務，也一定能完成。"],
        correctIndex: 0,
        explanation: "比喻方向、方法錯誤，必定勞而無功，徒勞無益。"
    },
    {
        question: "【望梅止渴】正確的用法是？",
        options: ["A. 在酷熱的沙漠中迷路，他們只能看著地圖上的綠洲_____，繼續艱難地前進。", "B. 這種特效藥一吃下去就能_____，讓他劇烈的頭痛瞬間消失了。", "C. 看到滿桌的豐盛佳餚，飢腸轆轆的他不禁_____，口水直流。", "D. 他為了買到那限量版的公仔，在烈日下排隊排得_____，差點暈倒。"],
        correctIndex: 0,
        explanation: "比喻用空想來安慰自己。"
    },
    {
        question: "【南轅北轍】正確的用法是？",
        options: ["A. 針對如何解決公司的財務危機，兩位董事提出的方案簡直是_____，完全無法達成共識。", "B. 兄弟兩人雖然分隔兩地，但他們的心卻是_____，常常透過視訊聊天。", "C. 經過幾個月的努力，這項計畫的目標和進度已經_____，完美契合。", "D. 這輛列車的行駛路線是_____，橫跨了整個國家的版圖。"],
        correctIndex: 0,
        explanation: "比喻行動和目的剛好相反；也比喻雙方意見、主張大相逕庭，完全不一致。"
    },
    {
        question: "【東施效顰】正確的用法是？",
        options: ["A. 這家小店_____，完全照抄對面知名咖啡廳的裝潢與菜單，卻因為服務極差而顯得十分可笑。", "B. 她為了在晚會上展現最完美的一面，特地去上了化妝課，把自己打扮得_____。", "C. 這位大師的畫作極具個人風格，許多學生都想_____，學習他的筆法。", "D. 聽到這個悲慘的故事，她忍不住_____，流下了同情的眼淚。"],
        correctIndex: 0,
        explanation: "比喻盲目模仿別人，不但模仿不好，反而出醜。"
    },
    {
        question: "【一曝十寒】正確的用法是？",
        options: ["A. 學習外語必須持之以恆，如果你總是_____，三天打魚兩天曬網，是永遠學不好的。", "B. 最近的天氣真是_____，昨天還穿短袖，今天就要穿羽絨衣了。", "C. 這位農夫非常勤勞，每天_____地在田裡工作，從來不喊累。", "D. 經過他_____的努力，終於在全國數學競賽中拿到了金牌。"],
        correctIndex: 0,
        explanation: "比喻做事沒有恆心，時而勤奮，時而懈怠。"
    },
    {
        question: "【邯鄲學步】正確的用法是？",
        options: ["A. 企業在轉型時若一味地模仿外國成功的模式，恐怕會_____，最後連自己原本的核心競爭力都喪失了。", "B. 剛滿一歲的小寶寶正在客廳裡_____，搖搖晃晃的模樣非常可愛。", "C. 這位舞蹈家融合了中西方的舞蹈元素，創造出_____的新舞步，驚豔全場。", "D. 他為了考上理想的大學，每天_____，日夜苦讀。"],
        correctIndex: 0,
        explanation: "比喻模仿別人不到家，反而把自己原有的長處也丟失了。"
    },
    {
        question: "【草木皆兵】正確的用法是？",
        options: ["A. 敵軍在經歷了幾次慘敗後，士氣低落，現在只要一聽到風吹草動就_____，驚恐萬分。", "B. 春天一到，山坡上_____，生機盎然，吸引了許多遊客前來賞花。", "C. 這位將軍治軍嚴明，手下的士兵個個訓練有素，在戰場上簡直是_____。", "D. 颱風過後，整個社區被吹得_____，滿地都是斷瓦殘垣。"],
        correctIndex: 0,
        explanation: "比喻人在極度驚恐或疑慮時，產生錯覺，神經極度緊張。"
    },
    {
        question: "【門可羅雀】正確的用法是？",
        options: ["A. 自從這家餐廳爆出嚴重的食安危機後，生意一落千丈，如今已是_____。", "B. 逢年過節，市中心的百貨公司裡總是_____，擠滿了前來購物的人潮。", "C. 他的演講非常精彩，台下觀眾_____，掌聲與歡呼聲不斷。", "D. 這棟古厝的雕刻精美，連門口的柱子都_____，極具藝術價值。"],
        correctIndex: 0,
        explanation: "比喻做官的人失勢後，賓客稀少；或形容門庭冷清、生意慘淡。"
    },
    {
        question: "【買櫝還珠】正確的用法是？",
        options: ["A. 他花了高價買下這幅名畫，卻只把精美的畫框掛在牆上，把畫作丟進儲藏室，真是_____！", "B. 在二手古董市場裡掏寶，必須要有_____的好眼力，才能用低價買到真品。", "C. 商家為了吸引顧客，經常推出_____的促銷活動，讓人忍不住掏出錢包。", "D. 這件珠寶的設計非常精緻，簡直是_____，讓所有在場的女士都為之瘋狂。"],
        correctIndex: 0,
        explanation: "比喻沒有眼光，取捨不當，只看重外表而忽略了事物的本質。"
    },
    {
        question: "【洛陽紙貴】正確的用法是？",
        options: ["A. 這位暢銷作家的最新奇幻小說一上市就引發搶購熱潮，甚至造成了_____的現象。", "B. 由於近期通貨膨脹嚴重，現在的民生物價簡直是_____，讓平民百姓苦不堪言。", "C. 這幅古代名畫在秋季拍賣會上以天價成交，可以說是_____，令人讚嘆。", "D. 他寫的文章內容空洞、邏輯混亂，完全不值一顧，簡直是_____。"],
        correctIndex: 0,
        explanation: "比喻著作受人歡迎，廣泛流傳，風行一時。"
    },
    {
        question: "【完璧歸趙】正確的用法是？",
        options: ["A. 經過警方的全力追查，這批被跨國集團盜走的博物館珍貴文物終於_____，回到了展示櫃中。", "B. 敵軍被打得落花流水，最後只好_____，交出所有武器舉白旗投降。", "C. 這位資深工匠將破碎的古董花瓶修補得完好如初，這項技藝簡直是_____。", "D. 他的身體在經過長達一年的調養後，終於_____，恢復了往日生龍活虎的模樣。"],
        correctIndex: 0,
        explanation: "比喻把原物完整無損地歸還給本人。"
    },
    {
        question: "【盲人摸象】正確的用法是？",
        options: ["A. 在處理複雜的國際經濟議題時，我們必須全面考量，不能_____，只看見問題的一小部分。", "B. 突然停電後，他在黑暗的房間裡_____，試圖找到手電筒的開關。", "C. 面對突如其來的公關危機，主管冷靜地分析局勢，展現出_____的卓越眼光。", "D. 他對待弱勢族群充滿同情心，經常舉辦慈善義賣活動，真可謂是_____。"],
        correctIndex: 0,
        explanation: "比喻只憑對事物的一部分了解，就妄下結論，未能掌握事物的全貌。"
    },
        {
        question: "【如魚得水】正確的用法是？",
        options: ["A. 他到了新的研發部門後簡直是_____，充分發揮了他在科技領域的專長。", "B. 這次無情的水災讓整個村莊的居民_____，紛紛爬上屋頂等待直升機救援。", "C. 他在商場上總是_____，為了個人利益可以隨時背叛多年的合作夥伴。", "D. 經過幾個月的魔鬼訓練，他現在游泳的速度已經_____，比以前快太多了。"],
        correctIndex: 0,
        explanation: "比喻得到跟自己十分投合的人，或是進入十分適合自己發揮的絕佳環境。"
    },
    {
        question: "【兔死狐悲】正確的用法是？",
        options: ["A. 看到與自己處境相似的同事被公司無情裁員，他不禁生出_____之感，擔心自己會是下一個。", "B. 這對雙胞胎兄弟從小感情極好，只要其中一人受傷，另一人也會_____，跟著大哭起來。", "C. 面對競爭對手的倒閉，他不僅沒有伸出援手，反而_____，趁機搶奪了對方的客戶。", "D. 這位老練的獵人設下陷阱，成功抓到了罕見的獵物，展現出_____的高超技巧。"],
        correctIndex: 0,
        explanation: "比喻因同類的不幸遭遇而感到悲傷與同情，有時也帶有對自身未來命運的擔憂。"
    },
    {
        question: "【鋌而走險】正確的用法是？",
        options: ["A. 為了籌措母親龐大的醫藥費，走投無路的他竟然_____，跑去搶劫了街角的便利商店。", "B. 這座深山裡的吊橋年久失修，他在上面走得_____，深怕一不小心就摔下深淵。", "C. 他不畏懼任何艱難，_____地攀登上了世界最高峰，創下了人類的新紀錄。", "D. 警方經過縝密的部署，終於讓這個跨國犯罪集團_____，將所有嫌犯一網打盡。"],
        correctIndex: 0,
        explanation: "比喻在無路可走或走投無路時，採取冒險的行動或做出違法的行為。"
    },
    {
        question: "【抱薪救火】正確的用法是？",
        options: ["A. 經濟不景氣時，政府如果不設法振興產業，反而大幅度加稅，這無疑是_____。", "B. 勇敢的消防隊員們在烈火中_____，奮不顧身地救出了受困在頂樓的居民。", "C. 朋友遭遇低潮時，他總是能適時地給予安慰與實質幫助，絕對不會做出_____的行為。", "D. 為了趕緊把森林大火撲滅，全村居民紛紛提著水桶_____，終於控制了災情。"],
        correctIndex: 0,
        explanation: "比喻用錯誤的方法去消除災禍，結果不但無法解決問題，反而使災禍擴大。"
    },
    {
        question: "【勢如破竹】正確的用法是？",
        options: ["A. 公司的女子籃球隊在這次聯賽中_____，連贏十場，順利奪下全國總冠軍。", "B. 這場夏季暴風雨來得_____，瞬間就將路旁的行道樹連根拔起，造成嚴重災情。", "C. 他只要一發脾氣就會_____，把桌上的文件和水杯全掃到地上，讓人不敢靠近。", "D. 由於缺乏資金和專業人才，這項新計畫的推動過程_____，進展十分緩慢。"],
        correctIndex: 0,
        explanation: "比喻作戰或工作節節勝利，毫無阻礙。"
    },
    {
        question: "【欲蓋彌彰】正確的用法是？",
        options: ["A. 他越是急著向大家解釋自己沒有收賄，越是顯得_____，反而引起了檢調單位的深度懷疑。", "B. 這篇評論文章的觀點非常銳利，_____地指出了當前社會福利制度的重大缺失。", "C. 為了讓這幅油畫看起來更完美，他不斷地在背景塗抹修改，最後卻是_____，破壞了原本的美感。", "D. 警方經過長達半年的縝密調查，終於讓這起懸案_____，將潛逃在外的真兇繩之以法。"],
        correctIndex: 0,
        explanation: "想要掩蓋壞事，結果反而暴露得更加明顯。"
    },
    {
        question: "【螳臂當車】正確的用法是？",
        options: ["A. 這家剛成立的小型本土企業想要挑戰跨國集團的市場壟斷地位，在業界看來簡直是_____。", "B. 面對失控衝向人群的卡車，他_____地推開了路旁的小孩，自己卻受了重傷。", "C. 這位重量級拳王在擂台上_____，連續擊敗了五位挑戰者，順利衛冕冠軍寶座。", "D. 經過連夜的奮戰，這群工程師終於發揮了_____的精神，修復了整個國家的網路系統。"],
        correctIndex: 0,
        explanation: "比喻不自量力，企圖阻擋無法抗拒的強大力量，注定會失敗。"
    },
    {
        question: "【喧賓奪主】正確的用法是？",
        options: ["A. 電影中那位配角的演技實在太過出色，甚至到了_____的地步，讓觀眾幾乎忘了男主角的存在。", "B. 在這場盛大的婚宴上，伴郎們熱情地穿梭在各桌之間招待客人，善盡了_____的責任。", "C. 這家知名網美餐廳的裝潢極其華麗，但餐點菜色卻非常普通，真可說是_____。", "D. 兩家科技公司的談判代表在會議桌上_____，為了各自的專利利益爭論不休。"],
        correctIndex: 0,
        explanation: "比喻次要的事物佔據了主要事物的位置，或是外來勢力奪取了原本主導者的地位。"
    },
    {
        question: "【揚湯止沸】正確的用法是？",
        options: ["A. 面對日益嚴重的交通壅塞問題，單靠增加違規罰款只是_____，唯有建立完善的大眾運輸系統才是根本之道。", "B. 國宴即將開始，主廚在廚房裡忙得_____，連喝口水的時間都沒有。", "C. 他的競選演講極具煽動力，讓台下的支持者情緒激昂，現場氣氛如_____般熱烈。", "D. 為了徹底消滅敵軍的勢力，將軍決定採取_____的策略，直接派兵切斷對方的糧草補給線。"],
        correctIndex: 0,
        explanation: "比喻治標不治本，無法從根本上解決問題。"
    },
    {
        question: "【黔驢技窮】正確的用法是？",
        options: ["A. 詐騙集團的各種招數早就被警方一一識破，如今他們已經_____，只能乖乖在藏匿處束手就擒。", "B. 這位街頭魔術師的表演花樣百出，讓圍觀的民眾看得_____，拍手叫好。", "C. 面對考卷上艱澀的幾何難題，他絞盡腦汁卻依然_____，半小時過去了還是一題也寫不出來。", "D. 他的口才極佳，邏輯清晰，在辯論台上總是能把對手逼得_____，完全無力反擊。"],
        correctIndex: 0,
        explanation: "比喻人拙劣的本領或計謀已經用盡，再也無計可施了。"
    },
    {
        question: "【罄竹難書】正確的用法是？",
        options: ["A. 那位殘酷的獨裁者在位期間，迫害百姓的暴行簡直是_____，歷史會永遠記下他的罪惡。", "B. 這位慈善家一生致力於偏鄉教育，對社會的貢獻與好人好事多到_____。", "C. 這位歷史學家家裡收藏了無數珍貴的古籍，藏書量之大可以說是_____。", "D. 國家公園裡的自然景觀極美，各種奇花異草令人目不暇給，風景_____。"],
        correctIndex: 0,
        explanation: "比喻罪狀極多，寫也寫不完。（極易錯重點：只能用來形容罪惡極多，不能用來形容好人好事）"
    },
    {
        question: "【望洋興嘆】正確的用法是？",
        options: ["A. 面對如此龐大且複雜的程式原始碼，完全沒有資工背景的他只能_____，不知從何下手。", "B. 站在玉山山頂，看著壯闊的雲海與日出，他不禁_____，讚嘆大自然的鬼斧神工。", "C. 經過多年的努力，他終於在國際音樂大賽中_____，取得了空前的成就。", "D. 他這篇文章寫得極好，文采飛揚，讓人讀了_____，久久無法忘懷。"],
        correctIndex: 0,
        explanation: "比喻因力量不夠或缺乏條件，而感到無可奈何。"
    },
    {
        question: "【飲鴆止渴】正確的用法是？",
        options: ["A. 公司出現嚴重財務虧損時，竟然去借高利貸來發放年終獎金，這無疑是_____，遲早會面臨破產。", "B. 在沙漠中迷路了三天，他終於找到了一灘綠洲，立刻_____地大口喝起水來。", "C. 為了讓這個產品迅速上市，團隊決定_____，從根本上解決了所有的設計缺陷。", "D. 面對惡劣的工作環境與不合理的規定，他決定_____，直接向董事長提出改革方案。"],
        correctIndex: 0,
        explanation: "比喻只求解決眼前的困難，而不顧將來極大的禍患。"
    },
    {
        question: "【投鼠忌器】正確的用法是？",
        options: ["A. 警方雖然知道歹徒就躲在屋內，但因為裡面有幾名人質，只能_____，不敢貿然攻堅。", "B. 面對強大的競爭對手，我們不能_____，必須主動出擊才能贏得市場。", "C. 為了消滅家裡的蟑螂，他不惜_____，把整個廚房噴滿了劇毒殺蟲劑，結果差點害家人中毒。", "D. 這位主管在處理員工糾紛時總是_____，偏袒自己的親戚，讓其他員工非常不滿。"],
        correctIndex: 0,
        explanation: "比喻想要打擊壞人，卻又有所顧忌，不敢放手去做。"
    },
    {
        question: "【殺雞取卵】正確的用法是？",
        options: ["A. 為了眼前短暫的龐大利益而將百年原始林全數砍伐，這種_____的做法將會帶來嚴重的生態浩劫。", "B. 廚房裡的學徒經過多年的磨練，如今已經可以_____，獨立負責整場宴席的菜色了。", "C. 雖然這次投資失敗損失慘重，但只要我們不放棄，總有_____、重新站起來的一天。", "D. 面對市場上對手惡意的削價競爭，我們應該_____，降低成本來應對。"],
        correctIndex: 0,
        explanation: "比喻貪圖眼前微小的利益，而損害了長遠的大利益。"
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
    

];
const grammarData = [{ question: "修正：「由於暴雨，使到發生水浸。」", options: ["A. 刪去「由於」或「使到」", "B. 「發生」不能配「水浸」", "C. 「嚴重」和「水浸」重複", "D. 「暴雨」不會導致「水浸」"], correctIndex: 0, explanation: "濫用介詞導致無主語。" }]; 
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
