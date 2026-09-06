// ========================================================
// MODULE: reading.js
// Simple reading module that provides articles and a 30s claim flow.
// ========================================================

const articles = [
  {
    id: 'a1',
    title: '夏日的陽明山',
    text: `陽明山每到夏天，微風與涼爽的氣溫吸引了大量遊客。步道兩旁野花盛開，登山道上經常可以看到家庭與學生悠閒地散步。這裡的自然資源值得我們共同守護。`
  },
  {
    id: 'a2',
    title: '小鎮的舊書店',
    text: `在小鎮的巷弄深處，藏著一家只在週末營業的舊書店。老闆喜歡向顧客推薦隱藏版的好書，店裡總有一股讓人安心的舊紙張香。`
  },
  {
    id: 'a3',
    title: '夜市的燈火',
    text: `夜市裡的燈火總是讓人感到溫暖，熟悉的小吃攤一攤接一攤，叫賣聲伴著笑語，匯成城市夜晚特有的交響。`
  }
];

let currentArticleIndex = 0;
let readingTimer = null;
let secondsRead = 0;

function renderCurrentArticle() {
  const a = articles[currentArticleIndex];
  if (!a) return;
  const titleEl = document.getElementById('reading-title');
  const textEl = document.getElementById('reading-text');
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
  currentArticleIndex = (currentArticleIndex + 1) % articles.length;
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
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(renderCurrentArticle, 50);
  });
}
