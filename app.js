document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const targetPriceInput = document.getElementById('targetPrice');
    const targetAmountInput = document.getElementById('targetAmount');
    const syncText = document.getElementById('sync-text');
    const amountLabel = document.getElementById('amount-label');
    const amountPostfix = document.getElementById('amount-postfix');
    const radioInputTypes = document.querySelectorAll('input[name="input_type"]');
    const radioCoins = document.querySelectorAll('input[name="coin"]');
    const startBtn = document.getElementById('startBtn');
    const errorMsg = document.getElementById('error-msg');
    
    // Status Elements
    const overlay = document.getElementById('overlay');
    const initialQtyEl = document.getElementById('initial-coin-qty');
    const remainingQtyEl = document.getElementById('remaining-qty');
    const progressFill = document.getElementById('progress-fill');
    const accumVolEl = document.getElementById('accumulated-volume');
    const elapsedTimeEl = document.getElementById('elapsed-time');
    const speedPerMinEl = document.getElementById('speed-per-min');
    const estimatedTimeEl = document.getElementById('estimated-time');

    // State Variables
    let isTracking = false;
    let initialQty = 0;
    let remainingQty = 0;
    let accumulatedVol = 0;
    let startTime = 0;
    let trackingInterval;
    let targetPrice = 0;
    let selectedCoin = 'NFT';
    
    // Seen trades to prevent double counting
    // Store as Set of strings: "date_type_price_units"
    let seenTrades = new Set();

    // Utility: Format numbers with commas
    const fmtNum = num => Math.floor(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    // Input Type Toggle Logic
    const updateInputLabels = () => {
        const type = document.querySelector('input[name="input_type"]:checked').value;
        if (type === 'KRW') {
            amountLabel.innerText = '앞에 쌓인 대기 원화 💵';
            amountPostfix.innerText = '원';
            targetAmountInput.placeholder = '예: 10000000';
        } else {
            amountLabel.innerText = '앞에 쌓인 대기 코인 🪙';
            amountPostfix.innerText = '개';
            targetAmountInput.placeholder = '예: 5000000000';
        }
        calculateSync();
    };

    // Calculate Live Sync
    const calculateSync = () => {
        if (isTracking) return;
        
        const type = document.querySelector('input[name="input_type"]:checked').value;
        const price = parseFloat(targetPriceInput.value);
        const amount = parseFloat(targetAmountInput.value);
        
        if (isNaN(price) || isNaN(amount) || price <= 0 || amount <= 0) {
            syncText.innerText = '= 변환 대기 중...';
            initialQty = 0;
            return;
        }

        if (type === 'KRW') {
            const coinQty = amount / price;
            initialQty = coinQty;
            syncText.innerText = `= 내 앞 대기 코인 약 ${fmtNum(coinQty)} 개`;
        } else {
            const krwValue = amount * price;
            initialQty = amount;
            syncText.innerText = `= 내 앞 대기 원화 약 ${fmtNum(krwValue)} 원`;
        }
    };

    radioInputTypes.forEach(r => r.addEventListener('change', updateInputLabels));
    targetPriceInput.addEventListener('input', calculateSync);
    targetAmountInput.addEventListener('input', calculateSync);
    
    radioCoins.forEach(r => r.addEventListener('change', (e) => {
        selectedCoin = e.target.value;
        // Adjust default precision suggestion
        targetPriceInput.value = selectedCoin === 'NFT' ? '0.001' : '0.002';
        calculateSync();
    }));

    // Start Tracking
    startBtn.addEventListener('click', () => {
        if (initialQty <= 0) {
            errorMsg.innerText = "올바른 가격과 수량을 입력해주세요!";
            return;
        }
        
        errorMsg.innerText = "";
        isTracking = true;
        targetPrice = parseFloat(targetPriceInput.value);
        selectedCoin = document.querySelector('input[name="coin"]:checked').value;
        
        // Disable inputs
        targetPriceInput.disabled = true;
        targetAmountInput.disabled = true;
        radioInputTypes.forEach(r => r.disabled = true);
        radioCoins.forEach(r => r.disabled = true);
        startBtn.innerText = "🚨 추적 중 (새로고침 시 초기화)";
        startBtn.disabled = true;
        
        // Initialize State
        remainingQty = initialQty;
        accumulatedVol = 0;
        startTime = Date.now();
        seenTrades.clear();
        
        // Update UI
        overlay.style.display = 'none';
        initialCoinQtyUpdate();
        updateDashboard();
        
        // Fetch initially to seed 'seenTrades' but don't count them
        fetchTransactions(true);
        
        // Polling every 5 seconds
        trackingInterval = setInterval(() => {
            fetchTransactions(false);
            updateTimerOnly();
        }, 5000);
    });

    const initialCoinQtyUpdate = () => {
        initialQtyEl.innerText = fmtNum(initialQty);
        remainingQtyEl.innerText = fmtNum(remainingQty);
        progressFill.style.width = '100%';
    };

    const updateTimerOnly = () => {
        const elapsedMs = Date.now() - startTime;
        const totalSec = Math.floor(elapsedMs / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        elapsedTimeEl.innerText = `${m}분 ${s}초`;
        
        // Update Predictions if we have at least 15 seconds of data and some volume
        if (totalSec > 15 && accumulatedVol > 0) {
            const elapsedMins = elapsedMs / 60000;
            const volPerMin = accumulatedVol / elapsedMins;
            speedPerMinEl.innerText = `${fmtNum(volPerMin)} 개/분`;
            
            if (volPerMin > 0) {
                const estMinsRemaining = remainingQty / volPerMin;
                
                const d = Math.floor(estMinsRemaining / (24 * 60));
                const h = Math.floor((estMinsRemaining % (24 * 60)) / 60);
                const mins = Math.floor(estMinsRemaining % 60);
                
                let timeStr = "";
                if (d > 0) timeStr += `${d}일 `;
                if (h > 0 || d > 0) timeStr += `${h}시간 `;
                timeStr += `${mins}분`;
                
                estimatedTimeEl.innerText = timeStr;
            }
        } else if (totalSec > 15 && accumulatedVol === 0) {
            speedPerMinEl.innerText = `0 개/분`;
            estimatedTimeEl.innerText = `거래가 없어서 계산 불가 😢`;
        }
    };

    const updateDashboard = () => {
        remainingQtyEl.innerText = fmtNum(remainingQty);
        accumVolEl.innerText = fmtNum(accumulatedVol);
        
        let percent = (remainingQty / initialQty) * 100;
        if (percent < 0) percent = 0;
        progressFill.style.width = `${percent}%`;
        
        // Flash animation
        const statBox = accumVolEl.parentElement;
        statBox.classList.remove('flash-effect');
        void statBox.offsetWidth; // trigger reflow
        statBox.classList.add('flash-effect');
        
        if (remainingQty <= 0) {
            clearInterval(trackingInterval);
            estimatedTimeEl.innerText = "🎉 체결 완료 예상!!";
            progressFill.style.width = '0%';
            remainingQtyEl.innerText = '0 (체결 타겟 도달)';
        }
    };

    const fetchTransactions = async (isInitialSeed) => {
        try {
            const res = await fetch(`https://api.bithumb.com/public/transaction_history/${selectedCoin}_KRW?count=100`);
            const json = await res.json();
            
            if (json.status !== "0000" || !json.data) return;
            
            let matchedInThisFetch = 0;
            
            json.data.forEach(tx => {
                const txKey = `${tx.transaction_date}_${tx.type}_${tx.price}_${tx.units_traded}`;
                
                if (!seenTrades.has(txKey)) {
                    seenTrades.add(txKey);
                    
                    if (!isInitialSeed) {
                        const txPrice = parseFloat(tx.price);
                        // If transaction price equals our target price, the wall is being eaten
                        if (txPrice === targetPrice) {
                            matchedInThisFetch += parseFloat(tx.units_traded);
                        }
                    }
                }
            });
            
            // Keep memory bounded
            if (seenTrades.size > 1000) {
                const arr = Array.from(seenTrades).slice(-500);
                seenTrades = new Set(arr);
            }
            
            if (matchedInThisFetch > 0) {
                accumulatedVol += matchedInThisFetch;
                remainingQty -= matchedInThisFetch;
                if (remainingQty < 0) remainingQty = 0;
                
                updateDashboard();
            }
            
        } catch (e) {
            console.error("Bithumb API Fetch Error:", e);
        }
    };
});
