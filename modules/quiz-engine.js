// ========================================================
// MODULE: quiz-engine.js
// Handles all the logic for displaying and checking quiz questions.
// ========================================================

// STEP 1: Import the data we need.
// The '..' means "go up one folder". So we go from 'modules' up to the main folder, then down into 'data'.
// The '*' as allData means "import everything that the index.js file exports, and put it in an object called allData".
import * as allData from '../data/index.js';

// We will create these other modules later. For now, these are placeholders.
// import { db } from './firebase.js';
// import { addPoints } from './profile.js';


// This function calculates which day's question to show.
function getDaysSinceSept1() {
    const now = new Date();
    let currentYear = now.getFullYear();
    if (now.getMonth() < 8) { currentYear--; } // if it's before September, use last year's school year
    const sept1 = new Date(currentYear, 8, 1); // Month is 0-indexed, so 8 is September
    return Math.floor(Math.abs(now - sept1) / 86400000);
}

// STEP 2: We EXPORT this main function so we can call it from outside this file later.
export function renderQuizzes() {
    // We now use 'allData.idiomsData' instead of just 'idiomsData' because we imported everything as 'allData'.
    renderDailyQuiz('quiz-container-1', allData.idiomsData, 'normal');
    renderDailyQuiz('quiz-container-2a', allData.grammarData, 'normal');
    renderDailyQuiz('quiz-container-2b', allData.typoData, 'normal');
    renderInfiniteQuiz('quiz-container-3', allData.memeData, 'normal', true);
    // --- TEMPORARILY DISABLED ---
    // renderInfiniteQuiz('quiz-container-6', allData.ancientModernData, 'normal');
    // renderInfiniteQuiz('quiz-container-16', allData.themeData, 'suggested');
    // renderInfiniteQuiz('quiz-container-17', allData.materialData, 'suggested');
    // renderInfiniteQuiz('quiz-container-18', allData.logicData, 'suggested');
}

function renderDailyQuiz(containerId, dataArray, type = 'normal', isMeme = false) {
    const container = document.getElementById(containerId); if(!container) return;
    if (!dataArray || dataArray.length === 0) {
        container.innerHTML = `<div class="card"><p class="question">⏳ 題庫準備中...</p></div>`;
        return;
    }
    const dayIndex = getDaysSinceSept1();
    const q = dataArray[dayIndex % dataArray.length];
    const memeHtml = isMeme && q.emoji ? `<div style="font-size: 4rem; text-align: center; margin-bottom: 10px;">${q.emoji}</div>` : '';
    // IMPORTANT: We changed the onclick to call 'window.checkStaticAnswer'. This is a necessary fix for modules.
    // I also added a .replace(/'/g, "\\'") to handle explanations with single quotes that would break the HTML.
    container.innerHTML = `<div class="card" style="margin-bottom: 20px;">${memeHtml}<p class="question"><strong>📅 今日挑戰：</strong>${q.question}</p><div class="options">${q.options.map((opt, i) => `<button class="btn-option" style="line-height:1.6;" onclick="window.checkStaticAnswer(this, ${i}, ${q.correctIndex}, '${q.explanation.replace(/'/g, "\\'")}', '${type}', false, '${q.question.substring(0,20).replace(/'/g, "\\'")}')">${opt}</button>`).join('')}</div><div class="feedback hidden" style="margin-top:15px;"></div></div>`;
}

function renderInfiniteQuiz(containerId, dataArray, type = 'normal', isMeme = false) {
    const container = document.getElementById(containerId); if(!container) return;
    const qIndex = Math.floor(Math.random() * dataArray.length);
    const q = dataArray[qIndex];
    const memeHtml = isMeme && q.emoji ? `<div style="font-size: 4rem; text-align: center; margin-bottom: 10px;">${q.emoji}</div>` : '';
    // IMPORTANT: We changed the onclick to call 'window.checkStaticAnswer' here too.
    container.innerHTML = `<div class="card" style="margin-bottom: 20px;">${memeHtml}<p class="question">${q.question}</p><div class="options">${q.options.map((opt, i) => `<button class="btn-option" style="line-height:1.6;" onclick="window.checkStaticAnswer(this, ${i}, ${q.correctIndex}, '${q.explanation.replace(/'/g, "\\'")}', '${type}', true, '${containerId}')">${opt}</button>`).join('')}</div><div class="feedback hidden" style="margin-top:15px;"></div></div>`;
}

function logWrongAnswer(questionText) {
    // This function will be fully connected later when we make the firebase.js module.
    console.log("Logged wrong answer for:", questionText);
    // if(!db || (window.currentUser && window.currentUser.role === 'teacher')) return;
    // db.collection('error_stats').where('q', '==', questionText).get().then(snap => {
    //     if(snap.empty) { db.collection('error_stats').add({ q: questionText, count: 1 }); }
    //     else { snap.docs[0].ref.update({ count: firebase.firestore.FieldValue.increment(1) }); }
    // });
}

// STEP 3: THE SPECIAL FIX
// We attach this function to the global 'window' object.
// This is because functions inside modules are private, but the onclick="..." in your HTML needs to find a *public* function.
// This fix makes it public again so the buttons work.
window.checkStaticAnswer = function(btn, clickedIndex, correctIndex, explanation, type, isInfinite = false, questionText = "") {
    const parent = btn.parentElement; const feedback = parent.nextElementSibling; const allButtons = parent.querySelectorAll('.btn-option');
    allButtons.forEach(b => b.disabled = true); feedback.classList.remove('hidden');
    const labelText = type === 'suggested' ? '💡 建議答案' : '✅ 正確答案';
    // IMPORTANT: We also change the 'onclick' for the "next" button here to call the window version.
    const nextBtnHtml = isInfinite ? `<br><br><button class="btn-primary" onclick="window.renderQuizzes()">做下一題 ➔</button>` : `<br><br><div style="padding:15px; background:#e3f2fd; color:#1976d2; border-radius:8px; text-align:center; font-weight:bold;">✅ 已經完成今天本部分任務！請明天再來。</div>`;

    if (clickedIndex === correctIndex) {
        btn.style.backgroundColor = '#d4edda'; btn.style.borderColor = '#28a745';
        feedback.className = 'feedback success'; feedback.innerHTML = `🎉 選擇極佳！<br><br>💡 解析：${explanation}<br><br>🌟 獲得 20 積分/金幣！${nextBtnHtml}`;
        // This function doesn't exist yet, but we will create it later.
        if (window.addPoints) window.addPoints(20);
    } else {
        btn.style.backgroundColor = '#f8d7da'; btn.style.borderColor = '#dc3545';
        allButtons[correctIndex].style.backgroundColor = '#d4edda'; allButtons[correctIndex].style.borderColor = '#28a745'; allButtons[correctIndex].style.borderWidth = '2px';
        feedback.className = 'feedback error'; feedback.innerHTML = `❌ 稍嫌遜色！${labelText}是 <strong>${String.fromCharCode(65 + correctIndex)}</strong>。<br><br>💡 解析：${explanation} ${nextBtnHtml}`;
        if(!isInfinite) logWrongAnswer(questionText);
    }
    if(!isInfinite) { parent.querySelector('.options').style.display = 'none'; }
}

// We also need to make renderQuizzes available on the window for the "next" button to work.
window.renderQuizzes = renderQuizzes;
