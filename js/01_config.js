// ============================================================
// 全域核心設定與狀態 (Global Application State & Config)
// ============================================================
var isAddressSet = false;
window.isAddressSet = false;

var currentLat = null;
window.currentLat = null;

var currentLng = null;
window.currentLng = currentLng;

var currentAddrTitle = '';
window.currentAddrTitle = currentAddrTitle;

var scheduleMode = 'ASAP';
window.scheduleMode = scheduleMode;

var selectedDateIndex = 0;
window.selectedDateIndex = 0;

var datesData = [];
window.datesData = datesData;

var currentVertical = 'RESTAURANTS';
window.currentVertical = currentVertical;

var isLocalEnv = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
var API_BASE_URL = isLocalEnv ? window.location.origin : 'https://api.9ysong.shop';
window.API_BASE_URL = API_BASE_URL;

var WS_URL = 'wss://api.9ysong.shop/ws';
try {
    var protocol = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'wss:' : 'ws:';
    var host = (typeof window !== 'undefined' && window.location.hostname) ? window.location.hostname : '127.0.0.1';
    WS_URL = protocol + '//' + host + ':8000/ws';
    window.WS_URL = WS_URL;
} catch (e) {}

var isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (typeof window !== 'undefined' && window.innerWidth <= 768);
window.isMobileDevice = isMobileDevice;

var isDesktopDevice = !isMobileDevice;
window.isDesktopDevice = isDesktopDevice;


// ============================================================
// 排除自取免運店家管理 (強制收取外送加成，不享自取免運)
// ============================================================
window.pickupExcludeStores = ['漢堡王', 'burger king', 'burgerking', '麥當勞', 'mcdonald', 'pizza hut', 'pizzahut', '拿波里'];
window._pickupExcludeStoresLoaded = false;

function getStoreNameString(obj) {
    if (!obj) return '';
    let str = '';
    if (typeof obj === 'string') {
        str = obj;
    } else if (typeof obj === 'object') {
        if (typeof obj.text === 'string') str = obj.text;
        else if (typeof obj.title === 'string') str = obj.title;
        else if (typeof obj.title === 'object' && obj.title && typeof obj.title.text === 'string') str = obj.title.text;
        else if (typeof obj.name === 'string') str = obj.name;
    }
    try {
        if (str && str.includes('%')) str = decodeURIComponent(str);
    } catch(e) {}
    return String(str || '');
}

function isStorePickupExcluded(name) {
    if (!name) return false;
    const cleanName = getStoreNameString(name).toLowerCase();
    if (!cleanName) return false;
    const list = (window.pickupExcludeStores && window.pickupExcludeStores.length > 0) 
        ? window.pickupExcludeStores 
        : ['漢堡王', 'burger king', 'burgerking', '麥當勞', 'mcdonald', 'pizza hut', 'pizzahut', '拿波里'];
    for (const kw of list) {
        if (!kw) continue;
        const cleanKw = String(kw).trim().toLowerCase();
        if (cleanKw && cleanName.includes(cleanKw)) {
            return true;
        }
    }
    return false;
}

async function loadPickupExcludeStores() {
    try {
        const apiBase = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) ? API_BASE_URL : '';
        const res = await fetch(`${apiBase}/api/pickup_exclude_stores?t=${Date.now()}`);
        if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.excluded) && data.excluded.length > 0) {
                window.pickupExcludeStores = data.excluded;
                window._pickupExcludeStoresLoaded = true;
                console.log('Loaded pickup exclude stores:', window.pickupExcludeStores);
            }
        }
    } catch (e) {
        console.warn('載入排除自取免運店家名單失敗:', e);
    }
}


function decodeStoreUuid(raw) {
    if (!raw) return '';
    raw = String(raw).trim();
    if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(raw)) {
        return raw.toLowerCase();
    }
    if (/^[a-zA-Z0-9_-]{22}$/.test(raw)) {
        try {
            let b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
            while (b64.length % 4 !== 0) b64 += '=';
            const binary = atob(b64);
            if (binary.length === 16) {
                let hex = '';
                for (let i = 0; i < 16; i++) {
                    const h = binary.charCodeAt(i).toString(16).padStart(2, '0');
                    hex += h;
                }
                return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`.toLowerCase();
            }
        } catch (e) {}
    }
    return raw;
}
window.decodeStoreUuid = decodeStoreUuid;

function normalizeUberActionPath(rawUrl) {
    let cleaned = String(rawUrl || '').trim();
    if (!cleaned) return '';
    // Strip one or more leading https://www.ubereats.com(/tw) or /tw prefixes so full URLs never double-prefix
    cleaned = cleaned.replace(/^(?:https?:\/\/www\.ubereats\.com(?:\/tw)?|\/tw(?=\/|$))+/i, '');
    cleaned = cleaned.replace(/([?&])diningMode=[^&]*(&|$)/g, '$1').replace(/[?&]$/, '');
    if (cleaned && !cleaned.startsWith('/')) cleaned = '/' + cleaned;
    return cleaned;
}
window.normalizeUberActionPath = normalizeUberActionPath;

function normalizeUberStoreUrl(rawUrl) {
    let cleaned = String(rawUrl || '').trim();
    if (!cleaned) return '';
    return cleaned.replace(/^(?:https?:\/\/www\.ubereats\.com(?:\/tw)?)+/i, 'https://www.ubereats.com/tw');
}
window.normalizeUberStoreUrl = normalizeUberStoreUrl;

// ========== 雙方案全域狀態管理 (150內半價 vs 300內半價) ==========
window.currentSelectedPlan = '150'; // 預設使用 150 方案
window.couponBEnabled = true;       // 300 方案 (B券) 開啟狀態
window._userManuallySelectedPlan = false; // 是否由使用者手動切換方案

function getPlan300MinHours() {
  const st = (typeof window !== 'undefined') ? window.lastServerStoreStatus : null;
  if (!st || !st.type) return 10;
  const t = String(st.type).toLowerCase();
  const txt = String(st.text || '');
  if (t === 'preorder' || t === 'closed' || t === 'offline' || txt.includes('休息中') || txt.includes('無法接單')) {
    return 10;
  }
  if (t === 'open' || t === 'busy') {
    return 3;
  }
  return 10;
}
window.getPlan300MinHours = getPlan300MinHours;

function isPlan300Eligible() {
  if (window.isGroceryStore) return false;
  if (typeof scheduleMode === 'undefined' || scheduleMode !== 'SCHEDULE') return false;

  let schedTs = (typeof getSelectedScheduleTimestamp === 'function') ? getSelectedScheduleTimestamp() : 0;
  if (!schedTs || schedTs <= 0) {
      const schedSelect = document.getElementById('scheduleTime');
      if (schedSelect && schedSelect.value) {
          try {
              const parsed = JSON.parse(schedSelect.value);
              const baseDate = new Date(parsed.date + "T00:00:00+08:00");
              schedTs = baseDate.getTime() + (parsed.startTime * 60 * 1000);
          } catch (e) {
              const d = new Date(schedSelect.value);
              if (!isNaN(d.getTime())) schedTs = d.getTime();
          }
      }
  }
  if (!schedTs || schedTs <= 0) return false;

  const now = Date.now();
  const diffMs = schedTs - now;
  const minHours = (typeof getPlan300MinHours === 'function') ? getPlan300MinHours() : 10;
  if (diffMs < minHours * 3600 * 1000) return false;

  return true;
}
window.isPlan300Eligible = isPlan300Eligible;

window.switchPlanTab = function(newPlan) {
  if (window.isGroceryStore) return;
  if (newPlan === '300') {
    if (!isPlan300Eligible()) {
      const reqHours = (typeof getPlan300MinHours === 'function') ? getPlan300MinHours() : 10;
      const tipMsg = (reqHours >= 10)
        ? '⚠️ 目前伺服器為休息中，300 方案需預訂至少 10 小時以後的時段'
        : '⚠️ 300 方案僅限預訂目前時間最少 3 小時以上的時段';
      if (typeof showToast === 'function') showToast(tipMsg);
      return;
    }
    if (!window.couponBEnabled) {
      if (typeof showToast === 'function') showToast('⚠️ 300 方案今日配額已滿，請使用 150 方案！');
      return;
    }
  }
  window._userManuallySelectedPlan = true;
  window.currentSelectedPlan = newPlan;
  if (typeof openCheckoutSummary === 'function') {
    openCheckoutSummary();
  }
  if (typeof showToast === 'function') {
    showToast(newPlan === '300' ? '✨ 已切換至「🌟 300內半價」' : '✨ 已切換至「⚡ 150內半價」');
  }
};

function showToast(msg) {
    if (!document.body) {
        window.addEventListener('DOMContentLoaded', () => showToast(msg));
        return;
    }
    const el = document.createElement('div');
    el.innerText = msg;
    el.style.position = 'fixed';
    el.style.top = '50%';
    el.style.left = '50%';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.background = 'rgba(0,0,0,0.85)';
    el.style.color = '#fff';
    el.style.padding = '12px 24px';
    el.style.borderRadius = '20px';
    el.style.zIndex = '99999';
    el.style.fontSize = '15px';
    el.style.fontWeight = 'bold';
    el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)';
    el.style.pointerEvents = 'none';
    el.style.textAlign = 'center';
    el.style.maxWidth = '80%';
    el.style.wordBreak = 'break-word';
    document.body.appendChild(el);
    setTimeout(() => {
        el.style.transition = 'opacity 0.5s';
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 500);
    }, 2000);
}
window.showToast = showToast;
window.alert = function(msg) {
    showToast(msg);
};

// New specific function to handle delivery method toggle since we hid the original select
function setDeliveryMethod(method, fromUser = false) {
    const isDoor = (method === 'door' || method === '放在門口');
    const actualMethod = isDoor ? '放在門口' : '當面點交';
    window.selectedDeliveryMethod = actualMethod;
    
    const sel = document.getElementById('deliveryMethod');
    if (sel) {
        if (sel.value !== actualMethod) {
            window._syncingDeliveryMethodDom = true;
            try {
                sel.value = actualMethod;
                sel.dispatchEvent(new Event('change'));
            } finally {
                window._syncingDeliveryMethodDom = false;
            }
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
}
window.setDeliveryMethod = setDeliveryMethod;



// (switchVertical override unified in 04_search.js)
// Restore visual state on load for delivery method
try {
    if (localStorage.getItem('unSchedulableCacheVer') !== '3') {
        localStorage.removeItem('unSchedulableStores');
        localStorage.setItem('unSchedulableCacheVer', '3');
    }
} catch (e) {}

document.addEventListener("DOMContentLoaded", () => {
    if (typeof checkCouponSettings === 'function') {
        checkCouponSettings();
    }
    setTimeout(() => {
        const savedMethod = localStorage.getItem('userDeliveryMethod') || '當面點交';
        setDeliveryMethod(savedMethod);
    }, 500);
});
function getSelectedScheduleTimestamp() {
      const ts = document.getElementById('scheduleTime');
      if (!ts || !ts.value) return 0;
      try {
          const parsed = JSON.parse(ts.value);
          const baseDate = new Date(parsed.date + "T00:00:00+08:00");
          return baseDate.getTime() + (parsed.startTime * 60 * 1000);
      } catch (e) {
          const d = new Date(ts.value);
          return isNaN(d) ? 0 : d.getTime();
      }
  }

  function getPreOrderDiscount(targetTimestamp) {
      if (typeof scheduleMode !== 'undefined' && scheduleMode === 'ASAP') return 0;
      const isGrocery = (typeof window !== 'undefined' && window.isGroceryStore) || 
                        (typeof currentVertical !== 'undefined' && currentVertical === 'SHOP');
      
      const schedSelect = document.getElementById('scheduleTime');
      let isThreeHour = false;
      if (schedSelect && schedSelect.value) {
          try {
              const parsed = JSON.parse(schedSelect.value);
              if (parsed.startTime !== undefined && parsed.endTime !== undefined) {
                  if ((parsed.endTime - parsed.startTime) === 180) {
                      isThreeHour = true;
                  }
              }
              if (parsed.discount === 25) {
                  isThreeHour = true;
              }
          } catch(e) {}
      }
      
      if (isGrocery) {
          // 生鮮雜貨預約任何時段沒有 -$5、-$10，只有三小時時段會 -$25
          return isThreeHour ? 25 : 0;
      }
      
      const ts = targetTimestamp || (typeof getSelectedScheduleTimestamp === 'function' ? getSelectedScheduleTimestamp() : 0);
      if (!ts) return 0;
      const diffMs = ts - Date.now();
      if (diffMs <= 0) return 0;
      const diffMinutes = diffMs / 60000;
      if (diffMinutes >= 179) {
          return 10;
      } else {
          return 5;
      }
  }

  // (API_BASE_URL, WS_URL, isMobileDevice declared at top of 01_config.js)



function copyToClipboardFallback(text, btn) {

    if (navigator.clipboard && window.isSecureContext) {

        navigator.clipboard.writeText(text);

    } else {

        const ta = document.createElement("textarea");

        ta.value = text;

        ta.style.position = "fixed";

        document.body.appendChild(ta);

        ta.select();

        try { document.execCommand("copy"); } catch(e){}

        document.body.removeChild(ta);

    }

    if (btn) {

        btn.innerText = '已複製！請貼上至官方帳號';

        btn.style.background = '#f43f5e';

        btn.style.color = '#fff';

    }

}



// (isAddressSet, scheduleMode, etc. declared at top of 01_config.js)

  

