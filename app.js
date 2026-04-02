document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'bithumb_trackers_v2';
    const ANALYSIS_VERSION = 2;
    const HISTORICAL_DAYS = 30;
    const LIVE_WINDOW_MS = 30 * 60 * 1000;
    const STRENGTH_WINDOW_MS = 15 * 60 * 1000;
    const POLL_INTERVAL_MS = 3000;
    const MAX_PROCESSED_KEYS = 240;
    const MAX_RECENT_TRADES_PER_COIN = 1400;
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
    const candleCache = new Map();
    let trackers = normalizeTrackers(bootState.trackers);
    let currentInitialQty = 0;
    let selectedCoin = document.querySelector('input[name="coin"]:checked')?.value || 'NFT';
    let marketStrengths = {};
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
    const fmtRate = (num) => `${fmtNum(num)}개/분`;
    const fmtKrw = (num) => `${Math.max(0, Math.round(num || 0)).toLocaleString('ko-KR')}원`;
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
    const baseAnalysis = (tracker = {}) => {
        const legacy = Number(tracker.baseTotalSpeedPerMin || tracker.baseSpeedPerMin || 0);
        return {
            version: ANALYSIS_VERSION,
            daysAnalyzed: HISTORICAL_DAYS,
            matchedDays: 0,
            coverageRatio: 0,
            weightedVolume: 0,
            speedPerMin: legacy > 0 ? legacy : 0,
            avgMatchedVolumePerDay: legacy > 0 ? legacy * 1440 : 0,
            analyzedAt: Date.now(),
            source: legacy > 0 ? 'legacy' : 'pending'
        };
    };
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
                        historicalAnalysis: t.historicalAnalysis && t.historicalAnalysis.version === ANALYSIS_VERSION ? t.historicalAnalysis : baseAnalysis(t)
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

    const fetchCandles = async (coin) => {
        if (candleCache.has(coin)) return candleCache.get(coin);
        const req = fetch(`https://api.bithumb.com/public/candlestick/${coin}_KRW/24h`)
            .then((r) => r.json())
            .then((json) => {
                if (json.status !== '0000' || !Array.isArray(json.data)) throw new Error(`candle:${coin}`);
                return json.data.slice(-HISTORICAL_DAYS);
            })
            .catch((error) => {
                candleCache.delete(coin);
                throw error;
            });
        candleCache.set(coin, req);
        return req;
    };
    const buildAnalysis = (candles, targetPrice) => {
        const days = Array.isArray(candles) ? candles.slice(-HISTORICAL_DAYS) : [];
        const totalMinutes = Math.max(1, days.length * 1440);
        const bandWidth = Math.max(0.0001, Number(targetPrice) * 0.03);
        const lowBand = Math.max(0, Number(targetPrice) - (bandWidth / 2));
        const highBand = Number(targetPrice) + (bandWidth / 2);
        let matchedDays = 0;
        let weightedVolume = 0;
        let totalVolume = 0;
        days.forEach((candle) => {
            const open = Number(candle[1]);
            const close = Number(candle[2]);
            const high = Number(candle[3]);
            const low = Number(candle[4]);
            const volume = Number(candle[5]);
            if (![open, close, high, low, volume].every(Number.isFinite)) return;
            totalVolume += volume;
            if (high < lowBand || low > highBand) return;
            matchedDays += 1;
            const range = Math.max(high - low, bandWidth);
            const overlap = Math.max(0, Math.min(high, highBand) - Math.max(low, lowBand));
            const weight = clamp(((clamp(overlap / bandWidth, 0.2, 1) * 0.45) + ((1 - Math.min(1, Math.abs(close - targetPrice) / range)) * 0.35) + ((1 - Math.min(1, Math.abs(open - targetPrice) / range)) * 0.2)), 0.18, 1);
            weightedVolume += volume * weight;
        });
        const speedPerMin = weightedVolume > 0 ? weightedVolume / totalMinutes : ((totalVolume / totalMinutes) || 0) * 0.02;
        return { version: ANALYSIS_VERSION, daysAnalyzed: days.length || HISTORICAL_DAYS, matchedDays, coverageRatio: days.length ? matchedDays / days.length : 0, weightedVolume, speedPerMin, avgMatchedVolumePerDay: matchedDays ? weightedVolume / matchedDays : 0, analyzedAt: Date.now(), source: matchedDays ? 'monthly_range' : 'monthly_fallback' };
    };
    const analyzeTracker = async (tracker) => {
        try {
            return buildAnalysis(await fetchCandles(tracker.coin), tracker.targetPrice);
        } catch (error) {
            console.error('analysis failed', error);
            return baseAnalysis(tracker);
        }
    };
    const refreshAnalyses = async () => {
        for (const tracker of trackers.filter((t) => !t.historicalAnalysis || t.historicalAnalysis.version !== ANALYSIS_VERSION || ['legacy', 'pending'].includes(t.historicalAnalysis.source))) {
            const next = await analyzeTracker(tracker);
            const current = trackers.find((item) => item.id === tracker.id);
            if (!current) continue;
            current.historicalAnalysis = next;
            saveTrackers();
            renderCards();
        }
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
    const updateStrength = (coin) => {
        const cutoff = Date.now() - STRENGTH_WINDOW_MS;
        const trades = (recentTradesByCoin[coin] || []).filter((trade) => trade.timeMs >= cutoff);
        let bid = 0;
        let ask = 0;
        trades.forEach((trade) => { trade.type === 'bid' ? bid += trade.volume : ask += trade.volume; });
        const total = bid + ask;
        marketStrengths[coin] = total > 0 ? { strength: ask > 0 ? (bid / ask) * 100 : 999, buyPressure: bid / total } : { strength: 100, buyPressure: 0.5 };
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
        const liveFrom = Math.max(tracker.startTime, now - LIVE_WINDOW_MS);
        const liveMinutes = Math.max((now - liveFrom) / 60000, 1 / 6);
        const elapsedMinutes = Math.max((now - tracker.startTime) / 60000, 1 / 6);
        const liveVolume = (recentTradesByCoin[tracker.coin] || []).filter((trade) => trade.timeMs >= liveFrom && priceMatch(tracker.targetPrice, trade.price)).reduce((sum, trade) => sum + trade.volume, 0);
        const liveSpeed = liveVolume / liveMinutes;
        const observedSpeed = tracker.accumulatedVol / elapsedMinutes;
        const historical = tracker.historicalAnalysis || baseAnalysis(tracker);
        const historicalSpeed = Math.max(0, Number(historical.speedPerMin) || 0);
        const strength = marketStrengths[tracker.coin] || { strength: 100, buyPressure: 0.5 };
        const multiplier = clamp(0.75 + (strength.buyPressure * 0.7), 0.65, 1.45);
        let composite = historicalSpeed;
        if (liveSpeed > 0 && observedSpeed > 0) composite = (historicalSpeed * 0.4) + (liveSpeed * 0.4) + (observedSpeed * 0.2);
        else if (liveSpeed > 0) composite = (historicalSpeed * 0.55) + (liveSpeed * 0.45);
        else if (observedSpeed > 0) composite = (historicalSpeed * 0.7) + (observedSpeed * 0.3);
        composite = Math.max(composite * multiplier, historicalSpeed * 0.15, liveSpeed * 0.2, 0.000001);
        const pending = historical.source === 'pending' && liveSpeed <= 0 && observedSpeed <= 0;
        const remainingMinutes = tracker.remainingQty <= 0 ? 0 : tracker.remainingQty / composite;
        return { historical, liveSpeed, observedSpeed, composite, pending, remainingMinutes, etaMs: tracker.remainingQty <= 0 ? now : now + (remainingMinutes * 60000), strengthLabel: strength.strength >= 999 ? '999%+' : `${strength.strength.toFixed(1)}%` };
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
            const completedRatio = tracker.initialQty > 0 ? clamp(((tracker.initialQty - tracker.remainingQty) / tracker.initialQty) * 100, 0, 100) : 0;
            const barWidth = tracker.remainingQty > 0 ? clamp(Math.max(remainingRatio, 4), 4, 100) : 0;
            const priceLabel = Number(tracker.targetPrice).toFixed(4);
            const etaLabel = tracker.remainingQty <= 0 ? '체결 완료' : (stats.pending ? '실시간 데이터 수집 중' : formatFullDate(stats.etaMs));
            const remainLabel = tracker.remainingQty <= 0 ? '체결 완료' : (stats.pending ? '30일 데이터 분석 중' : formatRemainingTime(stats.remainingMinutes));
            const note = stats.historical.matchedDays > 0 ? `최근 ${stats.historical.daysAnalyzed}일 중 ${stats.historical.matchedDays}일 동안 ${priceLabel}원 가격대가 실제 거래 범위에 포함된 흐름을 반영했습니다.` : `최근 ${stats.historical.daysAnalyzed}일 캔들에서 ${priceLabel}원 가격대 직접 체결 범위가 적어 전체 거래량 대비 보수적으로 계산 중입니다.`;
            return `<div class="tracker-card space-y-4"><div class="flex justify-between gap-4 items-start"><div class="space-y-2"><div class="text-white font-bold text-lg">${tracker.coin}<span class="text-[#f37321] text-sm ml-2">${priceLabel} KRW</span></div><div class="flex flex-wrap gap-2"><span class="text-[11px] text-slate-400 font-bold px-3 py-1.5 rounded-full border border-white/5 bg-[#0b0f15]">시작 ${formatFullDate(tracker.startTime)}</span><span class="text-[11px] text-[#f37321] font-bold px-3 py-1.5 rounded-full border border-[#f37321]/20 bg-[#f37321]/10">예상 ${etaLabel}</span></div></div><button onclick="removeTracker(${tracker.id})" class="text-slate-600 hover:text-red-500 transition-colors"><span class="material-icons text-xl">delete_outline</span></button></div><div class="bg-[#0b0f15] rounded-2xl p-4 border border-white/5"><div class="flex justify-between text-[11px] font-bold text-slate-400 mb-2"><span>현재 내 앞 잔여 물량</span><span class="text-white">${fmtNum(tracker.remainingQty)} 개</span></div><div class="progress-bar-bg"><div class="progress-bar-fill h-full" style="width:${barWidth}%"></div></div><div class="mt-2 flex justify-between text-[10px] font-semibold text-slate-500"><span>초기 ${fmtNum(tracker.initialQty)} 개</span><span>잔여 ${remainingRatio.toFixed(1)}%</span></div></div><div class="grid grid-cols-3 gap-2"><div class="stat-box"><div class="text-[9px] font-bold text-slate-500 uppercase">누적 차감 물량</div><div class="text-white font-mono text-sm font-bold mt-1">${fmtNum(tracker.accumulatedVol)}</div></div><div class="stat-box"><div class="text-[9px] font-bold text-slate-500 uppercase">최근 실시간 속도</div><div class="text-white font-mono text-sm font-bold mt-1">${fmtKrwRate(stats.liveSpeed, tracker.targetPrice)}</div></div><div class="stat-box"><div class="text-[9px] font-bold text-slate-500 uppercase">30일 가격대 속도</div><div class="text-white font-mono text-sm font-bold mt-1">${fmtKrwRate(stats.historical.speedPerMin, tracker.targetPrice)}</div></div></div><div class="rounded-2xl border border-[#f37321]/20 bg-[#f37321]/8 p-4 space-y-3"><div class="flex items-center justify-between gap-2 flex-wrap"><span class="text-[#f37321] text-[11px] font-black uppercase tracking-[0.24em]">예상 체결까지</span><span class="text-[10px] text-slate-400 font-bold px-2 py-1 rounded-full bg-[#0b0f15] border border-white/5">30일 분석 ${stats.historical.matchedDays}일 반영</span></div><div class="text-white font-extrabold text-xl leading-tight">${remainLabel}</div><div class="flex flex-wrap gap-2"><span class="text-[11px] text-slate-300 font-semibold px-3 py-2 rounded-full bg-[#0b0f15] border border-white/5">완료 예상 ${etaLabel}</span><span class="text-[11px] text-slate-300 font-semibold px-3 py-2 rounded-full bg-[#0b0f15] border border-white/5">복합 속도 ${fmtKrwRate(stats.composite, tracker.targetPrice)}</span><span class="text-[11px] text-slate-300 font-semibold px-3 py-2 rounded-full bg-[#0b0f15] border border-white/5">누적 반영 속도 ${fmtKrwRate(stats.observedSpeed, tracker.targetPrice)}</span></div><p class="text-[11px] text-slate-400 leading-relaxed">${note}</p></div></div>`;
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
                updateStrength(coin);
                if (applyTrades(coin, trades)) changed = true;
            } catch (error) {
                console.error(`poll failed: ${coin}`, error);
            }
        }
        if (changed) saveTrackers();
        renderCards();
    };
    const attachAnalysis = async (trackerId) => {
        const tracker = trackers.find((item) => item.id === trackerId);
        if (!tracker) return;
        const next = await analyzeTracker(tracker);
        const current = trackers.find((item) => item.id === trackerId);
        if (!current) return;
        current.historicalAnalysis = next;
        saveTrackers();
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
        attachAnalysis(trackerId);
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            saveTrackers();
        }
    });
    window.addEventListener('pagehide', saveTrackers);
    // 주기적으로 자동 저장 (30초마다)
    setInterval(() => { if (trackers.length > 0) saveTrackers(); }, 30000);
    targetPriceInput.value = getDefaultPrice(selectedCoin).toFixed(4);
    updateInputLabels();
    renderCards();
    // 부트 시퀀스: hydrate → 분석 → 폴링 (순차적으로)
    hydratePersistentState().then(() => {
        refreshAnalyses();
        pollTransactions();
        setInterval(pollTransactions, POLL_INTERVAL_MS);
    });
});
