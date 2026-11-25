  // ====== History Logic ======

  let addressHistory = [];

  function normalizeAddrPrefKey(title) {
    return String(title || '').replace(/^📍\s*/, '').split(',')[0].trim();
  }
  window.normalizeAddrPrefKey = normalizeAddrPrefKey;

  function findAddrHistoryIndex(history, targetKey) {
    if (!Array.isArray(history) || !targetKey) return -1;
    return history.findIndex(item => item && normalizeAddrPrefKey(item.title) === targetKey);
  }

  function pickPreservedAddrPrefs(sources) {
    for (const src of sources) {
      if (!src || typeof src !== 'object') continue;
      const out = {};
      if (src.deliveryMethod === '當面點交' || src.deliveryMethod === '放在門口') {
        out.deliveryMethod = src.deliveryMethod;
      }
      if (typeof src.deliveryNotes === 'string') {
        out.deliveryNotes = src.deliveryNotes;
      }
      if (typeof src.prefUpdatedAt === 'number') {
        out.prefUpdatedAt = src.prefUpdatedAt;
      }
      if (Object.keys(out).length > 0) return out;
    }
    return {};
  }

  function applyDeliveryPrefsUI(method, notes) {
    window._restoringAddrDeliveryPrefs = true;
    try {
      if (method === '當面點交' || method === '放在門口') {
        localStorage.setItem('userDeliveryMethod', method);
        if (typeof window.setDeliveryMethod === 'function') {
          window.setDeliveryMethod(method, false);
        }
      }
      if (typeof notes === 'string') {
        localStorage.setItem('userDeliveryNotes', notes);
        ['deliveryNotes', 'checkoutDeliveryNotes', 'groceryDeliveryNotes'].forEach(id => {
          const el = document.getElementById(id);
          if (el && el.value !== notes) el.value = notes;
        });
      }
    } finally {
      window._restoringAddrDeliveryPrefs = false;
    }
  }
  window.applyDeliveryPrefsUI = applyDeliveryPrefsUI;

  function saveCurrentPrefsToAddress(targetTitle) {
    if (window._restoringAddrDeliveryPrefs) return;
    if (window.currentGroupBuyId) return;
    const rawAddr = targetTitle || (typeof currentAddrTitle !== 'undefined' ? currentAddrTitle : '') || (document.getElementById('addrInput')?.value || '');
    const key = normalizeAddrPrefKey(rawAddr);
    if (!key) return;
    if (!targetTitle && typeof isAddressSet !== 'undefined' && !isAddressSet) return;

    const methodEl = document.getElementById('deliveryMethod');
    const currentMethod = (window.selectedDeliveryMethod === '放在門口' || (methodEl && methodEl.value === '放在門口'))
      ? '放在門口'
      : '當面點交';
    const noteEl = document.getElementById('deliveryNotes');
    const currentNotes = noteEl ? noteEl.value.trim() : (localStorage.getItem('userDeliveryNotes') || '');

    let history = [];
    try {
      history = JSON.parse(localStorage.getItem('finddog_history_address') || '[]') || [];
    } catch (e) { history = []; }
    const idx = findAddrHistoryIndex(history, key);
    if (idx === -1) return;

    history[idx] = {
      ...history[idx],
      deliveryMethod: currentMethod,
      deliveryNotes: currentNotes,
      prefUpdatedAt: Date.now()
    };
    localStorage.setItem('finddog_history_address', JSON.stringify(history));
    addressHistory = history;
  }
  window.saveCurrentPrefsToAddress = saveCurrentPrefsToAddress;

  function restorePrefsForAddress(targetTitle) {
    if (window.currentGroupBuyId) return;
    const key = normalizeAddrPrefKey(targetTitle);
    if (!key) return;

    let history = [];
    try {
      history = JSON.parse(localStorage.getItem('finddog_history_address') || '[]') || [];
    } catch (e) { history = []; }
    const idx = findAddrHistoryIndex(history, key);
    if (idx === -1) return;

    const item = history[idx];
    const hasMethod = item && (item.deliveryMethod === '當面點交' || item.deliveryMethod === '放在門口');
    const hasNotes = item && typeof item.deliveryNotes === 'string';
    // 方案二：若目標地址曾記錄過習慣則還原；若是從未紀錄過的全新地址，保留畫面上現行方式與備註，待修改時再覆寫
    if (hasMethod || hasNotes) {
      applyDeliveryPrefsUI(
        hasMethod ? item.deliveryMethod : undefined,
        hasNotes ? item.deliveryNotes : undefined
      );
    }
  }
  window.restorePrefsForAddress = restorePrefsForAddress;

  function handleDeliveryNoteChange(val) {
    const strVal = (val === undefined || val === null) ? '' : String(val);
    localStorage.setItem('userDeliveryNotes', strVal);
    ['deliveryNotes', 'checkoutDeliveryNotes', 'groceryDeliveryNotes'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.value !== strVal) el.value = strVal;
    });
    if (!window._restoringAddrDeliveryPrefs) {
      saveCurrentPrefsToAddress();
    }
  }
  window.handleDeliveryNoteChange = handleDeliveryNoteChange;

  

  function loadHistory() {
    const fieldMap = {
      'query': 'query-list',
      'foodNotes': 'food-notes-list',
      'deliveryNotes': 'delivery-notes-list',
      'modalNote': 'modal-note-list',
      'gbPasswordInput': 'gb-password-list',
      'gbCreatorNameInput': 'gb-creator-name-list'
    };
    Object.keys(fieldMap).forEach(field => {
      const history = JSON.parse(localStorage.getItem('finddog_history_' + field)) || [];
      const datalist = document.getElementById(fieldMap[field]);
      if (datalist) {
        datalist.innerHTML = history.map(val => `<option value="${escapeHTML(val)}"></option>`).join('');
      }
    });

    

    addressHistory = JSON.parse(localStorage.getItem('finddog_history_address')) || [];

    // ⭐ 兼容讀取 Cookie 或歷史快取中可能存在的舊版地址
    if (!addressHistory || addressHistory.length === 0) {
      try {
        const cMatch = document.cookie.match(/(?:^|;\s*)(?:user_address|address|last_address|saved_address)=([^;]+)/);
        if (cMatch) {
          const cAddr = decodeURIComponent(cMatch[1]).trim();
          if (cAddr) {
            addressHistory = [{ title: cAddr, lat: null, lng: null, uberVerified: false }];
          }
        }
      } catch (e) {}
    }

    const addrDatalist = document.getElementById('addr-list');

    if (addrDatalist) {

      addrDatalist.innerHTML = addressHistory.map(item => `<option value="${escapeHTML(item.title)}"></option>`).join('');

    }

    

    if (addressHistory.length > 0 && !isAddressSet) {

      const lastAddr = addressHistory[0];

      if (typeof lastAddr === 'object' && lastAddr.title) {

        document.getElementById('addrInput').value = lastAddr.title;

        scrollAddrToEnd();
        revealSubSections();
        if (typeof restorePrefsForAddress === 'function') {
          restorePrefsForAddress(lastAddr.title);
        }
        if (lastAddr.lat && lastAddr.lng) {
          setAddress(lastAddr.lat, lastAddr.lng, lastAddr.title);
        }
        // ⭐ 開啟網頁讀取地址時，自動向 UBER EAT 重新偵測與修正校準
        autoRefreshAndVerifyAddressFromUber(lastAddr.title, lastAddr);

      } else {

        localStorage.removeItem('finddog_history_address');

        addressHistory = [];

      }

    }

  }

  // ⭐ [自動地址校準機制] 開啟網頁讀取地址時，或地址未完整認證時，自動向 Uber Eats 重新偵測與修正校準
  async function autoRefreshAndVerifyAddressFromUber(rawTitle, fallbackItem) {
    if (!rawTitle) return;
    const cleanTitle = (rawTitle || '').replace(/^📍\s*/, '').trim();
    if (!cleanTitle) return;

    try {
      const apiBase = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) ? API_BASE_URL : '';
      const splitFn = window.splitAddressForUber || function(t) { return { searchQuery: t, extraSuffix: '' }; };
      const { searchQuery, extraSuffix } = splitFn(cleanTitle);
      const queryToSearch = searchQuery || cleanTitle;
      if (!queryToSearch) return;

      console.log('[自動地址校準] 正在向 Uber Eats 重新偵測地址:', queryToSearch);

      // 1. 向 Uber Eats 搜尋候選地址 mapsSearchV1
      const fallbackLat = (fallbackItem && fallbackItem.lat) ? fallbackItem.lat : (typeof currentLat !== 'undefined' && currentLat ? currentLat : 24.9665);
      const fallbackLng = (fallbackItem && fallbackItem.lng) ? fallbackItem.lng : (typeof currentLng !== 'undefined' && currentLng ? currentLng : 121.2646);

      const searchRes = await fetch(`${apiBase}/api/mapsSearchV1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryToSearch,
          lat: fallbackLat,
          lng: fallbackLng
        })
      });

      if (!searchRes.ok) {
        console.warn('[自動地址校準] mapsSearchV1 回應異常:', searchRes.status);
        return;
      }

      const searchData = await searchRes.json();
      const candidates = (searchData && searchData.candidates) ? searchData.candidates : [];
      if (!candidates || candidates.length === 0) {
        console.log('[自動地址校準] Uber 未找到匹配地址，維持現有設定');
        return;
      }

      // 2. 取第一筆最相符之候選 (Uber 官方標準地址)
      const bestCandidate = candidates[0];
      const placeId = bestCandidate.id;
      if (!placeId) return;

      // 3. 取得座標
      const reqInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placeId: placeId,
          provider: bestCandidate.provider || 'google_places',
          lat: fallbackLat,
          lng: fallbackLng
        })
      };

      let locRes = await fetch(`${apiBase}/api/getDeliveryLocationV2`, reqInit);
      let locData = locRes.ok ? await locRes.json() : null;
      if (!locData || locData.status !== 'success' || !locData.lat || !locData.lng) {
        locRes = await fetch(`${apiBase}/api/getDeliveryLocationV1`, reqInit);
        locData = locRes.ok ? await locRes.json() : null;
      }

      if (locData && locData.status === 'success' && locData.lat && locData.lng) {
          const baseFullAddr = (locData.title || bestCandidate.fullAddress || bestCandidate.addressLine1 || '').trim();
          let finalResolvedTitle = baseFullAddr;
          if (extraSuffix && !finalResolvedTitle.endsWith(extraSuffix)) {
            finalResolvedTitle = `${finalResolvedTitle}${extraSuffix}`;
          }

          console.log('✅ [自動地址校準] 成功自 Uber Eats 重新偵測取得精準座標與標準門牌:', finalResolvedTitle, locData.lat, locData.lng);

          // 更新全域變數與後端 session
          await setAddress(locData.lat, locData.lng, finalResolvedTitle);

          // 更新輸入框文字
          const addrInput = document.getElementById('addrInput');
          if (addrInput) {
            addrInput.value = finalResolvedTitle;
            if (typeof scrollAddrToEnd === 'function') scrollAddrToEnd();
          }

          // 寫入 localStorage 儲存 (保留既有地址之外送方式與備註習慣，上限維持 5 筆)
          let history = [];
          try {
            history = JSON.parse(localStorage.getItem('finddog_history_address') || '[]') || [];
          } catch(e) { history = []; }
          const resolvedKey = normalizeAddrPrefKey(finalResolvedTitle);
          const cleanKey = normalizeAddrPrefKey(cleanTitle);
          const matchedPrev = history.find(item => item && (normalizeAddrPrefKey(item.title) === resolvedKey || normalizeAddrPrefKey(item.title) === cleanKey));
          const preservedPrefs = pickPreservedAddrPrefs([matchedPrev, fallbackItem]);
          history = history.filter(item => item && normalizeAddrPrefKey(item.title) !== resolvedKey && normalizeAddrPrefKey(item.title) !== cleanKey);
          history.unshift({
            lat: locData.lat,
            lng: locData.lng,
            title: finalResolvedTitle,
            savedAt: Date.now(),
            uberVerified: true,
            ...preservedPrefs
          });
          if (history.length > 5) history = history.slice(0, 5);
          localStorage.setItem('finddog_history_address', JSON.stringify(history));
          addressHistory = history;

          if (typeof updateAddrTitleState === 'function') updateAddrTitleState('ok');
          if (typeof fetchDeliveryTimes === 'function') fetchDeliveryTimes();
        }
    } catch (e) {
      console.warn('[自動地址校準] 發生錯誤，保留目前地址:', e);
    }
  }
  window.autoRefreshAndVerifyAddressFromUber = autoRefreshAndVerifyAddressFromUber;


  function saveSimpleHistory(field) {

    const val = document.getElementById(field).value.trim();

    if (!val) return;

    let history = JSON.parse(localStorage.getItem('finddog_history_' + field)) || [];

    history = history.filter(item => item !== val);

    history.unshift(val);

    if (history.length > 5) history = history.slice(0, 5);

    localStorage.setItem('finddog_history_' + field, JSON.stringify(history));

    loadHistory();

  }



  function saveAddressHistory(lat, lng, title, placeId) {

    let history = [];
    try {
      history = JSON.parse(localStorage.getItem('finddog_history_address') || '[]') || [];
    } catch (e) { history = []; }

    const targetKey = normalizeAddrPrefKey(title);
    const existingItem = history.find(item => item && normalizeAddrPrefKey(item.title) === targetKey);
    const preservedPrefs = pickPreservedAddrPrefs([existingItem]);
    history = history.filter(item => item && normalizeAddrPrefKey(item.title) !== targetKey);

    // [修補] 加入儲存時間戳與 place_id，並保留該地址原有之外送方式與備註習慣
    const pid = placeId || (window.currentPlaceId || '');
    history.unshift({ lat, lng, title, place_id: pid, savedAt: Date.now(), ...preservedPrefs });

    if (history.length > 5) history = history.slice(0, 5);

    localStorage.setItem('finddog_history_address', JSON.stringify(history));

    addressHistory = history;

    loadHistory();

  }



  // 初始化 UI 與設定

  let liffInitPromise = null;

  document.addEventListener("DOMContentLoaded", async () => {
  // Restore delivery method and notes for ALL inputs
  const savedMethod = localStorage.getItem('userDeliveryMethod');
  const methodIds = ['deliveryMethod', 'checkoutDeliveryMethod', 'groceryDeliveryMethod'];
  const savedNotes = localStorage.getItem('userDeliveryNotes');
  const noteIds = ['deliveryNotes', 'checkoutDeliveryNotes', 'groceryDeliveryNotes'];
  const savedFoodNotes = localStorage.getItem('userFoodNotes');
  const foodNoteIds = ['foodNotes', 'checkoutFoodNotes', 'groceryFoodNotes'];

  methodIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
          if (savedMethod !== null) el.value = savedMethod;
          el.addEventListener('change', (e) => {
              const val = e.target.value;
              const isUserChange = !window._syncingDeliveryMethodDom && !window._restoringAddrDeliveryPrefs;
              localStorage.setItem('userDeliveryMethod', val);
              methodIds.forEach(otherId => {
                 if (otherId !== id && document.getElementById(otherId)) document.getElementById(otherId).value = val;
              });
              if (typeof setDeliveryMethod === 'function') {
                  setDeliveryMethod(val, isUserChange);
              }
          });
      }
  });
  if (savedMethod && typeof setDeliveryMethod === 'function') {
      setDeliveryMethod(savedMethod, false);
  }

  noteIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
          if (savedNotes !== null) el.value = savedNotes;
          el.addEventListener('input', (e) => {
              handleDeliveryNoteChange(e.target.value);
          });
      }
  });

  foodNoteIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
          if (savedFoodNotes !== null) el.value = savedFoodNotes;
          el.addEventListener('input', (e) => {
              localStorage.setItem('userFoodNotes', e.target.value);
              // sync others
              foodNoteIds.forEach(otherId => {
                 if (otherId !== id && document.getElementById(otherId)) document.getElementById(otherId).value = e.target.value;
              });
          });
      }
  });

  // 像備註一樣在使用者端保存團購密碼與暱稱
  const savedGbPwd = localStorage.getItem('userGroupBuyPassword');
  const gbPwdEl = document.getElementById('gbPasswordInput');
  if (gbPwdEl) {
      if (savedGbPwd !== null && savedGbPwd.trim() !== '') {
          gbPwdEl.value = savedGbPwd;
      }
      gbPwdEl.addEventListener('input', (e) => {
          localStorage.setItem('userGroupBuyPassword', e.target.value.trim());
      });
      gbPwdEl.addEventListener('change', (e) => {
          const val = e.target.value.trim();
          localStorage.setItem('userGroupBuyPassword', val);
          if (typeof saveSimpleHistory === 'function') saveSimpleHistory('gbPasswordInput');
      });
  }

  const savedGbNickname = localStorage.getItem('group_buy_user_name');
  const gbNameEl = document.getElementById('gbCreatorNameInput');
  if (gbNameEl) {
      if (savedGbNickname !== null && savedGbNickname.trim() !== '' && savedGbNickname.trim() !== '成員') {
          gbNameEl.value = savedGbNickname;
      }
      gbNameEl.addEventListener('input', (e) => {
          localStorage.setItem('group_buy_user_name', e.target.value.trim());
      });
      gbNameEl.addEventListener('change', (e) => {
          const val = e.target.value.trim();
          localStorage.setItem('group_buy_user_name', val);
          if (typeof saveSimpleHistory === 'function') saveSimpleHistory('gbCreatorNameInput');
      });
  }

  liffInitPromise = liff.init({ liffId: "2011657436-rGVj5SoG" }).catch(err => {
      console.error('LIFF init failed', err);
  });

    

    try {

      const configRes = await fetch('config.json?t=' + Date.now());

      if (configRes.ok) {

        const configData = await configRes.json();

        const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocalHost) {
          API_BASE_URL = window.location.origin;
        } else if (configData.api_url) {
          API_BASE_URL = configData.api_url.replace(/\/$/, '');
        } else if (configData.line_url) {
          API_BASE_URL = configData.line_url.replace(/\/$/, '');
        }

        if (configData.ws_url) WS_URL = configData.ws_url;

      }

    } catch (e) {

      console.log('找不到 config.json，將使用預設路徑。');

    }

    

    // Config 讀取完成後，再讀取歷史紀錄 (這樣 auto-setAddress 才會用到正確的 API_BASE_URL)

    loadHistory();

    initSchedulePicker();
    
    // Config loaded, API_BASE_URL is ready, now we can fetch times
    loadStoreBlacklist();
    if (typeof loadThreeHourStores === 'function') loadThreeHourStores();
    if (typeof loadPickupExcludeStores === 'function') loadPickupExcludeStores();
    fetchDeliveryTimes();
    loadServerStatusDot();
    if (!window._serverStatusWatchdog) {
      window._serverStatusWatchdog = setInterval(loadServerStatusDot, 20000);
    }
    if (typeof checkAndInitGroupBuyFromUrl === 'function') {
      checkAndInitGroupBuyFromUrl();
    }
  });



  
