async function openItemModal(storeUuid, sectionUuid, subsectionUuid, menuItemUuid, titleEnc, descEnc, basePrice, imgUrl, hasCustomizations) {

  if (window.currentGroupBuyId && window.isGroupBuyClosed) {
      showGroupBuyClosedModal();
      return;
  }

  if (window.isGroceryStore) {
      const sName = (typeof currentStoreName !== 'undefined' && currentStoreName) ? currentStoreName : '';
      const is150 = sName.includes('優市');
      const typeTitle = is150 ? '優市' : '雜貨';
      if (window._groceryDisabled) {
          showToast(`⚠️ 目前${typeTitle}已售完 請等待補貨`);
          return;
      }

      openGroceryCheckoutSummary();

      return;

  }

  const title = decodeURIComponent(titleEnc);

  const desc = decodeURIComponent(descEnc);

    currentItem = {
      title,
      desc,
      basePrice,
      imgUrl,
      selectedOptions: [],
      menuItemUuid: menuItemUuid,
      storeUuid: storeUuid || (typeof currentStoreUuid !== 'undefined' ? currentStoreUuid : ''),
      sectionUuid: sectionUuid || '',
      subsectionUuid: subsectionUuid || '',
      rawCustomizations: {}
    };

    currentQty = 1;

    currentCustomizations = [];

    

    document.getElementById('modalTitle').innerText = title;

    document.getElementById('modalDesc').innerText = desc;

    document.getElementById('modalImg').style.display = imgUrl ? 'block' : 'none';

    if (imgUrl) document.getElementById('modalImg').style.backgroundImage = `url('${imgUrl}')`;

    document.getElementById('modalNote').value = '';

    document.getElementById('customizationsArea').innerHTML = '<div style="padding:100px 15px;text-align:center;color:#666;display:flex;flex-direction:column;align-items:center;justify-content:center;"><div class="spinner" style="margin-bottom:15px;"></div><div style="font-size:16px;font-weight:bold;">載入選項中...</div></div>';

    

    updateModalPrice();

    document.getElementById('itemModal').style.display = 'flex';

    const btn = document.getElementById('addToCartBtn');

    if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; btn.style.cursor = 'not-allowed'; }



    // 呼叫 API 取得真實客製化選項

    try {
      if (window.isGroceryStore || hasCustomizations === false) {
          window.noOptionsItems.add(menuItemUuid);
          document.getElementById('customizationsArea').innerHTML = '<div style="padding:15px;text-align:center;color:#f43f5e;font-weight:bold;">一般商品（無客製化選項）</div>';
          if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer'; }
          return;
      }

      // 設定 8 秒超時控制器，避免請求卡在網路導致永遠載入中
      const controller = new AbortController();
      const timeoutTimer = setTimeout(() => controller.abort(), 8000);
      let res;
      try {
        res = await fetch(`${API_BASE_URL}/api/item`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storeUuid, sectionUuid, subsectionUuid, menuItemUuid }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutTimer);
      }

      let json;
      try {
          const textRes = await res.text();
          try {
              json = JSON.parse(textRes);
          } catch (e) {
              console.error('Non-JSON response from server:', textRes);
              throw new Error('伺服器回傳了非 JSON 格式的錯誤: ' + textRes.substring(0, 50) + '...');
          }
      } catch (e) {
          throw e;
      }

      if (json.status === 'success' && json.data) {
        if (json.data.sectionUuid) currentItem.sectionUuid = json.data.sectionUuid;
        if (json.data.subsectionUuid) currentItem.subsectionUuid = json.data.subsectionUuid;
        if (json.data.uuid) {
            currentItem.uuid = json.data.uuid;
            currentItem.menuItemUuid = json.data.uuid;
        }
        currentCustomizations = json.data.customizationsList || [];
        if (currentCustomizations.length === 0) {
          window.noOptionsItems.add(menuItemUuid);
          document.getElementById('customizationsArea').innerHTML = '<div style="padding:20px;text-align:center;color:#666;font-size:14px;font-weight:500;">此商品目前無自訂選項，可直接加入購物車</div>';
        } else {
          renderCustomizations();
        }
        
        const btn2 = document.getElementById('addToCartBtn');
        if (btn2) { btn2.disabled = false; btn2.style.opacity = '1'; btn2.style.cursor = 'pointer'; }
      } else {
        handleModalError(json.data ? json.data.message : (json.message || '店家未提供選項或已售完'));
      }

    } catch (e) {
      const isAbort = e.name === 'AbortError';
      handleModalError(isAbort ? '選項載入超時 (超過 8 秒無回應)' : '網路連線異常或選項加載失敗');
    }

    function handleModalError(msg) {
        const area = document.getElementById('customizationsArea');
        if (!area) return;
        const btn2 = document.getElementById('addToCartBtn');
        if (btn2) { btn2.disabled = false; btn2.style.opacity = '1'; btn2.style.cursor = 'pointer'; }

        area.innerHTML = `
          <div style="padding:30px 15px;text-align:center;color:#d32f2f;display:flex;flex-direction:column;align-items:center;gap:10px;">
            <div style="font-size:15px;font-weight:bold;">⚠️ 客製化選項暫時無法載入</div>
            <div style="font-size:13px;color:#666;">(${escapeHTML(msg)})</div>
            <div style="display:flex;gap:10px;margin-top:6px;">
              <button type="button" onclick="openItemModal('${storeUuid}','${sectionUuid}','${subsectionUuid}','${menuItemUuid}','${titleEnc}','${descEnc}',${basePrice},'${imgUrl}',${hasCustomizations})" style="padding:8px 18px;background:#06c167;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:bold;font-size:14px;box-shadow:0 2px 6px rgba(6,193,103,0.3);">🔄 點此重新載入</button>
            </div>
            <div style="font-size:12px;color:#888;margin-top:4px;">您也可以直接在下方點擊「加入購物車」以預設規格點餐</div>
          </div>
        `;
    }
  }

  

function renderCustomizations() {

    const area = document.getElementById('customizationsArea');

    if (!currentCustomizations || currentCustomizations.length === 0) {

        area.innerHTML = '';

        return;

    }

    area.innerHTML = renderGroups(currentCustomizations, 'root');

}



function renderGroups(groups, pathPrefix) {

    let html = '';

    groups.forEach((group, gIdx) => {

        const gTitle = cleanGroupTitle(parseText(group.title));

        const isRadio = group.maxPermitted === 1;

        let reqText = group.minPermitted > 0 ? `必填 ${group.minPermitted} 項` : '';

        if (group.maxPermitted > 1) reqText += ` (最多 ${group.maxPermitted} 項)`;

        

        const gPath = `${pathPrefix}_g${gIdx}`;

        

        html += `

        <div id="${gPath}" class="modal-section cust-group" data-min="${group.minPermitted || 0}" data-max="${group.maxPermitted || 0}" data-title="${escapeHTML(gTitle)}" data-group-uuid="${group.uuid || ''}" style="background:#f9f9f9; padding:12px; border-radius:8px; border:1px solid #eee; margin-bottom:10px; transition: border 0.3s;">

            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:10px;">

                <h4 style="margin:0;">${escapeHTML(gTitle)}</h4>

                <span class="req-badge" style="font-size:12px; color:#666; background:#e0e0e0; padding:2px 6px; border-radius:4px; transition: all 0.3s;">${reqText}</span>

            </div>

        `;

        

        group.options.forEach((opt, oIdx) => {

            const isSoldOut = opt.isSoldOut === true;
            const oTitle = filterTrailingEnglish(parseText(opt.title));

            const oPrice = opt.price > 0 ? `+$${opt.price / 100}` : '';

            const oPath = `${gPath}_o${oIdx}`;

            

            let inputHtml = '';

            if (isRadio) {

                inputHtml = `<input type="radio" class="cust-input cust-radio" name="${gPath}" data-path="${oPath}" data-group-uuid="${group.uuid || ''}" data-opt-uuid="${opt.uuid || ''}" data-title="${escapeHTML(oTitle)}" data-price="${(opt.price || 0) / 100}" onchange="recalcCustomizations()" style="width:18px;height:18px;" ${isSoldOut ? 'disabled' : ''}>`;

            } else {

                const optMax = opt.maxPermitted || 0;

                inputHtml = `

                <div class="cust-stepper" style="display:flex; align-items:center; gap:8px; opacity: ${isSoldOut ? '0.5' : '1'};">

                    <button type="button" onclick="${isSoldOut ? '' : `changeCustQty(event, '${oPath}', -1, ${optMax})`}" style="width:28px;height:28px;border-radius:14px;border:1px solid #ccc;background:#fff;font-weight:bold;cursor:${isSoldOut ? 'not-allowed' : 'pointer'};color:#111;display:flex;align-items:center;justify-content:center;" ${isSoldOut ? 'disabled' : ''}>-</button>

                    <span id="qty_${oPath}" class="cust-qty cust-input" data-path="${oPath}" data-group-uuid="${group.uuid || ''}" data-opt-uuid="${opt.uuid || ''}" data-qty="0" data-title="${escapeHTML(oTitle)}" data-price="${(opt.price || 0) / 100}" style="font-size:15px;font-weight:bold;min-width:16px;text-align:center;">0</span>

                    <button type="button" onclick="${isSoldOut ? '' : `changeCustQty(event, '${oPath}', 1, ${optMax})`}" style="width:28px;height:28px;border-radius:14px;border:1px solid #ccc;background:#fff;font-weight:bold;cursor:${isSoldOut ? 'not-allowed' : 'pointer'};color:#111;display:flex;align-items:center;justify-content:center;" ${isSoldOut ? 'disabled' : ''}>+</button>

                </div>

                `;

            }

            

            const hasChildren = opt.childCustomizationList && opt.childCustomizationList.length > 0;

            const soldOutBadge = isSoldOut ? `<span style="font-size:12px; color:#fff; background:#ff4444; padding:2px 6px; border-radius:4px; margin-left:8px;">已售完</span>` : '';
            

            html += `

            <div class="cust-option-row" style="${isSoldOut ? 'opacity: 0.6; pointer-events: none;' : ''}">

                <label style="display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid #eaeaea; cursor:${isSoldOut ? 'not-allowed' : 'pointer'};" onclick="${!isRadio ? 'event.preventDefault();' : ''}">

                    <div style="display:flex; align-items:center; gap:10px;">

                        ${inputHtml}

                        <span style="line-height:1.4;">${escapeHTML(oTitle)}${soldOutBadge}</span>

                    </div>

                    <span style="color:#666; font-size:14px;">${oPrice}</span>

                </label>

            `;

            

            if (hasChildren) {

                html += `

                <div id="children_${oPath}" style="display:none; padding-left:15px; margin-top:5px; border-left:2px solid #ccc; margin-bottom:5px;">

                    ${renderGroups(opt.childCustomizationList, oPath)}

                </div>

                `;

            }

            

            html += `</div>`;

        });

        

        html += `</div>`;

    });

    return html;

}



function changeCustQty(event, oPath, delta, optMax) {

    if (event) {

        event.stopPropagation();

        event.preventDefault();

    }

    const qtySpan = document.getElementById(`qty_${oPath}`);

    if (!qtySpan) return;

    

    let current = parseInt(qtySpan.getAttribute('data-qty') || '0', 10);

    

    if (delta > 0) {

        if (optMax > 0 && current >= optMax) return;

        

        const groupDiv = qtySpan.closest('.cust-group');

        const groupMax = parseInt(groupDiv.getAttribute('data-max') || '0', 10);

        

        if (groupMax > 0) {

            let sum = 0;

            groupDiv.querySelectorAll(':scope > .cust-option-row > label > div > .cust-stepper > .cust-qty').forEach(span => {

                sum += parseInt(span.getAttribute('data-qty') || '0', 10);

            });

            if (sum >= groupMax) return;

        }

    }

    

    let newVal = current + delta;

    if (newVal < 0) newVal = 0;

    

    qtySpan.setAttribute('data-qty', newVal);

    qtySpan.innerText = newVal;

    

    recalcCustomizations();

}



function recalcCustomizations() {

    let extraPrice = 0;

    currentItem.selectedOptions = [];
    currentItem.rawCustomizations = {};

    

    document.querySelectorAll('.cust-option-row').forEach(row => {

        const radio = row.querySelector(':scope > label .cust-radio');

        const qtySpan = row.querySelector(':scope > label .cust-stepper .cust-qty');

        const childrenDiv = row.querySelector(`:scope > div[id^="children_"]`);

        

        let isSelected = false;

        if (radio && radio.checked) isSelected = true;

        if (qtySpan && parseInt(qtySpan.getAttribute('data-qty') || '0', 10) > 0) isSelected = true;

        

        if (childrenDiv) {

            childrenDiv.style.display = isSelected ? 'block' : 'none';

        }

    });



    const collectSelections = (container, currentPrefix = '', parentPath = '') => {
        let childGroupIndex = 0;
        container.querySelectorAll(':scope > .cust-group').forEach((groupDiv, gIdx) => {
            const rawGTitle = groupDiv.getAttribute('data-title') || '';
            const gTitle = cleanGroupTitle(rawGTitle);

            // 判斷頂層群組是否純屬冗餘（例如與餐點同名的「推薦組合:...」或單純「推薦組合」）
            const isRedundantRootGroup = !currentPrefix && (
                gTitle.startsWith('推薦組合') || 
                gTitle.startsWith('套餐組合') || 
                (currentItem && currentItem.title && (gTitle.includes(currentItem.title) || currentItem.title.includes(gTitle)))
            );

            groupDiv.querySelectorAll(':scope > .cust-option-row').forEach(row => {
                const radio = row.querySelector(':scope > label .cust-radio');
                const qtySpan = row.querySelector(':scope > label .cust-stepper .cust-qty');
                
                let qty = 0;
                if (radio && radio.checked) qty = 1;
                if (qtySpan) qty = parseInt(qtySpan.getAttribute('data-qty') || '0', 10);
                
                if (qty > 0) {
                    const price = parseFloat(radio ? radio.getAttribute('data-price') : qtySpan.getAttribute('data-price')) || 0;
                    const rawOTitle = radio ? radio.getAttribute('data-title') : qtySpan.getAttribute('data-title');
                    let oTitle = filterTrailingEnglish(rawOTitle);
                    // 清理 (+) 開頭符號，如 (+)紅萱烏龍 -> 紅萱烏龍
                    oTitle = oTitle.replace(/^\(\+\)\s*/, '').trim();
                    
                    extraPrice += (price * qty);
                    const optGroupUuid = groupDiv.getAttribute('data-group-uuid') || '';
                    const optOptionUuid = radio ? radio.getAttribute('data-opt-uuid') : (qtySpan ? qtySpan.getAttribute('data-opt-uuid') : '');
                    
                    let gKey = '';
                    if (optGroupUuid && optOptionUuid) {
                        const currentGroupIdx = parentPath ? childGroupIndex : gIdx;
                        gKey = parentPath ? `${parentPath},${optGroupUuid}+${currentGroupIdx}` : `${optGroupUuid}+${currentGroupIdx}`;
                        if (!currentItem.rawCustomizations[gKey]) currentItem.rawCustomizations[gKey] = [];
                        currentItem.rawCustomizations[gKey].push({
                            uuid: optOptionUuid,
                            optionUuid: optOptionUuid,
                            groupUuid: optGroupUuid,
                            price: Math.round(price * 100),
                            quantity: qty,
                            title: oTitle,
                            groupTitle: gTitle,
                            customizationMeta: {
                                title: gTitle,
                                isPickOne: !!radio
                            }
                        });
                    }
                    const priceTag = price > 0 ? ` (+$${price})` : '';
                    const optText = (qty > 1) ? `${oTitle}${priceTag} x${qty}` : `${oTitle}${priceTag}`;
                    
                    const childrenDiv = row.querySelector(':scope > div[id^="children_"]');
                    let hasChildSelection = false;
                    
                    if (childrenDiv && childrenDiv.style.display !== 'none') {
                        const childSelectedRows = childrenDiv.querySelectorAll('.cust-radio:checked, .cust-qty[data-qty]:not([data-qty="0"])');
                        if (childSelectedRows.length > 0) {
                            hasChildSelection = true;
                            
                            // 判斷此選項是否與主餐點同名或僅為純包裝層（如 50嵐「溫度與份量: 大●紅茶拿鐵」）
                            const normTitle = s => (s || '').replace(/[●·\s\-_()（）]/g, '').toLowerCase();
                            const curTitle = currentItem && currentItem.title ? normTitle(currentItem.title) : '';
                            const cleanO = normTitle(oTitle);
                            const numOptionsInGroup = groupDiv.querySelectorAll(':scope > .cust-option-row').length;
                            const isSameAsMainDish = !currentPrefix && curTitle && cleanO === curTitle;
                            const isWrapperOption = (numOptionsInGroup === 1) && (isSameAsMainDish || isRedundantRootGroup);

                            // 若此選項有子選項：
                            // 1. 若為單品項的包裝層（如 50嵐的大●紅茶拿鐵），不傳遞 prefix，直接讓子選項 (溫度:去冰, 甜度:無糖) 成為自然的一級選項
                            // 2. 若為真正套餐組合子品項（如 麥當勞分享盒中的「紅萱烏龍」或「搖搖薯條」），使用清晰階層標記 (如 紅萱烏龍) 傳給下一層
                            let nextPrefix;
                            if (isWrapperOption) {
                                nextPrefix = '';
                            } else if (currentPrefix) {
                                nextPrefix = `${currentPrefix} > ${optText}`;
                            } else {
                                nextPrefix = optText;
                            }
                            // 關鍵：將母選項逗號路徑傳遞給子客製化群組
                            const nextParentPath = `${gKey},${optOptionUuid}`;
                            collectSelections(childrenDiv, nextPrefix, nextParentPath);
                        }
                    }
                    
                    if (!hasChildSelection) {
                        // 葉子節點：若有母層 prefix（如套餐子品項 紅萱烏龍），使用清晰符號「>」連接：紅萱烏龍 > 冰量:去冰
                        let thisPath;
                        if (currentPrefix) {
                            thisPath = `${currentPrefix} > ${gTitle}:${optText}`;
                        } else {
                            thisPath = `${gTitle}:${optText}`;
                        }
                        currentItem.selectedOptions.push(thisPath);
                    }
                }
            });
            if (parentPath) {
                childGroupIndex++;
            }
        });
    };

    const rootArea = document.getElementById('customizationsArea');
    if (rootArea) collectSelections(rootArea);

    

    currentItem.totalPrice = currentItem.basePrice + extraPrice;

    updateModalPrice();

}



function closeItemModal() {



    document.getElementById('itemModal').style.display = 'none';

  }



  function changeQty(delta) {

    currentQty += delta;

    if (currentQty < 1) currentQty = 1;

    updateModalPrice();

  }



  function updateModalPrice() {

    document.getElementById('modalQty').innerText = currentQty;

    const price = currentItem.totalPrice !== undefined ? currentItem.totalPrice : currentItem.basePrice;

    document.getElementById('modalTotal').innerText = (price * currentQty).toLocaleString();

  }



    

function confirmAddToCart() {
    if (window.isGroupBuyClosed) {
        showToast('⚠️ 本團購訂單已送出結帳，目前已截止點餐！');
        closeItemModal();
        return;
    }
    const targetStoreUuid = (typeof currentStoreUuid !== 'undefined' ? currentStoreUuid : '');
    const preCheck = (typeof validateStoreSchedule === 'function') ? validateStoreSchedule() : { valid: true };
    if (window.currentStoreSchedulable !== true || (targetStoreUuid && typeof isStoreSchedBlocked === 'function' && isStoreSchedBlocked(targetStoreUuid)) || (!preCheck.valid && (preCheck.reason === 'NOT_SCHEDULABLE' || preCheck.reason === 'NOT_SCHEDULABLE_UNVERIFIED'))) {
        closeItemModal();
        const resDiv = document.getElementById('results');
        if (typeof abortBlockedStoreEntry === 'function') {
            abortBlockedStoreEntry(targetStoreUuid, '無法為您代購', preCheck.text || '此餐廳無法預約或代訂，請選擇其他餐廳', resDiv, window._lastValidResultsHtml || '');
        } else if (typeof showHardBlockModal === 'function') {
            showHardBlockModal('無法為您代購', preCheck.text || '此餐廳無法代訂，請選擇其他餐廳');
        }
        return;
    }

    let isValid = true;

    let firstInvalidGroup = null;

    

    const validateGroups = (container) => {

        container.querySelectorAll(':scope > .cust-group').forEach(groupDiv => {

            if (!isValid) return;

            

            const min = parseInt(groupDiv.getAttribute('data-min') || '0', 10);

            if (min > 0) {

                let sum = 0;

                groupDiv.querySelectorAll(':scope > .cust-option-row').forEach(row => {

                    const radio = row.querySelector(':scope > label .cust-radio');

                    const qtySpan = row.querySelector(':scope > label .cust-stepper .cust-qty');

                    if (radio && radio.checked) sum += 1;

                    if (qtySpan) sum += parseInt(qtySpan.getAttribute('data-qty') || '0', 10);

                });

                

                if (sum < min) {

                    isValid = false;

                    firstInvalidGroup = groupDiv;

                    return;

                }

            }

            

            groupDiv.querySelectorAll(':scope > .cust-option-row').forEach(row => {

                const radio = row.querySelector(':scope > label .cust-radio');

                const qtySpan = row.querySelector(':scope > label .cust-stepper .cust-qty');

                let isSelected = (radio && radio.checked) || (qtySpan && parseInt(qtySpan.getAttribute('data-qty') || '0', 10) > 0);

                

                if (isSelected) {

                    const childrenDiv = row.querySelector(':scope > div[id^="children_"]');

                    if (childrenDiv && childrenDiv.style.display !== 'none') {

                        validateGroups(childrenDiv);

                    }

                }

            });

        });

    };

    

    const rootArea = document.getElementById('customizationsArea');

    if (rootArea) validateGroups(rootArea);

    

    if (!isValid && firstInvalidGroup) {

        const reqBadge = firstInvalidGroup.querySelector('.req-badge');

        if (reqBadge) {

            reqBadge.style.backgroundColor = '#ffebee';

            reqBadge.style.color = '#d32f2f';

            setTimeout(() => {

                reqBadge.style.backgroundColor = '#e0e0e0';

                reqBadge.style.color = '#666';

            }, 2000);

        }

        firstInvalidGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });

        return;

    }

    

const note = document.getElementById('modalNote').value.trim();

    const finalPrice = currentItem.totalPrice !== undefined ? currentItem.totalPrice : currentItem.basePrice;

    

    // 把選取的客製化選項文字加進備註裡，以便在購物車顯示

    let fullNote = note;

    if (currentItem.selectedOptions && currentItem.selectedOptions.length > 0) {

      const optStr = "選項：" + currentItem.selectedOptions.join(", ");

      fullNote = fullNote ? optStr + " | 備註：" + fullNote : optStr;

    } else if (fullNote) {

      fullNote = "備註：" + fullNote;

    }

    

    const newItem = {

      storeName: currentStoreName,

      storeUrl: typeof currentStoreUrl !== 'undefined' ? currentStoreUrl : '',

      uuid: currentItem.menuItemUuid || currentItem.uuid,
      menuItemUuid: currentItem.menuItemUuid || currentItem.uuid,
      item_uuid: currentItem.menuItemUuid || currentItem.uuid,
      itemUuid: currentItem.menuItemUuid || currentItem.uuid,
      storeUuid: currentItem.storeUuid || (typeof currentStoreUuid !== 'undefined' ? currentStoreUuid : ''),
      sectionUuid: currentItem.sectionUuid || '',
      subsectionUuid: currentItem.subsectionUuid || '',
      rawCustomizations: currentItem.rawCustomizations || {},
      customizations: currentItem.rawCustomizations || {},
      imgUrl: currentItem.imgUrl || '',

        title: currentItem.title,

      price: finalPrice,

      qty: currentQty,

      quantity: currentQty,

      note: fullNote,

      user_name: window.currentGroupBuyId ? getOrPromptGroupBuyUserName() : '',

      device_fp: getGroupBuyDeviceFp(),

      storeCanPickup: typeof window.currentStoreCanPickup !== 'undefined' ? window.currentStoreCanPickup : false,
      storeDeliveryFee: (typeof currentStoreDeliveryFee !== 'undefined' ? currentStoreDeliveryFee : 0),
      originalStoreDeliveryFee: typeof currentOriginalDeliveryFee !== 'undefined' ? currentOriginalDeliveryFee : (typeof currentStoreDeliveryFee !== 'undefined' && currentStoreDeliveryFee > 0 ? currentStoreDeliveryFee + 50 : 0)

    };

    if (window.currentGroupBuyId && typeof groupBuySyncCartAction === 'function') {
      groupBuySyncCartAction('add', { item: newItem });
    } else {
      cart.push(newItem);
      updateCartBadge();
      updateMenuActions();
      saveCart();
    }

    closeItemModal();

    showToast('✅ 已加入: ' + currentItem.title);

  }



  let currentView = 'home';
  window.getCurrentView = () => currentView;
  window.setCurrentView = (v) => { currentView = v; };

  function handleMainBack() {

    if (window.currentGroupBuyId) {
      if (currentView === 'store') return;
      if (currentView === 'cart' || currentView === 'checkout') {
        goBackToStore();
        return;
      }
      return;
    }

    if (currentView === 'store') {
      const resultsEl = document.getElementById('results');
      if (!resultsEl || !resultsEl.children || resultsEl.children.length === 0) {
        goHome();
      } else {
        goBack();
      }
    }

    else if (currentView === 'list') goHome();

  }



  function goHome() {
    window._openStoreSeq = (window._openStoreSeq || 0) + 1;
    window._openStoreInFlight = false;
    if (typeof setOpenStoreShield === 'function') setOpenStoreShield(false);
    window.isDiscountZone = false;
    window.currentStoreRawData = null;
    window.currentStoreSchedulable = false;
    window.currentStoreName = '';
    window.currentStoreUuid = '';

    currentView = 'home';

    const mbBtn1 = document.getElementById('mainBackBtn') || document.getElementById('heroBackBtn');
    if (mbBtn1) mbBtn1.style.visibility = 'hidden';

    const ssb1 = document.getElementById('storeSearchBtn');
    if (ssb1) ssb1.style.display = 'none';

    const gbBtn = document.getElementById('groupBuyBtn');
    if (gbBtn) gbBtn.style.display = 'none';

    document.getElementById('listView').style.display = 'none';

    document.getElementById('storeView').style.display = 'none';

    document.getElementById('homeView').style.display = 'block';
    updateCartBadge();

    if (window._isRandomOrEmptySearch) {
      const qInput = document.getElementById('query');
      if (qInput) qInput.value = '';
      const mobileInput = document.getElementById('globalSearchInputMobile');
      if (mobileInput) mobileInput.value = '';
      if (typeof renderOverlayHTML === 'function') renderOverlayHTML();
      window._isRandomOrEmptySearch = false;
    }

  }



  function goBack() {
    window._openStoreSeq = (window._openStoreSeq || 0) + 1;
    window._openStoreInFlight = false;
    if (typeof setOpenStoreShield === 'function') setOpenStoreShield(false);
    window.currentStoreRawData = null;
    window.currentStoreSchedulable = false;

    currentView = 'list';

    const mbBtn2 = document.getElementById('mainBackBtn') || document.getElementById('heroBackBtn');
    if (mbBtn2) mbBtn2.style.visibility = 'visible';

    const gbBtn = document.getElementById('groupBuyBtn');
    if (gbBtn) gbBtn.style.display = 'none';

    document.getElementById('storeView').style.display = 'none';

    document.getElementById('homeView').style.display = 'none';

    document.getElementById('listView').style.display = 'block';

  }



  // 解析文字

    function filterTrailingEnglish(str) {
        if (!str) return str;
        let s = str.trim();
        // 1. 若含有分隔線「|」，且包含中文，優先取前面的中文部分（例如 "配餐選擇 | Side Order" -> "配餐選擇"）
        if (s.includes('|')) {
            const parts = s.split('|');
            if (/[\u4e00-\u9fa5]/.test(parts[0])) {
                s = parts[0].trim();
            } else {
                for (const p of parts) {
                    if (/[\u4e00-\u9fa5]/.test(p)) { s = p.trim(); break; }
                }
            }
        }
        // 2. 濾除純英文括號（如 (M)、(L)、(Hot)），但保留中文括號（如 (大)、(中)、(冰)、(1塊) 等）
        s = s.replace(/\s*\([a-zA-Z\s]+\)$/, '').trim();
        // 3. 濾除結尾的純英文字詞（例如 "加點 Add On" -> "加點"）
        if (/[\u4e00-\u9fa5]/.test(s)) {
            s = s.replace(/\s+[a-zA-Z\s\-.,&]+$/, '').trim();
        }
        return s;
    }

    function cleanGroupTitle(str) {
        if (!str) return '';
        let s = filterTrailingEnglish(str);
        // 移除說明性免責聲明括號 (如 (若未點購薯條配餐，恕不提供薯條醬包，請勿點選下列醬包選項))
        s = s.replace(/\s*[\(（][^\)）]*(?:若未|恕不|請勿|注意|說明|提供|點選|不可|敬請|限)[^\)）]*[\)）]/g, '').trim();
        // 移除星號開頭之附註說明 (如 *搖搖薯條配餐恕不提供蕃茄醬包 或 *產品資訊)
        s = s.replace(/\s*\*.*$/, '').trim();
        // 移除可能殘留的半形或全形逗號，避免破壞外部以逗號為主的選項字串解析
        s = s.replace(/[,，]/g, ' ').trim();
        return s;
    }

  function parseText(obj) {

    if (!obj) return '';

    if (typeof obj === 'string') return obj;

    if (obj.text) return obj.text;

    return '';

  }



function isOpeningWithin30Minutes(badgeTime) {
    if (!badgeTime) return false;
    if (badgeTime.includes('分鐘') || badgeTime.includes('min')) return false;

    const timeMatch = badgeTime.match(/(上午|下午)?\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!timeMatch) return false;

    const prefix = timeMatch[1] || '';
    let hours = parseInt(timeMatch[2], 10);
    const minutes = parseInt(timeMatch[3], 10);
    const suffix = (timeMatch[4] || '').toUpperCase();

    const isPM = prefix === '下午' || suffix === 'PM';
    const isAM = prefix === '上午' || suffix === 'AM';

    if (isPM && hours < 12) {
        hours += 12;
    } else if (isAM && hours === 12) {
        hours = 0;
    }

    const now = new Date();
    let target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);

    // 若目標時間比當前早超過 15 分鐘，代表不是稍早的快取，而是明天的開店時間
    if (target.getTime() < now.getTime() - 15 * 60 * 1000) {
        target.setDate(target.getDate() + 1);
    }

    const diffMinutes = (target.getTime() - now.getTime()) / (60 * 1000);
    return diffMinutes >= -15 && diffMinutes <= 30;
}


function isStorePickupAvailable(storeRawData) {
    if (!storeRawData) return false;
    const storeTitle = typeof storeRawData.title === 'object' && storeRawData.title ? (storeRawData.title.text || '') : (storeRawData.title || storeRawData.name || '');
    if (typeof isStorePickupExcluded === 'function' && isStorePickupExcluded(storeTitle)) {
        return false;
    }
    try {
        const suppModes = storeRawData.supportedDiningModes || [];
        const hasPickupMode = Array.isArray(suppModes) && suppModes.some(m => m.mode === 'PICKUP');
        const modalityOptions = (storeRawData.modalityInfo && Array.isArray(storeRawData.modalityInfo.modalityOptions)) 
            ? storeRawData.modalityInfo.modalityOptions 
            : [];
        const pickupOpt = modalityOptions.find(opt => opt.diningMode === 'PICKUP');
        const isPickupDisabled = pickupOpt ? pickupOpt.isDisabled === true : false;
        return Boolean(hasPickupMode || (pickupOpt && !isPickupDisabled));
    } catch(e) {
        return false;
    }
}
window.isStorePickupAvailable = isStorePickupAvailable;

async function openStore(uuid, storeName, actionUrl = '', skipFetch = false, diningMode = 'DELIVERY', badgeTime = '') {
    if (window._openStoreInFlight) {
        return;
    }
    let checkStoreName = '';
    try { checkStoreName = decodeURIComponent(storeName || ''); } catch (e) { checkStoreName = storeName || ''; }

    // 0. 快速阻擋已知無法預約／本工作階段已阻擋的店家 (全聯特規除外)
    if (uuid && !isPxmartName(checkStoreName) && typeof isStoreSchedBlocked === 'function' && isStoreSchedBlocked(uuid)) {
        const cached = (window._sessionUnschedulableBlocked && window._sessionUnschedulableBlocked[uuid]) || null;
        const tTypeQuick = (typeof currentVertical !== 'undefined' && currentVertical === 'SHOP') ? '商店' : '餐廳';
        const bTitle = (cached && cached.title) ? cached.title : '無法為您代購';
        const bMsg = (cached && cached.msg) ? cached.msg : `此${tTypeQuick}無法代訂，請選擇其他${tTypeQuick}`;
        if (typeof showHardBlockModal === 'function') {
            showHardBlockModal(bTitle, bMsg);
        } else {
            showModal(bTitle, bMsg, true);
        }
        return;
    }

    window._openStoreInFlight = true;
    const callSeq = (window._openStoreSeq = (window._openStoreSeq || 0) + 1);
    if (typeof setOpenStoreShield === 'function') setOpenStoreShield(true);
    const preservedRawData = skipFetch ? window.currentStoreRawData : null;
    window.currentStoreSchedulable = false;
    window.currentStoreRawData = null;
    window.customizationRetries = {};
    // 先重置生鮮標記，避免上一家店殘留
    const isInitialGroceryName = Boolean(checkStoreName && (checkStoreName.includes('優市') || checkStoreName.includes('全聯') || checkStoreName.includes('家樂福') || checkStoreName.includes('大潤發') || checkStoreName.includes('愛買') || checkStoreName.includes('美廉社')));
    window.isGroceryStore = isInitialGroceryName;
    window.isPxmartAsapMode = isPxmartName(checkStoreName);

    const resultsDiv = document.getElementById('results');
    const sc = document.getElementById('storeContent');
    const rawCurrentResultsHtml = resultsDiv ? resultsDiv.innerHTML : '';
    if (rawCurrentResultsHtml && !rawCurrentResultsHtml.includes('<div class="spinner"></div>') && rawCurrentResultsHtml.trim() !== '') {
        window._lastValidResultsHtml = rawCurrentResultsHtml;
    }
    const oldHtml = (rawCurrentResultsHtml && !rawCurrentResultsHtml.includes('<div class="spinner"></div>'))
        ? rawCurrentResultsHtml
        : (window._lastValidResultsHtml || '');

    try {
    // 檢查店家黑名單與三小時時段店家 (若未載入則先載入)
    if (!window._blacklistLoaded && typeof loadStoreBlacklist === 'function') {
        await loadStoreBlacklist();
        if (callSeq !== window._openStoreSeq) return;
    }
    if (!window._threeHourStoresLoaded && typeof loadThreeHourStores === 'function') {
        await loadThreeHourStores();
        if (callSeq !== window._openStoreSeq) return;
    }
    if (!window._pickupExcludeStoresLoaded && typeof loadPickupExcludeStores === 'function') {
        await loadPickupExcludeStores();
        if (callSeq !== window._openStoreSeq) return;
    }
    if (checkStoreName && typeof isStoreBlacklisted === 'function' && isStoreBlacklisted(checkStoreName)) {
        abortBlockedStoreEntry(uuid, '無法代購', '此店家無法使用折價券，無法代購請見諒', resultsDiv, oldHtml);
        return;
    } // Reset retries state on store entry
    
    if (typeof originalAppHeaderHtml !== 'undefined' && originalAppHeaderHtml) {
        const appHeaderEl = document.querySelector('.app-header');
        if (appHeaderEl && appHeaderEl.innerHTML !== originalAppHeaderHtml) {
            appHeaderEl.innerHTML = originalAppHeaderHtml;
            appHeaderEl.style.display = 'flex';
        }
    }
    const cartViewEl = document.getElementById('cartView');
    if (cartViewEl) cartViewEl.style.display = 'none';
    const checkoutViewEl = document.getElementById('checkoutView');
    if (checkoutViewEl) checkoutViewEl.style.display = 'none';
    
    // [全聯特規] 當點選任何「全聯」店家時 (排除「大全聯」)，若目前為預約模式，自動靜默切換為即時模式完成訂單
    if (isPxmartName(checkStoreName) && typeof scheduleMode !== 'undefined' && scheduleMode === 'SCHEDULE') {
        if (typeof confirmTimePicker === 'function') {
            confirmTimePicker('ASAP', true);
        } else {
            scheduleMode = 'ASAP';
        }
    }

    if (!badgeTime && uuid) {
        const cardEl = document.getElementById(`card_${uuid}`);
        if (cardEl) {
            const bEl = cardEl.querySelector('.card-img div[style*="position:absolute"]') || cardEl.querySelector('div[style*="position:absolute"]');
            if (bEl) badgeTime = bEl.innerText.trim();
        }
    }
    const timeMatch = (badgeTime || '').match(/(?:上午|下午)?\s*\d{1,2}:\d{2}\s*(?:AM|PM)?/i);
    const isClockTime = !!timeMatch && !badgeTime.includes('分鐘') && !badgeTime.includes('min');
    const displayTime = timeMatch ? timeMatch[0] : '';
    const isWithin30Min = isOpeningWithin30Minutes(badgeTime);
    const isCardMarkedClosed = badgeTime && (badgeTime.includes('可預約') || badgeTime.includes('休息') || badgeTime.includes('已關閉') || badgeTime.includes('後營業') || badgeTime.includes('開始營業')) && !badgeTime.includes('營業中') && !badgeTime.includes('分鐘後送達') && !badgeTime.includes('分鐘內送達') && !badgeTime.includes('分');

    // 若為當前 30 分鐘內即將營業的店家，不做攔截，直接自然進入店家
    if (!skipFetch && scheduleMode === 'ASAP' && (isClockTime || isCardMarkedClosed) && !isWithin30Min) {
        showModal(
            '店家目前尚未營業',
            displayTime ? `這家店家目前尚未營業，需要等到 ${displayTime} 才能送出訂單。` : `這家店家目前尚未營業，正在查詢可預約時段...`,
            true,
            `<div style="text-align:center; padding:15px 0 5px 0;">
                <div class="spinner" style="width:45px !important; height:45px !important; margin:0 auto 10px auto;"></div>
                <div style="font-size:14px; color:#666; font-weight:bold;">正在查詢菜單與可預約時段...</div>
             </div>`,
            true
        );
    }

    if (cart.length > 0 && storeName && cart[0].storeName && cart[0].storeName !== storeName) {
        if (typeof clearCart === 'function') clearCart();
        else {
            cart = [];
            saveCart();
            updateCartBadge();
        }
    }

    

    if(document.getElementById('headerSearchBox') && document.getElementById('headerSearchBox').style.display === 'block') {

        toggleStoreSearch();

    }

      if(storeName)     try {
        currentStoreName = decodeURIComponent(storeName);
    } catch (e) {
        currentStoreName = storeName;
    }
    window.currentStoreName = currentStoreName;

    const cleanActionUrl = (typeof normalizeUberActionPath === 'function')
        ? normalizeUberActionPath(actionUrl)
        : (actionUrl || '').replace(/([?&])diningMode=[^&]*(&|$)/g, '$1').replace(/[?&]$/, '');
    if(cleanActionUrl) {
        currentStoreUrl = 'https://www.ubereats.com/tw' + cleanActionUrl + (cleanActionUrl.includes('?') ? '&' : '?') + 'diningMode=' + diningMode;
    } else {
        currentStoreUrl = 'https://www.ubereats.com/tw/store/-/' + (decodeStoreUuid(uuid) || uuid) + '?diningMode=' + diningMode;
    }

      currentStoreUuid = uuid;

      currentStoreDeliveryFee = 0; currentOriginalDeliveryFee = 0;

    if (sc) sc.innerHTML = '';
    if (resultsDiv) {
        resultsDiv.innerHTML = '<div class="status" style="padding: 100px 20px; display: flex; flex-direction: column; align-items: center; justify-content: center;"><div class="spinner"></div></div>';
    }
    
    // Immediately transition to list view so user sees the spinner instead of hanging on home
    document.getElementById('homeView').style.display = 'none';
    document.getElementById('storeView').style.display = 'none';
    document.getElementById('listView').style.display = 'block';
    currentView = 'list';
    const mbBtn = document.getElementById('mainBackBtn') || document.getElementById('heroBackBtn');
    if (mbBtn) mbBtn.style.visibility = 'visible';

      let json = null;
      if (skipFetch && preservedRawData) {
          json = { data: preservedRawData, status: 'success' };
      } else {

      let retries = 0;

      while (retries < 3) {

          try {

              const uberPayload = {
                  storeUuid: uuid,
                  lat: currentLat,
                  lng: currentLng,
                  diningMode: 'DELIVERY',
                  cbType: 'EATER_ENDORSED'
              };
              if (typeof scheduleMode !== 'undefined' && scheduleMode === 'SCHEDULE') {
                  const timeSelect = document.getElementById('scheduleTime');
                  if (timeSelect && timeSelect.value) {
                      try {
                          const sData = JSON.parse(timeSelect.value);
                          const startTimeMs = getSelectedScheduleTimestamp();
                          uberPayload.time = {
                              scheduled: true,
                              date: sData.date,
                              startTime: sData.startTime,
                              startTimeMs: startTimeMs,
                              endTime: sData.endTime,
                              deliveryType: 'ASAP'
                          };
                      } catch (e) {}
                  }
              }

              console.log('📡 [開啟店家] 直送 Uber Payload:', JSON.stringify(uberPayload, null, 2));
              
              const uberHeaders = {
                  "accept": "*/*",
                  "accept-language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
                  "content-type": "application/json",
                  "x-csrf-token": "x",
                  "x-uber-device-location-latitude": currentLat.toString(),
                  "x-uber-device-location-longitude": currentLng.toString(),
                  "x-uber-target-location-latitude": currentLat.toString(),
                  "x-uber-target-location-longitude": currentLng.toString()
              };

              if (callSeq !== window._openStoreSeq) return;
              const res = await fetch(`${API_BASE_URL}/api/store_v3`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(uberPayload)
              });
              if (callSeq !== window._openStoreSeq) return;
              const textRes = await res.text();
              if (callSeq !== window._openStoreSeq) return;
              try {
                  json = JSON.parse(textRes);
                  if (!json.data) {
                      throw new Error("Uber 回傳了格式正確的 JSON，但裡面沒有 data 欄位！內容：" + textRes);
                  }
                  break; // 成功解析 JSON，跳出重試迴圈
              } catch (parseError) {


                  console.error(`Attempt ${retries + 1} failed - Non-JSON response:`, textRes);

                  if (retries >= 2) throw new Error('伺服器回傳了非 JSON 格式的錯誤: ' + textRes.substring(0, 50) + '...');

              }

          } catch (networkError) {

              if (retries >= 2) throw networkError;

          }

          retries++;

          await new Promise(r => setTimeout(r, 1000)); // 等待 1 秒後重試

      }
      }

      

      if (json.status === 'failure') {

        resultsDiv.innerHTML = oldHtml;

        throw new Error(json.data ? json.data.message : '取得菜單失敗');

      }

      

      const d = json.data;
      if (callSeq !== window._openStoreSeq) return;

      const isPickupExcluded = typeof isStorePickupExcluded === 'function' && (
          isStorePickupExcluded(checkStoreName) ||
          isStorePickupExcluded(storeName) ||
          (d && isStorePickupExcluded(d)) ||
          (d && isStorePickupExcluded(d.title))
      );
      if (isPickupExcluded) {
          window.currentStoreCanPickup = false;
          localStorage.setItem('uberCartIsDiscount', 'false');
      } else {
          window.currentStoreCanPickup = isStorePickupAvailable(d);
          if (window.currentStoreCanPickup || diningMode === 'PICKUP') {
              localStorage.setItem('uberCartIsDiscount', 'true');
          } else {
              localStorage.setItem('uberCartIsDiscount', 'false');
          }
      }

      // 檢查取得後的官方店家標題是否在黑名單中
      if (d && d.title && typeof isStoreBlacklisted === 'function' && isStoreBlacklisted(d.title)) {
          abortBlockedStoreEntry((d && d.uuid) || uuid, '無法代購', '此店家無法使用折價券，無法代購請見諒', resultsDiv, oldHtml, true);
          return;
      }

      const isGroceryName = checkStoreName && (checkStoreName.includes('優市') || checkStoreName.includes('全聯') || checkStoreName.includes('家樂福') || checkStoreName.includes('大潤發') || checkStoreName.includes('愛買') || checkStoreName.includes('美廉社'));
      window.isGroceryStore = Boolean((d && d.isGr === true) || isGroceryName);
      if (typeof currentVertical !== 'undefined') {
          currentVertical = window.isGroceryStore ? 'SHOP' : 'RESTAURANTS';
      }
      window._groceryDisabled = false;
      const is150StoreName = currentStoreName && currentStoreName.includes('優市');
      if (window.isGroceryStore) {
          if (is150StoreName) {
              if (!currentStoreName.includes('免外送費、免服務費')) {
                  currentStoreName += ' (免外送費、免服務費)';
              }
          } else if (!currentStoreName.includes('不需外送費、服務費') && !currentStoreName.includes('不需外送費、需要服務費')) {
              currentStoreName += ' (不需外送費、需要服務費)';
          }

          if (typeof checkGroceryStatus === 'function') {
              checkGroceryStatus(currentStoreName).then(isDisabled => {
                  if (callSeq !== window._openStoreSeq || !window.currentStoreSchedulable) return;
                  if (isDisabled) {
                      window._groceryDisabled = true;
                      if (typeof applyGroceryDisabledUI === 'function') applyGroceryDisabledUI(currentStoreName, false);
                      const typeTitle = is150StoreName ? '優市' : '生鮮雜貨';
                      showModal('目前暫停營業', `⚠️ 目前${typeTitle}已售完，暫停營業，請等待補貨！`, true, `<button onclick="document.getElementById('errorModalOverlay').style.display='none'; if(typeof handleMainBack==='function') handleMainBack();" style="margin-top:15px; background:#f43f5e; color:#fff; border:none; border-radius:8px; padding:12px; width:100%; font-size:15px; font-weight:bold; cursor:pointer;">我知道了</button>`, true);
                  }
              });
          }
      }

      const logoUrl = d.heroImageUrls && d.heroImageUrls.length > 0 ? d.heroImageUrls[0].url : '';

      const storeUuid = d.uuid;

      

      // 先驗證排程，失敗則直接彈出，不切換畫面

      let scheduleHtml = '';

      

      let hasValidPriceItem = false;
      window.lastMatchedPrice = 0;
      const availableKeyPrices = new Set();

      if (d.catalogSectionsMap) {
        Object.keys(d.catalogSectionsMap).forEach(key => {
          d.catalogSectionsMap[key].forEach(section => {
            if (section.payload && section.payload.standardItemsPayload) {
              const items = section.payload.standardItemsPayload.catalogItems || [];
              items.forEach(item => {
                const priceVal = item.price > 0 ? Math.round(item.price / 100) : 0;
                if (priceVal >= 10 && priceVal <= 65) {
                    hasValidPriceItem = true;
                    availableKeyPrices.add(priceVal);
                }
              });
            }
          });
        });
      }

      if (availableKeyPrices.size > 0) {
        const keyPriceSeq = [30];
        for (let p = 29; p >= 10; p--) keyPriceSeq.push(p);
        for (let p = 31; p <= 65; p++) keyPriceSeq.push(p);
        for (let p of keyPriceSeq) {
          if (availableKeyPrices.has(p)) {
            window.lastMatchedPrice = p;
            break;
          }
        }
      }



            // 嚴格判斷：統一透過 checkStoreSchedulability 檢查目標預約日是否有真實可選時段且未被禁預約
      const schedStatus = checkStoreSchedulability(d);
      const isProhibitedByUber = schedStatus.isProhibitedByUber;
      const targetDate = schedStatus.targetDate;
      const hasTodayPickerSlots = schedStatus.hasTodayPickerSlots;
      const hasTodayDeliveryHours = schedStatus.hasTodayDeliveryHours;
      const isSchedulable = schedStatus.isSchedulable;

      // 生鮮雜貨與餐廳皆需通過可接單檢查（全聯 ASAP 營業中特規除外）
      const isGrocery = window.isGroceryStore || (typeof currentVertical !== 'undefined' && currentVertical === 'SHOP');
      const pxmartAsapAllowed = (typeof isPxmartAsapBypassAllowed === 'function')
          ? isPxmartAsapBypassAllowed(d, (typeof currentStoreName !== 'undefined' ? currentStoreName : '') || (d && d.title) || '')
          : false;

      // 解析目標預約日所有可用時段，供預約與即時單狀態判斷 (若店家禁止預約或無有效時段，一律為空)
      let availableWindows = (isSchedulable || pxmartAsapAllowed) ? schedStatus.pickerWindows.slice() : [];
      if (typeof interleaveThreeHourWindows === 'function') {
          availableWindows = interleaveThreeHourWindows(availableWindows, storeName, isGrocery);
      }

      // 檢查是否被 Uber 標記為關閉 / 休息中 / 無法即時接單
      const isStoreClosedByUber = Boolean(d.closedMessage && d.closedMessage.trim()) ||
          Boolean(d.orderForLaterInfo && (d.orderForLaterInfo.autoSurfaceBottomSheet || (d.orderForLaterInfo.bottomSheetSubtitleMessage && d.orderForLaterInfo.bottomSheetSubtitleMessage.includes('沒有營業')))) ||
          Boolean(d.tracking && d.tracking.storePayload && d.tracking.storePayload.storeAvailablityState === 'STORE_CLOSED') ||
          (d.isOpen === false) || (d.isOrderable === false);

      const storeClosedNotice = d.closedMessage ? d.closedMessage.trim() : (d.orderForLaterInfo && d.orderForLaterInfo.bottomSheetSubtitleMessage ? d.orderForLaterInfo.bottomSheetSubtitleMessage.trim() : '');
      const closedTimeMatch = (storeClosedNotice || '').match(/(?:上午|下午)?\s*\d{1,2}:\d{2}\s*(?:AM|PM)?/i);
      const effectiveDisplayTime = displayTime || (closedTimeMatch ? closedTimeMatch[0] : '');

      const nowSec = Date.now() / 1000;
      const isNextWindowWithin30 = availableWindows.length > 0 && ((availableWindows[0].startTimeSeconds - nowSec) <= 30 * 60) && ((availableWindows[0].startTimeSeconds - nowSec) >= -15 * 60);
      const isWithin30 = !schedStatus.usedFutureFallbackDate && (isOpeningWithin30Minutes(badgeTime || storeClosedNotice) || isNextWindowWithin30);

      const isTooFar = JSON.stringify(d).includes('"storeStatus":"TOO_FAR_TO_DELIVER"');
      const isStoreOpen = (d.isOpen !== false && d.isOrderable !== false && !isStoreClosedByUber);

      // 即時單與預約單統一嚴格標準：營業中或未營業，只要不能預約，一律不准進入菜單點餐（全聯 ASAP 營業中特規除外）
      const strictScheduleCheck = !isSchedulable && !pxmartAsapAllowed;

      if (isTooFar || strictScheduleCheck) {
          const tType = isGrocery ? '商店' : '餐廳';
          let errorTitle = '無法為您代購';
          let errorMsg = `此${tType}無法代訂，請選擇其他${tType}`;
          if (isTooFar) {
              errorTitle = '超出外送範圍';
              errorMsg = `店家太遠無法外送，請選擇其他${tType}`;
          }
          markStoreUnschedulable(storeUuid, errorTitle, errorMsg);
          if (uuid && uuid !== storeUuid) markStoreUnschedulable(uuid, errorTitle, errorMsg);
          abortBlockedStoreEntry(storeUuid || uuid, errorTitle, errorMsg, resultsDiv, oldHtml);
          return;
      } else {
          // 若店家通過檢查，自動自 unSchedulableStores 解除封鎖 (自我修復歷史誤判)
          const unSchedulableStores = JSON.parse(localStorage.getItem('unSchedulableStores') || '[]');
          const unIdx = unSchedulableStores.indexOf(storeUuid);
          if (unIdx !== -1) {
              unSchedulableStores.splice(unIdx, 1);
              localStorage.setItem('unSchedulableStores', JSON.stringify(unSchedulableStores));
          }
      }

      // 輔助函式：判斷店家此時此刻 (當下) 是否處於營業中
      const checkIsOpenNow = () => {
          try {
              const now = new Date();
              const currentMins = now.getHours() * 60 + now.getMinutes();
              const dayNum = now.getDay();

              // 1. 先由 d.hours (每日各營業區間) 判斷
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
                              }
                              return currentMins >= st || currentMins < et;
                          });
                          if (inShift) return true;
                      }
                  }
              }

              // 2. 檢查外部卡片傳進來的 badgeTime
              if (badgeTime) {
                  const isMinText = (badgeTime.includes('分鐘') || badgeTime.includes('分')) &&
                      !badgeTime.includes('後營業') &&
                      !badgeTime.includes('開始營業') &&
                      !badgeTime.includes('休息') &&
                      !badgeTime.includes('未營業');
                  if (isMinText) return true;
              }

              // 3. ASAP 模式下 Uber API 直接標記為營業中
              if (scheduleMode === 'ASAP' && d.isOpen === true && d.isOrderable === true && !isStoreClosedByUber) {
                  return true;
              }
          } catch (e) {
              console.error('checkIsOpenNow error:', e);
          }
          return false;
      };

      // 判斷是否為「當下正在營業中」
      let isCurrentlyOpen = false;
      if (scheduleMode === 'SCHEDULE') {
          isCurrentlyOpen = checkIsOpenNow();
      } else {
          if (isStoreClosedByUber) {
              isCurrentlyOpen = false;
          } else if (d.isOpen === true && d.isOrderable === true) {
              isCurrentlyOpen = true;
          } else if (isWithin30) {
              isCurrentlyOpen = true;
          } else if (availableWindows.length > 0 && (availableWindows[0].startTimeSeconds - nowSec <= 60 * 60)) {
              isCurrentlyOpen = true;
          } else {
              isCurrentlyOpen = checkIsOpenNow();
          }
      }

      if (scheduleMode === 'SCHEDULE') {
          // 預約模式下，預約時段是否有效由後續 timeFound 決定，預設先不判定為關閉
          window.currentStoreClosed = false;
      } else {
          window.currentStoreClosed = isStoreClosedByUber || !isCurrentlyOpen;
      }
      window.currentStoreAvailableWindows = availableWindows;
      window.currentStoreClosedNotice = storeClosedNotice;
      window.currentStoreDisplayTime = effectiveDisplayTime;
      if (!window.currentStoreClosed) {
          window.mustSelectScheduleBeforeCheckout = false;
      }

      let showSchedModalAfterRender = false;
      let schedNoticeHtml = '';

      if (scheduleMode === 'ASAP') {
          scheduleHtml = `
            <div id="storeScheduleBadge" style="margin-top:10px; display:inline-block; cursor:pointer;" onclick="openTimePickerModal()" title="點擊修改送達時段">
              <span style="background: #f43f5e; color: #fff; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: bold; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.15); cursor: pointer; user-select: none;">
                 <span id="storeScheduleText">🚀 即時訂單</span>
                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.85;"><path d="M6 9l6 6 6-6"></path></svg>
              </span>
            </div>
          `;
          // 如果客人選即時，但店目前尚未營業且非30分鐘內即將營業
          if (!isCurrentlyOpen && !isWithin30) {
              const tType2 = (typeof currentVertical !== 'undefined' && currentVertical === 'SHOP') ? '商店' : '餐廳';
              const targetTimeNotice = storeClosedNotice ? `（${escapeHTML(storeClosedNotice)}）` : (effectiveDisplayTime ? `預計 <b>${escapeHTML(effectiveDisplayTime)}</b> 開始營業` : `目前尚未營業`);

                            // 看這家店是不是能預約
              if (isSchedulable && availableWindows.length > 0) {
                  // 關閉等待彈窗，準備進行轉場進入餐廳
                  document.getElementById('errorModalOverlay').style.display = 'none';
                  showSchedModalAfterRender = true;
                  window.mustSelectScheduleBeforeCheckout = true;

                  // 組合預約時段選單
                  const safeName = storeName ? storeName.replace(/'/g, "%27") : '';
                  const safeAction = actionUrl ? normalizeUberActionPath(actionUrl).replace(/'/g, "%27") : '';
                  let btnsHtml = '';
                  const top5 = availableWindows.slice(0, 5);
                  top5.forEach(tw => {
                      const durationSec = (tw.endTime && tw.startTime) ? (tw.endTime - tw.startTime) * 60 : 1800;
                      const sd = new Date(tw.startTimeSeconds * 1000);
                      const ed = new Date((tw.startTimeSeconds + durationSec) * 1000);
                      const formatT = (dt) => {
                          const h = dt.getHours();
                          const m = String(dt.getMinutes()).padStart(2, '0');
                          const ampm = h >= 12 ? '下午' : '上午';
                          const h12 = h % 12 || 12;
                          return `${getTimeEmoji(h)} ${ampm} ${h12}:${m}`;
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
                        str = `${dayStr} ${getTimeEmoji(sd.getHours())} ${sAmpm} ${sH12}:${sMM}-${eH12}:${eMM}`;
                      } else {
                        str = `${dayStr} ${formatT(sd)} - ${formatT(ed)}`;
                      }
                      const isGr = window.isGroceryStore || (typeof currentVertical !== 'undefined' && currentVertical === 'SHOP');
                      if (typeof getSlotDiscountInfo === 'function') {
                          const discInfo = getSlotDiscountInfo(tw, isGr);
                          str += discInfo.tagHtml;
                      }
                      btnsHtml += `<button onclick="quickSetSchedule(${tw.startTimeSeconds}, '${storeUuid}', '${encodeURIComponent(safeName)}', '${safeAction}', ${tw.startTime || 0}, ${tw.endTime || 0})" style="margin-top:10px; background:#f0f0f0; color:#111; border:1px solid #ccc; border-radius:8px; padding:12px; width:100%; cursor:pointer; font-weight:bold; text-align:center;">${str}</button>`;
                  });

                  schedNoticeHtml = `
                      <div style="text-align:center; font-size:15px; margin-bottom:12px; line-height:1.6; color:#333;">
                          此${tType2}${targetTimeNotice}，目前無法接收「盡快送達」訂單。<br>
                          <span style="color:#f43f5e; font-weight:bold;">請選擇預約未來的送達時段：</span>
                      </div>
                      <div style="max-height:220px; overflow-y:auto; padding:2px;">
                          ${btnsHtml}
                      </div>
                      <button onclick="closeErrorModal();" style="margin-top:12px; background:#fff; color:#555; border:1px solid #ccc; border-radius:8px; padding:10px; width:100%; cursor:pointer; font-weight:bold; font-size:14px;">返回上一頁</button>
                  `;
                  // 繼續向下執行，讓 openStore 自然完成畫面轉場切換與菜單渲染
              } else {
                  // 無法預約
                  const waitNotice = effectiveDisplayTime ? `需要等到 <b>${escapeHTML(effectiveDisplayTime)}</b> 才能送出訂單` : `無法接收即時訂單`;
                  showModal('無法接單', `此${tType2}目前尚未營業，且未提供預約時段，${waitNotice}。`, true, `<button onclick="document.getElementById('errorModalOverlay').style.display='none';" style="margin-top:15px; background:#f43f5e; color:#fff; border:none; border-radius:8px; padding:12px; width:100%; font-size:15px; font-weight:bold; cursor:pointer;">我知道了</button>`, true);
                  resultsDiv.innerHTML = oldHtml;
                  return;
              }
          }
      } else if (scheduleMode === 'SCHEDULE') {

        const selectedSchedule = document.getElementById('scheduleTime');

        const selectedScheduleValue = selectedSchedule ? selectedSchedule.value : '';

        const selectedScheduleText = selectedSchedule && selectedSchedule.selectedIndex >= 0 ? selectedSchedule.options[selectedSchedule.selectedIndex].text : '';



        if (!selectedScheduleValue) {

            showModal('錯誤', '您尚未選擇預計訂餐時段，請重新選擇。');

            resultsDiv.innerHTML = oldHtml;

            return;

        }



        const selectedTime = getSelectedScheduleTimestamp() / 1000;
        let timeFound = false;

        availableWindows.forEach(tw => {
            const duration = (tw.endTime && tw.startTime) ? (tw.endTime - tw.startTime) * 60 : 1800;
            if (selectedTime >= tw.startTimeSeconds && selectedTime <= tw.startTimeSeconds + duration) {
                timeFound = true;
            }
        });

        // 智慧容錯：僅當同日仍存在可用預約時段且所選時段位於未來 60~90 分鐘內才視為有效，否則顯示改成即時單與未來建議預約時段
        if (!timeFound && isCurrentlyOpen && isSelectedTimeWithinOpenTolerance(selectedTime, nowSec, availableWindows)) {
            timeFound = true;
        }

        if (!timeFound) {
            window.currentStoreClosed = true;
            window.mustSelectScheduleBeforeCheckout = true;
            scheduleHtml = `
              <div id="storeScheduleBadge" style="margin-top:10px; display:inline-block; cursor:pointer;" onclick="openTimePickerModal()" title="點擊修改預約送達時段">
                <span style="background: #d97706; color: #fff; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: bold; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.15); cursor: pointer; user-select: none;">
                   <span id="storeScheduleText">⚠️ ${selectedScheduleText} 休息中 (點擊修改)</span>
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.85;"><path d="M6 9l6 6 6-6"></path></svg>
                </span>
              </div>
            `;
            const tType3 = (typeof currentVertical !== 'undefined' && currentVertical === 'SHOP') ? '商店' : '餐廳';
            
            // 若店家通過可預約檢查且目標日確實有可用的預約時段可選 (嚴禁無時段僅憑營業中放行)
            if (isSchedulable && availableWindows.length > 0) {
                document.getElementById('errorModalOverlay').style.display = 'none';
                showSchedModalAfterRender = true;
                window.mustSelectScheduleBeforeCheckout = true;

                const safeName = storeName ? storeName.replace(/'/g, "%27") : '';
                const safeAction = actionUrl ? normalizeUberActionPath(actionUrl).replace(/'/g, "%27") : '';
                let btnsHtml = '';

                // 如果店家當下正在營業，提供醒目的「改為即時單」按鈕
                if (isCurrentlyOpen) {
                    btnsHtml += `<button onclick="window.errorModalCloseCallback = null; document.getElementById('errorModalOverlay').style.display='none'; window.currentStoreClosed = false; confirmTimePicker('ASAP', true, true); openStore('${storeUuid}', decodeURIComponent('${encodeURIComponent(safeName)}'), '${safeAction}', false);" style="margin-top:5px; margin-bottom:12px; background:#fff; color:#000; border:2px solid #000; border-radius:8px; padding:12px; width:100%; cursor:pointer; font-weight:bold; text-align:center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">🚀 改成即時單 (約 10~25 分鐘送達)<br><span style="color:#d32f2f; font-size:12px; font-weight:normal;">*無法獲得預約優惠</span></button>`;
                }

                if (availableWindows.length > 0) {
                    btnsHtml += `<div style="color:#111; text-align:center; font-weight:bold; margin-bottom:8px; font-size:14px;">👉 ${tType3}可接單的預約時段 (點擊切換)：</div>`;
                    const top5 = availableWindows.slice(0, 5);
                    top5.forEach(tw => {
                        const durationSec = (tw.endTime && tw.startTime) ? (tw.endTime - tw.startTime) * 60 : 1800;
                        const sd = new Date(tw.startTimeSeconds * 1000);
                        const ed = new Date((tw.startTimeSeconds + durationSec) * 1000);
                        const formatT = (dt) => {
                            const h = dt.getHours();
                            const m = String(dt.getMinutes()).padStart(2, '0');
                            const ampm = h >= 12 ? '下午' : '上午';
                            const h12 = h % 12 || 12;
                            return `${getTimeEmoji(h)} ${ampm} ${h12}:${m}`;
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
                            str = `${dayStr} ${getTimeEmoji(sd.getHours())} ${sAmpm} ${sH12}:${sMM}-${eH12}:${eMM}`;
                        } else {
                            str = `${dayStr} ${formatT(sd)} - ${formatT(ed)}`;
                        }
                        const isGr = window.isGroceryStore || (typeof currentVertical !== 'undefined' && currentVertical === 'SHOP');
                        if (typeof getSlotDiscountInfo === 'function') {
                            const discInfo = getSlotDiscountInfo(tw, isGr);
                            str += discInfo.tagHtml;
                        }
                        btnsHtml += `<button onclick="quickSetSchedule(${tw.startTimeSeconds}, '${storeUuid}', '${encodeURIComponent(safeName)}', '${safeAction}', ${tw.startTime || 0}, ${tw.endTime || 0})" style="margin-top:8px; background:#f0f0f0; color:#111; border:1px solid #ccc; border-radius:8px; padding:10px; width:100%; cursor:pointer; font-weight:bold; text-align:center;">${str}</button>`;
                    });
                }

                schedNoticeHtml = `
                    <div style="text-align:center; font-size:15px; margin-bottom:12px; line-height:1.6; color:#333;">
                        此${tType3}在您選的時段 ( <b>${escapeHTML(selectedScheduleText)}</b> ) 休息或未開放此預約時段。<br>
                        <span style="color:#f43f5e; font-weight:bold;">請選擇可接單的送達時段：</span>
                    </div>
                    <div style="max-height:220px; overflow-y:auto; padding:2px;">
                        ${btnsHtml}
                    </div>
                    <button onclick="closeErrorModal();" style="margin-top:12px; background:#fff; color:#555; border:1px solid #ccc; border-radius:8px; padding:10px; width:100%; cursor:pointer; font-weight:bold; font-size:14px;">返回上一頁</button>
                `;
                // 允許繼續向下執行，進入餐廳瀏覽菜單！
            } else {
                // 完全無法預約且當下沒開
                const closedTitle = '無法為您代購';
                const closedMsg = `此${tType3}目前尚未營業，且未提供預約時段，請選擇其他${tType3}`;
                markStoreUnschedulable(storeUuid, closedTitle, closedMsg);
                if (uuid && uuid !== storeUuid) markStoreUnschedulable(uuid, closedTitle, closedMsg);
                abortBlockedStoreEntry(storeUuid || uuid, closedTitle, closedMsg, resultsDiv, oldHtml);
                return;
            }
        } else {
            window.currentStoreClosed = false;
            window.mustSelectScheduleBeforeCheckout = false;

            scheduleHtml = `
              <div id="storeScheduleBadge" style="margin-top:10px; display:inline-block; cursor:pointer;" onclick="openTimePickerModal()" title="點擊修改預約送達時段">
                <span style="background: #000; color: #fff; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: bold; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.15); cursor: pointer; user-select: none;">
                   <span id="storeScheduleText">📅 安排於 ${selectedScheduleText}</span>
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.85;"><path d="M6 9l6 6 6-6"></path></svg>
                </span>
              </div>
            `;

        }

      }

      if (callSeq !== window._openStoreSeq) return;

      // 驗證通過，正式提交店家狀態與切換畫面並渲染
      window.currentStoreRawData = d;
      window.currentStoreSchedulable = true;
      window.currentStoreUuid = uuid;
      if (window._loadingModalLock && !showSchedModalAfterRender) {
          const ov = document.getElementById('errorModalOverlay');
          if (ov) ov.style.display = 'none';
          window._loadingModalLock = false;
      }

      const ssb = document.getElementById('storeSearchBtn');
      if (ssb) ssb.style.display = 'block';

      const gbBtn = document.getElementById('groupBuyBtn');
      if (gbBtn) {
          gbBtn.style.display = 'inline-flex';
          if (window.currentGroupBuyId) {
              gbBtn.innerHTML = '👥 團購中';
              gbBtn.style.background = '#06c167';
          } else {
              gbBtn.innerHTML = '👥 團購';
              gbBtn.style.background = '#ff4b2b';
          }
      }

      if (resultsDiv) resultsDiv.innerHTML = oldHtml;

      currentView = 'store';

      const mbBtnStore = document.getElementById('mainBackBtn') || document.getElementById('heroBackBtn');
      if (mbBtnStore) mbBtnStore.style.visibility = 'visible';

      document.getElementById('listView').style.display = 'none';

      document.getElementById('storeView').style.display = 'block';

      

      



      let allItemTitles = [];

      let drinkCounts = { '紅茶': 0, '奶茶': 0, '綠茶': 0, '奶綠': 0, '烏': 0 };

      if (d.catalogSectionsMap) {

        Object.keys(d.catalogSectionsMap).forEach(key => {

          d.catalogSectionsMap[key].forEach(section => {

            if (section.payload && section.payload.standardItemsPayload) {

              const items = section.payload.standardItemsPayload.catalogItems || [];

              items.forEach(item => {

                const title = filterTrailingEnglish(parseText(item.title)) || '';

                allItemTitles.push(title);

                Object.keys(drinkCounts).forEach(k => {

                    if (title.includes(k)) drinkCounts[k]++;

                });

              });

            }

          });

        });

      }

      let matchedCategories = 0;

      Object.values(drinkCounts).forEach(c => { if (c > 5) matchedCategories++; });

      window.isBeverageShop = matchedCategories >= 2;

      let topKeywords = [];

      if (window.isBeverageShop) {

          let bigramCounts = {};

          allItemTitles.forEach(title => {

              for (let i = 0; i <= title.length - 2; i++) {

                  let word = title.substr(i, 2);

                  if (/^[一-龥]{2}$/.test(word)) {

                      bigramCounts[word] = (bigramCounts[word] || 0) + 1;

                  }

              }

          });

          topKeywords = Object.keys(bigramCounts).sort((a, b) => bigramCounts[b] - bigramCounts[a]).slice(0, 8);

      }

      

      const etaText = (d.etaRange && d.etaRange.text) ? d.etaRange.text.replace('Min', '分鐘') : '';

      const etaHtml = etaText ? `<div style="text-align: center; color: #555; font-size: 14px; margin-top: 5px; margin-bottom: 5px; font-weight: bold;">⏱️ 預計抵達時間 ${escapeHTML(etaText)}</div>` : '';

      function getStoreFareText(storeObj) {
          if (!storeObj) return '';
          // 1. 優先以官方原始基準外送費 fareInfo.serviceFee 為準（非生鮮雜貨時），不受各帳號促銷減免干擾
          if (!window.isGroceryStore && storeObj.fareInfo && typeof storeObj.fareInfo.serviceFee === 'number') {
              return `${storeObj.fareInfo.serviceFee}TWD Delivery Fee`;
          }
          // 2. 備援：若有 modalityInfo，優先尋找 STRIKE_THROUGH 劃線原價
          try {
              const modOpts = storeObj.modalityInfo && storeObj.modalityInfo.modalityOptions;
              if (Array.isArray(modOpts)) {
                  const delOpt = modOpts.find(o => o.diningMode === 'DELIVERY') || modOpts[0];
                  const richElements = delOpt && delOpt.priceTitleRichText && delOpt.priceTitleRichText.richTextElements;
                  if (Array.isArray(richElements)) {
                      for (const el of richElements) {
                          const decs = el.text && el.text.predefinedDecorations;
                          if (Array.isArray(decs) && decs.includes('STRIKE_THROUGH') && el.text && el.text.text && el.text.text.text) {
                              return el.text.text.text.trim();
                          }
                      }
                      const parts = richElements
                          .filter(el => el.type === 'text' && el.text && el.text.text && el.text.text.text)
                          .map(el => el.text.text.text.trim())
                          .filter(Boolean);
                      if (parts.length > 0) return parts.join(' ');
                  }
              }
          } catch(e) {}
          // 3. 最後備援：fareBadge.text
          if (storeObj.fareBadge && storeObj.fareBadge.text) return storeObj.fareBadge.text;
          return '';
      }

      let fareHtml = '<div id="storeFareArea" style="text-align: center; color: #999; font-size: 13px; margin-bottom: 10px;">運費查詢中...</div>';

      const isFreeDeliveryStore = !window.isGroceryStore && !isPickupExcluded && (
          window.currentStoreCanPickup ||
          (typeof isStorePickupAvailable === 'function' && isStorePickupAvailable(d)) ||
          localStorage.getItem('uberCartIsDiscount') === 'true' ||
          diningMode === 'PICKUP'
      );

      if (isFreeDeliveryStore) {
          currentStoreDeliveryFee = 0; currentOriginalDeliveryFee = 0;
          fareHtml = `<div id="storeFareArea" style="text-align: center; color: #d32f2f; font-size: 14px; margin-bottom: 10px; font-weight: bold;">🚚 免外送費</div>`;
      } else if (!window.isGroceryStore && d && d.fareInfo && typeof d.fareInfo.serviceFee === 'number') {
          const fee = d.fareInfo.serviceFee;
          const displayFee = fee > 50 ? (fee - 50) : 0;
          if (displayFee <= 0) {
              currentStoreDeliveryFee = 0; currentOriginalDeliveryFee = fee;
              fareHtml = `<div id="storeFareArea" style="text-align: center; color: #d32f2f; font-size: 14px; margin-bottom: 10px; font-weight: bold;">🚚 免外送費</div>`;
          } else {
              currentStoreDeliveryFee = displayFee; currentOriginalDeliveryFee = fee;
              fareHtml = `<div id="storeFareArea" style="text-align: center; color: #d32f2f; font-size: 14px; margin-bottom: 10px; font-weight: bold;">🚚 外送費超過50 需要額外 ${displayFee} 元外送費用</div>`;
          }
      }

      

            if (window.isGroceryStore) {

          const is150Store = (currentStoreName && currentStoreName.includes('優市'));
          if (is150Store) {
              window.groceryServiceFee = 0;
              fareHtml = `<div id="storeFareArea" style="text-align: center; color: #d32f2f; font-size: 14px; margin-bottom: 10px; font-weight: bold;">🚚 免外送費、<span style="color:#d32f2f;">免服務費</span></div>`;
              currentStoreDeliveryFee = 0; currentOriginalDeliveryFee = 0;
          } else {
              window.groceryServiceFee = null;
              let feeText = '需服務費';
              try {
                  if (d.basketDependentFeePolicy && d.basketDependentFeePolicy.dialog && d.basketDependentFeePolicy.dialog.tierFee) {
                      const tier = d.basketDependentFeePolicy.dialog.tierFee[0];
                      if (tier && tier.nonMemberServiceFee) {
                          const fareText = tier.nonMemberServiceFee;
                          const matchVal = fareText.match(/(\d+)/);
                          if (matchVal) {
                              let fee = parseInt(matchVal[1], 10);
                              let displayFee = Math.round(fee * 0.8);
                              window.groceryServiceFee = displayFee;
                              feeText = `服務費${displayFee}`;
                          }
                      }
                  } else if (d.fareInfo && d.fareInfo.serviceFee !== undefined) {
                      let fee = parseInt(d.fareInfo.serviceFee, 10);
                      let displayFee = Math.round(fee * 0.8);
                      window.groceryServiceFee = displayFee;
                      feeText = `服務費${displayFee}`;
                  }
              } catch(e) { console.error(e); }
              fareHtml = `<div id="storeFareArea" style="text-align: center; color: #d32f2f; font-size: 14px; margin-bottom: 10px; font-weight: bold;">🚚 免外送費、${feeText}</div>`;
              currentStoreDeliveryFee = 0; currentOriginalDeliveryFee = 0;
          }

      }




let hoursHtml = '';
if (window.isGroceryStore && d.hours && Array.isArray(d.hours)) {
    let lines = [];
    d.hours.forEach(h => {
        let dr = h.dayRange || '';
        if (h.sectionHours && Array.isArray(h.sectionHours)) {
            h.sectionHours.forEach(sh => {
                let st = sh.startTime || 0;
                let et = sh.endTime || 0;
                let stH = String(Math.floor(st / 60)).padStart(2, '0');
                let stM = String(st % 60).padStart(2, '0');
                let etH = String(Math.floor(et / 60)).padStart(2, '0');
                let etM = String(et % 60).padStart(2, '0');
                lines.push(`${dr} ${stH}:${stM}~${etH}:${etM}`);
            });
        }
    });
    if (lines.length > 0) {
        hoursHtml = `<div style="position:absolute; top:15px; right:15px; text-align:right; font-size:12px; color:#666; background:rgba(255,255,255,0.95); padding:6px 10px; border-radius:6px; box-shadow:0 2px 6px rgba(0,0,0,0.15); z-index:10; border:1px solid #eee;">
            <div style="font-weight:bold; color:#111; margin-bottom:4px; font-size:13px;">🈺 營業時間</div>
            ${lines.join('<br>')}
        </div>`;
    }
}

      let closedBannerHtml = '';
      if (window.currentStoreClosed) {
          const cNotice = window.currentStoreClosedNotice ? `（${escapeHTML(window.currentStoreClosedNotice)}）` : '';
          closedBannerHtml = `
            <div style="margin: 8px auto 12px auto; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 10px 14px; text-align: center; color: #be123c; font-size: 14px; font-weight: bold; max-width: 90%;">
              ⚠️ 店家目前尚未營業${cNotice}<br>
              <span style="font-size:13px; font-weight:normal; color:#e11d48;">無法接「盡快送達」訂單，結帳前須選擇預約送達時段</span>
            </div>
          `;
      }

      let html = `

      <div class="store-header" style="position:relative;">
      ${hoursHtml}

          ${logoUrl ? `<img src="${logoUrl}">` : ''}

          <h2 style="margin-bottom: 5px;">${escapeHTML(parseText(d.title))}</h2>

          ${closedBannerHtml}

          ${etaHtml}

          ${fareHtml}

          ${scheduleHtml}

        </div>

      `;

      

      if (window.isBeverageShop && topKeywords.length > 0) {

          html += `<div class="store-top-nav">`;

          topKeywords.forEach(kw => {

              html += `<button onclick="doStoreKeywordSearch('${escapeHTML(kw)}')">${escapeHTML(kw)}</button>`;

          });

          html += `</div>`;

      }

      

      let promoItemsHtml = '';

      let sidebarHtml = window.isBeverageShop ? `<div class="store-sidebar">` : '';

      let mainContentHtml = window.isBeverageShop ? `<div class="store-main-list" id="storeMainList">` : '';

      let catIndex = 0;

      

      if (d.catalogSectionsMap) {

        Object.keys(d.catalogSectionsMap).forEach(key => {

          const sectionArr = d.catalogSectionsMap[key];

          sectionArr.forEach(section => {

            const sectionUuid = key;

            const subsectionUuid = section.catalogSectionUUID || '';

            if (section.payload && section.payload.standardItemsPayload) {

              const catalogTitle = parseText(section.payload.standardItemsPayload.title) || '菜單';

              const items = section.payload.standardItemsPayload.catalogItems || [];

              

              if (items.length > 0) {

                let catId = `cat_${catIndex++}`;

                if (window.isBeverageShop) {

                    sidebarHtml += `<div class="store-sidebar-item" id="nav_${catId}" onclick="document.getElementById('${catId}').scrollIntoView({behavior: 'smooth', block: 'start'})">${escapeHTML(catalogTitle)}</div>`;

                }

                let sectionHtml = `<div ${window.isBeverageShop ? `id="${catId}"` : ''} class="menu-category">${escapeHTML(catalogTitle)}</div><div class="menu-grid">`;

                let hasRegular = false;

                

                items.forEach(item => {

                  const itemTitle = filterTrailingEnglish(parseText(item.title));

                  const itemDesc = filterTrailingEnglish(parseText(item.itemDescription));

                  const priceVal = item.price > 0 ? Math.round(item.price / 100) : 0; 

                  

                  let priceHtml = priceVal > 0 ? '$' + priceVal : ''; 

                  if (item.priceTagline && item.priceTagline.textFormat) {

                    priceHtml = item.priceTagline.textFormat;

                  }
                  
                  const isSoldOut = item.isSoldOut === true;
                  if (isSoldOut) {
                      priceHtml = '<span style="color:#d32f2f; font-weight:bold;">已售完</span>';
                  }

                  

                  let promoBadgeHtml = '';

                  let isPromo = false;

                  try {
                    if (item.promoInfo && (item.promoInfo.promotionUUID || (item.promoInfo.promoBadge && item.promoInfo.promoBadge.content))) {
                      // 生鮮雜貨關閉優惠商品隔離，一般餐廳維持隔離
                      const isGroceryStoreCurrent = (typeof window !== 'undefined' && window.isGroceryStore) || (typeof currentVertical !== 'undefined' && currentVertical === 'SHOP');
                      if (!isGroceryStoreCurrent) {
                        isPromo = true;
                      }
                      
                      if (item.promoInfo.promoBadge && item.promoInfo.promoBadge.content && item.promoInfo.promoBadge.content.richText) {
                          const elements = item.promoInfo.promoBadge.content.richText.richTextElements;
                          if (elements && elements.length > 0 && elements[0].text && elements[0].text.text && elements[0].text.text.text) {
                             const promoText = elements[0].text.text.text;
                             promoBadgeHtml = `<div style="background-color: #ffe0ea; color: #05944F; padding: 2px 6px; border-radius: 4px; font-size: 11px; display: inline-block; margin-bottom: 4px; font-weight: bold;">${escapeHTML(promoText)}</div>`;
                          }
                      }
                      
                      if (!promoBadgeHtml) {
                          promoBadgeHtml = `<div style="background-color: #ffe0ea; color: #05944F; padding: 2px 6px; border-radius: 4px; font-size: 11px; display: inline-block; margin-bottom: 4px; font-weight: bold;">優惠商品</div>`;
                      }
                    }
                  } catch(e) {}

                  

                  const imgUrl = getUberWebpUrl(item.imageUrl || '');

                  const menuItemUuid = item.uuid;

                  

                  if (isPromo) {

                      promoItemsHtml += `

                        <div class="menu-item" style="opacity: 0.6; cursor: not-allowed;">

                    <div class="menu-item-info">

                      ${promoBadgeHtml}

                      <div class="menu-item-title" style="text-decoration: line-through;">${escapeHTML(itemTitle)}</div>

                      <div style="color: #d32f2f; font-size: 12px; font-weight: bold; margin-bottom: 4px;">優惠商品無法訂購</div>

                      <div class="menu-item-desc">${escapeHTML(itemDesc)}</div>

                      <div class="menu-item-price">${priceHtml}</div>

                    </div>

                    ${imgUrl ? `<div class="menu-item-img" style="position:relative; overflow:hidden;"><img src="${imgUrl}" loading="lazy" style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover;" /></div>` : ''}

                  </div>

                      `;

                  } else {

                      hasRegular = true;

                      sectionHtml += `

                        <div class="menu-item" style="position: relative; ${isSoldOut ? 'opacity: 0.6; cursor: not-allowed;' : ''}" ${isSoldOut ? '' : `onclick="openItemModal('${storeUuid}', '${sectionUuid}', '${subsectionUuid}', '${menuItemUuid}', '${encodeURIComponent(itemTitle).replace(/'/g, "%27")}', '${encodeURIComponent(itemDesc).replace(/'/g, "%27")}', ${priceVal}, '${imgUrl}', ${item.hasCustomizations === false ? false : true})"`}>

                    <div class="menu-item-info">

                      ${promoBadgeHtml}

                      <div class="menu-item-title">${escapeHTML(itemTitle)}</div>

                      <div class="menu-item-desc">${escapeHTML(itemDesc)}</div>

                      <div class="menu-item-price">${priceHtml}</div>

                    </div>

                    ${imgUrl ? `<div class="menu-item-img" style="position:relative; overflow:hidden;"><img src="${imgUrl}" loading="lazy" style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover;" /></div>` : ''}

                    

                    ${!isSoldOut ? `<div class="item-action-area" id="action-${menuItemUuid}" style="position: absolute; right: 15px; bottom: 15px; background: white; border-radius: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); display: flex; align-items: center; justify-content: center; overflow: hidden;" onclick="event.stopPropagation();">

                      <div class="quick-add-btn" onclick="handleQuickAdd(event, '${storeUuid}', '${sectionUuid}', '${subsectionUuid}', '${menuItemUuid}', '${encodeURIComponent(itemTitle).replace(/'/g, "%27")}', '${encodeURIComponent(itemDesc).replace(/'/g, "%27")}', ${priceVal}, '${imgUrl}', ${item.hasCustomizations === false ? false : true})" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; cursor: pointer; color: #111;">＋</div>

                    </div>

                  </div>` : `</div>`}

                      `;

                  }

                });

                sectionHtml += `</div>`;

                if (hasRegular) mainContentHtml += sectionHtml;

              }

            }

          });

        });

        

        if (promoItemsHtml) {

            let catId = `cat_${catIndex++}`;

            if (window.isBeverageShop) {

                sidebarHtml += `<div class="store-sidebar-item" id="nav_${catId}" onclick="document.getElementById('${catId}').scrollIntoView({behavior: 'smooth', block: 'start'})">優惠商品</div>`;

                mainContentHtml += `<div id="${catId}" class="menu-category" style="margin-top:20px; color:#d32f2f; border-top:2px dashed #ccc; padding-top:20px;">分類: 無法訂購項目 (優惠商品)</div><div class="menu-grid">`;

            } else {

                mainContentHtml += `<div class="menu-category" style="margin-top:20px; color:#d32f2f; border-top:2px dashed #ccc; padding-top:20px;">分類: 無法訂購項目 (優惠商品)</div><div class="menu-grid">`;

            }

            mainContentHtml += promoItemsHtml;

            mainContentHtml += `</div>`;

        }

      } else {

        mainContentHtml += '<div class="status">這家餐廳目前沒有提供菜單資料。</div>';

      }

      

      if (window.isBeverageShop) {

          sidebarHtml += `</div>`;

          mainContentHtml += `</div>`;

          html += `<div class="store-layout-2col">` + sidebarHtml + mainContentHtml + `</div>`;

      } else {

          html += mainContentHtml;

      }

      

      sc.innerHTML = html;

      // === Background fetch v1 for delivery fee ===
      (async () => {
          try {
              const normalizedStoreUuid = decodeStoreUuid(uuid);
              const feePayload = {
                  storeUuid: normalizedStoreUuid || uuid,
                  lat: currentLat,
                  lng: currentLng
              };
              if (typeof scheduleMode !== 'undefined' && scheduleMode === 'SCHEDULE') {
                  const timeSelect = document.getElementById('scheduleTime');
                  if (timeSelect && timeSelect.value) {
                      try {
                          const sData = JSON.parse(timeSelect.value);
                          feePayload.diningMode = 'DELIVERY';
                          feePayload.time = {
                              scheduled: true,
                              date: sData.date,
                              startTime: sData.startTime,
                              startTimeMs: getSelectedScheduleTimestamp(),
                              endTime: sData.endTime,
                              deliveryType: 'ASAP'
                          };
                      } catch(e) {}
                  }
              }
              const feeRes = await fetch(`${API_BASE_URL}/api/store`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(feePayload)
              });
              const feeJson = await feeRes.json();
              if (feeJson.data || feeJson.status === 'success') {
                  const fd = feeJson.data || feeJson;
                  const fareArea = document.getElementById('storeFareArea');
                  
                  let fee = null;
                  if (fd.fareInfo && typeof fd.fareInfo.serviceFee === 'number') {
                      fee = fd.fareInfo.serviceFee;
                  } else {
                      const storeFareText = getStoreFareText(fd);
                      if (storeFareText) {
                          if (storeFareText.toLowerCase().includes('no fee')) {
                              fee = 0;
                          } else {
                              const match = storeFareText.match(/(\d+)/);
                              if (match) fee = parseInt(match[1], 10);
                          }
                      }
                  }

                  const isExcludedFareStore = isPickupExcluded || (typeof isStorePickupExcluded === 'function' && fd && isStorePickupExcluded(fd.title));
                  const isFreeDeliveryStore = !window.isGroceryStore && !isExcludedFareStore && (
                      window.currentStoreCanPickup ||
                      (typeof isStorePickupAvailable === 'function' && isStorePickupAvailable(d)) ||
                      (typeof isStorePickupAvailable === 'function' && isStorePickupAvailable(fd)) ||
                      localStorage.getItem('uberCartIsDiscount') === 'true' ||
                      diningMode === 'PICKUP'
                  );

                  if (isFreeDeliveryStore) {
                      currentStoreDeliveryFee = 0; currentOriginalDeliveryFee = 0;
                      if (fareArea) {
                          fareArea.innerHTML = '免運費 🎉';
                          fareArea.style.color = '#d32f2f';
                          fareArea.style.fontWeight = 'bold';
                          fareArea.style.fontSize = '14px';
                          fareArea.style.display = 'block';
                      }
                  } else if (fee !== null) {
                      let displayFee = fee > 50 ? (fee - 50) : 0;
                      if (displayFee <= 0) {
                          currentStoreDeliveryFee = 0; currentOriginalDeliveryFee = fee;
                          if (fareArea) {
                              fareArea.innerHTML = '免運費 🎉';
                              fareArea.style.color = '#d32f2f';
                              fareArea.style.fontWeight = 'bold';
                              fareArea.style.fontSize = '14px';
                              fareArea.style.display = 'block';
                          }
                      } else {
                          currentStoreDeliveryFee = displayFee; currentOriginalDeliveryFee = fee;
                          if (fareArea) {
                              fareArea.innerHTML = `⚠️ 超過50元免運 額外運費 ${displayFee} 元`;
                              fareArea.style.color = '#d32f2f';
                              fareArea.style.fontWeight = 'bold';
                              fareArea.style.fontSize = '14px';
                              fareArea.style.display = 'block';
                          }
                      }
                  } else {
                      if (fareArea) {
                          fareArea.innerHTML = '免運費 🎉';
                          fareArea.style.color = '#d32f2f';
                          fareArea.style.fontWeight = 'bold';
                          fareArea.style.fontSize = '14px';
                      }
                      currentStoreDeliveryFee = 0; currentOriginalDeliveryFee = 0;
                  }
                  if (typeof cart !== 'undefined' && Array.isArray(cart)) {
                      let updatedCartFees = false;
                      cart.forEach(it => {
                          if (it.storeUuid === currentStoreUuid || (it.storeName && it.storeName === currentStoreName)) {
                              it.storeDeliveryFee = currentStoreDeliveryFee;
                              it.originalStoreDeliveryFee = currentOriginalDeliveryFee;
                              updatedCartFees = true;
                          }
                      });
                      if (updatedCartFees && typeof saveCart === 'function') {
                          saveCart();
                      }
                  }
                  if (typeof updateCartUI === 'function') updateCartUI();
                  
                  const is150Store = (typeof currentStoreName !== 'undefined' && currentStoreName && currentStoreName.includes('優市'));
                  if (is150Store) {
                      window.groceryServiceFee = 0;
                  } else if (window.isGroceryStore && fd.basketDependentFeePolicy && fd.basketDependentFeePolicy.dialog && fd.basketDependentFeePolicy.dialog.tierFee) {
                      const tier = fd.basketDependentFeePolicy.dialog.tierFee[0];
                      if (tier && tier.nonMemberServiceFee) {
                          const matchVal = tier.nonMemberServiceFee.match(/(\d+)/);
                          if (matchVal) {
                              window.groceryServiceFee = Math.round(parseInt(matchVal[1], 10) * 0.8);
                          }
                      }
                  } else if (window.isGroceryStore && fd.fareInfo && fd.fareInfo.serviceFee !== undefined) {
                      window.groceryServiceFee = Math.round(parseInt(fd.fareInfo.serviceFee, 10) * 0.8);
                  }
              }
          } catch(e) {
              console.log('背景運費查詢失敗:', e);
              const fareArea = document.getElementById('storeFareArea');
              if (fareArea) {
                  const isFreeDeliveryStore = !window.isGroceryStore && !isPickupExcluded && (
                      window.currentStoreCanPickup ||
                      (typeof isStorePickupAvailable === 'function' && isStorePickupAvailable(d)) ||
                      localStorage.getItem('uberCartIsDiscount') === 'true' ||
                      diningMode === 'PICKUP'
                  );
                  if (isFreeDeliveryStore) {
                      fareArea.innerHTML = '免運費 🎉';
                      fareArea.style.color = '#d32f2f';
                      fareArea.style.fontWeight = 'bold';
                      fareArea.style.fontSize = '14px';
                      fareArea.style.display = 'block';
                  } else {
                      fareArea.innerHTML = '';
                      fareArea.style.display = 'none';
                  }
              }
          }
      })();

updateCartBadge();
window.scrollTo(0, 0);

if (showSchedModalAfterRender && schedNoticeHtml) {
    const sTitle = (scheduleMode === 'SCHEDULE') ? '⚠️ 請選擇可預約時段' : '店家目前尚未營業';
    showModal(sTitle, '', true, schedNoticeHtml, true, function() {
        handleMainBack();
    });
} else if (window.isGroceryStore) {
    setTimeout(() => {
        if (callSeq !== window._openStoreSeq || !window.currentStoreSchedulable) return;
        openGroceryCheckoutSummary();
    }, 2000);
}

      if (window.isBeverageShop) {

          setupScrollSpy();

      }

    } catch (e) {
      console.error('openStore error:', e);
      if (callSeq === window._openStoreSeq) {
          abortBlockedStoreEntry(
              uuid,
              '無法為您代購',
              '此店家目前尚未營業或無法載入菜單，請選擇其他店家或稍候再試！',
              resultsDiv,
              oldHtml
          );
      }
    } finally {
      if (callSeq === window._openStoreSeq) {
          window._openStoreInFlight = false;
          if (typeof setOpenStoreShield === 'function') setOpenStoreShield(false);
          window._loadingModalLock = false;
      }
    }

  }

  

  function quickSetSchedule(startTimeSeconds, storeUuid, encodedStoreName, actionUrl, customStartMin, customEndMin) {
    window.errorModalCloseCallback = null;
    document.getElementById('errorModalOverlay').style.display='none';
    window.mustSelectScheduleBeforeCheckout = false;
    
    // Switch to SCHEDULE mode
    scheduleMode = 'SCHEDULE';
    const targetDate = new Date(startTimeSeconds * 1000);
    const targetDateStr = targetDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
    
    const modalDateSelect = document.getElementById('modalDateSelect');
    if (modalDateSelect) {
        const dateIdx = Array.from(modalDateSelect.options).findIndex(o => o.value === targetDateStr);
        if (dateIdx !== -1) {
            modalDateSelect.selectedIndex = dateIdx;
            renderModalTimes();
        }
    }
    
    const scheduleSelect = document.getElementById('scheduleTime');
    const modalTimeSelect = document.getElementById('modalTimeSelect');
    
    // 若時段區間不是預設 30 分鐘 (例如生鮮雜貨 60 分鐘區間 600~660)
    if (customStartMin !== undefined && customEndMin !== undefined && (customEndMin - customStartMin) !== 30) {
        const startH = Math.floor(customStartMin / 60);
        const startM = customStartMin % 60;
        const endH = Math.floor(customEndMin / 60);
        const endM = customEndMin % 60;
        const sAmpm = startH >= 12 ? '下午' : '上午';
        const eAmpm = endH >= 12 ? '下午' : '上午';
        const sH12 = startH % 12 || 12;
        const eH12 = endH % 12 || 12;
        const sMM = String(startM).padStart(2, '0');
        const eMM = String(endM).padStart(2, '0');
        const emoji = typeof getTimeEmoji === 'function' ? getTimeEmoji(startH) : '📅';
        
        let customTitle = '';
        if (sAmpm === eAmpm) {
            customTitle = `${emoji} ${sAmpm} ${sH12}:${sMM} - ${eH12}:${eMM}`;
        } else {
            customTitle = `${emoji} ${sAmpm} ${sH12}:${sMM} - ${getTimeEmoji(endH)} ${eAmpm} ${eH12}:${eMM}`;
        }
        
        const isGr = window.isGroceryStore || (typeof currentVertical !== 'undefined' && currentVertical === 'SHOP');
        const isThreeHour = ((customEndMin - customStartMin) === 180);
        let disc = 0;
        if (isGr) {
            disc = isThreeHour ? 25 : 0;
        } else {
            const diffMinutes = (startTimeSeconds * 1000 - Date.now()) / 60000;
            disc = (diffMinutes >= 179) ? 10 : 5;
        }
        const discStr = (disc > 0) ? ` (-$${disc})` : '';
        
        const optVal = JSON.stringify({
            date: targetDateStr,
            startTime: customStartMin,
            endTime: customEndMin,
            title: customTitle,
            discount: disc
        });
        
        if (scheduleSelect) {
            scheduleSelect.innerHTML = '';
            const newOpt = document.createElement('option');
            newOpt.value = optVal;
            newOpt.text = `${customTitle}${discStr}`;
            scheduleSelect.appendChild(newOpt);
        }
        
        if (modalTimeSelect) {
            let found = false;
            for (let i = 0; i < modalTimeSelect.options.length; i++) {
                try {
                    const parsed = JSON.parse(modalTimeSelect.options[i].value);
                    if (parsed.date === targetDateStr && parsed.startTime === customStartMin && parsed.endTime === customEndMin) {
                        modalTimeSelect.selectedIndex = i;
                        found = true;
                        break;
                    }
                } catch(e) {}
            }
            if (!found) {
                const modalOpt = document.createElement('option');
                modalOpt.value = optVal;
                modalOpt.text = `${customTitle}${discStr}`;
                if (disc > 0) {
                    modalOpt.style.color = '#e11d48';
                    modalOpt.style.fontWeight = 'bold';
                }
                modalTimeSelect.insertBefore(modalOpt, modalTimeSelect.firstChild);
                modalTimeSelect.selectedIndex = 0;
            }
        }
        
        updateTriggerText();
        closeTimePickerModal();
    } else {
        // 標準 30 分鐘時段配對
        let found = false;
        if (modalTimeSelect) {
            for (let i = 0; i < modalTimeSelect.options.length; i++) {
                let optTime = 0;
                try {
                    const parsed = JSON.parse(modalTimeSelect.options[i].value);
                    const baseDate = new Date(parsed.date + "T00:00:00+08:00");
                    optTime = baseDate.getTime() + (parsed.startTime * 60 * 1000);
                } catch(e) {
                    optTime = new Date(modalTimeSelect.options[i].value).getTime();
                }
                
                if (Math.abs(optTime - targetDate.getTime()) < 60000) {
                    modalTimeSelect.selectedIndex = i;
                    found = true;
                    break;
                }
            }
        }
        if (!found) {
            const sd = targetDate;
            const ed = new Date((startTimeSeconds + 1800) * 1000);
            const fallbackStartMin = (customStartMin !== undefined && customEndMin !== undefined && customEndMin > customStartMin)
                ? customStartMin
                : (sd.getHours() * 60 + sd.getMinutes());
            const fallbackEndMin = (customStartMin !== undefined && customEndMin !== undefined && customEndMin > customStartMin)
                ? customEndMin
                : (fallbackStartMin + 30);
            const startH = Math.floor(fallbackStartMin / 60);
            const startM = fallbackStartMin % 60;
            const endH = Math.floor(fallbackEndMin / 60);
            const endM = fallbackEndMin % 60;
            const sAmpm = startH >= 12 ? '下午' : '上午';
            const eAmpm = endH >= 12 ? '下午' : '上午';
            const sH12 = startH % 12 || 12;
            const eH12 = endH % 12 || 12;
            const sMM = String(startM).padStart(2, '0');
            const eMM = String(endM).padStart(2, '0');
            const emoji = typeof getTimeEmoji === 'function' ? getTimeEmoji(startH) : '📅';
            const customTitle = (sAmpm === eAmpm)
                ? `${emoji} ${sAmpm} ${sH12}:${sMM} - ${eH12}:${eMM}`
                : `${emoji} ${sAmpm} ${sH12}:${sMM} - ${typeof getTimeEmoji === 'function' ? getTimeEmoji(endH) : '📅'} ${eAmpm} ${eH12}:${eMM}`;
            const diffMinutes = (startTimeSeconds * 1000 - Date.now()) / 60000;
            const isGr = window.isGroceryStore || (typeof currentVertical !== 'undefined' && currentVertical === 'SHOP');
            const disc = isGr ? 0 : ((diffMinutes >= 179) ? 10 : 5);
            const discStr = (disc > 0) ? ` (-$${disc})` : '';
            const optVal = JSON.stringify({
                date: targetDateStr,
                startTime: fallbackStartMin,
                endTime: fallbackEndMin,
                title: customTitle,
                discount: disc
            });
            if (modalTimeSelect) {
                const modalOpt = document.createElement('option');
                modalOpt.value = optVal;
                modalOpt.text = `${customTitle}${discStr}`;
                modalTimeSelect.insertBefore(modalOpt, modalTimeSelect.firstChild);
                modalTimeSelect.selectedIndex = 0;
                found = true;
            } else if (scheduleSelect) {
                scheduleSelect.innerHTML = '';
                const newOpt = document.createElement('option');
                newOpt.value = optVal;
                newOpt.text = `${customTitle}${discStr}`;
                scheduleSelect.appendChild(newOpt);
            }
        }
        confirmTimePicker('SCHEDULE');
    }
    
    // Re-open the store with the new time
    if (encodedStoreName) {
        setTimeout(() => { openStore(storeUuid, decodeURIComponent(encodedStoreName), actionUrl, true); }, 50);
    } else if (storeUuid) {
        const storeEl = document.getElementById(`card_${storeUuid}`);
        if (storeEl) {
            // Need a small timeout to let confirmTimePicker finish updating state
            setTimeout(() => { storeEl.click(); }, 50);
        }
    }
  }

  function quickSetScheduleAndProceed(startTimeSeconds, storeUuid, encodedStoreName, actionUrl, customStartMin, customEndMin) {
    quickSetSchedule(startTimeSeconds, storeUuid, encodedStoreName, actionUrl, customStartMin, customEndMin);
    window.mustSelectScheduleBeforeCheckout = false;
    setTimeout(() => {
        if (window.isGroceryStore && typeof openGroceryCheckoutSummary === 'function') {
            openGroceryCheckoutSummary();
        } else if (typeof openCheckoutSummary === 'function') {
            openCheckoutSummary();
        }
    }, 150);
  }

  function showScheduleSelectModalForClosedStore() {
    if (typeof showStoreScheduleModal === 'function') {
        showStoreScheduleModal({ isCheckout: true });
    }
  }



  function getTimeEmoji(hour) {

    if (hour >= 6 && hour < 12) return '🌅'; // 06:00 ~ 11:59

    if (hour >= 12 && hour < 17) return '☀️'; // 12:00 ~ 16:59

    if (hour >= 17 && hour < 23) return '🌙'; // 17:00 ~ 22:59

    return '💤'; // 23:00 ~ 05:59

}

function escapeHTML(str) {

    return String(str).replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

function normalizeAddress(addr) {
  if (!addr) return addr;
  return addr.replace(/([零一二三四五六七八九十百]+)(號|樓)/g, function(match, numStr, suffix) {
    let map = {'零':0, '一':1, '二':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9};
    if (!/十|百/.test(numStr) && numStr.length > 1) {
      return numStr.split('').map(c => map[c]).join('') + suffix;
    }
    let num = 0, temp = 0, unit = {'十':10, '百':100};
    if (numStr === '十') return '10' + suffix;
    let current = 0;
    for (let i = 0; i < numStr.length; i++) {
      let char = numStr[i];
      if (map[char] !== undefined) {
        current = map[char];
        if (i === numStr.length - 1) temp += current;
      } else if (unit[char] !== undefined) {
        if (current === 0 && char === '十') current = 1; 
        temp += current * unit[char];
        current = 0;
        if (char === '百') { num += temp; temp = 0; }
      }
    }
    num += temp;
    if (num > 0) return num + suffix;
    return match;
  });
}

