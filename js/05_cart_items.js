// ==== 購物車與餐廳菜單功能 ====

  let cart = [];

let originalAppHeaderHtml = "";

  try {

    const saved = localStorage.getItem('uberCart');

    if (saved) cart = JSON.parse(saved);

  } catch(e) {}
  window.cart = cart;

  

  function saveCart() {

    localStorage.setItem('uberCart', JSON.stringify(cart));
    window.cart = cart;

  }

  function clearCart() {
    window._userManuallySelectedPlan = false;
    cart = [];
    window.cart = [];
    try {
      localStorage.removeItem('uberCart');
      localStorage.setItem('uberCart', JSON.stringify([]));
      localStorage.removeItem('uberCartIsDiscount');
    } catch(e) {}
    if (window.groupBuyData) {
      window.groupBuyData.items = [];
    }
    if (typeof updateCartBadge === 'function') updateCartBadge();
    if (typeof updateMenuActions === 'function') updateMenuActions();
    const checkoutContent = document.getElementById('checkoutContent');
    if (checkoutContent) checkoutContent.innerHTML = '';
    const cartItems = document.getElementById('cartItems');
    if (cartItems) cartItems.innerHTML = '';
    const cv = document.getElementById('checkoutView');
    if (cv && cv.style.display === 'block') cv.style.display = 'none';
    const cartV = document.getElementById('cartView');
    if (cartV && cartV.style.display === 'block') cartV.style.display = 'none';
    if (currentView === 'checkout' || currentView === 'cart') {
      currentView = 'store';
      const sv = document.getElementById('storeView');
      if (sv) sv.style.display = 'block';
    }
  }
  window.clearCart = clearCart;

  

  window.removeCartItem = function(idx) {
    const targetItem = cart[idx];
    if (targetItem) {
        if (!confirm(`確定要將「${targetItem.title}」從購物車中刪除嗎？`)) return;
    }
    const itemTitle = targetItem ? targetItem.title : '';
    const itemId = targetItem ? targetItem.id : '';

    if (window.currentGroupBuyId && typeof groupBuySyncCartAction === 'function') {
      groupBuySyncCartAction('remove', { index: idx, item_id: itemId, item_title: itemTitle });
      showToast(itemTitle ? `🗑️ 已刪除「${itemTitle}」` : '🗑️ 已刪除餐點');
      return;
    }

    cart.splice(idx, 1);
    updateCartBadge();
    updateMenuActions();
    saveCart();
    showToast(itemTitle ? `🗑️ 已刪除「${itemTitle}」` : '🗑️ 已刪除餐點');

    if (cart.length === 0) {
      document.getElementById('errorModalOverlay').style.display = 'none';
      if (typeof goBackToStore === 'function') goBackToStore();
      showToast('🗑️ 購物車已清空');
    } else {
      viewCart();
    }
  };





  // ========== 快速加入購物車邏輯 ==========

  window.noOptionsItems = new Set();



  function updateMenuActions() {

  const qtyMap = {};

  cart.forEach(item => {

    if (item.menuItemUuid) {

      qtyMap[item.menuItemUuid] = (qtyMap[item.menuItemUuid] || 0) + item.qty;

    }

  });



  const areas = document.querySelectorAll('.item-action-area');

  areas.forEach(area => {

    const uuid = area.id.replace('action-', '');

    const qty = qtyMap[uuid] || 0;



    if (!area.dataset.originalBtn) {

      const quickBtn = area.querySelector('.quick-add-btn');

      if (quickBtn) {

        area.dataset.originalBtn = quickBtn.outerHTML;

      }

    }



    if (qty > 0) {

      if (window.noOptionsItems.has(uuid)) {

        area.innerHTML = `

          <div onclick="handleQuickTrash(event, '${uuid}')" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px;">${qty === 1 ? '🗑️' : '－'}</div>

          <div style="padding: 0 4px; font-size: 15px; font-weight: bold; min-width: 16px; text-align: center;">${qty}</div>

          <div onclick="handleQuickPlus(event, '${uuid}')" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; cursor: pointer;">＋</div>

        `;

      } else {

        area.innerHTML = `

          <div onclick="event.stopPropagation(); viewCart();" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; font-weight: bold; color: #111;">－</div>

          <div style="padding: 0 4px; font-size: 15px; font-weight: bold; min-width: 16px; text-align: center;">${qty}</div>

          <div onclick="event.stopPropagation(); this.parentElement.parentElement.click();" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; cursor: pointer; color: #111;">＋</div>

        `;

      }

    } else {

      if (area.dataset.originalBtn) {

        area.innerHTML = area.dataset.originalBtn;

      } else if (!area.innerHTML.includes('handleQuickAdd')) {

        area.innerHTML = `<div onclick="this.parentElement.parentElement.click(); event.stopPropagation();" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; cursor: pointer; color: #111;">＋</div>`;

      }

    }

  });

}



async function handleQuickAdd(event, storeUuid, sectionUuid, subsectionUuid, menuItemUuid, titleEnc, descEnc, basePrice, imgUrl, hasCustomizations) {
  if (window.isGroupBuyClosed) {
    if (typeof showToast === 'function') showToast('⚠️ 本團購訂單已送出結帳，目前已截止點餐！');
    return;
  }
  const targetStoreUuid = storeUuid || (typeof currentStoreUuid !== 'undefined' ? currentStoreUuid : '');
  const preCheck = (typeof validateStoreSchedule === 'function') ? validateStoreSchedule() : { valid: true };
  if (window.currentStoreSchedulable !== true || (targetStoreUuid && typeof isStoreSchedBlocked === 'function' && isStoreSchedBlocked(targetStoreUuid)) || (!preCheck.valid && (preCheck.reason === 'NOT_SCHEDULABLE' || preCheck.reason === 'NOT_SCHEDULABLE_UNVERIFIED'))) {
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    const resDiv = document.getElementById('results');
    if (typeof abortBlockedStoreEntry === 'function') {
        abortBlockedStoreEntry(targetStoreUuid, '無法為您代購', preCheck.text || '此餐廳無法預約或代訂，請選擇其他餐廳', resDiv, window._lastValidResultsHtml || '');
    } else if (typeof showHardBlockModal === 'function') {
        showHardBlockModal('無法為您代購', preCheck.text || '此餐廳無法代訂，請選擇其他餐廳');
    }
    return;
  }
  if (!window._quickAddLocks) window._quickAddLocks = {};
  if (window._quickAddLocks[menuItemUuid]) return;
  window._quickAddLocks[menuItemUuid] = true;
  try {
    const title = decodeURIComponent(titleEnc);

  const desc = decodeURIComponent(descEnc);

    event.stopPropagation();

    const btn = event.currentTarget;

    const originalHtml = btn.innerHTML;

    btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;border-top-color:#111;"></div>';

    

    try {

      if (window.isGroceryStore) {

          btn.innerHTML = originalHtml;

          openGroceryCheckoutSummary();

          return;

      }

      if (hasCustomizations === false) {

          btn.innerHTML = originalHtml;

          window.noOptionsItems.add(menuItemUuid);

          const quickItem = {

            title: title,

            price: basePrice,

            qty: 1,

            note: '',

            options: [],

            storeName: currentStoreName,

            storeUrl: typeof currentStoreUrl !== 'undefined' ? currentStoreUrl : '',

            uuid: menuItemUuid,

            menuItemUuid: menuItemUuid,

            item_uuid: menuItemUuid,

            itemUuid: menuItemUuid,

            storeUuid: storeUuid || (typeof currentStoreUuid !== 'undefined' ? currentStoreUuid : ''),

            sectionUuid: sectionUuid || '',

            subsectionUuid: subsectionUuid || '',

            imgUrl: imgUrl || '',

            rawCustomizations: {},

            customizations: {},

            quantity: 1,

            user_name: window.currentGroupBuyId ? getOrPromptGroupBuyUserName() : '',

            device_fp: getGroupBuyDeviceFp(),

            storeCanPickup: typeof window.currentStoreCanPickup !== 'undefined' ? window.currentStoreCanPickup : false,
      storeDeliveryFee: (typeof currentStoreDeliveryFee !== 'undefined' ? currentStoreDeliveryFee : 0),
      originalStoreDeliveryFee: typeof currentOriginalDeliveryFee !== 'undefined' ? currentOriginalDeliveryFee : (typeof currentStoreDeliveryFee !== 'undefined' && currentStoreDeliveryFee > 0 ? currentStoreDeliveryFee + 50 : 0)

          };

          if (window.currentGroupBuyId && typeof groupBuySyncCartAction === 'function') {
            groupBuySyncCartAction('add', { item: quickItem });
          } else {
            cart.push(quickItem);
            updateCartBadge();
            updateMenuActions();
            saveCart();
          }

          showToast(`已加入: ${title}`);

          return;

      }


        btn.innerHTML = originalHtml;
        openItemModal(storeUuid, sectionUuid, subsectionUuid, menuItemUuid, titleEnc, descEnc, basePrice, imgUrl, hasCustomizations);
    } catch (e) {

      btn.innerHTML = originalHtml;

      console.error('Quick add error:', e);

      showToast('載入失敗，請再試一次');

    }
  } finally {
      window._quickAddLocks[menuItemUuid] = false;
  }

  }



  function handleQuickPlus(event, uuid) {
    event.stopPropagation();
    if (window.currentGroupBuyId && window.isGroupBuyClosed) {
      showGroupBuyClosedModal();
      return;
    }
    if (window.currentGroupBuyId) {
      const myFp = getGroupBuyDeviceFp();
      const myName = localStorage.getItem('group_buy_user_name') || '';
      let targetIdx = cart.findIndex(it => it.menuItemUuid === uuid && (it.device_fp ? it.device_fp === myFp : it.user_name === myName));
      if (targetIdx !== -1) {
        updateCartItemQty(targetIdx, 1);
        return;
      }
      let anyItem = cart.find(it => it.menuItemUuid === uuid);
      if (anyItem) {
        const newItem = {
          ...anyItem,
          id: undefined,
          qty: 1,
          user_name: getOrPromptGroupBuyUserName(),
          device_fp: getGroupBuyDeviceFp(),
          added_at: undefined
        };
        groupBuySyncCartAction('add', { item: newItem });
        showToast(`已加入: ${newItem.title}`);
        return;
      }
      return;
    }

    for (let i = 0; i < cart.length; i++) {
      if (cart[i].menuItemUuid === uuid) {
        cart[i].qty += 1;
        updateCartBadge();
        updateMenuActions();
        saveCart();
        break;
      }
    }
  }

  function handleQuickTrash(event, uuid) {
    event.stopPropagation();
    if (window.isGroupBuyClosed) {
      showToast('⚠️ 本團購訂單已送出結帳，目前已截止修改！');
      return;
    }
    if (window.currentGroupBuyId) {
      const myFp = getGroupBuyDeviceFp();
      const myName = localStorage.getItem('group_buy_user_name') || '';
      let targetIdx = cart.findIndex(it => it.menuItemUuid === uuid && (it.device_fp ? it.device_fp === myFp : it.user_name === myName));
      if (targetIdx !== -1) {
        updateCartItemQty(targetIdx, -1);
        return;
      }
      let anyIdx = cart.findIndex(it => it.menuItemUuid === uuid);
      if (anyIdx !== -1) {
        updateCartItemQty(anyIdx, -1);
        return;
      }
      return;
    }

    for (let i = 0; i < cart.length; i++) {
      if (cart[i].menuItemUuid === uuid) {
        cart[i].qty -= 1;
        if (cart[i].qty <= 0) {
          cart.splice(i, 1);
        }
        updateCartBadge();
        updateMenuActions();
        saveCart();
        break;
      }
    }
  }



  function updateCartBadge() {

    const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);

    const btn = document.getElementById('floatingCartBtn');

    if (btn) {

      if (window.isGroupBuyClosed) {
        btn.innerText = `🔒 團購已送出 (${totalQty})`;
      } else {
        btn.innerText = window.currentGroupBuyId ? `👥 團購清單 (${totalQty})` : `🛍️ 檢視購物車(${totalQty})`;
      }

      const homeView = document.getElementById('homeView');
      const isHomeViewVisible = homeView && (homeView.style.display !== 'none');
      const isHome = (typeof currentView !== 'undefined' && currentView === 'home') || isHomeViewVisible;

      // 即使購物車有東西的情況下，在有尋找想吃的餐點的頁面 (homeView) 下方不要顯示檢視購物車
      if (isHome) {
        btn.style.display = 'none';
      } else {
        btn.style.display = (totalQty > 0) ? 'block' : 'none';
      }

    }

    const headerBadge = document.getElementById('headerCartBadge');

    if (headerBadge) {

      headerBadge.innerText = totalQty;

      headerBadge.style.display = totalQty > 0 ? 'inline-block' : 'none';

    }

  }



  document.addEventListener('DOMContentLoaded', () => {

    updateCartBadge();

    const initPhone = document.getElementById('initPhone');

    if (initPhone) {

        initPhone.value = localStorage.getItem('userPhone') || '';

    }

});



  let currentStoreUuid = '';

  let currentStoreName = '';

  let currentStoreUrl = '';

  let currentStoreDeliveryFee = '';
let currentOriginalDeliveryFee = 0;

  let currentItem = null;

  let currentQty = 1;

  let currentCustomizations = [];



  function formatCartNoteHTML(rawNote) {
    if (!rawNote) return '';
    let optionsText = '';
    let remarkText = '';

    if (rawNote.includes(' | 備註：')) {
        const parts = rawNote.split(' | 備註：');
        optionsText = parts[0];
        remarkText = parts[1];
    } else if (rawNote.startsWith('備註：')) {
        remarkText = rawNote.substring(3);
    } else {
        optionsText = rawNote;
    }

    if (optionsText.startsWith('選項：')) {
        optionsText = optionsText.substring(3);
    }

    const rawItems = optionsText ? optionsText.split(/,\s*/) : [];
    const grouped = {};

    rawItems.forEach(itemStr => {
        let trimmed = itemStr.trim();
        if (!trimmed) return;

        const colonIdx = trimmed.indexOf(':');
        if (colonIdx > 0) {
            let cat = trimmed.substring(0, colonIdx).trim();
            let val = trimmed.substring(colonIdx + 1).trim();

            // 濾除無效或預設未選取的加購文字
            if (/^(無需加價購|無需加購|不需加購|不加購|不要加購|無需|不需要|無)$/i.test(val)) {
                return;
            }

            // 精簡分類標籤
            cat = cat.replace(/^(請選擇|選擇|是否再|是否|請選)/, '').replace(/產品$/, '');

            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(val);
        } else {
            if (/^(無需加價購|無需加購|不需加購|不加購|不要加購|無需|不需要|無)$/i.test(trimmed)) {
                return;
            }
            if (!grouped['其他']) grouped['其他'] = [];
            grouped['其他'].push(trimmed);
        }
    });

    const rows = [];
    Object.keys(grouped).forEach(cat => {
        const vals = grouped[cat];
        const formattedVals = vals.map(v => {
            let s = escapeHTML(v);
            if (s.includes(':')) {
                const subParts = s.split(':').map(sp => sp.trim());
                s = subParts[0] + ' <span style="color:#aaa; margin:0 3px;">·</span> <span style="color:#666;">' + subParts.slice(1).join(' · ') + '</span>';
            }
            // 標註加價金額 (+$XX)
            s = s.replace(/\(\+\$(\d+)\)/g, (match, p1) => `<span style="color:#f43f5e; font-weight:700; font-size:12px; margin-left:3px;">+$${p1}</span>`);
            // 軟化長備註/部位不更換等免責說明
            s = s.replace(/(\([^)]*(恕不指定|更換|部位)[^)]*\))/g, `<span style="color:#999; font-size:11px; display:inline-block; margin-left:2px;">$1</span>`);
            return s;
        });

        const label = cat === '其他' ? '' : `<span style="color:#888; font-size:12px; font-weight:600; min-width:38px; margin-right:8px; flex-shrink:0;">${escapeHTML(cat)}</span>`;
        rows.push(`
            <div style="display:flex; align-items:baseline; margin-bottom:5px; font-size:13px; line-height:1.45;">
                ${label}
                <div style="flex:1; color:#333; word-break:break-word;">
                    ${formattedVals.join('、')}
                </div>
            </div>
        `);
    });

    let remarkHtml = '';
    if (remarkText) {
        remarkHtml = `
            <div style="margin-top:6px; padding-top:6px; border-top:1px dashed #eee; font-size:12px; color:#555; display:flex; align-items:center; gap:4px;">
                <span>📝</span><span style="font-weight:600; color:#333;">備註：</span>${escapeHTML(remarkText)}
            </div>
        `;
    }

    if (rows.length === 0 && !remarkHtml) return '';

    return `
        <div style="background:#f8f9fa; border-radius:10px; padding:10px 12px; margin:8px 0; border:1px solid #f0f0f0;">
            ${rows.join('')}
            ${remarkHtml}
        </div>
    `;
  }

  async function viewCart(skipSync = false) {
    if (typeof closeQueryOverlay === 'function') {
        closeQueryOverlay();
    }
    if (document.getElementById('headerSearchBox') && document.getElementById('headerSearchBox').style.display === 'block') {
        toggleStoreSearch();
    }

    // ⭐ 團購模式：按下購物車時，立即向伺服器確認最新協同點餐內容
    if (window.currentGroupBuyId && !skipSync) {
        await syncGroupBuyCart(false, true);
    }

    if (cart.length === 0) {
      showModal('購物車是空的', '購物車目前沒有任何餐點，快去挑選喜歡的美食吧！');
      return;
    }
    const cartStoreUuid = (cart[0] && cart[0].storeUuid) ? cart[0].storeUuid : '';
    const cartCheck = (typeof validateStoreSchedule === 'function') ? validateStoreSchedule() : { valid: true };
    if (window.currentStoreSchedulable === false || (cartStoreUuid && typeof isStoreSchedBlocked === 'function' && isStoreSchedBlocked(cartStoreUuid)) || (!cartCheck.valid && cartCheck.reason === 'NOT_SCHEDULABLE')) {
      if (typeof showHardBlockModal === 'function') {
          showHardBlockModal('無法為您代購', cartCheck.text || '此餐廳無法預約或代訂，請選擇其他餐廳');
      }
      return;
    }

    let html = '';
    let total = 0;
    let totalItemsCount = 0;

    if (window.currentGroupBuyId) {
      const creatorName = window.groupBuyData?.creator_name || '主辦人';
      const isLeader = isGroupBuyLeader();
      const myFp = getGroupBuyDeviceFp();
      const myName = localStorage.getItem('group_buy_user_name') || '成員';

      // 1. 頂部狀態卡片
      if (window.isGroupBuyClosed) {
        html += `
          <div style="background:linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); border:1.5px solid #cbd5e1; border-radius:14px; padding:12px 14px; margin-bottom:15px; box-shadow:0 2px 6px rgba(0,0,0,0.04);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:800; color:#334155; font-size:15px; display:flex; align-items:center; gap:6px;">
                  <span>🔒 團購訂單已送出結帳</span>
                  <span style="font-size:11px; background:#64748b; color:#fff; padding:2px 7px; border-radius:10px; font-weight:700;">已截止點餐</span>
                </div>
                <div style="font-size:12px; color:#64748b; margin-top:4px;">
                  團長已送出訂單至 LINE 聊天室，下方為最終餐點總覽（唯讀模式）
                </div>
              </div>
              <button onclick="exitGroupBuyToPersonal()" style="background:#f43f5e; color:#fff; border:none; border-radius:16px; padding:6px 12px; font-size:12px; font-weight:700; cursor:pointer;">自己另外點</button>
            </div>
          </div>
        `;
      } else {
        html += `
          <div style="background:linear-gradient(135deg, #fff5f5 0%, #ffe3e3 100%); border:1px solid #ffc9c9; border-radius:14px; padding:12px 14px; margin-bottom:15px; box-shadow:0 2px 6px rgba(244,63,94,0.06);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div>
                <div style="font-weight:800; color:#d9381e; font-size:15px; display:flex; align-items:center; gap:6px;">
                  <span>👥 揪團共用購物車</span>
                  ${isLeader ? `<span style="font-size:11px; background:#f43f5e; color:#fff; padding:2px 7px; border-radius:10px; font-weight:700;">👑 團長</span>` : `<span style="font-size:11px; background:#fff; color:#666; border:1px solid #ddd; padding:1px 6px; border-radius:10px;">👤 團員</span>`}
                </div>
                <div style="font-size:12px; color:#555; margin-top:4px; display:flex; align-items:center; flex-wrap:wrap; gap:4px;">
                  <span>您的暱稱：<strong style="color:#111;">${escapeHTML(myName)}</strong></span>
                  <button onclick="changeGroupBuyUserName()" style="background:none; border:none; color:#f43f5e; font-size:12px; font-weight:700; cursor:pointer; padding:0 2px; text-decoration:underline;">修改暱稱</button>
                  ${!isLeader ? `<button onclick="showGroupBuyPasswordAuthModal(null, '🔑 團長身份驗證', '請輸入團購密碼以取得團長權限：')" style="background:#fff; border:1px solid #f43f5e; color:#f43f5e; border-radius:12px; font-size:11px; padding:1px 8px; margin-left:4px; cursor:pointer; font-weight:700;">團長登入</button>` : ''}
                </div>
              </div>
              <button onclick="openGroupBuyShareModal()" style="background:#ff4b2b; color:#fff; border:none; border-radius:16px; padding:6px 12px; font-size:12px; font-weight:700; cursor:pointer; box-shadow:0 2px 4px rgba(255,75,43,0.2);">邀請朋友</button>
            </div>
          </div>
        `;
      }

      // 篩選出「我自己的餐點」與「其他人的餐點」
      const myItems = [];
      const otherItems = [];
      cart.forEach(item => {
        total += item.price * item.qty;
        totalItemsCount += item.qty;
        const isMine = item.device_fp ? (item.device_fp === myFp) : (item.user_name && item.user_name === myName);
        if (isMine) {
          myItems.push(item);
        } else {
          otherItems.push(item);
        }
      });

      let mySubtotal = 0;
      let myQtyTotal = 0;

      // ---- 區塊一：📌 您的餐點 ----
      html += `
        <div style="margin: 15px 0 10px 0; display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:16px; font-weight:800; color:#111; display:flex; align-items:center; gap:6px;">
            <span>📌</span> 您的餐點清單
          </div>
          <div style="font-size:12px; color:#888;">${window.isGroupBuyClosed ? '已送出結帳 (唯讀)' : '僅您可修改或刪除'}</div>
        </div>
      `;

      if (myItems.length === 0) {
        html += `
          <div style="background:#fff; border-radius:12px; padding:18px 14px; text-align:center; border:1px dashed #ddd; margin-bottom:15px; color:#888; font-size:13px;">
            <div style="font-size:24px; margin-bottom:4px;">🍽️</div>
            <div>您尚未在本次團購中點選餐點</div>
            ${window.isGroupBuyClosed ? '' : `<button onclick="goBackToStore()" style="margin-top:10px; background:#f4f5f7; border:none; color:#111; padding:7px 16px; border-radius:16px; font-size:13px; font-weight:700; cursor:pointer;">前往選購商品</button>`}
          </div>
        `;
      } else {
        myItems.forEach(item => {
          const idx = cart.indexOf(item);
          const lineTotal = item.price * item.qty;
          mySubtotal += lineTotal;
          myQtyTotal += item.qty;
          const formattedNoteHtml = formatCartNoteHTML(item.note);

          html += `
          <div style="background:#fff; border-radius:14px; padding:14px; margin-bottom:10px; border:1.5px solid #ffdede; box-shadow:0 1px 4px rgba(0,0,0,0.03);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
              <div style="flex:1; padding-right:10px;">
                <div style="font-weight:700; font-size:15px; color:#111; line-height:1.35;">${escapeHTML(item.title)}</div>
                <div style="font-size:12px; color:#06c167; font-weight:700; margin-top:2px;">👤 點餐人：您 (${escapeHTML(item.user_name || myName)})</div>
                ${item.qty > 1 ? `<div style="font-size:12px; color:#888; margin-top:2px;">單價 $${item.price}</div>` : ''}
              </div>
              <div style="text-align:right;">
                <div style="font-weight:800; font-size:16px; color:#111;">$${lineTotal.toLocaleString()}</div>
              </div>
            </div>

            ${formattedNoteHtml}

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; padding-top:8px; border-top:1px dashed #f0f0f0;">
              <div style="font-size:13px; color:#666; font-weight:600;">
                ${item.qty} 份
              </div>
              ${window.isGroupBuyClosed ? `
                <div style="font-size:12px; color:#64748b; font-weight:700; background:#f1f5f9; padding:4px 8px; border-radius:8px;">
                  🔒 已送出
                </div>
              ` : `
                <div style="background:#f4f5f7; border-radius:24px; display:inline-flex; align-items:center; height:32px; padding:2px 4px; box-shadow:inset 0 1px 2px rgba(0,0,0,0.04);">
                  <div onclick="updateCartItemQty(${idx}, -1)" style="width:28px; height:28px; border-radius:50%; background:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:13px; font-weight:bold; color:#333; box-shadow:0 1px 3px rgba(0,0,0,0.1); user-select:none;">${item.qty === 1 ? '🗑️' : '－'}</div>
                  <div style="min-width:30px; text-align:center; font-size:14px; font-weight:700; color:#111;">${item.qty}</div>
                  <div onclick="updateCartItemQty(${idx}, 1)" style="width:28px; height:28px; border-radius:50%; background:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:15px; font-weight:bold; color:#333; box-shadow:0 1px 3px rgba(0,0,0,0.1); user-select:none;">＋</div>
                </div>
              `}
            </div>
          </div>
          `;
        });

        html += `
          <div style="display:flex; justify-content:space-between; font-size:13px; color:#555; padding:4px 6px 12px 6px; font-weight:600;">
            <span>您點的品項共 ${myQtyTotal} 份</span>
            <span>您的餐點小計：<strong style="color:#d9381e; font-size:14px;">$${mySubtotal.toLocaleString()}</strong></span>
          </div>
        `;
      }

      // ---- 區塊二：👥 其他人 (統計並註明包含您的) 合併餐點總覽 ----
      const consolidatedMap = {};
      cart.forEach(item => {
        const isMine = item.device_fp ? (item.device_fp === myFp) : (item.user_name && item.user_name === myName);
        const optStr = item.note || '';
        const key = `${item.title}___${optStr}`;
        if (!consolidatedMap[key]) {
          consolidatedMap[key] = {
            title: item.title,
            price: item.price,
            note: item.note,
            totalQty: 0,
            myQty: 0,
            otherQty: 0,
            members: {},
            rawItems: []
          };
        }
        consolidatedMap[key].totalQty += item.qty;
        consolidatedMap[key].rawItems.push(item);
        if (isMine) {
          consolidatedMap[key].myQty += item.qty;
        } else {
          consolidatedMap[key].otherQty += item.qty;
        }
        const u = item.user_name || '其他團員';
        consolidatedMap[key].members[u] = (consolidatedMap[key].members[u] || 0) + item.qty;
      });

      html += `
        <div style="margin: 20px 0 10px 0; display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:16px; font-weight:800; color:#111; display:flex; align-items:center; gap:6px;">
            <span>📊</span> 全團餐點總覽 (合併統計)
          </div>
          <div style="font-size:12px; color:#888;">統計並註明包含您的餐點</div>
        </div>
      `;

      Object.keys(consolidatedMap).forEach(key => {
        const group = consolidatedMap[key];
        const lineTotal = group.price * group.totalQty;
        const formattedNoteHtml = formatCartNoteHTML(group.note);
        const memberDetails = Object.keys(group.members).map(m => `${m} x${group.members[m]}`).join('、');

        html += `
        <div style="background:#fff; border-radius:14px; padding:14px; margin-bottom:10px; border:1px solid #ebebeb; box-shadow:0 1px 4px rgba(0,0,0,0.03);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
            <div style="flex:1; padding-right:10px;">
              <div style="font-weight:700; font-size:15px; color:#111; line-height:1.35;">${escapeHTML(group.title)}</div>
              ${group.totalQty > 1 ? `<div style="font-size:12px; color:#888; margin-top:2px;">單價 $${group.price}</div>` : ''}
            </div>
            <div style="text-align:right;">
              <div style="font-weight:800; font-size:16px; color:#111;">$${lineTotal.toLocaleString()}</div>
            </div>
          </div>

          ${formattedNoteHtml}

          <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
            <span style="background:#f4f5f7; color:#333; font-size:12px; font-weight:700; padding:3px 8px; border-radius:8px;">
              全團共 ${group.totalQty} 份
            </span>
            ${group.myQty > 0 ? `
              <span style="background:#e6fcf5; color:#0ca678; border:1px solid #c3fae8; font-size:12px; font-weight:700; padding:2px 8px; border-radius:8px;">
                ✅ 包含您的 ${group.myQty} 份
              </span>
            ` : ''}
            ${group.otherQty > 0 ? `
              <span style="background:#fff4e6; color:#d9480f; border:1px solid #ffe8cc; font-size:12px; font-weight:600; padding:2px 8px; border-radius:8px;">
                👥 他人 ${group.otherQty} 份 (${escapeHTML(memberDetails)})
              </span>
            ` : ''}
          </div>

          ${window.isGroupBuyClosed ? `
            <div style="margin-top:8px; padding-top:6px; border-top:1px dashed #f0f0f0; display:flex; justify-content:flex-end;">
              <span style="font-size:11px; color:#64748b; font-weight:600;">🔒 已於最終訂單送出 (唯讀)</span>
            </div>
          ` : (isLeader ? `
            <div style="margin-top:10px; padding-top:8px; border-top:1px dashed #f0f0f0; display:flex; justify-content:space-between; align-items:center;">
              <div style="font-size:11px; color:#f43f5e; font-weight:700;">👑 團長管理模式</div>
              <div style="display:flex; gap:6px; flex-wrap:wrap;">
                ${group.rawItems.map(rawItm => {
                  const rawIdx = cart.indexOf(rawItm);
                  return `<button onclick="removeCartItem(${rawIdx})" style="background:#fff1f2; border:1px solid #fecdd3; color:#e11d48; border-radius:12px; font-size:11px; padding:3px 8px; cursor:pointer; font-weight:700;">刪除 ${escapeHTML(rawItm.user_name || '餐點')}</button>`;
                }).join('')}
              </div>
            </div>
          ` : `
            <div style="margin-top:8px; padding-top:6px; border-top:1px dashed #f0f0f0; display:flex; justify-content:flex-end;">
              <button onclick="showGroupBuyPasswordAuthModal(null, '🔑 團長請登入', '非本人餐點僅團長可修改，請輸入密碼以解鎖管理權限：')" style="background:#f8f9fa; border:1px solid #e2e8f0; color:#718096; border-radius:12px; font-size:11px; padding:3px 10px; cursor:pointer; font-weight:600;">🔑 團長修改/刪除</button>
            </div>
          `)}
        </div>
        `;
      });

    } else {
      // 一般個人訂購模式
      const storeGroups = {};
      cart.forEach(item => {
        const sName = item.storeName || '未命名餐廳';
        if (!storeGroups[sName]) storeGroups[sName] = [];
        storeGroups[sName].push(item);
      });

      Object.keys(storeGroups).forEach(sName => {
        html += `
          <div style="display:flex; align-items:center; gap:8px; margin: 15px 0 12px 0;">
            <span style="font-size:20px;">🏪</span>
            <div style="font-size:18px; font-weight:800; color:#111; letter-spacing:-0.2px;">${escapeHTML(sName)}</div>
          </div>
        `;

        storeGroups[sName].forEach((item) => {
          const idx = cart.indexOf(item);
          const lineTotal = item.price * item.qty;
          total += lineTotal;
          totalItemsCount += item.qty;

          const formattedNoteHtml = formatCartNoteHTML(item.note);

          html += `
          <div style="background:#fff; border-radius:14px; padding:15px; margin-bottom:12px; border:1px solid #ebebeb; box-shadow:0 1px 4px rgba(0,0,0,0.03);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
              <div style="flex:1; padding-right:12px;">
                <div style="font-weight:700; font-size:16px; color:#111; line-height:1.35;">${escapeHTML(item.title)}</div>
                ${item.qty > 1 ? `<div style="font-size:12px; color:#888; margin-top:2px;">單價 $${item.price}</div>` : ''}
              </div>
              <div style="text-align:right;">
                <div style="font-weight:800; font-size:17px; color:#111;">$${lineTotal.toLocaleString()}</div>
              </div>
            </div>

            ${formattedNoteHtml}

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding-top:10px; border-top:1px dashed #f0f0f0;">
              <div style="font-size:13px; color:#888; font-weight:500;">
                ${item.qty} 份餐點
              </div>
              <div style="background:#f4f5f7; border-radius:24px; display:inline-flex; align-items:center; height:34px; padding:2px 4px; box-shadow:inset 0 1px 2px rgba(0,0,0,0.04);">
                <div onclick="updateCartItemQty(${idx}, -1)" style="width:32px; height:30px; border-radius:50%; background:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:14px; font-weight:bold; color:#333; box-shadow:0 1px 3px rgba(0,0,0,0.1); user-select:none;">${item.qty === 1 ? '🗑️' : '－'}</div>
                <div style="min-width:32px; text-align:center; font-size:15px; font-weight:700; color:#111;">${item.qty}</div>
                <div onclick="updateCartItemQty(${idx}, 1)" style="width:32px; height:30px; border-radius:50%; background:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:16px; font-weight:bold; color:#333; box-shadow:0 1px 3px rgba(0,0,0,0.1); user-select:none;">＋</div>
              </div>
            </div>
          </div>
          `;
        });
      });
    }

    // 總結資訊
    html += `
      <div style="background:#fff; border-radius:14px; padding:16px; border:1px solid #ebebeb; margin-top:16px; box-shadow:0 1px 4px rgba(0,0,0,0.03);">
        <div style="display:flex; justify-content:space-between; color:#666; font-size:14px; margin-bottom:8px;">
          <span>品項數量</span>
          <span style="font-weight:600; color:#333;">${totalItemsCount} 份</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px dashed #eee; padding-top:12px;">
          <span style="font-size:15px; font-weight:700; color:#333;">${window.currentGroupBuyId ? '全團總計' : '小計'}</span>
          <span style="font-size:22px; font-weight:900; color:#f43f5e; letter-spacing:-0.5px;">$${total.toLocaleString()}</span>
        </div>
      </div>
    `;

    document.getElementById('cartContent').innerHTML = html;

    const bottomBtn = document.getElementById('cartBottomPreviewBtn');
    if (bottomBtn) {
      if (window.isGroupBuyClosed) {
        bottomBtn.innerText = '🛒 我要自己另外點餐 (本團已送出)';
        bottomBtn.style.background = '#f43f5e';
      } else if (window.currentGroupBuyId) {
        const isLeader = isGroupBuyLeader();
        bottomBtn.innerText = isLeader ? '預覽訂單' : '🔒 預覽訂單 (團長登入結帳)';
        bottomBtn.style.background = '#111';
      } else {
        bottomBtn.innerText = '預覽訂單';
        bottomBtn.style.background = '#111';
      }
    }

    currentView = 'cart';
    document.getElementById('homeView').style.display = 'none';
    document.getElementById('storeView').style.display = 'none';
    document.getElementById('listView').style.display = 'none';
    document.getElementById('checkoutView').style.display = 'none';
    document.getElementById('cartView').style.display = 'block';

    if (!originalAppHeaderHtml) originalAppHeaderHtml = document.querySelector('.app-header').innerHTML;
    document.querySelector('.app-header').innerHTML = `
      <button onclick="goBackToStore()" style="background:transparent; border:none; font-size:20px; font-weight:bold; cursor:pointer; padding:0; display:flex; align-items:center; gap:8px; color:#111;">← <span style="font-size:18px;">${window.currentGroupBuyId ? '團購清單' : '購物車'}</span></button>
      ${window.isGroupBuyClosed ? '' : '<button onclick="goBackToStore()" style="background:#f5f5f5; color:#111; border:none; padding:7px 14px; border-radius:20px; font-weight:600; font-size:13px; cursor:pointer;">新增商品</button>'}
    `;
    document.querySelector('.app-header').style.display = 'flex';

    if (document.getElementById('floatingCartBtn')) document.getElementById('floatingCartBtn').style.display = 'none';
    window.scrollTo(0, 0);
  }

  function updateCartItemQty(idx, change) {
    const targetItem = cart[idx];
    if (!targetItem) return;

    // 團購權限檢查：只能修改自己的餐點 (根據設備指紋)
    if (window.currentGroupBuyId && !canEditCartItem(targetItem)) {
      const msg = !targetItem.device_fp 
        ? '此餐點無設備指紋紀錄，團長請登入以修改訂單：' 
        : '此餐點非您本人所加入，團長請登入以修改訂單：';
      showGroupBuyPasswordAuthModal((authed) => {
        if (authed) {
          updateCartItemQty(idx, change);
        }
      }, '🔑 團長請登入', msg);
      return;
    }

    // 點擊垃圾桶 (數量為 1 且減少)
    if (targetItem.qty === 1 && change === -1) {
      if (!confirm(`確定要將「${targetItem.title}」從購物車中刪除嗎？`)) {
        return;
      }
      const itemTitle = targetItem.title;
      const itemId = targetItem.id;
      if (window.currentGroupBuyId && typeof groupBuySyncCartAction === 'function') {
        groupBuySyncCartAction('remove', { index: idx, item_id: itemId, item_title: itemTitle });
        showToast(`🗑️ 已刪除「${itemTitle}」`);
        return;
      }

      cart.splice(idx, 1);
      updateCartBadge();
      if (typeof updateMenuActions === 'function') updateMenuActions();
      saveCart();
      showToast(`🗑️ 已刪除「${itemTitle}」`);
      if (cart.length === 0) {
        goBackToStore();
        return;
      }
      viewCart();
      return;
    }

    // 調整數量
    const itemTitle = targetItem.title;
    const itemId = targetItem.id;
    if (window.currentGroupBuyId && typeof groupBuySyncCartAction === 'function') {
      groupBuySyncCartAction('update_qty', { index: idx, item_id: itemId, item_title: itemTitle, delta: change });
      return;
    }

    cart[idx].qty += change;
    if (cart[idx].qty <= 0) {
      cart.splice(idx, 1);
    }

    updateCartBadge();
    if (typeof updateMenuActions === 'function') updateMenuActions();
    saveCart();
    if (cart.length === 0) {
      goBackToStore();
      return;
    }
    viewCart();
  }

  function removeCartItem(idx) {
    const targetItem = cart[idx];
    if (!targetItem) return;

    // 團購權限檢查：只能修改自己的餐點 (根據設備指紋)
    if (window.currentGroupBuyId && !canEditCartItem(targetItem)) {
      const msg = !targetItem.device_fp 
        ? '此餐點無設備指紋紀錄，團長請登入以刪除訂單：' 
        : '此餐點非您本人所加入，團長請登入以刪除訂單：';
      showGroupBuyPasswordAuthModal((authed) => {
        if (authed) {
          removeCartItem(idx);
        }
      }, '🔑 團長請登入', msg);
      return;
    }

    if (!confirm(`確定要將「${targetItem.title}」從購物車中刪除嗎？`)) return;
    const itemTitle = targetItem ? targetItem.title : '';
    const itemId = targetItem ? targetItem.id : '';

    if (window.currentGroupBuyId && typeof groupBuySyncCartAction === 'function') {
      groupBuySyncCartAction('remove', { index: idx, item_id: itemId, item_title: itemTitle });
      showToast(itemTitle ? `🗑️ 已刪除「${itemTitle}」` : '🗑️ 已刪除餐點');
      return;
    }

    cart.splice(idx, 1);
    updateCartBadge();
    if (typeof updateMenuActions === 'function') updateMenuActions();
    saveCart();
    showToast(itemTitle ? `🗑️ 已刪除「${itemTitle}」` : '🗑️ 已刪除餐點');
    if (cart.length === 0) { goBackToStore(); return; }
    viewCart();
  }



function goBackToStore() {

  document.getElementById('cartView').style.display = 'none';

  document.getElementById('checkoutView').style.display = 'none';

  

  if (originalAppHeaderHtml) {

    document.querySelector('.app-header').innerHTML = originalAppHeaderHtml;

  }

  document.querySelector('.app-header').style.display = 'flex';

  updateCartBadge();



  if (typeof currentStoreName !== 'undefined' && currentStoreName && window.currentStoreSchedulable === true && !(typeof isStoreSchedBlocked === 'function' && isStoreSchedBlocked(currentStoreUuid))) {

    document.getElementById('storeView').style.display = 'block';
    currentView = 'store';

    const ssb = document.getElementById('storeSearchBtn');
    if (ssb) ssb.style.display = 'block';

    const gbBtn = document.getElementById('groupBuyBtn');
    if (gbBtn) gbBtn.style.display = 'inline-flex';

  } else {

    document.getElementById('homeView').style.display = 'block';
    currentView = 'home';

    const ssb = document.getElementById('storeSearchBtn');
    if (ssb) ssb.style.display = 'none';

    const gbBtn = document.getElementById('groupBuyBtn');
    if (gbBtn) gbBtn.style.display = 'none';

  }

  if(document.getElementById('headerSearchBox') && document.getElementById('headerSearchBox').style.display === 'block') toggleStoreSearch();

}



function backToCart() {
  window._userManuallySelectedPlan = false;
  currentView = 'cart';
  document.getElementById('checkoutView').style.display = 'none';
  viewCart();
}




function updatePlanButtons() {
    // Obsolete UI updating replaced by static Selectable cards
}

window.selectedPlan = 'A';
window.selectPlan = function(p) {};

window.submitSelectedPlan = async function() {
    if (window.isSubmittingOrder || window._orderSent) return;

    // 🚀 立即給予使用者反饋：先跳出處理中視窗與鎖定按鈕
    const sName = (typeof currentStoreName !== 'undefined' && currentStoreName) ? currentStoreName : (document.getElementById('currentStoreName') ? document.getElementById('currentStoreName').innerText : '');
    const submitBtn = document.getElementById('checkoutSubmitBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = '處理中...';
        submitBtn.style.opacity = '0.7';
    }

    if (window.isGroceryStore) {
        showGroceryWaitingOverlay(sName || '生鮮雜貨門市');
    } else {
        showOrderWaitingOverlay(sName || '線上餐點門市');
    }

    if (!isClosedStatusBypassed() && window.lastServerStoreStatus && (window.lastServerStoreStatus.type === 'closed' || (window.lastServerStoreStatus.status && window.lastServerStoreStatus.status.toLowerCase() === 'closed'))) {
        hideOrderWaitingOverlay();
        hideGroceryWaitingOverlay();
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = '送出訂單'; submitBtn.style.opacity = '1'; }
        showModal('目前暫時無法接單', '', false, '', true);
        return;
    }

    if (window.isGroceryStore) {
        const is150 = sName.includes('優市');
        const typeTitle = is150 ? '優市' : '生鮮雜貨';
        if (window._groceryDisabled) {
            hideOrderWaitingOverlay();
            hideGroceryWaitingOverlay();
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = '送出訂單'; submitBtn.style.opacity = '1'; }
            showModal('目前暫停營業', `⚠️ 目前${typeTitle}已售完，暫停營業，請等待補貨！`, true, `<button onclick="document.getElementById('errorModalOverlay').style.display='none';" style="margin-top:15px; background:#f43f5e; color:#fff; border:none; border-radius:8px; padding:12px; width:100%; font-size:15px; font-weight:bold; cursor:pointer;">我知道了</button>`, true);
            return;
        }
        if (typeof checkGroceryStatus === 'function') {
            const isDisabled = await checkGroceryStatus(sName);
            if (isDisabled) {
                hideOrderWaitingOverlay();
                hideGroceryWaitingOverlay();
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = '送出訂單'; submitBtn.style.opacity = '1'; }
                if (typeof applyGroceryDisabledUI === 'function') applyGroceryDisabledUI(sName, true);
                return;
            }
        }
        sendOrderToLine();
        return;
    }

    let costRes = typeof calcOrderCost === 'function' ? calcOrderCost(cart, window.currentSelectedPlan) : null;
    let isSplit = costRes && costRes.shouldSplit;
    sendOrderToLine(isSplit ? 'split' : 'planA');
};

function openCheckoutSummary() {
    if (!isClosedStatusBypassed() && window.lastServerStoreStatus && (window.lastServerStoreStatus.type === 'closed' || (window.lastServerStoreStatus.text && window.lastServerStoreStatus.text.includes('無法接單')))) {
        showModal('目前暫時無法接單', '', false, '', true);
        return;
    }
    if (window.isGroupBuyClosed) {
        showToast('⚠️ 本團購訂單已送出結帳，團購已截止！');
        return;
    }

    if (window.currentGroupBuyId && !isGroupBuyLeader()) {
        showGroupBuyPasswordAuthModal((authed) => {
            if (authed) {
                openCheckoutSummary();
            }
        }, '🔑 團長身份驗證', '請輸入團購密碼以取得團長權限並預覽結帳：');
        return;
    }

    if (window.isGroceryStore && typeof openGroceryCheckoutSummary === 'function') {
        openGroceryCheckoutSummary();
        return;
    }

    const schedCheck = typeof validateStoreSchedule === 'function' ? validateStoreSchedule() : { valid: true };
    if (!schedCheck.valid) {
        if (schedCheck.reason === 'NOT_SCHEDULABLE' || schedCheck.reason === 'NOT_SCHEDULABLE_UNVERIFIED') {
            if (typeof showHardBlockModal === 'function') {
                showHardBlockModal('無法為您代購', schedCheck.text || '此餐廳無法預約或代訂，請選擇其他餐廳');
            } else {
                showModal('無法為您代購', schedCheck.text || '此餐廳無法代訂，請選擇其他餐廳', true);
            }
            return;
        }
        window.currentStoreClosed = true;
        window.mustSelectScheduleBeforeCheckout = true;
        if (typeof showStoreScheduleModal === 'function') {
            showStoreScheduleModal({ invalidScheduleText: (scheduleMode === 'SCHEDULE' ? schedCheck.text : ''), isCheckout: true });
        } else if (typeof showScheduleSelectModalForClosedStore === 'function') {
            showScheduleSelectModalForClosedStore();
        }
        return;
    }


  let total = 0;

  cart.forEach(item => total += item.price * item.qty);

  

  const savedPhone = (window.currentGroupBuyId && window.groupBuyData?.phone) ? window.groupBuyData.phone : (localStorage.getItem('userPhone') || '');

  const oldDeliveryNotes = (window.currentGroupBuyId && window.groupBuyData?.delivery_notes !== undefined) ? window.groupBuyData.delivery_notes : ((document.getElementById('deliveryNotes') ? document.getElementById('deliveryNotes').value.trim() : '') || localStorage.getItem('userDeliveryNotes') || '');

  const selectedMethod = (window.currentGroupBuyId && window.groupBuyData?.delivery_method) ? window.groupBuyData.delivery_method : ((document.getElementById('deliveryMethod') ? document.getElementById('deliveryMethod').value : '') || localStorage.getItem('userDeliveryMethod') || '當面點交');

  const oldFoodNotes = (window.currentGroupBuyId && window.groupBuyData?.food_notes !== undefined) ? window.groupBuyData.food_notes : ((document.getElementById('foodNotes') ? document.getElementById('foodNotes').value.trim() : '') || localStorage.getItem('userFoodNotes') || '');

  let addr = document.getElementById('addrInput') ? document.getElementById('addrInput').value.trim() : '';
  if (!addr && window.currentGroupBuyId && window.groupBuyData?.address) {
    addr = window.groupBuyData.address;
  }
  if (addr.startsWith('📍 ')) addr = addr.substring(3).trim();

  

  let timeText = '盡快送達';

  if (typeof scheduleMode !== 'undefined' && scheduleMode !== 'ASAP') {

    const timeSelect = document.getElementById('scheduleTime');

    if (timeSelect && timeSelect.options[timeSelect.selectedIndex]) {

      timeText = document.getElementById('triggerTimeText') ? document.getElementById('triggerTimeText').innerText : timeSelect.options[timeSelect.selectedIndex].text;

    }

  }

  

  let html = `

    <div style="background:#fff; padding:15px; font-size:16px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">

      <div style="margin-bottom:12px;">

        <label style="display:block; margin-bottom:5px;"><strong>外送地址:</strong></label>

        <input type="text" id="checkoutAddrInput" value="${escapeHTML(addr)}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;">

      </div>

      <div style="margin-bottom:12px;">

        <div style="display:flex; align-items:center; margin-bottom:5px;">

          <strong>外送方式與備註:</strong>

          <span onclick="showModal('外送方式說明', '', false, '<div style=\'text-align:center; font-size:15px; line-height:1.6; color:#555;\'><b>當面點交：</b>通常需要現場告知外送員PIN碼<br><br><b>放在門口：</b>放在您指定的位置，風險是有可能放錯位置</div>')" style="display:inline-block; margin-left:8px; width:18px; height:18px; line-height:18px; text-align:center; border-radius:50%; background:#ccc; color:#fff; font-size:12px; cursor:pointer; font-weight:bold;">?</span>

        </div>

        <div style="display:flex; gap:8px;">

          <select id="checkoutDeliveryMethod" onchange="if(typeof setDeliveryMethod==='function') setDeliveryMethod(this.value, true);" style="flex:0 0 auto; padding:8px; border:1px solid #ccc; border-radius:6px; background:#fff; outline:none; cursor:pointer;">

            <option value="當面點交" ${selectedMethod === '當面點交' ? 'selected' : ''}>當面點交</option>

            <option value="放在門口" ${selectedMethod === '放在門口' ? 'selected' : ''}>放在門口</option>

          </select>

          <input type="text" id="checkoutDeliveryNotes" value="${escapeHTML(oldDeliveryNotes)}" oninput="if(typeof handleDeliveryNoteChange==='function') handleDeliveryNoteChange(this.value);" onchange="if(typeof saveSimpleHistory==='function') saveSimpleHistory('deliveryNotes');" placeholder="例如：到了打電話..." style="flex:1; padding:8px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;">

        </div>

      </div>

      <div style="margin-bottom:12px;">

        <label style="display:block; margin-bottom:5px;"><strong>電話:</strong></label>

        <input type="tel" id="checkoutPhone" value="${savedPhone}" placeholder="例如: 0912345678" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;" oninput="syncPhone(\'checkout\')">

      </div>

      <div style="margin-bottom:15px; display:flex; align-items:center;"><strong>外送時間:</strong> <span style="margin-left:5px;">${escapeHTML(timeText)}</span> <button onclick="openTimePickerModal()" style="margin-left:10px; padding:2px 10px; font-size:12px; cursor:pointer; background:#fff; border:1px solid #000; border-radius:15px; font-weight:bold; color:#000;">修改</button></div>

      

      <div style="font-weight:bold; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;">訂單摘要</div>

  `;

  

  cart.forEach((item, idx) => {

    const lineTotal = item.price * item.qty;

    html += `

      <div style="margin-bottom: 8px;">

        <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="toggleSummaryItem(${idx})">

          <div style="display:flex; gap: 8px; align-items:center; flex:1;">

            

            <div style="font-weight:bold; flex:1; display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden;">${escapeHTML(item.title)}</div>

          </div>

          <div style="display:flex; gap: 10px; align-items:center;">

            <div style="font-weight:bold; margin-right: 15px; color:#111;">${item.qty}x</div>

            <div style="font-weight:bold;">$${lineTotal}</div>

            <div id="summary-arrow-${idx}" style="color:#999; font-size:12px; font-weight:bold; min-width:14px; text-align:center;">v</div>

          </div>

        </div>

        <div id="summary-detail-${idx}" style="display:none; margin-top:6px; font-size:13px; color:#666;">
          ${(window.currentGroupBuyId && item.user_name) ? `<div style="font-weight:700; color:#06c167; font-size:12px; margin-bottom:4px; padding-left:2px;">👤 點餐人：${escapeHTML(item.user_name)}</div>` : ''}
          ${item.note ? formatCartNoteHTML(item.note) : '<div style="color:#999; padding-left:10px;">無額外選項</div>'}
        </div>

      </div>

    `;

  });

  

  html += `

      <div style="margin-top:15px; padding-top:10px; border-top:1px solid #eee;">

        <strong>餐點訂單備註:</strong><span style="font-size:12px; color:#666; font-weight:normal; margin-left:4px;">(會加在每個餐點備註上)</span>

        <input type="text" id="checkoutFoodNotes" value="${escapeHTML(oldFoodNotes)}" placeholder="例如: 全部不要加蔥..." style="width:100%; padding:8px; margin-top:4px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;">

      </div>

  

      


  `;
      let storeCountUI = 0;
      const sCounts = {};
      cart.forEach(it => { if(!sCounts[it.storeName]) { sCounts[it.storeName]=true; storeCountUI++; }});
      // visualSvcFee will be calculated dynamically below

      




// ========== 雙軌方案智慧預設與單行緊湊結帳卡片 (150內半價 vs 300內半價) ==========
      const canUsePlan300 = (!window.isGroceryStore && typeof isPlan300Eligible === 'function' && isPlan300Eligible());
      if (!canUsePlan300) {
        window.currentSelectedPlan = '150';
      }

      const comparison = (canUsePlan300 && typeof getPlanComparison === 'function') ? getPlanComparison(cart) : null;
      if (canUsePlan300 && !window._userManuallySelectedPlan) {
        if (comparison && comparison.recommended === '300' && window.couponBEnabled) {
          window.currentSelectedPlan = '300';
        } else {
          window.currentSelectedPlan = '150';
        }
      }

      const activePlan = window.currentSelectedPlan || '150';
      const isPlan300 = canUsePlan300 && (activePlan === '300');
      const planThemeColor = isPlan300 ? '#276ef1' : '#f43f5e';
      const visualSvcFee = isPlan300 ? 50 : 20;
      const promoCap = isPlan300 ? 300 : 150;
      const maxPromoVal = isPlan300 ? 150 : 75;
      const otherPlan = isPlan300 ? '150' : '300';
      const otherCap = isPlan300 ? 150 : 300;

      let switchBtnHtml = '';
      if (canUsePlan300) {
        if (!window.couponBEnabled && otherPlan === '300') {
          switchBtnHtml = `<span style="font-size:11px; color:#9ca3af; background:#f3f4f6; padding:2px 6px; border-radius:10px;">額滿</span>`;
        } else {
          switchBtnHtml = `
            <button type="button" onclick="switchPlanTab('${otherPlan}')" style="background:#fff; border:1px solid ${planThemeColor}; color:${planThemeColor}; font-size:12px; font-weight:bold; padding:2px 8px; border-radius:12px; cursor:pointer; outline:none; -webkit-tap-highlight-color:transparent;">切換</button>
          `;
        }
      }

      const planTitleText = isPlan300 
        ? '結帳明細 ($300內半價)' 
        : '結帳明細 ($150內半價)';

      let cardHeaderHtml = '';
      if (canUsePlan300) {
        cardHeaderHtml = `
          <div style="position:relative; text-align:center; margin-bottom:4px; min-height:24px; display:flex; align-items:center; justify-content:center;">
            <div style="font-weight:bold; color:${planThemeColor}; font-size:15px; text-align:center;">${planTitleText}</div>
            <div style="position:absolute; right:0; top:50%; transform:translateY(-50%);">${switchBtnHtml}</div>
          </div>
        `;
      } else {
        cardHeaderHtml = `
          <div style="font-weight:bold; margin-bottom:2px; color:${planThemeColor}; font-size:15px; text-align:center;">${planTitleText}</div>
        `;
      }
html += `<div id="planACard" style="background:#f9f9f9; padding:10px; border-radius:8px; border:2px solid ${planThemeColor}; text-align:center; font-size:14px; position:relative;">`;

      let origTable = cardHeaderHtml;
      origTable += `<table style="margin: 0 auto; color: #666; font-size: 14px; border-collapse: collapse; text-align: left; margin-top:10px;">`;
      origTable += `<tr><td style="text-align:right; padding:2px 4px 2px 0;">小計:</td><td style="padding:2px 0 2px 4px;">$${total}</td></tr>`;
      origTable += total >= promoCap ? `<tr><td style="text-align:right; padding:2px 4px 2px 0; color:${planThemeColor};">優惠折抵:</td><td style="padding:2px 0 2px 4px; color:${planThemeColor};">-$${maxPromoVal}</td></tr>` : `<tr><td style="text-align:right; padding:2px 4px 2px 0; color:${planThemeColor};">優惠折抵:</td><td style="padding:2px 0 2px 4px; color:${planThemeColor};">-$${Math.floor(total/2)}</td></tr>`;
      origTable += `<tr><td style="text-align:right; padding:2px 4px 2px 0;">代訂費:</td><td style="padding:2px 0 2px 4px;">$${visualSvcFee}</td></tr>`;
      const isDiscount = (cart.length > 0) ? cart.every(it => it.storeCanPickup) : (localStorage.getItem('uberCartIsDiscount') === 'true');
      let aTotalExcess = (function(){
          if (isDiscount) return 0;
          let te = 0; const sg = {};
          cart.forEach(it => { if(!sg[it.storeName||'']) sg[it.storeName||'']=[]; sg[it.storeName||''].push(it); });
          Object.keys(sg).forEach(s => {
              te += Math.max(0, ...sg[s].map(it => (it.storeCanPickup ? 0 : (it.storeDeliveryFee||0))));
          });
          return te;
      })();
      origTable += `<tr><td style="text-align:right; padding:2px 4px 2px 0;">外送加成:</td><td style="padding:2px 0 2px 4px;">$${aTotalExcess}</td></tr>`;
      origTable += `<tr><td style="text-align:right; padding:2px 4px 2px 0;">服務費:</td><td style="padding:2px 0 2px 4px;">$0</td></tr>`;

      const preOrderDisc = typeof getPreOrderDiscount === 'function' ? getPreOrderDiscount() : 0;
      if (preOrderDisc > 0) {
          origTable += `<tr><td style="text-align:right; padding:2px 4px 2px 0; color:${planThemeColor};">預訂折扣:</td><td style="padding:2px 0 2px 4px; color:${planThemeColor};">-$${preOrderDisc}</td></tr>`;
      }
      origTable += `</table>`;
      origTable += `<div style="font-weight:bold; font-size:16px; margin-top:10px; border-top:1px solid #ccc; padding-top:6px;">`;
      origTable += (function(){
          let totalExcess = 0;
          if (!isDiscount) {
              const sg = {};
              cart.forEach(it => { if(!sg[it.storeName||'']) sg[it.storeName||'']=[]; sg[it.storeName||''].push(it); });
              Object.keys(sg).forEach(s => {
                  totalExcess += Math.max(0, ...sg[s].map(it => (it.storeCanPickup ? 0 : (it.storeDeliveryFee||0))));
              });
          }
          let totalOrigExcess = 0;
          const sg = {};
          cart.forEach(it => { if(!sg[it.storeName||'']) sg[it.storeName||'']=[]; sg[it.storeName||''].push(it); });
          Object.keys(sg).forEach(s => {
              totalOrigExcess += Math.max(0, ...sg[s].map(it => (typeof it.originalStoreDeliveryFee !== 'undefined' ? it.originalStoreDeliveryFee : (it.storeDeliveryFee > 0 ? it.storeDeliveryFee + 50 : 0))));
          });

          const pd = total >= promoCap ? maxPromoVal : Math.floor(total/2);
          const pr = typeof getPreOrderDiscount === 'function' ? getPreOrderDiscount() : 0;
          return `總計: <span style="text-decoration:line-through; color:#999; font-size:13px; margin-right:4px;">$${total + visualSvcFee + totalOrigExcess}</span> <span style="color:#d32f2f; font-size:18px;">$${total - pd + visualSvcFee + totalExcess - pr}</span>`;
      })();
      origTable += `</div>`;

      let costRes = typeof calcOrderCost === 'function' ? calcOrderCost(cart, activePlan) : null;
      if (costRes && costRes.shouldSplit) {
          let splitFood = 0; let splitPromo = 0; let splitExcess = 0; let splitPreorder = 0; let splitFee = costRes.bins.length * visualSvcFee;
          costRes.bins.forEach(bin => {
              splitFood += bin.sum;
              splitPromo += (bin.sum >= promoCap ? maxPromoVal : Math.floor(bin.sum / 2));
              let bsg = {}; bin.items.forEach(i => { if(!bsg[i.storeName||'']) bsg[i.storeName||'']=[]; bsg[i.storeName||''].push(i); });
              let binEx = 0;
              if (!isDiscount) {
                  Object.keys(bsg).forEach(s => {
                      binEx += Math.max(0, ...bsg[s].map(it => it.storeDeliveryFee||0));
                  });
              }
              splitExcess += binEx;
              let pr = typeof getPreOrderDiscount === 'function' ? getPreOrderDiscount() : 0;
              splitPreorder += pr;
          });

          let originalBaseStr = total + visualSvcFee + (function(){ let te = 0; const ssg = {}; cart.forEach(it => { if(!ssg[it.storeName||'']) ssg[it.storeName||'']=[]; ssg[it.storeName||''].push(it); }); Object.keys(ssg).forEach(s => { te += Math.max(0, ...ssg[s].map(it => (typeof it.originalStoreDeliveryFee !== 'undefined' ? it.originalStoreDeliveryFee : (it.storeDeliveryFee > 0 ? it.storeDeliveryFee + 50 : 0)))); }); return te; })();

          let sumTable = cardHeaderHtml;
          sumTable += `<div style="margin-bottom:8px; color:#666; font-size:12px; font-weight:bold;">(共拆成 ${costRes.bins.length} 單)</div>`;
          sumTable += `<table style="margin: 0 auto; color: #666; font-size: 14px; border-collapse: collapse; text-align: left;">`;
          sumTable += `<tr><td style="text-align:right; padding:2px 4px 2px 0; white-space:nowrap;">小計:</td><td style="padding:2px 0 2px 4px; white-space:nowrap;"><span style="visibility:hidden">-</span>$${splitFood}</td></tr>`;
          sumTable += `<tr><td style="text-align:right; padding:2px 4px 2px 0; color:${planThemeColor}; white-space:nowrap;">優惠折抵:</td><td style="padding:2px 0 2px 4px; color:${planThemeColor}; white-space:nowrap;">-$${splitPromo}</td></tr>`;
          sumTable += `<tr><td style="text-align:right; padding:2px 4px 2px 0; white-space:nowrap;">代訂費:</td><td style="padding:2px 0 2px 4px; white-space:nowrap;"><span style="visibility:hidden">-</span>$${splitFee}</td></tr>`;
          sumTable += `<tr><td style="text-align:right; padding:2px 4px 2px 0; white-space:nowrap;">外送加成:</td><td style="padding:2px 0 2px 4px; white-space:nowrap;"><span style="visibility:hidden">-</span>$${splitExcess}</td></tr>`;
          sumTable += `<tr><td style="text-align:right; padding:2px 4px 2px 0; white-space:nowrap;">服務費:</td><td style="padding:2px 0 2px 4px; white-space:nowrap;"><span style="visibility:hidden">-</span>$0</td></tr>`;
          if (splitPreorder > 0) {
              sumTable += `<tr><td style="text-align:right; padding:2px 4px 2px 0; color:${planThemeColor}; white-space:nowrap;">預定折扣:</td><td style="padding:2px 0 2px 4px; color:${planThemeColor}; white-space:nowrap;">-$${splitPreorder}</td></tr>`;
          }
          sumTable += `</table>`;
          sumTable += `<div style="font-weight:bold; font-size:16px; margin-top:10px; border-top:1px solid #ccc; padding-top:6px;">`;
          sumTable += `總計: <span style="text-decoration:line-through; color:#999; font-size:13px; margin-right:4px;">$${originalBaseStr}</span> <span style="color:#d32f2f; font-size:18px;">$${costRes.bestCost}</span>`;
          sumTable += `</div>`;

          const planKey = isPlan300 ? 'B' : 'A';
          if (isPlan300) {
              window._splitOrigHtmlB = sumTable; window._splitBinsB = costRes.bins; window._splitSavingsB = costRes.savings; window._splitBestCostB = costRes.bestCost; window._currentSplitIndexB = -1;
          } else {
              window._splitOrigHtmlA = sumTable; window._splitBinsA = costRes.bins; window._splitSavingsA = costRes.savings; window._splitBestCostA = costRes.bestCost; window._currentSplitIndexA = -1;
          }
          
          html += `<button onclick="switchSplitTab('${planKey}', -1)" style="position:absolute; left:-5px; top:50%; transform:translateY(-50%); border:none; background:transparent; font-size:20px; cursor:pointer; color:${planThemeColor}; padding:10px; z-index:2;">◀</button>`;
          html += `<div id="splitTabContent${planKey}" style="min-height:220px; padding: 0 10px;">` + sumTable + `</div>`;
          html += `<button onclick="switchSplitTab('${planKey}', 1)" style="position:absolute; right:-5px; top:50%; transform:translateY(-50%); border:none; background:transparent; font-size:20px; cursor:pointer; color:${planThemeColor}; padding:10px; z-index:2;">▶</button>`;
          html += `<div style="position:absolute; bottom:2px; left:0; right:0; display:flex; justify-content:center; gap:4px;">`;
          html += `<div id="split-dot-${planKey}--1" style="width:6px; height:6px; border-radius:50%; background:${planThemeColor};"></div>`;
          for(let b=0; b<costRes.bins.length; b++){
              html += `<div id="split-dot-${planKey}-${b}" style="width:6px; height:6px; border-radius:50%; background:#ccc;"></div>`;
          }
          html += `</div>`;
      } else {
          html += origTable;
      }
      html += `</div>`; // closes Plan A






      html += `
    </div>

  `;

  

  document.getElementById('checkoutContent').innerHTML = html;

  

  

  currentView = 'checkout';
  document.getElementById('cartView').style.display = 'none';

  document.getElementById('checkoutView').style.display = 'block';
      if (document.getElementById('floatingCartBtn')) document.getElementById('floatingCartBtn').style.display = 'none';
      updatePlanButtons();

  

  if (!originalAppHeaderHtml) originalAppHeaderHtml = document.querySelector('.app-header').innerHTML;

  document.querySelector('.app-header').innerHTML = `

    <button onclick="backToCart()" style="background:transparent; border:none; font-size:24px; font-weight:bold; cursor:pointer; padding:0; display:flex; align-items:center; gap:10px; color:#111;">← <span style="font-size:20px;">預覽訂單</span></button>

  `;

  document.querySelector('.app-header').style.display = 'flex';

  window.scrollTo(0, 0);



}

function toggleSummaryItem(idx) {

  const detail = document.getElementById('summary-detail-' + idx);

  const arrow = document.getElementById('summary-arrow-' + idx);

  if (detail.style.display === 'none') {

    detail.style.display = 'block';

    arrow.innerText = '^';

  } else {

    detail.style.display = 'none';

    arrow.innerText = 'v';

  }

}



function openGroceryCheckoutSummary() {
  const is150 = (currentStoreName && currentStoreName.includes('優市'));
  const typeTitle = is150 ? '優市' : '生鮮雜貨';
  if (window._groceryDisabled) {
      showModal('目前暫停營業', `⚠️ 目前${typeTitle}已售完，暫停營業，請等待補貨！`, true, `<button onclick="document.getElementById('errorModalOverlay').style.display='none'; if(typeof handleMainBack==='function') handleMainBack();" style="margin-top:15px; background:#f43f5e; color:#fff; border:none; border-radius:8px; padding:12px; width:100%; font-size:15px; font-weight:bold; cursor:pointer;">我知道了</button>`, true);
      return;
  }

  const schedCheck = typeof validateStoreSchedule === 'function' ? validateStoreSchedule() : { valid: true };
  if (!schedCheck.valid) {
      window.currentStoreClosed = true;
      window.mustSelectScheduleBeforeCheckout = true;
      const tType = (typeof currentVertical !== 'undefined' && currentVertical === 'SHOP') ? '商店' : '餐廳';
      if (schedCheck.reason === 'NOT_SCHEDULABLE' || schedCheck.reason === 'NOT_SCHEDULABLE_UNVERIFIED') {
          if (typeof showHardBlockModal === 'function') {
              showHardBlockModal('無法為您代購', schedCheck.text || `此${tType}無法預約或代訂，請選擇其他${tType}`, function() {
                  if (typeof handleMainBack === 'function') handleMainBack();
              });
          } else {
              showModal('無法為您代購', schedCheck.text || `此${tType}無法代訂，請選擇其他${tType}`, true);
          }
          return;
      }
      showModal('目前暫停營業', `此${tType}目前尚未營業（暫停營業），無法以「盡快送達」接單，請稍候再試。`, true, `<button onclick="closeErrorModal(); if(typeof handleMainBack==='function') handleMainBack();" style="margin-top:15px; background:#f43f5e; color:#fff; border:none; border-radius:8px; padding:12px; width:100%; font-size:15px; font-weight:bold; cursor:pointer;">我知道了</button>`, true);
      return;
  }

  const savedPhone = localStorage.getItem('userPhone') || '';

  const oldDeliveryNotes = document.getElementById('deliveryNotes') ? document.getElementById('deliveryNotes').value.trim() : '';

  const selectedMethod = document.getElementById('deliveryMethod') ? document.getElementById('deliveryMethod').value : '當面點交';



  let addr = document.getElementById('addrInput') ? document.getElementById('addrInput').value.trim() : '';

  if (addr.startsWith('📍 ')) addr = addr.substring(3).trim();



  const isForcedPxmart = typeof isPxmartName === 'function' ? isPxmartName(currentStoreName) : (currentStoreName && currentStoreName.includes('全聯') && !currentStoreName.includes('大全聯'));

  let timeText = '盡快送達';
  let isAdvanceBooking = false; // 179分鐘以上: 專人代訂費 45 元
  let isThreeHourSlot = false;  // 三小時時段: 優惠時段折扣 -$25

  if (!isForcedPxmart && typeof scheduleMode !== 'undefined' && scheduleMode !== 'ASAP') {
    const timeSelect = document.getElementById('scheduleTime');
    if (timeSelect && timeSelect.options[timeSelect.selectedIndex]) {
      timeText = document.getElementById('triggerTimeText') ? document.getElementById('triggerTimeText').innerText : timeSelect.options[timeSelect.selectedIndex].text;

      const ts = typeof getSelectedScheduleTimestamp === 'function' ? getSelectedScheduleTimestamp() : 0;
      if (ts && (ts - Date.now() >= 179 * 60 * 1000)) {
        isAdvanceBooking = true;
      }

      const tsVal = timeSelect.value;
      if (tsVal) {
          try {
              const parsed = JSON.parse(tsVal);
              if ((parsed.endTime - parsed.startTime === 180) || parsed.discount === 25) {
                  isThreeHourSlot = true;
              }
          } catch(e) {}
      }
    }
  }

  const minSpend = is150 ? 399 : 449;
  const promoDiscount = is150 ? 150 : 180;
  const agentFee = is150 ? 50 : (isAdvanceBooking ? 45 : 60);
  const timeSlotDiscount = isThreeHourSlot ? 25 : 0;

  let svcDisplayHtml = '';
  let svcCalcStr = '';
  let totalEstimateStr = '';

  if (is150) {
      svcDisplayHtml = '<span style="color:#d32f2f; font-weight:bold;">免服務費</span>';
      svcCalcStr = '0';
      const netTotal = minSpend - promoDiscount + 0 + agentFee - timeSlotDiscount;
      totalEstimateStr = `$${netTotal}`;
  } else {
      let svcStr = window.groceryServiceFee !== undefined && window.groceryServiceFee !== null ? `$${window.groceryServiceFee}` : '$30~$60不等';
      svcDisplayHtml = `<span>${svcStr}</span>`;
      if (window.groceryServiceFee !== undefined && window.groceryServiceFee !== null) {
          svcCalcStr = `${window.groceryServiceFee}`;
          const netTotal = minSpend - promoDiscount + window.groceryServiceFee + agentFee - timeSlotDiscount;
          totalEstimateStr = `$${netTotal}`;
      } else {
          svcCalcStr = '30~60';
          const minTotal = minSpend - promoDiscount + 30 + agentFee - timeSlotDiscount;
          const maxTotal = minSpend - promoDiscount + 60 + agentFee - timeSlotDiscount;
          totalEstimateStr = `$${minTotal} ~ $${maxTotal}`;
      }
  }



  let html = `

    <div style="background:#fff; padding:15px; font-size:16px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">



      <div style="margin-bottom:12px;"><strong>🏪 預訂代訂店家:</strong> <a href="${currentStoreUrl}" target="_blank" style="color:#f43f5e; text-decoration:none;">${escapeHTML(currentStoreName)}</a></div>

      <div style="margin-bottom:12px;">

        <label style="display:block; margin-bottom:5px;"><strong>📍 外送地址:</strong></label>

        <input type="text" id="groceryAddrInput" value="${escapeHTML(addr)}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;">

      </div>

      

      <div style="margin-bottom:12px;">

        <div style="display:flex; align-items:center; margin-bottom:5px;">

          <strong>外送方式與備註:</strong>

          <span onclick="showModal('外送方式說明', '', false, '<div style=\'text-align:center; font-size:15px; line-height:1.6; color:#555;\'><b>當面點交：</b>通常需要現場告知外送員PIN碼<br><br><b>放在門口：</b>放在您指定的位置，風險是有可能放錯位置</div>')" style="display:inline-block; margin-left:8px; width:18px; height:18px; line-height:18px; text-align:center; border-radius:50%; background:#ccc; color:#fff; font-size:12px; cursor:pointer; font-weight:bold;">?</span>

        </div>

        <div style="display:flex; gap:8px;">

          <select id="groceryDeliveryMethod" onchange="if(typeof setDeliveryMethod==='function') setDeliveryMethod(this.value, true);" style="flex:0 0 auto; padding:8px; border:1px solid #ccc; border-radius:6px; background:#fff; outline:none; cursor:pointer;">

            <option value="當面點交" ${selectedMethod === '當面點交' ? 'selected' : ''}>當面點交</option>

            <option value="放在門口" ${selectedMethod === '放在門口' ? 'selected' : ''}>放在門口</option>

          </select>

          <input type="text" id="groceryDeliveryNotes" value="${escapeHTML(oldDeliveryNotes)}" oninput="if(typeof handleDeliveryNoteChange==='function') handleDeliveryNoteChange(this.value);" onchange="if(typeof saveSimpleHistory==='function') saveSimpleHistory('deliveryNotes');" placeholder="例如：到了打電話..." style="flex:1; padding:8px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;">

        </div>

      </div>

      

      <div style="margin-bottom:12px;">

        <label style="display:block; margin-bottom:5px;"><strong>聯絡電話 (必填):</strong></label>

        <input type="tel" id="groceryPhone" value="${escapeHTML(savedPhone)}" placeholder="外送員聯絡用" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;" oninput="syncPhone(\'grocery\')">

      </div>



      ${isForcedPxmart ? `
        <div style="margin-bottom:15px; display:flex; align-items:center;">
          <strong>外送時間:</strong> <span style="margin-left:5px;">盡快送達</span>
          <span onclick="showModal('外送時間說明', '', false, '<div style=\\\'text-align:center; font-size:15px; line-height:1.6; color:#555;\\\'>因為這個店家只接受即時訂單<br>無法預約時段下單</div>')" style="display:inline-block; margin-left:8px; width:18px; height:18px; line-height:18px; text-align:center; border-radius:50%; background:#ccc; color:#fff; font-size:12px; cursor:pointer; font-weight:bold;" title="查看說明">?</span>
        </div>
      ` : `
        <div style="margin-bottom:15px; display:flex; align-items:center;"><strong>外送時間:</strong> <span style="margin-left:5px;">${escapeHTML(timeText)}</span> <button onclick="openTimePickerModal()" style="margin-left:10px; padding:2px 10px; font-size:12px; cursor:pointer; background:#fff; border:1px solid #000; border-radius:15px; font-weight:bold; color:#000;">修改</button></div>
      `}

      ${(isThreeHourSlot || isAdvanceBooking) ? `
        <div style="color:#f43f5e; margin-bottom:4px; font-size:14px; font-weight:bold;">
          ${isThreeHourSlot ? '✨ 預約三小時時段享優惠時段折扣 -$25' : ''}
          ${(isThreeHourSlot && isAdvanceBooking) ? '，且' : (isAdvanceBooking ? '✨ ' : '')}
          ${isAdvanceBooking ? '提前179分鐘預約享專人代訂費優惠 $45' : ''}
        </div>
      ` : ''}

      </div>



      <hr style="border:0; border-top:1px solid #eee; margin:15px 0;">

      <div style="padding: 0 10px;">

        <h3 style="margin:0 0 12px 0; font-size:18px;">訂單優惠與費用試算</h3>

        <div style="color:#555; line-height:1.8;">

          <div style="display:flex; justify-content:space-between;"><span>🏷️ 優惠方案</span><span>${escapeHTML(timeText)}</span></div>

          <div style="display:flex; justify-content:space-between;"><span>💰 滿額條件</span><span>需滿 $${minSpend}</span></div>

          <div style="display:flex; justify-content:space-between; color:#f43f5e;"><span>💸 優惠折扣</span><span>-$${promoDiscount}</span></div>

          <div style="display:flex; justify-content:space-between;"><span>🛵 平台服務費</span>${svcDisplayHtml}</div>

          ${is150 ? `

          <div style="display:flex; justify-content:space-between;"><span>💼 專人代訂費</span><span>$50</span></div>

          ` : (isAdvanceBooking ? `

          <div style="display:flex; justify-content:space-between;"><span>💼 專人代訂費</span><span><del>$60</del> $45 <span style="color:#f43f5e; font-size:13px; font-weight:bold;">(179分鐘以上預約優惠)</span></span></div>

          ` : `

          <div style="display:flex; justify-content:space-between;"><span>💼 專人代訂費</span><span>$60</span></div>

          `)}

          ${isThreeHourSlot ? `

          <div style="display:flex; justify-content:space-between; color:#f43f5e; font-weight:bold;"><span>⏰ 優惠時段折扣</span><span>-$25</span></div>

          ` : ''}

        </div>

      </div>



      <hr style="border:0; border-top:1px solid #eee; margin:15px 0;">

      <div style="background:#f8f9fa; padding:12px; border-radius:6px;">

        <div style="font-weight:bold; margin-bottom:8px;">🧮 費用試算 (以剛好滿$${minSpend}為例)</div>

        <div style="color:#555;">

          ${minSpend} (商品) - ${promoDiscount} (優惠) + ${svcCalcStr} (平台費) + ${agentFee} (代訂費)${isThreeHourSlot ? ' - 25 (優惠時段)' : ''}<br>

          <strong style="color:#d32f2f; font-size:18px;">預估總計約: ${totalEstimateStr}</strong>

        </div>

      </div>

      

      <div id="groceryCheckoutNotice" style="margin-top:20px; font-size:14px; color:#666;">

        ⚠️ <b>注意：</b>此為生鮮雜貨代訂。我們不需要您在此點選詳細商品，請直接送出訂單後，代訂會提供網址，直接選購商品即可。

      </div>





    </div>



  `;



  document.getElementById('checkoutContent').innerHTML = html;
  if (typeof checkAndApplyGroceryDisabledUI === 'function') {
      checkAndApplyGroceryDisabledUI(currentStoreName);
  }



  // 隱藏原本的 storeView 避免畫面重疊

  if (document.getElementById('storeView')) {

      document.getElementById('storeView').style.display = 'none';

  }

  if (document.getElementById('cartView')) {

      document.getElementById('cartView').style.display = 'none';

  }



  document.getElementById('checkoutView').style.display = 'block';
      if (document.getElementById('floatingCartBtn')) document.getElementById('floatingCartBtn').style.display = 'none';
      updatePlanButtons();



  if (!originalAppHeaderHtml) originalAppHeaderHtml = document.querySelector('.app-header').innerHTML;

  document.querySelector('.app-header').innerHTML = `

    <button onclick="backToStoreFromGroceryCheckout()" style="background:transparent; border:none; font-size:24px; font-weight:bold; cursor:pointer; padding:0; display:flex; align-items:center; gap:10px; color:#111;">← <span style="font-size:20px;">雜貨代購確認</span></button>

  `;

  document.querySelector('.app-header').style.display = 'flex';

  window.scrollTo(0, 0);

}



function backToStoreFromGroceryCheckout() {

    document.getElementById('checkoutView').style.display = 'none';
    const submitBtn = document.getElementById('checkoutSubmitBtn');
    if (submitBtn) {
        submitBtn.innerText = '送出訂單';
        submitBtn.style.background = '#f43f5e';
        submitBtn.style.cursor = 'pointer';
        submitBtn.onclick = submitSelectedPlan;
    }

    

    // 恢復 storeView 顯示

    if (document.getElementById('storeView')) {

        document.getElementById('storeView').style.display = 'block';

    }

    

    if (originalAppHeaderHtml) {

        document.querySelector('.app-header').innerHTML = originalAppHeaderHtml;

    }

}




function copyAndRetrySendOrder(btn, orderText) {
    // 1. 複製訂單內容到剪貼簿
    if (typeof copyToClipboardFallback === 'function') {
        copyToClipboardFallback(orderText, btn);
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(orderText);
    }
    btn.innerText = '✅ 已複製！請貼回 LINE 聊天室';
    btn.style.background = '#10b981';
    btn.style.color = '#fff';

    // 清空購物車與標記訂單完成狀態
    clearCart();
    window._orderSent = true;

    // 2. 順便背景自動嘗試再送一次 (靜默執行，但不跳出任何錯誤)
    if (typeof liff !== 'undefined' && liff.isInClient && liff.isInClient()) {
        try {
            liff.sendMessages([{ type: "text", text: orderText }]).then(() => {
                btn.innerText = '🎉 已自動傳送至聊天室！';
            }).catch(e => {
                // 靜默捕捉，不跳任何錯誤
                console.log('Silent retry sendMessages error:', e);
            });
        } catch (e) {
            console.log('Silent retry error:', e);
        }
    }
}

function formatOrderStatusUrl(url) {
    if (!url) return '';
    // 去除 group- 與 /join
    // 例: https://www.ubereats.com/tw/group-orders/29dc81b5-cf1c-433f-8c59-69daa1af8866/join
    // 轉為: https://www.ubereats.com/tw/orders/29dc81b5-cf1c-433f-8c59-69daa1af8866
    return url.replace(/\/group-orders\//g, '/orders/').replace(/\/join(?:\/|\?.*)?$/g, '');
}

function showPermissionFailModal(msgText, originalErrorMsg = '') {
    if (window.currentGroupBuyId && typeof markGroupBuySubmitted === 'function') {
        markGroupBuySubmitted(msgText);
    }
    clearCart();
    window._orderSent = true;
    const safeOrderText = encodeURIComponent(msgText).replace(/'/g, "%27");
    let fastCartBtnHtml = '';
    if (window.lastSubOrders && window.lastSubOrders.length > 0) {
        window.lastSubOrders.forEach((sub, sIdx) => {
            const bNum = sub.binIndex || (sIdx + 1);
            const rawUrl = sub.join_url || (sub.order_uuid ? `https://www.ubereats.com/tw/orders/${sub.order_uuid}` : '');
            const statusUrl = formatOrderStatusUrl(rawUrl);
            if (statusUrl) {
                const btnLabel = (bNum === 1) ? '立即查詢訂單狀態1' : `查詢訂單狀態${bNum}`;
                fastCartBtnHtml += `<button onclick="window.open('${statusUrl}', '_blank')" style="width:100%; padding:14px; background:#059669; color:#fff; border:none; border-radius:12px; font-weight:bold; font-size:16px; cursor:pointer; margin-bottom:10px; box-shadow:0 4px 12px rgba(5,150,105,0.25);">🔍 ${btnLabel}</button>`;
            }
        });
    } else if (window.lastFastGroupOrderUrl) {
        const statusUrl = formatOrderStatusUrl(window.lastFastGroupOrderUrl);
        if (statusUrl) {
            fastCartBtnHtml = `<button onclick="window.open('${statusUrl}', '_blank')" style="width:100%; padding:14px; background:#059669; color:#fff; border:none; border-radius:12px; font-weight:bold; font-size:16px; cursor:pointer; margin-bottom:12px; box-shadow:0 4px 12px rgba(5,150,105,0.3);">🔍 立即查詢訂單狀態</button>`;
        }
    }

    const tipHtml = `
      <div style="text-align:left; font-size:14px; color:#475569; line-height:1.6; margin-bottom:15px; background:#f8fafc; padding:14px; border-radius:12px; border:1px solid #e2e8f0;">
        <div style="font-weight:bold; color:#e11d48; font-size:15px; margin-bottom:6px;">⚠️ LINE 尚未取得傳送訊息權限</div>
        <div>因系統需要您同意<b>「傳送訊息至聊天室」</b>的權限，才能自動為您發送訂單。</div>
        <div style="margin-top:10px; font-size:13px; color:#64748b; border-top:1px dashed #cbd5e1; padding-top:8px;">
          💡 <b>貼心提醒：</b><br>
          您可直接點擊上方<b>「查詢訂單狀態」</b>，或點擊下方<b>「一鍵複製訂單」</b>貼回聊天室完成訂餐。<br>
          下次下單請保留權限（請勿手動關閉），即可享受全自動送單的便利！
        </div>
      </div>
      ${fastCartBtnHtml}
      <button onclick="copyAndRetrySendOrder(this, decodeURIComponent('${safeOrderText}'))" style="width:100%; padding:14px; background:#f43f5e; color:#fff; border:none; border-radius:12px; font-weight:bold; font-size:16px; cursor:pointer; box-shadow:0 3px 10px rgba(244,63,94,0.3); margin-bottom:10px;">📋 一鍵複製訂單訊息 (貼回聊天室)</button>
      <button onclick="if(typeof liff !== 'undefined' && liff.isInClient && liff.isInClient()) { liff.closeWindow(); } else { document.getElementById('errorModalOverlay').style.display='none'; }" style="width:100%; padding:11px; background:#f1f5f9; color:#475569; border:none; border-radius:10px; font-size:14px; font-weight:bold; cursor:pointer;">關閉視窗回到聊天室</button>
    `;

    showModal('授權不足 (無法自動傳送)', '', true, tipHtml, true);
    if (document.getElementById('fullScreenLoader')) document.getElementById('fullScreenLoader').style.display = 'none';
}

async function sendOrderToLine(forceSubmit = false) {
  if (!isClosedStatusBypassed() && window.lastServerStoreStatus && (window.lastServerStoreStatus.type === 'closed' || (window.lastServerStoreStatus.status && window.lastServerStoreStatus.status.toLowerCase() === 'closed'))) {
    hideOrderWaitingOverlay();
    hideGroceryWaitingOverlay();
    showModal('目前暫時無法接單', '', false, '', true);
    return;
  }

  if (window.isGroupBuyClosed) {
    hideOrderWaitingOverlay();
    hideGroceryWaitingOverlay();
    showToast('⚠️ 本團購訂單已送出結帳，團購已截止！');
    return;
  }

  if (window.isSubmittingOrder || window._orderSent) return;
  window.isSubmittingOrder = true;

  // 確保送出時必定開啟等待視窗
  const sName = (typeof currentStoreName !== 'undefined' && currentStoreName) ? currentStoreName : (document.getElementById('currentStoreName') ? document.getElementById('currentStoreName').innerText : '');
  const submitBtn = document.getElementById('checkoutSubmitBtn');
  if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = '處理中...';
      submitBtn.style.opacity = '0.7';
  }
  if (window.isGroceryStore) {
      showGroceryWaitingOverlay(sName || '生鮮雜貨門市');
  } else {
      showOrderWaitingOverlay(sName || '線上餐點門市');
  }

  try {
      await _sendOrderToLine(forceSubmit);
  } finally {
      window.isSubmittingOrder = false;
      if (submitBtn && !window._orderSent) {
          submitBtn.disabled = false;
          submitBtn.innerText = '送出訂單';
          submitBtn.style.opacity = '1';
      }
  }
}

async function _sendOrderToLine(forceSubmit = false) {
      let costRes = (typeof calcOrderCost === 'function' && typeof cart !== 'undefined' && Array.isArray(cart) && cart.length > 0)
          ? calcOrderCost(cart, window.currentSelectedPlan)
          : (window._lastCostRes || null);
      if (costRes) {
          window._lastCostRes = costRes;
      }

      const schedCheck = typeof validateStoreSchedule === 'function' ? validateStoreSchedule() : { valid: true };
      if (!schedCheck.valid) {
          hideOrderWaitingOverlay(); hideGroceryWaitingOverlay();

          if (schedCheck.reason === 'NOT_SCHEDULABLE' || schedCheck.reason === 'NOT_SCHEDULABLE_UNVERIFIED') {
              if (typeof showHardBlockModal === 'function') {
                  showHardBlockModal('無法為您代購', schedCheck.text || '此餐廳無法預約或代訂，請選擇其他餐廳');
              } else {
                  showModal('無法為您代購', schedCheck.text || '此餐廳無法代訂，請選擇其他餐廳', true);
              }
              return;
          }

          window.currentStoreClosed = true;
          window.mustSelectScheduleBeforeCheckout = true;
          if (typeof showStoreScheduleModal === 'function') {
              showStoreScheduleModal({ invalidScheduleText: (scheduleMode === 'SCHEDULE' ? schedCheck.text : ''), isCheckout: true });
          } else if (typeof showScheduleSelectModalForClosedStore === 'function') {
              showScheduleSelectModalForClosedStore();
          }
          return;
      }

            // 判斷此訂單店家是否支援外帶自取 (Pickup)
      const isPickupExcludedOrder = typeof isStorePickupExcluded === 'function' && (
          (cart.length > 0 && cart.some(it => isStorePickupExcluded(it.storeName))) ||
          (window.currentStoreRawData && isStorePickupExcluded(window.currentStoreRawData)) ||
          (window.currentStoreRawData && isStorePickupExcluded(window.currentStoreRawData.title)) ||
          (typeof currentStoreName !== 'undefined' && isStorePickupExcluded(currentStoreName))
      );
      // 判斷此訂單店家是否支援外帶自取 (Pickup)
      const isStoreCanPickup = !isPickupExcludedOrder && Boolean(
          (cart.length > 0) ? cart.every(it => it.storeCanPickup) : (window.currentStoreCanPickup || isStorePickupAvailable(window.currentStoreRawData))
      );

      const pickupTag = isStoreCanPickup ? '🏷️' : '';
      const priceKeyText = (window.lastMatchedPrice && window.lastMatchedPrice > 0) 
          ? `🗝️${window.lastMatchedPrice}${pickupTag}` 
          : (isStoreCanPickup ? '🏷️' : '');

  let msgText = '';
  let addr = '';
  let timeText = '盡快送達';
  let isGrocerySub = Boolean(window.isGroceryStore || (typeof currentStoreName !== 'undefined' && currentStoreName && (currentStoreName.includes('優市') || currentStoreName.includes('全聯') || currentStoreName.includes('家樂福') || currentStoreName.includes('大潤發') || currentStoreName.includes('愛買') || currentStoreName.includes('美廉社'))));
  let is150Sub = Boolean(typeof currentStoreName !== 'undefined' && currentStoreName && currentStoreName.includes('優市'));
  let deliveryAddrSub = '';
  let isDSub = false;
  if (!isGrocerySub && window.currentSelectedPlan === '300' && typeof loadServerStatusDot === 'function') {
      try { await loadServerStatusDot(); } catch (e) {}
  }
  let canUsePlan300 = (!isGrocerySub && typeof isPlan300Eligible === 'function' && isPlan300Eligible());
  if (!isGrocerySub && window.currentSelectedPlan === '300' && !canUsePlan300) {
      window.currentSelectedPlan = '150';
      hideOrderWaitingOverlay(); hideGroceryWaitingOverlay();
      const submitBtn = document.getElementById('checkoutSubmitBtn');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = '送出訂單'; submitBtn.style.opacity = '1'; }
      const reqHours = (typeof getPlan300MinHours === 'function') ? getPlan300MinHours() : 10;
      const reasonDesc = (reqHours >= 10)
          ? '目前伺服器為「休息中（可接預約單）」狀態，300 方案需預訂至少 10 小時以後的時段，系統已自動為您切換至「⚡ 150 內半價」方案，請確認明細後重新送出。'
          : '目前預約時段未滿 300 方案所需之 3 小時提前限制，系統已自動為您切換至「⚡ 150 內半價」方案，請確認明細後重新送出。';
      showModal('⚠️ 300 方案資格不符', reasonDesc, false, `
          <button onclick="document.getElementById('errorModalOverlay').style.display='none'; openCheckoutSummary();" style="width:100%; padding:12px; background:#f43f5e; color:#fff; border:none; border-radius:8px; font-weight:bold; font-size:15px; cursor:pointer;">查看 150 方案明細並送出</button>
      `, true);
      return;
  }
  let currentPlanType = (canUsePlan300 && window.currentSelectedPlan === '300') ? '300' : '150';

      if (forceSubmit === 'planA' ) {
          window.selectedPlan = forceSubmit;
      }
      const currentPlan = window.selectedPlan || 'planA';

  const prefix = window.isGroceryStore ? 'grocery' : 'checkout';

  const phoneInput = document.getElementById(prefix + 'Phone');
  if (phoneInput) {
      const phoneVal = phoneInput.value.trim();
      if (!phoneVal) {
          hideOrderWaitingOverlay(); hideGroceryWaitingOverlay();

          phoneInput.style.border = '2px solid #d32f2f';
          phoneInput.focus();
          setTimeout(() => { phoneInput.style.border = '1px solid #ccc'; }, 2000);
          showModal('請輸入手機號碼', '請留下電話，以方便外送員抵達時與您聯絡！');
          return;
      }
      localStorage.setItem('userPhone', phoneVal);
  }



  const deliveryNotesEl = document.getElementById(prefix + 'DeliveryNotes');

  const deliveryMethodEl = document.getElementById(prefix + 'DeliveryMethod');

  const deliveryNotesVal = deliveryNotesEl ? deliveryNotesEl.value.trim() : '';

  const selectedMethodVal = deliveryMethodEl ? deliveryMethodEl.value : '當面點交';



  if (!window._ignoreMethodCheck) {

    const hasDoorKeywords = /放|外送桌|桌上/.test(deliveryNotesVal);

    if (hasDoorKeywords && selectedMethodVal === '當面點交') {
       hideOrderWaitingOverlay(); hideGroceryWaitingOverlay();


       const safeNotes = deliveryNotesVal.replace(/</g, "&lt;").replace(/>/g, "&gt;");

       const interceptHtml = `

         <div style="margin-top:5px; color:#555; font-size:15px; line-height:1.6; text-align:center;">

            請問你是要指定外送員 <span style="color:#d32f2f; font-weight:bold;">${safeNotes}</span> 嗎？<br><br>

            但是你分類是選擇「當面點交」，兩個內容可能不合理。<br><br>

            請問是否切換成 <strong>放在門口</strong>？

         </div>

         <div style="display:flex; gap:10px; margin-top:20px;">

           <button onclick="document.getElementById('${prefix}DeliveryMethod').value='放在門口'; if(typeof setDeliveryMethod==='function') setDeliveryMethod('放在門口', true); document.getElementById('errorModalOverlay').style.display='none'; window._ignoreMethodCheck=true; sendOrderToLine('${forceSubmit === 'split' ? 'split' : (forceSubmit ? forceSubmit : '')}');" style="flex:1; padding:12px; background:#f43f5e; color:#fff; border:none; border-radius:8px; font-weight:bold; font-size:15px;">是(放在門口)</button>

           <button onclick="document.getElementById('errorModalOverlay').style.display='none'; window._ignoreMethodCheck=true; sendOrderToLine('${forceSubmit === 'split' ? 'split' : (forceSubmit ? forceSubmit : '')}');" style="flex:1; padding:12px; background:#888; color:#fff; border:none; border-radius:8px; font-weight:bold; font-size:15px;">否(就是當面點交沒錯)</button>

         </div>

       `;

       showModal('⚠️ 備註與外送方式可能衝突', '', true, interceptHtml, true);

       return;

    }

  }

  window._ignoreMethodCheck = false;



  if (window.isGroceryStore) {





      let addrEl = document.getElementById(prefix + 'AddrInput');

      addr = addrEl ? addrEl.value.trim() : (document.getElementById('addrInput') ? document.getElementById('addrInput').value.trim() : '');
      addr = normalizeAddress(addr);

      if (addr.startsWith('📍 ')) addr = addr.substring(3).trim();



            timeText = '盡快送達';
      let isAdvanceBooking = false; // 179分鐘以上: 專人代訂費 45 元
      let isThreeHourSlot = false;  // 三小時時段: 優惠時段折扣 -$25

      if (typeof scheduleMode !== 'undefined' && scheduleMode !== 'ASAP') {

        const timeSelect = document.getElementById('scheduleTime');

        if (timeSelect && timeSelect.options[timeSelect.selectedIndex]) {

          timeText = document.getElementById('triggerTimeText') ? document.getElementById('triggerTimeText').innerText : timeSelect.options[timeSelect.selectedIndex].text;

          const ts = typeof getSelectedScheduleTimestamp === 'function' ? getSelectedScheduleTimestamp() : 0;
          if (ts && (ts - Date.now() >= 179 * 60 * 1000)) {
            isAdvanceBooking = true;
          }

          const tsVal = timeSelect.value;

          if (tsVal) {
              try {
                  const parsed = JSON.parse(tsVal);
                  if ((parsed.endTime - parsed.startTime === 180) || parsed.discount === 25) {
                      isThreeHourSlot = true;
                  }
              } catch(e) {}
          }

        }

      }



      msgText = `【生鮮雜貨代購訂單】\n`;

      msgText += `📍 店家：${currentStoreName}\n`;

      const displayUrl = currentStoreUrl.replace(/^https?:\/\/www\.ubereats\.com\//, '');
      msgText += `🔗 網址：${displayUrl}\n`;

      msgText += `🏠 外送地址：${addr}\n`;

      msgText += `⏱ 預計取餐：${timeText}\n`;

      const is150 = (currentStoreName && currentStoreName.includes('優市'));
      if (is150) {

          msgText += `💼 專人代訂費: $50\n`;

      } else if (isAdvanceBooking) {

          msgText += `💼 專人代訂費: $45 (179分鐘以上預約優惠)\n`;

      } else {

          msgText += `💼 專人代訂費: $60\n`;

      }

      if (isThreeHourSlot) {

          msgText += `⏰ 優惠時段折扣: -$25\n`;

      }

      msgText += `\n⚠️ 此為生鮮雜貨代購，代訂會提供網址，等代訂提供網址再選購商品即可。\n`;



  } else {

      if (cart.length === 0) return;



      let foodTotal = 0;

      cart.forEach(it => foodTotal += it.price * it.qty);

      let isASAPCheckout = (typeof scheduleMode === 'undefined' || scheduleMode === 'ASAP');
      if (!isASAPCheckout && typeof getSelectedScheduleTimestamp === 'function') {
          if (getSelectedScheduleTimestamp() - Date.now() < 2.99 * 3600000) {
              isASAPCheckout = true; // 3小時內的預約單視同即時單標準
          }
      }
      // 🌟 連續點擊圖片輸入密碼 5318 解鎖之使用者，不限制金額（0元），一般使用者滿 99
      let minOrderLimit = (typeof isClosedStatusBypassed === 'function' && isClosedStatusBypassed()) ? 0 : 99;

      if (minOrderLimit > 0 && foodTotal < minOrderLimit) {
        hideOrderWaitingOverlay(); hideGroceryWaitingOverlay();


        showModal('金額過低', `訂單小計低於$${minOrderLimit}，建議再加個東西吧！`);

        return;

      }







      if (typeof calcOrderCost === 'function' && typeof cart !== 'undefined' && Array.isArray(cart) && cart.length > 0) {
        costRes = calcOrderCost(cart);
        window._lastCostRes = costRes;
      }



      if (!forceSubmit || forceSubmit === 'overrideMethod') {

        if (costRes && costRes.shouldSplit && costRes.savings > 0) {
          hideOrderWaitingOverlay(); hideGroceryWaitingOverlay();


          const suggestHtml = buildSplitSuggestionHtml(costRes);

          const interceptHtml = suggestHtml + `

            <div style="display:flex; gap:10px; margin-top:20px;">

              <button onclick="document.getElementById('errorModalOverlay').style.display='none'; sendOrderToLine('split');" style="flex:1; padding:12px; background:#f43f5e; color:#fff; border:none; border-radius:8px; font-weight:bold; font-size:16px;">同意送出</button>

            </div>

          `;

          showModal('💡 偵測到可享有多單優惠', '按照以下建議分成多單，可得到最優惠價格!', false, interceptHtml, true);

          return;

        }

      }



      let addrEl = document.getElementById(prefix + 'AddrInput');

      addr = addrEl ? addrEl.value.trim() : (document.getElementById('addrInput') ? document.getElementById('addrInput').value.trim() : '');
      if (!addr && window.currentGroupBuyId && window.groupBuyData?.address) {
          addr = window.groupBuyData.address;
      }
      addr = normalizeAddress(addr);

      let coordsText = '';

      if (addr) {

          if (typeof currentAddrTitle !== 'undefined' && addr === currentAddrTitle && typeof currentLat !== 'undefined' && currentLat !== null && typeof currentLng !== 'undefined' && currentLng !== null) {

              coordsText = ` (${currentLat}, ${currentLng})`;

          } else if (window.currentGroupBuyId && window.groupBuyData?.lat && window.groupBuyData?.lng) {

              coordsText = ` (${window.groupBuyData.lat}, ${window.groupBuyData.lng})`;

          } else if (typeof addressHistory !== 'undefined') {

              const matchedHistory = addressHistory.find(item => {

                  let disp = item.title.split(',')[0];

                  if (disp.startsWith('台灣 ')) disp = disp.substring(3).trim();

                  return disp === addr || item.title === addr;

              });

              if (matchedHistory) {

                  coordsText = ` (${matchedHistory.lat}, ${matchedHistory.lng})`;

              }

          }

      }

      timeText = '盡快送達';

      let isPreOrder = false;



      if (typeof scheduleMode !== 'undefined' && scheduleMode !== 'ASAP') {

        const timeSelect = document.getElementById('scheduleTime');

        if (timeSelect && timeSelect.options[timeSelect.selectedIndex]) {

          timeText = document.getElementById('triggerTimeText') ? document.getElementById('triggerTimeText').innerText : timeSelect.options[timeSelect.selectedIndex].text;

          const tsVal = timeSelect.value;

          if (tsVal && (getSelectedScheduleTimestamp() - new Date().getTime() >= 2.99 * 3600000)) {

            isPreOrder = true;

          }

        }

      }



      isGrocerySub = Boolean(window.isGroceryStore || (currentStoreName && (currentStoreName.includes('優市') || currentStoreName.includes('全聯') || currentStoreName.includes('家樂福') || currentStoreName.includes('大潤發') || currentStoreName.includes('愛買') || currentStoreName.includes('美廉社'))));
      is150Sub = Boolean(currentStoreName && currentStoreName.includes('優市'));
      deliveryAddrSub = (typeof addr !== 'undefined' && addr) ? addr : (document.getElementById(prefix + 'AddrInput')?.value || document.getElementById('addrInput')?.value || '');
      isDSub = !isGrocerySub && (typeof isAddressEligibleForCouponD === 'function') && isAddressEligibleForCouponD(deliveryAddrSub);
      canUsePlan300 = (!isGrocerySub && typeof isPlan300Eligible === 'function' && isPlan300Eligible());
      currentPlanType = (canUsePlan300 && window.currentSelectedPlan === '300') ? '300' : '150';

      if (forceSubmit === 'split' && costRes && costRes.bins) {

        const isPlan300Sub = (currentPlanType === '300');
        const planTag = isPlan300Sub ? '[300]' : '';
        const promoCapSub = isPlan300Sub ? 300 : 150;
        const maxPromoSub = isPlan300Sub ? 150 : 75;
        const planCapText = isPlan300Sub ? '$300內半價' : '$150內半價';
        msgText = `🛵 UberEats 揪團訂單${planTag}${priceKeyText} \n${planCapText}\n`;

        if (addr) msgText += `📍 地址: ${addr}${coordsText}\n`;

        msgText += `🕒 時間: ${timeText}\n\n`;



        let grandTotal = 0;

        let isASAP = (typeof scheduleMode === 'undefined' || scheduleMode === 'ASAP');
    if (!isASAP && typeof getSelectedScheduleTimestamp === 'function') {
        if (getSelectedScheduleTimestamp() - Date.now() < 2.99 * 3600000) {
            isASAP = true; // 3小時內的預約單視同即時單標準
        }
    }
      let feePerBin = (window.currentSelectedPlan === '300') ? 50 : 20;

      let preOrderDiscount = typeof getPreOrderDiscount === 'function' ? getPreOrderDiscount() : 0;



        
        const isPickup = (cart.length > 0) ? cart.every(it => it.storeCanPickup) : isStoreCanPickup;
costRes.bins.forEach((bin, bIdx) => {

          msgText += `📦 【多單 ${bIdx + 1}】\n`;

          let binFoodSum = 0;



          const binStores = {};

          bin.items.forEach(it => {
            const sn = it.storeName || (typeof currentStoreName !== 'undefined' ? currentStoreName : '未命名餐廳');
            if (!binStores[sn]) binStores[sn] = {};

            const key = it.name + '|||' + (it.note || '');

            if (!binStores[sn][key]) {
              let fallbackUrl = it.storeUrl || (typeof currentStoreUrl !== 'undefined' ? currentStoreUrl : '') || (window.groupBuyData?.store_url || '');
              binStores[sn][key] = { 
                title: it.name, 
                note: it.note, 
                price: it.price, 
                qty: 0, 
                storeName: sn, 
                storeUrl: fallbackUrl, 
                storeDeliveryFee: (it.storeCanPickup ? 0 : (it.storeDeliveryFee || 0)),
                storeCanPickup: it.storeCanPickup || false 
              };

            }

            binStores[sn][key].qty += 1;

          });



          Object.keys(binStores).forEach(sName => {

            msgText += `🏪 ${sName}\n`;

            let u = Object.values(binStores[sName])[0].storeUrl;
            if (!u && window.groupBuyData?.store_url) u = window.groupBuyData.store_url;
            if (!u && typeof currentStoreUrl !== 'undefined') u = currentStoreUrl;

            if (u) {

                if (typeof normalizeUberStoreUrl === 'function') u = normalizeUberStoreUrl(u);

                try { u = decodeURI(u); } catch(e) {}

                msgText += `🔗 網址: ${u}\n`;

            }

            let i = 1;

            Object.values(binStores[sName]).forEach(it => {

              const lineTotal = it.price * it.qty;

              binFoodSum += lineTotal;

              msgText += `  ${i++}. ${it.title} x ${it.qty} = $${lineTotal}\n`;

              if (it.note) {

                msgText += `     - 說明: ${it.note.replace(/\n/g, ' ')}\n`;

              }

            });

          });



          const pCap = (window.currentSelectedPlan === '300') ? 300 : 150;
          const pMax = (window.currentSelectedPlan === '300') ? 150 : 75;
          let binPromo = binFoodSum >= pCap ? pMax : Math.floor(binFoodSum / 2);



          let binExcess = 0;
          if (!isPickup) {
            Object.keys(binStores).forEach(sName => {
              binExcess += Math.max(0, ...Object.values(binStores[sName]).map(item => (item.storeCanPickup ? 0 : (item.storeDeliveryFee || 0))));
            });
          }

          let binTotal = (binFoodSum - binPromo) + feePerBin + binExcess - preOrderDiscount;
          grandTotal += binTotal;

          msgText += `  小計: $${binFoodSum}\n`;
          if (binPromo > 0) msgText += `  🎉 半價優惠: -$${binPromo}\n`;
          msgText += `  🛵 代訂費: $${feePerBin}\n`;
          msgText += `  🛵 外送加成: $${binExcess}\n`;
          if (preOrderDiscount > 0) msgText += `  🕒 預訂折扣: -$${preOrderDiscount}\n`;
          msgText += `  ➡️ 結算: $${binTotal}\n\n`;
        });

        if (preOrderDiscount > 0) msgText += `🕒 預訂總折扣: -$${preOrderDiscount * costRes.bins.length} (每單已折${preOrderDiscount}元)\n`;
        msgText += `💰 總結算金額: $${grandTotal}`;



      } else {

        let total = 0;

        const storeGroups = {};

        cart.forEach(item => {

          const sName = item.storeName || '未命名餐廳';

          if (!storeGroups[sName]) storeGroups[sName] = [];

          storeGroups[sName].push(item);

          total += item.price * item.qty;

        });



      const isPlan300SubSingle = (window.currentSelectedPlan === '300');
      const planTagSingle = isPlan300SubSingle ? '[300]' : '';
      msgText = `🛵 UberEats 揪團訂單${planTagSingle}${priceKeyText}\n`;

        if (addr) msgText += `📍 地址: ${addr}${coordsText}\n`;

        msgText += `🕒 時間: ${timeText}\n\n`;



        let storeCount = 0;

        let totalExcessDeliveryFee = 0;

        for (const [sName, items] of Object.entries(storeGroups)) {

          storeCount++;

          msgText += `🏪 ${sName}\n`;

          let u = items[0].storeUrl;
          if (!u && window.groupBuyData?.store_url) u = window.groupBuyData.store_url;
          if (!u && typeof currentStoreUrl !== 'undefined') u = currentStoreUrl;

          if (u) {

              if (typeof normalizeUberStoreUrl === 'function') u = normalizeUberStoreUrl(u);

              try { u = decodeURI(u); } catch(e) {}

              msgText += `🔗 網址: ${u}\n`;

          }

          

          let maxDeliveryFeeForStore = 0;
          items.forEach(it => {
              if (!it.storeCanPickup && it.storeDeliveryFee && it.storeDeliveryFee > maxDeliveryFeeForStore) {
                  maxDeliveryFeeForStore = it.storeDeliveryFee;
              }
          });

          totalExcessDeliveryFee += maxDeliveryFeeForStore;

          

          let i = 1;

          items.forEach(it => {

            const lineTotal = it.price * it.qty;

            msgText += `  ${i++}. ${it.title} x ${it.qty} = $${lineTotal}\n`;

            if (it.note) {

              msgText += `     - 說明: ${it.note.replace(/\n/g, ' ')}\n`;

            }

          });

          msgText += `\n`;

        }



        const isPlan300Single = (window.currentSelectedPlan === '300');
        const pCapSingle = isPlan300Single ? 300 : 150;
        const pMaxSingle = isPlan300Single ? 150 : 75;
        let promoDiscount = total >= pCapSingle ? pMaxSingle : Math.floor(total / 2);
        let serviceFee = isPlan300Single ? 50 : 20;



        let preOrderDiscount = typeof getPreOrderDiscount === 'function' ? getPreOrderDiscount() : 0;

        
        const isPickup = (cart.length > 0) ? cart.every(it => it.storeCanPickup) : isStoreCanPickup;
        if (isPickup) {
            totalExcessDeliveryFee = 0;
        }
        let grandTotal = total - promoDiscount + serviceFee + totalExcessDeliveryFee - preOrderDiscount;

      if (false) {
          msgText += `🏷️ [B方案] ($200-$200)\n`;
          msgText += `💵 小計: $${total}\n`;
          msgText += `🎉 優惠折抵: -$200\n`;
          msgText += `🏍️ 代訂費: $130\n`;
          msgText += `🛵 外送加成: $${totalExcessDeliveryFee}\n`;
          msgText += `🧑‍💼 服務費: $18~$60\n`;
          let minTotal = total - 200 + 130 + totalExcessDeliveryFee + 18;
          let maxTotal = total - 200 + 130 + totalExcessDeliveryFee + 60;
          msgText += `\n💰 總計: $${minTotal} ~ $${maxTotal}\n`;
      } else {
          if (currentPlanType === '300') {
              msgText += `🏷️ ($300內半價)\n`;
          } else {
              msgText += `🏷️ ($150內半價)\n`;
          }
          msgText += `💵 小計: $${total}\n`;
          if (promoDiscount > 0) msgText += `🎉 優惠半價折抵: -$${promoDiscount}\n`;
          msgText += `🏍️ 代訂費: $${serviceFee}\n`;
          msgText += `🛵 外送加成: $${totalExcessDeliveryFee}\n`;
          msgText += `🧑‍💼 服務費: $0\n`;
          if (preOrderDiscount > 0) msgText += `📅 預訂折扣: -$${preOrderDiscount}\n`;
          msgText += `\n💰 總計: $${grandTotal}`;
      }
      }
  } // END OF isGroceryStore else block



  const foodNotes = document.getElementById('checkoutFoodNotes') ? document.getElementById('checkoutFoodNotes').value.trim() : '';

  if (foodNotes) {

    msgText += `\n\n🍽️ 餐點訂單備註: ${foodNotes}`;

  }



  const phoneVal = document.getElementById(prefix + 'Phone') ? document.getElementById(prefix + 'Phone').value.trim() : '';



  let finalNote = deliveryNotesVal;

  if (phoneVal && !finalNote.includes(phoneVal)) {

    const hasLocationNote = /放|外送桌|桌上/.test(finalNote) || selectedMethodVal === '放在門口';

    const phoneNote = hasLocationNote ? '有問題請打電話' + phoneVal : '沒遇到人請打電話' + phoneVal;

    finalNote = finalNote ? (finalNote + '。' + phoneNote) : phoneNote;

  }



  finalNote = `[${selectedMethodVal}]` + (finalNote ? ' ' + finalNote : '');

  msgText += `\n\n📝 外送備註: ${finalNote}`;

  let cleanPhone = phoneVal.replace(/[\s\-]/g, '');
  if (cleanPhone.startsWith('+886')) cleanPhone = '0' + cleanPhone.slice(4);

  let isSuspiciousPhone = false;
  if (!cleanPhone || /[^\d]/.test(cleanPhone)) {
      isSuspiciousPhone = true;
  } else if (cleanPhone.startsWith('094') || cleanPhone.startsWith('099')) {
      isSuspiciousPhone = true;
  } else if (cleanPhone.startsWith('09') && cleanPhone.length < 10) {
      isSuspiciousPhone = true;
  } else if (cleanPhone.startsWith('0')) {
      if (cleanPhone.length <= 8 || cleanPhone.length >= 11) {
          isSuspiciousPhone = true;
      }
  } else {
      if (cleanPhone.length <= 5 || cleanPhone.length >= 9) {
          isSuspiciousPhone = true;
      }
  }

  if (isSuspiciousPhone) {
      msgText = `⚠️ 警告疑似資料亂填\n` + msgText;
  }





  if (typeof liffInitPromise !== 'undefined' && liffInitPromise) await liffInitPromise;

  const currentUserId = (typeof getLiffUserId === 'function') ? (await getLiffUserId()) : '';
  let submittedOrderId = '';

  // 整理結構化商品清單 (包含 MenuItemUUID, SectionUUID, 客製化選項, 數量, 備註等)
  const fallbackSec = (typeof cart !== 'undefined' && Array.isArray(cart)) ? (cart.find(x => x.sectionUuid)?.sectionUuid || '') : '';
  const fallbackSubsec = (typeof cart !== 'undefined' && Array.isArray(cart)) ? (cart.find(x => x.subsectionUuid)?.subsectionUuid || '') : '';
  const structuredItems = (typeof cart !== 'undefined' && Array.isArray(cart)) ? cart.map(it => {
      const baseNote = (it.note || '').trim();
      const combinedNote = foodNotes ? (baseNote ? `${baseNote} | 備註: ${foodNotes}` : `備註: ${foodNotes}`) : baseNote;
      const itemUuidVal = it.menuItemUuid || it.uuid || it.item_uuid || it.itemUuid || '';
      return {
          uuid: itemUuidVal,
          menuItemUuid: itemUuidVal,
          item_uuid: itemUuidVal,
          itemUuid: itemUuidVal,
          sectionUuid: it.sectionUuid || fallbackSec || '',
          subsectionUuid: it.subsectionUuid || fallbackSubsec || '',
          price: it.price || 0,
          title: it.title || it.name || '',
          quantity: it.qty || it.quantity || 1,
          qty: it.qty || it.quantity || 1,
          rawCustomizations: it.rawCustomizations || it.customizations || {},
          customizations: it.rawCustomizations || it.customizations || {},
          note: combinedNote,
          specialInstructions: combinedNote,
          storeUuid: it.storeUuid || (typeof currentStoreUuid !== 'undefined' ? currentStoreUuid : '') || '',
          storeName: it.storeName || (typeof currentStoreName !== 'undefined' ? currentStoreName : '') || '',
          imgUrl: it.imgUrl || ''
      };
  }) : [];

  let mainStoreUuid = (typeof currentStoreUuid !== 'undefined' && currentStoreUuid) ? currentStoreUuid : '';
  if (!mainStoreUuid && structuredItems.length > 0 && structuredItems[0].storeUuid) {
      mainStoreUuid = structuredItems[0].storeUuid;
  }
  if (!mainStoreUuid && window.currentStoreRawData && window.currentStoreRawData.storeUuid) {
      mainStoreUuid = window.currentStoreRawData.storeUuid;
  }

  // 多單拆單支援 (Split Bins)
  let splitBins = null;
  if (!costRes && typeof calcOrderCost === 'function' && typeof cart !== 'undefined' && Array.isArray(cart) && cart.length > 0) {
      costRes = calcOrderCost(cart);
      window._lastCostRes = costRes;
  }
  const splitBinsData = (costRes && costRes.bins) ? costRes.bins : (window._splitBinsA || null);
  if (forceSubmit === 'split' && splitBinsData) {
      splitBins = splitBinsData.map((bin, bIdx) => {
          const mergedMap = {};
          (bin.items || []).forEach(it => {
              const u = it.menuItemUuid || it.uuid || '';
              const cust = it.rawCustomizations || it.customizations || {};
              let custKey = '';
              try {
                  const sortedKeys = Object.keys(cust).sort();
                  const sortedObj = {};
                  for (const k of sortedKeys) sortedObj[k] = cust[k];
                  custKey = JSON.stringify(sortedObj);
              } catch(e) {
                  custKey = '';
              }
              const baseNote = (it.note || '').trim();
              const note = foodNotes ? (baseNote ? `${baseNote} | 備註: ${foodNotes}` : `備註: ${foodNotes}`) : baseNote;
              const price = it.price || 0;
              const key = `${u}__${price}__${custKey}__${note}`;
              const itQty = parseInt(it.qty || it.quantity || 1, 10) || 1;

              if (!mergedMap[key]) {
                  mergedMap[key] = {
                      uuid: u,
                      menuItemUuid: u,
                      item_uuid: u,
                      itemUuid: u,
                      sectionUuid: it.sectionUuid || fallbackSec || '',
                      subsectionUuid: it.subsectionUuid || fallbackSubsec || '',
                      price: price,
                      title: it.title || it.name || '',
                      quantity: itQty,
                      qty: itQty,
                      rawCustomizations: cust,
                      customizations: cust,
                      note: note,
                      specialInstructions: note,
                      storeUuid: it.storeUuid || mainStoreUuid,
                      storeName: it.storeName || (typeof currentStoreName !== 'undefined' ? currentStoreName : '') || '',
                      imgUrl: it.imgUrl || ''
                  };
              } else {
                  mergedMap[key].quantity += itQty;
                  mergedMap[key].qty += itQty;
              }
          });

          return {
              binIndex: bIdx + 1,
              sum: bin.sum,
              items: Object.values(mergedMap)
          };
      });
  }

  // 🚀 無論何種環境，一律優先送出訂單資料到後端存檔並啟動 5折 團購注入！
  try {
      // 🛡️ 地址終極防禦：若送單時尚未取得 Uber Eats 座標，即時自動從 Uber 重新取得
      if ((!currentLat || !currentLng) && addr) {
          if (typeof autoRefreshAndVerifyAddressFromUber === 'function') {
              await autoRefreshAndVerifyAddressFromUber(addr, { title: addr });
          }
      }

      const owStep1 = document.getElementById('owStep1');
      if (owStep1) owStep1.innerHTML = '<span>✅</span> 訂單內容已確認';
      const owStep2 = document.getElementById('owStep2');
      if (owStep2) owStep2.innerHTML = '<span>⏳</span> 正在連線伺服器建立訂單...';
      const gwStep1 = document.getElementById('gwStep1');
      if (gwStep1) gwStep1.innerHTML = '<span>✅</span> 訂單內容已確認';
      const gwStep2 = document.getElementById('gwStep2');
      if (gwStep2) gwStep2.innerHTML = '<span>⏳</span> 正在連線伺服器建立訂單...';
      deliveryAddrSub = (typeof addr !== 'undefined' && addr) ? addr : (document.getElementById(prefix + 'AddrInput')?.value || document.getElementById('addrInput')?.value || '');
      isGrocerySub = Boolean(window.isGroceryStore || (currentStoreName && (currentStoreName.includes('優市') || currentStoreName.includes('全聯') || currentStoreName.includes('家樂福') || currentStoreName.includes('大潤發') || currentStoreName.includes('愛買') || currentStoreName.includes('美廉社'))));
      is150Sub = Boolean(currentStoreName && currentStoreName.includes('優市'));
      isDSub = !isGrocerySub && (typeof isAddressEligibleForCouponD === 'function') && isAddressEligibleForCouponD(deliveryAddrSub);
      canUsePlan300 = (!isGrocerySub && typeof isPlan300Eligible === 'function' && isPlan300Eligible());
      if (!isGrocerySub) {
          currentPlanType = (canUsePlan300 && window.currentSelectedPlan === '300') ? '300' : '150';
      }
      let cTypeSub;
      let planTypeSub;
      if (isGrocerySub) {
          cTypeSub = is150Sub ? '150' : '225';
          planTypeSub = is150Sub ? '150' : '225';
      } else if (currentPlanType === '300') {
          cTypeSub = 'B';
          planTypeSub = '300';
      } else if (isDSub) {
          cTypeSub = 'D';
          planTypeSub = 'D';
      } else {
          cTypeSub = 'A';
          planTypeSub = '150';
      }
      const res = await fetch(API_BASE_URL + '/api/store_v3', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
              action: 'submit_order',
              order_text: msgText,
              user_id: currentUserId,
              coupon_type: cTypeSub,
              plan_type: planTypeSub,
              is_grocery: isGrocerySub,
              store_uuid: mainStoreUuid,
              food_notes: foodNotes,
              items: structuredItems,
              bins: splitBins,
              delivery_info: {
                  address: (typeof addr !== 'undefined' && addr) ? addr : '',
                  lat: (typeof currentLat !== 'undefined') ? currentLat : null,
                  lng: (typeof currentLng !== 'undefined') ? currentLng : null,
                  place_id: (typeof window.currentPlaceId === 'string' && window.currentPlaceId) ? window.currentPlaceId : '',
                  phone: (typeof phoneVal !== 'undefined' && phoneVal) ? phoneVal : '',
                  deliveryMethod: (typeof selectedMethodVal !== 'undefined' && selectedMethodVal) ? selectedMethodVal : '當面點交',
                  notes: (typeof finalNote !== 'undefined' && finalNote) ? finalNote : '',
                  timeText: (typeof timeText !== 'undefined' && timeText) ? timeText : '盡快送達',
                  food_notes: foodNotes,
                  plan_type: planTypeSub,
                  coupon_type: cTypeSub,
                  schedule_data: (function() {
                      try {
                          const schedElem = document.getElementById('scheduleTime');
                          return (schedElem && schedElem.value) ? JSON.parse(schedElem.value) : null;
                      } catch(e) { return null; }
                  })(),
                  is_scheduled: (typeof scheduleMode !== 'undefined' && scheduleMode !== 'ASAP'),
                  schedule_mode: (typeof scheduleMode !== 'undefined') ? scheduleMode : 'ASAP'
              }
          })
      });
      if (res.ok) {
          const d = await res.json();
          if (d && (d.coupon_disabled || (d.group_order_error && (d.group_order_error.includes('B券') || d.group_order_error.includes('coupon_disabled') || d.group_order_error.includes('暫停發送'))))) {
              if (currentPlanType === '300') {
                  window.couponBEnabled = false;
                  window.currentSelectedPlan = '150';
                  hideOrderWaitingOverlay(); hideGroceryWaitingOverlay();
                  const submitBtn = document.getElementById('checkoutSubmitBtn');
                  if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = '送出訂單'; submitBtn.style.opacity = '1'; }
                  showModal('⚠️ 300 方案配額已滿', '300 方案今日優惠額度已用罄，系統已自動為您切換至「⚡ 150 內半價」方案，請確認後送出。', false, `
                      <button onclick="document.getElementById('errorModalOverlay').style.display='none'; openCheckoutSummary();" style="width:100%; padding:12px; background:#f43f5e; color:#fff; border:none; border-radius:8px; font-weight:bold; font-size:15px; cursor:pointer;">查看 150 方案明細並送出</button>
                  `, true);
                  return;
              }
          }
          if (d && d.order_id) submittedOrderId = d.order_id;
          if (d && d.join_url) window.lastFastGroupOrderUrl = d.join_url;
          if (d && d.sub_orders && d.sub_orders.length > 0) {
              window.lastSubOrders = d.sub_orders;
          } else {
              window.lastSubOrders = null;
          }
          if (d && d.order_uuid) {
              window.lastGroupOrderUuid = d.order_uuid;
              console.log("✅ [點餐團購] 開團成功，UUID:", d.order_uuid, "網址:", d.join_url);
          }
          if (d && d.group_order_error) {
              window.lastGroupOrderError = d.group_order_error;
              console.warn("⚠️ [點餐團購] 開團未成功原因:", d.group_order_error);
          }
      }
  } catch(e) {
      console.error("Upload order failed", e.stack || e);
  }
  window.lastSubmittedOrderId = submittedOrderId;

  const isLiffClient = !isDesktopDevice && typeof liff !== 'undefined' && liff.isInClient();

  if (isDesktopDevice || !isLiffClient) {
    if (window.currentGroupBuyId && typeof markGroupBuySubmitted === 'function') {
      await markGroupBuySubmitted(msgText);
    }
    clearCart();
    window._orderSent = true;
    const apiBase = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) ? API_BASE_URL : '';
    const userIdFallback = (typeof getLiffUserId === 'function') ? await getLiffUserId() : '';
    if (userIdFallback && submittedOrderId) {
        try {
            fetch(`${apiBase}/api/order/push_order_received`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: submittedOrderId, user_id: userIdFallback })
            }).catch(e => console.log('Push fallback error:', e));
        } catch(e) {}
    }
    let fastCartBtnHtml = '';
    if (window.lastSubOrders && window.lastSubOrders.length > 0) {
        window.lastSubOrders.forEach((sub, sIdx) => {
            const bNum = sub.binIndex || (sIdx + 1);
            const rawUrl = sub.join_url || (sub.order_uuid ? `https://www.ubereats.com/tw/orders/${sub.order_uuid}` : '');
            const statusUrl = formatOrderStatusUrl(rawUrl);
            if (statusUrl) {
                const btnLabel = (bNum === 1) ? '立即查詢訂單狀態1' : `查詢訂單狀態${bNum}`;
                fastCartBtnHtml += `<button onclick="window.open('${statusUrl}', '_blank')" style="width:100%; padding:14px; background:#059669; color:#fff; border:none; border-radius:12px; font-weight:bold; font-size:16px; cursor:pointer; margin-bottom:10px; box-shadow:0 4px 12px rgba(5,150,105,0.25);">🔍 ${btnLabel}</button>`;
            }
        });
    } else if (window.lastFastGroupOrderUrl) {
        const statusUrl = formatOrderStatusUrl(window.lastFastGroupOrderUrl);
        if (statusUrl) {
            fastCartBtnHtml = `<button onclick="window.open('${statusUrl}', '_blank')" style="width:100%; padding:14px; background:#059669; color:#fff; border:none; border-radius:12px; font-weight:bold; font-size:16px; cursor:pointer; margin-bottom:12px; box-shadow:0 4px 12px rgba(5,150,105,0.3);">🔍 立即查詢訂單狀態</button>`;
        }
    }
    let modalTitle = '偵測到非手機登入';
    let copyPromptHtml = '<div style="text-align:center; font-size:16px; color:#555; margin-bottom: 16px;">無法自動為您送出至 LINE</div>';
    let copyBtnText = '請按此複製訂單訊息 (貼回聊天室)';
    let copyBtnBg = '#f43f5e';
    if (submittedOrderId) {
        modalTitle = '📋 訂單與餐點已成功預存！';
        copyPromptHtml = `
          <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:10px; padding:12px; margin-bottom:14px; text-align:left; font-size:14px; color:#166534; line-height:1.6;">
            ✅ <b>餐點與客製化內容已成功存入伺服器！</b><br>
            因您使用的是電腦版或外部瀏覽器，請點擊下方按鈕複製訂單文字，並<b>貼回官方 LINE 聊天室</b>。<br>
            系統將自動為您認領訂單並立即開啟裝好餐點的專屬團購單！
          </div>
        `;
        copyBtnText = '📋 複製訂單文字 (貼回 LINE 聊天室認領)';
        copyBtnBg = '#059669';
    }
    const copyBtnHtml = `${copyPromptHtml}${fastCartBtnHtml}<button onclick="copyToClipboardFallback(decodeURIComponent('${encodeURIComponent(msgText).replace(/'/g, "%27")}'), this)" style="width:100%; padding:14px; background:${copyBtnBg}; color:#fff; border:none; border-radius:12px; font-weight:bold; font-size:16px; cursor:pointer; box-shadow:0 4px 12px rgba(5,150,105,0.25);">${copyBtnText}</button>`;

    hideOrderWaitingOverlay(); hideGroceryWaitingOverlay();
    showModal(modalTitle, '', true, copyBtnHtml, true);
    return;
  }

  if (isLiffClient) {
      if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
      }
      try {
          const perm = await liff.permission.query("chat_message.write");
          if (perm.state !== 'granted') {
              await liff.permission.requestAll();
              const newPerm = await liff.permission.query("chat_message.write");
              if (newPerm.state !== 'granted') {
                  const apiBase = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) ? API_BASE_URL : '';
                  const userIdFallback = (typeof getLiffUserId === 'function') ? await getLiffUserId() : '';
                  if (userIdFallback && submittedOrderId) {
                      try {
                          fetch(`${apiBase}/api/order/push_order_received`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ order_id: submittedOrderId, user_id: userIdFallback })
                          }).catch(e => console.log('Push fallback error:', e));
                      } catch(e) {}
                  }
                  showPermissionFailModal(msgText);
                  return;
              }
          }
      } catch (e) {
          console.warn("Permission check error", e);
      }
  }

  // --- 若為生鮮雜貨訂單，在手機 LINE (LIFF) 環境下，進入等待配對讀取畫面並自動轉址 ---
  if (window.isGroceryStore) {
      await handleGroceryOrderSubmit(msgText);
      return;
  }

  // --- 一般餐點訂單，使用等待配對與進度網址轉址邏輯 ---
  await handleFoodOrderSubmit(msgText);
  return;
}

