// src/minigame/db/storageFallback.js

/**
 * 트래픽 폭주/네트워크 단절 시 데이터 유실을 방지하는 Queue 계층
 * (Firebase 대용 로컬 Fallback 구현체)
 */
export class ScoreStorageManager {
    static QUEUE_KEY = 'alchemist_offline_score_queue';

    // Firebase (진짜 서버 DB 연동/의존성 주입 계층)
    static async saveToRemote(payload) {
        if (!navigator.onLine) {
            throw new Error('Offline (네트워크 단절)');
        }
        
        // Mocking: Firebase 연동 전까지 서버 지연을 시뮬레이션
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // 5% 확률로 서버 트래픽 스파이크(500 에러) 모방 엣지 케이스
                if (Math.random() < 0.05) reject(new Error('500 Server Bound Error'));
                else resolve({ success: true, ref: 'ok' });
            }, 600);
        });
    }

    // 서버오류/오프라인 시 데이터 증발 방지 로컬 보관 (Write-Behind 패턴)
    static pushToLocalQueue(payload) {
        let queue = [];
        try {
            queue = JSON.parse(localStorage.getItem(this.QUEUE_KEY) || '[]');
        } catch(e) {}
        queue.push(payload);
        localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
        console.warn('⚠️ 부하 대응: 랭킹 점수가 로컬 큐에 임시 안전 저장되었습니다.');
    }

    // 단일 진입점: 앱에서 호출하는 인터페이스
    static async commitScore(finalScore, correctCount, timeLabel) {
        const payload = { finalScore, correctCount, timeLabel, synced: false };
        try {
            await this.saveToRemote(payload);
            console.log('✅ 서버 DB에 성공적으로 랭킹이 기록되었습니다.');
            return true;
        } catch (error) {
            this.pushToLocalQueue(payload);
            alert("통신이 불안정해 랭킹 전송을 잠시 미뤄뒀어요! 데이터는 기기에 안전하게 보존됩니다. (나중에 연동)");
            return false;
        }
    }
}
