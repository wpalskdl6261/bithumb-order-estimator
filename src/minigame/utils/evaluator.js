/**
 * 점수 계산 순수 함수
 * 부수효과(DOM/외부상태 참조)가 전혀 없는 순수 함수입니다.
 * 
 * @param {number} answerTimeMs - 경과 시간 (밀리초)
 * @param {string} selectedType - 유저가 선택한 타입 ('fact', 'why', 'if')
 * @param {string} correctType - 정답 타입
 * @returns {object} { score: number, isPass: boolean }
 */
export function evaluateAnswer(answerTimeMs, selectedType, correctType) {
    if (selectedType !== correctType) {
        return { score: 0, isPass: false };
    }
    
    // 1.5초(1500ms) 이내 정답 시 100점 (만점)
    if (answerTimeMs <= 1500) {
        return { score: 100, isPass: true };
    }
    
    // 10초(10000ms) 초과 시 무조건 10점 (최하점)
    if (answerTimeMs >= 10000) {
        return { score: 10, isPass: true };
    }
    
    // 1.5초 ~ 10초 사이 점수 감가상각 (선형 보간)
    const timeDecay = (answerTimeMs - 1500) / (10000 - 1500); // 0.0 ~ 1.0
    const pointDrop = 90 * timeDecay; 
    const score = Math.floor(100 - pointDrop);
    
    return { score, isPass: true };
}
