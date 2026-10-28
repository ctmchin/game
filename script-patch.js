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
      if (window.currentUser && window.currentUser.uid) {
        const uid = window.currentUser.uid;
        localStorage.setItem(`memos_${uid}`, JSON.stringify(memos));

        if (firebase && firebase.firestore) {
          const db = firebase.firestore();
          db.collection('users').doc(uid).set({
            memos,
            score: Number(window.userScore || 0),
            coins: Number(window.userCoins || 0),
            weeklyScore: Number(window.weeklyScore || 0),
            lastLogin: Date.now()
          }, { merge: true });
        }
      } else {
        localStorage.setItem('memos_guest', JSON.stringify(memos));
      }
    } catch (e) {
      console.warn('[script-patch] persistMemoState failed', e);
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
      } else if (firebase && firebase.firestore) {
        firebase.firestore().collection('users').doc(uid).get().then((doc) => {
          if (doc.exists && Array.isArray(doc.data().memos)) {
            window.memos = doc.data().memos;
            updateMemoUI();
          }
        }).catch(() => {
          window.memos = [];
          updateMemoUI();
        });
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
  console.log('[script-patch] installed');
})();
