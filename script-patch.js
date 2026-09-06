// ========================================================
// script-patch.js
// Small runtime patch to harden highlight / memo behavior.
// Loaded after script.js to override or provide safer implementations
// for selection handling and memo saving without touching the large
// legacy script file.
// ========================================================
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
      const text = input.value.trim(); if(text !== '') { window.memos = window.memos || []; window.memos.unshift({ content: text, time: new Date().toLocaleString() }); updateMemoUI(); if (window.currentUser && window.currentUser.uid) localStorage.setItem(`memos_${window.currentUser.uid}`, JSON.stringify(window.memos)); input.value = ''; }
    } catch(e) { console.warn('addManualMemo error', e); }
  };

  window.loadMemos = function(uid) { try { const saved = localStorage.getItem(`memos_${uid}`); window.memos = saved ? JSON.parse(saved) : []; updateMemoUI(); } catch(e){console.warn('loadMemos error', e);} };

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

  console.log('[script-patch] installed');
})();
