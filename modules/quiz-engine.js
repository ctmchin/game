// ========================================================
// MODULE: quiz-engine.js (cleaned & robust)
// ========================================================

import * as allData from '../data/index.js';

function getDaysSinceSept1() {
  const now = new Date();
  let currentYear = now.getFullYear();
  if (now.getMonth() < 8) currentYear--;
  const sept1 = new Date(currentYear, 8, 1);
  return Math.floor(Math.abs(now - sept1) / 86400000);
}

function htmlEscape(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function encodeAttr(s = '') {
  return encodeURIComponent(String(s));
}

function decodeAttr(s = '') {
  try { return decodeURIComponent(s); } catch(e) { return String(s); }
}

function buildOptionsHtml(q, type, isInfinite) {
  if (!q || !Array.isArray(q.options)) return '';
  const correctIndex = Number(q.correctIndex ?? q.correct ?? 0);
  const expl = encodeAttr(q.explanation || '');
  const questionText = encodeAttr(q.question || q.ancient || '');
  return q.options.map((opt, i) => {
    const optText = htmlEscape(opt);
    return `<button class="btn-option" data-idx="${i}" data-correct="${correctIndex}" data-expl="${expl}" data-type="${htmlEscape(type)}" data-infinite="${isInfinite ? '1' : '0'}" data-question="${questionText}">${optText}</button>`;
  }).join('');
}

function attachOptionHandlers(container) {
  if (!container) return;
  const options = container.querySelectorAll('.btn-option');
  options.forEach(btn => {
    // idempotent: remove old handler if any
    btn.replaceWith(btn.cloneNode(true));
  });
  // reselect
  container.querySelectorAll('.btn-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const clickedIndex = Number(btn.getAttribute('data-idx'));
      const correctIndex = Number(btn.getAttribute('data-correct'));
      const explanation = decodeAttr(btn.getAttribute('data-expl') || '');
      const type = btn.getAttribute('data-type') || 'normal';
      const isInfinite = btn.getAttribute('data-infinite') === '1';
      const questionText = decodeAttr(btn.getAttribute('data-question') || '');
      // delegate to the global handler
      if (typeof window.checkStaticAnswer === 'function') {
        window.checkStaticAnswer(btn, clickedIndex, correctIndex, explanation, type, isInfinite, questionText);
      }
    });
  });
}

function renderDailyQuiz(containerId, dataArray, type = 'normal', isMeme = false) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!dataArray || dataArray.length === 0) {
    container.innerHTML = `<div class="card"><p class="question">⏳ 題庫準備中...</p></div>`;
    return;
  }
  const dayIndex = getDaysSinceSept1();
  const q = dataArray[dayIndex % dataArray.length];
  const memeHtml = isMeme && q && q.emoji ? `<div style="font-size: 4rem; text-align: center; margin-bottom: 10px;">${htmlEscape(q.emoji)}</div>` : '';
  const optionsHtml = buildOptionsHtml(q, type, false);
  const questionText = htmlEscape(q.question || q.ancient || '');
  container.innerHTML = `<div class="card" style="margin-bottom:20px;">${memeHtml}<p class="question"><strong>📅 今日挑戰：</strong>${questionText}</p><div class="options">${optionsHtml}</div><div class="feedback hidden"></div></div>`;
  attachOptionHandlers(container);
}

function renderInfiniteQuiz(containerId, dataArray, type = 'normal', isMeme = false) {
  const container = document.getElementById(containerId); if (!container) return;
  if (!dataArray || dataArray.length === 0) {
    container.innerHTML = `<div class="card"><p class="question">⏳ 題庫準備中...</p></div>`;
    return;
  }
  const qIndex = Math.floor(Math.random() * dataArray.length);
  const q = dataArray[qIndex];
  const memeHtml = isMeme && q && q.emoji ? `<div style="font-size: 4rem; text-align: center; margin-bottom: 10px;">${htmlEscape(q.emoji)}</div>` : '';
  const optionsHtml = buildOptionsHtml(q, type, true);
  const questionText = htmlEscape(q.question || q.ancient || '');
  container.innerHTML = `<div class="card" style="margin-bottom:20px;">${memeHtml}<p class="question">${questionText}</p><div class="options">${optionsHtml}</div><div class="feedback hidden"></div></div>`;
  attachOptionHandlers(container);
}

// Global answer checker (exposed on window so inline handlers or other modules can call it)
window.checkStaticAnswer = function(btn, clickedIndex, correctIndex, explanation = '', type = 'normal', isInfinite = false, questionText = '') {
  try {
    const parent = btn.parentElement; if(!parent) return;
    const feedback = parent.nextElementSibling;
    const allButtons = parent.querySelectorAll('.btn-option');
    allButtons.forEach(b => b.disabled = true);
    if (feedback) feedback.classList.remove('hidden');

    const labelText = (type === 'suggested') ? '💡 建議答案' : '✅ 正確答案';
    const nextBtnHtml = isInfinite ? `<br><br><button class="btn-primary" onclick="window.renderQuizzes()">做下一題 ➔</button>` : `<br><br><div style="padding:15px; background:#e3f2fd; color:#0d47a1; border-radius:8px; display:inline-block;">重新整理頁面以查看其他題目</div>`;

    if (clickedIndex === correctIndex) {
      btn.style.backgroundColor = '#d4edda';
      btn.style.borderColor = '#28a745';
      if (feedback) {
        feedback.className = 'feedback success';
        feedback.innerHTML = `🎉 選擇極佳！<br><br>💡 解析：${htmlEscape(explanation)}<br><br>🌟 獲得 20 積分/金幣！${nextBtnHtml}`;
      }
      if (typeof window.addPoints === 'function') window.addPoints(20);
    } else {
      btn.style.backgroundColor = '#f8d7da';
      btn.style.borderColor = '#dc3545';
      const correctBtn = Array.from(allButtons).find(b => Number(b.getAttribute('data-idx')) === Number(correctIndex));
      if (correctBtn) {
        correctBtn.style.backgroundColor = '#d4edda';
        correctBtn.style.borderColor = '#28a745';
        correctBtn.style.borderWidth = '2px';
      }
      if (feedback) {
        feedback.className = 'feedback error';
        feedback.innerHTML = `❌ 稍嫌遜色！${labelText}是 <strong>${String.fromCharCode(65 + Number(correctIndex))}</strong>。<br><br>💡 解析：${htmlEscape(explanation)}${nextBtnHtml}`;
      }
    }

    if (!isInfinite) {
      const optContainer = parent.querySelector('.options');
      if (optContainer) optContainer.style.display = 'none';
    }
  } catch (e) {
    console.warn('checkStaticAnswer error', e);
  }
};

// Render entry
export function renderQuizzes() {
  try { // call the original renderQuizzes behavior but guarded
    // Daily quizzes
    renderDailyQuiz('quiz-container-1', allData.idiomsData, 'normal');
    renderDailyQuiz('quiz-container-2a', allData.grammarData, 'normal');
    renderDailyQuiz('quiz-container-2b', allData.typoData, 'normal');
    // Infinite / other categories
    renderInfiniteQuiz('quiz-container-3', allData.memeData, 'normal', true);
    // optional ones if present
    if (allData.ancientModernData) renderInfiniteQuiz('quiz-container-6', allData.ancientModernData, 'normal');
    if (allData.themeData) renderInfiniteQuiz('quiz-container-16', allData.themeData, 'suggested');
    if (allData.materialData) renderInfiniteQuiz('quiz-container-17', allData.materialData, 'suggested');
    if (allData.logicData) renderInfiniteQuiz('quiz-container-18', allData.logicData, 'suggested');
  } catch (e) { console.warn('renderQuizzes error', e); }
}

// Keep backward compatible default export (optional)
export default { renderQuizzes };
