// src/minigame/core/MinigameUIContext.js
import { getSkinAssets } from '../data/AssetMapper.js';

export class MinigameUIContext {
    constructor() {
        this.container = document.getElementById('minigame-container');
        this.timerInterval = null;
    }

    renderStart() {
        if (!this.container) return;
        this.container.innerHTML = `<div class="scenario-box" style="animation: popIn 0.3s;" id="mg-content-area"><h3>질문 마법 스크롤을 펼치는 중...</h3></div>`;
    }

    renderQuestion(questionObj, qIndex, totalNum) {
        if (!this.container) return;
        const skinId = localStorage.getItem('alchemist_equipped_skin') || 'default';
        const assets = getSkinAssets(skinId);
        
        // 브릿지 패턴: UI 구성 요소를 여기서 DOM에 주입
        this.container.innerHTML = `
            <div class="scenario-box" style="border-color: ${assets.bgHex}; animation: popIn 0.4s;">
                <div style="font-size:3rem; margin-bottom:10px;" class="floating-icon">${assets.icon}</div>
                <h3 style="color:var(--text); margin-top:0;">${qIndex} / ${totalNum} 번 스크롤</h3>
                <p style="font-size:1.4rem; margin: 20px 0; font-weight:bold; word-break:keep-all;">${questionObj.text}</p>
                
                <div style="font-size:1.1rem; opacity:0.9; margin-bottom:20px; color:#1DD1A1; font-weight:bold;" id="mg-timer-display">⏱ 판단 시간: 0.0초</div>

                <div style="display:flex; flex-direction:column; gap:12px;">
                    <button class="${assets.buttonColors[0]}" onclick="window._mgAnswer('fact')">🔎 첫 번째: 사실 질문이야!</button>
                    <button class="${assets.buttonColors[1]}" onclick="window._mgAnswer('why')">🤔 두 번째: 궁금 질문이야!</button>
                    <button class="${assets.buttonColors[2]}" onclick="window._mgAnswer('if')">💡 세 번째: 새롬 질문이야!</button>
                </div>
            </div>
            <div id="mg-feedback-area" style="margin-top:20px;"></div>
        `;
        
        let start = Date.now();
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        // 메모리 누수 방지용 명시적 Timer 참조
        this.timerInterval = setInterval(() => {
            const el = document.getElementById('mg-timer-display');
            if(el) {
                const diff = (Date.now() - start) / 1000;
                el.innerText = `⏱ 1.5초 만점 카운트: ${diff.toFixed(1)}초`;
                if(diff > 1.5) el.style.color = '#FF6B81'; // 주의 알림
            }
        }, 100);
    }

    renderFeedback(isPass, score, correctType) {
        if (this.timerInterval) clearInterval(this.timerInterval); // 입력 즉시 타이머 소멸
        const fbWrap = document.getElementById('mg-feedback-area');
        if(!fbWrap) return;
        
        if (isPass) {
            fbWrap.innerHTML = `<div class="result-box pass" style="display:block;">✨ 완벽해요! (+${score}점 획득)</div>`;
        } else {
            const korType = correctType === 'fact' ? '사실' : correctType==='why' ? '궁금' : '새롬';
            fbWrap.innerHTML = `<div class="result-box fail" style="display:block;">땡! 아쉽네요. 방금 그건 '${korType}' 질문이었어요!</div>`;
        }
    }

    renderGameEnd(finalScore, starsEarned, correctCount) {
        if (this.timerInterval) clearInterval(this.timerInterval);
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="scenario-box" style="margin-top: 30px; animation: popIn 0.5s;">
                <div style="font-size:4rem; margin-bottom:15px; animation: pop 0.4s;">🎁</div>
                <h2 class="title-stroke" style="font-size:1.8rem; margin-bottom:10px;">스피드 분류 완료!</h2>
                <div style="font-size:1.2rem; background:var(--bg); padding:20px; border-radius:15px; border:3px solid var(--box-border); display:flex; flex-direction:column; gap:8px;">
                    <div>🎯 정답 방어율: <b style="color:var(--primary);">${correctCount}개</b></div>
                    <div>🔥 폭발적 콤보 점수: <b style="color:var(--accent);">${finalScore}점</b></div>
                    <div style="margin-top:10px; padding-top:10px; border-top:2px dashed #ccc;">
                        획득 보상: ⭐ <b style="color:#10AC84; font-size:1.4rem;">${starsEarned}개</b>
                    </div>
                </div>
                <button class="btn-main" style="margin-top:25px;" onclick="window.showPage('page-home')">홈으로 돌아가기</button>
            </div>
        `;
    }

    // 명시적 가비지 컬렉팅 의무 조항 준수
    cleanup() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        if(this.container) this.container.innerHTML = '';
    }
}
