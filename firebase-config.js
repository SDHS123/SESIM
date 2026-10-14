// ========================================================
// 2026-2027 세심제 (SESIM) - 파이어베이스 설정 및 연동 모듈
// 프로젝트 ID: sesim-70a8b
// ========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-analytics.js";

// 사용자 제공 Firebase 환경설정
export const firebaseConfig = {
  apiKey: "AIzaSyC7B4fnTp-YqbWPIsLtmNrj_gjNL7D73PE",
  authDomain: "sesim-70a8b.firebaseapp.com",
  projectId: "sesim-70a8b",
  storageBucket: "sesim-70a8b.firebasestorage.app",
  messagingSenderId: "323972994443",
  appId: "1:323972994443:web:b327b168005700d31dcb8e",
  measurementId: "G-3VFN37DF1D"
};

// Firebase 앱 및 애널리틱스 초기화
export const app = initializeApp(firebaseConfig);
export let analytics = null;

try {
  analytics = getAnalytics(app);
  console.log("Firebase Analytics initialized successfully.");
} catch (e) {
  console.warn("Analytics initialization skipped (e.g. offline or blocked):", e);
}

// 전역 객체에 등록하여 기존 app.js와 원활히 연동
window.firebaseApp = app;
window.firebaseAnalytics = analytics;
window.firebaseConfig = firebaseConfig;

console.log("🔥 [SESIM] Firebase 연결 완료: sesim-70a8b");
