// ========================================================
// MODULE: quiz-engine.js (fixed)
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
    // Daily quizzes
    renderDailyQuiz('quiz-container-1', allData.idiomsData, 'normal');
    renderDailyQuiz('quiz-container-2a', allData.grammarData, 'normal');
    renderDailyQuiz('quiz-container-2b', allData.typoData, 'normal');

    // Infinite memes
    renderInfiniteQuiz('quiz-container-3', allData.memeData, 'normal', true);

    // If you want to enable additional categories later, call renderInfiniteQuiz(...)
}

function escapeForTemplate(str = "") {
    // Simple escaping so backticks in explanations don't break template strings
    return String(str).replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

function buildOptionsHtml(q, type, isInfinite) {
    if (!Array.isArray(q.options)) return '';
    return q.options.map((opt, i) => {
        const expl = escapeForTemplate(q.explanation || '');
        // note: question text also passed for context if needed
        return `<button class="btn-option" onclick="window.checkStaticAnswer(this, ${i}, ${q.correctIndex}, \`${expl}\`, '${type}', ${isInfinite ? 'true' : 'false'}, \`${escapeForTemplate(q.question)}\`)">${opt}</button>`;
    }).join('');
}

function renderDailyQuiz(containerId, dataArray, type = 'normal', isMeme = false) {
    const container = document.getElementById(containerId); if (!container) return;
    if (!dataArray || dataArray.length === 0) {
        container.innerHTML = `<div class="card"><p class="question">⏳ 題庫準備中...</p></div>`;
        return;
    }
    const dayIndex = getDaysSinceSept1();
    const q = dataArray[dayIndex % dataArray.length];
    const memeHtml = isMeme && q.emoji ? `<div style="font-size: 4rem; text-align: center; margin-bottom: 10px;">${q.emoji}</div>` : '';
    const optionsHtml = buildOptionsHtml(q, type, false);
    container.innerHTML = `<div class="card" style="margin-bottom: 20px;">${memeHtml}<p class="question"><strong>📅 今日挑戰：</strong>${q.question}</p><div class="options">${optionsHtml}</div><div class="feedback hidden"></div></div>`;
}

function renderInfiniteQuiz(containerId, dataArray, type = 'normal', isMeme = false) {
    const container = document.getElementById(containerId); if (!container) return;
    if (!dataArray || dataArray.length === 0) {
        container.innerHTML = `<div class="card"><p class="question">⏳ 題庫準備中...</p></div>`;
        return;
    }
    const qIndex = Math.floor(Math.random() * dataArray.length);
    const q = dataArray[qIndex];
    const memeHtml = isMeme && q.emoji ? `<div style="font-size: 4rem; text-align: center; margin-bottom: 10px;">${q.emoji}</div>` : '';
    const optionsHtml = buildOptionsHtml(q, type, true);
    container.innerHTML = `<div class="card" style="margin-bottom: 20px;">${memeHtml}<p class="question">${q.question}</p><div class="options">${optionsHtml}</div><div class="feedback hidden"></div></div>`;
}

window.checkStaticAnswer = function(btn, clickedIndex, correctIndex, explanation = "", type = 'normal', isInfinite = false, questionText = "") {
    const parent = btn.parentElement;
    if (!parent) return;
    const feedback = parent.nextElementSibling;
    const allButtons = parent.querySelectorAll('.btn-option');
    allButtons.forEach(b => b.disabled = true);
    if (feedback) feedback.classList.remove('hidden');

    const labelText = type === 'suggested' ? '💡 建議答案' : '✅ 正確答案';
    const nextBtnHtml = isInfinite ? `<br><br><button class="btn-primary" onclick="window.renderQuizzes()">做下一題 ➔</button>` : `<br><br><div style="padding:15px; background:#e3f2fd; color:#0d47a1; border-radius:8px;">回到題目列表後再嘗試更多題目。</div>`;

    if (clickedIndex === correctIndex) {
        btn.style.backgroundColor = '#d4edda';
        btn.style.borderColor = '#28a745';
        if (feedback) {
            feedback.className = 'feedback success';
            feedback.innerHTML = `🎉 選擇極佳！<br><br>💡 解析：${escapeForTemplate(explanation)}<br><br>🌟 獲得 20 積分/金幣！${nextBtnHtml}`;
        }
        if (window.addPoints) window.addPoints(20);
    } else {
        btn.style.backgroundColor = '#f8d7da';
        btn.style.borderColor = '#dc3545';
        if (allButtons[correctIndex]) {
            allButtons[correctIndex].style.backgroundColor = '#d4edda';
            allButtons[correctIndex].style.borderColor = '#28a745';
            allButtons[correctIndex].style.borderWidth = '2px';
        }
        if (feedback) {
            feedback.className = 'feedback error';
            feedback.innerHTML = `❌ 稍嫌遜色！${labelText}是 <strong>${String.fromCharCode(65 + correctIndex)}</strong>。<br><br>💡 解析：${escapeForTemplate(explanation)}${nextBtnHtml}`;
        }
    }
    if (!isInfinite) {
        const optContainer = parent.querySelector('.options');
        if (optContainer) optContainer.style.display = 'none';
    }
}

window.renderQuizzes = renderQuizzes;
