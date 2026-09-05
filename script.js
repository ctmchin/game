// ========================================================
// 1. FIREBASE 初始化 & 絕對安全帳號認證
// ========================================================
let currentUser = null; let memos = []; let userScore = 0; let userCoins = 0; let weeklyScore = 0; let db = null;
let userEmojis = []; let equippedEmoji = ""; let userItems = []; let userBags = []; 
let engineStarted = false; let engine, render, runner, world;



// ========================================================
// 2. 🐉 100級 指數動態稱號系統
// ========================================================
const prefixes = ["見習", "尚學", "勤奮", "通達", "睿智", "超凡", "入聖", "登峰", "造極", "傳說"];
const nouns = ["書童", "墨客", "秀才", "舉人", "探花", "榜眼", "狀元", "大師", "宗師", "泰斗"];

function getPetInfo(score) {
    if(score >= 99999) return { lv: 100, name: "🌟 中文宇宙真神", emoji: "👑", nextScore: 99999 };
    // 公式: Lv = √(Score/20) + 1。逆推: Score = 20 * (Lv-1)^2
    let lv = Math.floor(Math.sqrt(score / 20)) + 1; if (lv > 99) lv = 99;
    let nextScore = 20 * Math.pow(lv, 2); 
    
    let emoji = '🌱';
    if(lv >= 10) emoji = '🌿'; if(lv >= 20) emoji = '📚'; if(lv >= 30) emoji = '✍️'; if(lv >= 40) emoji = '🖋️'; 
    if(lv >= 50) emoji = '🦄'; if(lv >= 60) emoji = '🦅'; if(lv >= 70) emoji = '🎓'; if(lv >= 80) emoji = '📜'; if(lv >= 90) emoji = '🐉';
    
    let name = prefixes[Math.floor((lv-1)/10)] + nouns[(lv-1)%10];
    return { lv, name, emoji, nextScore };
}

function renderLevelTable() {
    const tbody = document.getElementById('level-table-body'); if(!tbody) return;
    let html = "";
    for(let i=1; i<=99; i++) {
        let name = prefixes[Math.floor((i-1)/10)] + nouns[(i-1)%10];
        let reqScore = 20 * Math.pow(i-1, 2);
        html += `<tr><td>Lv.${i}</td><td>${name}</td><td>${reqScore}</td></tr>`;
    }
    tbody.innerHTML = html;
}

function addPoints(points) { if(currentUser.role === 'teacher') return; userScore += points; userCoins += points; weeklyScore += points; if(db) db.collection('users').doc(currentUser.uid).update({ score: userScore, coins: userCoins, weeklyScore: weeklyScore }); updateScoreUI(); }
function deductCoins(amount) { if(currentUser.role === 'teacher') return true; if(userCoins < amount) return false; userCoins -= amount; if(db) db.collection('users').doc(currentUser.uid).update({ coins: userCoins }); updateScoreUI(); return true; }
function updateScoreUI() { 
    document.getElementById('score').innerText = userScore; document.getElementById('coins').innerText = userCoins;
    const pet = getPetInfo(userScore); const levelText = `${pet.name} (Lv.${pet.lv})`; 
    document.getElementById('pet-avatar').innerText = pet.emoji; document.getElementById('pet-level').innerText = levelText; 
    const bigPet = document.getElementById('big-pet-emoji'); 
    if(bigPet) { bigPet.innerText = pet.emoji; document.getElementById('big-pet-name').innerText = levelText; document.getElementById('next-level-req').innerText = (pet.nextScore - userScore > 0) ? (pet.nextScore - userScore) : 0; } 
    const displayNameWithEmoji = (equippedEmoji ? equippedEmoji + " " : "") + currentUser.displayName;
    document.getElementById('user-display-name').innerText = displayNameWithEmoji;
}

// 螢光筆
let pendingSelectedText = ""; const mobileBar = document.getElementById('mobile-highlight-bar');
document.addEventListener('selectionchange', function() { const selection = window.getSelection(); const selectedStr = selection.toString().trim(); if (selectedStr.length > 0 && document.getElementById('article-content').contains(selection.getRangeAt(0).commonAncestorContainer.nodeType===3?selection.getRangeAt(0).commonAncestorContainer.parentNode:selection.getRangeAt(0).commonAncestorContainer)) { pendingSelectedText = selectedStr; document.getElementById('highlight-text-preview').innerText = selectedStr.length > 15 ? selectedStr.substring(0, 8) + " ... " + selectedStr.substring(selectedStr.length - 4) : selectedStr; mobileBar.classList.remove('hidden'); } else { mobileBar.classList.add('hidden'); } });
function confirmSaveHighlight() { if (pendingSelectedText.length > 0) { memos.unshift({ content: pendingSelectedText, time: new Date().toLocaleString() }); updateMemoUI(); localStorage.setItem(`memos_${currentUser.uid}`, JSON.stringify(memos)); alert("🖍️ 重點已收藏！"); window.getSelection().removeAllRanges(); mobileBar.classList.add('hidden'); } }
function closeHighlightBar() { mobileBar.classList.add('hidden'); pendingSelectedText = ""; }
function addManualMemo() { const input = document.getElementById('manual-memo-input'); const text = input.value.trim(); if(text !== "") { memos.unshift({ content: text, time: new Date().toLocaleString() }); updateMemoUI(); localStorage.setItem(`memos_${currentUser.uid}`, JSON.stringify(memos)); input.value = ""; alert("儲存成功！"); } }
function updateMemoUI() { const list = document.getElementById('memo-list'); if (memos.length === 0) { list.innerHTML = '<p style="color: #888; text-align: center;">暫無筆記</p>'; return; } list.innerHTML = memos.map(m => `<div class="memo-item"><p>${m.content}</p><div class="memo-time">${m.time}</div></div>`).join(''); }
function loadMemos(uid) { const saved = localStorage.getItem(`memos_${uid}`); memos = saved ? JSON.parse(saved) : []; updateMemoUI(); }




const ancientModernData = [{ question: "「其實味不同」中「其實」意思？", options: ["A. 實際上", "B. 它的果實", "C. 道理", "D. 實在"], correctIndex: 1, explanation: "其：它的，實：果實。" }]; 

const themeData = [{ question: "《微笑以對》立意最深刻？", options: ["A. 失敗後，我決定在大家面前勉強擠出一個微笑，掩飾悲傷。", "B. 只要我們保持微笑，這世界上的所有問題都會自動解決。", "C. 經歷人生挫折後，內心真正釋懷，以豁達的態度微笑面對無常。", "D. 看到路人對我微笑覺得很溫暖，我決定每天對同學微笑。"], correctIndex: 2, explanation: "C 將『微笑動作』昇華為『豁達的人生態度』，立意最高。" }]; 
const materialData = [{ question: "《重遊舊地》想表達「物是人非」？", options: ["A. 舊地的公園設施全部翻新了，生鏽鞦韆換成了繽紛的滑梯。", "B. 舊居風景美麗如畫，果樹結滿果實，回憶瞬間湧現。", "C. 舊招牌被無情拆除，熟悉的雜貨店老闆黯然結業，人情味蕩然無存。", "D. 在舊地巧遇多年不見的小學同學和班主任，大家開心地敘舊。"], correctIndex: 2, explanation: "C 的細節最能觸動人心，展現強烈的今昔對比與失落感。" }]; 
const logicData = [{ question: "論點：「逆境激發潛能」。論據：「司馬遷」。", options: ["A. 他是偉大的歷史學家，我們應該學習他在逆境中讀歷史。", "B. 如果他沒有受刑，就不會寫史記。每個人都要經歷殘酷才能成功。", "C. 遭遇極大挫折，但他將悲憤化為寫作動力，證明逆境能激發潛能。", "D. 雖然遭遇不幸，但依然熱愛生活，告訴我們逆境也要保持愉快。"], correctIndex: 2, explanation: "C 完美解釋了『逆境』如何轉化為『潛能』。" }];

const matchPairs = [
  // === 【第 1 批：原本的 100 題】 ===
  { ancient: "走", modern: "跑" }, // 1
  { ancient: "妻子", modern: "妻子與兒女" }, // 2
  { ancient: "去", modern: "離開" }, // 3
  { ancient: "股", modern: "大腿" }, // 4
  { ancient: "湯", modern: "熱水" }, // 5
  { ancient: "臭", modern: "氣味" }, // 6
  { ancient: "涕", modern: "眼淚" }, // 7
  { ancient: "兵", modern: "兵器" }, // 8
  { ancient: "賊", modern: "刺客或強盜" }, // 9
  { ancient: "爪牙", modern: "得力助手" }, // 10
  { ancient: "犧牲", modern: "祭祀用的牲畜" }, // 11
  { ancient: "烈士", modern: "有志氣的人" }, // 12
  { ancient: "交通", modern: "交錯相通" }, // 13
  { ancient: "絕境", modern: "與世隔絕的地方" }, // 14
  { ancient: "無論", modern: "更不必說" }, // 15
  { ancient: "其實", modern: "它的果實" }, // 16
  { ancient: "祖父", modern: "祖父和父親" }, // 17
  { ancient: "地方", modern: "土地方圓" }, // 18
  { ancient: "山東", modern: "崤山以東" }, // 19
  { ancient: "中國", modern: "中原地區" }, // 20
  { ancient: "雖然", modern: "雖然如此" }, // 21
  { ancient: "以為", modern: "把...當作" }, // 22
  { ancient: "可以", modern: "可以憑藉" }, // 23
  { ancient: "指示", modern: "指給...看" }, // 24
  { ancient: "故事", modern: "舊例" }, // 25
  { ancient: "於是", modern: "在這時" }, // 26
  { ancient: "幾何", modern: "多少" }, // 27
  { ancient: "左右", modern: "身邊的侍臣" }, // 28
  { ancient: "丈夫", modern: "男子漢" }, // 29
  { ancient: "丈人", modern: "長輩" }, // 30
  { ancient: "卑鄙", modern: "地位低下，見識淺陋" }, // 31
  { ancient: "痛恨", modern: "痛心遺憾" }, // 32
  { ancient: "感激", modern: "感動奮發" }, // 33
  { ancient: "突出", modern: "突然衝出" }, // 34
  { ancient: "逢迎", modern: "迎接" }, // 35
  { ancient: "成立", modern: "成長立業" }, // 36
  { ancient: "結束", modern: "整理裝束" }, // 37
  { ancient: "宣告", modern: "宣佈" }, // 38
  { ancient: "便宜", modern: "應機處理" }, // 39
  { ancient: "經濟", modern: "經世濟民" }, // 40
  { ancient: "顏色", modern: "面貌容顏" }, // 41
  { ancient: "風流", modern: "傑出不凡" }, // 42
  { ancient: "青春", modern: "春天" }, // 43
  { ancient: "往往", modern: "到處" }, // 44
  { ancient: "紛紛", modern: "眾多" }, // 45
  { ancient: "區區", modern: "微小" }, // 46
  { ancient: "竊", modern: "私下 (謙辭)" }, // 47
  { ancient: "假", modern: "借用" }, // 48
  { ancient: "稍", modern: "漸漸" }, // 49
  { ancient: "尋", modern: "不久" }, // 50
  { ancient: "俄而", modern: "不久" }, // 51
  { ancient: "適", modern: "剛才" }, // 52
  { ancient: "殆", modern: "大概或危險" }, // 53
  { ancient: "蓋", modern: "原來是" }, // 54
  { ancient: "誠", modern: "確實" }, // 55
  { ancient: "固", modern: "本來" }, // 56
  { ancient: "必", modern: "一定" }, // 57
  { ancient: "舉", modern: "全" }, // 58
  { ancient: "凡", modern: "總共" }, // 59
  { ancient: "但", modern: "只" }, // 60
  { ancient: "徒", modern: "徒然或只" }, // 61
  { ancient: "特", modern: "只" }, // 62
  { ancient: "第", modern: "只是" }, // 63
  { ancient: "乃", modern: "竟或於是" }, // 64
  { ancient: "則", modern: "就" }, // 65
  { ancient: "即", modern: "就" }, // 66
  { ancient: "因", modern: "趁機" }, // 67
  { ancient: "故", modern: "舊的或所以" }, // 68
  { ancient: "遂", modern: "於是" }, // 69
  { ancient: "孰", modern: "誰" }, // 70
  { ancient: "安", modern: "哪裡" }, // 71
  { ancient: "惡", modern: "怎麼 (疑問詞)" }, // 72
  { ancient: "居", modern: "停留" }, // 73
  { ancient: "幸", modern: "僥倖" }, // 74
  { ancient: "勸", modern: "勉勵" }, // 75
  { ancient: "窮", modern: "走投無路" }, // 76
  { ancient: "鮮", modern: "少" }, // 77
  { ancient: "數", modern: "屢次" }, // 78
  { ancient: "復", modern: "再" }, // 79
  { ancient: "辭", modern: "告辭" }, // 80
  { ancient: "謝", modern: "道歉或推辭" }, // 81
  { ancient: "伐", modern: "誇耀或攻打" }, // 82
  { ancient: "負", modern: "背棄或辜負" }, // 83
  { ancient: "責", modern: "索求或責備" }, // 84
  { ancient: "疾", modern: "快或病" }, // 85
  { ancient: "恨", modern: "遺憾" }, // 86
  { ancient: "憐", modern: "愛惜或同情" }, // 87
  { ancient: "善", modern: "交好或擅長" }, // 88
  { ancient: "患", modern: "擔憂或禍患" }, // 89
  { ancient: "治", modern: "管理好" }, // 90
  { ancient: "亂", modern: "叛亂" }, // 91
  { ancient: "亡", modern: "逃跑或滅亡" }, // 92
  { ancient: "北", modern: "打敗逃跑" }, // 93
  { ancient: "降", modern: "投降" }, // 94
  { ancient: "克", modern: "戰勝" }, // 95
  { ancient: "拔", modern: "攻取" }, // 96
  { ancient: "布衣", modern: "平民" }, // 97
  { ancient: "白丁", modern: "沒有學問的人" }, // 98
  { ancient: "絲竹", modern: "音樂" }, // 99
  { ancient: "案牘", modern: "公文" }, // 100

  // === 【第 2 批：先前追加的 100 題】 ===
  { ancient: "智力", modern: "智謀與力量" }, // 101
  { ancient: "物理", modern: "事物的道理" }, // 102
  { ancient: "自由", modern: "自作主張" }, // 103
  { ancient: "具體", modern: "具備形體" }, // 104
  { ancient: "影響", modern: "影子與回聲" }, // 105
  { ancient: "經營", modern: "籌劃營造" }, // 106
  { ancient: "殷勤", modern: "懇切與情意深厚" }, // 107
  { ancient: "躊躇", modern: "從容自得" }, // 108
  { ancient: "行李", modern: "外交使節" }, // 109
  { ancient: "首領", modern: "頭和脖子" }, // 110
  { ancient: "婚姻", modern: "親家" }, // 111
  { ancient: "舅姑", modern: "公婆" }, // 112
  { ancient: "知識", modern: "結識的朋友" }, // 113
  { ancient: "文章", modern: "華美的色彩或法度" }, // 114
  { ancient: "文學", modern: "文獻與學者" }, // 115
  { ancient: "學者", modern: "求學的人" }, // 116
  { ancient: "教授", modern: "傳授學業" }, // 117
  { ancient: "博士", modern: "專精某種技藝的官員" }, // 118
  { ancient: "大學", modern: "大人之學" }, // 119
  { ancient: "小學", modern: "文字訓詁之學" }, // 120
  { ancient: "參政", modern: "參與政事" }, // 121
  { ancient: "政治", modern: "政事處理得當" }, // 122
  { ancient: "黨派", modern: "朋黨 (偏貶義)" }, // 123
  { ancient: "革命", modern: "改朝換代 (天命變更)" }, // 124
  { ancient: "封建", modern: "封邦建國" }, // 125
  { ancient: "社會", modern: "村民祭神集會" }, // 126
  { ancient: "權利", modern: "權勢與利益" }, // 127
  { ancient: "義務", modern: "見義勇為" }, // 128
  { ancient: "法律", modern: "刑法條文" }, // 129
  { ancient: "風氣", modern: "風化與習俗" }, // 130
  { ancient: "獄", modern: "訴訟案件" }, // 131
  { ancient: "案", modern: "查究或木盤" }, // 132
  { ancient: "簡", modern: "竹簡或選拔" }, // 133
  { ancient: "策", modern: "竹簡或計謀" }, // 134
  { ancient: "表", modern: "給皇帝的奏章" }, // 135
  { ancient: "疏", modern: "分條陳述的奏章" }, // 136
  { ancient: "啟", modern: "陳述與書信" }, // 137
  { ancient: "令", modern: "縣令或美好" }, // 138
  { ancient: "國", modern: "國都或諸侯國" }, // 139
  { ancient: "邦", modern: "諸侯國" }, // 140
  { ancient: "野", modern: "郊外" }, // 141
  { ancient: "鄉", modern: "基層行政單位" }, // 142
  { ancient: "里", modern: "二十五家為一里" }, // 143
  { ancient: "面目", modern: "容貌" }, // 144
  { ancient: "魚肉", modern: "殘害百姓" }, // 145
  { ancient: "先生", modern: "年長有學問的人" }, // 146
  { ancient: "童子", modern: "未成年人" }, // 147
  { ancient: "弟子", modern: "學生" }, // 148
  { ancient: "小人", modern: "平民或品行不端者" }, // 149
  { ancient: "君子", modern: "貴族或有德行者" }, // 150
  { ancient: "陛下", modern: "對皇上的尊稱" }, // 151
  { ancient: "足下", modern: "對同輩或下屬的敬稱" }, // 152
  { ancient: "朋", modern: "結黨勾結" }, // 153
  { ancient: "曹", modern: "輩與類" }, // 154
  { ancient: "輩", modern: "類與等" }, // 155
  { ancient: "屬", modern: "類別" }, // 156
  { ancient: "倫", modern: "條理或同類" }, // 157
  { ancient: "徒黨", modern: "同類的人 (偏貶義)" }, // 158
  { ancient: "族", modern: "滅族或家族" }, // 159
  { ancient: "類", modern: "種類" }, // 160
  { ancient: "賦", modern: "收稅" }, // 161
  { ancient: "賄", modern: "贈送財物" }, // 162
  { ancient: "購", modern: "懸賞徵求" }, // 163
  { ancient: "售", modern: "賣出去" }, // 164
  { ancient: "賈", modern: "商人" }, // 165
  { ancient: "坐", modern: "因為或牽連治罪" }, // 166
  { ancient: "乘", modern: "兵車或駕車" }, // 167
  { ancient: "除", modern: "授予官職" }, // 168
  { ancient: "拜", modern: "授予官職" }, // 169
  { ancient: "遷", modern: "調動官職或貶謫" }, // 170
  { ancient: "謫", modern: "降職" }, // 171
  { ancient: "罷", modern: "免去官職" }, // 172
  { ancient: "擢", modern: "提拔" }, // 173
  { ancient: "孤", modern: "幼年喪父與君王自稱" }, // 174
  { ancient: "獨", modern: "老而無子" }, // 175
  { ancient: "矜", modern: "自誇或憐憫" }, // 176
  { ancient: "寡", modern: "老而無夫" }, // 177
  { ancient: "幼", modern: "未滿十歲" }, // 178
  { ancient: "長", modern: "年長或首領" }, // 179
  { ancient: "老", modern: "七十歲" }, // 180
  { ancient: "壽", modern: "敬酒或長壽" }, // 181
  { ancient: "考", modern: "父親" }, // 182
  { ancient: "旦", modern: "早晨" }, // 183
  { ancient: "暮", modern: "傍晚" }, // 184
  { ancient: "宵", modern: "夜晚" }, // 185
  { ancient: "旬", modern: "十天" }, // 186
  { ancient: "紀", modern: "十二年" }, // 187
  { ancient: "世", modern: "三十年" }, // 188
  { ancient: "載", modern: "年" }, // 189
  { ancient: "歲", modern: "年" }, // 190
  { ancient: "秋", modern: "時候或年份" }, // 191
  { ancient: "犧", modern: "純色牲畜" }, // 192
  { ancient: "羹", modern: "帶汁的肉" }, // 193
  { ancient: "炙", modern: "烤肉" }, // 194
  { ancient: "鼎", modern: "烹飪器具" }, // 195
  { ancient: "幣", modern: "絲織品或禮物" }, // 196
  { ancient: "帛", modern: "絲織品總稱" }, // 197
  { ancient: "褐", modern: "粗布衣" }, // 198
  { ancient: "裘", modern: "皮衣" }, // 199
  { ancient: "履", modern: "鞋子或踩踏" }, // 200

  // === 【第 3 批：全新追加 101~200，總計第 201~300 題】 ===
  { ancient: "冠", modern: "帽子或成年" }, // 201
  { ancient: "舍", modern: "客舍或捨棄" }, // 202
  { ancient: "次", modern: "臨時駐紮" }, // 203
  { ancient: "造", modern: "前往或成就" }, // 204
  { ancient: "就", modern: "靠近或完成" }, // 205
  { ancient: "及", modern: "等到或比得上" }, // 206
  { ancient: "向", modern: "從前" }, // 207
  { ancient: "初", modern: "當初" }, // 208
  { ancient: "方", modern: "正當或才" }, // 209
  { ancient: "會", modern: "適逢" }, // 210
  { ancient: "已而", modern: "不久" }, // 211
  { ancient: "忽", modern: "突然" }, // 212
  { ancient: "遽", modern: "急忙或立刻" }, // 213
  { ancient: "卒", modern: "突然或死" }, // 214
  { ancient: "立", modern: "立刻或站立" }, // 215
  { ancient: "旋", modern: "不久或返回" }, // 216
  { ancient: "亟", modern: "屢次或急迫" }, // 217
  { ancient: "屢", modern: "多次" }, // 218
  { ancient: "更", modern: "再或改變" }, // 219
  { ancient: "重", modern: "再次或看重" }, // 220
  { ancient: "還", modern: "仍然或返回" }, // 221
  { ancient: "亦", modern: "也" }, // 222
  { ancient: "皆", modern: "都" }, // 223
  { ancient: "咸", modern: "都" }, // 224
  { ancient: "悉", modern: "全或都" }, // 225
  { ancient: "畢", modern: "盡或都" }, // 226
  { ancient: "具", modern: "全都或準備" }, // 227
  { ancient: "盡", modern: "完或都" }, // 228
  { ancient: "勝", modern: "盡或能承受" }, // 229
  { ancient: "僅", modern: "將近" }, // 230
  { ancient: "幾乎", modern: "將近" }, // 231
  { ancient: "庶幾", modern: "或許或差不多" }, // 232
  { ancient: "或許", modern: "大概" }, // 233
  { ancient: "無乃", modern: "恐怕" }, // 234
  { ancient: "得無", modern: "該不會" }, // 235
  { ancient: "其", modern: "大概或難道" }, // 236
  { ancient: "信", modern: "確實或信用" }, // 237
  { ancient: "素", modern: "向來或平素" }, // 238
  { ancient: "雅", modern: "向來或高雅" }, // 239
  { ancient: "嘗", modern: "曾經" }, // 240
  { ancient: "曾", modern: "曾經" }, // 241
  { ancient: "業", modern: "已經或學業" }, // 242
  { ancient: "既", modern: "已經" }, // 243
  { ancient: "已", modern: "已經或停止" }, // 244
  { ancient: "未", modern: "沒有" }, // 245
  { ancient: "弗", modern: "不" }, // 246
  { ancient: "勿", modern: "不要" }, // 247
  { ancient: "毋", modern: "不要" }, // 248
  { ancient: "無", modern: "沒有或不要" }, // 249
  { ancient: "莫", modern: "沒有誰或不要" }, // 250
  { ancient: "非", modern: "不是或非難" }, // 251
  { ancient: "微", modern: "如果沒有或微小" }, // 252
  { ancient: "罔", modern: "無或欺騙" }, // 253
  { ancient: "靡", modern: "沒有或倒下" }, // 254
  { ancient: "否", modern: "不或壞運氣" }, // 255
  { ancient: "焉", modern: "怎麼或於此" }, // 256
  { ancient: "胡", modern: "為什麼" }, // 257
  { ancient: "曷", modern: "何或何時" }, // 258
  { ancient: "奚", modern: "怎麼或什麼" }, // 259
  { ancient: "何", modern: "什麼或怎麼" }, // 260
  { ancient: "曷為", modern: "為什麼" }, // 261
  { ancient: "何以", modern: "憑什麼" }, // 262
  { ancient: "或", modern: "有的人或或許" }, // 263
  { ancient: "各", modern: "各自" }, // 264
  { ancient: "相", modern: "互相或偏指一方" }, // 265
  { ancient: "見", modern: "被或放在動詞前表對我" }, // 266
  { ancient: "被", modern: "遭受或被" }, // 267
  { ancient: "為", modern: "被或做" }, // 268
  { ancient: "所以", modern: "用來...的或原因" }, // 269
  { ancient: "所", modern: "用來...的" }, // 270
  { ancient: "者", modern: "的人或事物" }, // 271
  { ancient: "之", modern: "的或代詞或去" }, // 272
  { ancient: "此", modern: "這" }, // 273
  { ancient: "是", modern: "這" }, // 274
  { ancient: "斯", modern: "這" }, // 275
  { ancient: "茲", modern: "這" }, // 276
  { ancient: "彼", modern: "那" }, // 277
  { ancient: "夫", modern: "那或發語詞" }, // 278
  { ancient: "爾", modern: "你或那" }, // 279
  { ancient: "若", modern: "你或像" }, // 280
  { ancient: "而", modern: "你或然而或並且" }, // 281
  { ancient: "且", modern: "而且或將要" }, // 282
  { ancient: "雖", modern: "雖然或即使" }, // 283
  { ancient: "然", modern: "然而或這樣" }, // 284
  { ancient: "縱", modern: "即使" }, // 285
  { ancient: "使", modern: "假使或派遣" }, // 286
  { ancient: "向使", modern: "假使" }, // 287
  { ancient: "如", modern: "如果或像" }, // 288
  { ancient: "若夫", modern: "至於" }, // 289
  { ancient: "至若", modern: "至於" }, // 290
  { ancient: "嗟乎", modern: "唉" }, // 291
  { ancient: "嗚呼", modern: "唉" }, // 292
  { ancient: "噫", modern: "唉" }, // 293
  { ancient: "客", modern: "外來者或門客" }, // 294
  { ancient: "主", modern: "主人或君主" }, // 295
  { ancient: "賓", modern: "賓客" }, // 296
  { ancient: "東道主", modern: "請客的主人" }, // 297
  { ancient: "僕", modern: "奴僕或我的謙稱" }, // 298
  { ancient: "妾", modern: "女奴或女子的謙稱" }, // 299
  { ancient: "臣", modern: "臣子或臣的謙稱" }, // 300

  // === 【第 4 批：全新追加 201~300，總計第 301~400 題】 ===
  { ancient: "愚", modern: "愚笨或我的謙稱" }, // 301
  { ancient: "不才", modern: "沒有才能或我的謙稱" }, // 302
  { ancient: "寡人", modern: "寡德之人或君主謙稱" }, // 303
  { ancient: "朕", modern: "我的代稱" }, // 304
  { ancient: "卿", modern: "官名或對人的尊稱" }, // 305
  { ancient: "公", modern: "爵位或尊稱" }, // 306
  { ancient: "子", modern: "兒子或尊稱" }, // 307
  { ancient: "長者", modern: "年長或德高望重者" }, // 308
  { ancient: "嫗", modern: "老婦人" }, // 309
  { ancient: "媼", modern: "老婦人" }, // 310
  { ancient: "孺子", modern: "小孩子" }, // 311
  { ancient: "匹夫", modern: "平民" }, // 312
  { ancient: "豎子", modern: "小子或罵人的話" }, // 313
  { ancient: "儔", modern: "同類或伴侶" }, // 314
  { ancient: "儔類", modern: "同類" }, // 315
  { ancient: "儔匹", modern: "伴侶" }, // 316
  { ancient: "儕", modern: "同輩" }, // 317
  { ancient: "媵", modern: "陪嫁的人" }, // 318
  { ancient: "妾媵", modern: "妾侍" }, // 319
  { ancient: "姬", modern: "妾或美女" }, // 320
  { ancient: "倡", modern: "樂人" }, // 321
  { ancient: "優", modern: "戲子或優良" }, // 322
  { ancient: "伶", modern: "樂官或戲子" }, // 323
  { ancient: "隸", modern: "奴隸或衙役" }, // 324
  { ancient: "役", modern: "差役或勞役" }, // 325
  { ancient: "工", modern: "工匠或樂師" }, // 326
  { ancient: "商", modern: "流動商人" }, // 327
  { ancient: "農", modern: "農夫" }, // 328
  { ancient: "士", modern: "讀書人或武士" }, // 329
  { ancient: "吏", modern: "小官員" }, // 330
  { ancient: "宰", modern: "主管或屠宰" }, // 331
  { ancient: "尹", modern: "官名或治理" }, // 332
  { ancient: "丞", modern: "副手" }, // 333
  { ancient: "尉", modern: "武官" }, // 334
  { ancient: "侯", modern: "爵位" }, // 335
  { ancient: "王", modern: "君王" }, // 336
  { ancient: "帝", modern: "皇帝" }, // 337
  { ancient: "皇", modern: "皇帝" }, // 338
  { ancient: "宮", modern: "房屋或皇宮" }, // 339
  { ancient: "室", modern: "房間或家" }, // 340
  { ancient: "宇", modern: "屋簷或房屋" }, // 341
  { ancient: "宙", modern: "古往今來的時間" }, // 342
  { ancient: "廬", modern: "簡陋的房屋" }, // 343
  { ancient: "館", modern: "客舍" }, // 344
  { ancient: "邸", modern: "高級客舍" }, // 345
  { ancient: "驛", modern: "驛站" }, // 346
  { ancient: "亭", modern: "供旅客停宿的地方" }, // 347
  { ancient: "城", modern: "城牆或城市" }, // 348
  { ancient: "郭", modern: "外城" }, // 349
  { ancient: "池", modern: "護城河或池塘" }, // 350
  { ancient: "隍", modern: "沒有水的護城河" }, // 351
  { ancient: "關", modern: "關口" }, // 352
  { ancient: "隘", modern: "險要的通道" }, // 353
  { ancient: "塞", modern: "邊界險要處或堵住" }, // 354
  { ancient: "鄙", modern: "邊境或淺陋" }, // 355
  { ancient: "都", modern: "大城市或建都" }, // 356
  { ancient: "邑", modern: "城鎮" }, // 357
  { ancient: "市", modern: "市場或買賣" }, // 358
  { ancient: "朝", modern: "早晨或朝廷" }, // 359
  { ancient: "巷", modern: "胡同" }, // 360
  { ancient: "陌", modern: "田間小路" }, // 361
  { ancient: "阡", modern: "南北向小路" }, // 362
  { ancient: "道", modern: "道路或道理" }, // 363
  { ancient: "徑", modern: "小路" }, // 364
  { ancient: "舟", modern: "船" }, // 365
  { ancient: "楫", modern: "船槳" }, // 366
  { ancient: "帆", modern: "船帆" }, // 367
  { ancient: "櫓", modern: "搖船的槳" }, // 368
  { ancient: "艦", modern: "大型戰船" }, // 369
  { ancient: "車", modern: "車子" }, // 370
  { ancient: "輿", modern: "車廂或轎子" }, // 371
  { ancient: "輦", modern: "帝王坐的車" }, // 372
  { ancient: "轍", modern: "車輪壓出的痕跡" }, // 373
  { ancient: "馬", modern: "馬匹" }, // 374
  { ancient: "駒", modern: "少壯的馬" }, // 375
  { ancient: "驥", modern: "好馬" }, // 376
  { ancient: "駟", modern: "四匹馬拉的車" }, // 377
  { ancient: "駕", modern: "車乘或帝王" }, // 378
  { ancient: "犬", modern: "狗" }, // 379
  { ancient: "豕", modern: "豬" }, // 380
  { ancient: "豚", modern: "小豬" }, // 381
  { ancient: "牛", modern: "牛隻" }, // 382
  { ancient: "羊", modern: "羊隻" }, // 383
  { ancient: "禽", modern: "鳥獸的總稱" }, // 384
  { ancient: "獸", modern: "野獸" }, // 385
  { ancient: "魚", modern: "魚類" }, // 386
  { ancient: "龍", modern: "傳說中的神物或帝王象徵" }, // 387
  { ancient: "鳳", modern: "傳說中的神鳥" }, // 388
  { ancient: "龜", modern: "烏龜或占卜" }, // 389
  { ancient: "麟", modern: "麒麟" }, // 390
  { ancient: "木", modern: "樹木" }, // 391
  { ancient: "草", modern: "草本植物" }, // 392
  { ancient: "花", modern: "花朵" }, // 393
  { ancient: "葉", modern: "樹葉" }, // 394
  { ancient: "根", modern: "植物的根" }, // 395
  { ancient: "枝", modern: "樹枝" }, // 396
  { ancient: "果", modern: "果實" }, // 397
  { ancient: "穀", modern: "糧食作物的總稱" }, // 398
  { ancient: "麥", modern: "麥子" }, // 399
  { ancient: "禾", modern: "稻穀" }  // 400
];

let selectedAncient = null;
let matchedCount = 0;
let currentRoundPairs = []; // 儲存本局抽出的題目

function initMatchGame() {
    const leftContainer = document.getElementById('match-left');
    const rightContainer = document.getElementById('match-right');
    if(!leftContainer) return;
    
    // 重置狀態
    selectedAncient = null;
    matchedCount = 0;
    const fbEl = document.getElementById('match-feedback');
    if(fbEl) fbEl.classList.add('hidden');

    // ★ 從 400 題中隨機抽取 10 題進行本局遊戲
    const shuffledAll = [...matchPairs].sort(() => Math.random() - 0.5);
    currentRoundPairs = shuffledAll.slice(0, 10); 

    // 將抽出的題目打亂放入左右欄
    let ancients = [...currentRoundPairs].sort(() => Math.random() - 0.5);
    let moderns = [...currentRoundPairs].sort(() => Math.random() - 0.5);

    leftContainer.innerHTML = ancients.map((p, i) => 
        `<button class="btn-option" id="ancient-${i}" onclick="selectAncient(${i}, '${p.ancient}')">${p.ancient}</button>`
    ).join('');
    
    rightContainer.innerHTML = moderns.map((p, i) => 
        `<button class="btn-option" id="modern-${i}" onclick="selectModern(${i}, '${p.modern}')">${p.modern}</button>`
    ).join('');
}

function selectAncient(index, text) {
    document.querySelectorAll('#match-left .btn-option').forEach(b => b.style.borderColor = '#e0e0e0');
    const btn = document.getElementById(`ancient-${index}`);
    if(!btn.disabled) {
        btn.style.borderColor = '#1976d2';
        selectedAncient = { index, text, btn };
    }
}

function selectModern(index, text) {
    if(!selectedAncient) return alert("請先點擊左側文字！");
    const rightBtn = document.getElementById(`modern-${index}`);
    
    // 透過 currentRoundPairs 來比對正確答案
    const correctPair = currentRoundPairs.find(p => p.ancient === selectedAncient.text);
    
    if(correctPair.modern === text) {
        selectedAncient.btn.style.backgroundColor = '#d4edda';
        selectedAncient.btn.disabled = true;
        rightBtn.style.backgroundColor = '#d4edda';
        rightBtn.disabled = true;
        selectedAncient = null;
        matchedCount++;
        
        // 判斷是否過關 (過關條件為 currentRoundPairs.length)
        if(matchedCount === currentRoundPairs.length) {
            const fb = document.getElementById('match-feedback');
            if(fb) {
                fb.classList.remove('hidden');
                fb.className = 'feedback success';
                fb.innerHTML = "🎉 成功！獲得 30 積分！";
            }
            if(typeof addPoints === 'function') addPoints(30);
        }
    } else {
        rightBtn.style.backgroundColor = '#f8d7da';
        setTimeout(() => {
            if(!rightBtn.disabled) rightBtn.style.backgroundColor = 'white';
        }, 800);
    }
}
const bossQuestions = [ { q: "「輟耕<strong style='color:#d32f2f;'>之</strong>壟上」", options: ["A. 的", "B. 往", "C. 他"], correct: 1 }, { q: "「物外<strong style='color:#d32f2f;'>之</strong>趣」", options: ["A. 的", "B. 往", "C. 他"], correct: 0 }, { q: "「名<strong style='color:#d32f2f;'>之</strong>者誰」", options: ["A. 的", "B. 往", "C. 他"], correct: 2 } ]; let currentBossHp = 3; let currentBossQ = 0; function initBossGame() { if(!document.getElementById('boss-question')) return; if(currentBossQ < bossQuestions.length) { const q = bossQuestions[currentBossQ]; document.getElementById('boss-question').innerHTML = q.q; document.getElementById('boss-options').innerHTML = q.options.map((opt, i) => `<button class="btn-option" onclick="attackBoss(${i}, ${q.correct})">${opt}</button>`).join(''); } } function attackBoss(clicked, correct) { if(clicked === correct) { currentBossHp--; document.getElementById('boss-hp').style.width = (currentBossHp / 3 * 100) + "%"; currentBossQ++; if(currentBossHp === 0) { document.getElementById('boss-emoji').innerText = "💥"; document.getElementById('boss-question').innerText = "Boss 擊敗！"; document.getElementById('boss-options').innerHTML = ""; const fb = document.getElementById('boss-feedback'); fb.classList.remove('hidden'); fb.className = 'feedback success'; fb.innerHTML = "🎉 獲得 50 積分！"; addPoints(50); } else { alert("💥 攻擊成功！"); initBossGame(); } } else { alert("❌ 攻擊無效！"); } }
const readingQuestions = { 
    1: [ { q: "「徐以杓酌油」的「徐」是？", opts: ["A. 慢慢", "B. 快速", "C. 姓氏"], correct: 0, exp: "解作慢慢地。" }, { q: "「釋擔而立」的「釋」是？", opts: ["A. 解釋", "B. 放下", "C. 挑起"], correct: 1, exp: "放下擔子。" }, { q: "「公亦以此自矜」的「矜」是？", opts: ["A. 矜持", "B. 憐憫", "C. 自誇"], correct: 2, exp: "指驕傲自誇。" } ],
    2: [ { q: "為何錢放葫蘆口？", opts: ["A. 炫耀", "B. 展示技術", "C. 洗錢"], correct: 1, exp: "證明熟能生巧。" }, { q: "陳堯咨對賣油翁的態度發生了什麼變化？", opts: ["A. 驕傲 -> 憤怒 -> 佩服", "B. 佩服 -> 憤怒 -> 鄙視", "C. 驕傲 -> 憤怒 -> 笑著打發"], correct: 2, exp: "最後是笑著把他打發走。" }, { q: "本文主要說明的道理是？", opts: ["A. 驕兵必敗", "B. 熟能生巧", "C. 尊老愛幼"], correct: 1, exp: "無他，但手熟爾。" } ],
    3: [ { q: "【對/錯/無從判斷】賣油翁崇拜陳堯咨？", opts: ["A. 對", "B. 錯", "C. 無從判斷"], correct: 1, exp: "他只覺得是手熟。" }, { q: "【對/錯/無從判斷】陳堯咨射箭百發百中。", opts: ["A. 對", "B. 錯", "C. 無從判斷"], correct: 1, exp: "錯誤。是十中八九。" }, { q: "【對/錯/無從判斷】賣油翁以前也練過射箭。", opts: ["A. 對", "B. 錯", "C. 無從判斷"], correct: 2, exp: "無從判斷。文中未提及。" } ]
}; 
function loadReadingQuiz(level) { 
    const container = document.getElementById('reading-quiz-container'); 
    const qArray = readingQuestions[level];
    const q = qArray[Math.floor(Math.random() * qArray.length)]; // 隨機抽一題
    const points = level === 1 ? 10 : (level === 2 ? 15 : 20);
    const lvName = level === 1 ? "🌱 基礎" : (level === 2 ? "🌲 進階" : "🔥 挑戰");
    container.innerHTML = `<div style="background: #fff; padding: 20px; border-radius: 8px; border: 2px solid #1976d2;"><p style="color: #1976d2; font-weight: bold; margin-bottom: 10px;">${lvName} (+${points}分)</p><p class="question">${q.q}</p><div class="options">${q.opts.map((opt, i) => `<button class="btn-option" style="padding: 10px;" onclick="checkReadingAnswer(this, ${i}, ${q.correct}, '${q.exp}', ${points})">${opt}</button>`).join('')}</div><div class="reading-feedback hidden" style="margin-top:15px; font-weight:bold;"></div></div>`; 
} 
function checkReadingAnswer(btn, clicked, correct, exp, points) { const parent = btn.parentElement; const feedback = parent.nextElementSibling; parent.querySelectorAll('.btn-option').forEach(b => b.disabled = true); feedback.classList.remove('hidden'); if(clicked === correct) { btn.style.backgroundColor = '#d4edda'; btn.style.borderColor = '#28a745'; feedback.style.color = '#155724'; feedback.innerHTML = `🎉 答對！解析：${exp} (+${points}分)`; addPoints(points); } else { btn.style.backgroundColor = '#f8d7da'; btn.style.borderColor = '#dc3545'; feedback.style.color = '#721c24'; feedback.innerHTML = `❌ 答錯！解析：${exp}`; } }

// ========================================================
// 5. 🌟 沙盒與社群 (老師可刪除畫廊作品) 🌟
// ========================================================
const sandboxQuestions = [ "將「風吹過樹梢」加入擬人法", "將「這間教室很小」加入誇張法", "將「媽媽看著我」加入細緻的神態描寫" ];
function setupSandbox() {
    const qSpan = document.getElementById('sandbox-daily-q'); if(!qSpan) return;
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    qSpan.innerText = sandboxQuestions[dayOfYear % sandboxQuestions.length];
}

let socialData = { 8: [], 9: [], 10: [], 11: [] };

function loadSocialDataFromCloud() {
    if(!db) return;
    ['8', '9', '10', '11'].forEach(id => {
        db.collection('wall_' + id).orderBy('timestampMs', id === '10' ? 'asc' : 'desc').limit(50).onSnapshot((snapshot) => {
            socialData[id] = [];
            snapshot.forEach(doc => { let data = doc.data(); data.docId = doc.id; socialData[id].push(data); });
            renderSocial(); 
        });
    });
}

function renderSocial() {
    ['8', '9', '10'].forEach(id => {
        const wall = document.getElementById('wall-' + id); if(!wall) return;
        wall.innerHTML = socialData[id].map((item) => {
            const teacherBadge = item.teacherLiked ? `<span style="background:#ffecb3; color:#d84315; padding:2px 6px; border-radius:12px; font-size:0.8rem; margin-left:10px; font-weight:bold;">👨‍🏫 老師讚好</span>` : '';
            let actionBtns = ""; const isAuthor = currentUser && currentUser.uid === item.authorUid; const isTeacher = currentUser && currentUser.role === 'teacher';
            const timePassed = Date.now() - (item.timestampMs || 0);
            if (isAuthor && timePassed <= 300000) { actionBtns += `<span style="cursor:pointer; margin-right:10px; color:#4facfe;" onclick="editPost('${id}', '${item.docId}', '${item.text}')">✏️修改</span>`; }
            if (isAuthor || isTeacher) { actionBtns += `<span style="cursor:pointer; color:#dc3545;" onclick="deletePost('${id}', '${item.docId}')">🗑️刪除</span>`; }
            const emojiStr = item.nameEmoji ? item.nameEmoji + " " : "";

            return `<div class="memo-item" style="border-left-color: #4facfe; margin-bottom: 10px;">
                <p style="font-size:1.15rem; margin-bottom:8px;">${item.text} ${teacherBadge}</p>
                <div style="display:flex; justify-content:space-between; color:#888; font-size:0.9rem;">
                    <span>✍️ ${emojiStr}${item.name} <span style="margin-left:10px;">${actionBtns}</span></span>
                    ${id !== '10' ? `<span style="cursor:pointer;" onclick="likePost('${id}', '${item.docId}', '${item.authorUid}', ${item.likes || 0})">❤️ ${item.likes || 0}</span>` : ''}
                </div>
            </div>`;
        }).join('');
    });

    const aiWall = document.getElementById('wall-11');
    if(aiWall) {
        aiWall.innerHTML = socialData['11'].map(item => {
            const isAuthor = currentUser && currentUser.uid === item.authorUid; const isTeacher = currentUser && currentUser.role === 'teacher';
            let delBtn = (isAuthor || isTeacher) ? `<span style="cursor:pointer; color:#dc3545;" onclick="deletePost('11', '${item.docId}')">🗑️刪除</span>` : '';
            return `
            <div style="width: 45%; min-width:250px; background: #fff; padding: 10px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                <img src="${item.imgUrl}" style="width: 100%; border-radius: 8px; margin-bottom: 10px;">
                <p style="font-size: 0.9rem; color: #555; margin-bottom: 5px;">"${item.text}"</p>
                <div style="font-size: 0.8rem; color: #888; display:flex; justify-content:space-between;">
                    <span>✍️ ${item.nameEmoji || ""}${item.name} <span style="margin-left:5px;">${delBtn}</span></span>
                    <span style="cursor:pointer;" onclick="likePost('11', '${item.docId}', '${item.authorUid}', ${item.likes || 0})">❤️ ${item.likes || 0}</span>
                </div>
            </div>`;
        }).join('');
    }
}

function submitSandbox() {
    if(!currentUser) return alert("請先登入！"); 
    const input = document.getElementById('input-9'); const text = input.value.trim(); if(text === "") return alert("請輸入內容！"); 
    document.getElementById('sandbox-lock').classList.add('hidden'); document.getElementById('wall-9').classList.remove('hidden');
    const displayName = currentUser.role === 'teacher' ? `👑 ${currentUser.displayName}` : currentUser.displayName;
    const newPost = { name: displayName, nameEmoji: equippedEmoji, authorUid: currentUser.uid, text: text, likes: 0, teacherLiked: false, timestampMs: Date.now() };
    if(db) { db.collection('wall_9').add(newPost).then(() => { input.value = ""; addPoints(15); alert(`🎉 成功解鎖觀摩區！`); }); }
}

function submitSocial(id) {
    if(!currentUser) return alert("請先登入！"); 
    const input = document.getElementById('input-' + id); const text = input.value.trim(); if(text === "") return alert("請輸入內容！"); 
    const displayName = currentUser.role === 'teacher' ? `👑 ${currentUser.displayName}` : currentUser.displayName;
    const newPost = { name: displayName, nameEmoji: equippedEmoji, authorUid: currentUser.uid, text: text, likes: 0, teacherLiked: false, timestampMs: Date.now() };
    if(db) { db.collection('wall_' + id).add(newPost).then(() => { input.value = ""; addPoints(20); alert(`🎉 發佈成功！`); }); }
}

function editPost(id, docId, oldText) { const newText = prompt("修改留言 (5分鐘內)：", oldText); if(newText && newText.trim() !== "" && newText !== oldText) { if(db) db.collection('wall_' + id).doc(docId).update({ text: newText.trim() }); } }
function deletePost(id, docId) { if(confirm("確定刪除嗎？")) { if(db) db.collection('wall_' + id).doc(docId).delete(); } }
function likePost(id, docId, authorUid, currentLikes) { 
    if(!currentUser || !db) return;
    const postRef = db.collection('wall_' + id).doc(docId); const authorRef = db.collection('users').doc(authorUid);
    if(currentUser.role === 'teacher') { postRef.update({ teacherLiked: true }).then(() => { authorRef.update({ score: firebase.firestore.FieldValue.increment(20), coins: firebase.firestore.FieldValue.increment(20) }); alert("已送出「老師讚好」！"); });
    } else { postRef.update({ likes: currentLikes + 1 }).then(() => { authorRef.update({ score: firebase.firestore.FieldValue.increment(2), coins: firebase.firestore.FieldValue.increment(2) }); }); }
}

// 🌟 真實 AI 畫圖 (與分享至畫廊) 🌟
let lastAiText = ""; let lastAiUrl = "";
function generateRealAI() { 
    if(!deductCoins(100)) return alert("金幣不足 100 枚！"); 
    const input = document.getElementById('ai-input').value.trim(); 
    if(!input) return alert("請輸入文字！"); 
    const res = document.getElementById('ai-result'); 
    res.classList.remove('hidden'); res.className = 'feedback info'; res.innerHTML = "⏳ 魔法施展中，AI 正在繪製您的想像..."; 
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(input)}?width=512&height=512&nologo=true`;
    lastAiText = input; lastAiUrl = url;
    setTimeout(() => { 
        res.className = 'feedback success'; 
        res.innerHTML = `🎨 生成成功！<br><img src="${url}" style="width:100%; max-width:300px; border-radius:8px; margin-top:15px; box-shadow:0 4px 10px rgba(0,0,0,0.2);"/><br><button class="btn-primary" style="margin-top:15px; background:#4caf50;" onclick="shareToAIGallery()">將作品公開分享至畫廊</button>`; 
    }, 1500); 
}
function shareToAIGallery() {
    if(!currentUser || !db || !lastAiUrl) return;
    const displayName = currentUser.role === 'teacher' ? `👑 ${currentUser.displayName}` : currentUser.displayName;
    const newPost = { name: displayName, nameEmoji: equippedEmoji, authorUid: currentUser.uid, text: lastAiText, imgUrl: lastAiUrl, likes: 0, timestampMs: Date.now() };
    db.collection('wall_11').add(newPost).then(() => { alert("🎉 作品已發佈到畫廊！"); document.getElementById('ai-result').innerHTML = "✅ 已分享至畫廊"; });
}

// ========================================================
// 6. 🌟 Google Gravity 物理文具書包系統 🌟
// ========================================================
function drawGacha() { 
    if(!deductCoins(500)) return alert("💰 金幣不足 500 枚！"); 
    const res = document.getElementById('gacha-result'); 
    res.classList.remove('hidden'); res.className = 'feedback info'; res.innerHTML = "🎲 盲盒開啟中..."; 
    
    setTimeout(() => { 
        let r = Math.random() * 100; let card = ""; let color = ""; let isItem = true; let isBag = false; let bagData = null;
        if (r < 1) { card = "【R級極罕】抵消現場紅牌 🛑"; color = "#d32f2f"; } 
        else if (r < 2) { card = "【R級極罕】獲綠色牌 🍀"; color = "#4caf50"; } 
        else if (r < 5) { card = "【S級稀有】自選座位一天 🎵"; color = "#9c27b0"; } 
        else if (r < 10) { card = "【A 級】免答問題一次 🤫"; color = "#ff9800"; } 
        else if (r < 15) { card = "【A 級】小懲罰豁免權 🛡️"; color = "#2196f3"; } 
        else if (r < 55) { 
            isItem = false; isBag = true;
            const bags = [
                {n: "書包", u: "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f392.svg", w: 60},
                {n: "課本", u: "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f4d8.svg", w: 50},
                {n: "筆記本", u: "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f4d3.svg", w: 45},
                {n: "水瓶", u: "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f9e4.svg", w: 30},
                {n: "直尺", u: "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f4cf.svg", w: 60},
                {n: "原子筆", u: "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f58a.svg", w: 20}
            ];
            bagData = bags[Math.floor(Math.random() * bags.length)];
            card = `【B 級】物理裝備：${bagData.n}`; color = "#00796b";
            userBags.push(bagData); if(db && currentUser.role !== 'teacher') db.collection('users').doc(currentUser.uid).update({ bags: userBags });
        } else { 
            isItem = false;
            const emojis = ["😎", "👻", "🔥", "✨", "👑", "👽", "💩", "🦄", "🐼", "🚀", "🌟"];
            const gotEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            card = `【B 級】專屬稱號 Emoji：${gotEmoji}`; color = "#757575";
            if(!userEmojis.includes(gotEmoji)) { userEmojis.push(gotEmoji); if(db && currentUser.role !== 'teacher') db.collection('users').doc(currentUser.uid).update({ emojis: userEmojis }); }
        }

        if(isItem) { userItems.push(card); if(db && currentUser.role !== 'teacher') db.collection('users').doc(currentUser.uid).update({ items: userItems }); }
        
        res.className = 'feedback success'; 
        res.innerHTML = `🎉 恭喜抽中：<br><br><span style="font-size:1.4rem; color:${color}; font-weight:bold;">${card}</span>`; 
        
        renderInventory(); 
        if(isBag && engineStarted) { addPhysicsBody(bagData); }
    }, 1500); 
}

// 物理引擎初始化 (修復手機與滑鼠觸控)
function initPhysicsEngine() {
    if(engineStarted) return;
    const container = document.getElementById('physics-canvas-container');
    if(!container) return;
    
    engineStarted = true;
    engine = Matter.Engine.create(); world = engine.world;
    render = Matter.Render.create({
        element: container, engine: engine,
        options: { width: container.clientWidth, height: 300, wireframes: false, background: 'transparent', pixelRatio: window.devicePixelRatio || 1 }
    });
    
    const ground = Matter.Bodies.rectangle(container.clientWidth/2, 310, container.clientWidth, 20, { isStatic: true, render: { fillStyle: 'transparent' } });
    const leftWall = Matter.Bodies.rectangle(-10, 150, 20, 300, { isStatic: true });
    const rightWall = Matter.Bodies.rectangle(container.clientWidth+10, 150, 20, 300, { isStatic: true });
    Matter.World.add(world, [ground, leftWall, rightWall]);
    
    const mouse = Matter.Mouse.create(render.canvas);
    mouse.pixelRatio = window.devicePixelRatio || 1; // 修復手機觸控偏移
    const mouseConstraint = Matter.MouseConstraint.create(engine, { mouse: mouse, constraint: { stiffness: 0.2, render: { visible: false } } });
    Matter.World.add(world, mouseConstraint);
    render.mouse = mouse;
    
    Matter.Render.run(render); runner = Matter.Runner.create(); Matter.Runner.run(runner, engine);
    
    userBags.forEach(b => { setTimeout(() => { addPhysicsBody(b); }, Math.random()*1000); });
}

function addPhysicsBody(bagData) {
    const container = document.getElementById('physics-canvas-container');
    const x = Math.random() * (container.clientWidth - 50) + 25;
    const body = Matter.Bodies.rectangle(x, -50, bagData.w, bagData.w, { restitution: 0.8 }); 
    Matter.World.add(world, body);
    
    const el = document.createElement('img');
    el.src = bagData.u; el.className = 'physics-item'; el.style.width = bagData.w + 'px';
    container.appendChild(el);
    
    Matter.Events.on(engine, 'afterUpdate', function() {
        el.style.left = body.position.x + 'px'; el.style.top = body.position.y + 'px';
        el.style.transform = `translate(-50%, -50%) rotate(${body.angle}rad)`;
    });
}

function renderInventory() {
    const container = document.getElementById('inventory-container'); if(!container) return; container.classList.remove('hidden');
    const itemList = document.getElementById('my-items-list');
    if(userItems.length === 0) { itemList.innerHTML = "<p style='color:#888;'>尚未獲得道具卡。</p>"; } 
    else { itemList.innerHTML = userItems.map((item, index) => `<div style="background:#fff; border:1px solid #ccc; padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;"><span style="font-weight:bold;">${item}</span><button style="background:#dc3545; color:white; border:none; padding:5px 15px; border-radius:5px; cursor:pointer;" onclick="redeemItem(${index}, '${item}')">核銷</button></div>`).join(''); }

    const emojiList = document.getElementById('my-emoji-list'); document.getElementById('current-equipped-emoji').innerText = equippedEmoji || "無";
    if(userEmojis.length === 0) { emojiList.innerHTML = "<p style='font-size:1rem; color:#888;'>尚未收集到稱號。</p>"; } 
    else { emojiList.innerHTML = userEmojis.map(e => `<span onclick="equipEmoji('${e}')" style="display:inline-block; border: 3px solid ${e === equippedEmoji ? '#d32f2f' : 'transparent'}; border-radius:12px; padding:8px; transition:0.2s; background:${e === equippedEmoji ? '#ffebee' : 'transparent'};">${e}</span>`).join(''); }
}

function equipEmoji(emojiToEquip) { equippedEmoji = (equippedEmoji === emojiToEquip) ? "" : emojiToEquip; if(db && currentUser.role !== 'teacher') db.collection('users').doc(currentUser.uid).update({ equippedEmoji: equippedEmoji }); updateScoreUI(); renderInventory(); alert(equippedEmoji ? `✅ 已裝備稱號：${equippedEmoji}` : `✅ 已卸下稱號`); }
function redeemItem(index, itemName) { if(confirm(`⚠️ 請在老師面前按下確認！\n\n確定現在兌換\n${itemName} 嗎？`)) { userItems.splice(index, 1); if(db && currentUser.role !== 'teacher') db.collection('users').doc(currentUser.uid).update({ items: userItems }); if(db) db.collection('redemptions').add({ name: currentUser.displayName, item: itemName, timeMs: Date.now(), time: new Date().toLocaleString() }); alert("✅ 兌換成功！已發送紀錄至老師後台。"); renderInventory(); } }

function loadLeaderboard() {
    if(!db) return;
    db.collection('users').where('role', '==', 'student').orderBy('weeklyScore', 'desc').limit(20).onSnapshot((snapshot) => {
        const table = document.getElementById('global-leaderboard'); if(!table) return;
        let html = `<tr><th>排名</th><th>同學</th><th style="color:#d84315;">本週積分</th><th>總積分</th></tr>`;
        let rank = 1;
        snapshot.forEach(doc => { const data = doc.data(); const isMe = currentUser && data.email === currentUser.email ? 'background:#e3f2fd; font-weight:bold;' : ''; const nameStr = (data.equippedEmoji ? data.equippedEmoji + " " : "") + data.name; html += `<tr style="${isMe}"><td>${rank}</td><td>${nameStr}</td><td style="color:#d84315; font-weight:bold;">${data.weeklyScore || 0}</td><td>${data.score}</td></tr>`; rank++; });
        table.innerHTML = html;
    });
}

function loadAdminDashboard() {
    if(!db || currentUser.role !== 'teacher') return;
    db.collection('users').where('role', '==', 'student').orderBy('lastLogin', 'desc').onSnapshot((snapshot) => {
        const table = document.getElementById('admin-users-table'); if(!table) return;
        let html = `<tr><th>學生姓名</th><th>帳號</th><th>本週積分</th><th>總積分</th><th>金幣</th><th>最後登入</th></tr>`;
        snapshot.forEach(doc => { const data = doc.data(); html += `<tr><td>${data.name}</td><td>${data.email || '無'}</td><td>${data.weeklyScore||0}</td><td>${data.score}</td><td>${data.coins || 0}</td><td>${data.lastLogin || '未記錄'}</td></tr>`; });
        table.innerHTML = html;
    });
    db.collection('redemptions').orderBy('timeMs', 'desc').limit(50).onSnapshot((snapshot) => {
        const logDiv = document.getElementById('admin-redemption-log'); if(!logDiv) return;
        let html = ""; snapshot.forEach(doc => { const data = doc.data(); html += `<div style="border-bottom: 1px solid #ccc; padding: 8px 0;"><span style="color:#d84315; font-weight:bold;">[${data.time}]</span> <strong>${data.name}</strong> 兌換了 <span style="color:#1976d2;">${data.item}</span></div>`; });
        logDiv.innerHTML = html || "<p style='color:#888;'>尚無紀錄。</p>";
    });
    db.collection('error_stats').orderBy('count', 'desc').limit(10).onSnapshot((snapshot) => {
        const errDiv = document.getElementById('admin-error-log'); if(!errDiv) return;
        let html = ""; snapshot.forEach(doc => { const data = doc.data(); html += `<li><strong style="color:#d32f2f;">錯 ${data.count} 次</strong>：${data.q}</li>`; });
        errDiv.innerHTML = html || "<p style='color:#888;'>太棒了！目前沒有學生答錯任何題目。</p>";
    });
}
