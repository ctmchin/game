// ========================================================
// MODULE: profile.js
// ========================================================
const prefixes = ["見習", "尚學", "勤奮", "通達", "睿智", "超凡", "入聖", "登峰", "造極", "傳說"];
const nouns = ["書童", "墨客", "秀才", "舉人", "探花", "榜眼", "狀元", "大師", "宗師", "泰斗"];
let userScore = 0, userCoins = 0, weeklyScore = 0, equippedEmoji = "";

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
    document.getElementById('score').innerText = userScore;
    document.getElementById('coins').innerText = userCoins;
    const pet = getPetInfo(userScore);
    const levelText = `${pet.name} (Lv.${pet.lv})`;
    document.getElementById('pet-avatar').innerText = pet.emoji;
    document.getElementById('pet-level').innerText = levelText;
    if (window.currentUser) {
        const displayNameWithEmoji = (equippedEmoji ? equippedEmoji + " " : "") + window.currentUser.displayName;
        document.getElementById('user-display-name').innerText = displayNameWithEmoji;
    }
}
window.updateScoreUI = updateScoreUI;

function addPoints(points) {
    if (window.currentUser && window.currentUser.role === 'teacher') return;
    userScore += points;
    userCoins += points;
    weeklyScore += points;
    updateScoreUI();
}
window.addPoints = addPoints;
