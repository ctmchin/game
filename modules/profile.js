// ========================================================
// MODULE: profile.js
// ========================================================
const prefixes = ["見習", "尚學", "勤奮", "通達", "睿智", "超凡", "入聖", "登峰", "造極", "傳說"];
const nouns = ["書童", "墨客", "秀才", "舉人", "探花", "榜眼", "狀元", "大師", "宗師", "泰斗"];
let userScore = 0, userCoins = 0, weeklyScore = 0, equippedEmoji = "";

// List of admin identifiers that should get indefinite points/coins.
// Add more emails or uids here when needed.
const adminAccounts = new Set([
  "admin_ctm",
  "ctmlwsss@gmail.com",
  "jimchanchin@gmail.com"
]);

function isAdminUser() {
  if (!window.currentUser) return false;
  const id = (window.currentUser.uid || "").toString();
  const email = (window.currentUser.email || "").toString().toLowerCase();
  return adminAccounts.has(id) || adminAccounts.has(email);
}

function getPetInfo(score) {
  if (score >= 99999) return { lv: 100, name: "🌟 中文宇宙真神", emoji: "👑", nextScore: 99999 };
  let lv = Math.floor(Math.sqrt(score / 20)) + 1; if (lv > 99) lv = 99;
  let nextScore = 20 * Math.pow(lv, 2);
  let emoji = '🌱';
  if (lv >= 10) emoji = '🌿'; if (lv >= 20) emoji = '📚'; if (lv >= 30) emoji = '✍️'; if (lv >= 40) emoji = '🖋️';
  if (lv >= 50) emoji = '🦄'; if (lv >= 60) emoji = '🦅'; if (lv >= 70) emoji = '🎓'; if (lv >= 80) emoji = '📜'; if (lv >= 90) emoji = '🐉';
  let name = prefixes[Math.floor((lv - 1) / 10)] + nouns[(lv - 1) % 10];
  return { lv, name, emoji, nextScore };
}

function updateScoreUI() {
  // If admin -> show infinity glyph and a special pet label
  try {
    if (isAdminUser()) {
      const scoreEl = document.getElementById('score');
      const coinsEl = document.getElementById('coins');
      const petAvatar = document.getElementById('pet-avatar');
      const petLevel = document.getElementById('pet-level');
      if (scoreEl) scoreEl.innerText = '∞';
      if (coinsEl) coinsEl.innerText = '∞';
      if (petAvatar) petAvatar.innerText = '👑';
      if (petLevel) petLevel.innerText = '測試用 (∞)';
    } else {
      const scoreEl = document.getElementById('score');
      const coinsEl = document.getElementById('coins');
      if (scoreEl) scoreEl.innerText = userScore;
      if (coinsEl) coinsEl.innerText = userCoins;
      const pet = getPetInfo(userScore);
      const levelText = `${pet.name} (Lv.${pet.lv})`;
      const petAvatar = document.getElementById('pet-avatar');
      const petLevel = document.getElementById('pet-level');
      if (petAvatar) petAvatar.innerText = pet.emoji;
      if (petLevel) petLevel.innerText = levelText;
    }

    if (window.currentUser) {
      const displayNameWithEmoji = (equippedEmoji ? equippedEmoji + " " : "") + window.currentUser.displayName;
      const nameEl = document.getElementById('user-display-name');
      if (nameEl) nameEl.innerText = displayNameWithEmoji;
    }
  } catch (e) {
    console.error('updateScoreUI error', e);
  }
}
window.updateScoreUI = updateScoreUI;

function addPoints(points) {
  // Never alter admin users' displayed points/coins
  if (isAdminUser() || (window.currentUser && window.currentUser.role === 'teacher')) return;
  if (typeof points !== 'number') points = Number(points) || 0;
  userScore += points;
  userCoins += points;
  weeklyScore += points;
  updateScoreUI();
}
window.addPoints = addPoints;

// Deduct coins helper (returns true if successful)
function deductCoins(amount) {
  if (isAdminUser() || (window.currentUser && window.currentUser.role === 'teacher')) return true;
  if (typeof amount !== 'number') amount = Number(amount) || 0;
  if (typeof userCoins !== 'number' || userCoins < amount) return false;
  userCoins -= amount;
  updateScoreUI();
  return true;
}
window.deductCoins = deductCoins;
