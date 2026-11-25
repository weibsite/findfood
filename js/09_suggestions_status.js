// Suggestions & Status (setDeliveryMethod defined in 01_config.js)
let queryDebounceTimer = null;
let lastSearchedQuery = "";
let lastSearchedVertical = "";
let isFetchingSuggestions = false;
let pendingSuggestionQuery = "";
window.suggestionStores = [];

function openQueryOverlay() {
    const overlay = document.getElementById('globalSearchOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    
    const mainBtn = document.getElementById('searchMainBtnMobile');
    const inputMobile = document.getElementById('globalSearchInputMobile');
    if (mainBtn && inputMobile) {
        if (window.isDiscountZone) {
            mainBtn.innerText = '尋找免運';
            mainBtn.setAttribute('onclick', 'searchStoresPickup(document.getElementById("globalSearchInputMobile").value.trim())');
            mainBtn.style.background = '#ff9800';
            mainBtn.style.color = '#fff';
            inputMobile.placeholder = '搜尋免運餐廳...';
            inputMobile.setAttribute('onkeydown', 'if(event.key==="Enter"){ event.preventDefault(); searchStoresPickup(this.value.trim()); }');
        } else {
            mainBtn.innerText = '尋找食物';
            mainBtn.setAttribute('onclick', 'window.searchStores()');
            mainBtn.style.background = '#f43f5e';
            mainBtn.style.color = '#000';
            inputMobile.placeholder = '想吃什麼？ (例如: 麥當勞)';
            inputMobile.setAttribute('onkeydown', 'if(event.key==="Enter"){ event.preventDefault(); window.searchStores(); }');
        }
    }
    
    // Sync and focus mobile input synchronously
    const headerInput = document.getElementById('query');
    const mobileInput = document.getElementById('globalSearchInputMobile');
    if (mobileInput && headerInput) {
        mobileInput.value = headerInput.value;
        mobileInput.focus();
    }
    // [優化] 改為呼叫 updateQueryOverlay，這樣如果緩存被清空，能正確觸發新的背景 API 搜尋
    updateQueryOverlay();
}

function closeQueryOverlay() {
    const overlay = document.getElementById('globalSearchOverlay');
    if (overlay) overlay.style.display = 'none';
    
    // Clear mobile input and sync back
    const headerInput = document.getElementById('query');
    const mobileInput = document.getElementById('globalSearchInputMobile');
    if (headerInput && mobileInput) {
        headerInput.value = mobileInput.value;
    }
    hideSuggestionsBars();
}

let suggestionsBarDebounceTimer = null;
let lastSuggestionsKey = '';
let latestSuggestionsBarReqId = 0;
let suggestionsBarAbortController = null;
let latestStoreSuggestionsReqId = 0;

function getCurrentActiveQuery() {
    const mobileInput = document.getElementById('globalSearchInputMobile');
    const headerInput = document.getElementById('query');
    const raw = (mobileInput && mobileInput === document.activeElement) ? mobileInput.value : (headerInput ? headerInput.value : '');
    return (raw || '').trim();
}

function handleSearchBoxContainerClick(event) {
    const mobInput = document.getElementById('globalSearchInputMobile');
    if (!mobInput) return;
    // 若使用者直接點擊在輸入文字本身 (<input>)，保留瀏覽器原生游標定位
    if (event && event.target === mobInput) return;
    mobInput.focus();
    const len = (mobInput.value || '').length;
    try {
        if (event && event.target && event.target.id === 'searchPrefix') {
            // 點擊左側「🔍 搜尋 "」時，游標移至文字最開頭
            mobInput.setSelectionRange(0, 0);
        } else {
            // 點擊右側「"」或整個輸入框右側空白區域時，游標移至文字最末端
            mobInput.setSelectionRange(len, len);
        }
    } catch (e) {}
}

// --- [輸入法組字與有效文字判定] ---
let isImeComposing = false;
document.addEventListener('compositionstart', () => {
    isImeComposing = true;
});
document.addEventListener('compositionend', (e) => {
    isImeComposing = false;
    if (e && e.target && e.target.id === 'addrInput') {
        if (typeof window.handleAddrInput === 'function') window.handleAddrInput();
    } else if (typeof updateQueryOverlay === 'function') {
        updateQueryOverlay();
    }
});

// 判斷是否為有效完整文字 (最少需包含一個中英文字或數字，且不包含未完成的注音符號)
function isValidSearchQuery(text) {
    if (!text || typeof text !== 'string') return false;
    const str = text.trim();
    if (!str) return false;
    if (isImeComposing) return false;
    
    // 注音符號範圍 (含聲調 ˊˇˋ˙)：若含有任何注音符號，代表使用者尚在拼音選字，不送出請求
    const bopomofoRegex = /[\u3105-\u312f\u31a0-\u31bf\u02ca\u02c7\u02cb\u02d9]/;
    if (bopomofoRegex.test(str)) {
        return false;
    }
    
    // 最少包含一個有效實質文字 (中文漢字、英文字母、數字)
    const validWordRegex = /[\u4e00-\u9fa5a-zA-Z0-9]/;
    if (!validWordRegex.test(str)) {
        return false;
    }
    
    return true;
}

function hideSuggestionsBars() {
    lastSuggestionsKey = '';
    latestSuggestionsBarReqId++;
    if (suggestionsBarAbortController) {
        try { suggestionsBarAbortController.abort(); } catch (e) {}
        suggestionsBarAbortController = null;
    }
    const barMob = document.getElementById('searchSuggestionsBarMobile');
    const barHome = document.getElementById('searchSuggestionsBarHome');
    if (barMob) {
        barMob.innerHTML = '';
        barMob.style.display = 'none';
    }
    if (barHome) {
        barHome.innerHTML = '';
        barHome.style.display = 'none';
    }
}

function selectSuggestionTag(text) {
    selectQueryOverlay(text);
}

function renderSuggestionsBar(items) {
    const barMob = document.getElementById('searchSuggestionsBarMobile');
    const barHome = document.getElementById('searchSuggestionsBarHome');
    if (!items || items.length === 0) {
        hideSuggestionsBars();
        return;
    }
    
    let mobHtml = '';
    let homeHtml = '';
    
    items.forEach(item => {
        const title = item.title || '';
        if (!title) return;
        
        const safeTitleAttr = title.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const safeTitleDisplay = typeof escapeHTML === 'function' ? escapeHTML(title) : title;
        
        mobHtml += `<button type="button" data-title="${safeTitleAttr}" class="suggestion-tag-pill-mob" style="display:inline-flex; align-items:center; background:#f1f5f9; border:1px solid #e2e8f0; color:#334155; font-size:13px; font-weight:600; padding:5px 12px; border-radius:18px; white-space:nowrap; flex-shrink:0; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.05); user-select:none; -webkit-tap-highlight-color:transparent;">${safeTitleDisplay}</button>`;
        
        homeHtml += `<button type="button" data-title="${safeTitleAttr}" class="suggestion-tag-pill-home" style="display:inline-flex; align-items:center; background:#292524; border:1px solid #44403c; color:#f5f5f4; font-size:13px; font-weight:600; padding:5px 12px; border-radius:18px; white-space:nowrap; flex-shrink:0; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.2); user-select:none; -webkit-tap-highlight-color:transparent;">${safeTitleDisplay}</button>`;
    });
    
    if (barMob) {
        barMob.innerHTML = mobHtml;
        barMob.style.display = mobHtml ? 'flex' : 'none';
        barMob.querySelectorAll('.suggestion-tag-pill-mob').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                selectSuggestionTag(btn.getAttribute('data-title'));
            });
        });
    }
    if (barHome) {
        barHome.innerHTML = homeHtml;
        barHome.style.display = homeHtml ? 'flex' : 'none';
        barHome.querySelectorAll('.suggestion-tag-pill-home').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                selectSuggestionTag(btn.getAttribute('data-title'));
            });
        });
    }
}

function fetchSuggestionsBar(query) {
    clearTimeout(suggestionsBarDebounceTimer);
    const q = (query || '').trim();
    if (!q) {
        hideSuggestionsBars();
        return;
    }
    
    // 檢查是否為完整有效文字，若包含注音符號或非完整文字則不發送請求
    if (!isValidSearchQuery(q)) {
        return;
    }
    
    const curVert = typeof currentVertical !== 'undefined' ? currentVertical : 'RESTAURANTS';
    const key = q + '_' + curVert;
    
    suggestionsBarDebounceTimer = setTimeout(async () => {
        if (key === lastSuggestionsKey) return;
        lastSuggestionsKey = key;

        // 取消前一個尚未完成的請求，並核發最新請求序號
        if (suggestionsBarAbortController) {
            try { suggestionsBarAbortController.abort(); } catch (e) {}
        }
        suggestionsBarAbortController = new AbortController();
        const reqId = ++latestSuggestionsBarReqId;
        
        try {
            const apiBase = typeof API_BASE_URL !== 'undefined' && API_BASE_URL ? API_BASE_URL : '';
            const payload = {
                query: q,
                userQuery: q,
                lat: typeof currentLat !== 'undefined' && currentLat ? currentLat : 24.9670998,
                lng: typeof currentLng !== 'undefined' && currentLng ? currentLng : 121.2981634,
                vertical: curVert
            };
            
            const res = await fetch(`${apiBase}/api/getSearchSuggestionsV1`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: suggestionsBarAbortController.signal
            });
            
            // [防覆蓋保護] 若已有更新的請求發出，或輸入框當前文字已不是 q，直接丟棄過時結果
            if (reqId !== latestSuggestionsBarReqId || getCurrentActiveQuery() !== q) {
                return;
            }

            if (!res.ok) {
                console.warn('[Suggestions] API 回應失敗 HTTP', res.status);
                return;
            }
            const resJson = await res.json();

            // [雙重確認] 解析完 JSON 後再次確認是否仍為最新文字
            if (reqId !== latestSuggestionsBarReqId || getCurrentActiveQuery() !== q) {
                return;
            }

            if (resJson.status === 'success' && Array.isArray(resJson.data)) {
                // 1. 關鍵詞：過濾出 keyword，顯示在輸入框上方一排橫列
                const keywordItems = resJson.data.filter(it => it.type === 'keyword');
                if (keywordItems.length > 0) {
                    renderSuggestionsBar(keywordItems);
                }
                // [注意] 若成功取得 0 筆建議 (完全空的建議)，完全不顯示套用在畫面上，也不取代或清空已出現的建議
                
                // 2. 店家：過濾出 store，顯示在關聯餐廳/店家列表中 (先出現，等待 search_v3 覆蓋)
                // 2. 店家：【暫時禁止搜尋方式一讀取店家資訊避免誤觸】
                // 因 getSearchSuggestionsV1 缺乏營業時段與預約狀態，避免誤觸或造成預約錯誤，目前只讀取文字關鍵詞(keyword)，不讀取店家資訊(storeItems)，保留後續修改空間
                const ENABLE_SUGGESTION_STORE_ITEMS = false;
                const storeItems = ENABLE_SUGGESTION_STORE_ITEMS ? resJson.data.filter(it => it.type === 'store') : [];
                if (storeItems.length > 0) {
                    // 僅當目前這個關鍵字 q 與時段尚未被 search_v4 覆蓋完成時，才展示快速預選店家
                    const curSKey = (typeof getCurrentSearchScheduleKey === 'function') ? getCurrentSearchScheduleKey() : '';
                    if (!((window.suggestionStoreSource === 'search_v4_overlay' || window.suggestionStoreSource === 'search_v4_full') && window.suggestionStoreQuery === q && window.suggestionScheduleKey === curSKey)) {
                        window.suggestionStores = storeItems.map(s => ({
                            title: { text: s.title },
                            storeUuid: s.uuid,
                            heroImageUrl: s.heroImageUrl || '',
                            actionUrl: s.actionUrl || '',
                            category: s.category || '',
                            isSuggestionStore: true
                        }));
                        window.suggestionStoreSource = 'quick_suggestions';
                        window.suggestionStoreQuery = q;
                        renderOverlayHTML();
                    }
                }
            }
            // 若 API 取得 0 筆或失敗，不呼叫 hideSuggestionsBars()，保留畫面上現有的建議
        } catch (e) {
            if (e && e.name === 'AbortError') return;
            console.error('fetchSuggestionsBar error:', e);
        }
    }, 180);
}

function updateQueryOverlay() {
    const headerInput = document.getElementById('query');
    const mobileInput = document.getElementById('globalSearchInputMobile');
    
    // Sync both inputs
    const keyword = (mobileInput && mobileInput === document.activeElement ? mobileInput.value : (headerInput ? headerInput.value : ''));
    if (headerInput) headerInput.value = keyword;
    if (mobileInput) mobileInput.value = keyword;
    
    const val = keyword.trim();
    
    const prevVal = window._lastOverlayInputValue || '';
    window._lastOverlayInputValue = val;
    
    // Immediate feedback in UI (shows typed text)
    renderOverlayHTML();
    
    if (!val) {
        hideSuggestionsBars();
        return;
    }
    
    const hasValidQuery = isValidSearchQuery(val);
    
    // 即時取得 Suggestions API 建議詞 (僅在非注音且為有效文字時送出)
    if (hasValidQuery) {
        fetchSuggestionsBar(val);
    }
    
    // Clear previous debounce timer
    clearTimeout(queryDebounceTimer);
    
    // Only fetch if value is a valid complete query and has changed (or vertical/schedule changed)
    const currentVert = typeof currentVertical !== 'undefined' ? currentVertical : 'RESTAURANTS';
    const currentSchedKey = (typeof getCurrentSearchScheduleKey === 'function') ? getCurrentSearchScheduleKey() : '';
    const scheduleChangedForQuery = (window.suggestionStoreQuery !== val || window.suggestionScheduleKey !== currentSchedKey);
    if (hasValidQuery && (val !== lastSearchedQuery || currentVert !== (typeof lastSearchedVertical !== 'undefined' ? lastSearchedVertical : '') || scheduleChangedForQuery)) {
        const diff = Math.abs(val.length - prevVal.length);
        const delay = diff > 2 ? 0 : 500;
        
        queryDebounceTimer = setTimeout(() => {
            if (typeof isFetchingSuggestions !== 'undefined' && isFetchingSuggestions) {
                pendingSuggestionQuery = val;
            } else if (window._searchLock) {
                pendingSuggestionQuery = val;
            } else {
                lastSearchedQuery = val;
                if (typeof lastSearchedVertical !== 'undefined') lastSearchedVertical = currentVert;
                fetchStoreSuggestions(val);
            }
        }, delay);
    }
}

async function fetchStoreSuggestions(q) {
    if (!q || !currentLat || !currentLng) return;

    if (typeof isAddressSet !== 'undefined' && !isAddressSet) {
        if (typeof lastSearchedQuery !== 'undefined') lastSearchedQuery = '';
        if (typeof renderOverlayHTML === 'function') renderOverlayHTML();
        return;
    }

    const timeSelectGuard = document.getElementById('scheduleTime');
    const waitingDeliveryTimes = (typeof isDeliveryTimesLoading !== 'undefined' && isDeliveryTimesLoading)
        || (typeof scheduleMode !== 'undefined' && scheduleMode === 'SCHEDULE' && (!timeSelectGuard || !timeSelectGuard.value));
    if (waitingDeliveryTimes) {
        if (typeof lastSearchedQuery !== 'undefined') lastSearchedQuery = '';
        if (!window._overlayPendingDeliveryTimesWait) {
            window._overlayPendingDeliveryTimesWait = true;
            const prevCb = window.onDeliveryTimesLoadedCallback;
            window.onDeliveryTimesLoadedCallback = () => {
                window._overlayPendingDeliveryTimesWait = false;
                if (typeof prevCb === 'function') {
                    try { prevCb(); } catch (e) {}
                }
                const overlayEl = document.getElementById('globalSearchOverlay');
                if (overlayEl && overlayEl.style.display !== 'none' && typeof updateQueryOverlay === 'function') {
                    updateQueryOverlay();
                }
            };
        }
        if (typeof renderOverlayHTML === 'function') renderOverlayHTML();
        return;
    }

    const reqScheduleKey = (typeof getCurrentSearchScheduleKey === 'function') ? getCurrentSearchScheduleKey() : '';
    isFetchingSuggestions = true;
    const reqId = ++latestStoreSuggestionsReqId;

    try {
        const searchPayload = {
            query: q,
            lat: currentLat,
            lng: currentLng,
            vertical: typeof currentVertical !== 'undefined' ? currentVertical : 'RESTAURANTS',
            searchSource: 'SEARCH_SUGGESTION',
            searchType: 'GLOBAL_SEARCH'
        };
        if (typeof scheduleMode !== 'undefined') {
            if (scheduleMode === 'ASAP') {
                searchPayload.date = "";
                searchPayload.startTime = 0;
                searchPayload.endTime = 0;
            } else if (scheduleMode === 'SCHEDULE') {
                const timeSelect = document.getElementById('scheduleTime');
                if (timeSelect && timeSelect.value) {
                    try {
                        const sData = JSON.parse(timeSelect.value);
                        searchPayload.date = sData.date;
                        searchPayload.startTime = sData.startTime;
                        searchPayload.endTime = sData.endTime;
                    } catch (e) {}
                }
            }
        }

        const apiBase = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) ? API_BASE_URL : '';

        const res = await fetch(`${apiBase}/api/search_v4`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(searchPayload)
        });

        if (!res.ok) throw new Error('Network response was not ok');
        const textRes = await res.text();
        const json = JSON.parse(textRes);

        // [防覆蓋保護] 若回應回來時，關鍵字或預約時段已變更，直接捨棄過時結果
        const currentActiveQ = getCurrentActiveQuery();
        const nowSchedKey = (typeof getCurrentSearchScheduleKey === 'function') ? getCurrentSearchScheduleKey() : '';
        if (reqId !== latestStoreSuggestionsReqId || (currentActiveQ && currentActiveQ !== q) || (reqScheduleKey && nowSchedKey && nowSchedKey !== reqScheduleKey)) {
            return;
        }

        if (json && json.status !== 'failure' && json.data) {
            let stores = [];
            (json.data.feedItems || []).forEach(item => {
                if ((item.type === 'REGULAR_STORE' || item.type === 'REGULAR_STORE_WITH_ITEMS') && item.store) {
                    stores.push(item.store);
                } else if ((item.type === 'REGULAR_CAROUSEL' || item.type === 'STORE_CAROUSEL') && item.carousel && item.carousel.stores) {
                    stores.push(...item.carousel.stores);
                } else if (item.type === 'MINI_STORE_WITH_ITEMS' && item.miniStoreWithItems && item.miniStoreWithItems.store) {
                    stores.push(item.miniStoreWithItems.store);
                }
            });

            const seen = new Set();
            stores = stores.filter(s => {
                if (seen.has(s.storeUuid)) return false;
                seen.add(s.storeUuid);
                return true;
            });
            // 過濾掉自取(無法外送)的店家
            stores = stores.filter(s => {
                if (s.imageOverlayCallToAction && s.imageOverlayCallToAction.text && s.imageOverlayCallToAction.text.includes('自取')) return false;
                if (s.storeAvailablityState === 'TOO_FAR_TO_DELIVER') return false;
                if (s.tracking && s.tracking.storePayload && s.tracking.storePayload.storeAvailablityState === 'TOO_FAR_TO_DELIVER') return false;
                return true;
            });

            const hasFirstResults = (
                window.suggestionStoreQuery === q &&
                window.suggestionStores &&
                window.suggestionStores.length > 0 &&
                window.suggestionScheduleKey === reqScheduleKey &&
                window.suggestionStoreSource !== 'quick_suggestions'
            );
            if (stores.length > 0) {
                window.suggestionStores = stores;
                window.suggestionStoreSource = 'search_v4_overlay';
                window.suggestionStoreQuery = q;
                window.suggestionScheduleKey = reqScheduleKey;
            } else if (hasFirstResults) {
                stores = window.suggestionStores;
            } else {
                window.suggestionStores = [];
                window.suggestionStoreSource = 'search_v4_overlay_empty';
                window.suggestionStoreQuery = q;
                window.suggestionScheduleKey = reqScheduleKey;
            }
            const resultsEl = document.getElementById('results');
            // ⭐【關鍵防護】：若使用者已經點擊完整搜尋進入列表 (currentView === 'list')，絕不允許被背景打字預查覆蓋！
            if (resultsEl && currentView !== 'list') {
                resultsEl.innerHTML = generateStoreListHTML(stores, q, typeof currentVertical !== 'undefined' ? currentVertical : 'RESTAURANTS');
            }

            // [全聯預約自動轉即時補全] 針對生鮮雜貨包含「全聯」關鍵字 (排除「大全聯」)
            const vertCheck = typeof currentVertical !== 'undefined' ? currentVertical : 'RESTAURANTS';
            if (vertCheck === 'SHOP' && q.includes('全聯') && !q.includes('大全聯') && typeof scheduleMode !== 'undefined' && scheduleMode === 'SCHEDULE') {
                const hasPxmart = stores.some(s => {
                    const name = (s.title && s.title.text) ? s.title.text : (typeof s.title === 'string' ? s.title : '');
                    return isPxmartName(name);
                });
                if (!hasPxmart) {
                    fetchPxmartAsapStores(q).then(pxStores => {
                        if (reqId !== latestStoreSuggestionsReqId || getCurrentActiveQuery() !== q) return;
                        if (pxStores && pxStores.length > 0) {
                            const existingUuids = new Set(stores.map(s => s.storeUuid));
                            const newPx = pxStores.filter(ps => !existingUuids.has(ps.storeUuid));
                            if (newPx.length > 0) {
                                stores.push(...newPx);
                                window.suggestionStores = stores;
                                if (resultsEl && currentView !== 'list') {
                                    resultsEl.innerHTML = generateStoreListHTML(stores, q, vertCheck);
                                }
                                if (typeof renderOverlayHTML === 'function') {
                                    renderOverlayHTML();
                                }
                            }
                        }
                    });
                }
            }
        }
    } catch (e) {
        console.error('Fetch store suggestions error:', e);
    } finally {
        isFetchingSuggestions = false;

        const latestInputQ = getCurrentActiveQuery();
        const nextTargetQ = pendingSuggestionQuery || (latestInputQ && isValidSearchQuery(latestInputQ) && latestInputQ !== lastSearchedQuery ? latestInputQ : "");
        if (nextTargetQ && nextTargetQ !== q && !window._searchLock) {
            pendingSuggestionQuery = "";
            lastSearchedQuery = nextTargetQ;
            fetchStoreSuggestions(nextTargetQ);
        } else if (getCurrentActiveQuery() === q) {
            if (typeof renderOverlayHTML === 'function') renderOverlayHTML();
        }
    }
}

function openStoreFromOverlay(uuid, encodedName, actionUrl) {
    // [方案 A 保險機制] 嚴禁由首頁預選直接跳轉 openStore，一律改以店名送出完整搜尋進入清單檢查
    let name = '';
    try { name = decodeURIComponent(encodedName || ''); } catch (e) { name = encodedName || ''; }
    selectQueryOverlay(name);
}

function renderOverlayHTML() {
    const input = document.getElementById('query');
    const resultsTop = document.getElementById('globalSearchResults');
    if(!input || !resultsTop) return;
    
    const val = input.value.trim();
    const valLower = val.toLowerCase();
    
    const defaultText = (typeof currentVertical !== 'undefined' && currentVertical === 'SHOP') ? '尋找生鮮' : '尋找食物';
    
    const searchBtn = document.getElementById('searchMainBtn');
    if (searchBtn) {
        if (val) {
            searchBtn.style.background = '#f43f5e';
            searchBtn.style.color = '#fff';
        } else {
            searchBtn.style.background = '';
            searchBtn.style.color = '';
        }
        searchBtn.innerText = defaultText;
    }
    
    const searchBtnMob = document.getElementById('searchMainBtnMobile');
    if (searchBtnMob) {
        if (val) {
            searchBtnMob.style.background = '#f43f5e';
            searchBtnMob.style.color = '#000';
        } else {
            searchBtnMob.style.background = '#f43f5e';
            searchBtnMob.style.color = '#000';
        }
        searchBtnMob.innerText = defaultText;
    }
    
    // Toggle input field styling
    const mobInput = document.getElementById('globalSearchInputMobile');
    const searchPrefix = document.getElementById('searchPrefix');
    const searchSuffix = document.getElementById('searchSuffix');
    const searchGhost = document.getElementById('searchGhost');
    if (mobInput) {
        if (val) {
            if (searchPrefix) searchPrefix.style.display = 'inline';
            if (searchSuffix) searchSuffix.style.display = 'inline';
            mobInput.style.color = '#f43f5e';
            mobInput.style.fontWeight = 'bold';
            if (searchGhost) {
                // 測量實際打字內容的寬度 (保留空白字元)
                searchGhost.textContent = mobInput.value;
                mobInput.style.flex = 'none';
                // 加上 2px 的緩衝以容納游標
                mobInput.style.width = (searchGhost.offsetWidth + 2) + 'px';
                mobInput.style.maxWidth = '100%';
            }
        } else {
            if (searchPrefix) searchPrefix.style.display = 'none';
            if (searchSuffix) searchSuffix.style.display = 'none';
            mobInput.style.color = '';
            mobInput.style.fontWeight = '';
            mobInput.style.flex = '1';
            mobInput.style.width = 'auto';
        }
    }
    
    let history = [];
    try {
        history = JSON.parse(localStorage.getItem('finddog_history_query') || '[]');
    } catch(e){}

    let html = '';
    if (!valLower) {
        window.suggestionStores = [];
        window.suggestionStoreQuery = '';
        window.suggestionStoreSource = '';
        window.suggestionScheduleKey = '';
        hideSuggestionsBars();
        if (history.length > 0) {
            html += '<div style="font-size:14px; color:#999; margin-bottom:10px; font-weight:bold;">歷史搜尋</div>';
            history.forEach(h => {
                const encodedH = encodeURIComponent(h).replace(/'/g, "%27");
                html += `<div onclick="selectQueryOverlay(decodeURIComponent('${encodedH}'))" style="padding:12px 0; border-bottom:1px solid #f0f0f0; cursor:pointer; font-size:15px; color:#333; display:flex; align-items:center; gap:8px;"><span style="color:#999;">🕒</span> ${escapeHTML(h)}</div>`;
            });
            html += `<div onclick="clearQueryOverlayHistory()" style="padding:15px 0; cursor:pointer; font-size:13px; color:#d32f2f; text-align:center;">清除歷史紀錄</div>`;
        } else {
            html += '<div style="font-size:14px; color:#999; text-align:center; margin-top:30px;">輸入關鍵字開始搜尋</div>';
        }
    } else if (typeof isAddressSet !== 'undefined' && !isAddressSet) {
        html += `<div style="text-align:center; padding:40px 16px; color:#d97706; font-size:14px; font-weight:bold;">📍 請先選擇或確認外送地址，系統將依地址與時段檢索可接單店家</div>`;
        html += `<div onclick="selectQueryOverlay(decodeURIComponent('${encodeURIComponent(val).replace(/'/g, "%27")}'))" style="margin:8px auto 0 auto; max-width:260px; padding:11px 16px; background:#f43f5e; color:#fff; border-radius:10px; font-weight:bold; font-size:14px; text-align:center; cursor:pointer;">🔍 仍以「${escapeHTML(val)}」送出搜尋</div>`;
    } else if (
        (typeof isDeliveryTimesLoading !== 'undefined' && isDeliveryTimesLoading) ||
        (typeof scheduleMode !== 'undefined' && scheduleMode === 'SCHEDULE' && (!document.getElementById('scheduleTime') || !document.getElementById('scheduleTime').value))
    ) {
        html += '<div style="text-align:center; padding:80px 0; display:flex; flex-direction:column; align-items:center; justify-content:center;"><div class="spinner" style="margin: 0 auto;"></div><div style="margin-top: 15px; color:#999; font-size:15px; font-weight:bold;">正在載入配送時段資訊...</div></div>';
    } else {
        let isCompressed = false;
        if (window.visualViewport && window.visualViewport.height < window.innerHeight * 0.8) {
            isCompressed = true;
        }

        const currentVert = typeof currentVertical !== 'undefined' ? currentVertical : 'RESTAURANTS';
        const currentSchedKey = (typeof getCurrentSearchScheduleKey === 'function') ? getCurrentSearchScheduleKey() : '';
        const hasStoresForQuery = window.suggestionStores && window.suggestionStores.length > 0 && window.suggestionStoreQuery === val && window.suggestionScheduleKey === currentSchedKey;

        if (hasStoresForQuery) {
            let unSchedulableStores = [];
            try { unSchedulableStores = JSON.parse(localStorage.getItem('unSchedulableStores') || '[]'); } catch (e) {}

            if (!isCompressed) {
                html += '<div style="font-size:14px; color:#999; margin:15px 0 10px 0; font-weight:bold; display:flex; justify-content:space-between; align-items:center;">';
                html += '<span>相關搜尋建議 (點擊送出完整搜尋)</span>';
                if (typeof isFetchingSuggestions !== 'undefined' && isFetchingSuggestions) {
                    html += '<span style="font-size:11px; color:#aaa; font-weight:normal;">載入中...</span>';
                }
                html += '</div>';
            } else {
                html += '<div style="height:10px;"></div>';
            }

            window.suggestionStores.slice(0, 10).forEach(s => {
                const parsed = (typeof parseStoreListCardState === 'function') ? parseStoreListCardState(s, unSchedulableStores, currentVert) : null;
                const rawName = parsed ? parsed.rawName : (s.title && s.title.text ? s.title.text : (typeof s.title === 'string' ? s.title : ''));
                if (!rawName || rawName === '未知餐廳') return;
                const displayName = parsed ? parsed.name : rawName;
                const encodedRawName = encodeURIComponent(rawName).replace(/'/g, "%27");

                const imageUrl = parsed ? parsed.imgUrl : ((s.image && s.image.items && s.image.items.length > 0) ? getUberWebpUrl(s.image.items[0].url) : (s.heroImageUrl || ''));
                const rating = parsed ? parsed.rating : (s.rating ? s.rating.text : '無評價');
                const ratingHtml = (rating && rating !== '無評價')
                    ? `<div style="font-size:12px; color:#666; background:#eee; padding:2px 6px; border-radius:10px; margin-top:4px; display:inline-block;">★ ${escapeHTML(rating)}</div>`
                    : '';

                const isBad = parsed ? parsed.isBad : false;
                const isClosed = parsed ? parsed.isClosed : false;
                const metaText = parsed ? parsed.metaText : '';

                let statusBadgesHtml = '';
                if (isBad) {
                    if (typeof scheduleMode !== 'undefined' && scheduleMode === 'ASAP') {
                        statusBadgesHtml += `<span style="font-size:11px; background:#fef3c7; color:#b45309; padding:2px 6px; border-radius:6px; font-weight:bold; margin-right:6px;">⚠️ 無法預約（即時可試）</span>`;
                    } else {
                        statusBadgesHtml += `<span style="font-size:11px; background:#fee2e2; color:#b91c1c; padding:2px 6px; border-radius:6px; font-weight:bold; margin-right:6px;">🚫 無法預約 / 無法接單</span>`;
                    }
                } else if (isClosed) {
                    const closedNotice = (metaText && (metaText.includes('營業') || metaText.includes('預約'))) ? metaText : '休息中可預約';
                    statusBadgesHtml += `<span style="font-size:11px; background:#f1f5f9; color:#475569; padding:2px 6px; border-radius:6px; font-weight:bold; margin-right:6px;">🕒 ${escapeHTML(closedNotice)}</span>`;
                }

                let timeText = '';
                let deliveryFeeText = '';
                if (s.tracking && s.tracking.storePayload) {
                    const sp = s.tracking.storePayload;
                    if (sp.deliveryTimeETA) timeText = sp.deliveryTimeETA + ' 分鐘';
                    if (sp.deliveryFeeFormatted) deliveryFeeText = sp.deliveryFeeFormatted + ' 外送費';
                }
                const fallbackMeta = metaText || [timeText, deliveryFeeText].filter(Boolean).join(' • ');
                let subLineHtml = '';
                if (statusBadgesHtml || fallbackMeta) {
                    subLineHtml = `<div style="font-size:12px; color:#666; margin-top:2px; display:flex; flex-wrap:wrap; align-items:center; gap:2px;">${statusBadgesHtml}${fallbackMeta ? `<span>${escapeHTML(fallbackMeta)}</span>` : ''}</div>`;
                } else if (s.category) {
                    subLineHtml = `<div style="font-size:12px; color:#888; margin-top:2px;">${escapeHTML(s.category)}</div>`;
                }

                // 【方案 A 核心】所有預選項點擊一律以純店名送出完整搜尋，不直接跳轉開單，確保進入列表與雙重預約阻擋機制
                const storeClickAction = `selectQueryOverlay(decodeURIComponent('${encodedRawName}'))`;
                const rowFade = (isBad || isClosed) ? 'opacity:0.75;' : '';
                const imgFilter = (isBad || isClosed) ? 'filter:grayscale(100%);' : '';

                html += `
                <div onclick="${storeClickAction}" style="display:flex; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid #f0f0f0; cursor:pointer; ${rowFade}">
                    ${imageUrl ? `<img src="${imageUrl}" style="width:50px; height:50px; border-radius:8px; object-fit:cover; background:#eee; flex-shrink:0; ${imgFilter}">` : `<div style="width:50px; height:50px; border-radius:8px; background:#eee; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:20px;">🏪</div>`}
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:15px; font-weight:bold; color:#111; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(displayName)}</div>
                        ${subLineHtml}
                        ${ratingHtml}
                    </div>
                    <div style="font-size:12px; color:#f43f5e; font-weight:bold; white-space:nowrap; flex-shrink:0;">搜尋 ›</div>
                </div>`;
            });
        } else if (isValidSearchQuery(val) && (val !== (typeof lastSearchedQuery !== 'undefined' ? lastSearchedQuery : '') || currentVert !== (typeof lastSearchedVertical !== 'undefined' ? lastSearchedVertical : '') || window.suggestionStoreQuery !== val || window.suggestionScheduleKey !== currentSchedKey || (typeof isFetchingSuggestions !== 'undefined' && isFetchingSuggestions))) {
            if (!isCompressed) {
                html += '<div style="font-size:14px; color:#999; margin:15px 0 10px 0; font-weight:bold;">相關搜尋建議</div>';
            } else {
                html += '<div style="height:10px;"></div>';
            }
            html += '<div style="text-align:center; padding:100px 0; display:flex; flex-direction:column; align-items:center; justify-content:center;"><div class="spinner" style="margin: 0 auto;"></div><div style="margin-top: 15px; color:#999; font-size:16px; font-weight:bold;">搜尋中...</div></div>';
        } else {
            // Searched but no results
            html += `<div style="text-align:center; padding:40px 0; color:#999; font-size:14px;">找不到與 "${escapeHTML(val)}" 相關的店家</div>`;
        }
    }
    resultsTop.innerHTML = html;
    resultsTop.scrollTop = 0;
}

function selectQueryOverlay(text) {
    let cleanText = (text || '').trim();
    const qInput = document.getElementById('query');
    if (qInput) qInput.value = cleanText;
    const mobileInput = document.getElementById('globalSearchInputMobile');
    if (mobileInput) mobileInput.value = cleanText;

    // 中斷背景預查防抖計時器與舊回應，並清除快取強制送出完整搜尋
    if (typeof queryDebounceTimer !== 'undefined') clearTimeout(queryDebounceTimer);
    if (typeof latestStoreSuggestionsReqId !== 'undefined') latestStoreSuggestionsReqId++;
    if (typeof pendingSuggestionQuery !== 'undefined') pendingSuggestionQuery = '';
    if (typeof lastSearchedQuery !== 'undefined') lastSearchedQuery = '';
    if (typeof lastSearchedVertical !== 'undefined') lastSearchedVertical = '';
    window.suggestionStores = [];
    window.suggestionStoreSource = '';
    window.suggestionStoreQuery = '';
    window.suggestionScheduleKey = '';
    window._lastOverlayInputValue = cleanText;

    if (typeof hideSuggestionsBars === 'function') hideSuggestionsBars();
    if (typeof closeQueryOverlay === 'function') closeQueryOverlay();

    if (window.isDiscountZone && typeof window.searchStoresPickup === 'function') {
        window.searchStoresPickup(cleanText);
    } else if (typeof window.searchStores === 'function') {
        window.searchStores();
    } else if (typeof searchStores === 'function') {
        searchStores();
    }
}

function clearQueryOverlayHistory() {
    localStorage.removeItem('finddog_history_query');
    renderOverlayHTML();
}

// 修復手機鍵盤彈出時，fixed 容器超過螢幕邊界的問題
if (window.visualViewport) {
    const adjustSearchOverlays = () => {
        const vv = window.visualViewport;
        const h = vv.height + 'px';
        // 使用 Math.max 確保在某些捲動邊緣情況下不會變成負值或偏移太多
        const t = Math.max(0, vv.offsetTop) + 'px';
        
        const globalOverlay = document.getElementById('globalSearchOverlay');
        if (globalOverlay && globalOverlay.style.display !== 'none') {
            globalOverlay.style.height = h;
            globalOverlay.style.top = t;
            // 確保捲動到底部
            const gResults = document.getElementById('globalSearchResults');
            if(gResults) gResults.scrollTop = 0;
        }
        
        const storeOverlay = document.getElementById('storeSearchOverlay');
        if (storeOverlay && storeOverlay.style.display !== 'none') {
            storeOverlay.style.height = h;
            storeOverlay.style.top = t;
        }
    };
    
    window.visualViewport.addEventListener('resize', adjustSearchOverlays);
    window.visualViewport.addEventListener('scroll', adjustSearchOverlays);
    
    const originalOpenQuery = typeof openQueryOverlay !== 'undefined' ? openQueryOverlay : function(){};
    window.openQueryOverlay = function() {
        originalOpenQuery.apply(this, arguments);
        setTimeout(adjustSearchOverlays, 50);
        setTimeout(adjustSearchOverlays, 300); // 鍵盤動畫可能需要時間
    };
    
    const originalToggleStore = typeof toggleStoreSearch !== 'undefined' ? toggleStoreSearch : function(){};
    window.toggleStoreSearch = function() {
        originalToggleStore.apply(this, arguments);
        setTimeout(adjustSearchOverlays, 50);
        setTimeout(adjustSearchOverlays, 300);
    };
}


let offlineCheckInterval = null;
async function loadServerStatusDot() {
    try {
        const apiBase = typeof API_BASE_URL !== 'undefined' && API_BASE_URL ? API_BASE_URL : '';
        if (!apiBase) return;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); 
        
        const response = await fetch(apiBase + '/api/status', { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error('API Error');
        
        const data = await response.json();
        const prevType = window.lastServerStoreStatus ? window.lastServerStoreStatus.type : null;
        window.lastServerStoreStatus = data;
        updateStatusDot(data.type);
        if (prevType && prevType !== data.type) {
            const cv = document.getElementById('checkoutView');
            if (cv && cv.style.display !== 'none' && !window.isGroceryStore && typeof openCheckoutSummary === 'function') {
                if (typeof isPlan300Eligible === 'function' && window.currentSelectedPlan === '300' && !isPlan300Eligible()) {
                    window.currentSelectedPlan = '150';
                    openCheckoutSummary();
                }
            }
        }
        
        // 🌟 判斷伺服器營業狀態是否為「休息中(無法接單)」(由 LINE 控制：type === 'closed' 或文字包含「無法接單」)
        const isClosed = data.type === 'closed' || (data.text && data.text.includes('無法接單'));
        if (isClosed) {
            if (!isClosedStatusBypassed()) {
                showModal('目前暫時無法接單', '', false, '', true);
                if (!offlineCheckInterval) {
                    offlineCheckInterval = setInterval(loadServerStatusDot, 15000);
                }
                return;
            } else {
                // 已被使用者以密碼 5318 解鎖，若畫面上正好有無法接單彈窗則自動隱藏
                const overlay = document.getElementById('errorModalOverlay');
                const modalTitle = document.getElementById('errorModalTitle')?.innerText || '';
                if (overlay && overlay.style.display !== 'none' && (modalTitle === '目前暫時無法接單' || modalTitle === '代訂睡覺中')) {
                    overlay.style.display = 'none';
                }
            }
        }

        // 伺服器狀態正常 (非 closed 且非 offline)，若目前正開啟睡覺或無法接單彈窗，則自動關閉解除鎖定
        const overlay = document.getElementById('errorModalOverlay');
        const modalTitle = document.getElementById('errorModalTitle')?.innerText || '';
        if (overlay && overlay.style.display !== 'none' && (modalTitle === '代訂睡覺中' || modalTitle === '目前暫時無法接單')) {
            overlay.style.display = 'none';
        }

        if (offlineCheckInterval) {
            clearInterval(offlineCheckInterval);
            offlineCheckInterval = null;
        }
    } catch (err) {
        console.error("Status check error", err);
        window.lastServerStoreStatus = { type: 'offline', text: '連線失敗' };
        updateStatusDot('offline');
        
        if (!offlineCheckInterval) {
            showModal('代訂睡覺中', '等睡醒就會恢復正常', false, '', true);
            offlineCheckInterval = setInterval(loadServerStatusDot, 15000);
        }
    }
}

function updateStatusDot(type) {
    const dot = document.getElementById('serverStatusDot');
    if (!dot) return;
    
    let color = '#10b981'; 
    if(type === 'closed') color = '#d81b43'; 
    else if(type === 'preorder') color = '#d68910'; 
    else if(type === 'busy') color = '#2980b9'; 
    else if(type === 'connecting') color = '#ddd'; 
    else if(type === 'offline') color = '#000000'; 
    
    dot.style.backgroundColor = color;
    dot.title = "系統狀態: " + type;
}
