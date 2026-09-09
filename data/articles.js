// data/articles.js
import {articles_part1} from './articles-part1.js';
import {articles_part2} from './articles-part2.js';
import {articles_part3} from './articles-part3.js';

export const articlesData = [
  ...articles_part1,
  ...articles_part2,
  ...articles_part3
];

let currentArticleIndex = 0;
let readingTimer = null;
let secondsRead = 0;

function renderCurrentArticle() {
  console.log("當前 articlesData 內容:", articlesData);
  console.log("當前文章索引:", currentArticleIndex);
  
  const a = articlesData[currentArticleIndex];

   if (!a) {
    console.warn("⚠️ 警告：找不到當前索引的文章！渲染中斷。");
    return;
  }

  console.log("準備渲染的文章:", a.title);

  const titleEl = document.getElementById('reading-title');
  const textEl = document.getElementById('reading-text');
  
  if (!titleEl) console.error("❌ 錯誤：HTML 中找不到 id 為 'reading-title' 的元素！");
  if (!textEl) console.error("❌ 錯誤：HTML 中找不到 id 為 'reading-text' 的元素！");

  if (titleEl) titleEl.innerText = a.title;
  if (textEl) textEl.innerHTML = a.text;
  const btn = document.getElementById('btn-claim-reading');
  if (btn) {
    btn.disabled = true;
    btn.style.background = '#ccc';
    btn.style.cursor = 'not-allowed';
    btn.innerText = '⏳ 閱讀 30 秒後領取';
  }
  stopReadingTimer();
}

function nextArticle() {
  currentArticleIndex = (currentArticleIndex + 1) % articlesData.length;
  renderCurrentArticle();
}

function stopReadingTimer() {
  if (readingTimer) { clearInterval(readingTimer); readingTimer = null; }
  secondsRead = 0;
}

function startReadingTimer() {
  stopReadingTimer();
  secondsRead = 0;
  const btn = document.getElementById('btn-claim-reading');
  if (!btn) return;
  btn.disabled = true; btn.style.background = '#ccc'; btn.style.cursor = 'not-allowed'; btn.innerText = '⏳ 閱讀 30 秒後領取';

  readingTimer = setInterval(() => {
    secondsRead++;
    if (secondsRead >= 30) {
      clearInterval(readingTimer); readingTimer = null;
      btn.disabled = false; btn.style.background = '#4caf50'; btn.style.cursor = 'pointer'; btn.innerText = '💰 領取 10 積分/金幣';
    } else {
      btn.innerText = `⏳ 閱讀中... (${30 - secondsRead}s)`;
    }
  }, 1000);
}

function claimReadingPoints() {
  // Do not add points to admin/test infinite accounts
  if (window.addPoints) window.addPoints(10);
  const btn = document.getElementById('btn-claim-reading');
  if (btn) { btn.disabled = true; btn.style.background = '#ccc'; btn.style.cursor = 'not-allowed'; btn.innerText = '✅ 已領取！請換下一篇'; }
}

// Expose to global for HTML buttons
window.nextArticle = nextArticle;
window.startReadingTimer = startReadingTimer;
window.claimReadingPoints = claimReadingPoints;

// Initial render when module loads
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(renderCurrentArticle, 50);
    });
  } else {
    // 如果 DOM 早就準備好了（module 腳本常見情況），直接渲染！
    setTimeout(renderCurrentArticle, 50);
  }
}
