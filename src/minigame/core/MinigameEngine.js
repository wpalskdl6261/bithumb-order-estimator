import { evaluateAnswer } from '../utils/evaluator.js';
import { minigameQuestions } from '../data/questionRegistry.js';

/**
 * 💡 가마솥 질문 미니게임 코어 엔진
 * 전역 변수를 쓰지 않고 철저하게 객체 내부 지역 상태로 캡슐화합니다.
 */
export class MinigameEngine {
    /**
     * @param {object} rewardProvider - { grantStars: (count) => void, saveLeaderboard: (data) => void }
     * @param {object} themeProvider - { playEffect: (isPass) => void }
     * @param {object} uiContext - { renderStart, renderQuestion, renderFeedback, renderGameEnd }
     */
    constructor(rewardProvider, themeProvider, uiContext) {
        // 의존성 주입 (Dependency Injection / Bridge Pattern)
        this.rewardProvider = rewardProvider;
        this.themeProvider = themeProvider;
        this.uiContext = uiContext;

        // 지역 상태 캡슐화
        this.state = {
            questions: [],
            currentIndex: 0,
            score: 0,
            correctCount: 0,
            startTime: 0,
            isAnimating: false, // 명시적 Locking (연타 100% 차단)
            isPlaying: false
        };
    }

    // 세션 시작 (15문제 Bulk Fetching 흉내)
    startSession() {
        // 배열을 복사하여 무작위 섞기 후 15개 추출
        this.state.questions = this._shuffle([...minigameQuestions]).slice(0, 15);
        this.state.currentIndex = 0;
        this.state.score = 0;
        this.state.correctCount = 0;
        this.state.isPlaying = true;
        this.state.isAnimating = false;
        
        this.uiContext.renderStart();
        this._presentNextQuestion();
    }

    _presentNextQuestion() {
        if (this.state.currentIndex >= this.state.questions.length) {
            this._endSession();
            return;
        }
        this.state.startTime = Date.now();
        const currentQ = this.state.questions[this.state.currentIndex];
        
        // UI 모듈로 화면 갱신 위임
        this.uiContext.renderQuestion(currentQ, this.state.currentIndex + 1, this.state.questions.length);
    }

    /**
     * 유저가 버튼을 눌렀을 때 호출
     * @param {string} selectedType ('fact', 'why', 'if')
     */
    submitAnswer(selectedType) {
        // 1. Lock 검증 (더블 클릭, 광클릭 원천 차단)
        if (this.state.isAnimating || !this.state.isPlaying) {
            console.warn("🔒 Lock 활성화 상태: 무작위 클릭을 캡시 무시합니다.");
            return;
        }
        
        // 2. Lock 설정
        this.state.isAnimating = true;

        const answerTimeMs = Date.now() - this.state.startTime;
        const currentQ = this.state.questions[this.state.currentIndex];
        
        // 3. 순수 함수 평가기 호출
        const result = evaluateAnswer(answerTimeMs, selectedType, currentQ.type);
        
        if (result.isPass) {
            this.state.score += result.score;
            this.state.correctCount++;
        }
        
        // 4. 이펙트 및 피드백 브릿지 호출
        this.themeProvider.playEffect(result.isPass, result.score);
        this.uiContext.renderFeedback(result.isPass, result.score, currentQ.type);

        // 5. 다음 문제로 (1.5초 대기 후 Lock 해제)
        setTimeout(() => {
            if (!this.state.isPlaying) return; // 중간에 나갔을 경우 방어
            this.state.currentIndex++;
            this.state.isAnimating = false; // Lock 해제
            this._presentNextQuestion();
        }, 1500);
    }

    // 도중에 나가거나 렌더 트리 언마운트 시 명시적 소멸 (GC)
    forceQuit() {
        this.state.isPlaying = false;
        this.state.isAnimating = true; // 모든 입력 차단
        console.log("세션이 명시적으로 종료(Cleanup)되었습니다.");
    }

    _endSession() {
        this.state.isPlaying = false;
        const finalScore = this.state.score;
        const starsEarned = Math.floor(finalScore / 300); // 300점당 별 1개 부여
        
        // 리워드 및 통계 저장
        if (starsEarned > 0) {
            this.rewardProvider.grantStars(starsEarned);
        }
        
        this.rewardProvider.saveLeaderboard({
            score: finalScore,
            correctCount: this.state.correctCount,
            timeLabel: new Date().toLocaleString()
        });

        this.uiContext.renderGameEnd(finalScore, starsEarned, this.state.correctCount);
    }

    _shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}
