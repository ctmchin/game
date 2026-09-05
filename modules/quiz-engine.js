// ========================================================
// MODULE: quiz-engine.js
// ========================================================

import * as allData from '../data/index.js';

function getDaysSinceSept1() {
    const now = new Date();
    let currentYear = now.getFullYear();
    if (now.getMonth() < 8) { currentYear--; }
    const sept1 = new Date(currentYear, 8, 1);
    return Math.floor(Math.abs(now - sept1) / 86400000);
}

export function renderQuizzes() {
    // These will work because you created the data files for them
    renderDailyQuiz('quiz-container-1', allData.idiomsData, 'normal');
    renderDailyQuiz('quiz-container-2a', allData.grammarData, 'normal');
    renderDailyQuiz('quiz-container-2b', allData.typoData, 'normal');
    renderInfiniteQuiz('quiz-container-3', allData.memeData, 'normal', true);

    // --- THE FIX: These are now disabled because the data files don't exist yet ---
    // renderInfiniteQuiz('quiz-container-6', allData.ancientModernData, 'normal');
    // renderInfiniteQuiz('quiz-container-16', allData.themeData, 'suggested');
    // renderInfiniteQuiz('quiz-container-17', allData.materialData, 'suggested');
    // renderInfiniteQuiz('quiz-container-18', allData.logicData, 'suggested');
}

// --- The rest of the file is the same and is correct ---

function renderDailyQuiz(containerId, dataArray, type = 'normal', isMeme = false) {
    const container = document.getElementById(containerId); if(!container) return;
    if (!dataArray || dataArray.length === 0) {
        container.innerHTML = `<div class="card"><p class="question">⏳ 題庫準備中...</p></div>`;
        return;
    }
    const dayIndex = getDaysSinceSept1();
    const q = dataArray[dayIndex % dataArray.length];
    const memeHtml = isMeme && q.emoji ? `<div style="font-size: 4rem; text-align: center; margin-bottom: 10px;">${q.emoji}</div>` : '';
    container.innerHTML = `<div class="card" style="margin-bottom: 20px;">${memeHtml}<p class="question"><strong>📅 今日挑戰：</strong>${q.question}</p><div class="options">${q.options.map((opt, i) => `<button class="btn-option" style="line-height:1.6;" onclick="window.checkStaticAnswer(this, ${i}, ${q.correctIndex}, '${q.explanation.replace(/'/g, "\\'")}', '${type}', false, '${q.question.substring(0,20).replace(/'/g, "\\'")}')">${opt}</button>`).join('')}</div><div class="feedback hidden" style="margin-top:15px;"></div></div>`;
}

function renderInfiniteQuiz(containerId, dataArray, type = 'normal', isMeme = false) {
    const container = document.getElementById(containerId); if(!container) return;
    if (!dataArray || dataArray.length === 0) {
        container.innerHTML = `<div class="card"><p class="question">⏳ 題庫準備中...</p></div>`;
        return;
    }
    const qIndex = Math.floor(Math.random() * dataArray.length);
    const q = dataArray[qIndex];
    const memeHtml = isMeme && q.emoji ? `<div style="font-size: 4rem; text-align: center; margin-bottom: 10px;">${q.emoji}</div>` : '';
    container.innerHTML = `<div class="card" style="margin-bottom: 20px;">${memeHtml}<p class="question">${q.question}</p><div class="options">${q.options.map((opt, i) => `<button class="btn-option" style="line-height:1.6;" onclick="window.checkStaticAnswer(this, ${i}, ${q.correctIndex}, '${q.explanation.replace(/'/g, "\\'")}', '${type}', true, '${containerId}')">${opt}</button>`).join('')}</div><div class="feedback hidden" style="margin-top:15px;"></div></div>`;
}

window.checkStaticAnswer = function(btn, clickedIndex, correctIndex, explanation, type, isInfinite = false, questionText = "") {
    const parent = btn.parentElement; const feedback = parent.nextElementSibling; const allButtons = parent.querySelectorAll('.btn-option');
    allButtons.forEach(b => b.disabled = true); feedback.classList.remove('hidden');
    const labelText = type === 'suggested' ? '💡 建議答案' : '✅ 正確答案';
    const nextBtnHtml = isInfinite ? `<br><br><button class="btn-primary" onclick="window.renderQuizzes()">做下一題 ➔</button>` : `<br><br><div style="padding:15px; background:#e3f2fd; color:#1976d2; border-radius:8px; text-align:center; font-weight:bold;">✅ 已經完成今天本部分任務！請明天再來。</div>`;

    if (clickedIndex === correctIndex) {
        btn.style.backgroundColor = '#d4edda'; btn.style.borderColor = '#28a745';
        feedback.className = 'feedback success'; feedback.innerHTML = `🎉 選擇極佳！<br><br>💡 解析：${explanation}<br><br>🌟 獲得 20 積分/金幣！${nextBtnHtml}`;
        if (window.addPoints) window.addPoints(20);
    } else {
        btn.style.backgroundColor = '#f8d7da'; btn.style.borderColor = '#dc3545';
        allButtons[correctIndex].style.backgroundColor = '#d4edda'; allButtons[correctIndex].style.borderColor = '#28a745'; allButtons[correctIndex].style.borderWidth = '2px';
        feedback.className = 'feedback error'; feedback.innerHTML = `❌ 稍嫌遜色！${labelText}是 <strong>${String.fromCharCode(65 + correctIndex)}</strong>。<br><br>💡 解析：${explanation} ${nextBtnHtml}`;
    }
    if(!isInfinite) { parent.querySelector('.options').style.display = 'none'; }
}

window.renderQuizzes = renderQuizzes;
