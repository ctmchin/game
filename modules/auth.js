function handleLoginSuccess(user) {
    console.log("Login success! User:", user.displayName);
    window.currentUser = user;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');

    // --- THE FIX: Call the functions to display user info and quizzes ---
    if (window.updateScoreUI) {
        window.updateScoreUI();
    }
    if (window.renderLevelTable) {
        window.renderLevelTable();
    }
    if (window.renderQuizzes) {
        window.renderQuizzes();
    }
}
