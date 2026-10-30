(function(){
  if (window.__game_runtime_patch_installed) return;
  window.__game_runtime_patch_installed = true;

  function detectTeacherEmail(email) {
    const e = (email || '').trim().toLowerCase();
    return e === 'ctmchin@gmail.com' || e === 'teacher@ctmchin.com' || e.endsWith('@teacher.ctmchin') || e.endsWith('@ctmchin.com');
  }

  function normalizeUserProfile(userLike) {
    const raw = userLike || {};
    const email = (raw.email || raw.gmail || raw.mail || '').toString().trim();
    const uid = raw.uid || raw.id || raw.userId || null;
    const displayName = raw.displayName || raw.name || (email ? email.split('@')[0] : '學生');
    const role = raw.role || (detectTeacherEmail(email) ? 'teacher' : 'student');
    return { uid, email, displayName, role };
  }

  function safeDbRef() {
    if (window.db || (typeof db !== 'undefined' && db)) return window.db || db;
    if (typeof firebase !== 'undefined' && firebase.firestore) return firebase.firestore();
    return null;
  }

  function ensureUserState(userLike) {
    const normalized = normalizeUserProfile(userLike);
    if (!normalized.uid) return;

    window.currentUser = { ...(window.currentUser || {}), ...normalized };
    if (window.userScore === undefined) window.userScore = Number(window.userScore || 0);
    if (window.userCoins === undefined) window.userCoins = Number(window.userCoins || 0);
    if (window.weeklyScore === undefined) window.weeklyScore = Number(window.weeklyScore || 0);

    if (window.db || (typeof db !== 'undefined' && db)) {
      window.db = window.db || db;
      const ref = window.db.collection('users').doc(normalized.uid);
      ref.set({
        uid: normalized.uid,
        email: normalized.email,
        displayName: normalized.displayName,
        role: normalized.role,
        score: Number(window.userScore || 0),
        coins: Number(window.userCoins || 0),
        weeklyScore: Number(window.weeklyScore || 0),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).catch((err) => {
        console.warn('ensureUserState save warning', err);
      });
    }
  }

  function saveUserProgress(force = false) {
    const dbInstance = safeDbRef();
    const user = window.currentUser || {};
    if (!dbInstance || !user.uid) return;

    const score = Number(window.userScore || 0);
    const coins = Number(window.userCoins || 0);
    const weekly = Number(window.weeklyScore || 0);

    dbInstance.collection('users').doc(user.uid).set({
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '學生',
      role: user.role || 'student',
      score,
      coins,
      weeklyScore: weekly,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch((err) => {
      console.warn('saveUserProgress failed', err);
      if (force) alert('資料同步失敗，請重新登入並再試。');
    });
  }

  function patchScoreLogic() {
    const oldAddPoints = window.addPoints;
    window.addPoints = function(points) {
      if (!window.currentUser || window.currentUser.role === 'teacher') return;
      if (typeof window.userScore === 'undefined') window.userScore = 0;
      if (typeof window.userCoins === 'undefined') window.userCoins = 0;
      if (typeof window.weeklyScore === 'undefined') window.weeklyScore = 0;

      window.userScore += Number(points || 0);
      window.userCoins += Number(points || 0);
      window.weeklyScore += Number(points || 0);

      if (document.getElementById('score')) document.getElementById('score').textContent = window.userScore;
      if (document.getElementById('coins')) document.getElementById('coins').textContent = window.userCoins;

      saveUserProgress();
      if (typeof oldAddPoints === 'function') return oldAddPoints(points);
    };

    const oldDeductCoins = window.deductCoins;
    window.deductCoins = function(amount) {
      if (!window.currentUser || window.currentUser.role === 'teacher') return true;
      if (typeof window.userCoins === 'undefined') window.userCoins = 0;
      if (window.userCoins < Number(amount || 0)) return false;
      window.userCoins -= Number(amount || 0);
      if (document.getElementById('coins')) document.getElementById('coins').textContent = window.userCoins;
      saveUserProgress();
      if (typeof oldDeductCoins === 'function') return oldDeductCoins(amount);
      return true;
    };
  }

  function patchGoogleLogin() {
    const original = window.handleLoginSuccess;
    window.handleLoginSuccess = function(payload) {
      const prepared = normalizeUserProfile(payload);
      if (prepared.uid && prepared.email) {
        ensureUserState(prepared);
      }
      if (typeof original === 'function') return original(payload);
    };

    window.loginWithGoogle = async function() {
      try {
        if (!window.firebase || !window.firebase.auth) {
          alert('Google 登入尚未初始化，請稍後再試。');
          return;
        }

        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await firebase.auth().signInWithPopup(provider);
        const user = result.user;
        const email = user && user.email ? user.email : '';
        const role = detectTeacherEmail(email) ? 'teacher' : 'student';
        const payload = {
          uid: user.uid,
          email,
          displayName: user.displayName || email.split('@')[0],
          role,
          google: true
        };

        ensureUserState(payload);
        if (typeof window.handleLoginSuccess === 'function') {
          window.handleLoginSuccess(payload);
        }
      } catch (err) {
        console.error('loginWithGoogle failed', err);
        alert('Google 登入失敗，請稍後再試。');
      }
    };
  }

  function ensurePadletUI() {
    try {
      const feature = document.getElementById('feature-8');
      if (!feature) return;
      if (feature.querySelector('#padlet-input')) return;

      const target = feature.querySelector('.card') || feature;
      const wrapper = document.createElement('div');
      wrapper.className = 'padlet-wrapper';
      wrapper.innerHTML = `
        <div style="margin-top:18px; background:#f8f9ff; border:1px solid #dfe3ff; border-radius:12px; padding:16px;">
          <textarea id="padlet-input" rows="4" placeholder="請輸入一句你最喜歡的佳句..." style="width:100%; box-sizing:border-box; resize:vertical; padding:12px; border-radius:10px; border:1px solid #d0d7ff; font-size:1rem;"></textarea>
          <div style="margin-top:12px; display:flex; justify-content:flex-end;">
            <button class="btn-primary" onclick="window.savePadlet && window.savePadlet()" style="padding:10px 18px; border-radius:10px; font-weight:bold;">發布到佳句牆</button>
          </div>
        </div>
        <div id="padlet-list" style="margin-top:18px;"></div>
      `;
      target.appendChild(wrapper);

      window.savePadlet = async function() {
        const input = document.getElementById('padlet-input');
        const text = (input?.value || '').trim();
        if (!text) {
          alert('請先輸入佳句！');
          return;
        }
        const dbInstance = safeDbRef();
        if (!window.currentUser || !dbInstance) {
          alert('請先登入後再發布。');
          return;
        }

        try {
          await dbInstance.collection('wall_8').add({
            uid: window.currentUser.uid,
            displayName: window.currentUser.displayName || '學生',
            email: window.currentUser.email || '',
            text,
            createdAt: new Date().toISOString(),
            likes: 0,
            approved: true
          });
          input.value = '';
          window.loadPadlet();
        } catch (err) {
          console.error('savePadlet error', err);
          alert('發布失敗，請稍後再試。');
        }
      };

      window.loadPadlet = async function() {
        const listEl = document.getElementById('padlet-list');
        if (!listEl) return;
        const dbInstance = safeDbRef();
        if (!dbInstance) return;

        try {
          const snapshot = await dbInstance.collection('wall_8').orderBy('createdAt', 'desc').limit(20).get();
          const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          if (!posts.length) {
            listEl.innerHTML = '<div style="padding:12px; border:1px dashed #ccc; border-radius:8px; color:#666;">目前還沒有佳句，快成為第一位分享者！</div>';
            return;
          }

          listEl.innerHTML = posts.map(post => `
            <div style="background:#fff; border:1px solid #ddd; border-left:4px solid #3f51b5; border-radius:10px; padding:12px; margin-bottom:12px;">
              <div style="font-weight:bold; margin-bottom:6px;">${post.displayName || '學生'}</div>
              <div style="margin-bottom:8px; line-height:1.7; white-space:pre-wrap;">${post.text}</div>
              <div style="color:#777; font-size:0.8rem;">${new Date(post.createdAt).toLocaleString('zh-HK')} · 👍 ${post.likes || 0}</div>
            </div>
          `).join('');
        } catch (err) {
          console.error('loadPadlet error', err);
          listEl.innerHTML = '<div style="padding:12px; border:1px dashed #f0ad4e; border-radius:8px; color:#a06500;">佳句牆目前暫時無法載入，請稍後再試。</div>';
        }
      };

      window.loadPadlet();
    } catch (err) {
      console.warn('ensurePadletUI error', err);
    }
  }

  function patchRandomOptionOrder() {
    window.randomizeOptionOrder = function(options, answerIdKey) {
      const list = Array.isArray(options) ? options.map((opt, index) => ({ ...opt, __index: index })) : [];
      if (!list.length) return list;
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      if (answerIdKey) {
        const correctOne = list.find(item => item[answerIdKey] === true) || list[0];
        if (correctOne) {
          correctOne.__correct = true;
        }
      }
      return list;
    };
  }

  window.db = safeDbRef();
  patchScoreLogic();
  patchGoogleLogin();
  patchRandomOptionOrder();

  if (window.currentUser) ensureUserState(window.currentUser);
  setTimeout(() => {
    ensurePadletUI();
    if (window.currentUser && window.currentUser.uid && window.db) {
      window.db.collection('users').doc(window.currentUser.uid).get().then((doc) => {
        if (doc.exists) {
          const data = doc.data() || {};
          window.userScore = Number(data.score || 0);
          window.userCoins = Number(data.coins || 0);
          window.weeklyScore = Number(data.weeklyScore || 0);
          if (document.getElementById('score')) document.getElementById('score').textContent = window.userScore;
          if (document.getElementById('coins')) document.getElementById('coins').textContent = window.userCoins;
        }
      }).catch(() => {});
    }
  }, 300);

  document.addEventListener('DOMContentLoaded', ensurePadletUI);
  console.log('[game-patch] ready');
})();
