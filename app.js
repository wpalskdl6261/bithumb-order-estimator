document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'bithumb_trackers_v2';
    const ANALYSIS_VERSION = 2;
    const LIVE_WINDOW_MS = 6 * 60 * 60 * 1000;
    const TREND_WINDOW_MINUTES = 120;
    const MIN_TRACKING_MINUTES = 5;
    const POLL_INTERVAL_MS = 3000;
    const MAX_PROCESSED_KEYS = 240;
    const MAX_RECENT_TRADES_PER_COIN = 4000;
    const PRICE_MATCH_TOLERANCE = 0.00005;
    const DEFAULT_PRICE_BY_COIN = { NFT: 0.0004, BTT: 0.0004 };
    const STORAGE_DB_NAME = 'bithumb-estimator-db';
    const STORAGE_DB_VERSION = 1;
    const STORAGE_STORE_NAME = 'app-state';
    const STORAGE_RECORD_KEY = 'trackers';

    const targetPriceInput = document.getElementById('targetPrice');
    const targetAmountInput = document.getElementById('targetAmount');
    const syncText = document.getElementById('sync-text');
    const amountLabel = document.getElementById('amount-label');
    const amountPostfix = document.getElementById('amount-postfix');
    const radioInputTypes = document.querySelectorAll('input[name="input_type"]');
    const radioCoins = document.querySelectorAll('input[name="coin"]');
    const addTrackerBtn = document.getElementById('addTrackerBtn');
    const trackerListEl = document.getElementById('tracker-list');
    const activeCountEl = document.getElementById('active-count');
    const errorMsgEl = document.getElementById('error-msg');

    const bootState = readLocalState();
    let trackers = normalizeTrackers(bootState.trackers);
    let currentInitialQty = 0;
    let selectedCoin = document.querySelector('input[name="coin"]:checked')?.value || 'NFT';
    let recentTradesByCoin = {};
    let recentTradeKeys = new Set();
    let lastSavedAt = Number(bootState.savedAt) || 0;

    const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
    const fmtNum = (num) => {
        if (!Number.isFinite(num)) return '0';
        const safe = Math.max(0, num);
        if (safe >= 100) return Math.floor(safe).toLocaleString('ko-KR');
        if (safe >= 1) return safe.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
        return safe.toLocaleString('ko-KR', { maximumFractionDigits: 6 });
    };
    const fmtKrwRate = (speedPerMin, price) => `${Math.max(0, Math.round((Number(speedPerMin) || 0) * (Number(price) || 0) * 60)).toLocaleString('ko-KR')}원/시간`;
    const formatFullDate = (ms) => {
        const d = new Date(ms);
        if (!Number.isFinite(ms) || Number.isNaN(d.getTime())) return '-';
        return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    };
    const formatRemainingTime = (mins) => {
        if (!Number.isFinite(mins) || mins < 0) return '계산 중';
        if (mins === 0) return '체결 완료';
        const total = Math.max(1, Math.round(mins));
        const days = Math.floor(total / 1440);
        const hours = Math.floor((total % 1440) / 60);
        const minutes = total % 60;
        if (days > 0) return `${days}일 ${hours}시간 ${minutes}분`;
        if (hours > 0) return `${hours}시간 ${minutes}분`;
        return `${minutes}분`;
    };
    const getDefaultPrice = (coin) => DEFAULT_PRICE_BY_COIN[coin] ?? 0.0004;
    const parseTxTime = (value) => {
        const parsed = Date.parse(String(value || '').replace(' ', 'T'));
        return Number.isNaN(parsed) ? Date.now() : parsed;
    };
    const priceMatch = (target, price) => {
        const t = Number(target);
        const p = Number(price);
        if (Math.abs(t - p) < PRICE_MATCH_TOLERANCE) return true;
        // 문자열 기반 비교 (소수 4자리) - 부동소수점 오차 방지
        const tStr = t.toFixed(4);
        const pStr = p.toFixed(4);
        return tStr === pStr;
    };
    const baseAnalysis = () => ({ version: ANALYSIS_VERSION, source: 'tracking_only' });
    function readLocalState() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            if (Array.isArray(parsed)) {
                return { savedAt: 0, trackers: parsed };
            }
            if (parsed && typeof parsed === 'object' && Array.isArray(parsed.trackers)) {
                return {
                    savedAt: Number(parsed.savedAt) || 0,
                    trackers: parsed.trackers
                };
            }
        } catch (error) {
            console.error('Failed to read local state', error);
        }
        return { savedAt: 0, trackers: [] };
    }
    function normalizeTrackers(rawTrackers) {
        try {
            return (Array.isArray(rawTrackers) ? rawTrackers : [])
                .map((t) => {
                    const startTime = Number(t.startTime) || Date.now();
                    const initialQty = Math.max(0, Number(t.initialQty) || 0);
                    if (initialQty <= 0) return null;
                    const remainingQty = Number.isFinite(Number(t.remainingQty))
                        ? clamp(Number(t.remainingQty), 0, initialQty)
                        : initialQty;
                    return {
                        id: t.id || Date.now() + Math.random(),
                        coin: t.coin || 'NFT',
                        targetPrice: Number(t.targetPrice) || getDefaultPrice(t.coin || 'NFT'),
                        initialQty,
                        remainingQty,
                        accumulatedVol: Number.isFinite(Number(t.accumulatedVol))
                            ? Math.max(0, Number(t.accumulatedVol))
                            : Math.max(0, initialQty - remainingQty),
                        startTime,
                        processedTradeKeys: Array.isArray(t.processedTradeKeys) ? t.processedTradeKeys.slice(-MAX_PROCESSED_KEYS) : [],
                        lastSeenTradeAt: Number(t.lastSeenTradeAt) || startTime,
                        lastMatchedAt: Number(t.lastMatchedAt) || 0,
                        historicalAnalysis: baseAnalysis()
                    };
                })
                .filter(Boolean);
        } catch (error) {
            console.error('Failed to normalize trackers', error);
            return [];
        }
    }
    function openStorageDb() {
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) {
                resolve(null);
                return;
            }
            const request = indexedDB.open(STORAGE_DB_NAME, STORAGE_DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORAGE_STORE_NAME)) {
                    db.createObjectStore(STORAGE_STORE_NAME, { keyPath: 'key' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    async function readIndexedState() {
        try {
            const db = await openStorageDb();
            if (!db) return null;
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(STORAGE_STORE_NAME, 'readonly');
                const store = tx.objectStore(STORAGE_STORE_NAME);
                const request = store.get(STORAGE_RECORD_KEY);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
                tx.oncomplete = () => db.close();
            });
        } catch (error) {
            console.error('Failed to read IndexedDB state', error);
            return null;
        }
    }
    async function writeIndexedState(payload) {
        try {
            const db = await openStorageDb();
            if (!db) return;
            await new Promise((resolve, reject) => {
                const tx = db.transaction(STORAGE_STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORAGE_STORE_NAME);
                store.put({ key: STORAGE_RECORD_KEY, ...payload });
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
                tx.onabort = () => reject(tx.error);
            });
            db.close();
        } catch (error) {
            console.error('Failed to write IndexedDB state', error);
        }
    }
    async function hydratePersistentState() {
        try {
            if (navigator.storage?.persist) {
                await navigator.storage.persist();
            }
        } catch (error) {
            console.error('Storage persist request failed', error);
        }

        const indexedState = await readIndexedState();
        const localState = readLocalState();

        // 모든 소스 중 가장 최신이고 데이터가 많은 것을 선택
        const candidates = [
            { source: 'indexed', savedAt: Number(indexedState?.savedAt) || 0, trackers: indexedState?.trackers },
            { source: 'local', savedAt: Number(localState.savedAt) || 0, trackers: localState.trackers },
            { source: 'boot', savedAt: lastSavedAt, trackers }
        ].filter(c => Array.isArray(c.trackers) && c.trackers.length > 0);

        // savedAt 기준 정렬, 같으면 트래커 수가 많은 것 우선
        candidates.sort((a, b) => {
            if (b.savedAt !== a.savedAt) return b.savedAt - a.savedAt;
            return b.trackers.length - a.trackers.length;
        });

        const best = candidates[0];
        if (best && Array.isArray(best.trackers) && best.trackers.length > 0) {
            const normalized = normalizeTrackers(best.trackers);
            if (normalized.length > 0) {
                trackers = normalized;
                lastSavedAt = best.savedAt || Date.now();
                console.log(`[hydrate] restored ${trackers.length} trackers from ${best.source} (savedAt: ${new Date(lastSavedAt).toISOString()})`);
                renderCards();
            }
        }

        // 즉시 양쪽 저장소에 동기화
        saveTrackers();
    }
    const saveTrackers = () => {
        lastSavedAt = Date.now();
        const payload = { savedAt: lastSavedAt, trackers };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch (error) {
            console.error('Failed to save to localStorage', error);
        }
        writeIndexedState(payload).catch(err => console.error('Failed to save to IndexedDB', err));
    };
    const setError = (msg = '') => { if (errorMsgEl) errorMsgEl.innerText = msg; };
    const updateActiveCount = () => { if (activeCountEl) activeCountEl.innerText = String(trackers.length); };
    const updateInputLabels = () => {
        const type = document.querySelector('input[name="input_type"]:checked')?.value || 'KRW';
        amountLabel.innerText = type === 'KRW' ? '내 앞 대기 원화' : '내 앞 대기 코인';
        amountPostfix.innerText = type === 'KRW' ? '원' : '개';
        targetAmountInput.placeholder = type === 'KRW' ? '예: 10000000' : '예: 5000000000';
        calculateSync();
    };
    const calculateSync = () => {
        const type = document.querySelector('input[name="input_type"]:checked')?.value || 'KRW';
        const price = Number(targetPriceInput.value);
        const amount = Number(targetAmountInput.value);
        if (!Number.isFinite(price) || !Number.isFinite(amount) || price <= 0 || amount <= 0) {
            syncText.innerText = '= 대기 중...';
            currentInitialQty = 0;
            return;
        }
        if (type === 'KRW') {
            currentInitialQty = amount / price;
            syncText.innerText = `= 내 앞 대기 코인 약 ${fmtNum(currentInitialQty)} 개`;
            return;
        }
        currentInitialQty = amount;
        syncText.innerText = `= 내 앞 대기 원화 약 ${fmtNum(amount * price)} 원`;
    };

    const buildTrades = (coin, rawTrades) => {
        const counts = {};
        return rawTrades.map((trade) => {
            const baseKey = `${coin}_${trade.transaction_date}_${trade.type}_${trade.price}_${trade.units_traded}`;
            counts[baseKey] = (counts[baseKey] || 0) + 1;
            return { key: `${baseKey}_${counts[baseKey]}`, timeMs: parseTxTime(trade.transaction_date), price: Number(trade.price), volume: Number(trade.units_traded), type: trade.type };
        }).filter((trade) => Number.isFinite(trade.price) && Number.isFinite(trade.volume)).sort((a, b) => a.timeMs - b.timeMs);
    };
    const pushRecentTrades = (coin, trades) => {
        recentTradesByCoin[coin] = recentTradesByCoin[coin] || [];
        trades.forEach((trade) => {
            if (recentTradeKeys.has(trade.key)) return;
            recentTradeKeys.add(trade.key);
            recentTradesByCoin[coin].push(trade);
        });
        const cutoff = Date.now() - LIVE_WINDOW_MS;
        recentTradesByCoin[coin] = recentTradesByCoin[coin].filter((trade) => trade.timeMs >= cutoff).slice(-MAX_RECENT_TRADES_PER_COIN);
        if (recentTradeKeys.size > MAX_RECENT_TRADES_PER_COIN * 6) {
            const nextKeys = new Set();
            Object.values(recentTradesByCoin).forEach((list) => list.forEach((trade) => nextKeys.add(trade.key)));
            recentTradeKeys = nextKeys;
        }
    };
    const applyTrades = (coin, trades) => {
        let changed = false;
        trackers.filter((tracker) => tracker.coin === coin).forEach((tracker) => {
            const seen = new Set(tracker.processedTradeKeys || []);
            let trackerChanged = false;
            trades.forEach((trade) => {
                // 이미 처리된 체결이면 스킵
                if (seen.has(trade.key)) return;
                // 트래커 시작보다 5초 이상 이전 체결은 무시 (기존 1초 → 5초로 여유 확대)
                if (trade.timeMs + 5000 < tracker.startTime) return;
                // 가격 매칭 확인
                if (!priceMatch(tracker.targetPrice, trade.price)) return;
                seen.add(trade.key);
                tracker.lastSeenTradeAt = Math.max(tracker.lastSeenTradeAt || tracker.startTime, trade.timeMs);
                trackerChanged = true;
                if (tracker.remainingQty <= 0) return;
                const applied = Math.min(trade.volume, tracker.remainingQty);
                if (applied <= 0) return;
                tracker.accumulatedVol += applied;
                tracker.remainingQty = Math.max(0, tracker.remainingQty - applied);
                tracker.lastMatchedAt = trade.timeMs;
                console.log(`[trade matched] ${coin} @ ${trade.price} vol=${applied} remaining=${tracker.remainingQty}`);
            });
            if (!trackerChanged) return;
            tracker.processedTradeKeys = Array.from(seen).slice(-MAX_PROCESSED_KEYS);
            changed = true;
        });
        return changed;
    };
    const estimate = (tracker, now) => {
        const elapsedMinutes = Math.max((now - tracker.startTime) / 60000, 1 / 6);
        const recentWindowMinutes = Math.max(Math.min(elapsedMinutes, TREND_WINDOW_MINUTES), 1 / 6);
        const recentFrom = now - (recentWindowMinutes * 60000);
        const matchedRecentTrades = (recentTradesByCoin[tracker.coin] || []).filter((trade) => trade.timeMs >= recentFrom && trade.timeMs >= tracker.startTime && priceMatch(tracker.targetPrice, trade.price));
        const recentVolume = matchedRecentTrades.reduce((sum, trade) => sum + trade.volume, 0);
        const liveSpeed = recentVolume / recentWindowMinutes;
        const observedSpeed = tracker.accumulatedVol / elapsedMinutes;
        const hasRecentTrend = recentVolume > 0;
        const hasAverageTrend = tracker.accumulatedVol > 0;
        let composite = 0;

        if (hasRecentTrend && hasAverageTrend) {
            composite = (observedSpeed * 0.6) + (liveSpeed * 0.4);
        } else if (hasAverageTrend) {
            composite = observedSpeed;
        } else if (hasRecentTrend) {
            composite = liveSpeed;
        }

        const pending = elapsedMinutes < MIN_TRACKING_MINUTES || composite <= 0;
        const remainingMinutes = tracker.remainingQty <= 0 ? 0 : tracker.remainingQty / composite;
        return {
            liveSpeed,
            observedSpeed,
            composite,
            pending,
            remainingMinutes,
            etaMs: tracker.remainingQty <= 0 || pending ? now : now + (remainingMinutes * 60000),
            elapsedMinutes,
            recentWindowMinutes
        };
    };
    const renderCards = () => {
        updateActiveCount();
        if (trackers.length === 0) {
            trackerListEl.innerHTML = `<div class="border-2 border-dashed border-white/5 rounded-3xl p-12 text-center"><div class="w-16 h-16 bg-[#181c23] rounded-2xl flex items-center justify-center mx-auto mb-6"><span class="material-icons text-slate-600 text-3xl">hourglass_empty</span></div><h4 class="text-white font-bold text-xl mb-2">진행 중인 추적이 없습니다</h4><p class="text-slate-500 text-sm leading-relaxed px-4">시작하려면 상단 양식에서 코인과 물량을 입력하여 추적을 시작하세요.</p></div>`;
            return;
        }
        const now = Date.now();
        trackerListEl.innerHTML = trackers.map((tracker) => {
            const stats = estimate(tracker, now);
            const remainingRatio = tracker.initialQty > 0 ? clamp((tracker.remainingQty / tracker.initialQty) * 100, 0, 100) : 0;
            const barWidth = tracker.remainingQty > 0 ? clamp(Math.max(remainingRatio, 4), 4, 100) : 0;
            const priceLabel = Number(tracker.targetPrice).toFixed(4);
            const etaLabel = tracker.remainingQty <= 0 ? '체결 완료' : (stats.pending ? '실시간 데이터 수집 중' : formatFullDate(stats.etaMs));
            const remainLabel = tracker.remainingQty <= 0 ? '체결 완료' : (stats.pending ? '추적 데이터 수집 중' : formatRemainingTime(stats.remainingMinutes));
            const note = stats.pending
                ? '덱 추가 후 체결 데이터를 더 쌓는 중입니다. 실제 체결이 누적되면 최근 속도와 평균 속도를 함께 반영해 예상 시간을 계산합니다.'
                : `덱 추가 후 ${formatRemainingTime(stats.elapsedMinutes)} 동안 누적된 속도와 최근 ${formatRemainingTime(stats.recentWindowMinutes)} 경향을 함께 반영했습니다.`;
            return `<div class="tracker-card space-y-4"><div class="flex justify-between gap-4 items-start"><div class="space-y-2"><div class="text-white font-bold text-lg">${tracker.coin}<span class="text-[#f37321] text-sm ml-2">${priceLabel} KRW</span></div><div class="flex flex-wrap gap-2"><span class="text-[11px] text-slate-400 font-bold px-3 py-1.5 rounded-full border border-white/5 bg-[#0b0f15]">시작 ${formatFullDate(tracker.startTime)}</span><span class="text-[11px] text-[#f37321] font-bold px-3 py-1.5 rounded-full border border-[#f37321]/20 bg-[#f37321]/10">예상 ${etaLabel}</span></div></div><button onclick="removeTracker(${tracker.id})" class="text-slate-600 hover:text-red-500 transition-colors"><span class="material-icons text-xl">delete_outline</span></button></div><div class="bg-[#0b0f15] rounded-2xl p-4 border border-white/5"><div class="flex justify-between text-[11px] font-bold text-slate-400 mb-2"><span>현재 내 앞 잔여 물량</span><span class="text-white">${fmtNum(tracker.remainingQty)} 개</span></div><div class="progress-bar-bg"><div class="progress-bar-fill h-full" style="width:${barWidth}%"></div></div><div class="mt-2 flex justify-between text-[10px] font-semibold text-slate-500"><span>초기 ${fmtNum(tracker.initialQty)} 개</span><span>잔여 ${remainingRatio.toFixed(1)}%</span></div></div><div class="grid grid-cols-3 gap-2"><div class="stat-box"><div class="text-[9px] font-bold text-slate-500 uppercase">누적 차감 물량</div><div class="text-white font-mono text-sm font-bold mt-1">${fmtNum(tracker.accumulatedVol)}</div></div><div class="stat-box"><div class="text-[9px] font-bold text-slate-500 uppercase">최근 체결 속도</div><div class="text-white font-mono text-sm font-bold mt-1">${fmtKrwRate(stats.liveSpeed, tracker.targetPrice)}</div></div><div class="stat-box"><div class="text-[9px] font-bold text-slate-500 uppercase">추적 후 평균 속도</div><div class="text-white font-mono text-sm font-bold mt-1">${fmtKrwRate(stats.observedSpeed, tracker.targetPrice)}</div></div></div><div class="rounded-2xl border border-[#f37321]/20 bg-[#f37321]/8 p-4 space-y-3"><div class="flex items-center justify-between gap-2 flex-wrap"><span class="text-[#f37321] text-[11px] font-black uppercase tracking-[0.24em]">예상 체결까지</span><span class="text-[10px] text-slate-400 font-bold px-2 py-1 rounded-full bg-[#0b0f15] border border-white/5">덱 추가 후 경향 기반</span></div><div class="text-white font-extrabold text-xl leading-tight">${remainLabel}</div><div class="flex flex-wrap gap-2"><span class="text-[11px] text-slate-300 font-semibold px-3 py-2 rounded-full bg-[#0b0f15] border border-white/5">완료 예상 ${etaLabel}</span><span class="text-[11px] text-slate-300 font-semibold px-3 py-2 rounded-full bg-[#0b0f15] border border-white/5">최근 속도 ${fmtKrwRate(stats.liveSpeed, tracker.targetPrice)}</span><span class="text-[11px] text-slate-300 font-semibold px-3 py-2 rounded-full bg-[#0b0f15] border border-white/5">예상 기준 속도 ${fmtKrwRate(stats.composite, tracker.targetPrice)}</span></div><p class="text-[11px] text-slate-400 leading-relaxed">${note}</p></div></div>`;
        }).join('');
    };
    const pollTransactions = async () => {
        if (trackers.length === 0) return;
        let changed = false;
        for (const coin of [...new Set(trackers.map((tracker) => tracker.coin))]) {
            try {
                const response = await fetch(`https://api.bithumb.com/public/transaction_history/${coin}_KRW?count=100`);
                const json = await response.json();
                if (json.status !== '0000' || !Array.isArray(json.data)) continue;
                const trades = buildTrades(coin, json.data);
                pushRecentTrades(coin, trades);
                if (applyTrades(coin, trades)) changed = true;
            } catch (error) {
                console.error(`poll failed: ${coin}`, error);
            }
        }
        if (changed) saveTrackers();
        renderCards();
    };
    window.removeTracker = (id) => {
        trackers = trackers.filter((tracker) => tracker.id !== id);
        saveTrackers();
        renderCards();
    };
    radioInputTypes.forEach((radio) => radio.addEventListener('change', updateInputLabels));
    radioCoins.forEach((radio) => radio.addEventListener('change', (event) => {
        selectedCoin = event.target.value;
        targetPriceInput.value = getDefaultPrice(selectedCoin).toFixed(4);
        calculateSync();
    }));
    targetAmountInput.addEventListener('input', calculateSync);
    targetPriceInput.addEventListener('input', calculateSync);
    addTrackerBtn.addEventListener('click', () => {
        setError();
        const price = Number(targetPriceInput.value);
        const qty = currentInitialQty;
        const coin = document.querySelector('input[name="coin"]:checked')?.value || selectedCoin;
        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(qty) || qty <= 0) {
            setError('올바른 가격과 수량을 입력해주세요.');
            return;
        }
        addTrackerBtn.disabled = true;
        addTrackerBtn.innerText = '추적 생성 중...';
        const startTime = Date.now();
        const trackerId = Date.now();
        trackers = [{ id: trackerId, coin, targetPrice: price, initialQty: qty, remainingQty: qty, accumulatedVol: 0, startTime, processedTradeKeys: [], lastSeenTradeAt: startTime, lastMatchedAt: 0, historicalAnalysis: baseAnalysis() }, ...trackers];
        saveTrackers();
        renderCards();
        targetAmountInput.value = '';
        calculateSync();
        addTrackerBtn.disabled = false;
        addTrackerBtn.innerText = '추적 덱에 추가하기';
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            saveTrackers();
        }
    });
    window.addEventListener('pagehide', saveTrackers);
    setInterval(() => { if (trackers.length > 0) saveTrackers(); }, 30000);
    targetPriceInput.value = getDefaultPrice(selectedCoin).toFixed(4);
    updateInputLabels();
    renderCards();
    hydratePersistentState().then(() => {
        pollTransactions();
        setInterval(pollTransactions, POLL_INTERVAL_MS);
    });
});
