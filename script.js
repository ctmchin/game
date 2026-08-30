const firebaseConfig = { apiKey: "AIzaSyBXTjkrXmiLhp64MSBU1Ai5Iiv1EJfwA3I", authDomain: "ctm-game.firebaseapp.com", projectId: "ctm-game", storageBucket: "ctm-game.firebasestorage.app", messagingSenderId: "204941638255", appId: "1:204941638255:web:f23470bb681e9dac6eeb9a" };
let currentUser = null; let memos = []; let userScore = 0; let userCoins = 0; let weeklyScore = 0; let db = null;
let userEmojis = []; let equippedEmoji = ""; let userItems = []; let userBags = []; // 🎒 新增虛擬書包

function getWeekNumber(d) { d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7)); var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1)); return Math.ceil((((d - yearStart) / 86400000) + 1)/7); }

try { firebase.initializeApp(firebaseConfig); db = firebase.firestore(); 
    firebase.auth().onAuthStateChanged((user) => {
        if (user) { const role = (user.email === 'ctmlwsss@gmail.com') ? 'teacher' : 'student'; handleLoginSuccess({ displayName: user.displayName, email: user.email, uid: user.uid, role: role }); } 
        else { checkManualLogin(); }
    });
} catch (error) { checkManualLogin(); }

function checkManualLogin() { const saved = sessionStorage.getItem('manualUser'); if (saved) { handleLoginSuccess(JSON.parse(saved)); } }
function loginWithGoogle() { try { const provider = new firebase.auth.GoogleAuthProvider(); firebase.auth().languageCode = 'zh-HK'; firebase.auth().signInWithPopup(provider).catch((e) => alert("登入失敗")); } catch (e) { alert("請使用手動登入！"); } }
function loginManually() { const username = document.getElementById('username-input').value.trim(); if (username !== "") { const role = (username === 'admin') ? 'teacher' : 'student'; const nameDisplay = (role === 'teacher') ? "CTM 老師" : username; const userObj = { displayName: nameDisplay, email: username+"@local", uid: username, role: role }; sessionStorage.setItem('manualUser', JSON.stringify(userObj)); handleLoginSuccess(userObj); } else { alert("請輸入學號！"); } }

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
    loadMemos(user.uid); renderQuizzes(); initMatchGame(); initBossGame(); loadSocialDataFromCloud(); loadLeaderboard(); nextArticle(); setupSandbox();
}

function logout() { try { firebase.auth().signOut(); } catch(e) {} sessionStorage.removeItem('manualUser'); window.location.reload(); }
function toggleSidebar() { document.querySelector('.sidebar').classList.toggle('open'); document.getElementById('sidebar-overlay').classList.toggle('active'); }
function switchTab(tabId, event) { document.querySelectorAll('.module').forEach(mod => mod.classList.remove('active')); document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active')); const target = document.getElementById(tabId); if(target) target.classList.add('active'); if(event) event.target.classList.add('active'); if(window.innerWidth <= 768) { document.querySelector('.sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('active'); } if(tabId === 'feature-reading') startReadingTimer(); }

// 🌟 指數型升級系統 (Exp = 50 * lv^2) 🌟
function getPetInfo(score) {
    // 例如：100分=1級, 450分=3級, 1250分=5級, 120050分=49級...
    let lv = Math.floor(Math.sqrt(score / 50)) + 1;
    if (lv > 99) lv = 99;
    
    let emoji = '🌱', name = '文字種子';
    if(lv >= 10) { emoji = '🌿'; name = '閱讀青苗'; }
    if(lv >= 20) { emoji = '📚'; name = '篇章行者'; }
    if(lv >= 30) { emoji = '✍️'; name = '寫作小將'; }
    if(lv >= 40) { emoji = '🖋️'; name = '修辭精靈'; }
    if(lv >= 50) { emoji = '🦄'; name = '文學神獸'; }
    if(lv >= 60) { emoji = '🐉'; name = '散文飛龍'; }
    if(lv >= 70) { emoji = '🎓'; name = '詩詞宗師'; }
    if(lv >= 80) { emoji = '📜'; name = '國學大師'; }
    if(lv >= 90) { emoji = '🌌'; name = '中文宇宙霸主'; }
    return { lv, name, emoji };
}

function addPoints(points) { if(currentUser.role === 'teacher') return; userScore += points; userCoins += points; weeklyScore += points; if(db) db.collection('users').doc(currentUser.uid).update({ score: userScore, coins: userCoins, weeklyScore: weeklyScore }); updateScoreUI(); }
function deductCoins(amount) { if(currentUser.role === 'teacher') return true; if(userCoins < amount) return false; userCoins -= amount; if(db) db.collection('users').doc(currentUser.uid).update({ coins: userCoins }); updateScoreUI(); return true; }
function updateScoreUI() { 
    document.getElementById('score').innerText = userScore; document.getElementById('coins').innerText = userCoins;
    const pet = getPetInfo(userScore); const levelText = `${pet.name} (Lv.${pet.lv})`; 
    document.getElementById('pet-avatar').innerText = pet.emoji; document.getElementById('pet-level').innerText = levelText; 
    const bigPet = document.getElementById('big-pet-emoji'); if(bigPet) { bigPet.innerText = pet.emoji; document.getElementById('big-pet-name').innerText = levelText; } 
    const displayNameWithEmoji = (equippedEmoji ? equippedEmoji + " " : "") + currentUser.displayName;
    document.getElementById('user-display-name').innerText = displayNameWithEmoji;
}

let pendingSelectedText = ""; const mobileBar = document.getElementById('mobile-highlight-bar');
document.addEventListener('selectionchange', function() { const selection = window.getSelection(); const selectedStr = selection.toString().trim(); if (selectedStr.length > 0 && document.getElementById('article-content').contains(selection.getRangeAt(0).commonAncestorContainer.nodeType===3?selection.getRangeAt(0).commonAncestorContainer.parentNode:selection.getRangeAt(0).commonAncestorContainer)) { pendingSelectedText = selectedStr; document.getElementById('highlight-text-preview').innerText = selectedStr.length > 15 ? selectedStr.substring(0, 8) + " ... " + selectedStr.substring(selectedStr.length - 4) : selectedStr; mobileBar.classList.remove('hidden'); } else { mobileBar.classList.add('hidden'); } });
function confirmSaveHighlight() { if (pendingSelectedText.length > 0) { memos.unshift({ content: pendingSelectedText, time: new Date().toLocaleString() }); updateMemoUI(); localStorage.setItem(`memos_${currentUser.uid}`, JSON.stringify(memos)); alert("🖍️ 重點已收藏！"); window.getSelection().removeAllRanges(); mobileBar.classList.add('hidden'); } }
function closeHighlightBar() { mobileBar.classList.add('hidden'); pendingSelectedText = ""; }
function addManualMemo() { const input = document.getElementById('manual-memo-input'); const text = input.value.trim(); if(text !== "") { memos.unshift({ content: text, time: new Date().toLocaleString() }); updateMemoUI(); localStorage.setItem(`memos_${currentUser.uid}`, JSON.stringify(memos)); input.value = ""; alert("儲存成功！"); } }
function updateMemoUI() { const list = document.getElementById('memo-list'); if (memos.length === 0) { list.innerHTML = '<p style="color: #888; text-align: center;">暫無筆記</p>'; return; } list.innerHTML = memos.map(m => `<div class="memo-item"><p>${m.content}</p><div class="memo-time">${m.time}</div></div>`).join(''); }
function loadMemos(uid) { const saved = localStorage.getItem(`memos_${uid}`); memos = saved ? JSON.parse(saved) : []; updateMemoUI(); }

// 🌟 閱讀庫擴充 🌟
let readingTimer; let readingTime = 0; let dailyReadPoints = 0;
const articles = [
    { title: "《秋天的懷念》 (史鐵生)", text: "雙腿癱瘓後，我的脾氣變得暴怒無常。望著望著天上北歸的雁陣，我會突然把面前的玻璃砸碎；聽著聽著李谷一甜美的歌聲，我會猛地把手邊的東西摔向四周的牆壁。母親就悄悄地躲出去，在我看不見的地方偷偷地聽著我的動靜。當一切恢復沉寂，她又悄悄地進來，眼邊紅紅的，看著我。<br><br>「聽說北海的花兒都開了，我推著你去走走。」她總是這麼說。母親喜歡花，可自從我的腿癱瘓後，她侍弄的那些花都死了。「不，我不去！」我狠命地捶打這兩條可恨的腿，喊著：「我活著有什麼勁！」母親撲過來抓住我的手，忍住哭聲說：「咱娘兒倆在一塊兒，好好兒活，好好兒活……」<br><br>可我卻一直都不知道，她的病已經到了那步田地。後來妹妹告訴我，她常常肝疼得整宿整宿翻來覆去地睡不了覺。<br><br>那天我又獨自坐在屋裡，看著窗外的樹葉「唰唰啦啦」地飄落。母親進來了，擋在窗前：「北海的菊花開了，我推著你去看看吧。」她憔悴的臉上現出央求般的神色。「什麼時候？」「你要是願意，就明天?」她說。我的回答已經讓她喜出望外了。「好吧，就明天。」我說。她高興得一會兒坐下，一會兒站起：「那就趕緊準備準備。」「哎呀，煩不煩？幾步路，有什麼好準備的！」她也笑了，坐在我身邊，絮絮叨叨地說著：「看完菊花，咱們就去『仿膳』，你小時候最愛吃那兒的豌豆黃兒。還記得那回我帶你去北海嗎？你偏說那楊樹花是毛毛蟲，跑著，一腳踩扁一個……」她忽然不說了。對於「跑」和「踩」一類的字眼兒，她比我還敏感。她又悄悄地出去了。<br><br>她出去了，就再也沒回來。鄰居們把她抬上車時，她還在大口大口地吐著鮮血。我沒想到她已經病成那樣。看著三輪車遠去，也絕沒有想到那竟是永遠的訣別。<br><br>鄰居的小伙子背著我去看她的時候，她正艱難地呼吸著，像她那一生艱難的生活。別人告訴我，她昏迷前的最後一句話是：「我那個有病的兒子和我那個還未成年的女兒……」<br><br>又是秋天，妹妹推著我去北海看了菊花。黃色的花淡雅，白色的花高潔，紫紅色的花熱烈而深沉，潑潑灑灑，秋風中正開得爛漫。我懂得母親沒有說完的話。妹妹也懂。我倆在一塊兒，要好好兒活……" },
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
        if(readingTime >= 30) { clearInterval(readingTimer); btn.disabled = false; btn.style.background = "#4caf50"; btn.innerText = "💰 領取 10 積分/金幣"; } 
        else { btn.innerText = `⏳ 閱讀中... (${30 - readingTime}s)`; }
    }, 1000);
}

function claimReadingPoints() {
    addPoints(10); dailyReadPoints += 10;
    localStorage.setItem(`readPoints_${currentUser.uid}_${new Date().toLocaleDateString()}`, dailyReadPoints);
    const btn = document.getElementById('btn-claim-reading');
    btn.disabled = true; btn.style.background = "#ccc"; btn.innerText = "✅ 已領取！請換下一篇";
}

// ========================================================
// 靜態題庫引擎 (加入完成提示與引號)
// ========================================================
const idiomsData = [{ question: "【炙手可熱】正確的用法是？", options: ["A. 外面炙手可熱", "B. 手機炙手可熱", "C. 門票炙手可熱", "D. 丞相炙手可熱"], correctIndex: 3, explanation: "比喻權勢大，貶義。" }]; 
const grammarData = [{ question: "修正：「由於暴雨，使到發生水浸。」", options: ["A. 刪去「由於」或「使到」", "B. 「發生」不能配「水浸」", "C. 「嚴重」和「水浸」重複", "D. 「暴雨」不會導致「水浸」"], correctIndex: 0, explanation: "濫用介詞導致無主語。" }]; 
const typoData = [{ question: "錯別字：「他為了這件鎖事，大動干戈。」", options: ["A. 鎖 ➔ 瑣", "B. 戈 ➔ 哥", "C. 竟 ➔ 競", "D. 無錯"], correctIndex: 0, explanation: "「瑣事」才對。" }]; 

const memeData = [{ emoji: "🤦‍♂️", question: "朋友半途而廢，配哪句最適合？", options: ["A. 朽木不可雕也", "B. 燕雀安知鴻鵠之志", "C. 溫故而知新", "D. 己所不欲勿施於人"], correctIndex: 0, explanation: "比喻無可救藥。" }, { emoji: "🙄", question: "遇到無法溝通的人，配哪句最適合？", options: ["A. 醉翁之意不在酒", "B. 夏蟲不可以語冰", "C. 項莊舞劍", "D. 司馬昭之心"], correctIndex: 1, explanation: "比喻人見識短淺。" }]; 
const ancientModernData = [{ question: "「其實味不同」中「其實」意思？", options: ["A. 實際上", "B. 它的果實", "C. 道理", "D. 實在"], correctIndex: 1, explanation: "其：它的，實：果實。" }, { question: "「犧牲玉帛」中「犧牲」意思？", options: ["A. 放棄生命", "B. 祭祀用的牲畜", "C. 浪費資源", "D. 無私奉獻"], correctIndex: 1, explanation: "古代專指祭祀用品。" }]; 

// 🌟 寫作思維 DSE 加長版 🌟
const themeData = [
    { question: "DSE 題目《微笑以對》。以下哪一個寫作立意最深刻、最容易奪得星級分數？", options: ["A. 描述自己在一次校際比賽中過度緊張而忘詞，雖然在台上感到無地自容，但為了不讓台下的父母擔心，最後決定勉強擠出一個微笑，掩飾自己的悲傷。", "B. 記述一次準備研習時電腦死機，當刻徬徨無助。但想起老師說過微笑能解決所有問題，於是我們對著螢幕微笑，結果奇蹟地找回了檔案，說明微笑是萬能的。", "C. 經歷人生重大挫折（如夢想破滅）後，經過長時間的反思，內心真正釋懷。不再執著於一時得失，學會以豁達、包容的微笑去面對未來的無常。", "D. 描述某天早晨在趕巴士的路上，不小心撞到了陌生人。原本以為對方會破口大罵，沒想到對方竟然對我微笑，所以我決定每天對身邊的同學微笑。"], correctIndex: 2, explanation: "寫作忌諱套路與膚淺。C 選項將具體的『微笑動作』昇華為『豁達的人生態度』，立意最高。" },
    { question: "DSE 題目《一場誤會》。以下哪一個寫作立意最能帶出深刻的反思？", options: ["A. 誤會同學偷了我的筆，後來發現是自己掉在床底，從此知道不能隨便亂怪別人，要先查清楚。", "B. 誤會媽媽偏心弟弟，把好東西都留給他，後來得知她用心良苦，學會了體諒家人的辛勞與溝通的重要。", "C. 買東西找錯錢產生誤會，與店員大吵一架，後來店員道歉，說明做人要誠實且不能貪小便宜。", "D. 因社會刻板印象而對某新移民同學產生誤會，深入了解後打破偏見，反思社會標籤的禍害與包容的重要。"], correctIndex: 3, explanation: "D 將個人小事昇華為社會層面的反思，展現考生的宏觀視野。" }
]; 
const materialData = [
    { question: "題目《重遊舊地所見有感》，你想表達「物是人非的唏噓」。以下哪個建議素材最切合？", options: ["A. 描寫小時候經常流連的公園，如今遊樂設施全部翻新了。生鏽的鞦韆換成了繽紛的滑梯，變得比以前更漂亮、更好玩。", "B. 回到鄉下的祖屋，雖然空置多年，但自然風景美麗如畫。屋後的果樹結滿了果實，清澈的小溪依然潺潺流動，回憶湧現。", "C. 原本充滿人情味的舊式士多已被連鎖店取代。昔日老闆親切的問候已不復見，取而代之的是冷冰冰的自動收銀機。", "D. 描寫回到母校參加校慶，在走廊巧遇多年不見的小學同學和班主任。大家開心地敘舊，彷彿一切都沒有改變。"], correctIndex: 2, explanation: "要寫出『唏噓』，必須有強烈的今昔對比與失落感。C 選項的冷暖對比最能觸動人心。" }
]; 
const logicData = [
    { question: "論點：「逆境能激發人的潛能」。論據：「司馬遷受宮刑而作《史記》」。以下哪段論證邏輯最嚴密？", options: ["A. 司馬遷遭遇了極大的身心摧殘，但他將這份屈辱轉化為寫作動力，在絕境中爆發出驚人的毅力，這正正證明了逆境能激發無窮潛能。", "B. 司馬遷是中國歷史上最偉大的史學家之一，他寫的《史記》流傳千古。我們也應該學習他在遇到困難時多讀古書，才能取得成功。", "C. 如果司馬遷當年沒有受到殘酷的宮刑，過著安逸的生活，就絕對不可能寫出《史記》。可見每個人都必須經歷巨大痛苦才能立足。", "D. 司馬遷雖然遭遇了常人難以忍受的不幸，但他依然熱愛生活。他的故事告訴我們即使在逆境中也要保持心情愉快，潛能就會激發。"], correctIndex: 0, explanation: "論證必須像橋樑一樣連接『論點』和『論據』。A 選項完美解釋了『宮刑(逆境)』如何轉化為『動力(激發潛能)』。" }
];

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
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const q = dataArray[dayOfYear % dataArray.length];
    const memeHtml = isMeme && q.emoji ? `<div style="font-size: 4rem; text-align: center; margin-bottom: 10px;">${q.emoji}</div>` : ''; 
    container.innerHTML = `<div class="card" style="margin-bottom: 20px;">${memeHtml}<p class="question"><strong>📅 今日挑戰：</strong>${q.question}</p><div class="options">${q.options.map((opt, i) => `<button class="btn-option" onclick="checkStaticAnswer(this, ${i}, ${q.correctIndex}, '${q.explanation}', '${type}', false, '${q.question.substring(0,20)}')">${opt}</button>`).join('')}</div><div class="feedback hidden" style="margin-top:15px;"></div></div>`; 
}

function renderInfiniteQuiz(containerId, dataArray, type = 'normal', isMeme = false) {
    const container = document.getElementById(containerId); if(!container) return;
    const qIndex = Math.floor(Math.random() * dataArray.length);
    const q = dataArray[qIndex];
    const memeHtml = isMeme && q.emoji ? `<div style="font-size: 4rem; text-align: center; margin-bottom: 10px;">${q.emoji}</div>` : ''; 
    container.innerHTML = `<div class="card" style="margin-bottom: 20px;">${memeHtml}<p class="question">${q.question}</p><div class="options">${q.options.map((opt, i) => `<button class="btn-option" style="line-height:1.6;" onclick="checkStaticAnswer(this, ${i}, ${q.correctIndex}, '${q.explanation}', '${type}', true, '${q.question.substring(0,20)}')">${opt}</button>`).join('')}</div><div class="feedback hidden" style="margin-top:15px;"></div></div>`; 
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
    const nextBtnHtml = isInfinite ? `<br><br><button class="btn-primary" onclick="renderQuizzes()">下一題 ➔</button>` : `<br><br><div style="padding:10px; background:#e3f2fd; color:#1976d2; border-radius:8px; text-align:center;">✅ 已經完成今天本部分任務，請明天再來！</div>`;

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
const readingQuestions = { 1: { level: "🌱 基礎", q: "「徐以杓酌油」的「徐」是？", opts: ["A. 慢慢", "B. 快速", "C. 姓氏"], correct: 0, exp: "解作慢慢地。" }, 2: { level: "🌲 進階", q: "為何錢放葫蘆口？", opts: ["A. 炫耀", "B. 展示技術", "C. 洗錢"], correct: 1, exp: "證明熟能生巧。" }, 3: { level: "🔥 挑戰", q: "賣油翁崇拜陳？", opts: ["A. 對", "B. 錯", "C. 無法判斷"], correct: 1, exp: "他只覺得是手熟。" } }; function loadReadingQuiz(level) { const container = document.getElementById('reading-quiz-container'); const q = readingQuestions[level]; container.innerHTML = `<div style="background: #fff; padding: 20px; border-radius: 8px; border: 2px solid #1976d2;"><p style="color: #1976d2; font-weight: bold; margin-bottom: 10px;">${q.level}</p><p class="question">${q.q}</p><div class="options">${q.opts.map((opt, i) => `<button class="btn-option" style="padding: 10px;" onclick="checkReadingAnswer(this, ${i}, ${q.correct}, '${q.exp}')">${opt}</button>`).join('')}</div><div class="reading-feedback hidden" style="margin-top:15px; font-weight:bold;"></div></div>`; } function checkReadingAnswer(btn, clicked, correct, exp) { const parent = btn.parentElement; const feedback = parent.nextElementSibling; parent.querySelectorAll('.btn-option').forEach(b => b.disabled = true); feedback.classList.remove('hidden'); if(clicked === correct) { btn.style.backgroundColor = '#d4edda'; btn.style.borderColor = '#28a745'; feedback.style.color = '#155724'; feedback.innerHTML = `🎉 答對！解析：${exp} (+15分)`; addPoints(15); } else { btn.style.backgroundColor = '#f8d7da'; btn.style.borderColor = '#dc3545'; feedback.style.color = '#721c24'; feedback.innerHTML = `❌ 答錯！解析：${exp}`; } }

// 🌟 沙盒與社群 🌟
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
        aiWall.innerHTML = socialData['11'].map(item => `
            <div style="width: 45%; min-width:250px; background: #fff; padding: 10px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                <img src="${item.imgUrl}" style="width: 100%; border-radius: 8px; margin-bottom: 10px;">
                <p style="font-size: 0.9rem; color: #555; margin-bottom: 5px;">"${item.text}"</p>
                <div style="font-size: 0.8rem; color: #888; display:flex; justify-content:space-between;">
                    <span>✍️ ${item.nameEmoji || ""}${item.name}</span>
                    <span style="cursor:pointer;" onclick="likePost('11', '${item.docId}', '${item.authorUid}', ${item.likes || 0})">❤️ ${item.likes || 0}</span>
                </div>
            </div>
        `).join('');
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

// 🌟 文具背包與抽卡系統 🌟
function drawGacha() { 
    if(!deductCoins(500)) return alert("💰 金幣不足 500 枚！"); 
    const res = document.getElementById('gacha-result'); 
    res.classList.remove('hidden'); res.className = 'feedback info'; res.innerHTML = "🎲 盲盒開啟中..."; 
    
    setTimeout(() => { 
        let r = Math.random() * 100; let card = ""; let color = ""; let isItem = true; let isBag = false;
        if (r < 1) { card = "【R級極罕】抵消現場紅牌 🛑"; color = "#d32f2f"; } 
        else if (r < 2) { card = "【R級極罕】獲綠色牌(與老師打球) 🍀"; color = "#4caf50"; } 
        else if (r < 5) { card = "【S級稀有】自選座位一天 🎵"; color = "#9c27b0"; } 
        else if (r < 10) { card = "【A 級】免答問題一次 🤫"; color = "#ff9800"; } 
        else if (r < 15) { card = "【A 級】小懲罰豁免權 🛡️"; color = "#2196f3"; } 
        else if (r < 55) { 
            isItem = false; isBag = true;
            const bags = ["🔴紅書包", "🔵藍書包", "⚫黑書包", "📘課本", "📓筆記本", "💧水瓶", "🖊️黑筆", "🖍️紅筆", "✏️鉛筆", "📼塗改帶", "📏尺子", "🖍️熒光筆"];
            const gotBag = bags[Math.floor(Math.random() * bags.length)];
            card = `【B 級】背包文具裝備：${gotBag}`; color = "#00796b";
            if(!userBags.includes(gotBag)) { userBags.push(gotBag); if(db && currentUser.role !== 'teacher') db.collection('users').doc(currentUser.uid).update({ bags: userBags }); }
        }
        else { 
            isItem = false;
            const emojis = ["😎", "👻", "🔥", "✨", "👑", "👽", "💩", "🦄", "🐼", "🚀", "🌟"];
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
    
    // 渲染文具背包
    const bagList = document.getElementById('my-bag-list');
    if(userBags.length === 0) { bagList.innerHTML = "<p style='font-size:1rem; color:#888;'>你的書包還是空的，快去抽卡吧！</p>"; }
    else { bagList.innerHTML = userBags.map(b => `<span style="background:#fff; border-radius:8px; padding:5px 10px; border:1px solid #ccc;">${b}</span>`).join(''); }

    const itemList = document.getElementById('my-items-list');
    if(userItems.length === 0) { itemList.innerHTML = "<p style='color:#888;'>尚未獲得道具卡。</p>"; } 
    else { itemList.innerHTML = userItems.map((item, index) => `<div style="background:#fff; border:1px solid #ccc; padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;"><span style="font-weight:bold;">${item}</span><button style="background:#dc3545; color:white; border:none; padding:5px 15px; border-radius:5px; cursor:pointer;" onclick="redeemItem(${index}, '${item}')">核銷</button></div>`).join(''); }

    const emojiList = document.getElementById('my-emoji-list'); document.getElementById('current-equipped-emoji').innerText = equippedEmoji || "無";
    if(userEmojis.length === 0) { emojiList.innerHTML = "<p style='font-size:1rem; color:#888;'>尚未收集到稱號。</p>"; } 
    else { emojiList.innerHTML = userEmojis.map(e => `<span onclick="equipEmoji('${e}')" style="display:inline-block; border: 3px solid ${e === equippedEmoji ? '#d32f2f' : 'transparent'}; border-radius:12px; padding:8px; transition:0.2s; background:${e === equippedEmoji ? '#ffebee' : 'transparent'};">${e}</span>`).join(''); }
}

function equipEmoji(emojiToEquip) { equippedEmoji = (equippedEmoji === emojiToEquip) ? "" : emojiToEquip; if(db && currentUser.role !== 'teacher') db.collection('users').doc(currentUser.uid).update({ equippedEmoji: equippedEmoji }); updateScoreUI(); renderInventory(); }
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
