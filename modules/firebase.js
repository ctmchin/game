// ========================================================
// MODULE: firebase.js
// This is the most important file. It starts Firebase.
// ========================================================

// Your Firebase configuration
export const firebaseConfig = {
    apiKey: "AIzaSyBXTjkrXmiLhp64MSBU1Ai5Iiv1EJfwA3I",
    authDomain: "ctm-game.firebaseapp.com",
    projectId: "ctm-game",
    storageBucket: "ctm-game.firebasestorage.app",
    messagingSenderId: "204941638255",
    appId: "1:204941638255:web:f23470bb681e9dac6eeb9a"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export the database and authentication services so other files can use them.
export const db = firebase.firestore();
export const auth = firebase.auth();
