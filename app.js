import { MinigameEngine } from './src/minigame/core/MinigameEngine.js';
import { MinigameUIContext } from './src/minigame/core/MinigameUIContext.js';
import { ScoreStorageManager } from './src/minigame/db/storageFallback.js';

const scenariosData = {
        fairyTale: [
    { emoji: "🐦", title: "흥부와 제비", desc: "가난하지만 마음씨 착한 흥부는 어느 날 다리가 부러진 제비를 발견했어요. 흥부는 제비를 그냥 지나치지 않고 집으로 데려와 정성껏 돌보아 주었지요. 시간이 흘러 건강을 되찾은 제비는 하늘로 날아갔고, 다시 돌아온 제비는 흥부에게 신비한 박씨 하나를 물어다 주었어요. 흥부는 그 씨앗을 보며 어떤 일이 일어날지 조용히 기대하고 있었답니다." },
    { emoji: "🐢", title: "토끼와 자라", desc: "용왕님은 큰 병에 걸려 괴로워하고 있었고, 신하들은 병을 고칠 방법을 찾느라 분주했어요. 그때 자라는 토끼의 간이 약이 된다는 말을 듣고 육지로 올라오게 되었지요. 자라는 토끼에게 바다 궁전의 멋진 모습을 이야기하며 함께 가자고 설득했어요. 토끼는 자라의 말을 들으며 정말 믿어도 될지 잠시 고민하고 있었답니다." },
    { emoji: "👠", title: "신데렐라", desc: "신데렐라는 요정의 도움으로 아름다운 드레스를 입고 궁전 무도회에 가게 되었어요. 왕자와 즐거운 시간을 보내던 신데렐라는 시간이 얼마나 흘렀는지 잠시 잊고 있었지요. 그런데 시계 종소리가 울리며 자정이 가까워지자, 요정의 마법이 곧 풀린다는 사실이 떠올랐어요. 신데렐라는 깜짝 놀라 서둘러 궁전을 빠져나가다 그만 유리구두 한 짝을 계단에 남기고 말았답니다." },
    { emoji: "🍎", title: "백설공주", desc: "백설공주는 숲속 작은 집에서 일곱 난쟁이와 함께 조심히 지내고 있었어요. 어느 날 낯선 할머니가 찾아와 반짝이는 빨간 사과를 건넸지요. 백설공주는 처음에는 망설였지만, 친절한 말에 마음이 흔들리고 말았어요. 결국 사과를 한 입 베어 문 순간, 백설공주는 깊은 잠에 빠져 조용히 쓰러지고 말았답니다." },
    { emoji: "🤥", title: "피노키오", desc: "피노키오는 진짜 사람이 되고 싶다는 마음을 늘 품고 있었어요. 하지만 호기심이 많은 피노키오는 중요한 약속을 자주 잊고 다른 길로 새곤 했지요. 어느 날 요정과의 약속을 지키지 못한 피노키오는 자신의 행동을 숨기려고 거짓말을 하기 시작했어요. 그러자 신기하게도 피노키오의 코가 점점 길어지며 그의 거짓말을 그대로 보여 주었답니다." },
    { emoji: "🐷", title: "아기돼지 삼형제", desc: "아기돼지 삼형제는 각자 다른 재료로 집을 짓기 시작했어요. 첫째는 빨리 끝내려고 짚으로, 둘째는 나무로, 셋째는 시간을 들여 벽돌로 집을 지었지요. 얼마 지나지 않아 배고픈 늑대가 나타나 형제들의 집을 하나씩 찾아왔어요. 늑대의 거센 입김에 앞의 두 집은 쉽게 흔들렸지만, 셋째의 벽돌집은 단단하게 형제들을 지켜 주었답니다." },
    { emoji: "🐺", title: "빨간모자", desc: "빨간모자는 아픈 할머니께 음식을 전해 드리기 위해 숲길을 지나고 있었어요. 엄마는 낯선 사람과 말을 오래 하지 말라고 당부했지만, 숲속에서 만난 늑대는 아주 친절한 목소리로 말을 걸었지요. 늑대는 빨간모자의 목적지를 슬쩍 물으며 어디로 가는지 알아내려고 했어요. 빨간모자는 늑대가 정말 친절한지, 아니면 다른 마음을 품고 있는지 아직 알지 못했답니다." },
    { emoji: "🧜‍♀️", title: "인어공주", desc: "인어공주는 바닷속 세상보다 인간 세상을 더 궁금해했어요. 특히 폭풍우 속에서 구해 준 왕자를 다시 만나고 싶은 마음이 점점 커졌지요. 결국 인어공주는 바다 마녀를 찾아가 자신의 아름다운 목소리와 바꿔 인간의 두 다리를 얻게 되었어요. 하지만 그 선택이 자신에게 어떤 어려움을 가져올지 아직 모두 알지는 못했답니다." },
    { emoji: "🍪", title: "헨젤과 그레텔", desc: "헨젤과 그레텔은 깊은 숲속에서 길을 잃고 점점 지쳐 가고 있었어요. 배도 고프고 무서운 마음이 커질 때쯤, 멀리서 아주 달콤한 냄새가 풍겨 왔지요. 남매가 냄새를 따라가 보니 사탕과 쿠키, 초콜릿으로 꾸며진 커다란 과자 집이 눈앞에 나타났어요. 두 아이는 반가운 마음도 들었지만, 한편으로는 이런 집이 숲속에 왜 있는지 궁금해졌답니다." },
    { emoji: "🦢", title: "미운 오리 새끼", desc: "다른 아기 오리들과 달리 조금 크고 낯선 모습으로 태어난 아기 새는 늘 외로웠어요. 형제들과 동물들은 그를 이상하게 여기며 자꾸만 놀리고 밀어냈지요. 아기 새는 자신이 왜 이렇게 다른지 알 수 없어 상처를 안고 홀로 떠돌게 되었어요. 그러던 어느 날 맑은 물에 비친 자신의 모습을 보며, 자신이 사실은 아름다운 백조였다는 것을 깨닫게 되었답니다." }
],
        greatPeople: [
            { emoji: "🍎", title: "뉴턴과 사과", desc: "나무 아래서 쉬던 위대한 과학자 뉴턴의 머리 위로 사과가 툭 떨어졌습니다." },
            { emoji: "📜", title: "세종대왕", desc: "백성들이 글을 읽지 못해 억울한 일을 당하는 것을 본 세종대왕이 누구나 쉽게 배울 수 있는 훈민정음을 창제했습니다." },
            { emoji: "🐢", title: "이순신과 거북선", desc: "적군의 침략에 대비하기 위해 이순신 장군이 지붕을 철갑으로 덮고 뾰족한 창을 꽂은 거북선을 만들었습니다." },
            { emoji: "💡", title: "토마스 에디슨", desc: "1,000번이 넘는 실패에도 포기하지 않고 실험을 거듭한 에디슨이 마침내 오래 빛나는 백열전구를 발명했습니다." },
            { emoji: "🌌", title: "알베르트 아인슈타인", desc: "호기심 많던 소년 아인슈타인이 빛의 속도를 상상하며 시간과 공간이 절대적이지 않다는 상대성 이론을 발표했습니다." },
            { emoji: "🧪", title: "퀴리 부인", desc: "안전 장비도 없는 열악한 실험실에서 수많은 광석을 끓이던 퀴리 부인이 새로운 원소인 라듐을 발견했습니다." },
            { emoji: "✈️", title: "라이트 형제", desc: "새처럼 하늘을 날고 싶다는 꿈을 가진 자전거 수리공 형제가 수많은 추락 끝에 최초의 동력 비행기를 띄웠습니다." },
            { emoji: "💧", title: "헬렌 켈러", desc: "보지도 듣지도 못해 분노하던 헬렌이 설리번 선생님의 도움으로 펌프에서 쏟아지는 물의 이름을 깨닫고 눈물을 흘렸습니다." },
            { emoji: "⏰", title: "장영실", desc: "노비 출신이었지만 뛰어난 손재주를 가진 장영실이 세종대왕의 명을 받아 스스로 시간을 알리는 자격루를 만들었습니다." },
            { emoji: "🎩", title: "에이브러햄 링컨", desc: "미국의 분열을 막고 모든 사람의 평등을 위해 링컨 대통령이 흑인 노예 해방 선언문에 서명했습니다." }
        ],
        classics: [
            { emoji: "🪲", title: "변신", desc: "어느 날 아침 잠에서 깨어난 그레고르는 자신이 커다란 벌레로 변해버린 것을 발견했습니다." },
            { emoji: "🥂", title: "위대한 개츠비", desc: "개츠비는 매일 밤 자신의 커다란 저택에서 소중한 친구를 애타게 기다리며 화려한 파티를 열었습니다." },
            { emoji: "🥖", title: "레미제라블", desc: "배고픈 굶주린 조카들을 위해 빵 한 조각을 훔친 장발장은 오랜 시간 감옥에 갇혀 있어야 했습니다." },
            { emoji: "🧪", title: "지킬 박사와 하이드", desc: "착한 지킬 박사가 발명한 신비한 약을 마시자, 밤마다 무서운 악당 하이드로 모습이 변하게 되었습니다." },
            { emoji: "🐳", title: "모비딕", desc: "에이해브 선장은 자신의 다리를 빼앗아간 거대한 하얀 고래 모비딕을 찾기 위해 거친 바다로 떠났습니다." },
            { emoji: "⚡", title: "프랑켄슈타인", desc: "천재 과학자 프랑켄슈타인이 생명을 불어넣는 실험을 통해 무시무시한 괴물을 만들어냈습니다." },
            { emoji: "💖", title: "오만과 편견", desc: "첫인상만 보고 서로를 나쁜 사람이라고 오해했던 엘리자베스와 다아시가 점차 진짜 모습을 알아가게 됩니다." },
            { emoji: "🦊", title: "어린 왕자", desc: "소행성 B612호에서 온 어린 왕자가 사막에서 여우를 만나 '길들인다'는 것의 진짜 의미를 배우게 되었습니다." },
            { emoji: "⚔️", title: "돈키호테", desc: "기사 소설에 푹 빠진 돈키호테가 거대한 풍차를 나쁜 거인으로 착각하고 로시난테를 타고 돌진했습니다." },
            { emoji: "🌍", title: "80일간의 세계일주", desc: "시간을 칼같이 지키는 영국 신사 필리어스 포그가 전 재산을 걸고 80일 만에 세계를 도는 내기를 시작했습니다." }
        ]
    };

    const shopItems = [
        { id: 'default', type: 'skin', name: '🍭 알록달록 젤리 스킨', desc: '[기본] 쫀득하고 귀여운 캔디팝 테마!', price: 0 },
        { id: 'skin_lavender', type: 'skin', name: '🔮 러블리 라벤더 스킨', desc: '[무료] 다정한 파스텔 라벤더 테마!', price: 0 },
        { id: 'effect_skyblue', type: 'effect', name: '☁️ 하늘색 구름 폭죽', desc: '[무료] 맑은 하늘색 팡파르가 터집니다!', price: 0 },
        { id: 'effect_red', type: 'effect', name: '🔴 붉은 열정의 폭죽', desc: '[무료] 질문 성공 시 붉은색 폭죽이 터집니다.', price: 0 },
        { id: 'effect_green', type: 'effect', name: '💚 초록 생명의 폭죽', desc: '[무료] 질문 성공 시 상쾌한 초록빛 폭죽이 터집니다.', price: 0 },
        { id: 'effect_tricolor', type: 'premium_effect', name: '🎉 삼색 환상의 폭죽', desc: '[프리미엄] 가장 화려한 삼색 폭죽이 터집니다.', price: 30 },
        { id: 'effect_potion', type: 'premium_effect', name: '🧪 마녀의 비밀 물약', desc: '[프리미엄] 화면 중앙에서 보랏빛과 연두빛 마법 물약 폭발!', price: 20 },
        { id: 'effect_meteor', type: 'premium_effect', name: '🌠 황금 유성우', desc: '[프리미엄] 하늘에서 황금빛 별똥별들이 우수수 쏟아져 내립니다!', price: 30 },
        { id: 'effect_quake', type: 'premium_effect', name: '⚡ 대지의 진동 스크롤', desc: '[프리미엄] 스마트폰 화면이 요동치며 황금빛 오라가 뿜어져 나옵니다!', price: 40 },
        { id: 'effect_fireworks', type: 'premium_effect', name: '🎆 대마법사의 연회', desc: '[프리미엄] 화면 3곳에서 연속으로 거대한 불꽃놀이가 터집니다!', price: 50 },
        { id: 'skin_dark', type: 'skin', name: '🔮 흑마법사 스킨', desc: '스멀스멀 움직이는 어둠의 입자와 보랏빛 후광이 추가됩니다.', price: 40 },
        { id: 'skin_fairy', type: 'skin', name: '🧚‍♀️ 숲속의 요정 스킨', desc: '둥둥 떠다니는 초록빛 숲의 정령 애니메이션이 추가됩니다.', price: 40 },
        { id: 'skin_royal', type: 'skin', name: '👑 황실 대마법사 스킨', desc: '눈부시게 일렁이는 황금빛 물결 애니메이션이 추가됩니다.', price: 80 }
    ];
    
    let currentCategory = '';
    let currentSessionStars = 0;
    let currentStudentName = localStorage.getItem('alchemist_current_student') || '';
    const TEACHER_PASSWORD = '1111';
    const ATTEMPT_LOG_KEY = 'alchemist_attempt_logs_v1';
    
    let totalStars = parseInt(localStorage.getItem('alchemist_total_stars') || '0');
    let inventory = JSON.parse(localStorage.getItem('alchemist_inventory') || '[]');
    
    if (!inventory.includes('default')) inventory.push('default');
    if (!inventory.includes('skin_lavender')) inventory.push('skin_lavender');
    if (!inventory.includes('effect_skyblue')) inventory.push('effect_skyblue');
    if (!inventory.includes('effect_red')) inventory.push('effect_red');
    if (!inventory.includes('effect_green')) inventory.push('effect_green');
    localStorage.setItem('alchemist_inventory', JSON.stringify(inventory));

    let equippedEffect = localStorage.getItem('alchemist_equipped_effect') || 'effect_skyblue';
    let equippedSkin = localStorage.getItem('alchemist_equipped_skin') || 'default';
    let ongoingQuests = JSON.parse(localStorage.getItem('alchemist_ongoing_quests') || '{}');
    
    let previewingSkinId = null;
    let selectedTeacherStudent = null;
    
    applyTheme(equippedSkin, false);
    updateTopBar();

    function getTitle(stars) {
        if(stars >= 90) return "👑 전설의 대연금술사";
        if(stars >= 80) return "✨ 빛나는 마스터";
        if(stars >= 70) return "💎 현자의 돌 소유자";
        if(stars >= 60) return "🧙‍♂️ 위대한 연금술사";
        if(stars >= 50) return "👁️ 진리의 탐색자";
        if(stars >= 40) return "🪄 마법의 질문가";
        if(stars >= 30) return "🦉 지혜로운 탐구자";
        if(stars >= 20) return "🧪 숙련된 탐구자";
        if(stars >= 10) return "📖 초보 연금술사";
        return "🌱 견습 연금술사";
    }

    function updateTopBar() {
        document.getElementById('total-stars-display').innerText = totalStars;
        document.getElementById('user-title-display').innerText = getTitle(totalStars);
    }

    function setApiStatus(state) {
        const dot = document.getElementById('api-status-dot');
        dot.className = 'status-dot'; 
        if (state === 'green') dot.classList.add('status-green');
        else if (state === 'yellow') dot.classList.add('status-yellow');
        else if (state === 'red') dot.classList.add('status-red');
    }

    function applyTheme(skinId, animate = false) {
        document.body.className = (skinId === 'default' ? '' : skinId);
        if (animate) {
            let colors = ['#FF6B81', '#48DBFB', '#FECA57'];
            if (skinId === 'skin_gpt') colors = ['#8b6cf7', '#ff7eb6', '#ffcf5a'];
            else if (skinId === 'skin_lavender') colors = ['#9575CD', '#81D4FA', '#FFAB91'];
            else if (skinId === 'skin_dark') colors = ['#9B59B6', '#8E44AD', '#34495E'];
            else if (skinId === 'skin_fairy') colors = ['#1DD1A1', '#10AC84', '#E3FDFD'];
            else if (skinId === 'skin_royal') colors = ['#FECA57', '#FDCB6E', '#FFFFFF'];
            confetti({ particleCount: 150, spread: 120, origin: { y: 0.2 }, colors: colors, zIndex: 9999, disableForReducedMotion: true });
        }
    }

    function showPage(id) {
        if (id !== 'page-shop' && previewingSkinId !== null) endPreview();
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        if (id === 'page-teacher-dashboard') renderTeacherDashboard();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function handleStudentEntryClick() {
        if (currentStudentName) {
            if (confirm(`'${currentStudentName}'(으)로 계속하시겠습니까?`)) { showPage('page-home'); } 
            else { if (confirm("새 이름으로 시작하면 이전 진행 상황이 초기화됩니다. 계속 하시겠습니까?")) { resetStudentData(); showPage('page-student-entry'); } }
        } else { showPage('page-student-entry'); }
    }

    function resetStudentData() {
        currentStudentName = ''; localStorage.removeItem('alchemist_current_student');
        totalStars = 0; localStorage.setItem('alchemist_total_stars', '0');
        ongoingQuests = {}; localStorage.setItem('alchemist_ongoing_quests', JSON.stringify(ongoingQuests));
        updateTopBar();
    }

    function enterStudentMode() {
        const name = document.getElementById('student-name-input').value.trim();
        if (!name) return alert('이름을 입력해주세요!');
        currentStudentName = name; localStorage.setItem('alchemist_current_student', currentStudentName); showPage('page-home');
    }

    function enterTeacherMode() {
        const pw = document.getElementById('teacher-password-input').value.trim();
        if (pw !== TEACHER_PASSWORD) return alert('비밀번호가 올바르지 않아요.'); renderTeacherDashboard(); showPage('page-teacher-dashboard');
    }

    function getAttemptLogs() { return JSON.parse(localStorage.getItem(ATTEMPT_LOG_KEY) || '[]'); }
    function saveAttemptLogs(logs) { localStorage.setItem(ATTEMPT_LOG_KEY, JSON.stringify(logs)); }

    function logAttempt(payload) {
        const logs = getAttemptLogs();
        logs.push({
            id: Date.now() + '_' + Math.random().toString(36).slice(2, 8), date: new Date().toLocaleString(), studentName: currentStudentName || '이름없음',
            category: currentCategory, scenarioTitle: payload.scenarioTitle || '', step: payload.step, question: payload.question || '',
            resultType: payload.resultType || 'fail', isPass: payload.isPass || false, scores: payload.scores || {}, total: payload.total || 0,
            feedback: payload.feedback || '', teacherNote: payload.teacherNote || '', nextTip: payload.nextTip || ''
        });
        saveAttemptLogs(logs);
    }

function renderTeacherDashboard() {
    const logs = getAttemptLogs();
    const summaryBox = document.getElementById('teacher-summary-box');
    const list = document.getElementById('teacher-records-list');

    if (logs.length === 0) {
        summaryBox.innerHTML = `<div class="scenario-box">아직 기록이 없어요.</div>`;
        list.innerHTML = '';
        return;
    }

    const studentMap = {};
    logs.forEach(log => {
        if (!studentMap[log.studentName]) {
            studentMap[log.studentName] = { attempts: 0, pass: 0, redirect: 0, fail: 0 };
        }
        studentMap[log.studentName].attempts++;
        if (log.resultType === 'pass') studentMap[log.studentName].pass++;
        else if (log.resultType === 'redirect') studentMap[log.studentName].redirect++;
        else studentMap[log.studentName].fail++;
    });

    const studentNames = Object.keys(studentMap);
    if (!selectedTeacherStudent || !studentMap[selectedTeacherStudent]) {
        selectedTeacherStudent = studentNames[0];
    }

    summaryBox.innerHTML = `
        <div class="scenario-box">
            <strong>📊 총 요약</strong><br>
            총 기록: ${logs.length} / 참여 학생: ${studentNames.length}
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:20px;">
            ${studentNames.map(name => `
                <button
                    onclick="selectedTeacherStudent='${name}'; renderTeacherDashboard();"
                    class="${selectedTeacherStudent === name ? 'btn-candy-2' : 'btn-nav'}"
                    style="width:auto; flex:1 1 calc(50% - 10px); min-width:140px; margin-top:0;"
                >
                    🧒 ${name}
                </button>
            `).join('')}
        </div>
    `;

    const items = logs
        .filter(log => log.studentName === selectedTeacherStudent)
        .slice()
        .reverse();

    list.innerHTML = `
        <div style="background:var(--card-bg); border-radius:24px; margin-bottom:20px; border:4px solid var(--primary); box-shadow:0 8px 0 var(--primary-shadow); overflow:hidden;">
            <div style="padding:20px; font-size:1.2rem; font-weight:bold; color:var(--primary);">
                🧑‍🎓 ${selectedTeacherStudent}
                <div style="font-size:0.95rem; color:var(--text); margin-top:6px;">
                    성공 ${studentMap[selectedTeacherStudent].pass} / 단계이동 ${studentMap[selectedTeacherStudent].redirect} / 다시다듬기 ${studentMap[selectedTeacherStudent].fail} / 총시도 ${studentMap[selectedTeacherStudent].attempts}
                </div>
            </div>
            <div style="padding:20px; border-top:2px dashed var(--primary); background:var(--soft);">
                ${items.map(log => `
                    <div style="background:var(--white); border-radius:12px; padding:12px; margin-bottom:10px; border:1px solid var(--box-border); font-size:0.95rem;">
                        <span style="color:var(--subtext)">[${log.date}]</span>
                        <b>${log.scenarioTitle} (${log.step}단계)</b>
                        → ${
                            log.resultType === 'pass'
                                ? '✅ 현재 단계 통과'
                                : log.resultType === 'redirect'
                                ? '↪️ 다른 단계 권장'
                                : '⚠️ 다시 다듬기'
                        }
                        <div style="margin:8px 0;">Q: <b>${log.question}</b></div>
                        <div class="history-score-bar" style="margin-bottom:8px;">
                            <span class="score-tag">⭐ 관련성 ${log.scores?.relevance ?? 0}</span>
                            <span class="score-tag">📍 구체성 ${log.scores?.clarity ?? 0}</span>
                            <span class="score-tag">🎯 단계적합성 ${log.scores?.stageFit ?? 0}</span>
                            <span class="score-tag">💡 사고확장성 ${log.scores?.thinking ?? 0}</span>
                        </div>
                        <div style="color:var(--subtext); line-height:1.6;">
                            ${(log.feedback || '').replace(/\n/g, '<br>')}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}
    function goToCategory() {
        if (!currentStudentName) return showPage('page-student-entry');
        const history = JSON.parse(localStorage.getItem('alchemist_history_v2') || '[]');
        let fairyTaleStars = 0;
        scenariosData.fairyTale.forEach(s => {
            const maxStars = history.filter(h => h.title === s.title && h.studentName === currentStudentName).reduce((max, h) => Math.max(max, h.stars), 0);
            fairyTaleStars += maxStars;
        });
        const isUnlocked = fairyTaleStars >= 10; // 테스트 위해 10으로 낮춤
        document.getElementById('lock-greatPeople').style.display = isUnlocked ? 'none' : 'flex';
        document.getElementById('cat-greatPeople').classList.toggle('locked', !isUnlocked);
        document.getElementById('lock-classics').style.display = isUnlocked ? 'none' : 'flex';
        document.getElementById('cat-classics').classList.toggle('locked', !isUnlocked);
        const lockMsg = `🔒 봉인됨<br><span style="font-size:0.9rem; font-weight:700;">동화의 숲: ${fairyTaleStars}/10별 필요</span>`;
        document.getElementById('lock-greatPeople').innerHTML = lockMsg;
        document.getElementById('lock-classics').innerHTML = lockMsg;
        showPage('page-category');
    }

    function startQuiz(category) {
        if (!currentStudentName) return showPage('page-student-entry');
        currentCategory = category;
        const history = JSON.parse(localStorage.getItem('alchemist_history_v2') || '[]');
        const clearedTitles = history.filter(h => h.studentName === currentStudentName && h.stars === 3).map(h => h.title);
        let qState = ongoingQuests[category];
        let s = null;
        if (qState) s = scenariosData[category].find(x => x.title === qState.title);
        if (!s) {
            const avail = scenariosData[category].filter(scen => !clearedTitles.includes(scen.title));
            if (avail.length === 0) return alert("🎉 이 카테고리 마스터!");
            s = avail[Math.floor(Math.random() * avail.length)];
            qState = { title: s.title, step: 1, stars: 0, answers: ['', '', ''], scores: [null, null, null] }; 
            ongoingQuests[category] = qState; localStorage.setItem('alchemist_ongoing_quests', JSON.stringify(ongoingQuests));
        }
        document.getElementById('scenario-image').innerText = s.emoji;
        document.getElementById('scenario-title').innerText = s.title;
        document.getElementById('scenario-desc').innerText = s.desc;
        currentSessionStars = qState.stars;
        for(let i=1; i<=3; i++) {
            const stepEl = document.getElementById(`step${i}`); const resEl = document.getElementById(`res${i}`); const btnEl = document.getElementById(`btn${i}`); const qEl = document.getElementById(`q${i}`);
            qEl.value = qState.answers[i-1] || ''; resEl.style.display = 'none'; btnEl.disabled = false;
            if (i < qState.step) { stepEl.className = 'step-container step-done'; btnEl.style.display = 'none'; resEl.className = "result-box pass"; resEl.innerHTML = "✅ 정제 성공!"; resEl.style.display = 'block'; }
            else if (i === qState.step) { stepEl.className = 'step-container step-active'; btnEl.style.display = 'block'; }
            else { stepEl.className = 'step-container'; btnEl.style.display = 'block'; }
        }
        document.getElementById('btn-save').style.display = qState.step > 1 ? 'block' : 'none';
        document.getElementById('btn-save').innerText = qState.step > 3 ? "🎉 3성 마스터! 기록장에 저장" : "🎉 지금까지 내용 저장";
        setApiStatus('green'); showPage('page-quiz');
    }

    function shootSpecificEffect(id) {
        if (!id) return;
        if (id === 'effect_skyblue') confetti({ particleCount: 100, spread: 70, origin: { y: 0.7 }, colors: ['#48DBFB'] });
        else if (id === 'effect_red') confetti({ particleCount: 100, spread: 70, origin: { y: 0.7 }, colors: ['#FF6B81'] });
        else if (id === 'effect_green') confetti({ particleCount: 100, spread: 70, origin: { y: 0.7 }, colors: ['#A3E9A4'] });
        else if (id === 'effect_tricolor') confetti({ particleCount: 150, spread: 100, origin: { y: 0.7 }, colors: ['#FF6B81', '#1DD1A1', '#48DBFB'] });
        else if (id === 'effect_potion') confetti({ particleCount: 150, spread: 120, startVelocity: 45, origin: { y: 0.5 }, colors: ['#9b59b6', '#8e44ad', '#1DD1A1', '#FF9F43'] });
        else if (id === 'effect_meteor') confetti({ particleCount: 200, spread: 160, startVelocity: 30, origin: { y: 0.1 }, colors: ['#FECA57', '#FDCB6E', '#FF9F43'] });
        else if (id === 'effect_quake') { const app = document.querySelector('.app-container'); app.classList.add('quake-active'); setTimeout(() => app.classList.remove('quake-active'), 800); confetti({ particleCount: 80, spread: 100, origin: { y: 0.5 }, colors: ['#FECA57', '#FFFFFF'] }); } 
        else if (id === 'effect_fireworks') { confetti({ particleCount: 80, spread: 60, origin: { x: 0.2, y: 0.5 }, colors: ['#FF6B81', '#E84159'] }); setTimeout(() => confetti({ particleCount: 80, spread: 60, origin: { x: 0.8, y: 0.5 }, colors: ['#48DBFB', '#0ABDE3'] }), 300); setTimeout(() => confetti({ particleCount: 150, spread: 120, origin: { x: 0.5, y: 0.3 }, colors: ['#FECA57', '#1DD1A1', '#FF9F43'] }), 700); }
    }

    async function checkStep(step) {
        const qVal = document.getElementById(`q${step}`).value.trim();
        if(!qVal) return alert("질문을 입력해주세요!");
        const btn = document.getElementById(`btn${step}`); const res = document.getElementById(`res${step}`);
        btn.disabled = true; btn.innerText = "🧙‍♂️ 정제 중..."; res.style.display = "block"; res.className = "result-box"; res.innerText = "가치를 확인하고 있어요...";
        setApiStatus('yellow');
        try {
            const response = await fetch('/api/coach', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ step, scenarioTitle: document.getElementById('scenario-title').innerText, scenarioDesc: document.getElementById('scenario-desc').innerText, q: qVal })
            });
            
            if (!response.ok) throw new Error("서버 통신 실패");
            const result = await response.json();
            setApiStatus('green');
            
            const scoreHtml = result.scores ? `<div class="history-score-bar"><span class="score-tag">⭐ 관련성 ${result.scores.relevance}</span><span class="score-tag">📍 구체성 ${result.scores.clarity}</span><span class="score-tag">🎯 단계적합성 ${result.scores.stageFit}</span><span class="score-tag">💡 사고확장성 ${result.scores.thinking}</span></div>` : '';

            logAttempt({ scenarioTitle: document.getElementById('scenario-title').innerText, step, question: qVal, resultType: result.resultType, isPass: result.isPass, scores: result.scores || {}, total: result.total || 0, feedback: result.feedback || '', teacherNote: result.teacherNote || '', nextTip: result.nextTip || '' });

            if (result.isPass) {
                shootSpecificEffect(equippedEffect); currentSessionStars++; totalStars++;
                localStorage.setItem('alchemist_total_stars', totalStars); updateTopBar();
                res.className = "result-box pass"; res.innerHTML = `✨ ⭐ 별 1개 획득!<br>${String(result.feedback).replace(/\n/g, '<br>')}<br>${scoreHtml}`;
                let qState = ongoingQuests[currentCategory]; qState.stars = currentSessionStars; qState.answers[step-1] = qVal; 
                if(!qState.scores) qState.scores = [null, null, null];
                qState.scores[step-1] = result.scores; 
                qState.step = step + 1; localStorage.setItem('alchemist_ongoing_quests', JSON.stringify(ongoingQuests));
                btn.style.display = "none"; document.getElementById('btn-save').style.display = 'block';
                if(step < 3) { document.getElementById(`step${step}`).className = "step-container step-done"; setTimeout(() => { document.getElementById(`step${step+1}`).className = "step-container step-active"; }, 400); }
                else { document.getElementById(`step3`).className = "step-container step-done"; document.getElementById('btn-save').innerText = "🎉 3성 마스터! 기록장에 저장"; }
            } else if (result.resultType === 'redirect') {
                res.className = "result-box fail"; res.innerHTML = `↪️ 좋은 질문이야!<br>${String(result.feedback).replace(/\n/g, '<br>')}<br>${scoreHtml}`;
                btn.disabled = false; btn.innerText = "다시 질문하기";
            } else {
                res.className = "result-box fail"; res.innerHTML = `⚠️ 조금 더 고민해볼까?<br>${String(result.feedback || '질문을 다시 다듬어보세요.').replace(/\n/g, '<br>')}<br>${scoreHtml}`;
                btn.disabled = false; btn.innerText = "다시 질문하기";
            }
        } catch (e) {
            setApiStatus('red'); res.className = "result-box fail"; res.innerHTML = `❌ 오류 발생: ${e.message}`; btn.disabled = false; btn.innerText = '다시 시도';
        }
    }

    function saveAndGoHome() {
        if (currentSessionStars === 0) return alert("저장할 별이 없어요!");
        const history = JSON.parse(localStorage.getItem('alchemist_history_v2') || '[]');
        const currentTitle = document.getElementById('scenario-title').innerText;
        let qState = ongoingQuests[currentCategory];
        const record = { 
            date: new Date().toLocaleString(), studentName: currentStudentName, title: currentTitle, stars: currentSessionStars,
            questions: [qState.answers[0], qState.answers[1], qState.answers[2]],
            scores: [qState.scores[0], qState.scores[1], qState.scores[2]] 
        };
        history.push(record); localStorage.setItem('alchemist_history_v2', JSON.stringify(history));
        if (qState.step > 3) { delete ongoingQuests[currentCategory]; localStorage.setItem('alchemist_ongoing_quests', JSON.stringify(ongoingQuests)); }
        alert(`⭐ 별 ${currentSessionStars}개 저장 완료!`); goToCategory(); 
    }

    function loadHistory() {
        const list = document.getElementById('history-list');
        const history = JSON.parse(localStorage.getItem('alchemist_history_v2') || '[]');
        const filtered = currentStudentName ? history.filter(h => h.studentName === currentStudentName) : history;
        list.innerHTML = filtered.length ? filtered.reverse().map(h => {
            const renderScore = (idx) => {
                if (!h.questions || !h.questions[idx]) return '(미입력)';
                const scores = h.scores ? h.scores[idx] : null;
                if (!scores) return `${h.questions[idx]}`;
                return `
                    ${h.questions[idx]}
                    <div class="history-score-bar">
                        <span class="score-tag">⭐ 관련성 ${scores.relevance ?? '-'}</span>
                        <span class="score-tag">📍 구체성 ${scores.clarity ?? '-'}</span>
                        <span class="score-tag">🎯 단계 ${scores.stageFit ?? '-'}</span>
                        <span class="score-tag">💡 사고력 ${scores.thinking ?? '-'}</span>
                    </div>`;
            };
            return `
            <div class="scenario-box" style="text-align:left;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <strong style="color:var(--primary); font-size:1.2rem;">[${h.title}]</strong> <span style="color:var(--accent);">${Array(h.stars).fill('⭐').join('')}</span><br>
                        <small style="color:var(--subtext);">${h.date}</small>
                    </div>
                    <button class="btn-retry" onclick="retryScenario('${h.title}')">🔄 다시 탐구하기</button>
                </div>
                <div style="font-size:1rem; background:var(--bg); padding:12px; border-radius:12px; margin-top:10px; line-height:1.5;">
                    <div style="margin-bottom:15px;">🔍 <b style="color:var(--primary);">사실:</b> <br>${renderScore(0)}</div>
                    <div style="margin-bottom:15px;">🤔 <b style="color:var(--accent);">궁금:</b> <br>${renderScore(1)}</div>
                    <div>💡 <b style="color:#10AC84;">새롬:</b> <br>${renderScore(2)}</div>
                </div>
            </div>`;
        }).join('') : '<p style="text-align:center; padding:30px; color:var(--text);">아직 보물이 없어요.</p>';
    }

    function retryScenario(title) {
        if(!confirm(`'${title}' 이야기를 다시 탐구해볼까요?\n(새로 완료하면 기록장이 갱신됩니다!)`)) return;
        let foundCategory = '';
        for (const [cat, items] of Object.entries(scenariosData)) { if (items.some(item => item.title === title)) { foundCategory = cat; break; } }
        if (!foundCategory) return alert("앗, 이 이야기는 지금 찾을 수 없어요.");
        ongoingQuests[foundCategory] = { title: title, step: 1, stars: 0, answers: ['', '', ''], scores: [null, null, null] };
        localStorage.setItem('alchemist_ongoing_quests', JSON.stringify(ongoingQuests));
        startQuiz(foundCategory);
    }

    function renderShop() {
        const container = document.getElementById('shop-items-container');
        container.innerHTML = shopItems.map(item => {
            const isOwned = item.price === 0 || inventory.includes(item.id);
            const isEquipped = (item.type.includes('effect') && equippedEffect === item.id) || (item.type === 'skin' && equippedSkin === item.id);
            
            let badge = '';
            if(item.type === 'skin') badge = `<span class="badge badge-skin">마법 테마</span>`;
            else if(item.type === 'premium_effect') badge = `<span class="badge-premium">프리미엄 효과</span>`;
            else badge = `<span class="badge-effect">특수 효과</span>`;

            let previewBtn = '';
            if (item.type === 'skin') {
                previewBtn = `<button class="shop-btn ${previewingSkinId === item.id ? 'btn-preview-active' : 'btn-preview'}" onclick="${previewingSkinId === item.id ? 'endPreview()' : `previewSkin('${item.id}')`}">${previewingSkinId === item.id ? '👀 종료' : '👀 구경'}</button>`;
            } else {
                previewBtn = `<button class="shop-btn btn-preview" onclick="shootSpecificEffect('${item.id}')">✨ 맛보기</button>`;
            }

            let mainBtn = '';
            if (isEquipped) mainBtn = `<button class="shop-btn btn-equipped">장착 중</button>`;
            else if (isOwned) mainBtn = `<button class="shop-btn btn-equip" onclick="${item.type === 'skin' ? `equipSkin('${item.id}')` : `equipEffect('${item.id}')`}">장착하기</button>`;
            else mainBtn = `<button class="shop-btn btn-buy" onclick="buyItem('${item.id}', ${item.price}, '${item.type}')">⭐ ${item.price}</button>`;

            return `
                <div class="shop-item">
                    <div class="shop-item-info">
                        ${badge}
                        <div class="shop-item-title">${item.name}</div>
                        <div class="shop-item-desc">${item.desc}</div>
                    </div>
                    <div class="shop-btn-group" style="display:flex; gap:10px; width:100%; margin-top:10px;">
                        ${previewBtn}
                        ${mainBtn}
                    </div>
                </div>`;
        }).join('');
        updateTopBar();
    }
    function previewSkin(id) { previewingSkinId = id; applyTheme(id, true); renderShop(); }
    function endPreview() { previewingSkinId = null; applyTheme(equippedSkin, true); renderShop(); }
    function buyItem(id, price, type) {
        if (totalStars < price) return alert("별 부족!");
        if (confirm("구매?")) { totalStars -= price; inventory.push(id); localStorage.setItem('alchemist_total_stars', totalStars); localStorage.setItem('alchemist_inventory', JSON.stringify(inventory)); alert("구매 완료!"); renderShop(); }
    }
    function equipEffect(id) { equippedEffect = id; localStorage.setItem('alchemist_equipped_effect', equippedEffect); renderShop(); }
    function equipSkin(id) { equippedSkin = id; localStorage.setItem('alchemist_equipped_skin', equippedSkin); applyTheme(id, true); renderShop(); }

    // ====== 기존 함수들 전역 노출 (ES Module 문제 해결) ======
    window.showPage = showPage;
    window.handleStudentEntryClick = handleStudentEntryClick;
    window.enterStudentMode = enterStudentMode;
    window.enterTeacherMode = enterTeacherMode;
    window.goToCategory = goToCategory;
    window.startQuiz = startQuiz;
    window.checkStep = checkStep;
    window.saveAndGoHome = saveAndGoHome;
    window.loadHistory = loadHistory;
    window.retryScenario = retryScenario;
    window.renderShop = renderShop;
    window.previewSkin = previewSkin;
    window.endPreview = endPreview;
    window.buyItem = buyItem;
    window.equipEffect = equipEffect;
    window.equipSkin = equipSkin;
    window.shootSpecificEffect = shootSpecificEffect;
    
    // ====== 미니게임 연동 로직 ======
    let mgEngine = null;

    window._startMinigame = () => {
        if (!currentStudentName) return showPage('page-student-entry');
        
        showPage('page-minigame');
        
        const uiContext = new MinigameUIContext();
        const rewardProvider = {
            grantStars: (count) => {
                totalStars += count;
                localStorage.setItem('alchemist_total_stars', totalStars);
                updateTopBar();
            },
            saveLeaderboard: (data) => {
                data.studentName = currentStudentName;
                ScoreStorageManager.commitScore(data.score, data.correctCount, data.timeLabel);
            }
        };
        
        const themeProvider = {
            playEffect: (isPass) => {
                if (isPass) shootSpecificEffect(equippedEffect);
            }
        };

        mgEngine = new MinigameEngine(rewardProvider, themeProvider, uiContext);
        mgEngine.startSession();
    };

    window._quitMinigame = () => {
        if (mgEngine) {
            mgEngine.forceQuit();
            mgEngine.uiContext.cleanup();
            mgEngine = null;
        }
        showPage('page-home');
    };

    window._mgAnswer = (type) => {
        if (mgEngine) {
            mgEngine.submitAnswer(type);
        }
    };