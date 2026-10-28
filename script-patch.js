// ========================================================
// script-patch.js
// Runtime patch for memo handling and user-data persistence.
// ========================================================
(function(){
  if (window.__script_patch_installed) return;
  window.__script_patch_installed = true;

  window.pendingSelectedText = window.pendingSelectedText || "";

  function ensureMemoList() {
    try {
      let list = document.getElementById('memo-list');
      if (list) return list;

      const feature15 = document.getElementById('feature-15') || document.querySelector('[data-feature="feature-15"]');
      if (!feature15) {
        return null;
      }

      let container = feature15.querySelector('.memo-container');
      if (!container) {
        container = document.createElement('div');
        container.className = 'memo-container';
        container.id = 'memo-list';
        feature15.appendChild(container);
      } else {
        container.id = 'memo-list';
      }
      return container;
    } catch (e) {
      console.warn('[script-patch] ensureMemoList failed', e);
      return null;
    }
  }

  function updateMemoUI() {
    try {
      const list = ensureMemoList();
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
      if (window.currentUser && window.currentUser.uid) {
        const uid = window.currentUser.uid;
        localStorage.setItem(`memos_${uid}`, JSON.stringify(window.memos || []));
        if (window.saveUserProgress) {
          window.saveUserProgress({ memos: window.memos || [] });
        }
      } else {
        localStorage.setItem('memos_guest', JSON.stringify(window.memos || []));
      }
    } catch (e) {
      console.warn('[script-patch] persistMemoState failed', e);
    }
  }

  function patchUserDocWrites() {
    try {
      if (window.__userDocWritePatched) return;
      if (!window.firebase && !firebase) return;

      const firestore = (window.firebase && window.firebase.firestore) ? window.firebase.firestore : firebase.firestore;
      const DocRefProto = firestore && firestore.DocumentReference && firestore.DocumentReference.prototype;
      if (!DocRefProto) return;

      const originalUpdate = DocRefProto.update;
      DocRefProto.update = function(data) {
        try {
          const path = this.path || this._path || (this._delegate && this._delegate.path) || '';
          if (String(path).startsWith('users/')) {
            return this.set(data, { merge: true });
          }
        } catch (e) {
          console.warn('[script-patch] user-write patch check failed', e);
        }
        return originalUpdate ? originalUpdate.call(this, data) : Promise.resolve();
      };

      window.__userDocWritePatched = true;
    } catch (e) {
      console.warn('[script-patch] patchUserDocWrites failed', e);
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
      window.memos = saved ? JSON.parse(saved) : [];
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
  patchUserDocWrites();
  console.log('[script-patch] installed');
})();
