import { evaluateAnswer } from './evaluator.js';

export function runTests(test, expect) {
    test('[evaluator.js] 오답 시 무조건 0점을 반환하는가?', () => {
        const result = evaluateAnswer(1000, 'fact', 'why');
        expect(result.score).toBe(0);
        expect(result.isPass).toBe(false);
    });

    test('[evaluator.js] 1.5초 이내 정답 시 100점(만점)을 반환하는가?', () => {
        const result = evaluateAnswer(900, 'fact', 'fact');
        expect(result.score).toBe(100);
        expect(result.isPass).toBe(true);
    });

    test('[evaluator.js] 10초를 아무리 넘겨도 최하점 기준 10점을 방어하는가?', () => {
        const result = evaluateAnswer(15000, 'if', 'if');
        expect(result.score).toBe(10);
        expect(result.isPass).toBe(true);
    });

    test('[evaluator.js] 1.5초 ~ 10초 사이에서는 점수가 선형으로 감가상각되는가?', () => {
        const midTime = 1500 + (10000 - 1500) / 2; // 약 5.75초
        const result = evaluateAnswer(midTime, 'why', 'why');
        expect(result.score).toBeGreaterThan(10);
        expect(result.score).toBeLessThan(100);
        expect(result.isPass).toBe(true);
    });
}
