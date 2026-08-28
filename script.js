// 全局變數：儲存學生的筆記
let memos = [];

// 1. 模擬登入功能
function login() {
    // 隱藏登入畫面，顯示儀表板
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    
    // 載入之前存好的備忘錄
    loadMemos();
}

// 2. 切換選單功能
function switchTab(tabId, event) {
    document.querySelectorAll('.module').forEach(mod => mod.classList.remove('active'));
    document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    if(event) event.target.classList.add('active');
}

// 3. 螢光筆核心技術 (偵測文字反白)
const highlightBtn = document.getElementById('highlight-btn');
let selectedText = "";

document.addEventListener('mouseup', function(e) {
    // 獲取學生反白的文字
    selectedText = window.getSelection().toString().trim();

    if (selectedText.length > 0) {
        // 如果有選取文字，讓按鈕出現在滑鼠上方
        highlightBtn.style.left = e.pageX + 'px';
        highlightBtn.style.top = (e.pageY - 10) + 'px';
        highlightBtn.classList.remove('hidden');
    } else {
        // 如果點擊空白處取消反白，就隱藏按鈕
        highlightBtn.classList.add('hidden');
    }
});

// 當學生點擊「🖍️ 收藏至備忘錄」時執行
highlightBtn.addEventListener('mousedown', function(e) {
    e.preventDefault(); // 防止按鈕點擊時文字取消反白
    if (selectedText.length > 0) {
        saveMemo(selectedText);
        
        // 收藏成功後，彈出提示並隱藏按鈕
        alert("✅ 成功收藏到備忘錄！");
        window.getSelection().removeAllRanges(); // 取消文字反白狀態
        highlightBtn.classList.add('hidden');
    }
});

// 4. 儲存筆記到系統中
function saveMemo(text) {
    // 獲取當前時間
    const now = new Date();
    const timeString = now.toLocaleDateString() + " " + now.toLocaleTimeString();

    // 將筆記加入陣列
    const newMemo = {
        content: text,
        time: timeString
    };
    memos.unshift(newMemo); // 加到最前面

    // 更新顯示畫面並儲存到瀏覽器記憶體
    updateMemoUI();
    localStorage.setItem('studentMemos', JSON.stringify(memos));
}

// 5. 將筆記顯示在「15. 備忘錄」模塊中
function updateMemoUI() {
    const list = document.getElementById('memo-list');
    
    if (memos.length === 0) {
        list.innerHTML = '<p style="color: #888; text-align: center;">暫無筆記，快去閱讀區畫重點吧！</p>';
        return;
    }

    // 將每一條筆記變成 HTML 顯示出來
    list.innerHTML = memos.map(memo => `
        <div class="memo-item">
            <p>${memo.content}</p>
            <div class="memo-time">收藏於：${memo.time}</div>
        </div>
    `).join('');
}

// 6. 網頁載入時，讀取以前存的筆記
function loadMemos() {
    const saved = localStorage.getItem('studentMemos');
    if (saved) {
        memos = JSON.parse(saved);
        updateMemoUI();
    }
}
