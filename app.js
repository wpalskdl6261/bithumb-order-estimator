document.addEventListener('DOMContentLoaded', () => {
    // === UI Elements ===
    const targetPriceInput = document.getElementById('targetPrice');
    const targetAmountInput = document.getElementById('targetAmount');
    const syncText = document.getElementById('sync-text');
    const amountLabel = document.getElementById('amount-label');
    const amountPostfix = document.getElementById('amount-postfix');
    const radioInputTypes = document.querySelectorAll('input[name="input_type"]');
    const radioCoins = document.querySelectorAll('input[name="coin"]');
    const addTrackerBtn = document.getElementById('addTrackerBtn');
    const activeCountEl = document.getElementById('active-count');
    const trackerListEl = document.getElementById('tracker-list');
    
    // === State Management ===
    let trackers = JSON.parse(localStorage.getItem('bithumb_trackers_v2') || '[]');
    let selectedCoin = 'NFT';
    let currentInitialQty = 0;
    
    // Multi-polling seed states
    let seenTxKeys = new Set();
    let seedModeCoins = new Set(); // Coins that need initial fetch without tracking
    let marketStrengths = {}; // { 'NFT': { strength: 120, askRatio: 0.45 } }
    
    const fmtNum = num => Math.floor(Math.max(0, num)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    
    const formatDate = (ms) => {
        const d = new Date(ms);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    };

    const saveTrackers = () => localStorage.setItem('bithumb_trackers_v2', JSON.stringify(trackers));

    // Compatibility check for older v2 trackers
    trackers.forEach(t => {
        if(t.baseTotalSpeedPerMin === undefined) {
            t.baseTotalSpeedPerMin = t.baseSpeedPerMin ? t.baseSpeedPerMin * 2 : 10000;
        }
    });

    // === Sync UI Logic ===
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
            const krwValue = amount * price;
            currentInitialQty = amount;
            syncText.innerText = `= 내 앞 대기 원화 약 ${fmtNum(krwValue)} 원`;
        }
    };

    radioInputTypes.forEach(r => r.addEventListener('change', updateInputLabels));
    targetPriceInput.addEventListener('input', calculateSync);
    targetAmountInput.addEventListener('input', calculateSync);
    radioCoins.forEach(r => r.addEventListener('change', (e) => {
        selectedCoin = e.target.value;
        targetPriceInput.value = selectedCoin === 'NFT' ? '0.0001' : '0.0004';
        calculateSync();
    }));

    // === Add New Tracker (Fetch Base Speed via Candlestick) ===
    addTrackerBtn.addEventListener('click', async () => {
        if (currentInitialQty <= 0) return alert("올바른 가격과 수량을 입력해주세요!");
        
        const price = parseFloat(targetPriceInput.value);
        const qty = currentInitialQty;
        const coin = selectedCoin;
        
        addTrackerBtn.disabled = true;
        addTrackerBtn.innerText = "1달 빅데이터 분석 중... ⏳";
        
        let baseSpeed = 10000; // default fallback
        try {
            // Fetch 24h Candlestick data for last 30 days
            const res = await fetch(`https://api.bithumb.com/public/candlestick/${coin}_KRW/24h`);
            const json = await res.json();
            if (json.status === "0000" && json.data) {
                // Get last 30 days
                const last30 = json.data.slice(-30);
                let totalVolume = 0;
                last30.forEach(candle => { totalVolume += parseFloat(candle[5]); }); // candle[5] is volume
                
                const minsIn30Days = last30.length * 24 * 60;
                baseSpeed = totalVolume / minsIn30Days;
            }
        } catch(e) { console.error("Candle fetch failed", e); }

        const newTracker = {
            id: Date.now(),
            coin: coin,
            targetPrice: price,
            initialQty: qty,
            remainingQty: qty,
            accumulatedVol: 0,
            startTime: Date.now(),
            baseTotalSpeedPerMin: baseSpeed,
            status: 'active'
        };

        trackers.push(newTracker);
        saveTrackers();
        seedModeCoins.add(coin); // Must seed to prevent duplicate immediately
        
        targetAmountInput.value = '';
        calculateSync();
        
        addTrackerBtn.innerText = "이 조건으로 추적 덱에 추가! ➕";
        addTrackerBtn.disabled = false;
        
        renderCards();
    });

    // === Render DOM ===
    const removeTracker = (id) => {
        trackers = trackers.filter(t => t.id !== id);
        saveTrackers();
        renderCards();
    };

    window.removeTracker = removeTracker; // exp to global

    const renderCards = () => {
        trackerListEl.innerHTML = '';
        activeCountEl.innerText = trackers.length;
        
        if(trackers.length === 0) {
            trackerListEl.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-dim);">진행 중인 추적이 없습니다. 위에서 추가해보세요!</div>`;
            return;
        }

        const now = Date.now();
        
        trackers.forEach(t => {
            // Calculate Hybrid Speed
            const elapsedMins = (now - t.startTime) / 60000;
            let liveSpeed = 0;
            
            // 실시간 체결강도를 통해 매수매도벽 파괴율(askRatio) 반영
            let currentAskRatio = 0.5; // 기본 체결강도 100% 상황
            let strengthStr = "측정 중...";
            if (marketStrengths[t.coin]) {
                currentAskRatio = marketStrengths[t.coin].askRatio;
                strengthStr = `${marketStrengths[t.coin].strength.toFixed(1)}%`;
            }
            if (currentAskRatio <= 0.05) currentAskRatio = 0.05; // 최소 고정물량

            // 내 물량을 까먹는 기준 속도 (총 월간 스피드 * 지금 터지는 시장가 매도 비율)
            let effectiveBaseSpeed = (t.baseTotalSpeedPerMin || 1) * currentAskRatio;
            let compositeSpeed = effectiveBaseSpeed;
            
            if (elapsedMins > 0.5) {
                liveSpeed = t.accumulatedVol / elapsedMins;
                const liveWeight = elapsedMins > 60 ? 0.7 : 0.4;
                compositeSpeed = (effectiveBaseSpeed * (1 - liveWeight)) + (liveSpeed * liveWeight);
            }
            if (compositeSpeed <= 0) compositeSpeed = 1;
            
            const estMins = t.remainingQty / compositeSpeed;
            const d = Math.floor(estMins / (24 * 60));
            const h = Math.floor((estMins % (24 * 60)) / 60);
            const m = Math.floor(estMins % 60);
            
            let timeStr = "";
            if (t.remainingQty <= 0) timeStr = "🎉 체결 완료됨!!";
            else if (d > 0) timeStr = `약 ${d}일 ${h}시간 ${m}분`;
            else timeStr = `약 ${h}시간 ${m}분`;

            let percent = ((t.initialQty - t.remainingQty) / t.initialQty) * 100;
            if (percent > 100) percent = 100;
            if (percent < 0) percent = 0;

            const cardHtml = `
            <div class="tracker-card" id="card-${t.id}">
                <div class="card-header">
                    <div>
                        <div class="card-title">
                            ${t.coin === 'NFT' ? '🦋' : '⚓'} ${t.coin} 
                            <span class="target-price">${t.targetPrice} ₩ 타점</span>
                        </div>
                        <div class="date-badge">추적 시작: ${formatDate(t.startTime)}</div>
                    </div>
                    <button class="btn-delete" onclick="removeTracker(${t.id})">삭제 🗑️</button>
                </div>

                <div class="info-metric">
                    <span>나의 물량 전까지 초기 세팅 코인 수량</span>
                    <strong>${fmtNum(t.initialQty)} 개</strong>
                </div>

                <div class="progress-wrap">
                    <div class="progress-info">
                        <span>현재 내 앞의 실시간 잔여 물량 🔥</span>
                        <strong class="highlight">${fmtNum(t.remainingQty)}</strong>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: ${percent}%"></div>
                    </div>
                </div>

                <div class="stats-grid">
                    <div class="stat-box">
                        <span class="stat-title">추가 이후 내 앞 매물 깎인 양 (누적)</span>
                        <strong class="stat-value">${fmtNum(t.accumulatedVol)}</strong>
                    </div>
                    <div class="stat-box">
                        <span class="stat-title">분당 체결 속도 / 시장 체결강도</span>
                        <strong class="stat-value">${fmtNum(liveSpeed)} / ${strengthStr}</strong>
                    </div>
                    <div class="prediction-box stat-box">
                        <span class="pred-title">예상 체결 대기 시간 (하이브리드 엔진)</span>
                        <div class="highlight-neon">${timeStr}</div>
                        <span class="base-speed-tag">1달 데이터에 실시간 매도세(${Math.round(currentAskRatio*100)}%) 반영 중</span>
                    </div>
                </div>
            </div>`;
            trackerListEl.insertAdjacentHTML('beforeend', cardHtml);
        });
    };

    // === Multi-Polling Engine ===
    const pollTransactions = async () => {
        if (trackers.length === 0) return;
        
        const uniqueCoins = [...new Set(trackers.map(t => t.coin))];
        
        for (const coin of uniqueCoins) {
            try {
                const res = await fetch(`https://api.bithumb.com/public/transaction_history/${coin}_KRW?count=100`);
                const json = await res.json();
                if (json.status !== "0000" || !json.data) continue;
                
                const isSeedMode = seedModeCoins.has(coin);
                let newlyAccumulated = {}; // { targetPrice: volume }
                
                let recentBidVol = 0;
                let recentAskVol = 0;
                let currentPayloadCounts = {}; // 중복 거래 키 방지용 카운터
                
                json.data.forEach(tx => {
                    const p = parseFloat(tx.price);
                    const v = parseFloat(tx.units_traded);
                    
                    if (tx.type === 'bid') recentBidVol += v;
                    else recentAskVol += v;

                    const baseTxKey = `${coin}_${tx.transaction_date}_${tx.type}_${tx.price}_${tx.units_traded}`;
                    currentPayloadCounts[baseTxKey] = (currentPayloadCounts[baseTxKey] || 0) + 1;
                    const txKey = `${baseTxKey}_${currentPayloadCounts[baseTxKey]}`;

                    if (!seenTxKeys.has(txKey)) {
                        seenTxKeys.add(txKey);
                        
                        if (!isSeedMode) {
                            newlyAccumulated[p] = (newlyAccumulated[p] || 0) + v;
                        }
                    }
                });
                
                // Update Market Strength
                const totalRecentVol = recentBidVol + recentAskVol;
                if (totalRecentVol > 0) {
                    let strengthPercent = 100;
                    if (recentAskVol > 0) strengthPercent = (recentBidVol / recentAskVol) * 100;
                    else strengthPercent = 999;
                    marketStrengths[coin] = {
                        strength: strengthPercent,
                        askRatio: recentAskVol / totalRecentVol
                    };
                }
                
                // Clear seed mode after first successful fetch completes
                if (isSeedMode) seedModeCoins.delete(coin);
                
                // Apply volumes to trackers
                let needsUpdate = false;
                for (let price in newlyAccumulated) {
                    const vol = newlyAccumulated[price];
                    trackers.forEach(t => {
                        // 미세소수점 단위를 위해 오차범위 0.0000001 로 비교 (float string equals 문제 해결)
                        if (t.coin === coin && Math.abs(parseFloat(t.targetPrice) - parseFloat(price)) < 0.0000001 && t.remainingQty > 0) {
                            t.accumulatedVol += vol;
                            t.remainingQty -= vol;
                            if (t.remainingQty < 0) t.remainingQty = 0;
                            needsUpdate = true;
                        }
                    });
                }
                
                if (needsUpdate) saveTrackers();
                
            } catch(e) { console.error(`Poll error for ${coin}:`, e); }
        }
        
        // Prevent memory overflow for Set
        if (seenTxKeys.size > 2000) {
            seenTxKeys = new Set(Array.from(seenTxKeys).slice(-1000));
        }
        
        renderCards();
    };

    // Initialization
    // Mark existing coins for Seed Mode on boot to avoid counting past 100 history items as "recent" magically
    if (trackers.length > 0) {
        trackers.forEach(t => seedModeCoins.add(t.coin));
    }
    
    renderCards();
    setInterval(pollTransactions, 5000); // 5 seconds polling
});
