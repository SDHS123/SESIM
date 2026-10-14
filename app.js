/**
 * ========================================================
 * 2026 세심제 (SESIM) 웹 애플리케이션 프론트엔드 로직 (app.js)
 * 작성자: Antigravity x 강원사대부고 세심제 TF
 * ========================================================
 */

import { auth, db, SCHOOL_EMAIL_DOMAIN } from './firebase-config.js';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc, setDoc, addDoc, updateDoc, collection, query, where, onSnapshot, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// 활성 예약 상태 (대기열에 포함되는 상태)
const ACTIVE_STATUSES = ['WAIT', 'CALLED'];

// innerHTML 에 넣는 사용자 입력값 이스케이프
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// 네임스페이스 객체
const SESIM = {
  // 현재 로그인한 학생 정보 (Google 로그인 후 학번 자동 파싱, 비로그인 시 null)
  currentUser: null,

  // 부스별 실시간 대기열 { boothId: [예약, ...] } (Firestore reservations 컬렉션)
  waitlists: {},

  // 관리자 화면용 학생 프로필 캐시 { uid: users 문서 }
  profileCache: {},

  _unsubReservations: null,

  // 부스 마스터 데이터
  booths: [
    {
      id: 1,
      club: '컴퓨터 & 수학 동아리',
      title: '방탈출: 미지의 1-1반',
      desc: '제한 시간 15분! 단서를 찾아 암호를 해독하고 교실을 탈출하라!',
      floor: '1f',
      room: '1-1반',
      status: 'OPEN', // OPEN, BREAK, CLOSED
      pin: '1001',
      maxWait: 8
    },
    {
      id: 2,
      club: '인문학 & 심리 동아리',
      title: '미래를 보는 세심 타로 & 사주',
      desc: '너의 연애운, 학업운, 내년 대학운까지 꿰뚫어 보는 족집게 타로!',
      floor: '1f',
      room: '1-2반',
      status: 'OPEN',
      pin: '1002',
      maxWait: 10
    },
    {
      id: 3,
      club: '융합 과학동아리',
      title: '분자요리 실험실 (팝핑보바 만들기)',
      desc: '화학 반응을 이용해 과일 주스로 직접 만드는 알록달록 구슬 주스!',
      floor: '2f',
      room: '과학 1실',
      status: 'BREAK',
      pin: '1003',
      maxWait: 5
    },
    {
      id: 4,
      club: '게임 제작 동아리',
      title: '픽셀 월드 레트로 오락실',
      desc: '철권, 스트리트파이터, 테트리스 교내 최강자를 가리는 미니 대회!',
      floor: '2f',
      room: '컴퓨터실',
      status: 'OPEN',
      pin: '1004',
      maxWait: 12
    },
    {
      id: 5,
      club: '연극 & 영상 제작부',
      title: '공포 체험: 닫힌 교실의 비밀',
      desc: '불 꺼진 3층 특별실에서 벌어지는 소름 돋는 심령 체험... (노약자 주의)',
      floor: '2f',
      room: '음악실 옆',
      status: 'CLOSED',
      pin: '1005',
      maxWait: 6
    }
  ],

  // 내 현재 예약 목록 (동시 최대 2개 제한)
  myReservations: [],

  // 현재 인증된 관리자 부스 ID
  currentAdminBoothId: null,

  // 초기화 메서드
  init() {
    this.renderBooths('all');
    this.renderMyReservations();
    this.startCountdown();
    this.setupEventListeners();
    this.updateUserBadge();
    this.watchAuth();
  },

  // ==================== Google 로그인 ====================
  async login() {
    // 카카오톡 인앱 브라우저는 Google 로그인이 차단되므로 외부 브라우저로 열기
    if (/KAKAOTALK/i.test(navigator.userAgent)) {
      location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href);
      return;
    }

    const provider = new GoogleAuthProvider();
    const params = { prompt: 'select_account' };
    if (SCHOOL_EMAIL_DOMAIN) params.hd = SCHOOL_EMAIL_DOMAIN;
    provider.setCustomParameters(params);

    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
      if (e.code === 'auth/popup-blocked') {
        this.showToast('팝업이 차단되었습니다. 브라우저에서 팝업을 허용해주세요.');
      } else if (e.code === 'auth/unauthorized-domain') {
        this.showToast('승인되지 않은 도메인입니다. (Firebase 승인된 도메인 확인)');
      } else {
        this.showToast('로그인 실패: ' + e.code);
      }
    }
  },

  async logout() {
    if (!confirm('로그아웃 하시겠습니까?')) return;
    await signOut(auth);
    this.showToast('로그아웃 되었습니다.');
  },

  // 학교 이메일 "20262709@..." → 2026학년도 2학년 7반 9번
  parseStudent(user) {
    const id = user.email.split('@')[0];
    const ok = /^\d{8}$/.test(id);
    return {
      studentId: id,
      grade: ok ? Number(id[4]) : null,
      classNum: ok ? Number(id[5]) : null,
      number: ok ? Number(id.slice(6)) : null,
      name: user.displayName || id
    };
  },

  // 로그인 상태 변화 감지 (새로고침해도 로그인 유지됨)
  watchAuth() {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        this.currentUser = null;
        this.stopListeningReservations();
        this.updateUserBadge();
        this.renderMyReservations();
        this.renderBooths();
        return;
      }

      if (SCHOOL_EMAIL_DOMAIN && !user.email.endsWith('@' + SCHOOL_EMAIL_DOMAIN)) {
        await signOut(auth);
        this.showToast(`학교 계정(@${SCHOOL_EMAIL_DOMAIN})으로만 로그인할 수 있습니다.`);
        return;
      }

      const profile = this.parseStudent(user);
      this.currentUser = { uid: user.uid, email: user.email, phone: '', ...profile };
      this.updateUserBadge();
      this.listenReservations();

      // users 컬렉션에 학생 프로필 저장 (첫 로그인 = 자동 가입)
      try {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, { ...profile, email: user.email, lastLogin: serverTimestamp() }, { merge: true });
        const snap = await getDoc(userRef);
        this.currentUser.phone = snap.data()?.phone || '';
      } catch (e) {
        console.error('[SESIM] 프로필 저장 실패:', e);
      }
    });
  },

  // 헤더 프로필 칩 (비로그인 시 로그인 버튼 역할)
  updateUserBadge() {
    const badge = document.getElementById('user-display-name');
    if (!badge) return;
    const u = this.currentUser;
    if (!u) {
      badge.textContent = 'Google 로그인';
    } else if (u.grade) {
      badge.textContent = `${u.grade}-${u.classNum} ${u.name}`;
    } else {
      badge.textContent = u.name;
    }
  },

  // ==================== Firestore 실시간 예약 동기화 ====================
  listenReservations() {
    this.stopListeningReservations();
    const q = query(collection(db, 'reservations'), where('status', 'in', ACTIVE_STATUSES));

    this._unsubReservations = onSnapshot(q, (snap) => {
      // 서버 저장 전(pending) 문서는 createdAt 이 null 이므로 맨 뒤로 정렬
      const ts = (r) => r.createdAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
      const all = snap.docs
        .map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))
        .sort((a, b) => ts(a) - ts(b));

      this.waitlists = {};
      all.forEach(r => (this.waitlists[r.boothId] ??= []).push(r));

      const prevCalled = new Set(this.myReservations.filter(r => r.status === 'CALLED').map(r => r.id));
      const uid = this.currentUser?.uid;
      this.myReservations = all
        .filter(r => r.uid === uid)
        .map(r => {
          const booth = this.booths.find(b => b.id === r.boothId);
          return {
            ...r,
            boothTitle: booth?.title ?? `부스 #${r.boothId}`,
            room: booth?.room ?? '',
            order: this.waitlists[r.boothId].findIndex(x => x.id === r.id) + 1
          };
        });

      // 새로 입장 호출된 예약이 있으면 진동 + 알림
      const newlyCalled = this.myReservations.find(r => r.status === 'CALLED' && !prevCalled.has(r.id));
      if (newlyCalled) {
        if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
        this.showToast(`🔔 [${newlyCalled.boothTitle}] 입장 차례입니다! 부스로 와주세요.`);
      }

      this.renderMyReservations();
      this.renderBooths(this.currentFilter);
      if (this.currentAdminBoothId) this.renderAdminDashboard();
    }, (err) => {
      console.error('[SESIM] 예약 실시간 동기화 실패:', err);
      this.showToast('예약 정보를 불러오지 못했습니다. (' + err.code + ')');
    });
  },

  stopListeningReservations() {
    if (this._unsubReservations) this._unsubReservations();
    this._unsubReservations = null;
    this.waitlists = {};
    this.myReservations = [];
  },

  waitCount(boothId) {
    return this.waitlists[boothId]?.length ?? 0;
  },

  // D-Day 실시간 카운트다운 타이머 (2027년 1월 6일 08:20 개막 기준)
  startCountdown() {
    // 2027년 1월 6일 오전 08:20:00
    const targetDate = new Date('2027-01-06T08:20:00+09:00').getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = targetDate - now;

      if (diff <= 0) {
        // 이미 개막 시간이 지났으면 00:00:00 표시 및 축제 당일 모드로 자동 전환 권장
        document.getElementById('cd-days').textContent = '00';
        document.getElementById('cd-hours').textContent = '00';
        document.getElementById('cd-minutes').textContent = '00';
        document.getElementById('cd-seconds').textContent = '00';
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const pad = (n) => String(n).padStart(2, '0');
      document.getElementById('cd-days').textContent = days;
      document.getElementById('cd-hours').textContent = pad(hours);
      document.getElementById('cd-minutes').textContent = pad(minutes);
      document.getElementById('cd-seconds').textContent = pad(seconds);
    };

    updateTimer();
    setInterval(updateTimer, 1000);
  },

  // 섹션 스크롤 헬퍼
  scrollToSection(sectionId) {
    this.scrollTo(sectionId);
  },

  // 부스 리스트 렌더링
  currentFilter: 'all',

  renderBooths(filter = this.currentFilter) {
    const container = document.getElementById('booth-list');
    if (!container) return;
    this.currentFilter = filter;

    let filtered = this.booths;
    if (filter === 'open') {
      filtered = this.booths.filter(b => b.status === 'OPEN');
    } else if (filter === 'floor1') {
      filtered = this.booths.filter(b => b.floor === '1f');
    } else if (filter === 'floor2') {
      filtered = this.booths.filter(b => b.floor === '2f');
    }

    container.innerHTML = filtered.map(booth => {
      let stateBadge = '';
      let isActionable = false;

      if (booth.status === 'OPEN') {
        stateBadge = '<span class="booth-state-tag open">🟢 예약 가능</span>';
        isActionable = true;
      } else if (booth.status === 'BREAK') {
        stateBadge = '<span class="booth-state-tag break">🟡 브레이크 타임</span>';
      } else {
        stateBadge = '<span class="booth-state-tag closed">🔴 예약 마감</span>';
      }

      // 이미 내가 예약했는지 확인
      const isAlreadyBooked = this.myReservations.some(r => r.boothId === booth.id);

      return `
        <div class="booth-card" data-id="${booth.id}">
          <div class="booth-header">
            <div>
              <div class="club-name">${booth.club}</div>
              <h3 class="booth-title">${booth.title}</h3>
            </div>
            ${stateBadge}
          </div>
          <p class="booth-desc">${booth.desc}</p>
          <div class="booth-footer">
            <div class="booth-meta">
              <span>📍 ${booth.room}</span>
              <span>👥 대기 ${this.waitCount(booth.id)}팀</span>
            </div>
            <button class="btn-reserve"
              ${!isActionable || isAlreadyBooked ? 'disabled' : ''}
              onclick="SESIM.openReserveModal(${booth.id})">
              ${isAlreadyBooked ? '예약 완료됨' : (booth.status === 'OPEN' ? '예약하기' : '예약불가')}
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  // 내 예약 카드 렌더링
  renderMyReservations() {
    const container = document.getElementById('my-res-cards');
    const badge = document.getElementById('res-count-badge');
    if (!container) return;

    badge.textContent = `${this.myReservations.length} / 2개 예약 중`;

    if (!this.currentUser) {
      container.innerHTML = `
        <div class="empty-res">
          부스 예약은 학교 Google 계정으로 로그인한 뒤 이용할 수 있습니다.
          <br><button class="text-btn" onclick="SESIM.login()">Google 로그인 →</button>
        </div>
      `;
      return;
    }

    if (this.myReservations.length === 0) {
      container.innerHTML = `
        <div class="empty-res">
          아직 예약한 부스가 없습니다. 아래 부스 목록에서 마음에 드는 부스를 예약해보세요! (최대 2개 동시 예약 가능)
        </div>
      `;
      return;
    }

    container.innerHTML = this.myReservations.map(res => {
      const isCalled = res.status === 'CALLED';
      return `
        <div class="my-ticket-card">
          <div class="ticket-info">
            <h4>${esc(res.boothTitle)}</h4>
            <p>위치: ${esc(res.room)} | 인원: ${esc(res.party)}명 | 대기순번: <strong>${res.order}번</strong></p>
          </div>
          <div class="ticket-status">
            <span class="status-badge ${isCalled ? 'called' : 'wait'}">
              ${isCalled ? '🔔 입장 호출!' : '⏳ 대기중'}
            </span>
            <button class="btn-cancel-ticket" onclick="SESIM.cancelReservation('${esc(res.id)}')">예약 취소</button>
          </div>
        </div>
      `;
    }).join('');
  },

  // 부스 예약 모달 열기 (로그인 + 2개 제한 사전 검사)
  openReserveModal(boothId) {
    if (!this.currentUser) {
      this.showToast('학교 Google 계정으로 먼저 로그인해주세요.');
      this.login();
      return;
    }

    // 1인당 2개 제한 검사!
    if (this.myReservations.length >= 2) {
      this.showToast('⚠️ 1인당 최대 2개 부스까지만 동시 예약 가능합니다!');
      return;
    }

    const booth = this.booths.find(b => b.id === boothId);
    if (!booth || booth.status !== 'OPEN') {
      this.showToast('현재 예약이 불가능한 부스입니다.');
      return;
    }

    // 중복 검사
    if (this.myReservations.some(r => r.boothId === booth.id)) {
      this.showToast('이미 예약하신 부스입니다.');
      return;
    }

    const u = this.currentUser;
    document.getElementById('modal-booth-title').textContent = booth.title;
    document.getElementById('modal-booth-desc').textContent = booth.desc;
    document.getElementById('modal-booth-loc').textContent = `위치: ${booth.room}`;
    document.getElementById('modal-booth-wait').textContent = `현재 대기: ${this.waitCount(booth.id)}팀`;
    document.getElementById('reserve-student-info').value = u.grade
      ? `${u.grade}학년 ${u.classNum}반 ${u.number}번 ${u.name}`
      : `${u.name} (${u.email})`;
    document.getElementById('reserve-phone').value = u.phone || '';

    // 폼에 boothId 저장
    document.getElementById('reserve-form').dataset.boothId = boothId;

    this.openModal('reserve-modal');
  },

  // 예약 신청 제출 처리 → Firestore reservations 에 저장
  async handleReserveSubmit(e) {
    e.preventDefault();
    if (!this.currentUser) return this.showToast('먼저 로그인해주세요.');

    const boothId = parseInt(document.getElementById('reserve-form').dataset.boothId, 10);
    const phone = document.getElementById('reserve-phone').value.trim();
    const party = parseInt(document.getElementById('reserve-party').value, 10);
    const booth = this.booths.find(b => b.id === boothId);
    if (!booth) return;

    if (this.myReservations.length >= 2) {
      return this.showToast('⚠️ 1인당 최대 2개 부스까지만 동시 예약 가능합니다!');
    }

    const submitBtn = document.getElementById('btn-submit-reserve');
    submitBtn.disabled = true;

    try {
      // 연락처는 본인/관리자만 읽을 수 있는 users 문서에 저장
      await setDoc(doc(db, 'users', this.currentUser.uid),
        { phone, phoneConsentAt: serverTimestamp() }, { merge: true });
      this.currentUser.phone = phone;

      await addDoc(collection(db, 'reservations'), {
        uid: this.currentUser.uid,
        boothId: booth.id,
        party,
        status: 'WAIT',
        createdAt: serverTimestamp()   // 서버 시간 기준 순번 (조작 불가)
      });

      this.closeModal('reserve-modal');
      this.showToast(`🎉 ${booth.title} 예약 완료!`);
      document.getElementById('my-reservations-banner').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      console.error('[SESIM] 예약 실패:', err);
      this.showToast('예약 실패: ' + err.code);
    } finally {
      submitBtn.disabled = false;
    }
  },

  // 예약 취소 (문서는 남기고 상태만 CANCELED 로 변경 → 기록 보존)
  async cancelReservation(resId) {
    if (!confirm('예약을 취소하시겠습니까? 대기 순번이 초기화됩니다.')) return;
    try {
      await updateDoc(doc(db, 'reservations', resId), { status: 'CANCELED' });
      this.showToast('예약이 정상적으로 취소되었습니다.');
    } catch (err) {
      console.error('[SESIM] 취소 실패:', err);
      this.showToast('취소 실패: ' + err.code);
    }
  },

  // ==================== 부스 관리자 모드 ====================
  // ※ PIN 은 화면 진입용일 뿐, 실제 호출/완료 처리는 Firestore admins 컬렉션에 등록된 계정만 가능
  openAdminModal() {
    this.openModal('admin-modal');
  },

  authenticateAdmin() {
    const boothId = parseInt(document.getElementById('admin-booth-select').value, 10);
    const pin = document.getElementById('admin-pin-input').value;
    const booth = this.booths.find(b => b.id === boothId);

    if (booth && booth.pin === pin) {
      this.currentAdminBoothId = boothId;
      document.getElementById('admin-login-view').classList.add('hidden');
      document.getElementById('admin-dashboard-view').classList.remove('hidden');
      this.renderAdminDashboard();
      this.showToast(`🔑 [${booth.title}] 관리자 로그인 성공!`);
    } else {
      alert('비밀번호(PIN)가 일치하지 않습니다!');
    }
  },

  logoutAdmin() {
    this.currentAdminBoothId = null;
    document.getElementById('admin-login-view').classList.remove('hidden');
    document.getElementById('admin-dashboard-view').classList.add('hidden');
    document.getElementById('admin-pin-input').value = '';
    this.showToast('관리자 로그아웃 되었습니다.');
  },

  // 관리자 화면용 학생 프로필 조회 (admins 등록 계정만 읽기 가능)
  async loadProfile(uid) {
    if (uid in this.profileCache) return;
    this.profileCache[uid] = null;
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      this.profileCache[uid] = snap.data() || {};
    } catch (e) {
      this.profileCache[uid] = { denied: true };
    }
    if (this.currentAdminBoothId) this.renderAdminDashboard();
  },

  renderAdminDashboard() {
    const booth = this.booths.find(b => b.id === this.currentAdminBoothId);
    if (!booth) return;
    const waitlist = this.waitlists[booth.id] || [];

    document.getElementById('admin-active-booth-name').textContent = booth.title;
    document.getElementById('admin-wait-count').textContent = waitlist.length;

    // 상태 버튼 활성화 갱신
    document.querySelectorAll('.status-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.status === booth.status);
    });

    const listContainer = document.getElementById('admin-waitlist-items');
    if (!this.currentUser) {
      listContainer.innerHTML = '<p class="empty-res">대기 명단을 보려면 Google 로그인이 필요합니다.</p>';
      return;
    }
    if (waitlist.length === 0) {
      listContainer.innerHTML = '<p class="empty-res">현재 대기 중인 예약자가 없습니다.</p>';
      return;
    }

    listContainer.innerHTML = waitlist.map((wait, idx) => {
      if (!(wait.uid in this.profileCache)) this.loadProfile(wait.uid);
      const p = this.profileCache[wait.uid];
      const who = !p ? '불러오는 중...'
        : p.denied ? '(관리자 권한 필요)'
        : `${p.studentId || ''} ${p.name || ''}`;
      const phone = p?.phone || '';
      const time = wait.createdAt?.toDate?.().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) || '-';
      const isCalled = wait.status === 'CALLED';
      return `
        <div class="admin-waitlist-card">
          <div class="admin-waitlist-info">
            <strong>${idx + 1}번. ${esc(who)} (${esc(wait.party)}명)</strong>
            <span>📞 ${esc(phone || '-')} | 예약시간: ${esc(time)}</span>
          </div>
          <div class="admin-card-actions">
            <!-- 비상 전화/문자 버튼 -->
            ${phone ? `<a href="tel:${esc(phone)}" class="btn-call-phone" title="전화 걸기">📞 전화</a>` : ''}
            <button class="btn-call" onclick="SESIM.callStudent('${esc(wait.id)}')">
              ${isCalled ? '호출중 (재호출)' : '🔔 입장 호출'}
            </button>
            <button class="btn-cancel-ticket" onclick="SESIM.completeStudentEntry('${esc(wait.id)}')">입장완료</button>
          </div>
        </div>
      `;
    }).join('');
  },

  // 관리자 예약 상태 변경 공통 처리
  async setReservationStatus(resId, status) {
    try {
      await updateDoc(doc(db, 'reservations', resId), { status });
      return true;
    } catch (err) {
      console.error('[SESIM] 상태 변경 실패:', err);
      this.showToast(err.code === 'permission-denied'
        ? '권한이 없습니다. (Firestore admins 컬렉션에 등록된 계정만 가능)'
        : '처리 실패: ' + err.code);
      return false;
    }
  },

  // 부스 운영자가 학생 호출 (학생의 내 티켓 화면에 실시간 반영)
  async callStudent(resId) {
    if (await this.setReservationStatus(resId, 'CALLED')) {
      this.showToast('📢 입장 호출 알림을 발송했습니다!');
    }
  },

  // 학생 입장 완료 처리 (대기열에서 빠짐)
  async completeStudentEntry(resId) {
    if (await this.setReservationStatus(resId, 'DONE')) {
      this.showToast('✅ 입장 완료 처리되었습니다.');
    }
  },

  // 부스 상태 변경 (※ 부스 정보는 아직 Firestore 미연동 → 현재 화면에만 반영)
  updateBoothStatus(newStatus) {
    const booth = this.booths.find(b => b.id === this.currentAdminBoothId);
    if (!booth) return;

    booth.status = newStatus;
    this.renderAdminDashboard();
    this.renderBooths();
    this.showToast(`부스 상태가 [${newStatus}] 로 변경되었습니다.`);
  },

  // ==================== 크롬 공룡 스타일 미니 러너 게임 ====================
  game: {
    canvas: null,
    ctx: null,
    animationId: null,
    running: false,
    score: 0,
    dino: { x: 30, y: 130, width: 24, height: 26, vy: 0, jumping: false },
    gravity: 0.75,
    obstacles: [],
    speed: 3.5,
    frameCount: 0
  },

  openMinigameModal() {
    this.openModal('minigame-modal');
    this.initGame();
  },

  initGame() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;

    this.game.canvas = canvas;
    this.game.ctx = canvas.getContext('2d');
    this.game.running = false;
    this.game.score = 0;
    this.game.dino.y = 130;
    this.game.dino.vy = 0;
    this.game.dino.jumping = false;
    this.game.obstacles = [];
    this.game.speed = 3.5;
    this.game.frameCount = 0;

    document.getElementById('game-current-score').textContent = '0';
    document.getElementById('game-start-prompt').classList.remove('hidden');

    if (this.game.animationId) cancelAnimationFrame(this.game.animationId);
    this.drawGameStatic();
  },

  startGame() {
    if (this.game.running) return;
    this.game.running = true;
    document.getElementById('game-start-prompt').classList.add('hidden');
    this.gameLoop();
  },

  jumpDino() {
    if (!this.game.running) {
      this.startGame();
      return;
    }
    if (!this.game.dino.jumping) {
      this.game.dino.vy = -11.5;
      this.game.dino.jumping = true;
    }
  },

  gameLoop() {
    if (!this.game.running) return;

    const { ctx, canvas, dino } = this.game;
    this.game.frameCount++;

    // 물리 업데이트
    dino.vy += this.game.gravity;
    dino.y += dino.vy;
    if (dino.y >= 130) {
      dino.y = 130;
      dino.vy = 0;
      dino.jumping = false;
    }

    // 장애물 생성
    if (this.game.frameCount % 90 === 0) {
      this.game.obstacles.push({
        x: canvas.width + 10,
        y: 136,
        width: 14,
        height: 20
      });
    }

    // 장애물 이동 및 충돌 검사
    for (let i = 0; i < this.game.obstacles.length; i++) {
      const obs = this.game.obstacles[i];
      obs.x -= this.game.speed;

      // 충돌 판정
      if (
        dino.x < obs.x + obs.width &&
        dino.x + dino.width > obs.x &&
        dino.y < obs.y + obs.height &&
        dino.y + dino.height > obs.y
      ) {
        this.gameOver();
        return;
      }
    }

    // 화면 밖 장애물 제거 및 점수 획득
    this.game.obstacles = this.game.obstacles.filter(obs => obs.x > -20);
    this.game.score += 1;
    document.getElementById('game-current-score').textContent = Math.floor(this.game.score / 5);

    // 그리기
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 바닥선
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 156);
    ctx.lineTo(canvas.width, 156);
    ctx.stroke();

    // 공룡 그리기 (귀여운 녹색 렉스)
    ctx.fillStyle = '#10b981';
    ctx.fillRect(dino.x, dino.y, dino.width, dino.height);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(dino.x + 16, dino.y + 4, 4, 4); // 눈

    // 장애물 (선인장 대신 교과서 장애물)
    ctx.fillStyle = '#f43f5e';
    this.game.obstacles.forEach(obs => {
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    });

    this.game.animationId = requestAnimationFrame(() => this.gameLoop());
  },

  drawGameStatic() {
    const { ctx, canvas, dino } = this.game;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 156);
    ctx.lineTo(canvas.width, 156);
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.fillRect(dino.x, dino.y, dino.width, dino.height);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(dino.x + 16, dino.y + 4, 4, 4);
  },

  gameOver() {
    this.game.running = false;
    cancelAnimationFrame(this.game.animationId);
    const finalScore = Math.floor(this.game.score / 5);
    this.showToast(`💥 게임 오버! 최종 점수: ${finalScore}점`);

    const best = parseInt(document.getElementById('game-best-score').textContent.replace(/,/g, ''), 10) || 0;
    if (finalScore > best) {
      document.getElementById('game-best-score').textContent = finalScore.toLocaleString();
      this.showToast(`🔥 신기록 달성! 전교 랭킹 등록 완료! (${finalScore}점)`);
    }

    document.getElementById('game-start-prompt').innerHTML = `<p>💥 게임 오버 (${finalScore}점)<br>다시 도전하려면 터치!</p>`;
    document.getElementById('game-start-prompt').classList.remove('hidden');
  },

  // ==================== 복면가왕 투표 ====================
  castVote(singer) {
    if (localStorage.getItem('sesim_has_voted')) {
      this.showToast('이미 투표에 참여하셨습니다. (계정당 1회)');
      return;
    }
    localStorage.setItem('sesim_has_voted', 'true');
    this.closeModal('vote-modal');
    this.showToast(`🗳️ [${singer}]에게 소중한 1표가 정상 반영되었습니다!`);
  },

  // ==================== 모달 제어 ====================
  openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('hidden');
  },

  closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add('hidden');
  },

  // 토스트 메시지
  showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 2800);
  },

  // 보물찾기 힌트 알림
  showEventHint() {
    alert('🎁 [학생회 게릴라 보물찾기 힌트]\n"햇살이 가장 잘 드는 2층 도서관 3번째 책장 뒤를 찾아보세요!"');
  },

  // 페이지 스크롤 유틸리티
  scrollTo(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  },

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // ==================== 이벤트 리스너 세팅 ====================
  setupEventListeners() {
    // 헤더 프로필 칩: 비로그인 → Google 로그인, 로그인 → 로그아웃
    document.getElementById('user-profile-btn').addEventListener('click', () => {
      if (this.currentUser) this.logout();
      else this.login();
    });

    // 퀵 메뉴 네비게이션 클릭
    document.querySelectorAll('.quick-nav .nav-item[data-target]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.quick-nav .nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.scrollTo(btn.dataset.target);
      });
    });

    // 필터 칩 클릭
    document.querySelectorAll('.filter-chips .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.renderBooths(chip.dataset.filter);
      });
    });

    // 1일차 / 2일차 / 리허설 일정표 탭
    document.querySelectorAll('.day-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const day = tab.dataset.day;

        // 리허설, 1일차, 2일차 전환
        ['timeline-rehearsal', 'timeline-day1', 'timeline-day2'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.classList.add('hidden');
        });

        const targetTimeline = document.getElementById(`timeline-${day}`);
        if (targetTimeline) {
          targetTimeline.classList.remove('hidden');
        }
      });
    });

    // 화면 시뮬레이터 (D-Day 모드 vs 축제 당일 모드 토글)
    const btnDday = document.getElementById('mode-btn-dday');
    const btnFest = document.getElementById('mode-btn-festival');
    const heroDday = document.getElementById('hero-dday-view');
    const heroFest = document.getElementById('hero-festival-view');

    const setMode = (mode) => {
      if (mode === 'dday') {
        if (btnDday) btnDday.classList.add('active');
        if (btnFest) btnFest.classList.remove('active');
        if (heroDday) heroDday.classList.remove('hidden');
        if (heroFest) heroFest.classList.add('hidden');
        this.showToast('[D-Day 사전 모드] 카운트다운 및 포스터 화면입니다.');
      } else {
        if (btnFest) btnFest.classList.add('active');
        if (btnDday) btnDday.classList.remove('active');
        if (heroFest) heroFest.classList.remove('hidden');
        if (heroDday) heroDday.classList.add('hidden');
        this.showToast('[축제 당일 모드] 가로 스크롤 팝업 안내 화면입니다.');
      }
    };

    if (btnDday && btnFest) {
      btnDday.addEventListener('click', () => setMode('dday'));
      btnFest.addEventListener('click', () => setMode('festival'));
    }

    // 바로가기 메뉴 드로어 (사이드바) 제어
    const menuBtn = document.getElementById('menu-btn');
    const menuDrawer = document.getElementById('menu-drawer');
    const drawerBackdrop = document.getElementById('menu-drawer-backdrop');
    const closeDrawerBtn = document.getElementById('close-drawer-btn');

    const openDrawer = () => {
      if (menuDrawer && drawerBackdrop) {
        drawerBackdrop.classList.remove('hidden');
        menuDrawer.classList.remove('hidden');
        setTimeout(() => {
          menuDrawer.classList.add('open');
          drawerBackdrop.classList.add('open');
        }, 10);
      }
    };

    const closeDrawer = () => {
      if (menuDrawer && drawerBackdrop) {
        menuDrawer.classList.remove('open');
        drawerBackdrop.classList.remove('open');
        setTimeout(() => {
          menuDrawer.classList.add('hidden');
          drawerBackdrop.classList.add('hidden');
        }, 250);
      }
    };

    if (menuBtn) menuBtn.addEventListener('click', openDrawer);
    if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeDrawer);
    if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);

    // 드로어 내부 링크 클릭
    document.querySelectorAll('.drawer-nav-link[data-target]').forEach(link => {
      link.addEventListener('click', () => {
        closeDrawer();
        const target = link.dataset.target;
        this.scrollTo(target);
      });
    });

    const drawerMinigame = document.getElementById('drawer-minigame-btn');
    if (drawerMinigame) {
      drawerMinigame.addEventListener('click', () => {
        closeDrawer();
        this.openMinigameModal();
      });
    }

    const drawerVote = document.getElementById('drawer-vote-btn');
    if (drawerVote) {
      drawerVote.addEventListener('click', () => {
        closeDrawer();
        this.openModal('vote-modal');
      });
    }

    const drawerAdmin = document.getElementById('drawer-admin-btn');
    if (drawerAdmin) {
      drawerAdmin.addEventListener('click', () => {
        closeDrawer();
        this.openAdminModal();
      });
    }

    // 오늘의 급식 1일차 / 2일차 탭 전환
    document.querySelectorAll('.meal-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.meal-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const mealDay = tab.dataset.meal;

        const card1 = document.getElementById('meal-card-day1');
        const card2 = document.getElementById('meal-card-day2');
        if (mealDay === 'day1') {
          if (card1) card1.classList.remove('hidden');
          if (card2) card2.classList.add('hidden');
        } else {
          if (card1) card1.classList.add('hidden');
          if (card2) card2.classList.remove('hidden');
        }
      });
    });

    // 팝업 캐러셀 스크롤 & 인디케이터 연동
    const track = document.getElementById('popup-carousel-track');
    const dots = document.querySelectorAll('#carousel-dots .dot');
    if (track && dots.length > 0) {
      track.addEventListener('scroll', () => {
        const slideWidth = track.clientWidth * 0.88;
        const activeIdx = Math.min(dots.length - 1, Math.max(0, Math.round(track.scrollLeft / slideWidth)));
        dots.forEach((dot, idx) => {
          dot.classList.toggle('active', idx === activeIdx);
        });
      });

      dots.forEach((dot, idx) => {
        dot.addEventListener('click', () => {
          const slideWidth = track.clientWidth * 0.88;
          track.scrollTo({ left: idx * slideWidth, behavior: 'smooth' });
        });
      });
    }

    // 캐러셀 복면가왕 바로가기
    const carouselVoteBtn = document.getElementById('carousel-vote-btn');
    if (carouselVoteBtn) {
      carouselVoteBtn.addEventListener('click', () => this.openModal('vote-modal'));
    }

    // 지도 탭 버튼
    document.querySelectorAll('.map-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.map-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.showToast(`${btn.textContent} 지도로 전환되었습니다.`);
      });
    });

    // 미니게임 열기 버튼들
    document.getElementById('open-minigame-btn').addEventListener('click', () => this.openMinigameModal());
    document.getElementById('quick-play-btn').addEventListener('click', () => this.openMinigameModal());

    // 복면가왕 투표 열기
    document.getElementById('open-vote-btn').addEventListener('click', () => this.openModal('vote-modal'));

    // 관리자 모달 열기
    document.getElementById('open-admin-btn').addEventListener('click', () => this.openAdminModal());

    // 새로고침 버튼
    document.getElementById('refresh-res-btn').addEventListener('click', () => {
      this.renderMyReservations();
      this.showToast('예약 현황을 최신 상태로 갱신했습니다.');
    });

    // 게임 점프 리스너
    document.getElementById('game-jump-btn').addEventListener('click', () => this.jumpDino());
    document.getElementById('game-canvas').addEventListener('click', () => this.jumpDino());
    document.getElementById('game-start-prompt').addEventListener('click', () => this.jumpDino());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !document.getElementById('minigame-modal').classList.contains('hidden')) {
        e.preventDefault();
        this.jumpDino();
      }
    });
  }
};

// HTML onclick="SESIM.xxx()" 에서 접근할 수 있도록 전역 등록 (모듈 스코프 → window)
window.SESIM = SESIM;

// 앱 초기화 실행
window.addEventListener('DOMContentLoaded', () => {
  SESIM.init();
});
