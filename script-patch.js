// ========================================================
// script-patch.js
// Runtime patch for memo handling and user-data persistence.
// ========================================================
(function(){
  if (window.__script_patch_installed) return;
  window.__script_patch_installed = true;

  window.pendingSelectedText = window.pendingSelectedText || "";

  function updateMemoUI() {
    try {
      const list = document.getElementById('memo-list');
      if (!list) return;

      const memos = Array.isArray(window.memos) ? window.memos : [];
      if (memos.length === 0) {
        list.innerHTML = '<p style="color: #888; text-align: center;">暫無筆記</p>';
        return;
      }

      list.innerHTML = memos.map(m => `
        <div class="memo-item" style="background:#fff; border:1px solid #ddd; border-left:4px solid #1976d2; padding:12px; border-radius:8px; margin-bottom:10px;">
          <p style="font-weight:bold; margin:0 0 6px;">${(m && m.content) || ''}</p>
          <div style="color:#888; font-size:0.85rem;">${(m && m.time) || ''}</div>
        </div>
      `).join('');
    } catch (e) {
      console.warn('updateMemoUI error', e);
    }
  }

  function persistMemoState() {
    try {
      const memos = Array.isArray(window.memos) ? window.memos : [];
      const payload = {
        memos,
        score: Number(window.userScore || 0),
        coins: Number(window.userCoins || 0),
        weeklyScore: Number(window.weeklyScore || 0),
        lastLogin: Date.now()
      };

      if (window.currentUser && window.currentUser.uid) {
        localStorage.setItem(`memos_${window.currentUser.uid}`, JSON.stringify(memos));
        if (typeof window.saveUserProgress === 'function') {
          window.saveUserProgress(payload);
        }
      } else {
        localStorage.setItem('memos_guest', JSON.stringify(memos));
      }
    } catch (e) {
      console.warn('[script-patch] persistMemoState failed', e);
    }
  }

  function ensureWall8UI() {
    try {
      const section = document.getElementById('feature-8');
      if (!section) return;
      const card = section.querySelector('.card');
      if (!card) return;
      if (card.querySelector('#wall-8-input')) return;

      card.insertAdjacentHTML('beforeend', `
        <div style="margin-top:18px; padding-top:18px; border-top:1px solid #eee;">
          <label style="display:block; margin-bottom:8px; font-weight:bold; color:#333;">分享你最喜歡的一句佳句</label>
          <textarea id="wall-8-input" rows="4" placeholder="例如：『春風送暖，讓人心也跟著亮起來。』" style="width:100%; box-sizing:border-box; padding:12px; border-radius:10px; border:1px solid #ddd; resize:vertical; font-size:1rem;"></textarea>
          <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
            <button class="btn-primary" onclick="submitWall8Post()" style="padding:10px 18px; font-weight:bold; border:none; border-radius:10px; cursor:pointer;">發布到佳句牆</button>
            <span style="color:#666; font-size:0.85rem;">同學互相觀摩、互相學習</span>
          </div>
          <div id="wall-8-list" style="margin-top:18px;"></div>
        </div>
      `);
    } catch (e) {
      console.warn('[wall8] ensureWall8UI error', e);
    }
  }

  async function getDb() {
    try {
      if (window.db && typeof window.db.collection === 'function') return window.db;
      if (typeof firebase !== 'undefined' && firebase.firestore) return firebase.firestore();
      return null;
    } catch (e) {
      console.warn('[wall8] getDb error', e);
      return null;
    }
  }

  async function loadWall8Posts() {
    try {
      const db = await getDb();
      const listEl = document.getElementById('wall-8-list');
      if (!listEl || !db) return;

      const snapshot = await db.collection('wall_8')
        .where('approved', '==', true)
        .orderBy('createdAt', 'desc')
        .limit(30)
        .get();

      const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (posts.length === 0) {
        listEl.innerHTML = '<div style="padding:16px; border:1px dashed #ccc; border-radius:10px; color:#888; background:#fafafa;">暫時還沒有佳句，快成為第一位分享者！</div>';
        return;
      }

      listEl.innerHTML = posts.map(post => `
        <div style="background:#fff; border:1px solid #ddd; border-left:4px solid #1e88e5; border-radius:12px; padding:14px; margin-bottom:12px; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:12px; flex-wrap:wrap;">
            <strong>${post.displayName || '學生'}</strong>
            <span style="color:#888; font-size:0.8rem;">${new Date(post.createdAt).toLocaleString('zh-HK')}</span>
          </div>
          <div style="font-size:1.05rem; line-height:1.8; color:#222; margin-bottom:12px;">${post.text}</div>
          <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
            <button onclick="likeWall8Post('${post.id}')" style="background:#f5f5f5; border:1px solid #ddd; border-radius:999px; padding:6px 12px; cursor:pointer; font-weight:bold;">👍 讚 (${post.likes || 0})</button>
            <span style="color:#666; font-size:0.8rem;">分享者：${post.displayName || '學生'}</span>
          </div>
        </div>
      `).join('');
    } catch (e) {
      console.warn('[wall8] loadWall8Posts error', e);
    }
  }

  async function submitWall8Post() {
    try {
      const input = document.getElementById('wall-8-input');
      if (!input) return;

      const text = input.value.trim();
      if (!text) {
        alert('請先輸入一句佳句！');
        return;
      }

      if (!window.currentUser || !window.currentUser.uid) {
        alert('請先登入後再發佈。');
        return;
      }

      const db = await getDb();
      if (!db) {
        alert('資料庫尚未初始化，請稍後再試。');
        return;
      }

      const payload = {
        uid: window.currentUser.uid,
        email: (window.currentUser.email || '').toLowerCase(),
        displayName: window.currentUser.displayName || '學生',
        text,
        createdAt: new Date().toISOString(),
        likes: 0,
        approved: true
      };

      await db.collection('wall_8').add(payload);
      input.value = '';
      await loadWall8Posts();
      alert('佳句已發布到牆上！');
    } catch (e) {
      console.error('[wall8] submitWall8Post error', e);
      alert('發布失敗，請稍後再試。');
    }
  }

  async function likeWall8Post(postId) {
    try {
      const db = await getDb();
      if (!db || !postId) return;

      const ref = db.collection('wall_8').doc(postId);
      await ref.update({
        likes: firebase.firestore.FieldValue.increment(1)
      });

      await loadWall8Posts();
    } catch (e) {
      console.warn('[wall8] likeWall8Post error', e);
    }
  }

  function wrapSwitchTab() {
    try {
      const original = window.switchTab;
      if (!original || window.__wall8_switch_wrapped) return;
      window.__wall8_switch_wrapped = true;

      window.switchTab = function(name, event) {
        const result = original.call(this, name, event);
        if (name === 'feature-8') {
          setTimeout(() => {
            ensureWall8UI();
            loadWall8Posts();
          }, 50);
        }
        return result;
      };
    } catch (e) {
      console.warn('[wall8] switchTab wrap error', e);
    }
  }

  window.confirmSaveHighlight = function() {
    try {
      const txt = window.pendingSelectedText || '';
      if (txt.length > 0) {
        window.memos = Array.isArray(window.memos) ? window.memos : [];
        window.memos.unshift({ content: txt, time: new Date().toLocaleString() });
        updateMemoUI();
        persistMemoState();
        window.pendingSelectedText = '';

        const mobileBarEl = document.getElementById('mobile-highlight-bar');
        if (mobileBarEl) mobileBarEl.classList.add('hidden');

        alert('已儲存至專屬備忘錄！');
      }
    } catch (e) {
      console.warn('confirmSaveHighlight error', e);
    }
  };

  window.closeHighlightBar = function() {
    try {
      const mobileBarEl = document.getElementById('mobile-highlight-bar');
      if (mobileBarEl) mobileBarEl.classList.add('hidden');
      window.pendingSelectedText = '';
    } catch (e) {
      console.warn('closeHighlightBar error', e);
    }
  };

  window.addManualMemo = function() {
    try {
      const input = document.getElementById('manual-memo-input');
      if (!input) return;
      const text = input.value.trim();
      if (text !== '') {
        window.memos = Array.isArray(window.memos) ? window.memos : [];
        window.memos.unshift({ content: text, time: new Date().toLocaleString() });
        updateMemoUI();
        persistMemoState();
        input.value = '';
      }
    } catch (e) {
      console.warn('addManualMemo error', e);
    }
  };

  window.loadMemos = function(uid) {
    try {
      const saved = localStorage.getItem(`memos_${uid}`);
      if (saved) {
        window.memos = JSON.parse(saved);
      } else {
        window.memos = [];
      }
      updateMemoUI();
    } catch (e) {
      console.warn('loadMemos error', e);
      window.memos = [];
      updateMemoUI();
    }
  };

  document.addEventListener('selectionchange', function() {
    try {
      const selection = window.getSelection();
      const selectedStr = selection ? selection.toString().trim() : '';
      const mobileBarEl = document.getElementById('mobile-highlight-bar');
      const previewEl = document.getElementById('highlight-text-preview');
      if (selectedStr.length > 0 && mobileBarEl && previewEl) {
        previewEl.innerText = selectedStr.slice(0, 200);
        mobileBarEl.classList.remove('hidden');
        window.pendingSelectedText = selectedStr;
      } else if (mobileBarEl) {
        mobileBarEl.classList.add('hidden');
        window.pendingSelectedText = '';
      }
    } catch (e) {
      console.warn('selectionchange handler error (patch)', e);
    }
  });

  window.updateMemoUI = updateMemoUI;
  window.loadWall8Posts = loadWall8Posts;
  window.submitWall8Post = submitWall8Post;
  window.likeWall8Post = likeWall8Post;

  document.addEventListener('DOMContentLoaded', function() {
    ensureWall8UI();
    wrapSwitchTab();
  });

  setTimeout(function() {
    ensureWall8UI();
    wrapSwitchTab();
  }, 300);

  console.log('[script-patch] memo persistence enabled and wall8 feature installed');
})();
