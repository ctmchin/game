// 全局狀態變數
let userScore = 10;
let memos = [];

// 導航切換功能
function switchTab(tabId, event) {
    document.querySelectorAll('.module').forEach(mod => mod.classList.remove('active'));
    document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    if(event) event.target.classList.add('active');
}

// 統一的選擇題核對功能 (支援功能 1,2,3,4,5,6,7,16,17,18)
function handleQuiz(button, isCorrect, feedbackId, successMsg, failMsg, points) {
    const parent = button.parentElement;
    const feedback = document.getElementById(feedbackId);
    
    // 鎖定所有按鈕
    parent.querySelectorAll('.btn-option').forEach(btn => btn.disabled = true);
    
    feedback.classList.remove('hidden');
    if(isCorrect) {
        button.style.backgroundColor = '#d4edda';
        button.style.borderColor = '#28a745';
        feedback.className = 'feedback success';
        feedback.innerHTML = `🎉 ${successMsg} (積分 +${points})`;
        updateScore(points);
    } else {
        button.style.backgroundColor = '#f8d7da';
        button.style.borderColor = '#dc3545';
        feedback.className = 'feedback error';
        feedback.innerHTML = `💡 ${failMsg}`;
    }
}

// 統一的文字提交功能 (支援功能 8,9,10)
function submitText(inputId, successMsg, points) {
    const input = document.getElementById(inputId);
    if(input.value.trim() === '') {
        alert('請先輸入內容喔！');
        return;
    }
    input.value = ''; // 清空輸入框
    alert(successMsg);
    updateScore(points);
}

// 功能 11：模擬 AI 繪圖
function generateAI() {
    const input = document.getElementById('ai-input').value;
    const result = document.getElementById('ai-result');
    if(input.trim() === '') return alert('請先描寫怪獸特徵！');
    
    result.classList.remove('hidden');
    result.className = 'feedback info';
    result.innerHTML = '⏳ 正在施展魔法生成中...';
    
    // 模擬 1.5 秒後生成圖片
    setTimeout(() => {
        result.className = 'feedback success';
        result.innerHTML = `🎨 魔法成功！<br><br><div style="text-align:center; font-size: 3rem;">🐉</div><p style="text-align:center; font-weight:normal;">(因技術限制，此處用 Emoji 示意。實裝時將接駁真實 AI 圖片 API)</p>`;
        updateScore(30);
    }, 1500);
}

// 功能 13：抽卡盲盒邏輯
function drawGacha() {
    const result = document.getElementById('gacha-result');
    if(userScore < 50) {
        alert('積分不足 50，快去做任務賺積分吧！');
        return;
    }
    
    updateScore(-50); // 扣除 50 分
    result.classList.remove('hidden');
    
    // 隨機抽取結果
    const random = Math.random();
    let card = '';
    if(random > 0.9) card = '【UR 傳說卡】李白頭像框！';
    else if(random > 0.6) card = '【SR 稀有卡】免做一次功課金牌！';
    else card = '【N 普通卡】詞彙卡：躊躇滿志';
    
    result.className = 'feedback success';
    result.innerHTML = `🎲 恭喜抽中：<br><br><span style="font-size:1.2rem;">${card}</span>`;
}

// 功能 15：備忘錄儲存邏輯
function saveMemo() {
    const input = document.getElementById('memo-input');
    const text = input.value.trim();
    if(text === '') return;
    
    memos.push(text);
    input.value = ''; // 清空
    
    // 更新列表顯示
    const list = document.getElementById('memo-list');
    list.innerHTML = memos.map(m => `<div style="padding:10px; border-bottom:1px solid #ddd;">📝 ${m}</div>`).join('');
}

// 核心計分與靈獸升級邏輯
function updateScore(points) {
    userScore += points;
    document.getElementById('score').innerText = userScore;
    document.getElementById('rank-score').innerText = userScore; // 同步排行榜分數
    
    // 計算等級與進度條
    const progress = (userScore % 100);
    document.getElementById('exp-bar').style.width = progress + '%';
    
    // 靈獸進化展示
    if (userScore >= 100) {
        document.getElementById('pet-avatar').innerText = '🐣';
        document.getElementById('big-pet').innerText = '🐣';
        document.getElementById('pet-level').innerText = '修辭小獸 (Lv.2)';
    }
}
