/* app.js */
document.addEventListener('DOMContentLoaded', () => {
    // === UI Elements ===
    const targetPriceInput = document.getElementById('targetPrice');
    const targetAmountInput = document.getElementById('targetAmount');
    const syncText = document.getElementById('sync-text');
    const amountLabel = document.getElementById('amount-label');
    const amountPostfix = document.getElementById('amount-postfix');
    const radioInputTypes = document.querySelectorAll('input[name="input_type"]');
    const addTrackerBtn = document.getElementById('addTrackerBtn');
    const trackerListEl = document.getElementById('tracker-list');
    
    // === State Management ===
    let trackers = JSON.parse(localStorage.getItem('bithumb_trackers_v2') || '[]');
    let selectedCoin = 'NFT';
    let currentInitialQty = 0;
    let seenTxKeys = new Set();
    let seedModeCoins = new Set();
    let marketStrengths = {};
    
    const fmtNum = num => Math.floor(Math.max(0, num)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const formatDate = (ms) => {
        const d = new Date(ms);
        return `${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
    };

    const saveTrackers = () => localStorage.setItem('bithumb_trackers_v2', JSON.stringify(trackers));

    // === UI Logic ===
    const calculateSync = () => {
        const type = document.querySelector('input[name="input_type"]:checked').value;
        const price = parseFloat(targetPriceInput.value);
        const amount = parseFloat(targetAmountInput.value);
        
        if (isNaN(price) || isNaN(amount) || price <= 0 || amount <= 0) {
            syncText.innerText = '= 대기 중...';
            currentInitialQty = 0;
            return;
        }

        if (type === 'KRW') {
            const coinQty = amount / price;
            currentInitialQty = coinQty;
            syncText.innerText = `= 내 앞 대기 코인 약 ${fmtNum(coinQty)} 개`;
        } else {
            currentInitialQty = amount;
            syncText.innerText = `= 내 앞 대기 원화 약 ${fmtNum(amount * price)} 원`;
        }
    };

    targetAmountInput.addEventListener('input', calculateSync);
    targetPriceInput.addEventListener('input', calculateSync);
    radioInputTypes.forEach(r => r.addEventListener('change', () => {
        const type = document.querySelector('input[name="input_type"]:checked').value;
        amountLabel.innerText = type === 'KRW' ? '내 앞 대기 원화 💵' : '내 앞 대기 코인 🪙';
        amountPostfix.innerText = type === 'KRW' ? '원' : '개';
        calculateSync();
    }));

    // === Tracker Management ===
    addTrackerBtn.addEventListener('click', async () => {
        if (currentInitialQty <= 0) return;
        
        const price = parseFloat(targetPriceInput.value);
        const coin = document.querySelector('input[name="coin"]:checked').value;
        
        const newTracker = {
            id: Date.now(),
            coin: coin,
            targetPrice: price,
            initialQty: currentInitialQty,
            remainingQty: currentInitialQty,
            accumulatedVol: 0,
            startTime: Date.now(),
            status: 'active'
        };

        trackers.push(newTracker);
        saveTrackers();
        renderCards();
    });

    window.removeTracker = (id) => {
        trackers = trackers.filter(t => t.id !== id);
        saveTrackers();
        renderCards();
    };

    const renderCards = () => {
        if (trackers.length === 0) {
            trackerListEl.innerHTML = `
                <div class="border-2 border-dashed border-white/5 rounded-3xl p-12 text-center">
                    <div class="w-16 h-16 bg-[#181c23] rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <span class="material-icons text-slate-600 text-3xl">hourglass_empty</span>
                    </div>
                    <h4 class="text-white font-bold text-xl mb-2">진행 중인 추적이 없습니다</h4>
                    <p class="text-slate-500 text-sm leading-relaxed px-4">시작하려면 상단 양식에서 코인과 물량을 입력하여 추적을 시작하세요.</p>
                </div>`;
            return;
        }

        trackerListEl.innerHTML = trackers.map(t => {
            const percent = Math.min(100, Math.max(0, ((t.initialQty - t.remainingQty) / t.initialQty) * 100));
            return `
            <div class="tracker-card">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <div class="text-white font-bold text-lg">${t.coin} <span class="text-[#f37321] text-sm ml-2">${t.targetPrice} ₩</span></div>
                        <div class="text-slate-500 text-[10px] font-bold uppercase mt-1">시작: ${formatDate(t.startTime)}</div>
                    </div>
                    <button onclick="removeTracker(${t.id})" class="text-slate-600 hover:text-red-500 transition-colors">
                        <span class="material-icons text-xl">delete_outline</span>
                    </button>
                </div>
                <div class="space-y-4">
                    <div>
                        <div class="flex justify-between text-[10px] font-bold text-slate-400 mb-2">
                            <span>남은 대기 물량</span>
                            <span class="text-white">${fmtNum(t.remainingQty)}</span>
                        </div>
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill h-full" style="width: ${percent}%"></div>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div class="stat-box">
                            <div class="text-[9px] font-bold text-slate-500 uppercase">누적 체결</div>
                            <div class="text-white font-mono text-sm font-bold">${fmtNum(t.accumulatedVol)}</div>
                        </div>
                        <div class="stat-box">
                            <div class="text-[9px] font-bold text-slate-500 uppercase">진행률</div>
                            <div class="text-[#f37321] font-mono text-sm font-bold">${percent.toFixed(1)}%</div>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    };

    renderCards();
});
