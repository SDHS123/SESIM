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

// 학생 학교 계정 이메일 도메인 (예: 20262709@sdhs.gwe.hs.kr)
// 이 도메인이 아닌 계정(예: Gmail)은 roles 에 권한이 등록된 경우에만 로그인 허용
// 바꿀 경우 firestore.rules 의 schoolEmail() 도 같이 바꿀 것!
export const SCHOOL_EMAIL_DOMAIN = 'sdhs.gwe.hs.kr';

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
