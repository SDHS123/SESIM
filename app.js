/**
 * ========================================================
 * 2026 세심제 (SESIM) 웹 애플리케이션 프론트엔드 로직 (app.js)
 * 작성자: Antigravity x 강원사대부고 세심제 TF
 * ========================================================
 */

// 네임스페이스 객체
const SESIM = {
  // 현재 접속 학생 정보 (학교 이메일: 20262709@... 기반 자동 파싱 모의)
  currentUser: {
    studentId: '20262709',
    grade: 2,
    classNum: 7,
    number: 9,
    name: '박기령',
    phone: '010-9876-5432'
  },

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
      maxWait: 8,
      waitlist: [
        { name: '1-2 김민수', phone: '010-1111-2222', party: 2, status: 'WAIT', time: '10:15' },
        { name: '2-3 이지혜', phone: '010-3333-4444', party: 3, status: 'WAIT', time: '10:20' },
        { name: '3-1 정우진', phone: '010-5555-6666', party: 1, status: 'WAIT', time: '10:25' }
      ]
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
      maxWait: 10,
      waitlist: [
        { name: '2-5 한소희', phone: '010-2222-3333', party: 2, status: 'WAIT', time: '10:10' },
        { name: '1-4 박도윤', phone: '010-4444-5555', party: 1, status: 'WAIT', time: '10:18' }
      ]
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
      maxWait: 5,
      waitlist: [
        { name: '3-4 최유진', phone: '010-7777-8888', party: 2, status: 'WAIT', time: '10:30' }
      ]
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
      maxWait: 12,
      waitlist: [
        { name: '2-2 장서준', phone: '010-8888-9999', party: 2, status: 'WAIT', time: '10:12' },
        { name: '1-7 강다은', phone: '010-9999-0000', party: 1, status: 'WAIT', time: '10:19' },
        { name: '2-7 박기령', phone: '010-9876-5432', party: 2, status: 'WAIT', time: '10:22' }
      ]
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
      maxWait: 6,
      waitlist: []
    }
  ],

  // 내 현재 예약 목록 (동시 최대 2개 제한)
  myReservations: [],

  // 현재 인증된 관리자 부스 ID
  currentAdminBoothId: null,

  // 초기화 메서드
  init() {
    this.loadState();
    this.renderBooths('all');
    this.renderMyReservations();
    this.startCountdown();
    this.setupEventListeners();
    this.updateUserBadge();
  },

  // 로컬 스토리지 불러오기
  loadState() {
    const saved = localStorage.getItem('sesim_my_reservations');
    if (saved) {
      try {
        this.myReservations = JSON.parse(saved);
      } catch (e) {
        this.myReservations = [];
      }
    } else {
      // 초기 데모 예약 1건 세팅
      this.myReservations = [
        {
          id: 'res_' + Date.now(),
          boothId: 4,
          boothTitle: '픽셀 월드 레트로 오락실',
          room: '컴퓨터실',
          order: 3,
          party: 2,
          status: 'WAIT', // WAIT or CALLED
          time: '방금 전'
        }
      ];
      this.saveState();
    }
  },

  saveState() {
    localStorage.setItem('sesim_my_reservations', JSON.stringify(this.myReservations));
  },

  // 유저 뱃지 업데이트
  updateUserBadge() {
    const badge = document.getElementById('user-display-name');
    if (badge) {
      badge.textContent = `${this.currentUser.grade}-${this.currentUser.classNum} ${this.currentUser.name}`;
    }
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
  renderBooths(filter = 'all') {
    const container = document.getElementById('booth-list');
    if (!container) return;

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
              <span>👥 대기 ${booth.waitlist.length}팀</span>
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
            <h4>${res.boothTitle}</h4>
            <p>위치: ${res.room} | 인원: ${res.party}명 | 대기순번: <strong>${res.order}번</strong></p>
          </div>
          <div class="ticket-status">
            <span class="status-badge ${isCalled ? 'called' : 'wait'}">
              ${isCalled ? '🔔 입장 호출!' : '⏳ 대기중'}
            </span>
            <button class="btn-cancel-ticket" onclick="SESIM.cancelReservation('${res.id}')">예약 취소</button>
          </div>
        </div>
      `;
    }).join('');
  },

  // 부스 예약 모달 열기 (2개 제한 사전 검사)
  openReserveModal(boothId) {
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

    document.getElementById('modal-booth-title').textContent = booth.title;
    document.getElementById('modal-booth-desc').textContent = booth.desc;
    document.getElementById('modal-booth-loc').textContent = `위치: ${booth.room}`;
    document.getElementById('modal-booth-wait').textContent = `현재 대기: ${booth.waitlist.length}팀`;
    document.getElementById('reserve-student-info').value = `${this.currentUser.grade}학년 ${this.currentUser.classNum}반 ${this.currentUser.number}번 ${this.currentUser.name}`;
    document.getElementById('reserve-phone').value = this.currentUser.phone;

    // 폼에 boothId 저장
    document.getElementById('reserve-form').dataset.boothId = boothId;

    this.openModal('reserve-modal');
  },

  // 예약 신청 제출 처리
  handleReserveSubmit(e) {
    e.preventDefault();
    const boothId = parseInt(document.getElementById('reserve-form').dataset.boothId, 10);
    const phone = document.getElementById('reserve-phone').value;
    const party = parseInt(document.getElementById('reserve-party').value, 10);
    const booth = this.booths.find(b => b.id === boothId);

    if (!booth) return;

    // 대기 번호 계산
    const newOrder = booth.waitlist.length + 1;

    // 부스 대기열에 추가
    const waitItem = {
      name: `${this.currentUser.grade}-${this.currentUser.classNum} ${this.currentUser.name}`,
      phone: phone,
      party: party,
      status: 'WAIT',
      time: '방금 전'
    };
    booth.waitlist.push(waitItem);

    // 내 티켓 생성
    const newReservation = {
      id: 'res_' + Date.now(),
      boothId: booth.id,
      boothTitle: booth.title,
      room: booth.room,
      order: newOrder,
      party: party,
      status: 'WAIT',
      time: '방금 전'
    };

    this.myReservations.push(newReservation);
    this.saveState();

    this.closeModal('reserve-modal');
    this.renderMyReservations();
    this.renderBooths();
    this.showToast(`🎉 ${booth.title} 예약 완료! (대기번호 ${newOrder}번)`);

    // 상단 내 예약 영역으로 부드럽게 스크롤
    document.getElementById('my-reservations-banner').scrollIntoView({ behavior: 'smooth' });
  },

  // 예약 취소
  cancelReservation(resId) {
    if (!confirm('예약을 취소하시겠습니까? 대기 순번이 초기화됩니다.')) return;

    const res = this.myReservations.find(r => r.id === resId);
    if (res) {
      const booth = this.booths.find(b => b.id === res.boothId);
      if (booth) {
        // 부스 대기열에서 제거
        booth.waitlist = booth.waitlist.filter(w => !w.name.includes(this.currentUser.name));
      }
    }

    this.myReservations = this.myReservations.filter(r => r.id !== resId);
    this.saveState();
    this.renderMyReservations();
    this.renderBooths();
    this.showToast('예약이 정상적으로 취소되었습니다.');
  },

  // ==================== 부스 관리자 모드 ====================
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
      alert('비밀번호(PIN)가 일치하지 않습니다! (힌트: 1001, 1002, 1003, 1004 중 하나)');
    }
  },

  logoutAdmin() {
    this.currentAdminBoothId = null;
    document.getElementById('admin-login-view').classList.remove('hidden');
    document.getElementById('admin-dashboard-view').classList.add('hidden');
    document.getElementById('admin-pin-input').value = '';
    this.showToast('관리자 로그아웃 되었습니다.');
  },

  renderAdminDashboard() {
    const booth = this.booths.find(b => b.id === this.currentAdminBoothId);
    if (!booth) return;

    document.getElementById('admin-active-booth-name').textContent = booth.title;
    document.getElementById('admin-wait-count').textContent = booth.waitlist.length;

    // 상태 버튼 활성화 갱신
    document.querySelectorAll('.status-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.status === booth.status);
    });

    const listContainer = document.getElementById('admin-waitlist-items');
    if (booth.waitlist.length === 0) {
      listContainer.innerHTML = '<p class="empty-res">현재 대기 중인 예약자가 없습니다.</p>';
      return;
    }

    listContainer.innerHTML = booth.waitlist.map((wait, idx) => {
      const isCalled = wait.status === 'CALLED';
      return `
        <div class="admin-waitlist-card">
          <div class="admin-waitlist-info">
            <strong>${idx + 1}번. ${wait.name} (${wait.party}명)</strong>
            <span>📞 ${wait.phone} | 예약시간: ${wait.time}</span>
          </div>
          <div class="admin-card-actions">
            <!-- 비상 전화/문자 버튼 -->
            <a href="tel:${wait.phone}" class="btn-call-phone" title="전화 걸기">📞 전화</a>
            <button class="btn-call" onclick="SESIM.callStudent(${idx})">
              ${isCalled ? '호출중 (재호출)' : '🔔 입장 호출'}
            </button>
            <button class="btn-cancel-ticket" onclick="SESIM.completeStudentEntry(${idx})">입장완료</button>
          </div>
        </div>
      `;
    }).join('');
  },

  // 부스 운영자가 학생 호출 시 (웹 알림 및 내 티켓 상태 업데이트)
  callStudent(index) {
    const booth = this.booths.find(b => b.id === this.currentAdminBoothId);
    if (!booth || !booth.waitlist[index]) return;

    const student = booth.waitlist[index];
    student.status = 'CALLED';

    // 만약 현재 로그인된 학생 본인이면 내 티켓에도 즉시 CALLED 반영
    this.myReservations.forEach(r => {
      if (r.boothId === booth.id) {
        r.status = 'CALLED';
      }
    });
    this.saveState();
    this.renderMyReservations();
    this.renderAdminDashboard();

    this.showToast(`📢 ${student.name} 학생에게 입장 호출 알림을 발송했습니다!`);
  },

  // 학생 입장 완료 처리 (명단에서 제거)
  completeStudentEntry(index) {
    const booth = this.booths.find(b => b.id === this.currentAdminBoothId);
    if (!booth) return;

    const completed = booth.waitlist.splice(index, 1)[0];
    // 내 티켓에서도 해당 부스 완료 처리 (자동 제거)
    this.myReservations = this.myReservations.filter(r => r.boothId !== booth.id);
    this.saveState();

    this.renderMyReservations();
    this.renderBooths();
    this.renderAdminDashboard();
    this.showToast(`✅ ${completed.name} 학생 입장 완료 처리되었습니다.`);
  },

  // 부스 상태 변경
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
        this.showToast('⏳ [D-Day 사전 모드] 카운트다운 & 포스터 티저 화면');
      } else {
        if (btnFest) btnFest.classList.add('active');
        if (btnDday) btnDday.classList.remove('active');
        if (heroFest) heroFest.classList.remove('hidden');
        if (heroDday) heroDday.classList.add('hidden');
        this.showToast('🎉 [축제 당일 모드] 가로 스크롤 팝업 슬라이더 화면');
      }
    };

    if (btnDday && btnFest) {
      btnDday.addEventListener('click', () => setMode('dday'));
      btnFest.addEventListener('click', () => setMode('festival'));
    }

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
        this.showToast(`🗺️ ${btn.textContent} 지도로 전환되었습니다.`);
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

// 앱 초기화 실행
window.addEventListener('DOMContentLoaded', () => {
  SESIM.init();
});
