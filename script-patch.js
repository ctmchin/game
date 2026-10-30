(function(){
  if (window.__game_random_option_fix_installed) return;
  window.__game_random_option_fix_installed = true;

  function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function renderOptionsRandomized(question, containerId) {
    const container = document.getElementById(containerId);
    if (!container || !question || !Array.isArray(question.options)) return;

    const optionEntries = question.options.map((text, originalIndex) => ({
      text,
      originalIndex
    }));

    const shuffled = shuffleArray(optionEntries);
    container.innerHTML = shuffled.map((entry) => `
      <button
        class="btn-option"
        data-original-index="${entry.originalIndex}"
        data-correct-index="${question.correct ?? 0}"
        onclick="handleRandomizedOptionClick(this, ${question.correct ?? 0}, ${JSON.stringify(question.explanation || '')}, ${Number(question.points || 0)})"
        style="display:block; width:100%; text-align:left; margin:8px 0; padding:12px 14px; border-radius:8px; border:1px solid #ddd; background:#fff; cursor:pointer;"
      >${entry.text}</button>
    `).join('');
  }

  function handleRandomizedOptionClick(button, correctIndex, explanation, points) {
    const chosenIndex = Number(button.dataset.originalIndex);
    const parent = button.parentElement;
    const feedback = parent && parent.nextElementSibling ? parent.nextElementSibling : null;
    const allButtons = parent ? parent.querySelectorAll('.btn-option') : [];

    allButtons.forEach((btn) => {
      btn.disabled = true;
      btn.style.opacity = '0.8';
      btn.style.cursor = 'default';
    });

    if (chosenIndex === correctIndex) {
      button.style.background = '#d4edda';
      button.style.borderColor = '#28a745';
      if (feedback) {
        feedback.className = 'feedback success';
        feedback.innerHTML = `✅ 正確！${explanation || ''}`;
      }
      if (typeof window.addPoints === 'function' && Number(points) > 0) {
        window.addPoints(Number(points));
      }
    } else {
      button.style.background = '#f8d7da';
      button.style.borderColor = '#dc3545';
      const correctBtn = Array.from(allButtons).find((btn) => Number(btn.dataset.originalIndex) === correctIndex);
      if (correctBtn) {
        correctBtn.style.background = '#d4edda';
        correctBtn.style.borderColor = '#28a745';
      }
      if (feedback) {
        feedback.className = 'feedback error';
        feedback.innerHTML = `❌ 不對！${explanation || ''}`;
      }
    }
  }

  window.shuffleArray = shuffleArray;
  window.renderOptionsRandomized = renderOptionsRandomized;
  window.handleRandomizedOptionClick = handleRandomizedOptionClick;

  console.log('[random-option-fix] display shuffling preserved, answer logic still uses original index');
})();
