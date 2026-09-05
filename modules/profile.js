// ========================================================
// MODULE: profile.js
// Handles user score, coins, levels, and profile UI updates.
// ========================================================

const prefixes = ["見習", "尚學", "勤奮", "通達", "睿智", "超凡", "入聖", "登峰", "造極", "傳說"];
const nouns = ["書童", "墨客", "秀才", "舉人", "探花", "榜眼", "狀元", "大師", "宗師", "泰斗"];

// We will store the user's data here for now.
let userScore = 0;
let userCoins = 0;
let weeklyScore = 0;
let equippedEmoji = "";

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

function renderLevelTable() {
    const tbody = document.getElementById('level-table-body'); if (!tbody) return;
    let html = "";
    for (let i = 1; i <= 99; i++) {
        let name = prefixes[Math.floor((i - 1) / 10)] + nouns[(i - 1) % 10];
        let reqScore = 20 * Math.pow(i - 1, 2);
        html += `<tr><td>Lv.${i}</td><td>${name}</td><td>${reqScore}</td></tr>`;
    }
    tbody.innerHTML = html;
}

function addPoints(points) {
    if (window.currentUser && window.currentUser.role === 'teacher') return;
    userScore += points;
    userCoins += points;
    weeklyScore += points;
    updateScoreUI();
}

function deductCoins(amount) {
    if (window.currentUser && window.currentUser.role === 'teacher') return true;
    if (userCoins < amount) return false;
    userCoins -= amount;
    updateScoreUI();
    return true;
}

function updateScoreUI() {
    document.getElementById('score').innerText = userScore;
    document.getElementById('coins').innerText = userCoins;
    const pet = getPetInfo(userScore);
    const levelText = `${pet.name} (Lv.${pet.lv})`;
    document.getElementById('pet-avatar').innerText = pet.emoji;
    document.getElementById('pet-level').innerText = levelText;
    const bigPet = document.getElementById('big-pet-emoji');
    if (bigPet) {
        bigPet.innerText = pet.emoji;
        document.getElementById('big-pet-name').innerText = levelText;
        document.getElementById('next-level-req').innerText = (pet.nextScore - userScore > 0) ? (pet.nextScore - userScore) : 0;
    }
    if (window.currentUser) {
        const displayNameWithEmoji = (equippedEmoji ? equippedEmoji + " " : "") + window.currentUser.displayName;
        document.getElementById('user-display-name').innerText = displayNameWithEmoji;
    }
}

// Make functions public so other modules can use them.
window.addPoints = addPoints;
window.deductCoins = deductCoins;
window.updateScoreUI = updateScoreUI;
window.renderLevelTable = renderLevelTable;
