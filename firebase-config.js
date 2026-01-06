import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBiFvnMMjQWZc3h7xgJrpmOpBizRfLQUqo",
  authDomain: "bookswap-83a96.firebaseapp.com",
  projectId: "bookswap-83a96",
  storageBucket: "bookswap-83a96.firebasestorage.app",
  messagingSenderId: "472443458870",
  appId: "1:472443458870:web:a1f0f47f4eb9ebe0a4cf97",
  measurementId: "G-T9PJFZ7J8X"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };