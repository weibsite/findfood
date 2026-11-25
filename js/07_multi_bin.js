  // ========== 多單試算引擎 ==========

  

  function syncPhone(source) {

    const init = document.getElementById('initPhone');

    const chk = document.getElementById('checkoutPhone');

    const gro = document.getElementById('groceryPhone');



    if (source === 'init' && init) {

        localStorage.setItem('userPhone', init.value);

        if (chk) chk.value = init.value;

        if (gro) gro.value = init.value;

    } else if (source === 'checkout' && chk) {

        localStorage.setItem('userPhone', chk.value);

        if (init) init.value = chk.value;

        if (gro) gro.value = chk.value;

    } else if (source === 'grocery' && gro) {

        localStorage.setItem('userPhone', gro.value);

        if (init) init.value = gro.value;

        if (chk) chk.value = gro.value;

    }

  }




  async function checkCouponSettings() {
    try {
      const url = (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '') + '/order_service/api/coupon_settings';
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.auto_coupon_b_enabled !== 'undefined') {
          window.couponBEnabled = Boolean(data.auto_coupon_b_enabled);
          if (!window.couponBEnabled && window.currentSelectedPlan === '300') {
            window.currentSelectedPlan = '150';
          }
        }
      }
    } catch (e) {
      console.warn('checkCouponSettings warning:', e);
    }
  }

  function getPlanComparison(items) {
    if (!items || items.length === 0) return null;
    if (typeof isPlan300Eligible === 'function' && !isPlan300Eligible()) return null;
    const res150 = calcOrderCost(items, '150');
    const res300 = calcOrderCost(items, '300');
    const final150 = res150.shouldSplit ? res150.bestCost : res150.noBinCost;
    const final300 = res300.shouldSplit ? res300.bestCost : res300.noBinCost;
    let recommended = '150';
    let diff = 0;
    if (final300 < final150) {
      recommended = '300';
      diff = final150 - final300;
    } else if (final150 < final300) {
      recommended = '150';
      diff = final300 - final150;
    }
    return {
      res150,
      res300,
      final150,
      final300,
      recommended,
      diff,
      isEqual: final150 === final300
    };
  }

  function calcOrderCost(items, planType) {
    const activePlan = planType || window.currentSelectedPlan || '150';
    const isPlan300 = (activePlan === '300');
    const binTarget = isPlan300 ? 300 : 150;
    const maxPromo = isPlan300 ? 150 : 75;
    const feePerBin = isPlan300 ? 50 : 20;
    const splitThreshold = isPlan300 ? 520 : 280;

    let totalSum = 0;
    items.forEach(it => totalSum += it.price * it.qty);

    let promoDiscount = totalSum >= binTarget ? maxPromo : Math.floor(totalSum / 2);
    let preOrderDiscount = typeof getPreOrderDiscount === 'function' ? getPreOrderDiscount() : 0;
    const isPickup = (items && items.length > 0) ? items.every(it => it.storeCanPickup) : (localStorage.getItem('uberCartIsDiscount') === 'true');

    let totalExcessDeliveryFee = 0;
    if (!isPickup) {
      const sg = {};
      items.forEach(it => { if(!sg[it.storeName||'']) sg[it.storeName||'']=[]; sg[it.storeName||''].push(it); });
      Object.keys(sg).forEach(s => {
          totalExcessDeliveryFee += Math.max(0, ...sg[s].map(it => (it.storeCanPickup ? 0 : (it.storeDeliveryFee||0))));
      });
    }

    let noBinCost = (totalSum - promoDiscount) + feePerBin + totalExcessDeliveryFee - preOrderDiscount;

    let expanded = [];
    items.forEach(it => {
      for (let j = 0; j < it.qty; j++) {
        expanded.push({ 
          ...it,
          name: it.title || it.name, 
          price: it.price, 
          qty: 1,
          quantity: 1,
          storeName: it.storeName || (typeof currentStoreName !== 'undefined' ? currentStoreName : '未命名餐廳'), 
          note: it.note || '', 
          storeDeliveryFee: it.storeDeliveryFee || 0, 
          storeUrl: it.storeUrl || (typeof currentStoreUrl !== 'undefined' ? currentStoreUrl : '') || (window.groupBuyData?.store_url || '')
        });
      }
    });

    if (expanded.length <= 1) {
      return { 
        shouldSplit: false, 
        noBinCost, 
        bestCost: noBinCost, 
        bins: null, 
        savings: 0,
        planType: activePlan,
        feePerBin,
        maxPromo
      };
    }

    expanded.sort((a, b) => b.price - a.price);

    let bestBins = null;
    let bestCost = Infinity;

    for (let attempt = 0; attempt < 1000; attempt++) {
      let bins = [];
      let cur = [...expanded];
      if (attempt > 0) {
        for (let i = cur.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [cur[i], cur[j]] = [cur[j], cur[i]];
        }
      }

      for (let item of cur) {
        let placed = false;
        for (let bin of bins) {
          if (bin.sum + item.price <= binTarget) {
            bin.items.push(item);
            bin.sum += item.price;
            placed = true;
            break;
          }
        }
        if (!placed) {
          let maxGap = -1;
          let bestBin = null;
          for (let bin of bins) {
            if (bin.sum < binTarget && (binTarget - bin.sum) > maxGap) {
              maxGap = binTarget - bin.sum;
              bestBin = bin;
            }
          }
          if (bestBin && (bestBin.sum + item.price <= binTarget || Math.random() < 0.3)) {
            bestBin.items.push(item);
            bestBin.sum += item.price;
          } else {
            bins.push({ items: [item], sum: item.price });
          }
        }
      }

      let isASAP = (typeof scheduleMode === 'undefined' || scheduleMode === 'ASAP');
      if (!isASAP && typeof getSelectedScheduleTimestamp === 'function') {
          if (getSelectedScheduleTimestamp() - Date.now() < 2.99 * 3600000) {
              isASAP = true;
          }
      }
      let binLimit = (typeof isClosedStatusBypassed === 'function' && isClosedStatusBypassed()) ? 0 : 99;
      
      let validSplit = true;
      for (let bin of bins) {
        if (bin.sum < binLimit) {
          validSplit = false;
          break;
        }
      }

      if (validSplit) {
        let cost = 0;
        for (let bin of bins) {
          let binPromo = bin.sum >= binTarget ? maxPromo : Math.floor(bin.sum / 2);
          let binFoodCost = bin.sum - binPromo;
          let binExcess = 0;
          const bsg = {};
          bin.items.forEach(i => {
              if(!bsg[i.storeName||'']) bsg[i.storeName||'']=[];
              bsg[i.storeName||''].push(i);
          });
          if (!isPickup) {
              Object.keys(bsg).forEach(s => {
                  binExcess += Math.max(0, ...bsg[s].map(it => it.storeDeliveryFee||0));
              });
          }
          cost += binFoodCost + feePerBin + binExcess - preOrderDiscount;
        }

        if (cost < bestCost) {
          bestCost = cost;
          bestBins = bins;
        }
      }
    }

    return {
      shouldSplit: totalSum >= splitThreshold && expanded.length > 1 && bestBins && bestBins.length > 1 && bestCost < noBinCost,
      noBinCost,
      bestCost,
      bins: bestBins,
      savings: noBinCost - bestCost,
      planType: activePlan,
      feePerBin,
      maxPromo
    };
  }

function buildSplitSuggestionHtml(result) {

    if (!result.shouldSplit) return '';

    const canUsePlan300 = (!window.isGroceryStore && typeof isPlan300Eligible === 'function' && isPlan300Eligible());
    const isPlan300 = canUsePlan300 && (result && (result.planType === '300' || window.currentSelectedPlan === '300'));
    const color = isPlan300 ? '#276ef1' : '#f43f5e';
    const bgColor = isPlan300 ? '#eff6ff' : '#fff0f5';

    let html = `<div style="background:${bgColor}; border:2px solid ${color}; border-radius:12px; padding:15px; margin-top:15px;">`;

    html += `<div style="font-weight:bold; color:${color}; font-size:16px; text-align:center; margin-bottom:10px;">💡 多單優惠建議（${isPlan300 ? '$300內半價·' : '$150內半價·'}分成 ${result.bins.length} 單）</div>`;

    html += `<div style="text-align:center; margin-bottom:12px;">`;

    html += `<span style="text-decoration:line-through; color:#999;">不拆: $${result.noBinCost}</span>`;

    html += ` → <span style="color:#f43f5e; font-weight:bold;">多單優惠: $${result.bestCost}</span>`;

    html += ` <span style="color:#d32f2f; font-weight:bold;">省 $${result.savings}！</span>`;

    html += `</div>`;



    result.bins.forEach((bin, i) => {

      let counts = {};

      for (let item of bin.items) {

        let key = item.name;

        counts[key] = (counts[key] || 0) + 1;

      }

      let itemStrs = [];

      for (let key in counts) {

        itemStrs.push(counts[key] > 1 ? `${key} x${counts[key]}` : key);

      }

      html += `<div style="background:white; border:1px solid #eee; padding:10px; border-radius:8px; margin-bottom:6px;">`;

      html += `<div style="font-weight:bold; color:#333;">第 ${i+1} 單 <span style="color:#d32f2f;">$${bin.sum}</span></div>`;

      html += `<div style="font-size:13px; color:#666; margin-top:4px;">${itemStrs.join('、')}</div>`;

      html += `</div>`;

    });

    html += `</div>`;

    return html;

  }



  function buildSplitMsgText(result) {

    if (!result.shouldSplit || !result.bins) return '';

    let text = '\n\n💡 多單優惠建議（省 $' + result.savings + '）：';

    result.bins.forEach((bin, i) => {

      let counts = {};

      for (let item of bin.items) {

        let key = item.name;

        counts[key] = (counts[key] || 0) + 1;

      }

      let itemStrs = [];

      for (let key in counts) {

        itemStrs.push(counts[key] > 1 ? `${key} x${counts[key]}` : key);

      }

      text += `\n第 ${i+1} 單 $${bin.sum}：${itemStrs.join('、')}`;

    });

    return text;

  }



  window.errorModalCloseCallback = null;

  const _BYPASS_PWD_HASH = '5a9f126db7c29f9c';
  function _hashBypassPwd(s) {
    const x = 'ue_bp_' + String(s) + '_2026';
    let h1 = 0x811c9dc5, h2 = 0x9e3779b9;
    for (let i = 0; i < x.length; i++) {
        const c = x.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 0x01000193);
        h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b);
    }
    return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
  }

  // 🌟 檢查是否已由密碼解鎖忽略「暫時無法接單」狀態
  window.isClosedStatusBypassed = function() {
    try {
        const saved = localStorage.getItem('bypass_closed_status');
        return saved === _BYPASS_PWD_HASH || Boolean(saved && saved.length === 4 && _hashBypassPwd(saved) === _BYPASS_PWD_HASH);
    } catch (e) {
        return false;
    }
  };

  // 🌟 連續點擊圖片 5 次觸發輸入密碼邏輯
  window._sleepIconClickCount = 0;
  window._sleepIconTimer = null;
  window.handleSleepIconClick = function(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    const title = document.getElementById('errorModalTitle')?.innerText || '';
    if (title !== '目前暫時無法接單' && title !== '代訂睡覺中') {
        return;
    }
    window._sleepIconClickCount = (window._sleepIconClickCount || 0) + 1;
    clearTimeout(window._sleepIconTimer);
    window._sleepIconTimer = setTimeout(() => {
        window._sleepIconClickCount = 0;
    }, 2500);

    if (window._sleepIconClickCount >= 5) {
        window._sleepIconClickCount = 0;
        clearTimeout(window._sleepIconTimer);
        window.openBypassPasswordModal();
    }
  };

  window.openBypassPasswordModal = function() {
    const modal = document.getElementById('bypassClosedModal');
    const input = document.getElementById('bypassClosedPwdInput');
    const errMsg = document.getElementById('bypassClosedErrorMsg');
    if (errMsg) errMsg.style.display = 'none';
    if (input) input.value = '';
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => { if (input) input.focus(); }, 150);
    }
  };

  window.closeBypassPasswordModal = function() {
    const modal = document.getElementById('bypassClosedModal');
    if (modal) modal.style.display = 'none';
  };

  window.verifyBypassPassword = function() {
    const input = document.getElementById('bypassClosedPwdInput');
    const val = input ? input.value.trim() : '';
    if (_hashBypassPwd(val) === _BYPASS_PWD_HASH) {
        try {
            localStorage.setItem('bypass_closed_status', _BYPASS_PWD_HASH);
        } catch (e) {
            console.error('localStorage error', e);
        }
        window.closeBypassPasswordModal();
        const overlay = document.getElementById('errorModalOverlay');
        if (overlay) overlay.style.display = 'none';
        if (typeof showToast === 'function') {
            showToast('🔓 已解除暫時無法接單限制');
        }
    } else {
        const errMsg = document.getElementById('bypassClosedErrorMsg');
        if (errMsg) errMsg.style.display = 'block';
        if (input) {
            input.value = '';
            input.focus();
        }
    }
  };

  function clearHardModalLock() {
    window._hardModalLock = false;
    window._hardModalUnlockAt = 0;
    window._loadingModalLock = false;
    if (window._hardModalTimer) {
        clearInterval(window._hardModalTimer);
        window._hardModalTimer = null;
    }
    const card = document.getElementById('errorModalCard');
    if (card) {
        card.style.border = 'none';
        card.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
    }
    const titleEl = document.getElementById('errorModalTitle');
    if (titleEl) titleEl.style.color = '#111';
    const btn = document.getElementById('errorModalBtn');
    if (btn) {
        btn.disabled = false;
        btn.style.background = '#111';
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.innerText = '我知道了';
    }
  }

  function closeErrorModal(fromBackdrop = false) {
    const title = document.getElementById('errorModalTitle')?.innerText || '';
    if ((title === '代訂睡覺中' || title === '目前暫時無法接單') && !isClosedStatusBypassed()) {
        return;
    }
    if (window._loadingModalLock && fromBackdrop) {
        return;
    }
    if (window._hardModalLock) {
        if (fromBackdrop) return;
        if (Date.now() < (window._hardModalUnlockAt || 0)) return;
    }
    clearHardModalLock();
    const cb = window.errorModalCloseCallback;
    window.errorModalCloseCallback = null;
    const overlay = document.getElementById('errorModalOverlay');
    if (overlay) overlay.style.display = 'none';
    if (typeof cb === 'function') {
        cb();
    }
  }

  function showModal(title, text, isError = true, htmlContent = '', hideBtn = false, onClose = null) {
    if ((title === '目前暫時無法接單' || title === '代訂睡覺中') && isClosedStatusBypassed()) {
        return;
    }
    clearHardModalLock();
    window._loadingModalLock = Boolean(hideBtn && htmlContent && htmlContent.includes('spinner'));
    window.errorModalCloseCallback = (typeof onClose === 'function') ? onClose : null;
    if (typeof text === 'string' && (text.includes('<div') || text.includes('<button') || text.includes('<span') || text.includes('<p') || text.includes('<br>')) && !htmlContent) {
        htmlContent = text;
        text = '';
    }
    if (text && htmlContent && htmlContent.includes(text)) {
        text = '';
    }

    if (title === '代訂睡覺中' || title === '目前暫時無法接單') {
        document.getElementById('errorModalIcon').innerHTML = '<img class="sleep-icon-img" draggable="false" src="https://9ysong.shop/image/sleep.gif" style="height: 120px; width: auto; object-fit: contain; vertical-align: middle; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.1)); cursor: pointer; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: manipulation;">';
    } else if (title === '外送時間說明' || title === '外送方式說明') {
        document.getElementById('errorModalIcon').innerHTML = '<div style="font-size:42px; line-height:1;">ℹ️</div>';
    } else if (title === '購物車是空的') {
        document.getElementById('errorModalIcon').innerHTML = '<div style="font-size:48px; line-height:1;">🛒</div>';
    } else if (title.includes('密碼') || title.includes('權限')) {
        document.getElementById('errorModalIcon').innerHTML = '<div style="font-size:48px; line-height:1;">🔒</div>';
    } else if (title.includes('團購')) {
        document.getElementById('errorModalIcon').innerHTML = '<div style="font-size:48px; line-height:1;">👥</div>';
    } else if (title.includes('無法預約') || title.includes('無法為您代購') || title.includes('無法代購') || title.includes('超出外送範圍') || title.includes('尚未營業') || title.includes('無法開啟')) {
        document.getElementById('errorModalIcon').innerHTML = '<div style="font-size:48px; line-height:1;">🚫</div>';
    } else if (title.includes('時段') || title.includes('預約') || title.includes('代購')) {
        document.getElementById('errorModalIcon').innerHTML = '<div style="font-size:48px; line-height:1;">⏰</div>';
    } else if (title.includes('地址') || title.includes('送達')) {
        document.getElementById('errorModalIcon').innerHTML = '<div style="font-size:48px; line-height:1;">📍</div>';
    } else {
        document.getElementById('errorModalIcon').innerHTML = isError ? '<img draggable="false" src="https://9ysong.shop/image/wait.png" style="height: 120px; width: auto; object-fit: contain; vertical-align: middle; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.1));">' : '✅';
    }

    document.getElementById('errorModalIcon').style.color = isError ? '#d32f2f' : '#f43f5e';
    document.getElementById('errorModalTitle').innerText = title;

    const textEl = document.getElementById('errorModalText');
    if (text) {
        textEl.innerHTML = (typeof text === 'string' && text.includes('<') && text.includes('>')) 
            ? text 
            : escapeHTML(text).replace(/\n/g, '<br>');
        textEl.style.display = 'block';
    } else {
        textEl.innerHTML = '';
        textEl.style.display = 'none';
    }

    document.getElementById('errorModalExtra').innerHTML = htmlContent;
    const closeBtn = document.getElementById('errorModalCloseBtn');
    if (closeBtn) closeBtn.style.display = hideBtn ? 'none' : 'block';
    document.getElementById('errorModalBtn').style.display = hideBtn ? 'none' : 'block';
    document.getElementById('errorModalOverlay').style.display = 'flex';
  }

  function showHardBlockModal(title, text, onClose = null, cooldownMs = 500, htmlContent = '') {
    if (window._hardModalTimer) {
        clearInterval(window._hardModalTimer);
        window._hardModalTimer = null;
    }
    const noticeHtml = htmlContent || `
      <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:10px 12px; color:#b91c1c; font-size:13px; font-weight:700; line-height:1.5;">
        🚫 此店家目前無法接受預約或代訂，請勿重複點擊，請改選其他餐廳。
      </div>
    `;
    showModal(title || '無法預約代訂', text || '此餐廳目前無法預約或代訂，請選擇其他餐廳', true, noticeHtml, false, onClose);
    window._hardModalLock = true;
    window._hardModalUnlockAt = Date.now() + Math.max(0, cooldownMs || 0);
    const closeBtn = document.getElementById('errorModalCloseBtn');
    if (closeBtn) closeBtn.style.display = 'none';
    const card = document.getElementById('errorModalCard');
    if (card) {
        card.style.border = '3px solid #ef4444';
        card.style.boxShadow = '0 10px 35px rgba(239,68,68,0.35)';
    }
    const titleEl = document.getElementById('errorModalTitle');
    if (titleEl) titleEl.style.color = '#dc2626';
    const btn = document.getElementById('errorModalBtn');
    if (btn) {
        const updateBtnCountdown = () => {
            const remMs = (window._hardModalUnlockAt || 0) - Date.now();
            if (remMs > 0) {
                const sec = (remMs > 1000) ? Math.ceil(remMs / 1000) : (remMs / 1000).toFixed(1);
                btn.disabled = true;
                btn.style.background = '#9ca3af';
                btn.style.opacity = '0.85';
                btn.style.cursor = 'not-allowed';
                btn.innerText = `🚫 無法預約，請稍候 (${sec}s)`;
            } else {
                btn.disabled = false;
                btn.style.background = '#dc2626';
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
                btn.innerText = '確定（改選其他餐廳）';
                if (window._hardModalTimer) {
                    clearInterval(window._hardModalTimer);
                    window._hardModalTimer = null;
                }
            }
        };
        updateBtnCountdown();
        if (window._hardModalUnlockAt > Date.now()) {
            window._hardModalTimer = setInterval(updateBtnCountdown, 100);
        }
    }
  }

  function setOpenStoreShield(active) {
    const shield = document.getElementById('openStoreClickShield');
    if (shield) shield.style.display = active ? 'block' : 'none';
  }

  function isStoreSchedBlocked(uuid) {
    if (!uuid) return false;
    const modeNow = (typeof scheduleMode !== 'undefined' ? scheduleMode : window.scheduleMode) || 'ASAP';
    if (window._sessionUnschedulableBlocked && window._sessionUnschedulableBlocked[uuid]) {
        const entry = window._sessionUnschedulableBlocked[uuid];
        if (entry.hard !== false || entry.mode === modeNow) {
            return true;
        }
    }
    if (modeNow === 'SCHEDULE') {
        try {
            const list = JSON.parse(localStorage.getItem('unSchedulableStores') || '[]');
            if (Array.isArray(list) && list.includes(uuid)) return true;
        } catch (e) {}
    }
    return false;
  }

  function markStoreUnschedulable(uuid, title = '無法為您代購', msg = '此餐廳無法預約或代訂，請選擇其他餐廳', persistHard = true) {
    if (!window._sessionUnschedulableBlocked) window._sessionUnschedulableBlocked = {};
    const modeNow = (typeof scheduleMode !== 'undefined' ? scheduleMode : window.scheduleMode) || 'ASAP';
    if (uuid) {
        window._sessionUnschedulableBlocked[uuid] = { title, msg, mode: modeNow, hard: Boolean(persistHard), ts: Date.now() };
        if (persistHard) {
            try {
                const unSchedulableStores = JSON.parse(localStorage.getItem('unSchedulableStores') || '[]');
                if (!unSchedulableStores.includes(uuid)) {
                    unSchedulableStores.push(uuid);
                    localStorage.setItem('unSchedulableStores', JSON.stringify(unSchedulableStores));
                }
            } catch (e) {}
        }
    }
    if (!uuid || uuid === currentStoreUuid) {
        window.currentStoreSchedulable = false;
        window.currentStoreRawData = null;
        window.currentStoreAvailableWindows = [];
        window.currentStoreClosed = true;
    }
  }

  function abortBlockedStoreEntry(storeUuid, title, msg, resultsDiv, fallbackHtml, returnToHomeIfEmpty = false) {
    window.currentStoreRawData = null;
    window.currentStoreSchedulable = false;
    window.currentStoreAvailableWindows = [];
    window.currentStoreClosed = true;
    currentStoreUuid = '';
    currentStoreName = '';
    window.currentStoreUuid = '';
    window.currentStoreName = '';

    const sc = document.getElementById('storeContent');
    if (sc) sc.innerHTML = '';
    ['storeView', 'cartView', 'checkoutView', 'itemModal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    const gbBtn = document.getElementById('groupBuyBtn');
    if (gbBtn) gbBtn.style.display = 'none';
    const ssb = document.getElementById('storeSearchBtn');
    if (ssb) ssb.style.display = 'none';

    const cleanFallback = (typeof fallbackHtml === 'string' && !fallbackHtml.includes('<div class="spinner"></div>'))
        ? fallbackHtml
        : (window._lastValidResultsHtml || '');
    if (resultsDiv) {
        resultsDiv.innerHTML = cleanFallback;
    }

    const cardEl = storeUuid ? document.getElementById('card_' + storeUuid) : null;
    if (cardEl) {
        cardEl.style.filter = 'grayscale(100%)';
        cardEl.style.opacity = '0.6';
    }

    const hasResults = Boolean(resultsDiv && resultsDiv.children && resultsDiv.children.length > 0 && !resultsDiv.querySelector('.spinner'));
    if (returnToHomeIfEmpty || !hasResults) {
        const lv = document.getElementById('listView');
        if (lv) lv.style.display = 'none';
        const hv = document.getElementById('homeView');
        if (hv) hv.style.display = 'block';
        currentView = 'home';
        const mbBtn = document.getElementById('mainBackBtn') || document.getElementById('heroBackBtn');
        if (mbBtn) mbBtn.style.visibility = 'hidden';
    } else {
        const hv = document.getElementById('homeView');
        if (hv) hv.style.display = 'none';
        const lv = document.getElementById('listView');
        if (lv) lv.style.display = 'block';
        currentView = 'list';
        const mbBtn = document.getElementById('mainBackBtn') || document.getElementById('heroBackBtn');
        if (mbBtn) mbBtn.style.visibility = 'visible';
    }

    if (typeof updateCartBadge === 'function') updateCartBadge();
    showHardBlockModal(title, msg);
  }

window.renderSplitTab = function(plan) {
    let bins = plan === 'A' ? window._splitBinsA : window._splitBinsB;
    let currentIndex = plan === 'A' ? window._currentSplitIndexA : window._currentSplitIndexB;
    let origHtml = plan === 'A' ? window._splitOrigHtmlA : window._splitOrigHtmlB;
    let savings = plan === 'A' ? window._splitSavingsA : window._splitSavingsB;
    let bestCost = plan === 'A' ? window._splitBestCostA : window._splitBestCostB;
    let color = plan === 'A' ? '#f43f5e' : '#276ef1';
    
    if (!bins) return;
    for(let i = -1; i < bins.length; i++) {
        let dot = document.getElementById('split-dot-' + plan + '-' + i);
        if (dot) dot.style.background = (i === currentIndex) ? color : '#ccc';
    }

    const container = document.getElementById('splitTabContent' + plan);
    if (!container) return;

    if (currentIndex === -1) {
        container.innerHTML = origHtml;
        return;
    }

    const bin = bins[currentIndex];
    let counts = {};
    bin.items.forEach(item => { let key = item.name; counts[key] = (counts[key] || 0) + 1; });
    let itemStrs = [];
    for (let key in counts) itemStrs.push(counts[key] > 1 ? `${key} x${counts[key]}` : key);
    
    let binFood = bin.sum;
    const canUsePlan300 = (!window.isGroceryStore && typeof isPlan300Eligible === 'function' && isPlan300Eligible());
    let isPlan300 = canUsePlan300 && (plan === 'B' || window.currentSelectedPlan === '300');
    let maxPromo = isPlan300 ? 150 : 75;
    let promoCap = isPlan300 ? 300 : 150;
    let binPromo = (bin.sum >= promoCap ? maxPromo : Math.floor(bin.sum / 2));
    let binFee = isPlan300 ? 50 : 20;
    
    let bsg = {};
    bin.items.forEach(i => {
        let sn = i.storeName || '';
        if (!bsg[sn]) bsg[sn] = [];
        bsg[sn].push(i);
    });
    let binExcess = 0;
    const isDiscount = (bin.items && bin.items.length > 0) ? bin.items.every(it => it.storeCanPickup) : ((cart.length > 0) ? cart.every(it => it.storeCanPickup) : (localStorage.getItem('uberCartIsDiscount') === 'true'));
    if (!isDiscount) {
        Object.keys(bsg).forEach(s => {
            binExcess += Math.max(0, ...bsg[s].map(it => (it.storeCanPickup ? 0 : (it.storeDeliveryFee || 0))));
        });
    }
    const binPickupDisc = 0;
    
    let binPreorder = typeof getPreOrderDiscount === 'function' ? getPreOrderDiscount() : 0;
    
    let binTotal = binFood - binPromo + binFee + binExcess - binPreorder;
    
    let titleText = (plan === 'B' || window.currentSelectedPlan === '300') 
        ? '結帳明細 ($300內半價)' 
        : '結帳明細 ($150內半價)';
    let html = `
        <div style="font-weight:bold; color:${color}; margin-bottom:2px;">${titleText}</div>
        <div style="margin-bottom:6px; color:#666; font-size:12px; font-weight:bold;">第 ${currentIndex + 1} 單 / 共 ${bins.length} 單</div>
        <table style="margin: 0 auto; color: #666; font-size: 13px; border-collapse: collapse; text-align: left;">
            <tr><td style="text-align:right; padding:1px 4px 1px 0; white-space:nowrap;">小計:</td><td style="padding:1px 0 1px 4px; white-space:nowrap;"><span style="visibility:hidden">-</span>$${binFood}</td></tr>
            <tr><td style="text-align:right; padding:1px 4px 1px 0; color:${color}; white-space:nowrap;">優惠折抵:</td><td style="padding:1px 0 1px 4px; color:${color}; white-space:nowrap;">-$${binPromo}</td></tr>
            <tr><td style="text-align:right; padding:1px 4px 1px 0; white-space:nowrap;">代訂費:</td><td style="padding:1px 0 1px 4px; white-space:nowrap;"><span style="visibility:hidden">-</span>$${binFee}</td></tr>
            <tr><td style="text-align:right; padding:1px 4px 1px 0; white-space:nowrap;">外送加成:</td><td style="padding:1px 0 1px 4px; white-space:nowrap;"><span style="visibility:hidden">-</span>$${binExcess}</td></tr>
            <tr><td style="text-align:right; padding:1px 4px 1px 0; white-space:nowrap;">服務費:</td><td style="padding:1px 0 1px 4px; white-space:nowrap;"><span style="visibility:hidden">-</span>$0</td></tr>
            ${binPreorder > 0 ? `<tr><td style="text-align:right; padding:1px 4px 1px 0; color:${color}; white-space:nowrap;">預定折扣:</td><td style="padding:1px 0 1px 4px; color:${color}; white-space:nowrap;">-$${binPreorder}</td></tr>` : ''}
        </table>
        <div style="font-weight:bold; font-size:15px; margin-top:6px; border-top:1px solid #ccc; padding-top:4px;">
            本單總計: <span style="color:#d32f2f; font-size:18px;">$${binTotal}</span>
        </div>
        <div style="font-size:12px; color:#777; margin-top:4px; margin-bottom:6px; word-break:break-all; text-align:center; max-height:36px; overflow-y:auto; line-height:1.4;">
            包含餐點: ${itemStrs.join(', ')}
        </div>
    `;
    container.innerHTML = html;
};

window.switchSplitTab = function(plan, dir) {
    let bins = plan === 'A' ? window._splitBinsA : window._splitBinsB;
    if (!bins) return;
    if (plan === 'A') {
        window._currentSplitIndexA += dir;
        if (window._currentSplitIndexA < -1) window._currentSplitIndexA = bins.length - 1;
        if (window._currentSplitIndexA >= bins.length) window._currentSplitIndexA = -1;
    } else {
        window._currentSplitIndexB += dir;
        if (window._currentSplitIndexB < -1) window._currentSplitIndexB = bins.length - 1;
        if (window._currentSplitIndexB >= bins.length) window._currentSplitIndexB = -1;
    }
    window.renderSplitTab(plan);
};

