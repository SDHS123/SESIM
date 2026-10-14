// ========================================================
// 2026-2027 세심제 (SESIM) - 파이어베이스 설정 및 연동 모듈
// 프로젝트 ID: sesim-70a8b
// ========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// 사용자 제공 Firebase 환경설정 (공개되어도 되는 값. 데이터 보호는 firestore.rules가 담당)
export const firebaseConfig = {
  apiKey: "AIzaSyC7B4fnTp-YqbWPIsLtmNrj_gjNL7D73PE",
  authDomain: "sesim-70a8b.firebaseapp.com",
  projectId: "sesim-70a8b",
  storageBucket: "sesim-70a8b.firebasestorage.app",
  messagingSenderId: "323972994443",
  appId: "1:323972994443:web:b327b168005700d31dcb8e",
  measurementId: "G-3VFN37DF1D"
};

// 학생 학교 계정 이메일 도메인 (예: 'school.kr')
// 비워두면 모든 Google 계정 로그인 허용. 채우면 firestore.rules 의 도메인도 같이 바꿀 것!
export const SCHOOL_EMAIL_DOMAIN = '';

// Firebase 앱 / 인증 / DB 초기화
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export let analytics = null;

try {
  analytics = getAnalytics(app);
} catch (e) {
  console.warn("Analytics initialization skipped (e.g. offline or blocked):", e);
}

console.log("🔥 [SESIM] Firebase 연결 완료: sesim-70a8b");
