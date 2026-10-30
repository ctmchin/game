(function(){
  if (window.__script_patch_installed) return; // idempotent
  window.__script_patch_installed = true;

  // Keep a buffer for the selected text
  window.pendingSelectedText = window.pendingSelectedText || "";

  function updateMemoUI() {
    try {
      const list = document.getElementById('memo-list'); if(!list) return;
      const memos = window.memos || [];
      if (memos.length === 0) { list.innerHTML = '<p style="color: #888; text-align: center;">暫無筆記</p>'; return; }
      list.innerHTML = memos.map(m => `<div class="memo-item"><p style="font-weight:bold;">${m.content}</p><div style="color:#888; font-size:0.9rem;">${m.time}</div></div>`).join('');
    } catch(e) { console.warn('updateMemoUI error', e); }
  }

  window.confirmSaveHighlight = function() {
    try {
      const txt = window.pendingSelectedText || '';
      if (txt.length > 0) {
        window.memos = window.memos || [];
        window.memos.unshift({ content: txt, time: new Date().toLocaleString() });
        updateMemoUI();
        if (window.currentUser && window.currentUser.uid) localStorage.setItem(`memos_${window.currentUser.uid}`, JSON.stringify(window.memos));
        else localStorage.setItem('memos_guest', JSON.stringify(window.memos));
        window.pendingSelectedText = '';
        const mobileBarEl = document.getElementById('mobile-highlight-bar'); if (mobileBarEl) mobileBarEl.classList.add('hidden');
        alert('已儲存至專屬備忘錄！');
      }
    } catch (e) { console.warn('confirmSaveHighlight error', e); }
  };

  window.closeHighlightBar = function() {
    try {
      const mobileBarEl = document.getElementById('mobile-highlight-bar'); if (mobileBarEl) mobileBarEl.classList.add('hidden');
      window.pendingSelectedText = '';
    } catch(e) { console.warn('closeHighlightBar error', e); }
  };

  window.addManualMemo = function() {
    try {
      const input = document.getElementById('manual-memo-input'); if(!input) return;
      const text = input.value.trim(); if(text !== '') { window.memos = window.memos || []; window.memos.unshift({ content: text, time: new Date().toLocaleString() }); updateMemoUI(); if (window.currentUser && window.currentUser.uid) localStorage.setItem(`memos_${window.currentUser.uid}`, JSON.stringify(window.memos)); else localStorage.setItem('memos_guest', JSON.stringify(window.memos)); input.value = ''; }
    } catch(e) { console.warn('addManualMemo error', e); }
  };

  window.loadMemos = function(uid) {
    try {
      const saved = localStorage.getItem(`memos_${uid}`);
      window.memos = saved ? JSON.parse(saved) : [];
      updateMemoUI();
    } catch(e){console.warn('loadMemos error', e); }
  };

  function ensurePadletUI() {
    try {
      const feature = document.getElementById('feature-8');
      if (!feature) return;

      if (feature.querySelector('#padlet-input')) return;

      const target = feature.querySelector('.card') || feature;
      const wrapper = document.createElement('div');
      wrapper.className = 'padlet-wrapper';
      wrapper.innerHTML = `
        <div style="margin-top: 18px; background: #f8f9ff; border: 1px solid #dfe3ff; border-radius: 12px; padding: 16px;">
          <textarea id="padlet-input" rows="4" placeholder="請輸入一句你最喜歡的佳句..." style="width:100%; box-sizing:border-box; resize:vertical; padding:12px; border-radius:10px; border:1px solid #d0d7ff; font-size:1rem;"></textarea>
          <div style="margin-top:12px; display:flex; justify-content:flex-end;">
            <button class="btn-primary" onclick="window.savePadlet && window.savePadlet()" style="padding:10px 18px; border-radius:10px; font-weight:bold;">發布到佳句牆</button>
          </div>
        </div>
        <div id="padlet-list" style="margin-top: 18px;"></div>
      `;
      target.appendChild(wrapper);
      window.savePadlet = window.savePadlet || async function(){
        const input = document.getElementById('padlet-input');
        if (!input) return;
        const text = input.value.trim();
        if (!text) {
          alert('請先輸入佳句！');
          return;
        }

        if (!window.currentUser || !window.currentUser.uid) {
          alert('請先登入後再發布。');
          return;
        }

        if (!window.db) {
          alert('資料庫尚未就緒，請稍後再試。');
          return;
        }

        try {
          await window.db.collection('wall_8').add({
            uid: window.currentUser.uid,
            displayName: window.currentUser.displayName || '學生',
            email: (window.currentUser.email || '').toLowerCase(),
            text: text,
            createdAt: new Date().toISOString(),
            likes: 0,
            approved: true
          });

          input.value = '';
          window.loadPadlet();
          alert('已發布到佳句牆！');
        } catch (err) {
          console.error('savePadlet error', err);
          alert('發布失敗，請稍後再試。');
        }
      };

      window.loadPadlet = window.loadPadlet || async function(){
        const listEl = document.getElementById('padlet-list');
        if (!listEl) return;
        if (!window.db) return;

        try {
          const snapshot = await window.db.collection('wall_8').orderBy('createdAt', 'desc').limit(20).get();
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
    } catch (e) {
      console.warn('ensurePadletUI error', e);
    }
  }

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
    } catch (e) { console.warn('selectionchange handler error (patch)', e); }
  });

  // Expose updateMemoUI globally for compatibility
  window.updateMemoUI = updateMemoUI;

  setTimeout(ensurePadletUI, 200);
  if (document.readyState === 'complete') ensurePadletUI();
  document.addEventListener('DOMContentLoaded', ensurePadletUI);

  console.log('[script-patch] installed');
})();
