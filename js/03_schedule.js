  // --- [時段 API 串接] ---
  let uberTimeData = null;
  let isDeliveryTimesLoading = false;
  let isDeliveryTimesLoaded = false;
  let onDeliveryTimesLoadedCallback = null;

  
  async function fetchDeliveryTimes() {
    if (uberTimeData && uberTimeData.dates && uberTimeData.dates.length > 0) return; // Do not fetch again if we already have it
    
    isDeliveryTimesLoading = true;
    isDeliveryTimesLoaded = false;
    
    try {
      const targetUrl = API_BASE_URL ? `${API_BASE_URL}/api/delivery-times_v3` : 'https://api.9ysong.shop/api/delivery-times_v3';
      const res = await fetch(targetUrl, {
        method: 'GET'
      });
      let data;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/gzip')) {
          const ds = new DecompressionStream('gzip');
          const decompressedStream = res.body.pipeThrough(ds);
          const decompressedResponse = new Response(decompressedStream);
          const text = await decompressedResponse.text();
          data = JSON.parse(text);
      } else {
          data = await res.json();
      }
      
      if (data.status === 'success' && data.data && data.data.dates && data.data.timeRanges) {
        uberTimeData = data.data;
        renderDates();
      } else {
        throw new Error('無法取得時段');
      }
    } catch (e) {
      console.warn('線上時段取得失敗，啟用本地時段生成備援:', e);
      generateFallbackDeliveryTimes();
    }

    isDeliveryTimesLoading = false;
    isDeliveryTimesLoaded = true;

    if (onDeliveryTimesLoadedCallback) {
        onDeliveryTimesLoadedCallback();
        onDeliveryTimesLoadedCallback = null;
    }
  }

  function generateFallbackDeliveryTimes() {
    const dates = [];
    const timeRanges = {};
    const now = new Date();
    
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const d = new Date(now);
        d.setDate(d.getDate() + dayOffset);
        const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        dates.push(dStr);
        
        const ranges = [];
        let startMin = 0;
        if (dayOffset === 0) {
            const curTotalMin = now.getHours() * 60 + now.getMinutes();
            startMin = Math.ceil((curTotalMin + 15) / 15) * 15;
        }
        
        for (let m = startMin; m < 24 * 60; m += 15) {
            ranges.push({
                startTime: m,
                endTime: m + 30
            });
        }
        timeRanges[dStr] = ranges;
    }
    
    uberTimeData = { dates, timeRanges };
    renderDates();
  }

  function getAvailableTimeRangesCount(dStr) {
    if (!uberTimeData) return 0;
    const storeRaw = window.currentStoreRawData;
    let storeRanges = null;
    if (storeRaw && storeRaw.timeWindowPicker && storeRaw.timeWindowPicker.dates) {
        const matchingStoreDate = storeRaw.timeWindowPicker.dates.find(d => {
            if (d.date === dStr) return true;
            if (d.listItems && d.listItems.length > 0) {
                return d.listItems[0]?.timeWindowViewModel?.timeWindow?.date === dStr;
            }
            return false;
        });
        if (matchingStoreDate && matchingStoreDate.listItems && matchingStoreDate.listItems.length > 0) {
            storeRanges = [];
            matchingStoreDate.listItems.forEach(item => {
                const tw = item.timeWindowViewModel?.timeWindow;
                if (tw) {
                    storeRanges.push({
                        startTime: tw.startTime,
                        endTime: tw.endTime,
                        startTimeSeconds: tw.startTimeSeconds,
                        date: tw.date || dStr
                    });
                }
            });
            const sName = window.currentStoreName || (typeof currentStoreName !== 'undefined' ? currentStoreName : '') || storeRaw?.title || '';
            const isGr = window.isGroceryStore || (typeof currentVertical !== 'undefined' && currentVertical === 'SHOP');
            if (typeof interleaveThreeHourWindows === 'function') {
                storeRanges = interleaveThreeHourWindows(storeRanges, sName, isGr);
            }
        }
    }
    
    const ranges = (storeRanges && storeRanges.length > 0) ? storeRanges : (uberTimeData?.timeRanges?.[dStr] || []);
    if (!ranges || ranges.length === 0) return 0;
    
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isToday = (dStr === todayStr) || (new Date(dStr).toDateString() === now.toDateString());
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    let count = 0;
    for (let i = 0; i < ranges.length; i++) {
        const st = ranges[i].startTime || 0;
        if (isToday && st < currentMinutes) {
            continue;
        }
        count++;
    }
    return count;
  }

  function renderDates() {
    if (!uberTimeData || !uberTimeData.dates) return;
    const dateSelect = document.getElementById('modalDateSelect');
    dateSelect.innerHTML = '';
    
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    
    const storeRaw = window.currentStoreRawData;
    let datesList = uberTimeData.dates;
    if (storeRaw && storeRaw.timeWindowPicker && storeRaw.timeWindowPicker.dates && storeRaw.timeWindowPicker.dates.length > 0) {
        const sDates = storeRaw.timeWindowPicker.dates.map(d => {
            if (d.date) return d.date;
            if (d.listItems && d.listItems.length > 0) {
                return d.listItems[0]?.timeWindowViewModel?.timeWindow?.date;
            }
            return null;
        }).filter(Boolean);
        if (sDates.length > 0) datesList = sDates;
    }

    datesList.forEach((dStr, idx) => {
        const d = new Date(dStr);
        const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
        const isToday = (d.toDateString() === today.toDateString());
        
        // 挑選時間如果今日的時段已經沒有時段 就不需要有今日可以選
        if (isToday) {
            const availCount = getAvailableTimeRangesCount(dStr);
            if (availCount === 0) {
                return;
            }
        }
        
        let label = '';
        if (isToday) {
            label = `今天 (${d.getMonth()+1}/${d.getDate()} 週${dayNames[d.getDay()]})`;
        } else if (d.toDateString() === tomorrow.toDateString()) {
            label = `明天 (${d.getMonth()+1}/${d.getDate()} 週${dayNames[d.getDay()]})`;
        } else {
            label = `${d.getMonth()+1}/${d.getDate()} (週${dayNames[d.getDay()]})`;
        }
        const opt = document.createElement('option');
        opt.value = dStr;
        opt.text = label;
        dateSelect.appendChild(opt);
    });
    
    renderModalTimes();
    
    // Automatically set default trigger text
    const modalSelect = document.getElementById('modalTimeSelect');
    const scheduleSelect = document.getElementById('scheduleTime');
    if (modalSelect && scheduleSelect && modalSelect.options.length > 0 && modalSelect.options[0].value !== '') {
        if (typeof scheduleMode !== 'undefined' && scheduleMode === 'SCHEDULE') {
            if (scheduleSelect.options.length === 0) {
                const targetIdx = modalSelect.selectedIndex >= 0 ? modalSelect.selectedIndex : (modalSelect.options.length > 1 ? 1 : 0);
                const newOpt = document.createElement('option');
                newOpt.value = modalSelect.options[targetIdx].value;
                newOpt.text = modalSelect.options[targetIdx].text;
                scheduleSelect.appendChild(newOpt);
            }
            updateTriggerText();
        }
    }
    autoFixEmptyTime();
}

function autoFixEmptyTime() {
    const modalSelect = document.getElementById('modalTimeSelect');
    const dateSelect = document.getElementById('modalDateSelect');
    const scheduleSelect = document.getElementById('scheduleTime');
    if (!modalSelect || !dateSelect) return;
    const isCurrentValid = modalSelect.options.length > 0 && modalSelect.options[0].value !== '';
    if (!isCurrentValid && dateSelect.options.length > 0) {
        for (let i = 0; i < dateSelect.options.length; i++) {
            dateSelect.selectedIndex = i;
            renderModalTimes();
            if (modalSelect.options.length > 0 && modalSelect.options[0].value !== '') {
                if (scheduleSelect && typeof scheduleMode !== 'undefined' && scheduleMode === 'SCHEDULE') {
                    scheduleSelect.innerHTML = '';
                    const newOpt = document.createElement('option');
                    const selIdx = modalSelect.selectedIndex >= 0 ? modalSelect.selectedIndex : 0;
                    newOpt.value = modalSelect.options[selIdx].value;
                    newOpt.text = modalSelect.options[selIdx].text;
                    scheduleSelect.appendChild(newOpt);
                    if (typeof updateTriggerText === 'function') updateTriggerText();
                }
                break;
            }
        }
    }
}

function renderModalTimes() {
    const dateSelect = document.getElementById('modalDateSelect');
    if (!dateSelect) return;
    const dateStr = dateSelect.value;
    const timeSelect = document.getElementById('modalTimeSelect');
    if (!timeSelect) return;
    timeSelect.innerHTML = '';
    
    const storeRaw = window.currentStoreRawData;
    let storeRanges = null;
    if (storeRaw && storeRaw.timeWindowPicker && storeRaw.timeWindowPicker.dates) {
        const matchingStoreDate = storeRaw.timeWindowPicker.dates.find(d => {
            if (d.date === dateStr) return true;
            if (d.listItems && d.listItems.length > 0) {
                return d.listItems[0]?.timeWindowViewModel?.timeWindow?.date === dateStr;
            }
            return false;
        });
        if (matchingStoreDate && matchingStoreDate.listItems && matchingStoreDate.listItems.length > 0) {
            storeRanges = [];
            matchingStoreDate.listItems.forEach(item => {
                const tw = item.timeWindowViewModel?.timeWindow;
                if (tw) {
                    storeRanges.push({
                        startTime: tw.startTime,
                        endTime: tw.endTime,
                        startTimeSeconds: tw.startTimeSeconds,
                        date: tw.date || dateStr
                    });
                }
            });
            const sName = window.currentStoreName || (typeof currentStoreName !== 'undefined' ? currentStoreName : '') || storeRaw?.title || '';
            const isGr = window.isGroceryStore || (typeof currentVertical !== 'undefined' && currentVertical === 'SHOP');
            if (typeof interleaveThreeHourWindows === 'function') {
                storeRanges = interleaveThreeHourWindows(storeRanges, sName, isGr);
            }
        }
    }
    
    const ranges = (storeRanges && storeRanges.length > 0) ? storeRanges : (uberTimeData?.timeRanges?.[dateStr] || []);
    if (!ranges || ranges.length === 0) {
        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.text = '⚠️ 此日期已無可預約時段，請選擇其他日期';
        emptyOpt.disabled = true;
        emptyOpt.selected = true;
        timeSelect.appendChild(emptyOpt);
        if (typeof updateModalDiscountNotice === 'function') updateModalDiscountNotice();
        return;
    }
    
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isToday = (dateStr === todayStr) || (new Date(dateStr).toDateString() === now.toDateString());
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    let validCount = 0;
    ranges.forEach(w => {
        const st = w.startTime || 0;
        const et = w.endTime || 0;
        
        // 自動排除當前時間之前的時段
        if (isToday && st < currentMinutes) {
            return;
        }
        
        const h = Math.floor(st / 60);
        const m = st % 60;
        const endH = Math.floor(et / 60);
        const endM = et % 60;
        
        const startAmpm = h >= 12 ? '下午' : '上午';
        const endAmpm = endH >= 12 ? '下午' : '上午';
        const startH12 = h % 12 || 12;
        const endH12 = endH % 12 || 12;
        const startMM = m.toString().padStart(2, '0');
        const endMM = endM.toString().padStart(2, '0');
        
        let displayTitle = '';
        if (startAmpm === endAmpm) {
            displayTitle = `${getTimeEmoji(h)} ${startAmpm} ${startH12}:${startMM} - ${endH12}:${endMM}`;
        } else {
            displayTitle = `${getTimeEmoji(h)} ${startAmpm} ${startH12}:${startMM} - ${getTimeEmoji(endH)} ${endAmpm} ${endH12}:${endMM}`;
        }
        
        const isGr = window.isGroceryStore || (typeof currentVertical !== 'undefined' && currentVertical === 'SHOP');
        const isThreeHour = (et - st === 180) || w.isThreeHour;
        let disc = 0;
        let discStr = '';
        if (isGr) {
            if (isThreeHour) {
                disc = 25;
                discStr = '  (-$25)';
            }
        } else {
            const baseDate = new Date(dateStr + "T00:00:00+08:00");
            const slotTimeMs = baseDate.getTime() + (st * 60 * 1000);
            const diffMinutes = (slotTimeMs - now.getTime()) / 60000;
            disc = (diffMinutes >= 179) ? 10 : 5;
            discStr = `  (-$${disc})`;
        }

        const opt = document.createElement('option');
        opt.value = JSON.stringify({ date: dateStr, startTime: st, endTime: et, title: displayTitle, discount: disc });
        opt.text = `${displayTitle}${discStr}`;
        if (disc > 0) {
            opt.style.color = '#e11d48';
            opt.style.fontWeight = 'bold';
        } else {
            opt.style.color = '#111';
            opt.style.fontWeight = 'normal';
        }
        validCount++;
        timeSelect.appendChild(opt);
    });

    if (validCount === 0) {
        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.text = '⚠️ 此日期已無可預約時段，請選擇其他日期';
        emptyOpt.disabled = true;
        emptyOpt.selected = true;
        timeSelect.appendChild(emptyOpt);
    } else {
        // 換日時自動移到當前時段，而不是固定最上面時間
        let targetIdx = 0;
        let found = false;

        // 1. 優先尋找涵蓋當前時間的時段 (startTime <= currentMinutes < endTime)
        // 若有多個時段重疊（例如生鮮雜貨 3 小時時段與 30 分鐘/1 小時時段），優先選擇區間較短的標準時段
        let bestCoverDiff = Infinity;
        let bestCoverIdx = -1;
        for (let i = 0; i < timeSelect.options.length; i++) {
            try {
                const optData = JSON.parse(timeSelect.options[i].value);
                if (optData && typeof optData.startTime === 'number' && typeof optData.endTime === 'number') {
                    if (optData.startTime <= currentMinutes && currentMinutes < optData.endTime) {
                        const duration = optData.endTime - optData.startTime;
                        if (duration < bestCoverDiff) {
                            bestCoverDiff = duration;
                            bestCoverIdx = i;
                        }
                    }
                }
            } catch(e) {}
        }

        if (bestCoverIdx !== -1) {
            targetIdx = bestCoverIdx;
            found = true;
        }

        // 2. 若無涵蓋當前時間的時段，尋找當前時間之後的第一個時段 (startTime >= currentMinutes)
        if (!found) {
            for (let i = 0; i < timeSelect.options.length; i++) {
                try {
                    const optData = JSON.parse(timeSelect.options[i].value);
                    if (optData && typeof optData.startTime === 'number') {
                        if (optData.startTime >= currentMinutes) {
                            targetIdx = i;
                            found = true;
                            break;
                        }
                    }
                } catch(e) {}
            }
        }

        // 3. 若當天所有時段都在當前時間之前（例如當前時間已過該店家營業時間），選最接近當前時間的時段（最後一個時段）
        if (!found) {
            targetIdx = timeSelect.options.length - 1;
        }

        if (targetIdx >= 0 && targetIdx < timeSelect.options.length) {
            timeSelect.selectedIndex = targetIdx;
            timeSelect.options[targetIdx].selected = true;
        }
    }

    if (typeof updateModalDiscountNotice === 'function') updateModalDiscountNotice();
    
    // 即時同步時段到畫面 (若非即時訂單模式)
    if (typeof syncSelectedTimeToHome === 'function' && typeof scheduleMode !== 'undefined' && scheduleMode !== 'ASAP' && validCount > 0) {
        syncSelectedTimeToHome();
    }
}

function syncSelectedTimeToHome() {
    scheduleMode = 'SCHEDULE';
    const modalTime = document.getElementById('modalTimeSelect');
    const scheduleSelect = document.getElementById('scheduleTime');
    if (modalTime && modalTime.selectedIndex >= 0 && scheduleSelect) {
        const opt = modalTime.options[modalTime.selectedIndex];
        scheduleSelect.innerHTML = '';
        const newOpt = document.createElement('option');
        newOpt.value = opt.value;
        newOpt.text = opt.text;
        scheduleSelect.appendChild(newOpt);
        updateTriggerText();
        if (typeof updateStoreScheduleBadge === 'function') updateStoreScheduleBadge();
    }
}

function updateModalDiscountNotice() {
    const notice = document.getElementById('modalDiscountNotice');
    if (!notice) return;
    const timeSelect = document.getElementById('modalTimeSelect');
    if (!timeSelect || timeSelect.selectedIndex < 0 || timeSelect.options.length === 0) {
        notice.innerText = '';
        return;
    }
    const opt = timeSelect.options[timeSelect.selectedIndex];
    if (!opt) return;
    try {
        const parsed = JSON.parse(opt.value);
        if (parsed.discount && parsed.discount > 0) {
            notice.innerText = `✨ 預約優惠：本時段結帳可折抵 $${parsed.discount} 元 (-$${parsed.discount})`;
        } else {
            notice.innerText = '';
        }
    } catch(e) {
        notice.innerText = '';
    }
}

function openTimePickerModal() {
    if (!uberTimeData || !uberTimeData.dates) {
        fetchDeliveryTimes().then(() => {
            if (uberTimeData && uberTimeData.dates) {
                openTimePickerModal();
            }
        });
        return;
    }
    
    const storeRaw = window.currentStoreRawData;
    if (storeRaw && storeRaw.timeWindowPicker && storeRaw.timeWindowPicker.dates) {
        renderDates();
    }
    
    // 同步當前已選的日期與時段到彈窗選單
    const scheduleSelect = document.getElementById('scheduleTime');
    const dateSelect = document.getElementById('modalDateSelect');
    const timeSelect = document.getElementById('modalTimeSelect');
    if (scheduleMode === 'SCHEDULE' && scheduleSelect && scheduleSelect.value) {
        try {
            const parsed = JSON.parse(scheduleSelect.value);
            if (dateSelect && parsed.date) {
                const dateIdx = Array.from(dateSelect.options).findIndex(o => o.value === parsed.date);
                if (dateIdx !== -1 && dateSelect.selectedIndex !== dateIdx) {
                    dateSelect.selectedIndex = dateIdx;
                    renderModalTimes();
                }
            }
            if (timeSelect) {
                for (let i = 0; i < timeSelect.options.length; i++) {
                    try {
                        const optP = JSON.parse(timeSelect.options[i].value);
                        if (optP.startTime === parsed.startTime && optP.endTime === parsed.endTime) {
                            timeSelect.selectedIndex = i;
                            break;
                        }
                    } catch(e) {}
                }
            }
        } catch(e) {}
    } else {
        if (!timeSelect || timeSelect.options.length === 0 || timeSelect.options[0].value === '') {
            autoFixEmptyTime();
        }
    }
    
    if (typeof updateModalDiscountNotice === 'function') updateModalDiscountNotice();
    document.getElementById('timePickerModal').style.display = 'flex';
}

function getTargetScheduleDate(rawDataOrD) {
    const schedSelect = document.getElementById('scheduleTime');
    if (typeof scheduleMode !== 'undefined' && scheduleMode === 'SCHEDULE' && schedSelect && schedSelect.value) {
        try {
            const parsed = JSON.parse(schedSelect.value);
            if (parsed && parsed.date) return parsed.date;
        } catch(e) {}
    }
    // 非主動選擇未來預約日期時，嚴格鎖定檢查台灣今日，防止 ASAP 模式誤拿明日時段放行不可預約店家
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
}
window.getTargetScheduleDate = getTargetScheduleDate;

function checkStoreIsOpenNow(d, badgeTime) {
    try {
        if (!d) return false;
        const oflNow = d.orderForLaterInfo;
        const isExplicitlyClosedNow = Boolean(d.closedMessage && String(d.closedMessage).trim()) ||
            Boolean(oflNow && (oflNow.autoSurfaceBottomSheet || (oflNow.bottomSheetSubtitleMessage && String(oflNow.bottomSheetSubtitleMessage).includes('沒有營業')))) ||
            Boolean(d.tracking && d.tracking.storePayload && d.tracking.storePayload.storeAvailablityState === 'STORE_CLOSED') ||
            (d.isOpen === false) || (d.isOrderable === false);
        if (isExplicitlyClosedNow) {
            return false;
        }

        // 1. 若 Uber API 直接標記為營業中且可下單 (最直接權威狀態)
        if (d.isOpen === true && d.isOrderable === true && !d.closedMessage) {
            return true;
        }

        // 2. 檢查外部傳入或全域的 badgeTime / 標題副標 (例如 "10 到 20 分鐘", "15-25 分鐘")
        const bTime = badgeTime || window.currentStoreBadgeTime || document.getElementById('storeHeaderSubtitle')?.innerText || '';
        if (bTime) {
            const isMinText = (bTime.includes('分鐘') || bTime.includes('分')) &&
                !bTime.includes('後營業') &&
                !bTime.includes('開始營業') &&
                !bTime.includes('休息') &&
                !bTime.includes('未營業');
            if (isMinText) return true;
        }

        // 3. 由 d.hours (每日各營業區間) 判斷，支援跨午夜時段 (如 10:30 到 00:59，即 st > et)
        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();
        const dayNum = now.getDay();

        if (d && Array.isArray(d.hours) && d.hours.length > 0) {
            const dayMap = { '日': 0, '天': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };
            for (const h of d.hours) {
                const dr = h.dayRange || '';
                let isDay = false;
                if (!dr || dr.includes('每天') || dr.includes('每日') || dr.includes('全天')) {
                    isDay = true;
                } else {
                    const m = dr.match(/(?:星期|週|周)?([一二三四五六日天])\s*(?:-|至|~)\s*(?:星期|週|周)?([一二三四五六日天])/);
                    if (m) {
                        const s = dayMap[m[1]];
                        const e = dayMap[m[2]];
                        if (s !== undefined && e !== undefined) {
                            isDay = (s <= e) ? (dayNum >= s && dayNum <= e) : (dayNum >= s || dayNum <= e);
                        }
                    }
                    if (!isDay) {
                        const singleMatches = [...dr.matchAll(/(?:星期|週|周)?([一二三四五六日天])/g)];
                        if (singleMatches.length > 0) {
                            isDay = singleMatches.some(sm => dayMap[sm[1]] === dayNum);
                        }
                    }
                }
                if (isDay && Array.isArray(h.sectionHours) && h.sectionHours.length > 0) {
                    const inShift = h.sectionHours.some(sh => {
                        const st = sh.startTime || 0;
                        const et = sh.endTime || 0;
                        if (st <= et) {
                            return currentMins >= st && currentMins < et;
                        } else {
                            // 跨午夜時段 (如 10:30 到 凌晨 00:59)
                            return currentMins >= st || currentMins < et;
                        }
                    });
                    if (inShift) return true;
                }
            }
        }
    } catch (e) {
        console.error('checkStoreIsOpenNow error:', e);
    }
    return false;
}
window.checkStoreIsOpenNow = checkStoreIsOpenNow;

function extractStorePickerWindowsForDate(rawData, targetDate) {
    const pickerWindows = [];
    if (!rawData || !rawData.timeWindowPicker || !Array.isArray(rawData.timeWindowPicker.dates)) {
        return pickerWindows;
    }
    rawData.timeWindowPicker.dates.forEach(dateObj => {
        if (!dateObj) return;
        const objDate = dateObj.date
            || (Array.isArray(dateObj.listItems) && dateObj.listItems[0]?.timeWindowViewModel?.timeWindow?.date)
            || (Array.isArray(dateObj.timeWindows) && dateObj.timeWindows[0]?.date)
            || '';
        // 嚴格比對目標日期，絕不退回 dates[0] 拿明日時段充當今日可預約
        if (objDate !== targetDate) return;

        if (Array.isArray(dateObj.listItems)) {
            dateObj.listItems.forEach(item => {
                if (!item || item.isDisabled === true) return;
                const vm = item.timeWindowViewModel;
                if (vm && (vm.isDisabled === true || vm.isSelectable === false)) return;
                const tw = vm && vm.timeWindow;
                if (tw && (!tw.date || tw.date === targetDate) && (typeof tw.startTimeSeconds === 'number' || typeof tw.startTime === 'number')) {
                    pickerWindows.push(tw);
                }
            });
        }
        if (Array.isArray(dateObj.timeWindows)) {
            dateObj.timeWindows.forEach(tw => {
                if (!tw || tw.isDisabled === true || tw.isSelectable === false) return;
                if ((!tw.date || tw.date === targetDate) && (typeof tw.startTimeSeconds === 'number' || typeof tw.startTime === 'number')) {
                    pickerWindows.push(tw);
                }
            });
        }
    });
    return pickerWindows;
}
window.extractStorePickerWindowsForDate = extractStorePickerWindowsForDate;

function checkStoreSchedulability(rawData, overrideTargetDate) {
    const ofl = rawData ? rawData.orderForLaterInfo : null;
    const subMsg = (ofl && ofl.bottomSheetSubtitleMessage) ? String(ofl.bottomSheetSubtitleMessage) : '';
    const titleMsg = (ofl && ofl.bottomSheetTitleMessage) ? String(ofl.bottomSheetTitleMessage) : '';
    const blockedPhrases = [
        '要等到營業時間才會接受訂單',
        '不接受預約訂單',
        '不接受預約',
        '目前不接受預約',
        '不支援預約',
        '無法預約',
        '暫不接受預約',
        '暫不開放預約',
        '無法接受預約'
    ];
    const isProhibitedByUber = Boolean(
        !rawData ||
        (ofl && (
            ofl.bottomSheetPrimaryButtonAction === 'DISMISS' ||
            ofl.bottomSheetPrimaryButtonAction === 'SWITCH_ASAP' ||
            ofl.bottomSheetPrimaryButtonMessage === '查看商家' ||
            blockedPhrases.some(k => subMsg.includes(k) || titleMsg.includes(k)) ||
            ofl.isSchedulable === false
        )) ||
        (rawData.scheduledOrderInfo && rawData.scheduledOrderInfo.isSchedulable === false) ||
        (rawData.isSchedulable === false)
    );

    const isExplicitlySchedulable = Boolean(
        (rawData && rawData.scheduledOrderInfo && rawData.scheduledOrderInfo.isSchedulable === true) ||
        (ofl && ofl.isSchedulable === true) ||
        (rawData && rawData.isSchedulable === true)
    );

    const todayTw = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
    let targetDate = overrideTargetDate || ((typeof getTargetScheduleDate === 'function') ? getTargetScheduleDate(rawData) : todayTw);
    let pickerWindows = extractStorePickerWindowsForDate(rawData, targetDate);
    let hasTodayPickerSlots = pickerWindows.length > 0;

    const hasAdaptedDates = Boolean(rawData && rawData.adaptedDeliveryHoursInfos && Array.isArray(rawData.adaptedDeliveryHoursInfos.dates) && rawData.adaptedDeliveryHoursInfos.dates.length > 0);
    let hasTodayDeliveryHours = hasAdaptedDates ? rawData.adaptedDeliveryHoursInfos.dates.includes(targetDate) : true;

    let usedFutureFallbackDate = false;

    // 若今日無可預約時段（如晚上點早餐店，或打烊前最後一小時今日預約名額已關閉），且 Uber 明確開放未來日期預約，則改取最近一個有效可預約日
    if (!overrideTargetDate && !isProhibitedByUber && isExplicitlySchedulable && (!hasTodayPickerSlots || !hasTodayDeliveryHours)) {
        const pickerDates = (rawData && rawData.timeWindowPicker && Array.isArray(rawData.timeWindowPicker.dates))
            ? rawData.timeWindowPicker.dates.slice()
            : [];
        const sortedDates = pickerDates
            .map(dObj => dObj && (dObj.date
                || (Array.isArray(dObj.listItems) && dObj.listItems[0]?.timeWindowViewModel?.timeWindow?.date)
                || (Array.isArray(dObj.timeWindows) && dObj.timeWindows[0]?.date)
                || ''))
            .filter(ds => ds && ds > todayTw)
            .sort();
        for (const candDate of sortedDates) {
            if (hasAdaptedDates && !rawData.adaptedDeliveryHoursInfos.dates.includes(candDate)) continue;
            const candWins = extractStorePickerWindowsForDate(rawData, candDate);
            if (candWins.length > 0) {
                targetDate = candDate;
                pickerWindows = candWins;
                hasTodayPickerSlots = true;
                hasTodayDeliveryHours = true;
                usedFutureFallbackDate = true;
                break;
            }
        }
    }

    const isSchedulable = !isProhibitedByUber && isExplicitlySchedulable && hasTodayDeliveryHours && hasTodayPickerSlots;
    return {
        isProhibitedByUber,
        isExplicitlySchedulable,
        targetDate,
        pickerWindows,
        hasTodayPickerSlots,
        hasTodayDeliveryHours,
        usedFutureFallbackDate,
        isSchedulable
    };
}
window.checkStoreSchedulability = checkStoreSchedulability;

function isPxmartAsapBypassAllowed(rawData, storeName) {
    const mode = (typeof scheduleMode !== 'undefined' ? scheduleMode : window.scheduleMode) || 'ASAP';
    if (mode !== 'ASAP') return false;
    const sName = String(storeName || (typeof currentStoreName !== 'undefined' ? currentStoreName : '') || (rawData && rawData.title) || '');
    if (typeof isPxmartName !== 'function' || !isPxmartName(sName)) return false;
    if (!rawData || rawData.isOpen === false || rawData.isOrderable === false) return false;
    if (rawData.closedMessage && String(rawData.closedMessage).trim()) return false;
    const sched = checkStoreSchedulability(rawData);
    return !sched.isProhibitedByUber && sched.hasTodayDeliveryHours;
}
window.isPxmartAsapBypassAllowed = isPxmartAsapBypassAllowed;

function isSelectedTimeWithinOpenTolerance(selectedTime, nowSec, availableWindows) {
    if (!availableWindows || availableWindows.length === 0) return false;
    if ((selectedTime - nowSec > 90 * 60) || (selectedTime < nowSec - 900)) return false;
    const firstWin = availableWindows[0];
    if (!firstWin || !firstWin.startTimeSeconds) return false;
    const firstDuration = (firstWin.endTime && firstWin.startTime) ? (firstWin.endTime - firstWin.startTime) * 60 : 1800;
    const selectedTwDate = new Date(selectedTime * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
    const firstWinTwDate = firstWin.date || new Date(firstWin.startTimeSeconds * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
    return (firstWinTwDate === selectedTwDate) && (selectedTime <= firstWin.startTimeSeconds + firstDuration);
}

function validateStoreSchedule() {
    let windows = window.currentStoreAvailableWindows || [];
    const rawData = window.currentStoreRawData;
    const isGr = window.isGroceryStore || (typeof currentVertical !== 'undefined' && currentVertical === 'SHOP');
    const tType = isGr ? '商店' : '餐廳';
    const cartUuid = (typeof cart !== 'undefined' && Array.isArray(cart) && cart.length > 0) ? (cart[0].storeUuid || '') : '';
    const cartStoreName = (typeof cart !== 'undefined' && Array.isArray(cart) && cart.length > 0) ? (cart[0].storeName || '') : '';
    const activeUuid = (typeof currentStoreUuid !== 'undefined' && currentStoreUuid) ? currentStoreUuid : cartUuid;
    const activeName = (typeof currentStoreName !== 'undefined' && currentStoreName) ? currentStoreName : cartStoreName;

    if (window.currentStoreSchedulable === false || (activeUuid && typeof isStoreSchedBlocked === 'function' && isStoreSchedBlocked(activeUuid))) {
        return { valid: false, reason: 'NOT_SCHEDULABLE', text: `此${tType}無法預約或代訂，請選擇其他${tType}` };
    }

    // 規範檢查：預約單與即時單均需確認店家明確支援預約且目標日具備有效配送時段（全聯即時營業特規除外）
    if (rawData) {
        const schedStatus = checkStoreSchedulability(rawData);
        const isSched = schedStatus.isSchedulable;
        const pxmartAllowed = isPxmartAsapBypassAllowed(rawData, activeName);

        if (windows.length === 0 && (isSched || pxmartAllowed)) {
            windows = schedStatus.pickerWindows.slice();
            if (typeof interleaveThreeHourWindows === 'function') {
                windows = interleaveThreeHourWindows(windows, activeName, isGr);
            }
            window.currentStoreAvailableWindows = windows;
        }

        if (!pxmartAllowed && (!isSched || windows.length === 0)) {
            if (typeof markStoreUnschedulable === 'function' && activeUuid) {
                markStoreUnschedulable(activeUuid, '無法為您代購', `此${tType}無法代訂，請選擇其他${tType}`);
            }
            return { valid: false, reason: 'NOT_SCHEDULABLE', text: `此${tType}無法代訂，請選擇其他${tType}` };
        }
    } else {
        const isPxmartAsapCart = Boolean(
            typeof isPxmartName === 'function' && isPxmartName(activeName) &&
            typeof scheduleMode !== 'undefined' && scheduleMode === 'ASAP'
        );
        if (!isPxmartAsapCart && window.currentStoreSchedulable !== true) {
            try {
                const unList = JSON.parse(localStorage.getItem('unSchedulableStores') || '[]');
                if (activeUuid && Array.isArray(unList) && unList.includes(activeUuid)) {
                    return { valid: false, reason: 'NOT_SCHEDULABLE', text: `此${tType}無法代訂，請選擇其他${tType}` };
                }
            } catch (e) {}
            return { valid: false, reason: 'NOT_SCHEDULABLE_UNVERIFIED', text: `尚未驗證此${tType}可否預約接單，請先重新進入${tType}確認` };
        }
    }

    if (scheduleMode === 'ASAP') {
        const isCurrentlyOpen = (typeof checkStoreIsOpenNow === 'function' && rawData) ? checkStoreIsOpenNow(rawData) : !window.currentStoreClosed;
        if (window.currentStoreClosed || !isCurrentlyOpen) {
            return { valid: false, reason: 'ASAP_CLOSED', text: '即時訂單' };
        }
        return { valid: true, text: '即時訂單' };
    } else if (scheduleMode === 'SCHEDULE') {
        const scheduleSelect = document.getElementById('scheduleTime');
        const selectedScheduleValue = scheduleSelect ? scheduleSelect.value : '';
        let selectedScheduleText = scheduleSelect && scheduleSelect.selectedIndex >= 0 ? scheduleSelect.options[scheduleSelect.selectedIndex].text : '';
        if (selectedScheduleText.startsWith('今天 ')) selectedScheduleText = selectedScheduleText.substring(3);

        if (!selectedScheduleValue) {
            return { valid: false, reason: 'NO_SCHEDULE_SELECTED', text: '尚未選擇時段' };
        }

        const selectedTime = getSelectedScheduleTimestamp() / 1000;
        let timeFound = false;

        if (windows.length > 0) {
            for (const tw of windows) {
                const duration = (tw.endTime && tw.startTime) ? (tw.endTime - tw.startTime) * 60 : 1800;
                if (selectedTime >= tw.startTimeSeconds && selectedTime <= tw.startTimeSeconds + duration) {
                    timeFound = true;
                    break;
                }
            }
        }
        if (!timeFound && rawData) {
            const fallbackWins = extractStorePickerWindowsForDate(rawData, getTargetScheduleDate(rawData));
            for (const tw of fallbackWins) {
                if (tw && tw.startTimeSeconds) {
                    const duration = (tw.endTime && tw.startTime) ? (tw.endTime - tw.startTime) * 60 : 1800;
                    if (selectedTime >= tw.startTimeSeconds && selectedTime <= tw.startTimeSeconds + duration) {
                        timeFound = true;
                        break;
                    }
                }
            }
        }

        const nowSec = Date.now() / 1000;
        const isCurrentlyOpen = (typeof checkStoreIsOpenNow === 'function' && rawData) ? checkStoreIsOpenNow(rawData) : false;
        if (!timeFound && isCurrentlyOpen && isSelectedTimeWithinOpenTolerance(selectedTime, nowSec, windows)) {
            timeFound = true;
        }

        if (!timeFound) {
            return { valid: false, reason: 'SCHEDULE_TIME_INVALID', text: selectedScheduleText };
        }

        return { valid: true, text: selectedScheduleText };
    }

    return { valid: true };
}
window.validateStoreSchedule = validateStoreSchedule;

function formatScheduleSlotDayLabel(sd) {
    const slotTw = sd.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
    const todayTw = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
    if (slotTw === todayTw) return '今天';
    return `${sd.getMonth() + 1}/${sd.getDate()}`;
}

function showStoreScheduleModal({ invalidScheduleText = '', isCheckout = false } = {}) {
    let windows = window.currentStoreAvailableWindows || [];
    const rawData = window.currentStoreRawData;
    if (windows.length === 0 && rawData && rawData.timeWindowPicker && rawData.timeWindowPicker.dates) {
        const schedStatus = (typeof checkStoreSchedulability === 'function') ? checkStoreSchedulability(rawData) : null;
        if (schedStatus && Array.isArray(schedStatus.pickerWindows) && schedStatus.pickerWindows.length > 0) {
            windows = schedStatus.pickerWindows.slice();
        } else {
            const todayTw = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
            const targetDate = (typeof getTargetScheduleDate === 'function') ? getTargetScheduleDate(rawData) : todayTw;
            windows = extractStorePickerWindowsForDate(rawData, targetDate);
        }
        const isGr = window.isGroceryStore || (typeof currentVertical !== 'undefined' && currentVertical === 'SHOP');
        if (typeof interleaveThreeHourWindows === 'function') {
            windows = interleaveThreeHourWindows(windows, currentStoreName, isGr);
        }
        window.currentStoreAvailableWindows = windows;
    }

    const tType = (typeof currentVertical !== 'undefined' && currentVertical === 'SHOP') ? '商店' : '餐廳';
    const notice = window.currentStoreClosedNotice ? `（${escapeHTML(window.currentStoreClosedNotice)}）` : '';
    const safeName = (typeof currentStoreName !== 'undefined' && currentStoreName) ? currentStoreName.replace(/'/g, "%27") : '';
    const safeAction = (typeof currentStoreUrl !== 'undefined' && currentStoreUrl) ? normalizeUberActionPath(currentStoreUrl).replace(/'/g, "%27") : '';
    const isCurrentlyOpen = (typeof checkStoreIsOpenNow === 'function' && rawData) ? checkStoreIsOpenNow(rawData) : false;

    if (windows.length === 0 && !isCurrentlyOpen) {
        showModal('店家目前尚未營業', `此${tType}${notice}目前已打烊且未提供預約時段，無法接單。`, true, `<button onclick="document.getElementById('errorModalOverlay').style.display='none';" style="margin-top:15px; background:#f43f5e; color:#fff; border:none; border-radius:8px; padding:12px; width:100%; font-size:15px; font-weight:bold; cursor:pointer;">我知道了</button>`, true);
        return;
    }

    let btnsHtml = '';

    // 如果店家當下正在營業，提供「改成即時單」按鈕
    if (isCurrentlyOpen) {
        const asapClickAction = isCheckout
            ? `document.getElementById('errorModalOverlay').style.display='none'; window.currentStoreClosed = false; window.mustSelectScheduleBeforeCheckout = false; confirmTimePicker('ASAP', true, true); if (typeof updateStoreScheduleBadge === 'function') updateStoreScheduleBadge(); setTimeout(() => { if (window.isGroceryStore && typeof openGroceryCheckoutSummary === 'function') openGroceryCheckoutSummary(); else if (typeof openCheckoutSummary === 'function') openCheckoutSummary(); }, 150);`
            : `document.getElementById('errorModalOverlay').style.display='none'; window.currentStoreClosed = false; window.mustSelectScheduleBeforeCheckout = false; confirmTimePicker('ASAP', true, true); if (typeof updateStoreScheduleBadge === 'function') updateStoreScheduleBadge();`;

        btnsHtml += `<button onclick="${asapClickAction}" style="margin-top:5px; margin-bottom:12px; background:#fff; color:#000; border:2px solid #000; border-radius:8px; padding:12px; width:100%; cursor:pointer; font-weight:bold; text-align:center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">🚀 改成即時單 (約 10~25 分鐘送達)<br><span style="color:#d32f2f; font-size:12px; font-weight:normal;">*無法獲得預約優惠</span></button>`;
    }

    if (windows.length > 0) {
        if (isCurrentlyOpen) {
            btnsHtml += `<div style="color:#111; text-align:center; font-weight:bold; margin-bottom:8px; font-size:14px;">👉 或選擇可接單的預約時段 (點擊切換)：</div>`;
        }
        const top6 = windows.slice(0, 6);
        top6.forEach(tw => {
            const durationSec = (tw.endTime && tw.startTime) ? (tw.endTime - tw.startTime) * 60 : 1800;
            const sd = new Date(tw.startTimeSeconds * 1000);
            const ed = new Date((tw.startTimeSeconds + durationSec) * 1000);
            const formatT = (dt) => {
                const h = dt.getHours();
                const m = String(dt.getMinutes()).padStart(2, '0');
                const ampm = h >= 12 ? '下午' : '上午';
                const h12 = h % 12 || 12;
                return (typeof getTimeEmoji === 'function' ? getTimeEmoji(h) : '📅') + ` ${ampm} ${h12}:${m}`;
            };
            const dayStr = formatScheduleSlotDayLabel(sd);
            const sAmpm = sd.getHours() >= 12 ? '下午' : '上午';
            const eAmpm = ed.getHours() >= 12 ? '下午' : '上午';
            let str;
            if (sAmpm === eAmpm) {
                const sH12 = sd.getHours() % 12 || 12;
                const eH12 = ed.getHours() % 12 || 12;
                const sMM = String(sd.getMinutes()).padStart(2, '0');
                const eMM = String(ed.getMinutes()).padStart(2, '0');
                const emoji = typeof getTimeEmoji === 'function' ? getTimeEmoji(sd.getHours()) : '📅';
                str = `${dayStr} ${emoji} ${sAmpm} ${sH12}:${sMM}-${eH12}:${eMM}`;
            } else {
                str = `${dayStr} ${formatT(sd)} - ${formatT(ed)}`;
            }
            const isGr = window.isGroceryStore || (typeof currentVertical !== 'undefined' && currentVertical === 'SHOP');
            if (typeof getSlotDiscountInfo === 'function') {
                const discInfo = getSlotDiscountInfo(tw, isGr);
                str += discInfo.tagHtml;
            }

            const clickFunc = isCheckout ? 'quickSetScheduleAndProceed' : 'quickSetSchedule';
            btnsHtml += `<button onclick="${clickFunc}(${tw.startTimeSeconds}, '${currentStoreUuid || ''}', '${encodeURIComponent(safeName)}', '${safeAction}', ${tw.startTime || 0}, ${tw.endTime || 0})" style="margin-top:8px; background:#f0f0f0; color:#111; border:1px solid #ccc; border-radius:8px; padding:10px; width:100%; cursor:pointer; font-weight:bold; text-align:center;">${str}</button>`;
        });
    }

    let promptHtml = '';
    let modalTitle = '請選擇可預約時段';
    if (invalidScheduleText) {
        promptHtml = `
            此${tType}${notice}在您選的時段 ( <b>${escapeHTML(invalidScheduleText)}</b> ) 休息或未開放此預約時段。<br>
            <span style="color:#f43f5e; font-weight:bold;">請選擇可接單的送達時段：</span>
        `;
    } else {
        modalTitle = '店家目前尚未營業';
        promptHtml = `
            此${tType}${notice}目前尚未營業，無法以「盡快送達」結帳。<br>
            <span style="color:#f43f5e; font-weight:bold;">請選擇預約送達時段以完成訂單：</span>
        `;
    }

    const cancelBtnText = isCheckout ? '返回' : '返回上一頁';
    const content = `
        <div style="text-align:center; font-size:15px; margin-bottom:12px; line-height:1.6; color:#333;">
            ${promptHtml}
        </div>
        <div style="max-height:220px; overflow-y:auto; padding:2px;">
            ${btnsHtml}
        </div>
        <button onclick="closeErrorModal();" style="margin-top:12px; background:#fff; color:#555; border:1px solid #ccc; border-radius:8px; padding:10px; width:100%; cursor:pointer; font-weight:bold; font-size:14px;">${cancelBtnText}</button>
    `;

    showModal(modalTitle, '', true, content, true, isCheckout ? null : function() {
        handleMainBack();
    });
}
window.showStoreScheduleModal = showStoreScheduleModal;

function showScheduleSelectModalForClosedStore() {
    showStoreScheduleModal({ isCheckout: true });
}
window.showScheduleSelectModalForClosedStore = showScheduleSelectModalForClosedStore;

function handleStoreScheduleValidation(triggerSource = '') {
    if (typeof currentView === 'undefined' || currentView !== 'store') return;
    if (!window.currentStoreRawData) return;
    
    const schedCheck = validateStoreSchedule();
    if (!schedCheck.valid) {
        window.currentStoreClosed = true;
        window.mustSelectScheduleBeforeCheckout = true;
        if (typeof updateStoreScheduleBadge === 'function') updateStoreScheduleBadge();
        showStoreScheduleModal({ invalidScheduleText: schedCheck.text, isCheckout: false });
    } else {
        window.currentStoreClosed = false;
        window.mustSelectScheduleBeforeCheckout = false;
        if (typeof updateStoreScheduleBadge === 'function') updateStoreScheduleBadge();
    }
}
window.handleStoreScheduleValidation = handleStoreScheduleValidation;

function closeTimePickerModal() {
    document.getElementById('timePickerModal').style.display = 'none';
    if (typeof currentView !== 'undefined' && currentView === 'store' && window.currentStoreRawData) {
        handleStoreScheduleValidation('closeModal');
    }
}

function updateStoreScheduleBadge() {
    const badgeText = document.getElementById('storeScheduleText');
    const badgeWrap = document.getElementById('storeScheduleBadge');
    if (!badgeText) return;
    
    const scheduleSelect = document.getElementById('scheduleTime');
    if (typeof scheduleMode !== 'undefined' && scheduleMode === 'ASAP') {
        if (window.currentStoreClosed || window.mustSelectScheduleBeforeCheckout) {
            badgeText.innerText = '⚠️ 店家目前尚未營業 (點擊預約)';
            if (badgeWrap) {
                badgeWrap.style.display = 'inline-block';
                const pillSpan = badgeWrap.querySelector('span');
                if (pillSpan) pillSpan.style.background = '#e11d48';
            }
        } else {
            badgeText.innerText = '🚀 即時訂單';
            if (badgeWrap) {
                badgeWrap.style.display = 'inline-block';
                const pillSpan = badgeWrap.querySelector('span');
                if (pillSpan) pillSpan.style.background = '#f43f5e';
            }
        }
    } else {
        if (scheduleSelect && scheduleSelect.options.length > 0 && scheduleSelect.selectedIndex >= 0) {
            let optText = scheduleSelect.options[scheduleSelect.selectedIndex].text;
            if (optText.startsWith('今天 ')) optText = optText.substring(3);
            if (window.currentStoreClosed || window.mustSelectScheduleBeforeCheckout) {
                badgeText.innerText = `⚠️ ${optText} 休息中 (點擊修改)`;
                if (badgeWrap) {
                    badgeWrap.style.display = 'inline-block';
                    const pillSpan = badgeWrap.querySelector('span');
                    if (pillSpan) pillSpan.style.background = '#d97706';
                }
            } else {
                badgeText.innerText = `📅 安排於 ${optText}`;
                if (badgeWrap) {
                    badgeWrap.style.display = 'inline-block';
                    const pillSpan = badgeWrap.querySelector('span');
                    if (pillSpan) pillSpan.style.background = '#000';
                }
            }
        }
    }
}

function updateTriggerText() {
    const trigger = document.getElementById('triggerTimeText');
    const scheduleSelect = document.getElementById('scheduleTime');
    const promoTag = document.getElementById('asapPromoTag');
    if (typeof updateStoreScheduleBadge === 'function') updateStoreScheduleBadge();
    if (!trigger) return;
    
    if (typeof scheduleMode !== 'undefined' && scheduleMode === 'ASAP') {
        trigger.innerText = '🚀 即時訂單';
        trigger.style.color = '#f43f5e';
        if (promoTag) {
            promoTag.style.display = 'inline';
            promoTag.innerText = '預約最高每單折10元';
            promoTag.style.color = '#01B468';
        }
    } else {
        const disc = typeof getPreOrderDiscount === 'function' ? getPreOrderDiscount() : 0;
        if (promoTag) {
            if (disc > 0) {
                promoTag.style.display = 'inline';
                promoTag.innerText = `(-$${disc})`;
                promoTag.style.color = '#e11d48';
            } else {
                promoTag.style.display = 'none';
            }
        }
        if (scheduleSelect && scheduleSelect.options.length > 0) {
            try {
                const parsed = JSON.parse(scheduleSelect.value);
                const d = new Date(parsed.date);
                const dayNames = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
                const today = new Date();
                const tomorrow = new Date();
                tomorrow.setDate(today.getDate() + 1);
                if (d.toDateString() === today.toDateString()) {
                    trigger.innerText = parsed.title;
                } else if (d.toDateString() === tomorrow.toDateString()) {
                    trigger.innerText = `明天 ${parsed.title}`;
                } else {
                    trigger.innerText = `${d.getMonth()+1}月${d.getDate()}日${dayNames[d.getDay()]} ${parsed.title}`;
                }
                trigger.style.color = '#1c1917';
            } catch(e) {
                let optText = scheduleSelect.options[scheduleSelect.selectedIndex >= 0 ? scheduleSelect.selectedIndex : 0].text;
                if (optText.startsWith('今天 ')) optText = optText.substring(3);
                trigger.innerText = optText || '選擇時間';
                trigger.style.color = '#1c1917';
            }
        } else {
            trigger.innerText = '選擇時間';
            trigger.style.color = '#57534e';
        }
    }
}

function confirmTimePicker(mode, skipSearch = false, force = false) {
    if (!force && mode === 'ASAP') {
        const isOpenNow = (typeof window.checkStoreIsOpenNow === 'function' && window.currentStoreRawData)
            ? window.checkStoreIsOpenNow(window.currentStoreRawData)
            : !window.currentStoreClosed;
        if (!isOpenNow && window.currentStoreClosed) {
            showModal('無法切換', '當前店家目前尚未營業，無法切換為「盡快送達」。請選擇預約送達時段。');
            return;
        }
    }
    scheduleMode = mode;
    const scheduleSelect = document.getElementById('scheduleTime');
    
    if (mode === 'SCHEDULE') {
        const modalSelect = document.getElementById('modalTimeSelect');
        const selectedModalOpt = modalSelect ? modalSelect.options[modalSelect.selectedIndex] : null;
        if (!selectedModalOpt || !selectedModalOpt.value) {
            showModal('請選擇時段', '當前選取的日期已無可預約時段，請切換其他日期或選擇「🚀 即時訂單」。');
            return;
        }
        if (scheduleSelect) {
            scheduleSelect.innerHTML = '';
            const newOpt = document.createElement('option');
            newOpt.value = selectedModalOpt.value;
            newOpt.text = selectedModalOpt.text;
            scheduleSelect.appendChild(newOpt);
        }
    }
    
    updateTriggerText();
    closeTimePickerModal();
    
    // [優化] 當切換時間時，清除搜尋快取，強制下次搜尋重新抓取正確時間段的資料
    if (typeof lastSearchedQuery !== 'undefined') {
        lastSearchedQuery = "";
        if (typeof lastSearchedVertical !== 'undefined') lastSearchedVertical = "";
    } else {
        window.lastSearchedQuery = "";
        window.lastSearchedVertical = "";
    }
    window.suggestionStores = [];
    window.suggestionStoreQuery = "";
    window.suggestionStoreSource = "";
    window.suggestionScheduleKey = "";
    
    const cv = document.getElementById('checkoutView');
    if (cv && (cv.style.display === 'block' || cv.style.display === 'flex')) {
        if (window.isGroceryStore && typeof openGroceryCheckoutSummary === 'function') {
            openGroceryCheckoutSummary();
        } else if (typeof openCheckoutSummary === 'function') {
            openCheckoutSummary();
        }
    } else if (typeof renderCart === 'function') {
        renderCart();
    }
    
    // 如果目前在列表頁或搜尋畫面中，自動觸發重新搜尋 (若指定 skipSearch 則略過)
    if (!skipSearch) {
        if (typeof currentView !== 'undefined' && currentView === 'list' && typeof window.searchStores === 'function') {
            window.searchStores();
        } else if (document.getElementById('storeSearchOverlay') && document.getElementById('storeSearchOverlay').style.display === 'flex' && typeof updateQueryOverlay === 'function') {
            updateQueryOverlay();
        } else if (document.getElementById('globalSearchOverlay') && document.getElementById('globalSearchOverlay').style.display !== 'none' && typeof updateQueryOverlay === 'function') {
            updateQueryOverlay();
        }
    }
}

function initSchedulePicker() {
    updateTriggerText();
}
function setScheduleMode(mode) {
    // Handled by confirmTimePicker now
}
document.addEventListener("DOMContentLoaded", () => {

    initSchedulePicker();

  });



  

    function revealSubSections() {
      const el = document.getElementById('subSections');
      if (el && el.style.display === 'none') {
          el.style.display = 'block';
          setTimeout(() => { el.style.opacity = '1'; }, 10);
      }
      const heroBtns = document.getElementById('heroActionButtons');
      if (heroBtns && heroBtns.style.display !== 'none') {
          heroBtns.style.opacity = '0';
          setTimeout(() => { heroBtns.style.display = 'none'; }, 300);
      }
      const heroBanner = document.getElementById('heroBanner');
      if (heroBanner && heroBanner.style.display !== 'none') {
          heroBanner.style.transition = 'opacity 0.3s ease';
          heroBanner.style.opacity = '0';
          setTimeout(() => { heroBanner.style.display = 'none'; }, 300);
      }
  }

  function updateAddrTitleState(state) {
    const section = document.getElementById('addrSection');
    if (!section) return;
    if (state === 'ok') {
      // 原本綠色樣式 (需要時可改回): backgroundColor = '#f0fdf4'; borderColor = '#4ade80';
      section.style.backgroundColor = '#fff'; 
      section.style.borderColor = 'transparent';
    } else if (state === 'error') {
      section.style.backgroundColor = '#fff5f5'; 
      section.style.borderColor = '#ef4444';
    } else {
      section.style.backgroundColor = '#fff'; 
      section.style.borderColor = 'transparent';
    }
}

window.addrDebounceTimer = null;

  window.lastSearchedAddr = "";





  async function getCurrentLocation() {

      const statusEl = document.getElementById('addrStatus');

      statusEl.innerHTML = '<div class="spinner" style="margin: 15px auto 10px auto; width: 24px; height: 24px; border-width: 3px;"></div><div style="color: #f43f5e; font-weight: bold;">取得 GPS 定位中...</div>';

      if (navigator.geolocation) {

          navigator.geolocation.getCurrentPosition(async (position) => {

              const lat = position.coords.latitude;

              const lng = position.coords.longitude;

              statusEl.innerText = '正在轉換地址...';

              

              try {

                  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=zh-TW&addressdetails=1`);

                  if (res.ok) {

                      const data = await res.json();

                      const title = formatNominatimAddress(data);

                      setAddress(lat, lng, title);

                      statusEl.innerText = '定位成功！';

                  } else {

                      statusEl.innerText = '轉換地址失敗，請稍後再試。';

                  }

              } catch (e) {

                  statusEl.innerText = '轉換地址時發生錯誤。';

              }

          }, (error) => {

              switch(error.code) {

                  case error.PERMISSION_DENIED:

                      statusEl.innerText = '使用者拒絕提供定位權限。';

                      break;

                  case error.POSITION_UNAVAILABLE:

                      statusEl.innerText = '定位資訊無法取得。';

                      break;

                  case error.TIMEOUT:

                      statusEl.innerText = '定位請求超時。';

                      break;

                  default:

                      statusEl.innerText = '定位發生未知錯誤。';

                      break;

              }

          });

      } else {

          statusEl.innerText = '您的瀏覽器不支援定位功能。';

      }

  }



  



  function scrollAddrToEnd() {

      setTimeout(() => {

          const el = document.getElementById('addrInput');

          if (el) {

              el.scrollLeft = el.scrollWidth;

          }

      }, 50);

  }



  
