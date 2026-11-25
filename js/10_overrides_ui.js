// ==========================================
// MASTER OVERRIDE: ADDRESS VALIDATION & HERO BANNER
// ==========================================

// 1. Address Format Checker (Disabled — rely 100% on Uber candidate mechanism)
window.checkAddressFormat = function(q) {
    if (!q) return { valid: false, reason: 'empty' };
    return { valid: true };
};

// 2. Visual State for Address Input Card (Red light / Green light)
window.updateAddrTitleState = function(state) {
    const card = document.getElementById('addrSection') || document.querySelector('.addr-time-card');
    if (!card) return;
    if (state === 'error') {
        card.style.borderColor = '#ef4444';
        card.style.backgroundColor = '#fff5f5';
        card.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.25)';
    } else if (state === 'ok') {
        // 原本綠色樣式 (需要時可取消註解改回):
        // card.style.borderColor = '#22c55e';
        // card.style.backgroundColor = '#f0fdf4';
        // card.style.boxShadow = '0 0 0 3px rgba(34, 197, 94, 0.15)';
        card.style.borderColor = 'transparent';
        card.style.backgroundColor = '#fff';
        card.style.boxShadow = '0 2px 10px rgba(0,0,0,0.04)';
    } else {
        card.style.borderColor = 'transparent';
        card.style.backgroundColor = '#fff';
        card.style.boxShadow = '0 2px 10px rgba(0,0,0,0.04)';
    }
};

// 3. Hero Banner Toggle & Logo2 Push Down Animation
window.revealSubSections = function() {
    const sub = document.getElementById('subSections');
    if (sub) {
        sub.style.display = 'block';
        setTimeout(() => { sub.style.opacity = '1'; }, 50);
    }
    
    const heroBtns = document.getElementById('heroActionButtons');
    if (heroBtns && heroBtns.style.display !== 'none') {
        heroBtns.style.opacity = '0';
        setTimeout(() => { heroBtns.style.display = 'none'; }, 300);
    }
    
    const heroBanner = document.getElementById('heroBanner');
    if (heroBanner && !heroBanner.classList.contains('shrunk')) {
        heroBanner.classList.add('shrunk');
        Array.from(heroBanner.children).forEach(child => {
            if (child.tagName !== 'IMG' && child.id !== 'heroBackBtn' && !child.hasAttribute('data-keep')) {
                child.style.transition = 'opacity 0.3s ease';
                child.style.opacity = '0';
                child.style.pointerEvents = 'none';
                setTimeout(() => { child.dataset.oldDisplay = child.style.display; child.style.display = 'none'; }, 300);
            }
        });
        heroBanner.style.transition = 'padding 0.3s ease';
        heroBanner.style.paddingTop = '10px';
        heroBanner.style.paddingBottom = '60px'; 
    }
    
    // Hide logo2 by pushing it down out of view
    const logo = document.getElementById('heroLogoImage');
    if (logo) {
        logo.style.transition = 'top 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        logo.style.top = '150px';
        logo.style.opacity = '0';
        logo.style.transform = 'translateX(-50%) translateY(40px)';
    }
};

// 4. Restore Hero Banner & Logo2 Slide Up Animation
window.restoreHeroBanner = function() {
    const addrInput = document.getElementById('addrInput');
    if (!isAddressSet && addrInput && addrInput.value.trim() === '') {
        const heroBtns = document.getElementById('heroActionButtons');
        if (heroBtns) { heroBtns.style.display = 'flex'; setTimeout(() => { heroBtns.style.opacity = '1'; }, 50); }
        
        const heroBanner = document.getElementById('heroBanner');
        if (heroBanner && heroBanner.classList.contains('shrunk')) {
            heroBanner.classList.remove('shrunk');
            heroBanner.style.paddingTop = '40px';
            heroBanner.style.paddingBottom = '80px';
            
            Array.from(heroBanner.children).forEach(child => {
                if (child.tagName !== 'IMG' && child.id !== 'heroBackBtn' && !child.hasAttribute('data-keep')) {
                    child.style.display = child.dataset.oldDisplay || 'block';
                    if (child.style.display === 'flex' || child.style.display === 'block' || child.style.display === '') {
                        setTimeout(() => { child.style.opacity = '1'; child.style.pointerEvents = 'auto'; }, 50);
                    }
                }
            });
        }
        
        // Restore logo2 by sliding it back up
        const logo = document.getElementById('heroLogoImage');
        if (logo) {
            logo.style.transition = 'top 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease, transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
            logo.style.top = '0px';
            logo.style.opacity = '1.0';
            logo.style.transform = 'translateX(-50%) translateY(0)';
        }
        
        const sub = document.getElementById('subSections');
        if (sub) {
            sub.style.opacity = '0';
            setTimeout(() => { sub.style.display = 'none'; }, 300);
        }
        
        const resEl = document.getElementById('addrResults');
        if (resEl) resEl.innerHTML = '';
        const stEl = document.getElementById('addrStatus');
        if (stEl) stEl.innerText = '';
        updateAddrTitleState('default');
    }
};

// 5. Input Event Handlers & Uber mapsSearchV1 + getDeliveryLocationV2 Candidate Mechanism
window.addrSuggestDebounceTimer = null;
window.addrSuggestAbortController = null;
window.latestAddrSuggestReqId = 0;
window.latestAddrCandidates = [];
window.latestAddrQuery = '';

// 將輸入地址拆分為「送給 Uber 搜尋的門牌基準地址 (searchQuery)」與「後方樓層/備註尾綴 (extraSuffix)」
// 例外保護：完整保留「17-8」、「17號之8」、「17號-8」等門牌附號，不會誤切
window.splitAddressForUber = function(rawAddr) {
    const clean = (rawAddr || '').replace(/^📍\s*/, '').trim();
    if (!clean) return { searchQuery: '', extraSuffix: '' };

    // 1. 擷取到「號」（含「17-8號」、「17號之8」、「17號-8」），將後方的「8樓」、「B1」等拆為 extraSuffix
    const mDoor = clean.match(/^(.*?\d+(?:\s*[-－之]\s*\d+)*\s*號(?:\s*(?:之|[-－])\s*\d+(?![\d]*[樓Ff])\s*號?)?)(.*)$/);
    if (mDoor) {
        const searchQuery = mDoor[1].trim();
        let extraSuffix = (mDoor[2] || '').replace(/^[,，\s]+/, '').trim();
        if (extraSuffix === '之' || extraSuffix === '-' || extraSuffix === '－') {
            extraSuffix = '';
        }
        return { searchQuery, extraSuffix };
    }

    // 2. 若未輸入「號」字但有門牌附號加樓層（例如「公園路17-8 8樓」），保留「17-8」並拆出後方樓層
    const mNoHao = clean.match(/^(.*?\d+\s*[-－之]\s*\d+)(\s+\d+\s*[樓Ff].*|\s*[一二三四五六七八九十]+\s*樓.*|\s+[Bb]\d+.*)$/);
    if (mNoHao) {
        return {
            searchQuery: mNoHao[1].trim(),
            extraSuffix: (mNoHao[2] || '').replace(/^[,，\s]+/, '').trim()
        };
    }

    return { searchQuery: clean, extraSuffix: '' };
};

window.fetchAddrSuggestions = async function(q) {
    const { searchQuery } = window.splitAddressForUber(q);
    if (!searchQuery || isAddressSet) return;
    if (typeof isValidSearchQuery === 'function' && !isValidSearchQuery(searchQuery)) return;

    // 若門牌基準地址（號以前）未變動且已有備選清單（例如使用者正在補打「8樓」），直接重繪備選清單即可，不需重複請求
    if (window.latestAddrQuery === searchQuery && Array.isArray(window.latestAddrCandidates) && window.latestAddrCandidates.length > 0) {
        window.renderAddrCandidates(window.latestAddrCandidates);
        return;
    }

    if (window.addrSuggestAbortController) {
        try { window.addrSuggestAbortController.abort(); } catch (e) {}
    }
    window.addrSuggestAbortController = new AbortController();
    const reqId = ++window.latestAddrSuggestReqId;

    try {
        const apiBase = typeof API_BASE_URL !== 'undefined' && API_BASE_URL ? API_BASE_URL : '';
        const payload = {
            query: searchQuery,
            lat: typeof currentLat !== 'undefined' && currentLat ? currentLat : 24.274120399999997,
            lng: typeof currentLng !== 'undefined' && currentLng ? currentLng : 120.5702076
        };
        const res = await fetch(`${apiBase}/api/mapsSearchV1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: window.addrSuggestAbortController.signal
        });

        const addrInput = document.getElementById('addrInput');
        const currentSplit = window.splitAddressForUber(addrInput ? addrInput.value : '');
        if (reqId !== window.latestAddrSuggestReqId || isAddressSet || currentSplit.searchQuery !== searchQuery) return;
        if (!res.ok) return;

        const resJson = await res.json();
        const afterSplit = window.splitAddressForUber(addrInput ? addrInput.value : '');
        if (reqId !== window.latestAddrSuggestReqId || isAddressSet || afterSplit.searchQuery !== searchQuery) return;

        if (resJson.status === 'success' && Array.isArray(resJson.data)) {
            window.latestAddrCandidates = resJson.data;
            window.latestAddrQuery = searchQuery;
            window.renderAddrCandidates(resJson.data);
        }
    } catch (e) {
        if (e && e.name === 'AbortError') return;
        console.warn('fetchAddrSuggestions error:', e);
    }
};

window.syncAddrFloatingPopup = function(forceHide = false) {
    const popup = document.getElementById('addrFloatingPopup');
    const resEl = document.getElementById('addrResults');
    const stEl = document.getElementById('addrStatus');
    if (!popup) return;
    if (forceHide) {
        popup.style.display = 'none';
        return;
    }
    const hasResults = resEl && resEl.innerHTML.trim() !== '';
    const hasStatus = stEl && stEl.innerText.trim() !== '';
    if (stEl) {
        stEl.style.display = hasStatus ? 'block' : 'none';
    }
    popup.style.display = (hasResults || hasStatus) ? 'block' : 'none';
};

// 自動監聽 #addrResults 與 #addrStatus 內容變化（例如 setAddress 清空內容時自動收起漂浮視窗）
(function initAddrPopupObserver() {
    const setup = () => {
        const resEl = document.getElementById('addrResults');
        const stEl = document.getElementById('addrStatus');
        if (!resEl && !stEl) return;
        const obs = new MutationObserver(() => {
            window.syncAddrFloatingPopup();
        });
        if (resEl) obs.observe(resEl, { childList: true, subtree: true, characterData: true });
        if (stEl) obs.observe(stEl, { childList: true, subtree: true, characterData: true });
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setup);
    } else {
        setup();
    }
})();

window.renderAddrCandidates = function(items) {
    const resEl = document.getElementById('addrResults');
    const stEl = document.getElementById('addrStatus');
    if (!resEl) return;
    if (!items || items.length === 0) {
        resEl.innerHTML = '';
        window.syncAddrFloatingPopup();
        return;
    }
    if (stEl) {
        stEl.innerText = '請選擇正確地址：';
    }
    const addrInput = document.getElementById('addrInput');
    const { extraSuffix } = window.splitAddressForUber(addrInput ? addrInput.value : '');
    const suffixHtml = extraSuffix
        ? ` <span style="color:#be123c; font-weight:800;">${typeof escapeHTML === 'function' ? escapeHTML(extraSuffix) : extraSuffix}</span>`
        : '';

    resEl.innerHTML = items.slice(0, 6).map((item, idx) => {
        const l1 = typeof escapeHTML === 'function' ? escapeHTML(item.addressLine1 || item.fullAddress || '') : (item.addressLine1 || '');
        const l2 = typeof escapeHTML === 'function' ? escapeHTML(item.addressLine2 || '') : (item.addressLine2 || '');
        const badgeHtml = idx === 0
            ? `<span style="font-size:11px; color:#15803d; background:#dcfce7; padding:3px 8px; border-radius:999px; font-weight:700; white-space:nowrap;">選取</span>`
            : `<span style="font-size:11px; color:#57534e; background:#f5f0ee; padding:3px 8px; border-radius:999px; font-weight:700; white-space:nowrap;">選取</span>`;
        return `<div class="addr-item" onmousedown="event.preventDefault();" onclick="window.selectUberAddrCandidate(${idx})" style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:11px 13px; border:1px solid ${idx === 0 ? '#bbf7d0' : '#f0e4e2'}; border-radius:14px; background:#fff; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
                <span style="font-size:18px; flex-shrink:0;">📍</span>
                <div style="min-width:0; flex:1;">
                    <div style="font-size:15px; font-weight:800; color:#1c1917; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${l1}${suffixHtml}</div>
                    ${l2 ? `<div style="font-size:12px; color:#78716c; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${l2}</div>` : ''}
                </div>
            </div>
            ${badgeHtml}
        </div>`;
    }).join('');
    window.syncAddrFloatingPopup();
};

window.checkAddressMismatchAndPrompt = function(rawUserText, candidateItem, resolvedTitle) {
    if (!resolvedTitle) return;

    const clean = (s) => {
        if (!s || typeof s !== 'string') return '';
        return s
            .replace(/^📍\s*/, '')
            .replace(/^台灣(省)?/, '')
            .replace(/[\s,，、\-_－—]+/g, '')
            .trim();
    };

    const cleanResolved = clean(resolvedTitle);
    if (!cleanResolved) return;

    const candFull = candidateItem?.fullAddress || '';
    const candLine1 = candidateItem?.addressLine1 || '';
    const candTitle = candidateItem?.title || '';

    const extractDoorInfo = (s) => {
        if (!s || typeof s !== 'string') return null;
        const mWithSub = s.match(/(\d+)\s*[-－之附]\s*(\d+)\s*號?/);
        if (mWithSub) return { main: mWithSub[1], sub: mWithSub[2] };
        const mSimple = s.match(/(\d+)\s*號/);
        if (mSimple) return { main: mSimple[1], sub: '' };
        return null;
    };

    const userDoor = extractDoorInfo(rawUserText);
    const candDoor = extractDoorInfo(candLine1) || extractDoorInfo(candFull) || extractDoorInfo(candTitle);
    const resolvedDoor = extractDoorInfo(resolvedTitle);

    let isMismatch = false;

    // 情況 1：點選的候選項目或使用者輸入帶有附號（例如 157-116號 或 之116），但解析出的門牌附號不一致或消失（例如變成 157號）
    const targetSubDoor = (candDoor && candDoor.sub) ? candDoor : ((userDoor && userDoor.sub) ? userDoor : null);
    if (targetSubDoor && targetSubDoor.sub) {
        if (!resolvedDoor || resolvedDoor.main !== targetSubDoor.main || resolvedDoor.sub !== targetSubDoor.sub) {
            isMismatch = true;
        }
    }

    // 情況 2：點選的候選項目文字（非單純行政區）未被解析結果包含
    const cleanCandLine1 = clean(candLine1);
    if (!isMismatch && cleanCandLine1 && cleanCandLine1.length >= 4) {
        if (!cleanResolved.includes(cleanCandLine1) && !cleanCandLine1.includes(cleanResolved)) {
            isMismatch = true;
        }
    }

    // 情況 3：使用者原始輸入文字長度足夠，但解析出的門牌號碼主號對不上
    if (!isMismatch && userDoor && resolvedDoor) {
        if (userDoor.main !== resolvedDoor.main) {
            isMismatch = true;
        }
    }

    if (!isMismatch) return;

    // 觸發自製提示彈窗
    const displayResolved = resolvedTitle.replace(/^📍\s*/, '').trim();
    const content = `
        <div style="text-align:center; font-size:15px; line-height:1.6; color:#292524; margin-bottom:18px;">
            系統只能搜尋到「<b style="color:#e11d48; word-break:break-all;">${escapeHTML(displayResolved)}</b>」這個地址。<br><br>
            請確認這個地址可以送達嗎？<br>
            <span style="color:#78716c; font-size:13px;">如果不行，可以嘗試搜尋「社區」或「地標」名稱。</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px;">
            <button onclick="document.getElementById('errorModalOverlay').style.display='none';" style="width:100%; padding:13px; background:#1c1917; color:#fff; border:none; border-radius:12px; font-weight:700; font-size:15px; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.12); transition:all 0.2s;">確認此地址可送達，繼續點餐</button>
            <button onclick="document.getElementById('errorModalOverlay').style.display='none'; const inp = document.getElementById('addrInput'); if(inp){ inp.focus(); inp.select(); }" style="width:100%; padding:11px; background:#f5f5f4; color:#44403c; border:1px solid #d6d3d1; border-radius:12px; font-weight:700; font-size:14px; cursor:pointer; transition:all 0.2s;">重新搜尋社區或地標名稱</button>
        </div>
    `;

    showModal('請確認送達地址', '', true, content, true);
};

window.selectUberAddrCandidate = async function(idx) {
    const item = window.latestAddrCandidates && window.latestAddrCandidates[idx];
    if (!item) return;
    clearTimeout(window.addrDebounceTimer);
    clearTimeout(window.addrSuggestDebounceTimer);
    window.latestAddrSuggestReqId++;
    if (window.addrSuggestAbortController) {
        try { window.addrSuggestAbortController.abort(); } catch (e) {}
    }

    const addrInput = document.getElementById('addrInput');
    const stEl = document.getElementById('addrStatus');
    const resEl = document.getElementById('addrResults');

    // 先從目前輸入框提取使用者在「號」後面輸入的樓層或備註（例如「8樓」），以便在定位完成後完整保留於地址文字中
    const rawUserText = addrInput ? addrInput.value.trim() : '';
    const { extraSuffix } = window.splitAddressForUber(rawUserText);

    const baseFullAddr = (item.fullAddress || item.addressLine1 || '').trim();
    const previewFullAddr = (extraSuffix && !baseFullAddr.endsWith(extraSuffix))
        ? `${baseFullAddr}${extraSuffix}`
        : baseFullAddr;

    if (addrInput) addrInput.value = previewFullAddr;
    if (resEl) resEl.innerHTML = '';
    if (stEl) stEl.innerText = '正在確認地址座標...';
    window.syncAddrFloatingPopup();

    if (item.id) {
        try {
            // 1. 先檢查使用者瀏覽器本地 localStorage 永久快取
            let localPlaceCache = {};
            try {
                localPlaceCache = JSON.parse(localStorage.getItem('finddog_place_coord_cache') || '{}') || {};
            } catch (e) {
                localPlaceCache = {};
            }
            const localHit = localPlaceCache[item.id];
            if (localHit && localHit.lat && localHit.lng) {
                let resolvedTitle = (localHit.title || baseFullAddr).trim();
                if (extraSuffix && !resolvedTitle.endsWith(extraSuffix)) {
                    resolvedTitle = `${resolvedTitle}${extraSuffix}`;
                }
                window.lastSearchedAddr = resolvedTitle;
                window.currentPlaceId = item.id;
                await setAddress(localHit.lat, localHit.lng, resolvedTitle, item.id);
                window.syncAddrFloatingPopup(true);
                window.checkAddressMismatchAndPrompt(rawUserText, item, resolvedTitle);
                return;
            }

            // 2. 若瀏覽器尚未紀錄，向後端 /api/getDeliveryLocationV2 請求並永久寫入瀏覽器 localStorage
            const apiBase = typeof API_BASE_URL !== 'undefined' && API_BASE_URL ? API_BASE_URL : '';
            const reqInit = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    placeId: item.id,
                    provider: item.provider || 'google_places',
                    lat: typeof currentLat !== 'undefined' && currentLat ? currentLat : 24.274120399999997,
                    lng: typeof currentLng !== 'undefined' && currentLng ? currentLng : 120.5702076
                })
            };
            let res = await fetch(`${apiBase}/api/getDeliveryLocationV2`, reqInit);
            let data = res.ok ? await res.json() : null;
            if (!data || data.status !== 'success' || !data.lat || !data.lng) {
                res = await fetch(`${apiBase}/api/getDeliveryLocationV1`, reqInit);
                data = res.ok ? await res.json() : null;
            }
            if (data && data.status === 'success' && data.lat && data.lng) {
                    const baseResolvedTitle = (data.title || baseFullAddr).trim();
                    try {
                        localPlaceCache[item.id] = {
                            lat: data.lat,
                            lng: data.lng,
                            title: baseResolvedTitle,
                            name: data.name || ''
                        };
                        localStorage.setItem('finddog_place_coord_cache', JSON.stringify(localPlaceCache));
                    } catch (storageErr) {}

                    let resolvedTitle = baseResolvedTitle;
                    if (extraSuffix && !resolvedTitle.endsWith(extraSuffix)) {
                        resolvedTitle = `${resolvedTitle}${extraSuffix}`;
                    }
                    window.lastSearchedAddr = resolvedTitle;
                    window.currentPlaceId = item.id;
                    await setAddress(data.lat, data.lng, resolvedTitle, item.id);
                    window.syncAddrFloatingPopup(true);
                    window.checkAddressMismatchAndPrompt(rawUserText, item, resolvedTitle);
                    return;
                }
        } catch (e) {
            console.warn('getDeliveryLocationV2 error:', e);
        }
    }

    if (stEl) stEl.innerText = '無法取得該地址座標，請重新選取';
    window.syncAddrFloatingPopup();
    if (document.getElementById('fullScreenLoader')) document.getElementById('fullScreenLoader').style.display = 'none';
};

window.latestHistoryCandidates = [];

window.getDiffHistoryAddresses = function() {
    const addrInput = document.getElementById('addrInput');
    const currentVal = (addrInput ? addrInput.value : '').replace(/^📍\s*/, '').trim();
    let history = [];
    try {
        history = JSON.parse(localStorage.getItem('finddog_history_address') || '[]') || [];
    } catch (e) {
        history = [];
    }
    const seen = new Set();
    const diffList = [];
    for (const item of history) {
        if (!item || !item.title || !item.lat || !item.lng) continue;
        const cleanTitle = item.title.replace(/^📍\s*/, '').trim();
        if (!cleanTitle || cleanTitle === currentVal || seen.has(cleanTitle)) continue;
        seen.add(cleanTitle);
        diffList.push({
            lat: item.lat,
            lng: item.lng,
            title: cleanTitle,
            place_id: item.place_id || '',
            deliveryMethod: item.deliveryMethod,
            deliveryNotes: item.deliveryNotes
        });
    }
    return diffList;
};

window.renderHistoryAddrCandidates = function(items) {
    const resEl = document.getElementById('addrResults');
    const stEl = document.getElementById('addrStatus');
    if (!resEl) return;
    if (!items || items.length === 0) {
        resEl.innerHTML = '';
        if (stEl) stEl.innerText = '';
        window.syncAddrFloatingPopup(true);
        return;
    }
    window.latestHistoryCandidates = items;
    if (stEl) {
        stEl.innerText = '🕒 歷史紀錄：';
    }
    resEl.innerHTML = items.slice(0, 6).map((item, idx) => {
        const safeTitle = typeof escapeHTML === 'function' ? escapeHTML(item.title) : item.title;
        const prefParts = [];
        if (item.deliveryMethod === '放在門口' || item.deliveryMethod === '當面點交') {
            prefParts.push((item.deliveryMethod === '放在門口' ? '📦 ' : '🤝 ') + item.deliveryMethod);
        }
        if (typeof item.deliveryNotes === 'string' && item.deliveryNotes.trim()) {
            const safeNote = typeof escapeHTML === 'function' ? escapeHTML(item.deliveryNotes.trim()) : item.deliveryNotes.trim();
            prefParts.push(safeNote);
        }
        const prefHtml = prefParts.length > 0
            ? `<div style="font-size:12px; color:#78716c; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">${prefParts.join(' · ')}</div>`
            : '';
        return `<div class="addr-item" onmousedown="event.preventDefault();" onclick="window.selectHistoryAddrCandidate(${idx})" style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:11px 13px; border:1px solid #f0e4e2; border-radius:14px; background:#fffaf8; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
                <span style="font-size:17px; flex-shrink:0;">🕒</span>
                <div style="min-width:0; flex:1;">
                    <div style="font-size:15px; font-weight:800; color:#1c1917; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${safeTitle}</div>
                    ${prefHtml}
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                <span style="font-size:11px; color:#be123c; background:#ffe4e9; padding:3px 8px; border-radius:999px; font-weight:700; white-space:nowrap;">歷史紀錄</span>
                <span title="刪除此筆紀錄" onmousedown="event.preventDefault(); event.stopPropagation();" onclick="window.removeHistoryAddrCandidate(${idx}, event)" style="font-size:14px; color:#a8a29e; padding:2px 6px; border-radius:6px; cursor:pointer; font-weight:700;">✕</span>
            </div>
        </div>`;
    }).join('');
    window.syncAddrFloatingPopup();
};

window.selectHistoryAddrCandidate = async function(idx) {
    const item = window.latestHistoryCandidates && window.latestHistoryCandidates[idx];
    if (!item) return;
    clearTimeout(window.addrDebounceTimer);
    clearTimeout(window.addrSuggestDebounceTimer);
    window.latestAddrSuggestReqId++;
    if (window.addrSuggestAbortController) {
        try { window.addrSuggestAbortController.abort(); } catch (e) {}
    }
    const resEl = document.getElementById('addrResults');
    const stEl = document.getElementById('addrStatus');
    if (resEl) resEl.innerHTML = '';
    if (stEl) stEl.innerText = '';
    window.syncAddrFloatingPopup(true);
    window.lastSearchedAddr = item.title;
    await setAddress(item.lat, item.lng, item.title, item.place_id || item.placeId || item.id || '');
    window.syncAddrFloatingPopup(true);
};

window.removeHistoryAddrCandidate = function(idx, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const item = window.latestHistoryCandidates && window.latestHistoryCandidates[idx];
    if (!item) return;
    try {
        let history = JSON.parse(localStorage.getItem('finddog_history_address') || '[]') || [];
        history = history.filter(h => h && h.title && h.title.replace(/^📍\s*/, '').trim() !== item.title);
        localStorage.setItem('finddog_history_address', JSON.stringify(history));
        if (typeof addressHistory !== 'undefined') addressHistory = history;
    } catch (e) {}
    const diffList = window.getDiffHistoryAddresses();
    window.renderHistoryAddrCandidates(diffList);
};

window.handleAddrFocus = function() {
    // 若使用者正在打字搜尋且已有搜尋備選結果，優先顯示搜尋備選
    if (!isAddressSet && Array.isArray(window.latestAddrCandidates) && window.latestAddrCandidates.length > 0) {
        window.renderAddrCandidates(window.latestAddrCandidates);
        return;
    }
    // 當使用者點擊地址框時，若瀏覽器記錄中有「與目前地址不同」的歷史地址，顯示歷史地址選項供快速切換
    const diffHistory = window.getDiffHistoryAddresses();
    if (diffHistory.length > 0) {
        window.renderHistoryAddrCandidates(diffHistory);
    } else if (!isAddressSet) {
        window.syncAddrFloatingPopup();
    }
};

window.handleAddrInput = function() {
    isAddressSet = false;
    updateAddrTitleState('default');
    clearTimeout(window.addrDebounceTimer);
    clearTimeout(window.addrSuggestDebounceTimer);

    const addrInput = document.getElementById('addrInput');
    const q = addrInput ? addrInput.value.trim() : '';
    const resEl = document.getElementById('addrResults');
    const stEl = document.getElementById('addrStatus');

    if (!q) {
        window.latestAddrSuggestReqId++;
        window.latestAddrCandidates = [];
        window.latestAddrQuery = '';
        if (window.addrSuggestAbortController) {
            try { window.addrSuggestAbortController.abort(); } catch (e) {}
        }
        window.restoreHeroBanner();
        // 當清空輸入框時，若有歷史地址也自動顯示供選取
        const diffHistory = window.getDiffHistoryAddresses();
        if (diffHistory.length > 0) {
            window.renderHistoryAddrCandidates(diffHistory);
        } else {
            if (resEl) resEl.innerHTML = '';
            if (stEl) stEl.innerText = '';
            window.syncAddrFloatingPopup(true);
        }
        return;
    }

    // 使用者開始編輯地址文字：回歸 Uber mapsSearchV1 搜尋備選模式 (180ms 防抖)
    const { searchQuery } = window.splitAddressForUber(q);
    if (typeof isValidSearchQuery !== 'function' || isValidSearchQuery(searchQuery)) {
        window.addrSuggestDebounceTimer = setTimeout(() => {
            window.fetchAddrSuggestions(q);
        }, 180);
    }
};

window.handleAddrBlur = function() {
    if (typeof scrollAddrToEnd === 'function') scrollAddrToEnd();
    clearTimeout(window.addrDebounceTimer);
    const addrInput = document.getElementById('addrInput');
    const q = addrInput ? addrInput.value.trim() : '';
    window.syncAddrFloatingPopup(true);
    if (!q) {
        window.restoreHeroBanner();
    }
};

// 6. Pure Candidate-Based searchAddress (Pressing Enter or clicking action button auto-selects 1st candidate)
var _baseSearchAddress = window.searchAddress;
window.searchAddress = async function(force = false) {
    clearTimeout(window.addrDebounceTimer);
    clearTimeout(window.addrSuggestDebounceTimer);
    const addrInput = document.getElementById('addrInput');
    const stEl = document.getElementById('addrStatus');
    let q = addrInput ? addrInput.value.trim() : '';
    if (q.startsWith('📍 ')) q = q.substring(3).trim();
    if (!q) {
        updateAddrTitleState('default');
        return;
    }

    const { searchQuery } = window.splitAddressForUber(q);

    // 若目前已載入對應此門牌基準文字的備選清單，直接選取第一個（並自動保留後方樓層）
    if (window.latestAddrCandidates && window.latestAddrCandidates.length > 0 && window.latestAddrQuery === searchQuery) {
        return await window.selectUberAddrCandidate(0);
    }

    // 若使用者按 Enter 太快（備選清單尚未回傳），立刻以 searchQuery 查詢 mapsSearchV1 並自動選取第一個
    try {
        if (stEl) stEl.innerText = '正在搜尋備選地址...';
        window.syncAddrFloatingPopup();
        const apiBase = typeof API_BASE_URL !== 'undefined' && API_BASE_URL ? API_BASE_URL : '';
        const res = await fetch(`${apiBase}/api/mapsSearchV1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: searchQuery,
                lat: typeof currentLat !== 'undefined' && currentLat ? currentLat : 24.274120399999997,
                lng: typeof currentLng !== 'undefined' && currentLng ? currentLng : 120.5702076
            })
        });
        if (res.ok) {
            const resJson = await res.json();
            if (resJson.status === 'success' && Array.isArray(resJson.data) && resJson.data.length > 0) {
                window.latestAddrCandidates = resJson.data;
                window.latestAddrQuery = searchQuery;
                return await window.selectUberAddrCandidate(0);
            }
        }
    } catch (e) {
        console.warn('Immediate mapsSearchV1 failed on Enter:', e);
    }

    if (stEl) stEl.innerText = '找不到相符的備選地址，請嘗試輸入其他關鍵字';
    window.syncAddrFloatingPopup();
    if (document.getElementById('fullScreenLoader')) document.getElementById('fullScreenLoader').style.display = 'none';
};

// 7. Intercept searchStores to auto-select 1st candidate if address not yet confirmed
var _baseSearchStores = window.searchStores;
window.searchStores = async function() {
    const addrInput = document.getElementById('addrInput');
    const addrVal = addrInput ? addrInput.value.trim() : '';
    
    if (!isAddressSet) {
        if (!addrVal) {
            updateAddrTitleState('error');
            showModal('請輸入地址', '請先輸入外送地址');
            return;
        }
        await window.searchAddress(true);
        if (!isAddressSet) return;
    }
    if (_baseSearchStores) return _baseSearchStores.apply(this, arguments);
};

// 8. Intercept handleHeroClick for category buttons (auto-selects 1st candidate if not yet confirmed)
var _baseHandleHeroClick = window.handleHeroClick;
window.handleHeroClick = async function(vertical) {
    if (typeof switchVertical === 'function') switchVertical(vertical);
    const addrInput = document.getElementById('addrInput');
    const addrVal = addrInput ? addrInput.value.trim() : '';
    
    if (!isAddressSet) {
        if (addrVal) {
            await window.searchAddress(true);
            if (isAddressSet) {
                const qInput = document.getElementById('query');
                if (qInput) qInput.focus();
            }
        } else {
            if (addrInput) addrInput.focus();
        }
    } else {
        const qInput = document.getElementById('query');
        if (qInput) qInput.focus();
    }
};

// 9. Keep delivery method toggle working
window.setDeliveryMethod = function(method, fromUser = false) {
    const isDoor = (method === 'door' || method === '放在門口');
    const actualMethod = isDoor ? '放在門口' : '當面點交';
    window.selectedDeliveryMethod = actualMethod;
    
    const sel = document.getElementById('deliveryMethod');
    if (sel && sel.value !== actualMethod) {
        window._syncingDeliveryMethodDom = true;
        try {
            sel.value = actualMethod;
            sel.dispatchEvent(new Event('change'));
        } finally {
            window._syncingDeliveryMethodDom = false;
        }
    }
    const otherIds = ['checkoutDeliveryMethod', 'groceryDeliveryMethod'];
    otherIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.value !== actualMethod) el.value = actualMethod;
    });
    localStorage.setItem('userDeliveryMethod', actualMethod);

    const f = document.getElementById('btnMethodFace');
    const d = document.getElementById('btnMethodDoor');
    if (isDoor) {
        if (f) f.className = 'inactive';
        if (d) d.className = 'active';
    } else {
        if (f) f.className = 'active';
        if (d) d.className = 'inactive';
    }
    if (fromUser && !window._restoringAddrDeliveryPrefs && typeof window.saveCurrentPrefsToAddress === 'function') {
        window.saveCurrentPrefsToAddress();
    }
};

// ============================================================
// 生鮮雜貨等待專屬網址與自動轉址功能
// ============================================================
let groceryPollTimer = null;
let groceryPollAttempts = 0;
window._groceryDisabled = false;

async function checkGroceryStatus(storeName) {
    try {
        const sName = storeName || (typeof currentStoreName !== 'undefined' ? currentStoreName : '');
        const is150 = (sName && sName.includes('優市'));
        const couponType = is150 ? '150' : '225';
        const apiBase = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) ? API_BASE_URL : '';
        const res = await fetch(`${apiBase}/api/grocery/status?store_name=${encodeURIComponent(sName)}&type=${couponType}&t=${Date.now()}`);
        if (res.ok) {
            const data = await res.json();
            const isDisabled = (data.enabled === false || data.status === 'disabled');
            window._groceryDisabled = isDisabled;
            return isDisabled;
        }
    } catch (e) {
        console.warn('checkGroceryStatus error:', e);
    }
    return false;
}

function applyGroceryDisabledUI(storeName, popModal = false) {
    window._groceryDisabled = true;
    const sName = storeName || (typeof currentStoreName !== 'undefined' ? currentStoreName : '');
    const is150 = (sName && sName.includes('優市'));
    const typeTitle = is150 ? '優市' : '生鮮雜貨';
    const couponTitle = is150 ? '優市 150' : '生鮮雜貨 225';
    const noticeEl = document.getElementById('groceryCheckoutNotice');
    if (noticeEl) {
        noticeEl.innerHTML = `
          <div style="background:#FEE2E2; border:1px solid #EF4444; color:#B91C1C; padding:14px; border-radius:10px; font-weight:bold; font-size:15px; text-align:center; box-shadow:0 2px 6px rgba(239,68,68,0.15);">
            ⚠️ 目前已售完 請等待補貨<br>
            <span style="font-size:13px; font-weight:normal; color:#7F1D1D; margin-top:4px; display:inline-block;">目前${typeTitle}暫停營業，請等待補貨</span>
          </div>
        `;
    }
    const submitBtn = document.getElementById('checkoutSubmitBtn');
    if (submitBtn) {
        submitBtn.innerText = `🚫 目前${typeTitle}已售完 請等待補貨`;
        submitBtn.style.background = '#94A3B8';
        submitBtn.style.cursor = 'not-allowed';
        submitBtn.onclick = function() {
            showModal('目前暫停營業', `⚠️ 目前${typeTitle}已售完，暫停營業，請等待補貨！`, true, `<button onclick="document.getElementById('errorModalOverlay').style.display='none';" style="margin-top:15px; background:#f43f5e; color:#fff; border:none; border-radius:8px; padding:12px; width:100%; font-size:15px; font-weight:bold; cursor:pointer;">我知道了</button>`, true);
        };
    }
    if (popModal && typeof showModal === 'function') {
        showModal('目前暫停營業', `⚠️ 目前${typeTitle}已售完，暫停營業，請等待補貨！`, true, `<button onclick="document.getElementById('errorModalOverlay').style.display='none'; if(typeof handleMainBack==='function') handleMainBack();" style="margin-top:15px; background:#f43f5e; color:#fff; border:none; border-radius:8px; padding:12px; width:100%; font-size:15px; font-weight:bold; cursor:pointer;">我知道了</button>`, true);
    }
}

function restoreGroceryEnabledUI() {
    window._groceryDisabled = false;
    const noticeEl = document.getElementById('groceryCheckoutNotice');
    if (noticeEl) {
        noticeEl.innerHTML = `
          ⚠️ <b>注意：</b>此為生鮮雜貨代訂。我們不需要您在此點選詳細商品，請直接送出訂單後，代訂會提供網址，直接選購商品即可。
        `;
    }
    const submitBtn = document.getElementById('checkoutSubmitBtn');
    if (submitBtn) {
        submitBtn.innerText = '送出訂單';
        submitBtn.style.background = '#f43f5e';
        submitBtn.style.cursor = 'pointer';
        submitBtn.onclick = submitSelectedPlan;
    }
}

async function checkAndApplyGroceryDisabledUI(storeName, popModal = true) {
    const sName = storeName || (typeof currentStoreName !== 'undefined' ? currentStoreName : '');
    const isDisabled = await checkGroceryStatus(sName);
    if (isDisabled) {
        applyGroceryDisabledUI(sName, popModal);
    } else {
        restoreGroceryEnabledUI();
    }
}

async function getLiffUserId() {
    let uid = '';
    try {
        if (typeof liff !== 'undefined' && liff.isInClient && liff.isInClient()) {
            if (liff.isLoggedIn && liff.isLoggedIn()) {
                const profile = await liff.getProfile();
                if (profile && profile.userId) uid = profile.userId;
            }
        }
    } catch(e) {
        console.warn('liff.getProfile failed:', e);
    }
    if (!uid && typeof liff !== 'undefined' && liff.getContext) {
        try {
            const ctx = liff.getContext();
            if (ctx && ctx.userId) uid = ctx.userId;
        } catch(e) {}
    }
    if (!uid && typeof liff !== 'undefined' && liff.getDecodedIDToken) {
        try {
            const idToken = liff.getDecodedIDToken();
            if (idToken && idToken.sub) uid = idToken.sub;
        } catch(e) {}
    }
    return uid;
}

function showGroceryWaitingOverlay(storeName) {
    const el = document.getElementById('groceryWaitingOverlay');
    if (!el) return;
    document.getElementById('gwTitle').innerText = '正在建立專屬購物車...';
    document.getElementById('gwTitle').style.color = '#1E293B';
    document.getElementById('gwStore').innerText = '🏪 ' + (storeName || '生鮮雜貨門市');
    document.getElementById('gwEmoji').innerText = '🥦';
    document.getElementById('gwSpinner').style.display = 'block';
    document.getElementById('gwSpinner').style.borderTopColor = '#059669';
    document.getElementById('gwContent').style.display = 'block';
    document.getElementById('gwContent').innerHTML = `
      <div id="gwStep1" style="display:flex; align-items:center; gap:6px; color:#16A34A; font-weight:bold;"><span>✅</span><span>訂單已傳送至 LINE 聊天室</span></div>
      <div id="gwStep2" style="display:flex; align-items:center; gap:6px; color:#059669; font-weight:bold; margin-top:4px;"><span>⏳</span><span>連線代購系統配對專屬優惠中...</span></div>
      <div id="gwStep3" style="display:flex; align-items:center; gap:6px; color:#94A3B8; margin-top:4px;"><span>🔜</span><span>完成後將自動前往選購商品</span></div>
    `;
    document.getElementById('gwTip').innerText = '💡 外送地址稍後請忽略，代訂會依您填寫的地址安排。';
    document.getElementById('gwActions').innerHTML = `
      <button onclick="closeGroceryWaitingOverlay()" style="background:transparent; border:none; color:#64748B; font-size:13px; cursor:pointer; padding:6px; text-decoration:underline;">回到聊天室等候</button>
    `;
    el.style.display = 'flex';
}

function hideGroceryWaitingOverlay() {
    const el = document.getElementById('groceryWaitingOverlay');
    if (el) el.style.display = 'none';
    if (groceryPollTimer) {
        clearInterval(groceryPollTimer);
        groceryPollTimer = null;
    }
}

function closeGroceryWaitingOverlay() {
    hideGroceryWaitingOverlay();
    if (typeof liff !== 'undefined' && liff.closeWindow) {
        try { liff.closeWindow(); } catch(e) {}
    }
}

async function handleGroceryOrderSubmit(msgText) {
    const storeName = (typeof currentStoreName !== 'undefined' && currentStoreName) ? currentStoreName : '生鮮雜貨門市';
    const apiBase = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) ? API_BASE_URL : '';

    // 送出前再次檢查開關狀態，若已售完則直接攔截
    const isDisabled = await checkGroceryStatus(storeName);
    if (isDisabled) {
        const is150 = storeName.includes('優市');
        const typeTitle = is150 ? '優市' : '雜貨';
        showGroceryWaitingOverlay(storeName);
        onGroceryUrlDisabled(`目前${typeTitle}已售完 請等待補貨`, storeName);
        return;
    }

    showGroceryWaitingOverlay(storeName);

    // 取得 LINE User ID
    const userId = await getLiffUserId();

    // 透過 LIFF 送出訊息到 LINE 聊天室
    try {
        await liff.sendMessages([{ type: "text", text: msgText }]);
        clearCart();
        window._orderSent = true;
    } catch (err) {
        console.error("sendMessages error:", err);
        hideGroceryWaitingOverlay();
        showPermissionFailModal(msgText, err ? err.message : '');
        return;
    }

    // 啟動輪詢取得專屬網址
    groceryPollAttempts = 0;
    const maxAttempts = 30; // 30 次 * 1.5 秒 = 45 秒

    groceryPollTimer = setInterval(async () => {
        groceryPollAttempts++;
        try {
            const checkUrl = `${apiBase}/api/grocery/check_url?user_id=${encodeURIComponent(userId)}&t=${Date.now()}`;
            const res = await fetch(checkUrl);
            if (res.ok) {
                const data = await res.json();
                if (data.status === 'success' && data.join_url) {
                    clearInterval(groceryPollTimer);
                    groceryPollTimer = null;
                    onGroceryUrlSuccess(data.join_url, data.store_name || storeName);
                    return;
                } else if (data.status === 'disabled' || data.status === 'sold_out' || (data.message && (data.message.includes('已售完') || data.message.includes('手動關閉')))) {
                    clearInterval(groceryPollTimer);
                    groceryPollTimer = null;
                    onGroceryUrlDisabled(data.message || '目前雜貨已售完 請等待補貨', storeName);
                    return;
                } else if (data.status === 'manual') {
                    clearInterval(groceryPollTimer);
                    groceryPollTimer = null;
                    onGroceryUrlManual();
                    return;
                }
            }
        } catch (e) {
            console.log('Poll grocery check_url error:', e);
        }

        if (groceryPollAttempts >= maxAttempts) {
            clearInterval(groceryPollTimer);
            groceryPollTimer = null;
            onGroceryUrlTimeout();
        }
    }, 1500);
}

function onGroceryUrlSuccess(joinUrl, storeName) {
    document.getElementById('gwTitle').innerText = '🎉 專屬網址配對成功！';
    document.getElementById('gwTitle').style.color = '#059669';
    document.getElementById('gwEmoji').innerText = '🛒';
    document.getElementById('gwSpinner').style.display = 'none';
    document.getElementById('gwContent').innerHTML = `
      <div style="text-align:center; padding:5px 0;">
        <div style="font-weight:bold; color:#059669; font-size:15px; margin-bottom:4px;">即將自動前往選購商品！</div>
        <div style="color:#64748B; font-size:12px;">（專屬購物車已備妥，地址請忽略）</div>
      </div>
    `;
    document.getElementById('gwTip').innerText = '若未自動跳轉，請點擊下方按鈕前往：';
    document.getElementById('gwActions').innerHTML = `
      <button onclick="window.location.href='${joinUrl}'" style="width:100%; padding:14px; background:#059669; color:#fff; border:none; border-radius:12px; font-weight:bold; font-size:16px; cursor:pointer; box-shadow:0 4px 12px rgba(5,150,105,0.3);">🛒 立即前往選購商品</button>
    `;

    // 延遲 800ms 自動跳轉
    setTimeout(() => {
        window.location.href = joinUrl;
    }, 800);
}

function onGroceryUrlTimeout() {
    document.getElementById('gwTitle').innerText = '⏳ 系統正在排隊配對中';
    document.getElementById('gwEmoji').innerText = '⏳';
    document.getElementById('gwSpinner').style.display = 'none';
    document.getElementById('gwContent').innerHTML = `
      <div style="line-height:1.6; text-align:left; font-size:13px; color:#475569;">
        目前訂購人數較多，代訂人員正在為您安排專屬購物帳號。<br><br>
        專屬購物網址稍後將由 <b>LINE 官方帳號</b> 發送給您，即將為您關閉頁面返回聊天室！
      </div>
    `;
    document.getElementById('gwTip').innerText = '';
    document.getElementById('gwActions').innerHTML = `
      <button onclick="closeGroceryWaitingOverlay()" style="width:100%; padding:14px; background:#059669; color:#fff; border:none; border-radius:12px; font-weight:bold; font-size:16px; cursor:pointer;">返回 LINE 聊天室</button>
    `;
    setTimeout(() => {
        closeGroceryWaitingOverlay();
    }, 2200);
}

function onGroceryUrlDisabled(msg, storeName) {
    const sName = storeName || (typeof currentStoreName !== 'undefined' ? currentStoreName : '');
    const is150 = (sName && sName.includes('優市')) || (msg && msg.includes('優市'));
    const typeTitle = is150 ? '優市' : '雜貨';
    const couponTitle = is150 ? '優市 150' : '生鮮雜貨 225';
    const titleEl = document.getElementById('gwTitle');
    if (titleEl) {
        titleEl.innerText = `⚠️ 目前${typeTitle}已售完`;
        titleEl.style.color = '#EF4444';
    }
    const emojiEl = document.getElementById('gwEmoji');
    if (emojiEl) emojiEl.innerText = '🚫';
    const spinnerEl = document.getElementById('gwSpinner');
    if (spinnerEl) spinnerEl.style.display = 'none';
    const contentEl = document.getElementById('gwContent');
    if (contentEl) {
        contentEl.innerHTML = `
          <div style="line-height:1.6; text-align:center; font-size:16px; color:#1E293B; font-weight:bold; padding:12px 0;">
            ${msg || `目前${typeTitle}已售完 請等待補貨`}
          </div>
          <div style="line-height:1.5; text-align:center; font-size:13px; color:#64748B;">
            ${couponTitle} 優惠券目前暫停發券，補貨完成後將重新開放，敬請見諒！
          </div>
        `;
    }
    const tipEl = document.getElementById('gwTip');
    if (tipEl) tipEl.innerText = '';
    const actionsEl = document.getElementById('gwActions');
    if (actionsEl) {
        actionsEl.innerHTML = `
          <button onclick="closeGroceryWaitingOverlay()" style="width:100%; padding:14px; background:#EF4444; color:#fff; border:none; border-radius:12px; font-weight:bold; font-size:16px; cursor:pointer; box-shadow:0 4px 12px rgba(239,68,68,0.25);">返回 LINE 聊天室</button>
        `;
    }
}

function onGroceryUrlManual() {
    document.getElementById('gwTitle').innerText = '👨‍💼 已轉由專人為您安排';
    document.getElementById('gwEmoji').innerText = '👨‍💼';
    document.getElementById('gwSpinner').style.display = 'none';
    document.getElementById('gwContent').innerHTML = `
      <div style="line-height:1.6; text-align:left; font-size:13px; color:#475569;">
        您的生鮮雜貨訂單已轉由代訂專人為您處理。<br><br>
        專人稍後將於 LINE 聊天室提供購物網址給您，敬請稍候片刻！
      </div>
    `;
    document.getElementById('gwTip').innerText = '';
    document.getElementById('gwActions').innerHTML = `
      <button onclick="closeGroceryWaitingOverlay()" style="width:100%; padding:14px; background:#059669; color:#fff; border:none; border-radius:12px; font-weight:bold; font-size:16px; cursor:pointer;">返回 LINE 聊天室</button>
    `;
}


// ============================================================
// 一般餐點訂單進度等待與自動轉址邏輯
// ============================================================
let orderPollTimer = null;
let orderPollAttempts = 0;

function showOrderWaitingOverlay(storeName) {
    const el = document.getElementById('orderWaitingOverlay');
    if (!el) return;
    const titleEl = document.getElementById('owTitle');
    if (titleEl) {
        titleEl.innerText = '🚀 正在為您送出訂單...';
        titleEl.style.color = '#1E293B';
    }
    const storeEl = document.getElementById('owStore');
    if (storeEl) storeEl.innerText = '🏪 ' + (storeName || '線上餐點門市');
    const emojiEl = document.getElementById('owEmoji');
    if (emojiEl) emojiEl.innerText = '🍽️';
    const spinnerEl = document.getElementById('owSpinner');
    if (spinnerEl) {
        spinnerEl.style.display = 'block';
        spinnerEl.style.borderTopColor = '#f43f5e';
    }
    const contentEl = document.getElementById('owContent');
    if (contentEl) {
        contentEl.style.display = 'block';
        contentEl.innerHTML = `
          <div id="owStep1" style="display:flex; align-items:center; gap:6px; color:#16A34A; font-weight:bold;"><span>✅</span> 訂單內容已確認</div>
          <div id="owStep2" style="display:flex; align-items:center; gap:6px; color:#f43f5e; font-weight:bold; margin-top:4px;"><span>⏳</span> 正在連線伺服器建立訂單...</div>
          <div id="owStep3" style="display:flex; align-items:center; gap:6px; color:#94A3B8; margin-top:4px;"><span>🔜</span> 即將建立外送追蹤進度</div>
        `;
    }
    const tipEl = document.getElementById('owTip');
    if (tipEl) tipEl.innerText = '💡 請稍候片刻，系統正在即時處理中...';
    const actionsEl = document.getElementById('owActions');
    if (actionsEl) {
        actionsEl.innerHTML = `
          <button id="owCancelBtn" onclick="closeOrderWaitingOverlay()" style="background:transparent; border:none; color:#64748B; font-size:13px; cursor:pointer; padding:6px;">取消返回</button>
        `;
    }
    el.style.display = 'flex';
}

function hideOrderWaitingOverlay() {
    const el = document.getElementById('orderWaitingOverlay');
    if (el) el.style.display = 'none';
    if (orderPollTimer) {
        clearInterval(orderPollTimer);
        orderPollTimer = null;
    }
}

function closeOrderWaitingOverlay() {
    hideOrderWaitingOverlay();
    if (window._orderSent && typeof liff !== 'undefined' && liff.closeWindow) {
        try { liff.closeWindow(); } catch(e) {}
    }
}

async function handleFoodOrderSubmit(msgText) {
    const storeName = (typeof currentStoreName !== 'undefined' && currentStoreName) ? currentStoreName : (document.getElementById('storeNameTitle') ? document.getElementById('storeNameTitle').innerText.trim() : '線上餐點門市');
    const apiBase = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) ? API_BASE_URL : '';

    showOrderWaitingOverlay(storeName);

    const userId = await getLiffUserId();
    let submittedOrderId = window.lastSubmittedOrderId || '';

    // 送出訊息至 LINE 聊天室
    try {
        await liff.sendMessages([{ type: "text", text: msgText }]);
        if (window.currentGroupBuyId && typeof markGroupBuySubmitted === 'function') {
            await markGroupBuySubmitted(msgText);
        }
        clearCart();
        window._orderSent = true;
    } catch (err) {
        console.error("sendMessages error:", err);
        hideOrderWaitingOverlay();
        if (userId && submittedOrderId) {
            try {
                fetch(`${apiBase}/api/order/push_order_received`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order_id: submittedOrderId, user_id: userId })
                }).catch(e => console.log('Push fallback error:', e));
            } catch(e) {}
        }
        showPermissionFailModal(msgText, err ? err.message : '');
        return;
    }

    // 啟動輪詢取得查看訂單進度網址
    orderPollAttempts = 0;
    const maxAttempts = 15; // 15 次 * 1.2 秒 = 18 秒

    if (orderPollTimer) {
        clearInterval(orderPollTimer);
        orderPollTimer = null;
    }

    orderPollTimer = setInterval(async () => {
        orderPollAttempts++;
        try {
            const checkUrl = `${apiBase}/api/order/check_progress_url?user_id=${encodeURIComponent(userId || '')}&order_id=${encodeURIComponent(submittedOrderId || '')}&t=${Date.now()}`;
            const res = await fetch(checkUrl);
            if (res.ok) {
                const data = await res.json();
                if (data.status === 'success') {
                    if (data.cookie_serial) window.lastFastGroupOrderSerial = data.cookie_serial;
                    if (data.join_url) window.lastFastGroupOrderUrl = data.join_url;
                    clearInterval(orderPollTimer);
                    orderPollTimer = null;
                    const finalProgressUrl = data.progress_url || (submittedOrderId ? `https://liff.line.me/2011657436-QfTNNMU8?id=${submittedOrderId}` : (data.order_id ? `https://liff.line.me/2011657436-QfTNNMU8?id=${data.order_id}` : ''));
                    if (finalProgressUrl) {
                        onOrderProgressSuccess(finalProgressUrl, data.store_name || storeName);
                    } else if (data.join_url) {
                        onOrderProgressSuccess(data.join_url, data.store_name || storeName);
                    }
                    return;
                } else if (data.status === 'error' || data.status === 'cancelled') {
                    clearInterval(orderPollTimer);
                    orderPollTimer = null;
                    onOrderProgressError(data.message || '訂單未能成功送出');
                    return;
                }
            }
        } catch (e) {
            console.log('Poll order check_progress_url error:', e);
        }

        if (orderPollAttempts >= maxAttempts) {
            clearInterval(orderPollTimer);
            orderPollTimer = null;
            onOrderProgressTimeout();
        }
    }, 1200);
}

function onFastFoodCartSuccess(joinUrl, storeName, itemsCount, cookieSerial, progressUrl) {
    if (cookieSerial) {
        window.lastFastGroupOrderSerial = cookieSerial;
        console.log('[點餐團購] 背景取得序號:', cookieSerial);
    }
    const titleEl = document.getElementById('owTitle');
    if (titleEl) {
        titleEl.innerText = '🎉 專屬 5折 購物車建立成功！';
        titleEl.style.color = '#059669';
    }
    const emojiEl = document.getElementById('owEmoji');
    if (emojiEl) emojiEl.innerText = '🛒';
    const spinnerEl = document.getElementById('owSpinner');
    if (spinnerEl) spinnerEl.style.display = 'none';
    const contentEl = document.getElementById('owContent');
    if (contentEl) {
        const cntText = itemsCount ? `（共預載 ${itemsCount} 項商品）` : '';
        contentEl.innerHTML = `
          <div style="text-align:center; padding:6px 0;">
            <div style="font-weight:bold; color:#059669; font-size:16px; margin-bottom:4px;">餐點已全部預載至購物車！</div>
            <div style="color:#64748B; font-size:12px; margin-bottom:8px;">${cntText} 已套用 5折半價優惠，外送地址請忽略</div>
            
          </div>
        `;
    }
    const tipEl = document.getElementById('owTip');
    if (tipEl) tipEl.innerText = '若未自動前往，請點擊下方按鈕：';
    const actionsEl = document.getElementById('owActions');
    if (actionsEl) {
        actionsEl.innerHTML = `
          <button onclick="window.location.href='${joinUrl}'" style="width:100%; padding:14px; background:#059669; color:#fff; border:none; border-radius:12px; font-weight:bold; font-size:16px; cursor:pointer; box-shadow:0 4px 12px rgba(5,150,105,0.3); margin-bottom:8px;">🛒 立即前往 Uber Eats 官方預裝購物車</button>
          <div style="display:flex; gap:8px;">
            <button onclick="copyToClipboardFallback('${joinUrl}', this)" style="flex:1; padding:10px; background:#F1F5F9; color:#475569; border:1px solid #CBD5E1; border-radius:10px; font-size:13px; font-weight:bold; cursor:pointer;">📋 複製邀請網址</button>
            ${progressUrl ? `<button onclick="window.location.href='${progressUrl}'" style="flex:1; padding:10px; background:#F8FAFC; color:#64748B; border:1px solid #E2E8F0; border-radius:10px; font-size:13px; font-weight:bold; cursor:pointer;">🔍 查看進度</button>` : ''}
          </div>
        `;
    }
    setTimeout(() => {
        window.location.href = progressUrl || joinUrl;
    }, 1200);
}

function onOrderProgressSuccess(progressUrl, storeName) {
    const titleEl = document.getElementById('owTitle');
    if (titleEl) {
        titleEl.innerText = '🎉 訂單已建立！';
        titleEl.style.color = '#059669';
    }
    const emojiEl = document.getElementById('owEmoji');
    if (emojiEl) emojiEl.innerText = '🛵';
    const spinnerEl = document.getElementById('owSpinner');
    if (spinnerEl) spinnerEl.style.display = 'none';
    const contentEl = document.getElementById('owContent');
    if (contentEl) {
        contentEl.innerHTML = `
          <div style="text-align:center; padding:6px 0;">
            <div style="font-weight:bold; color:#059669; font-size:15px; margin-bottom:4px;">即將自動開啟「查看訂單進度」！</div>
            <div style="color:#64748B; font-size:12px;">（即時外送進度與明細已為您準備好）</div>
          </div>
        `;
    }
    const tipEl = document.getElementById('owTip');
    if (tipEl) tipEl.innerText = '若未自動前往，請點擊下方按鈕：';
    // 附帶 autoclose=3 參數：讓換頁過去只停留 3 秒自動關閉視窗，顧客後續在聊天室單獨點開則不受影響！
    const targetUrl = progressUrl.includes('?') ? `${progressUrl}&autoclose=10` : `${progressUrl}?autoclose=10`;
    const actionsEl = document.getElementById('owActions');
    if (actionsEl) {
        actionsEl.innerHTML = `
          <button onclick="window.location.href='${targetUrl}'" style="width:100%; padding:14px; background:#059669; color:#fff; border:none; border-radius:12px; font-weight:bold; font-size:16px; cursor:pointer; box-shadow:0 4px 12px rgba(5,150,105,0.3);">🔍 立即查看訂單進度</button>
        `;
    }
    setTimeout(() => {
        window.location.href = targetUrl;
    }, 700);
}

function onOrderProgressTimeout() {
    const titleEl = document.getElementById('owTitle');
    if (titleEl) {
        titleEl.innerText = '✅ 訂單已送出至聊天室';
        titleEl.style.color = '#1E293B';
    }
    const emojiEl = document.getElementById('owEmoji');
    if (emojiEl) emojiEl.innerText = '💬';
    const spinnerEl = document.getElementById('owSpinner');
    if (spinnerEl) spinnerEl.style.display = 'none';
    const contentEl = document.getElementById('owContent');
    if (contentEl) {
        contentEl.innerHTML = `
          <div style="line-height:1.6; text-align:center; font-size:14px; color:#475569;">
            系統已收到您的點餐訊息！<br>
            已將進度通知發送至 <b>LINE 聊天室</b>。<br><br>
            <span style="color:#f43f5e; font-weight:bold; font-size:13px;">即將自動關閉視窗返回聊天室...</span>
          </div>
        `;
    }
    const tipEl = document.getElementById('owTip');
    if (tipEl) tipEl.innerText = '';
    const actionsEl = document.getElementById('owActions');
    if (actionsEl) {
        actionsEl.innerHTML = `
          <button onclick="closeOrderWaitingOverlay()" style="width:100%; padding:13px; background:#f43f5e; color:#fff; border:none; border-radius:12px; font-weight:bold; font-size:15px; cursor:pointer;">返回 LINE 聊天室</button>
        `;
    }
    // 超時自動關閉視窗，不保持在網頁中
    setTimeout(() => {
        closeOrderWaitingOverlay();
    }, 1800);
}

function onOrderProgressError(errMsg) {
    const titleEl = document.getElementById('owTitle');
    if (titleEl) {
        titleEl.innerText = '⚠️ 訂單處理提醒';
        titleEl.style.color = '#EF4444';
    }
    const emojiEl = document.getElementById('owEmoji');
    if (emojiEl) emojiEl.innerText = '⚠️';
    const spinnerEl = document.getElementById('owSpinner');
    if (spinnerEl) spinnerEl.style.display = 'none';
    const contentEl = document.getElementById('owContent');
    if (contentEl) {
        contentEl.innerHTML = `
          <div style="line-height:1.6; text-align:center; font-size:14px; color:#1E293B; font-weight:bold; padding:8px 0;">
            ${errMsg || '訂單未能成功送出'}
          </div>
          <div style="line-height:1.5; text-align:center; font-size:12px; color:#64748B;">
            請返回 LINE 聊天室確認訊息，即將自動關閉視窗...
          </div>
        `;
    }
    const tipEl = document.getElementById('owTip');
    if (tipEl) tipEl.innerText = '';
    const actionsEl = document.getElementById('owActions');
    if (actionsEl) {
        actionsEl.innerHTML = `
          <button onclick="closeOrderWaitingOverlay()" style="width:100%; padding:13px; background:#EF4444; color:#fff; border:none; border-radius:12px; font-weight:bold; font-size:15px; cursor:pointer;">關閉視窗返回聊天室</button>
        `;
    }
    // 得到錯誤回覆自動關閉視窗，不保持在網頁中
    setTimeout(() => {
        closeOrderWaitingOverlay();
    }, 2200);
}


// ============================================================
// 店家黑名單管理 (無法代購店家)
// ============================================================
window.storeBlacklist = [];
window._blacklistLoaded = false;

async function loadStoreBlacklist() {
    try {
        const apiBase = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) ? API_BASE_URL : '';
        const res = await fetch(`${apiBase}/api/blacklist_stores?t=${Date.now()}`);
        if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.blacklist)) {
                window.storeBlacklist = data.blacklist;
                window._blacklistLoaded = true;
                console.log('Loaded store blacklist:', window.storeBlacklist);
            }
        }
    } catch (e) {
        console.warn('載入店家黑名單失敗:', e);
    }
}

function isStoreBlacklisted(name) {
    if (!name || !window.storeBlacklist || window.storeBlacklist.length === 0) return false;
    const cleanName = String(name).toLowerCase();
    for (const kw of window.storeBlacklist) {
        if (!kw) continue;
        const cleanKw = String(kw).trim().toLowerCase();
        if (cleanKw && cleanName.includes(cleanKw)) {
            return true;
        }
    }
    return false;
}

// ============================================================
// 三小時時段店家管理 (生鮮雜貨專屬穿插 3 小時時段)
// ============================================================
window.threeHourStores = ['大全聯'];
window._threeHourStoresLoaded = false;

async function loadThreeHourStores() {
    try {
        const apiBase = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) ? API_BASE_URL : '';
        const res = await fetch(`${apiBase}/api/three_hour_stores?t=${Date.now()}`);
        if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.stores) && data.stores.length > 0) {
                window.threeHourStores = data.stores;
                window._threeHourStoresLoaded = true;
                console.log('Loaded three hour stores:', window.threeHourStores);
            }
        }
    } catch (e) {
        console.warn('載入三小時時段店家名單失敗:', e);
    }
}

function isThreeHourStore(name) {
    if (!name) return false;
    const list = (window.threeHourStores && window.threeHourStores.length > 0) ? window.threeHourStores : ['大全聯'];
    const cleanName = String(name).toLowerCase();
    for (const kw of list) {
        if (!kw) continue;
        const cleanKw = String(kw).trim().toLowerCase();
        if (cleanKw && cleanName.includes(cleanKw)) {
            return true;
        }
    }
    return false;
}

function interleaveThreeHourWindows(windows, storeName, isGrocery) {
    if (!windows || !Array.isArray(windows) || windows.length === 0) return windows || [];
    
    // 只有在名單內的「生鮮雜貨」且「能預約」的店家才穿插三小時時段
    const matchesStore = isThreeHourStore(storeName);
    if (!isGrocery || !matchesStore) {
        return windows;
    }
    
    // 依日期分組
    const groupsByDate = {};
    windows.forEach(w => {
        let dStr = w.date;
        if (!dStr && w.startTimeSeconds) {
            const dt = new Date(w.startTimeSeconds * 1000);
            const pad = n => String(Math.floor(Math.abs(n))).padStart(2, '0');
            dStr = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
        }
        if (!dStr) dStr = 'default';
        if (!groupsByDate[dStr]) groupsByDate[dStr] = [];
        groupsByDate[dStr].push(w);
    });
    
    const result = [];
    Object.keys(groupsByDate).forEach(dStr => {
        const dayWins = groupsByDate[dStr];
        dayWins.sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
        
        const maxEndTime = Math.max(...dayWins.map(w => w.endTime || 0));
        
        if (dayWins.length > 0) {
            // 第一個時段保持原本 1 小時 (例如 10:00~11:00)
            result.push(dayWins[0]);
            
            // 從第二個時段開始，在原本時段前穿插 3 小時時段 (startTime ~ startTime + 180)
            for (let i = 1; i < dayWins.length; i++) {
                const w = dayWins[i];
                const st = w.startTime || 0;
                // 如果加上 3 小時 (180 分鐘) 不超過當天營業結束時間
                if (st + 180 <= maxEndTime) {
                    const durationSec = 180 * 60;
                    const threeHourWin = {
                        ...w,
                        endTime: st + 180,
                        durationSec: durationSec,
                        isThreeHour: true
                    };
                    result.push(threeHourWin);
                }
                result.push(w);
            }
        }
    });
    
    return result;
}

function getSlotDiscountInfo(tw, isGrocery) {
    const durationMin = (tw.endTime && tw.startTime) ? (tw.endTime - tw.startTime) : 30;
    const isThreeHour = (durationMin === 180) || tw.isThreeHour;
    
    if (isGrocery) {
        if (isThreeHour) {
            return { discount: 25, tag: '(-$25)', tagHtml: ' <span style="color:#e11d48; font-weight:bold;">(-$25)</span>' };
        } else {
            return { discount: 0, tag: '', tagHtml: '' };
        }
    } else {
        const sdTime = tw.startTimeSeconds ? tw.startTimeSeconds * 1000 : Date.now();
        const diffMin = (sdTime - Date.now()) / 60000;
        const disc = (diffMin >= 179) ? 10 : 5;
        return { discount: disc, tag: `(-$${disc})`, tagHtml: ` <span style="color:#e11d48; font-weight:bold;">(-$${disc})</span>` };
    }
}

