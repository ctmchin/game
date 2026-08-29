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
// 4. 動態題庫引擎 (第 1 批：20 條高質量 DSE 題庫)
// ========================================================

const idiomsData = [
    {
        question: "【屢試不爽】請判斷以下哪一個句子正確使用了此成語？",
        options: [
            "A. 他參加了多次駕駛考試，結果屢試不爽，至今還沒拿到駕照。",
            "B. 這個治感冒的偏方我用過很多次，真的是屢試不爽，非常見效。",
            "C. 這道數學題太難了，我屢試不爽，最後只好請教老師。",
            "D. 雖然他屢試不爽，但他依然沒有放棄，堅持繼續嘗試。"
        ],
        correctIndex: 1,
        explanation: "✅ 正確！【屢試不爽】的「爽」是「差錯」的意思。全句意為「屢次試驗都沒有差錯（每次都成功）」。常被學生誤以為是「每次都失敗/不爽」。"
    },
    {
        question: "【曾幾何時】請判斷以下哪一個句子正確使用了此成語？",
        options: [
            "A. 曾幾何時，森林裡住著一隻可愛的小兔子和一隻大灰狼。",
            "B. 我已經不記得曾幾何時去過這家餐廳了，印象很模糊。",
            "C. 曾幾何時，這裡還是一片荒蕪的農田，現在卻成了繁華的商業區。",
            "D. 曾幾何時，我一定會努力賺錢，帶父母去環遊世界。"
        ],
        correctIndex: 2,
        explanation: "✅ 正確！【曾幾何時】意思是「才過了沒多少時間」。常被學生當作童話故事的開場白「很久很久以前」或「不知什麼時候」來誤用。"
    },
    {
        question: "【始作俑者】請判斷以下哪一個句子正確使用了此成語？",
        options: [
            "A. 他是這項環保活動的始作俑者，帶動了全校同學的參與。",
            "B. 這位科學家是人工智能領域的始作俑者，貢獻極大。",
            "C. 這次班級作弊風氣的始作俑者，已經被訓導主任記過處分。",
            "D. 作為這本暢銷小說的始作俑者，作家獲得了年度文學大獎。"
        ],
        correctIndex: 2,
        explanation: "✅ 正確！【始作俑者】比喻「首先做某件壞事的人」，是帶有強烈貶義的成語。不可用來稱讚發明家或帶頭做善事的人。"
    },
    {
        question: "【莘莘學子】請判斷以下哪一個句子正確使用了此成語？",
        options: [
            "A. 為了準備文憑試，這位莘莘學子每天都溫習到深夜。",
            "B. 只要你是莘莘學子，就應該遵守學校的校規。",
            "C. 大學開放日吸引了眾多莘莘學子前來參觀校園。",
            "D. 他是一位非常勤奮的莘莘學子，成績總是名列前茅。"
        ],
        correctIndex: 2,
        explanation: "✅ 正確！【莘莘學子】的「莘莘」是眾多的意思。它是一個「集合名詞」，指「眾多學生」。所以前面不能加「一位」、「這位」，選項 A、B、D 犯了量詞衝突的錯誤。"
    },
    {
        question: "【侃侃而談】請判斷以下哪一個句子正確使用了此成語？",
        options: [
            "A. 在面試中，他面對主考官的提問侃侃而談，展現了無比的自信。",
            "B. 上課時，這兩個同學在座位上侃侃而談，完全沒在聽老師講課。",
            "C. 下午茶時間，幾個好朋友聚在一起侃侃而談，聊著生活八卦。",
            "D. 他性格內向，每次在台上總是侃侃而談，結結巴巴的。"
        ],
        correctIndex: 0,
        explanation: "✅ 正確！【侃侃而談】指理直氣壯、從容不迫地說話，是褒義詞。常被誤用為「閒聊、聊天（選項 B、C）」或「吞吞吐吐（選項 D）」。"
    },
    {
        question: "【明日黃花】請判斷以下哪一個句子正確使用了此成語？",
        options: [
            "A. 這位過氣明星的舊聞，如今已是明日黃花，無人問津了。",
            "B. 只要我們努力，這個計畫一定會成為明日黃花，開花結果。",
            "C. 到了秋天，公園裡開滿了明日黃花，景色非常美麗。",
            "D. 他正值壯年，事業如日中天，堪稱是公司的明日黃花。"
        ],
        correctIndex: 0,
        explanation: "✅ 正確！【明日黃花】比喻「過時的事物」。常被學生誤以為是「未來的希望（明日之星）」或者是「真正的黃色花朵」。"
    },
    {
        question: "【望其項背】請判斷以下哪一個句子正確使用了此成語？",
        options: [
            "A. 他的短跑成績太驚人了，我們這些業餘選手只能望其項背。",
            "B. 對手實力強大，我們根本難以望其項背，第一局就輸了。",
            "C. 他遠遠地走在前面，我望其項背，大聲呼喊他的名字。",
            "D. 這座高山直插雲霄，站在山腳下望其項背，令人心生敬畏。"
        ],
        correctIndex: 1,
        explanation: "✅ 正確！【望其項背】意思是「能看到別人的頸項和後背」，比喻「趕得上或比得上」。通常用於否定句（如「難以望其項背」代表趕不上）。選項 A 誤用為趕不上。"
    },
    {
        question: "【炙手可熱】請判斷以下哪一個句子正確使用了此成語？",
        options: [
            "A. 夏天特別炎熱，走出冷氣房外面簡直是炙手可熱。",
            "B. 這款智能手機設計新穎，在市場上炙手可熱。",
            "C. 這位歌手的演唱會門票炙手可熱，一票難求。",
            "D. 丞相目前在朝廷中炙手可熱，百官爭相討好。"
        ],
        correctIndex: 3,
        explanation: "✅ 正確！【炙手可熱】比喻權勢大、氣焰盛，帶貶義。不可用於天氣熱或商品/門票受歡迎！"
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
        question: "【空穴來風】請判斷以下哪一個句子正確使用了此成語？",
        options: [
            "A. 這座山谷裡的風很大，常常能聽到空穴來風的聲音。",
            "B. 他說的那些關於公司倒閉的傳言，完全是空穴來風。",
            "C. 警方經過調查，證實這則駭人聽聞的消息並非空穴來風。",
            "D. 他的想法總是空穴來風，充滿了天馬行空的想像力。"
        ],
        correctIndex: 2,
        explanation: "✅ 正確！【空穴來風】原指有孔洞便會進風，比喻「傳言有根據、事出有因」。現常被誤用為「毫無根據（如選項B）」。"
    }
];

const grammarData = [
    {
        question: "請找出並修正以下句子的語病：「這場意外發生的原因，是因為司機疲勞駕駛所造成的。」",
        options: [
            "A. 缺少主語：應在句首加上「由於」。",
            "B. 句式雜糅：「原因是...」和「是因為...造成的」混合在一起。",
            "C. 搭配不當：「發生」不能搭配「原因」。",
            "D. 詞語冗贅：「意外」和「發生」意思重複。"
        ],
        correctIndex: 1,
        explanation: "✅ 正確！這是 DSE 常考的「句式雜糅」。應改為「原因是司機疲勞駕駛」或「是因為司機疲勞駕駛所造成的」，兩者只能選其一。"
    },
    {
        question: "請找出並修正以下句子的語病：「能否在文憑試中取得好成績，取決於平時有沒有努力溫習。」",
        options: [
            "A. 完全沒有語病，這是一個正確的句子。",
            "B. 兩面對一面：前面有「能否」，後面應該加上「是否」。",
            "C. 語序不當：「在文憑試中」應該放在句首。",
            "D. 搭配不當：「取得」不能搭配「好成績」。"
        ],
        correctIndex: 0,
        explanation: "✅ 正確！這是一個陷阱題。前面有「能否（正反兩面）」，後面有「有沒有（正反兩面）」，所以兩面對兩面，邏輯完全正確，沒有語病。"
    },
    {
        question: "請找出並修正以下句子的語病：「近年來，香港學生的語文水平有了明顯的改善。」",
        options: [
            "A. 缺少主語：應刪去「近年來」。",
            "B. 搭配不當：「水平」不能用「改善」，應改為「提高」。",
            "C. 詞語冗贅：「明顯」和「改善」意思重複。",
            "D. 否定不當：應在「有了」前面加上「沒有」。"
        ],
        correctIndex: 1,
        explanation: "✅ 正確！動賓搭配不當。我們可以「改善環境」、「改善生活」，但「水平/成績/能力」只能「提高」或「下降」。"
    },
    {
        question: "請找出並修正以下句子的語病：「超級市場裡擺滿了蘋果、西瓜、橙子和水果。」",
        options: [
            "A. 分類不當：「水果」是包含前三者的總稱，不能並列。",
            "B. 語序不當：應把「水果」放在「蘋果」前面。",
            "C. 缺少動詞：應在「和」字後面加上「各種」。",
            "D. 搭配不當：「擺滿」不能搭配「超市」。"
        ],
        correctIndex: 0,
        explanation: "✅ 正確！概念從屬混亂。「蘋果、西瓜、橙子」都屬於水果，不能用「和」把它們與總稱並列。應改為「蘋果、西瓜、橙子等各種水果」。"
    },
    {
        question: "請找出並修正以下句子的語病：「如果他明天不來，那麼我們就不去遠足了。」",
        options: [
            "A. 完全沒有語病，這是一個正確的句子。",
            "B. 關聯詞位置不當：「如果」應放在「他」的後面。",
            "C. 邏輯矛盾：不來和不去遠足沒有必然聯繫。",
            "D. 詞語冗贅：應刪去「那麼」。"
        ],
        correctIndex: 0,
        explanation: "✅ 正確！這又是一條陷阱題。前後兩個分句的主語不同（前面是『他』，後面是『我們』），此時關聯詞「如果」必須放在主語「他」的前面，語法完全正確。"
    },
    {
        question: "請找出並修正以下句子的語病：「他如果明天不來，那麼我就自己一個人去遠足了。」",
        options: [
            "A. 完全沒有語病，這是一個正確的句子。",
            "B. 關聯詞位置不當：「如果」應放在「他」的前面。",
            "C. 邏輯矛盾：不來和去遠足沒有因果關係。",
            "D. 詞語冗贅：應刪除「一個人」。"
        ],
        correctIndex: 1,
        explanation: "✅ 正確！前後分句主語不同（前面是『他』，後面是『我』）。當主語不同時，第一個關聯詞（如果）必須放在主語（他）的**前面**。改為「如果他明天不來...」"
    },
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
    }
];


function renderQuizzes() {
    renderDailyQuiz('quiz-container-1', idiomsData);
    renderDailyQuiz('quiz-container-2', grammarData);
}

// 根據今天的日期，只顯示一題
function renderDailyQuiz(containerId, dataArray) {
    const container = document.getElementById(containerId);
    if(!container) return; 
    
    // 計算今天是今年的第幾天
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    
    // 根據日期挑出當天的題目 (避免超過題庫總數)
    const qIndex = dayOfYear % dataArray.length; 
    const q = dataArray[qIndex];
    
    let html = `
    <div class="card" style="margin-bottom: 20px;">
        <p class="question"><strong>📅 今日挑戰：</strong>${q.question}</p>
        <div class="options">
            ${q.options.map((opt, optIndex) => `
                <button class="btn-option" onclick="checkAnswer(this, ${optIndex}, ${q.correctIndex}, '${q.explanation}')">${opt}</button>
            `).join('')}
        </div>
        <div class="feedback hidden" style="margin-top:15px;"></div>
    </div>`;
    
    container.innerHTML = html;
}

// 核對答案邏輯 (答錯會顯示正確選項)
function checkAnswer(btn, clickedIndex, correctIndex, explanation) {
    const parent = btn.parentElement;
    const feedback = parent.nextElementSibling;
    const allButtons = parent.querySelectorAll('.btn-option');
    
    // 鎖定所有選項
    allButtons.forEach(b => b.disabled = true);
    feedback.classList.remove('hidden');
    
    const correctLetter = String.fromCharCode(65 + correctIndex); // 把 0 轉成 A, 1 轉成 B
    
    if (clickedIndex === correctIndex) {
        // 答對了
        btn.style.backgroundColor = '#d4edda';
        btn.style.borderColor = '#28a745';
        feedback.className = 'feedback success';
        feedback.innerHTML = `🎉 答對了！<br><br>✅ 解析：${explanation}<br><br>🌟 獲得 20 積分！`;
        
        userScore += 20;
        document.getElementById('score').innerText = userScore;
    } else {
        // 答錯了
        btn.style.backgroundColor = '#f8d7da';
        btn.style.borderColor = '#dc3545';
        
        // 將正確答案標示為綠色
        allButtons[correctIndex].style.backgroundColor = '#d4edda';
        allButtons[correctIndex].style.borderColor = '#28a745';
        allButtons[correctIndex].style.borderWidth = '2px';
        
        feedback.className = 'feedback error';
        feedback.innerHTML = `❌ 答錯了！正確答案是 <strong>${correctLetter}</strong>。<br><br>💡 解析：${explanation}`;
    }
}
