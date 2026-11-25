  // ================= 8 縣市限定 D 券判定邏輯 =================
  const RE_D_COUNTIES = /(?:苗栗[縣县]?|彰化[縣县市]?|南投[縣县市]?|嘉義[縣县市]?|雲林[縣县]?|云林[縣县]?|[台臺]南[縣县市]?|屏東[縣县市]?|屏东[縣县市]?|宜蘭[縣县市]?|宜兰[縣县市]?)/;
  const D_TOWNSHIPS = [
      "頭份", "竹南", "後龍", "通霄", "苑裡", "卓蘭", "造橋", "三灣", "南庄", "頭屋", "獅潭", "公館", "銅鑼", "三義", "西湖", "大湖", "泰安",
      "鹿港", "和美", "北斗", "員林", "溪湖", "田中", "二林", "線西", "伸港", "福興", "秀水", "花壇", "芬園", "大村", "埔鹽", "埔心", "永靖", "社頭", "二水", "田尾", "埤頭", "芳苑", "大城", "竹塘", "溪州",
      "埔里", "草屯", "竹山", "集集", "名間", "鹿谷", "中寮", "魚池", "國姓", "水里", "信義", "仁愛",
      "太保", "朴子", "布袋", "大林", "民雄", "溪口", "新港", "六腳", "東石", "義竹", "鹿草", "水上", "中埔", "竹崎", "梅山", "番路", "大埔", "阿里山",
      "斗六", "斗南", "虎尾", "西螺", "土庫", "北港", "古坑", "大埤", "莿桐", "林內", "二崙", "崙背", "麥寮", "東勢", "褒忠", "臺西", "台西", "元長", "四湖", "口湖", "水林",
      "新營", "鹽水", "白河", "柳營", "後壁", "東山", "麻豆", "下營", "六甲", "官田", "大內", "佳里", "學甲", "西港", "七股", "將軍", "北門", "新化", "善化", "新市", "安定", "山上", "玉井", "楠西", "南化", "左鎮", "仁德", "歸仁", "關廟", "龍崎", "永康",
      "潮州", "東港", "恆春", "萬丹", "長治", "麟洛", "九如", "里港", "鹽埔", "高樹", "萬巒", "內埔", "竹田", "新埤", "枋寮", "新園", "崁頂", "林邊", "南州", "佳冬", "琉球", "車城", "滿州", "枋山", "三地門", "霧臺", "霧台", "瑪家", "泰武", "來義", "春日", "獅子", "牡丹",
      "羅東", "蘇澳", "頭城", "礁溪", "壯圍", "員山", "冬山", "五結", "三星", "大同", "南澳"
  ];

  function isAddressEligibleForCouponD(address) {
      if (!address || typeof address !== 'string') return false;
      let cleaned = address.trim().replace(/^\d{3,5}\s*/, '');
      if (cleaned.includes('台灣') || cleaned.includes('臺灣')) {
          cleaned = cleaned.replace(/^.*?臺?灣省?/, '');
      }
      if (RE_D_COUNTIES.test(cleaned)) return true;
      for (const t of D_TOWNSHIPS) {
          if (cleaned.startsWith(t)) return true;
      }
      return false;
  }

  function updateDCountyNoticeBadge(addr) {
      const badge = document.getElementById('dCountyNoticeBadge');
      if (!badge) return;
      if (isAddressEligibleForCouponD(addr)) {
          badge.style.display = 'flex';
      } else {
          badge.style.display = 'none';
      }
  }

  function handleAddrInput() {

    isAddressSet = false;

    updateAddrTitleState('default');
    updateDCountyNoticeBadge(document.getElementById('addrInput')?.value);

    

    clearTimeout(window.addrDebounceTimer);

    window.addrDebounceTimer = setTimeout(() => {

      handleAddrBlur();

    }, 2000);

  }



  function handleAddrBlur() {

    scrollAddrToEnd();

    clearTimeout(window.addrDebounceTimer);

    const q = document.getElementById('addrInput').value.trim();
    updateDCountyNoticeBadge(q);

    if (q) {

      searchAddress(false);

    }

  }





  function formatNominatimAddress(item) {

      if (item.address) {

          const ad = item.address;

          const city = ad.city || ad.county || ad.state || '';

          const district = ad.city_district || ad.town || ad.village || ad.suburb || ad.district || ad.borough || '';

          const road = ad.road || ad.pedestrian || ad.street || '';

          const house = ad.house_number || '';

          if (city || district || road) {

              return `${city}${district}${road}${house}`;

          }

      }

      return item.display_name.split(',')[0];

  }



  async function searchAddress(force = false) {

    let q = document.getElementById('addrInput').value.trim();

    if (!force && q === window.lastSearchedAddr) return;

    window.lastSearchedAddr = q;



    if (q.startsWith('📍 ')) q = q.substring(3).trim();

    if (!q) { updateAddrTitleState('default'); return; }









    

    // Check if it's already in history to skip server searching
    // [修補] 超過 7 天的歷史地址視為過時，強制重新查詢座標
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    const matchedHistory = addressHistory.find(item => item.title === q);

    if (matchedHistory && matchedHistory.savedAt && (Date.now() - matchedHistory.savedAt) < SEVEN_DAYS_MS) {

      setAddress(matchedHistory.lat, matchedHistory.lng, matchedHistory.title);

      return;

    }

    

    const statusEl = document.getElementById('addrStatus');

    const resultsEl = document.getElementById('addrResults');

    statusEl.innerText = ''; 

    resultsEl.innerHTML = '';



    const fallbackSearch = async () => {

    try {

        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=tw&q=${encodeURIComponent(q)}&accept-language=zh-TW&addressdetails=1`);

        const data = await res.json();

        if (data.length === 0) {
            // Ultimate fallback to app.py parse_map_url
            try {
                const mapUrl = 'https://www.google.com/maps/search/' + encodeURIComponent(q);
                const googleRes = await fetch(`${API_BASE_URL}/api/parse_map_url`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: mapUrl })
                });
                const googleData = await googleRes.json();
                if (googleData.lat && googleData.lng) {
                    setAddress(googleData.lat, googleData.lng, q);
                    return;
                }
            } catch (err) {
                console.error('Google fallback failed', err);
            }
            
            statusEl.innerText = '找不到地址'; showModal('找不到地址', '系統無法解析您輸入的地址，請嘗試輸入不同的關鍵字或更完整的門牌號碼。');
            if (document.getElementById('fullScreenLoader')) document.getElementById('fullScreenLoader').style.display = 'none';
            return;
        }

        if (data.length === 1) {

            setAddress(data[0].lat, data[0].lon, formatNominatimAddress(data[0]));

        } else {

            if (document.getElementById('fullScreenLoader')) document.getElementById('fullScreenLoader').style.display = 'none';
            statusEl.innerText = '請選擇精確地址：';

            resultsEl.innerHTML = data.slice(0, 5).map(item => {

                const formatted = formatNominatimAddress(item);

                return `<div class="addr-item" onclick="setAddress(${item.lat}, ${item.lon}, '${escapeHTML(formatted)}')">

                    ${escapeHTML(formatted)}

                </div>`;

            }).join('');

        }

    } catch (e) {

        statusEl.innerText = '搜尋地址發生錯誤'; showModal('代訂睡覺中', '等睡醒就會恢復正常', false, '', true);

        updateAddrTitleState('error');
        if (document.getElementById('fullScreenLoader')) document.getElementById('fullScreenLoader').style.display = 'none';

        if (document.getElementById('fullScreenLoader')) document.getElementById('fullScreenLoader').style.display = 'none';

    }

    if (btn2) { btn2.disabled = false; btn2.style.opacity = '1'; btn2.style.cursor = 'pointer'; }

    };

    // 前端防呆：如果字串是以「路、街、巷、弄、段」結尾，代表 100% 沒有門牌號碼

    if (/[\u8def\u8857\u5df7\u5f04\u6bb5]$/.test(q)) {

        document.getElementById('addrStatus').innerText = '地址無效'; showModal('地址無效', '請輸入包含「門牌號碼」的完整地址，不能僅輸入到路名');

        updateAddrTitleState('error');
        if (document.getElementById('fullScreenLoader')) document.getElementById('fullScreenLoader').style.display = 'none';

        document.getElementById('addrResults').innerHTML = '';

        const btn = document.getElementById('searchAddrBtn');

        const btn2 = document.getElementById('searchStoresBtn');

        btn.disabled = false;

        if (btn2) { btn2.disabled = false; btn2.style.opacity = '1'; btn2.style.cursor = 'pointer'; }

        return;

    }

    // 前端防呆2：如果有「號」但是沒有「縣市」或「行政區」，代表是極度容易定位錯亂的殘缺地址
    if (q.includes('號') && !/(市|縣|區|鄉|鎮)/.test(q)) {
        document.getElementById('addrStatus').innerText = '地址不完整'; showModal('地址不完整', '請加上「縣市」或「區域」\n(例如: 桃園市八德區' + q + ')\n以免定位到其他縣市而產生額外費用');
        updateAddrTitleState('error');
        if (document.getElementById('fullScreenLoader')) document.getElementById('fullScreenLoader').style.display = 'none';
        document.getElementById('addrResults').innerHTML = '';
        const btn = document.getElementById('searchAddrBtn');
        const btn2 = document.getElementById('searchStoresBtn');
        if(btn) if(btn) btn.disabled = false;
        if (btn2) { btn2.disabled = false; btn2.style.opacity = '1'; btn2.style.cursor = 'pointer'; }
        return;
    }



    

    try {

      // 先使用 Nominatim 進行「模糊地址」過濾（防止只輸入台北市、南屯區）

      try {

          const nomRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=tw&q=${encodeURIComponent(q)}&accept-language=zh-TW&addressdetails=1`);

          const nomData = await nomRes.json();

          if (nomData.length > 0) {

              const bestMatch = nomData[0];

              if (bestMatch.class === 'boundary' || bestMatch.type === 'administrative' || bestMatch.class === 'highway') {

                  document.getElementById('addrStatus').innerText = '無效區域範圍'; showModal('無效區域範圍', '您輸入的地址範圍過大。\n請輸入包含「門牌號碼」的完整地址\n(例: 臺北市中正區重慶南路一段122號)\n或具體地標 (例: 台北車站)');

                  updateAddrTitleState('error');
        if (document.getElementById('fullScreenLoader')) document.getElementById('fullScreenLoader').style.display = 'none';

                  document.getElementById('addrResults').innerHTML = '';

                  const btn = document.getElementById('searchAddrBtn');

                  const btn2 = document.getElementById('searchStoresBtn');

                  btn.disabled = false;

                  if (btn2) { btn2.disabled = false; btn2.style.opacity = '1'; btn2.style.cursor = 'pointer'; }

                  return;

              }

          }

      } catch(e) {} // 如果 Nominatim 掛掉，就直接放行給 Google WS

      

      const ws = new WebSocket(WS_URL);

      let resolved = false;

      

      const timeoutId = setTimeout(() => {

        if (!resolved) {

          resolved = true;

          ws.close();

          fallbackSearch();

        }

      }, 15000);



      ws.onerror = () => {

        if (!resolved) {

          resolved = true;

          clearTimeout(timeoutId);

          ws.close();

          fallbackSearch();

        }

      };

      ws.onclose = () => {

        if (!resolved) {

          resolved = true;

          clearTimeout(timeoutId);

          fallbackSearch();

        }

      };

      ws.onopen = () => {

        console.log('Sending search request to server WS:', WS_URL);

        ws.send(JSON.stringify({ type: 'search_address', address: q }));

      };



      ws.onmessage = (event) => {

        if (resolved) return;

        const data = JSON.parse(event.data);

        if (data.type === 'search_address_result') {

          resolved = true;

          clearTimeout(timeoutId);

          ws.close();

          if (data.success && data.lat && data.lng) {

            setAddress(data.lat, data.lng, q);

          } else {

            fallbackSearch();

          }

        }

      };



      // [修補] 移除重複的 ws.onerror（已在上方定義過）

    } catch (e) { 

        fallbackSearch();

    }

  }



  async function setAddress(lat, lng, title, placeId) {
    if (placeId) {
      window.currentPlaceId = placeId;
      try { localStorage.setItem('finddog_current_place_id', placeId); } catch(e){}
    } else {
      window.currentPlaceId = '';
      try { localStorage.removeItem('finddog_current_place_id'); } catch(e){}
    }
    const statusEl = document.getElementById('addrStatus');

    statusEl.innerText = ''; 

    document.getElementById('addrResults').innerHTML = '';

    let displayTitle = title.split(',')[0];

    if (displayTitle.startsWith('📍 ')) displayTitle = displayTitle.substring(3).trim();

    document.getElementById('addrInput').value = displayTitle;

    scrollAddrToEnd();

    // [修補] 先暫存舊座標，等 API 確認成功後才真正更新
    const prevLat = currentLat;
    const prevLng = currentLng;
    const prevTitle = currentAddrTitle;

    currentLat = lat;

    currentLng = lng;

    currentAddrTitle = displayTitle;

    try {

      const res = await fetch(`${API_BASE_URL}/api/set-address`, {

        method: 'POST', headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({ lat, lng, title })

      });

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

      if (json.status === 'success') {

          // 不顯示成功訊息，讓使用者感覺無縫銜接

          isAddressSet = true;
          
          // [優化] 當切換地址時，清除搜尋快取，強制下次搜尋重新抓取新地址的店家資料
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

          if (document.getElementById('fullScreenLoader')) document.getElementById('fullScreenLoader').style.display = 'none';
          revealSubSections();
          saveAddressHistory(lat, lng, title, placeId);
          if (typeof restorePrefsForAddress === 'function') {
              restorePrefsForAddress(displayTitle);
          }

        updateAddrTitleState('ok');
        fetchDeliveryTimes();

      } else {

          // [修補] API 失敗，還原座標
          currentLat = prevLat;
          currentLng = prevLng;
          currentAddrTitle = prevTitle;

          statusEl.innerText = '設定地址失敗'; showModal('設定地址失敗', json.message);

        updateAddrTitleState('error');
        if (document.getElementById('fullScreenLoader')) document.getElementById('fullScreenLoader').style.display = 'none';

      }

    } catch (e) { 

        // [修補] 連線失敗，還原座標
        currentLat = prevLat;
        currentLng = prevLng;
        currentAddrTitle = prevTitle;

        statusEl.innerText = '連線伺服器失敗'; showModal('代訂睡覺中', '等睡醒就會恢復正常', false, '', true);

      updateAddrTitleState('error');
        if (document.getElementById('fullScreenLoader')) document.getElementById('fullScreenLoader').style.display = 'none'; 

    }

  }





  var currentVertical = (typeof currentVertical !== 'undefined' ? currentVertical : (window.currentVertical || 'RESTAURANTS'));
window.currentVertical = currentVertical;

  
  function handleHeroClick(mode) {
  if (typeof autoFixEmptyTime === "function") autoFixEmptyTime();
      let q = document.getElementById('addrInput').value.trim();
      if (q.startsWith('📍 ')) q = q.substring(3).trim();
      if (!q) {
          showModal('請輸入地址', '請先輸入外送地址，以便為您推薦附近的美食與店家！');
          document.getElementById('addrInput').focus();
          return;
      }
      
      if (mode === 'SHOP' && currentVertical === 'RESTAURANTS') {
          toggleVertical();
      } else if (mode === 'RESTAURANTS' && currentVertical === 'SHOP') {
          toggleVertical();
      }
      
      // 顯示全螢幕讀取畫面
      const loader = document.getElementById('fullScreenLoader');
      if (loader) {
          loader.style.display = 'flex';
          window.isHeroClicked = true; // 標記是點擊按鈕進來的
      }
      
      // 如果地址已經設定好且一致，直接進入
      if (isAddressSet && currentAddrTitle === formatNominatimAddress({lat: 0, lon: 0, display_name: q}) || (isAddressSet && q === window.lastSearchedAddr)) {
          if (loader) loader.style.display = 'none';
          revealSubSections();
          return;
      }
      
      searchAddress(true);
  }

  function switchVertical(mode) {
      if (mode && currentVertical === mode) return;
      currentVertical = mode ? mode : (currentVertical === 'RESTAURANTS' ? 'SHOP' : 'RESTAURANTS');
      window.currentVertical = currentVertical;
      
      const btnShop = document.getElementById('verticalBtnShop');
      const btnShopMob = document.getElementById('verticalBtnShopMobile');
      const btnRest = document.getElementById('verticalBtnRest');
      const btnRestMob = document.getElementById('verticalBtnRestMobile');
      
      if (currentVertical === 'SHOP') {
          if (btnShop) btnShop.className = 'active';
          if (btnRest) btnRest.className = 'inactive';
          if (btnShopMob) btnShopMob.className = 'active';
          if (btnRestMob) btnRestMob.className = 'inactive';
      } else {
          if (btnShop) btnShop.className = 'inactive';
          if (btnRest) btnRest.className = 'active';
          if (btnShopMob) btnShopMob.className = 'inactive';
          if (btnRestMob) btnRestMob.className = 'active';
      }
      
      const queryInput = document.getElementById('query');
      const queryInputMob = document.getElementById('globalSearchInputMobile');
      const searchBtn = document.getElementById('searchMainBtn');
      const searchBtnMob = document.getElementById('searchMainBtnMobile');

      if (currentVertical === 'SHOP') {
          if (btnShop) { btnShop.style.background = '#fff'; btnShop.style.color = '#10b981'; btnShop.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; }
          if (btnShopMob) { btnShopMob.style.background = '#fff'; btnShopMob.style.color = '#10b981'; btnShopMob.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; }
          if (btnRest) { btnRest.style.background = 'transparent'; btnRest.style.color = '#999'; btnRest.style.boxShadow = 'none'; }
          if (btnRestMob) { btnRestMob.style.background = 'transparent'; btnRestMob.style.color = '#999'; btnRestMob.style.boxShadow = 'none'; }
          
          const ph = '想買什麼？ (例如: 大全聯)';
          if (queryInput) queryInput.placeholder = ph;
          if (queryInputMob) queryInputMob.placeholder = ph;
          const sTxt = '尋找生鮮';
          if (searchBtn) { searchBtn.innerText = sTxt; searchBtn.style.background = '#10b981'; }
          if (searchBtnMob) { searchBtnMob.innerText = sTxt; searchBtnMob.style.background = '#10b981'; }
      } else {
          currentVertical = 'RESTAURANTS';
          if (btnRest) { btnRest.style.background = '#fff'; btnRest.style.color = '#f43f5e'; btnRest.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; }
          if (btnRestMob) { btnRestMob.style.background = '#fff'; btnRestMob.style.color = '#f43f5e'; btnRestMob.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; }
          if (btnShop) { btnShop.style.background = 'transparent'; btnShop.style.color = '#999'; btnShop.style.boxShadow = 'none'; }
          if (btnShopMob) { btnShopMob.style.background = 'transparent'; btnShopMob.style.color = '#999'; btnShopMob.style.boxShadow = 'none'; }
          
          const ph = '想吃什麼？ (例如: 麥當勞)';
          if (queryInput) queryInput.placeholder = ph;
          if (queryInputMob) queryInputMob.placeholder = ph;
          const sTxt = '尋找食物';
          if (searchBtn) { searchBtn.innerText = sTxt; searchBtn.style.background = '#f43f5e'; }
          if (searchBtnMob) { searchBtnMob.innerText = sTxt; searchBtnMob.style.background = '#f43f5e'; }
      }
      
      window.suggestionStores = [];
      window.suggestionStoreQuery = "";
      window.suggestionStoreSource = "";
      window.suggestionScheduleKey = "";
      if (typeof lastSearchedVertical !== 'undefined') lastSearchedVertical = "";

      const overlay = document.getElementById('globalSearchOverlay');
      if (overlay && overlay.style.display !== 'none') {
          if (typeof updateQueryOverlay === 'function') updateQueryOverlay();
      }
  }

  window.switchVertical = switchVertical;
  window.toggleVertical = toggleVertical;
  function toggleVertical() {
      switchVertical(currentVertical === 'RESTAURANTS' ? 'SHOP' : 'RESTAURANTS');
  }







  function randomSearch() {
    if (typeof autoFixEmptyTime === "function") autoFixEmptyTime();

    const foodKeywords = ['飯', '麵', '火鍋', '便當', '炸', '烤', '滷', '焗', '飲料', '牛肉麵', '水餃', '咖哩', '小吃', '早午餐', '漢堡', '披薩', '健康', '沙拉', '甜點', '宵夜'];
    const shopKeywords = ['全聯', '家樂福', '美廉社', '大潤發', '統一超商', '全家', '超市', '屈臣氏', '康是美', '生鮮', '零食'];
    const pool = (typeof currentVertical !== 'undefined' && currentVertical === 'SHOP') ? shopKeywords : foodKeywords;
    const randomWord = pool[Math.floor(Math.random() * pool.length)];

    document.getElementById('query').value = randomWord;
    const mobileInputEl = document.getElementById('globalSearchInputMobile');
    if (mobileInputEl) mobileInputEl.value = randomWord;

    window._isRandomOrEmptySearch = true;

    searchStores();
  }







  function getUberWebpUrl(originalUrl) {

    if (!originalUrl || !originalUrl.startsWith('http')) return originalUrl;

    if (originalUrl.includes('image-proc/resize')) return originalUrl;

    try {

        const b64 = btoa(originalUrl);

        return `https://cn-geo1.uber.com/image-proc/resize/eats/format=webp/width=550/height=440/quality=70/srcb64=${b64}`;

    } catch(e) {

        return originalUrl;

    }

}




  function getCurrentSearchScheduleKey() {
      const mode = typeof scheduleMode !== 'undefined' ? scheduleMode : 'ASAP';
      const ts = document.getElementById('scheduleTime');
      const val = (mode === 'SCHEDULE' && ts && ts.value) ? ts.value : '';
      const vert = typeof currentVertical !== 'undefined' ? currentVertical : 'RESTAURANTS';
      const lat = typeof currentLat !== 'undefined' ? currentLat : '';
      const lng = typeof currentLng !== 'undefined' ? currentLng : '';
      return `${mode}|${val}|${vert}|${lat}|${lng}`;
  }
  window.getCurrentSearchScheduleKey = getCurrentSearchScheduleKey;

  function parseStoreListCardState(s, unSchedulableStores, currentVert) {
      let imgUrl = '';
      if (s.image && s.image.items && s.image.items.length > 0) {
          let bestItem = s.image.items[s.image.items.length - 1];
          for (let img of s.image.items) {
              if (img.width >= 400 && img.width <= 800) { bestItem = img; break; }
          }
          imgUrl = getUberWebpUrl(bestItem.url);
      } else if (s.heroImageUrl) {
          imgUrl = s.heroImageUrl;
      }

      const rating = s.rating ? s.rating.text : '無評價';
      const rawName = s.title ? (s.title.text || (typeof s.title === 'string' ? s.title : '')) : '未知餐廳';
      let name = rawName;
      if (currentVert === 'SHOP') {
          if (name.includes('優市')) {
              name += ' (免外送費、免服務費)';
          } else {
              name += ' (不需外送費、需要服務費)';
          }
      }

      let isClosed = false;
      const storePayloadState = s.tracking && s.tracking.storePayload ? s.tracking.storePayload.storeAvailablityState : '';
      if (storePayloadState === 'STORE_CLOSED') {
          isClosed = true;
      } else if (s.imageOverlay && (s.imageOverlay.text === 'Closed' || s.imageOverlay.text === '已關閉' || s.imageOverlay.badgeType === 'StoreNotOrderable' || s.imageOverlay.badgeType === 'STORE_NOT_ORDERABLE')) {
          isClosed = true;
      }

      let metaText = '';
      if (s.meta && s.meta.length > 0) {
          const closedEta = s.meta.find(m => m.badgeType === 'CLOSED_ETA');
          const openEta = s.meta.find(m => m.badgeType === 'ETD');

          if (closedEta && closedEta.text) {
              isClosed = true;
              let txt = closedEta.text.trim();
              if (txt === 'Schedule ahead' || txt === '提前安排' || txt === '可預約') {
                  metaText = '可預約';
              } else if (txt.startsWith('Available in ') && txt.endsWith(' min')) {
                  const mins = txt.replace('Available in ', '').replace(' min', '');
                  metaText = `${mins}分鐘後營業 (可預約)`;
              } else if (txt.startsWith('Available at ')) {
                  const time = txt.replace('Available at ', '');
                  metaText = `${time}營業 (可預約)`;
              } else if (txt.includes('營業')) {
                  metaText = txt.includes('可預約') ? txt : `${txt} (可預約)`;
              } else {
                  metaText = `${txt} (可預約)`;
              }
          } else if (openEta) {
              if (openEta.accessibilityText && (openEta.accessibilityText.includes('Delivered in') || openEta.accessibilityText.includes('分鐘內送達'))) {
                  const match = openEta.accessibilityText.match(/(\d+)\s*(?:to|到)\s*(\d+)/);
                  if (match) {
                      metaText = `預計 ${match[1]}~${match[2]} 分鐘`;
                  } else {
                      metaText = openEta.text ? openEta.text.replace('min', '分鐘') : '';
                  }
              } else if (openEta.text) {
                  metaText = openEta.text.replace('min', '分鐘');
              }
          }
      }

      const uuid = s.storeUuid || s.uuid || '';
      const isBad = Array.isArray(unSchedulableStores) && uuid && unSchedulableStores.includes(uuid);
      const isPickup = (s._isPickupDiscount === true) && !(typeof isStorePickupExcluded === 'function' && (isStorePickupExcluded(name) || isStorePickupExcluded(s)));

      let etdText = '';
      const metaSource = s._pickupMeta || s.meta;
      if (metaSource && Array.isArray(metaSource)) {
          const etdMeta = metaSource.find(m => m.badgeType === 'ETD');
          if (etdMeta) {
              if (etdMeta.accessibilityText) {
                  const match = etdMeta.accessibilityText.match(/(\d+)\s*(?:to|到)\s*(\d+)/);
                  if (match) {
                      etdText = `${match[1]}-${match[2]} 分鐘`;
                  } else {
                      etdText = etdMeta.accessibilityText;
                  }
              } else if (etdMeta.text) {
                  etdText = etdMeta.text.replace('min', '分鐘');
              }
          }
      }
      if (!etdText && metaText) {
          etdText = metaText.replace('預計 ', '');
      }
      if (!etdText) {
          etdText = '免運專區';
      }

      return {
          uuid,
          rawName,
          name,
          rating,
          imgUrl,
          isClosed,
          metaText,
          isBad,
          isPickup,
          etdText
      };
  }
  window.parseStoreListCardState = parseStoreListCardState;

function generateStoreListHTML(stores, q, currentVertical) {
    // 過濾掉未經完整 API 驗證的建議店家資訊 (避免無營業與預約狀態之店家出現在列表)
    stores = (stores || []).filter(s => !s.isSuggestionStore);
    const statusEl = document.getElementById('status');

    // 全新智能排序：嚴格依照「關聯度」與「營業狀態」進行排序

      const searchQ = q.toLowerCase();

      let openStrong = [], closedStrong = [];
      let openWeak = [], closedWeak = [];
      let openNone = [], closedNone = [];

      const stage1Stores = stores.filter(s => !s._fromPickupSupplement);
      const stage2Stores = stores.filter(s => s._fromPickupSupplement);

      stage1Stores.forEach(s => {
          const name = (s.title && s.title.text) ? s.title.text.toLowerCase() : (typeof s.title === 'string' ? s.title.toLowerCase() : '');
          const state = s.storeAvailablityState || '';
          
          let isUIClosed = false;
          if (state.includes('CLOSED')) isUIClosed = true;
          if (s.tracking && s.tracking.storePayload && s.tracking.storePayload.storeAvailablityState && s.tracking.storePayload.storeAvailablityState.includes('CLOSED')) isUIClosed = true;
          if (s.imageOverlay && s.imageOverlay.text === 'Closed') isUIClosed = true;
                if (s.meta && s.meta.some(m => m.badgeType === 'CLOSED_ETA')) isUIClosed = true;
          if (s.meta && s.meta.some(m => m.badgeType === 'CLOSED_ETA')) isUIClosed = true;
          const isCompletelyClosed = isUIClosed || state === 'STORE_OFFLINE' || state === 'STORE_UNAVAILABLE';

          const isStrongMatch = searchQ && (name.startsWith(searchQ) || name === searchQ);
          const isWeakMatch = searchQ && name.includes(searchQ) && !isStrongMatch;

          if (isStrongMatch) {
              if (!isCompletelyClosed) openStrong.push(s);
              else closedStrong.push(s);
          } else if (isWeakMatch) {
              if (!isCompletelyClosed) openWeak.push(s);
              else closedWeak.push(s);
          } else {
              if (!isCompletelyClosed) openNone.push(s);
              else closedNone.push(s);
          }
      });

      let finalList = [];
      
      // 1. 強符合 (有開)
      finalList = finalList.concat(openStrong);
      // 2. 強符合 (沒開) - 客人精確搜尋的店，就算沒開也要優先顯示給他看
      finalList = finalList.concat(closedStrong);
      // 3. 弱符合 (有開)
      finalList = finalList.concat(openWeak);
      // 4. 弱符合 (沒開)
      finalList = finalList.concat(closedWeak);
      // 5. 無關聯 (有開) - Uber亂塞的廣告店家，至少有開
      finalList = finalList.concat(openNone);
      // 6. 無關聯 (沒開) - 垃圾桶墊底
      finalList = finalList.concat(closedNone);

      if (stage2Stores.length > 0) {
          finalList = finalList.concat(stage2Stores);
      }

      // ⭐【依使用者要求】：從第 4 個開始強制優先排序能自取店家，自取店家全部排完後，才把剩下的店家排列在後面
      if (finalList.length > 3) {
          const top3 = finalList.slice(0, 3);
          const rest = finalList.slice(3);
          const isPickupStore = (s) => {
              if (!s) return false;
              const sTitle = (s.title && s.title.text) ? s.title.text : (s.title || s.name || '');
              if (typeof isStorePickupExcluded === 'function' && isStorePickupExcluded(sTitle)) return false;
              return Boolean(s._isPickupDiscount === true || s.storeCanPickup === true);
          };
          const pickupRest = rest.filter(s => isPickupStore(s));
          const nonPickupRest = rest.filter(s => !isPickupStore(s));
          finalList = [...top3, ...pickupRest, ...nonPickupRest];
      }

      stores.length = 0; finalList.forEach(x => stores.push(x));



      if (stores.length === 0) { 
          if(statusEl) {
              const keyword = (q || '').trim();
              const safeKw = typeof escapeHTML === 'function' ? escapeHTML(keyword) : keyword;
              let t = currentVertical === 'SHOP'
                  ? (keyword ? `找不到與${safeKw}相關的店家。` : '找不到相關生鮮雜貨。')
                  : (keyword ? `找不到與${safeKw}相關的餐廳。` : '找不到相關餐廳。');
              if (currentVertical === 'SHOP' && typeof scheduleMode !== 'undefined' && scheduleMode === 'SCHEDULE') {
                  t += `<div style="font-size:14px; margin-top:5px;"><span style="color:#d81b43;">(未顯示代表無法預約)</span> <a href="javascript:void(0);" onclick="if(typeof confirmTimePicker==='function') confirmTimePicker('ASAP');" style="color:#f43f5e; text-decoration:underline; font-weight:bold; margin-left:5px;">切換成立刻再搜尋一次?</a></div>`;
              }
              statusEl.innerHTML = t;
          }
          return '<div style="padding:40px 20px;text-align:center;color:#999;">找不到相關結果。</div>'; 
      }

      const unSchedulableStores = JSON.parse(localStorage.getItem('unSchedulableStores') || '[]');

      if(statusEl) {
          const keyword = (q || '').trim();
          const safeKw = typeof escapeHTML === 'function' ? escapeHTML(keyword) : keyword;
          let t = currentVertical === 'SHOP'
              ? (keyword ? `找到與${safeKw}相關的店家：` : `為您找到 ${stores.length} 家生鮮雜貨：`)
              : (keyword ? `找到與${safeKw}相關的餐廳：` : `為您找到 ${stores.length} 家餐廳：`);
          if (currentVertical === 'SHOP' && typeof scheduleMode !== 'undefined' && scheduleMode === 'SCHEDULE') {
              t += `<div style="font-size:14px; margin-top:5px;"><span style="color:#d81b43;">(未顯示代表無法預約)</span> <a href="javascript:void(0);" onclick="if(typeof confirmTimePicker==='function') confirmTimePicker('ASAP');" style="color:#f43f5e; text-decoration:underline; font-weight:bold; margin-left:5px;">切換成立刻再搜尋一次?</a></div>`;
          }
          if (currentVertical !== 'SHOP') {
              const safeQ = (q || '').replace(/'/g, "\\\'").replace(/"/g, '&quot;');
              t = `<div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                     <div>${t}</div>
                     <button onclick="searchStoresPickup('${safeQ}')" style="background:#ff9800; color:#fff; border:none; padding:5px 12px; border-radius:15px; font-weight:bold; cursor:pointer; font-size:13px; margin-left:10px; flex-shrink:0;">前往免運專區</button>
                   </div>`;
          }
          statusEl.innerHTML = t;
      }

      return stores.map(s => {
        const cardState = parseStoreListCardState(s, unSchedulableStores, (typeof currentVertical !== 'undefined' ? currentVertical : 'RESTAURANTS'));
        const { imgUrl, rating, name, isClosed, metaText, isBad, isPickup, etdText } = cardState;

        // 加上 grayscale 讓圖片反灰
        const style = (isBad || isClosed) ? 'filter: grayscale(100%); opacity: 0.85;' : '';

        let overlayHtml = '';
        if (isClosed && !isBad) {
            const closedNotice = (metaText && metaText.includes('營業')) ? metaText : '休息中可預約';
            overlayHtml = `<div style="position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); color:#fff; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:bold; letter-spacing:1px; z-index:2; text-align:center; padding:10px;">${escapeHTML(closedNotice)}</div>`;
        } else if (isBad) {
            overlayHtml = `<div style="position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.55); color:#fff; display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:bold; letter-spacing:1px; z-index:2;">無法接單</div>`;
        }

        let etaBadgeHtml = '';
        let freeDeliveryBadge = '';

        if (isPickup) {
            // 左上增加綠色字 免運費
            freeDeliveryBadge = `<div style="position:absolute; top:8px; left:8px; background:rgba(0,0,0,0.75); color:#00cc66; padding:6px 14px; border-radius:20px; font-size:20px; font-weight:bold; letter-spacing:0.5px; z-index:3; box-shadow:0 2px 6px rgba(0,0,0,0.3);">免運費</div>`;
            // 右上按照優惠專區格式 (顯示抵達時間)
            etaBadgeHtml = `<div style="position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.75); color:#fff; padding:6px 14px; border-radius:20px; font-size:20px; font-weight:bold; letter-spacing:0.5px; z-index:3; box-shadow:0 2px 6px rgba(0,0,0,0.3);">${escapeHTML(etdText)}</div>`;
        } else {
            if (metaText && !isClosed && !isBad) {
                etaBadgeHtml = `<div style="position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.75); color:#fff; padding:6px 14px; border-radius:20px; font-size:20px; font-weight:bold; letter-spacing:0.5px; z-index:3; display:flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgba(0,0,0,0.3);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-top:-1px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>${escapeHTML(metaText.replace('預計 ', ''))}</div>`;
            }
        }

        let metaDisplay = `⭐ ${escapeHTML(rating)}`;
        if (isPickup) {
            metaDisplay += ` &nbsp;|&nbsp; <span style="color:#ff9800; font-weight:bold;">免運專區外送加成$0</span>`;
        } else if (metaText) {
            metaDisplay += ` &nbsp;|&nbsp; <span style="color:#e67e22; font-weight:bold;">${escapeHTML(metaText)}</span>`;
        }

        const safeMetaText = (metaText || '').replace(/'/g, "\\'");
        const safeEtdText = (etdText || metaText || '免運專區').replace(/'/g, "\\'");
        const cardOnclick = isPickup
            ? `localStorage.setItem('uberCartIsDiscount', 'true'); openStore('${s.storeUuid}', decodeURIComponent('${encodeURIComponent(name).replace(/'/g, "%27")}'), '${s.actionUrl || ''}', false, 'DELIVERY', '${safeEtdText}')`
            : `localStorage.setItem('uberCartIsDiscount', 'false'); openStore('${s.storeUuid}', decodeURIComponent('${encodeURIComponent(name).replace(/'/g, "%27")}'), '${s.actionUrl || ''}', false, 'DELIVERY', '${safeMetaText}')`;

        return `
          <div id="card_${s.storeUuid}" class="card" onclick="${cardOnclick}">
            <div class="card-img" style="position:relative; overflow:hidden; ${style}">
                ${imgUrl ? `<img src="${imgUrl}" loading="lazy" style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; z-index:0;" />` : ''}
                ${freeDeliveryBadge}
                ${etaBadgeHtml}
                <div style="position:relative; z-index:1; width:100%; height:100%;">

                    ${overlayHtml}

                </div>

            </div>

            <div class="card-body">

              <div class="card-name">${escapeHTML(name)}</div>

              <div class="card-meta">${metaDisplay}</div>

            </div>

          </div>

        `;

      }).join('');
}


// [全聯判定] 排除「大全聯」等不同實體，僅辨識真正的全聯福利中心/門市
function isPxmartName(name) {
    if (!name || typeof name !== 'string') return false;
    return name.includes('全聯') && !name.includes('大全聯');
}

// [全聯預約自動轉即時補全] 當生鮮雜貨以預約模式搜尋全聯卻無結果時，背景發起即時搜尋取得全聯店家
async function fetchPxmartAsapStores(q) {
    try {
        const apiBase = typeof API_BASE_URL !== 'undefined' && API_BASE_URL ? API_BASE_URL : '';
        const payload = {
            query: q,
            lat: currentLat,
            lng: currentLng,
            vertical: 'SHOP',
            searchSource: 'SEARCH_SUGGESTION',
            searchType: 'GLOBAL_SEARCH',
            date: "",
            startTime: 0,
            endTime: 0
        };
        const res = await fetch(`${apiBase}/api/search_v3`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) return [];
        const json = await res.json();
        if (json.status === 'failure' || !json.data) return [];
        let asapStores = [];
        (json.data.feedItems || []).forEach(item => {
            if ((item.type === 'REGULAR_STORE' || item.type === 'REGULAR_STORE_WITH_ITEMS') && item.store) {
                asapStores.push(item.store);
            } else if ((item.type === 'REGULAR_CAROUSEL' || item.type === 'STORE_CAROUSEL') && item.carousel && item.carousel.stores) {
                asapStores.push(...item.carousel.stores);
            } else if (item.type === 'MINI_STORE_WITH_ITEMS' && item.miniStoreWithItems && item.miniStoreWithItems.store) {
                asapStores.push(item.miniStoreWithItems.store);
            }
        });
        const seen = new Set();
        return asapStores.filter(s => {
            const sName = s.title && s.title.text ? s.title.text : (typeof s.title === 'string' ? s.title : '');
            if (!isPxmartName(sName)) return false;
            if (seen.has(s.storeUuid)) return false;
            seen.add(s.storeUuid);
            if (s.imageOverlayCallToAction && s.imageOverlayCallToAction.text && s.imageOverlayCallToAction.text.includes('自取')) return false;
            if (s.storeAvailablityState === 'TOO_FAR_TO_DELIVER') return false;
            if (s.tracking && s.tracking.storePayload && s.tracking.storePayload.storeAvailablityState === 'TOO_FAR_TO_DELIVER') return false;
            return true;
        });
    } catch (e) {
        console.error('fetchPxmartAsapStores error:', e);
        return [];
    }
}

window._pickupSearchToken = 0;

async function fetchPickupDiscountStores(q) {
    if (!isAddressSet) return [];
    try {
        const searchPayload = { 
            query: q, 
            lat: currentLat,
            lng: currentLng,
            vertical: 'RESTAURANTS',
            searchSource: 'SEARCH_SUGGESTION',
            searchType: 'GLOBAL_SEARCH',
            mapContext: {
                northEast: { latitude: currentLat + 0.09, longitude: currentLng + 0.09 },
                southWest: { latitude: currentLat - 0.09, longitude: currentLng - 0.09 }
            },
            diningMode: 'PICKUP'
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

        const apiBase = typeof API_BASE_URL !== 'undefined' && API_BASE_URL ? API_BASE_URL : '';
        const res = await fetch(`${apiBase}/api/search_v4`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(searchPayload)
        });

        const textRes = await res.text();
        const json = JSON.parse(textRes);

        if (!res.ok || json.status === 'failure') { 
            return [];
        }

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

        const getDist = (s) => {
            if (s.location && s.location.distanceToUser) return s.location.distanceToUser;
            if (s.meta && Array.isArray(s.meta)) {
                const distMeta = s.meta.find(m => m.badgeType === 'DISTANCE');
                if (distMeta && distMeta.text) {
                    const match = distMeta.text.match(/[\d.]+/);
                    if (match) return parseFloat(match[0]);
                }
            }
            return 99999;
        };

        stores = stores.filter(s => {
            if (getDist(s) > 5.0) return false;
            const sTitle = (s.title && s.title.text) ? s.title.text : (s.title || s.name || '');
            if (typeof isStorePickupExcluded === 'function' && isStorePickupExcluded(sTitle)) return false;
            return true;
        });
        stores.sort((a, b) => getDist(a) - getDist(b));

        if (q) {
            const qLower = q.toLowerCase();
            const exactMatches = stores.filter(s => s.title && s.title.text && s.title.text.toLowerCase().includes(qLower));
            const others = stores.filter(s => !(s.title && s.title.text && s.title.text.toLowerCase().includes(qLower)));
            stores = [...exactMatches, ...others];
        }

        return stores;
    } catch (e) {
        console.warn('fetchPickupDiscountStores error:', e);
        return [];
    }
}

window._activeSearchSession = {
    token: 0,
    query: '',
    vertical: '',
    deliveryStores: null,
    pickupStores: null
};

function applyPickupDiscountToStores(deliveryStores, pickupStores) {
    if (!deliveryStores || deliveryStores.length === 0) {
        if (!pickupStores || pickupStores.length === 0) return [];
        return pickupStores.map(ps => {
            ps._isPickupDiscount = true;
            ps._fromPickupSupplement = true;
            ps._pickupMeta = ps.meta;
            return ps;
        });
    }
    if (!pickupStores || pickupStores.length === 0) {
        return deliveryStores;
    }

    const pickupMap = new Map();
    pickupStores.forEach(ps => {
        if (ps && ps.storeUuid) pickupMap.set(ps.storeUuid, ps);
    });

    const existingUuids = new Set();
    const merged = [];

    // 1. 保留原本 deliveryStores 順序，若在 PICKUP 中存在且非排除店家，加上免運標籤與資訊
    deliveryStores.forEach(s => {
        if (!s || !s.storeUuid) return;
        existingUuids.add(s.storeUuid);
        if (pickupMap.has(s.storeUuid)) {
            const isEx = typeof isStorePickupExcluded === 'function' && isStorePickupExcluded(s);
            if (!isEx) {
                s._isPickupDiscount = true;
                const ps = pickupMap.get(s.storeUuid);
                if (ps.meta && Array.isArray(ps.meta)) {
                    s._pickupMeta = ps.meta;
                }
            }
        }
        merged.push(s);
    });

    // 2. 將 PICKUP 有但 deliveryStores 沒有的店家穿插追加在後面 (排除店家不追加免運)
    pickupStores.forEach(ps => {
        if (!ps || !ps.storeUuid) return;
        if (typeof isStorePickupExcluded === 'function' && isStorePickupExcluded(ps)) {
            return;
        }
        if (!existingUuids.has(ps.storeUuid)) {
            existingUuids.add(ps.storeUuid);
            ps._isPickupDiscount = true;
            ps._fromPickupSupplement = true;
            ps._pickupMeta = ps.meta;
            merged.push(ps);
        }
    });

    return merged;
}

async function triggerPickupSupplement(query, currentStores, vertical, sessionToken) {
    const currentToken = sessionToken || ++window._pickupSearchToken;
    try {
        const pickupStores = await fetchPickupDiscountStores(query);
        if (currentToken !== window._activeSearchSession.token && currentToken !== window._pickupSearchToken) return;
        if (!pickupStores || pickupStores.length === 0) return;

        window._activeSearchSession.pickupStores = pickupStores;

        const baseStores = (window._activeSearchSession.deliveryStores && window._activeSearchSession.deliveryStores.length > 0)
            ? window._activeSearchSession.deliveryStores
            : (currentStores || []);

        const merged = applyPickupDiscountToStores(baseStores, pickupStores);
        window.suggestionStores = merged;

        // 重新渲染列表（保持當前畫面捲動位置，不晃動跳轉）
        const resultsEl = document.getElementById('results');
        if (resultsEl) {
            const currentScroll = window.scrollY;
            resultsEl.innerHTML = generateStoreListHTML(merged, query, vertical);
            window.scrollTo(0, currentScroll);
        }
    } catch (err) {
        console.warn('triggerPickupSupplement error:', err);
    }
}

async function searchStores() {
    window.isDiscountZone = false;

    // 清除任何打字殘留的背景 suggestion 計時器與請求，防止慢速請求覆蓋搜尋結果
    if (typeof queryDebounceTimer !== 'undefined') clearTimeout(queryDebounceTimer);
    if (typeof latestStoreSuggestionsReqId !== 'undefined') latestStoreSuggestionsReqId++;
    if (typeof isFetchingSuggestions !== 'undefined') isFetchingSuggestions = false;

    // [修補] 防止搜尋按鈕被連按，導致重複輪詢與浪費 Token
    if (window._searchLock) return;
    
    // [優化] 執行完整搜尋時，確保自動關閉搜尋面板，讓用戶能看到下方的搜尋結果
    if (typeof closeQueryOverlay === 'function') {
        closeQueryOverlay();
    }

    if (!isAddressSet) {

      const addrVal = document.getElementById('addrInput').value.trim();

      if (addrVal) {

          showModal('自動定位中', '', false, '<div class="spinner" style="margin: 0 auto; width: 30px; height: 30px; border-width: 3px; border-top-color: #f43f5e;"></div><div style="margin-top: 15px; text-align: center;">正在為您確認地址，請稍候...</div>', true);

          window._searchLock = true; // [修補] 上鎖

          searchAddress(true);

          

          let attempts = 0;

          const checkInterval = setInterval(() => {

              attempts++;

              const statusText = document.getElementById('addrStatus').innerText;

              const resultsHtml = document.getElementById('addrResults').innerHTML;

              

              if (isAddressSet) {

                  clearInterval(checkInterval);

                  document.getElementById('errorModalOverlay').style.display = 'none';

                  window._searchLock = false; // [修補] 解鎖

                  searchStores();

              } else if (resultsHtml !== '' || (statusText !== '' && statusText !== '尋找中...')) {

                  clearInterval(checkInterval);

                  document.getElementById('errorModalOverlay').style.display = 'none';

                  window._searchLock = false; // [修補] 解鎖

                  if (statusText !== '' && statusText !== '尋找中...' && !statusText.includes('請選擇')) {

                      showModal('地址無效', statusText, true);

                  }

              } else if (attempts > 30) {

                  clearInterval(checkInterval);

                  document.getElementById('errorModalOverlay').style.display = 'none';

                  window._searchLock = false; // [修補] 解鎖

                  showModal('地址設定逾時', '無法自動確認地址，請檢查地址是否正確。');

              }

          }, 500);

          return;

      }

      showModal('請先設定外送地址', '在尋找食物之前，請務必先輸入並點擊「尋找地址」，以便系統準確計算外送範圍與營業時間！');

      return;

    }

    
    // 等待時段讀取完成
    if (scheduleMode === 'SCHEDULE' && isDeliveryTimesLoading) {
        showModal('讀取時段中', '', false, '<div class="spinner" style="margin: 0 auto; width: 30px; height: 30px; border-width: 3px; border-top-color: #f43f5e;"></div><div style="margin-top: 15px; text-align: center;">正在向 Uber 取得預約時段，請稍候...</div>', true);
        onDeliveryTimesLoadedCallback = () => {
            document.getElementById('errorModalOverlay').style.display = 'none';
            window._searchLock = false;
            searchStores();
        };
        return;
    }

    let q = document.getElementById('query').value.trim();
    // 清除可能殘留的注音符號 (例如打字時未選字按出的 ㄨ、ㄅ 等)
    q = q.replace(/[\u3105-\u312f\u31a0-\u31bf\u02ca\u02c7\u02cb\u02d9]/g, '').trim();
    document.getElementById('query').value = q;
    const mobileInputEl = document.getElementById('globalSearchInputMobile');
    if (mobileInputEl) mobileInputEl.value = q;

    

    // 尋找食物留空時不自動填入任何文字，保持空白直接送出搜尋
    if (!q) {
        window._isRandomOrEmptySearch = false;
    } else if (!window._isRandomOrEmptySearch) {
        window._isRandomOrEmptySearch = false;
    }

    window.lastListSearchKeyword = q;

    

    if (q && !window._isRandomOrEmptySearch) {

      saveSimpleHistory('query');

    }

    

    // 切換到 ListView

    currentView = 'list';

    const mbBtn = document.getElementById('mainBackBtn') || document.getElementById('heroBackBtn');
    if (mbBtn) mbBtn.style.visibility = 'visible';

    const ssBtn = document.getElementById('storeSearchBtn');
    if (ssBtn) ssBtn.style.display = 'block';

    document.getElementById('homeView').style.display = 'none';

    document.getElementById('storeView').style.display = 'none';

    document.getElementById('listView').style.display = 'block';



    const statusEl = document.getElementById('status');

    const resultsEl = document.getElementById('results');

    statusEl.innerHTML = '<div style="padding: 100px 0; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;"><div class="spinner" style="margin: 0 auto;"></div><div style="margin-top: 15px; font-size: 16px; font-weight: bold; color: #666;">搜尋中...</div></div>'; statusEl.className = 'status'; resultsEl.innerHTML = '';
    
        const currentVert = typeof currentVertical !== 'undefined' ? currentVertical : 'RESTAURANTS';
    const sessionToken = ++window._pickupSearchToken;
    window._activeSearchSession = {
        token: sessionToken,
        query: q,
        vertical: currentVert,
        deliveryStores: null,
        pickupStores: null
    };

    // [優化] 如果關鍵字與剛剛自動搜尋的關鍵字完全相同 (且分類相同)，且資料已下載完畢，直接使用快取不需重發 API
    const currentSearchSchedKey = (typeof getCurrentSearchScheduleKey === 'function') ? getCurrentSearchScheduleKey() : '';
    // [方案 A 保險機制] 僅限同一時段已執行過完整 search_v4 + 免運補齊 (search_v4_full) 時才允許快取，首頁預選項點擊一律重新執行完整搜尋
    if (q === lastSearchedQuery && currentVert === (typeof lastSearchedVertical !== 'undefined' ? lastSearchedVertical : '') && typeof isFetchingSuggestions !== 'undefined' && !isFetchingSuggestions && window.suggestionStores && window.suggestionStores.length > 0 && window.suggestionStoreSource === 'search_v4_full' && window.suggestionScheduleKey === currentSearchSchedKey) {
        const keyword = (q || '').trim();
        const safeKw = typeof escapeHTML === 'function' ? escapeHTML(keyword) : keyword;
        statusEl.innerHTML = ((typeof currentVertical !== 'undefined' && currentVertical === 'SHOP')
            ? (keyword ? `找到與${safeKw}相關的店家：` : `為您找到 ${window.suggestionStores.length} 家生鮮雜貨：`)
            : (keyword ? `找到與${safeKw}相關的餐廳：` : `為您找到 ${window.suggestionStores.length} 家餐廳：`));
        statusEl.className = 'status success';
        window._activeSearchSession.deliveryStores = window.suggestionStores;
        resultsEl.innerHTML = generateStoreListHTML(window.suggestionStores, q, currentVert);
        window.scrollTo(0, 0);
        if (currentVert !== 'SHOP') {
            triggerPickupSupplement(q, window.suggestionStores, currentVert, sessionToken);
        }
        return;
    }

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

      // ⭐【原子性並行：同時發送 DELIVERY 與 PICKUP，齊備後一次性渲染到位，杜絕中間無標籤狀態】
      const pickupPromise = (currentVert !== 'SHOP') ? fetchPickupDiscountStores(q).catch(() => []) : Promise.resolve([]);
      
      const deliveryPromise = (async () => {
          const res = await fetch(`${API_BASE_URL}/api/search_v4`, {
              method: 'POST', 
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(searchPayload)
          });
          const textRes = await res.text();
          return JSON.parse(textRes);
      })();

      const [pickupStores, json] = await Promise.all([pickupPromise, deliveryPromise]);

      if (window._activeSearchSession.token !== sessionToken) return;

      if (!json || json.status === 'failure' || !json.data) {
          statusEl.innerHTML = '搜尋失敗';
          return;
      }

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

      window._activeSearchSession.deliveryStores = stores;
      window._activeSearchSession.pickupStores = pickupStores || [];

      // ⭐ 一次性安全合併免運資訊
      let finalStores = stores;
      if (pickupStores && pickupStores.length > 0) {
          finalStores = applyPickupDiscountToStores(stores, pickupStores);
      }

      const hasFirstResults = (window.suggestionStoreQuery === q && window.suggestionStores && window.suggestionStores.length > 0 && window.suggestionStoreSource === 'search_v4_full' && window.suggestionScheduleKey === currentSearchSchedKey);
      if (finalStores.length > 0) {
          window.suggestionStores = finalStores;
          window.suggestionStoreSource = 'search_v4_full';
          window.suggestionStoreQuery = q;
          window.suggestionScheduleKey = currentSearchSchedKey;
      } else if (hasFirstResults) {
          finalStores = window.suggestionStores;
      } else {
          window.suggestionStores = [];
          window.suggestionStoreSource = 'search_v4_empty';
          window.suggestionStoreQuery = q;
          window.suggestionScheduleKey = currentSearchSchedKey;
      }
      if (typeof lastSearchedQuery !== 'undefined') {
          lastSearchedQuery = q;
      } else {
          window.lastSearchedQuery = q;
      }
      if (typeof lastSearchedVertical !== 'undefined') {
          lastSearchedVertical = currentVert;
      } else {
          window.lastSearchedVertical = currentVert;
      }

      // ⭐ 只渲染一次！第一瞬間就是帶有免運費標籤與抵達時間的完整狀態，絕不閃退
      resultsEl.innerHTML = generateStoreListHTML(finalStores, q, typeof currentVertical !== 'undefined' ? currentVertical : 'RESTAURANTS');
      window.scrollTo(0, 0); // 確保每次搜尋完成後，畫面回到最上方優先顯示第一個結果

      // [全聯預約自動轉即時補全] 針對生鮮雜貨包含「全聯」關鍵字 (排除「大全聯」)，若預約模式無任何全聯結果 (出現大全聯不算)，自動以即時補搜全聯
      const vertCheck = typeof currentVertical !== 'undefined' ? currentVertical : 'RESTAURANTS';
      if (vertCheck === 'SHOP' && q.includes('全聯') && !q.includes('大全聯') && typeof scheduleMode !== 'undefined' && scheduleMode === 'SCHEDULE') {
          const hasPxmart = stores.some(s => {
              const name = (s.title && s.title.text) ? s.title.text : (typeof s.title === 'string' ? s.title : '');
              return isPxmartName(name);
          });
          if (!hasPxmart) {
              fetchPxmartAsapStores(q).then(pxStores => {
                  if (pxStores && pxStores.length > 0) {
                      const existingUuids = new Set(stores.map(s => s.storeUuid));
                      const newPx = pxStores.filter(ps => !existingUuids.has(ps.storeUuid));
                      if (newPx.length > 0) {
                          stores.push(...newPx);
                          window.suggestionStores = stores;
                          resultsEl.innerHTML = generateStoreListHTML(stores, q, vertCheck);
                      }
                  }
              });
          }
      }
    } catch (err) { statusEl.innerHTML = '錯誤: ' + err.message; } finally { window._searchLock = false; }

  }



  








async function searchStoresPickup(q) {
    window.isDiscountZone = true;
    currentView = "list";
    if (!isAddressSet) return;
    if (typeof closeQueryOverlay === 'function') closeQueryOverlay();
    
    document.getElementById('homeView').style.display = 'none';
    document.getElementById('storeView').style.display = 'none';
    document.getElementById('listView').style.display = 'block';

    const statusEl = document.getElementById('status');
    const resultsEl = document.getElementById('results');
    statusEl.innerHTML = '<div style="padding: 100px 0; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;"><div class="spinner" style="margin: 0 auto;"></div><div style="margin-top: 15px; font-size: 16px; font-weight: bold; color: #666;">搜尋免運餐廳中...</div></div>'; 
    statusEl.className = 'status'; 
    resultsEl.innerHTML = '';

    try {
        const searchPayload = { 
            query: q, 
            lat: currentLat,
            lng: currentLng,
            vertical: 'RESTAURANTS',
            searchSource: 'SEARCH_SUGGESTION',
            searchType: 'GLOBAL_SEARCH',
            mapContext: {
                northEast: { latitude: currentLat + 0.09, longitude: currentLng + 0.09 },
                southWest: { latitude: currentLat - 0.09, longitude: currentLng - 0.09 }
            },
            diningMode: 'PICKUP'
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

        const res = await fetch(`${API_BASE_URL}/api/search_v4`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(searchPayload)
        });

        const textRes = await res.text();
        const json = JSON.parse(textRes);

        if (!res.ok || json.status === 'failure') { 
            statusEl.innerHTML = '搜尋失敗'; 
            return; 
        }

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

        let seen = new Set();
        stores = stores.filter(s => {
            if (seen.has(s.storeUuid)) return false;
            seen.add(s.storeUuid);
            return true;
        });

        const getDist = (s) => {
            if (s.location && s.location.distanceToUser) return s.location.distanceToUser;
            if (s.meta && Array.isArray(s.meta)) {
                const distMeta = s.meta.find(m => m.badgeType === 'DISTANCE');
                if (distMeta && distMeta.text) {
                    const match = distMeta.text.match(/[\d.]+/);
                    if (match) return parseFloat(match[0]);
                }
            }
            return 99999;
        };

        
        stores = stores.filter(s => {
            if (getDist(s) > 5.0) return false;
            const sTitle = (s.title && s.title.text) ? s.title.text : (s.title || s.name || '');
            if (typeof isStorePickupExcluded === 'function' && isStorePickupExcluded(sTitle)) return false;
            return true;
        });
        
        stores.sort((a, b) => {
            return getDist(a) - getDist(b);
        });

        
        if (q) {
            const qLower = q.toLowerCase();
            const exactMatches = stores.filter(s => s.title && s.title.text && s.title.text.toLowerCase().includes(qLower));
            const others = stores.filter(s => !(s.title && s.title.text && s.title.text.toLowerCase().includes(qLower)));
            stores = [...exactMatches, ...others];
        }

        const keyword = (q || '').trim();
        const safeKw = typeof escapeHTML === 'function' ? escapeHTML(keyword) : keyword;
        if (stores.length === 0) {
            statusEl.innerHTML = keyword ? `找不到與${safeKw}有關的免運餐廳。` : '找不到相關免運餐廳。';
            return;
        }

        const safeQ = (q || '').replace(/'/g, "\\\'").replace(/"/g, '&quot;');
        const titleText = keyword ? `與${safeKw}有關的免運餐廳：` : `為您推薦 ${stores.length} 家免運餐廳：`;
        statusEl.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                                <div>${titleText}</div>
                                <button onclick="searchStores()" style="background:#f43f5e; color:#fff; border:none; padding:5px 12px; border-radius:15px; font-weight:bold; cursor:pointer; font-size:13px; margin-left:10px; flex-shrink:0;">回到一般外送</button>
                              </div>`;
        statusEl.className = 'status success';
        
        resultsEl.innerHTML = stores.map(s => {
            let imgUrl = '';
            if (s.image && s.image.items && s.image.items.length > 0) {
                let bestItem = s.image.items[s.image.items.length - 1];
                for (let img of s.image.items) {
                    if (img.width >= 400 && img.width <= 800) { bestItem = img; break; }
                }
                imgUrl = typeof getUberWebpUrl === 'function' ? getUberWebpUrl(bestItem.url) : bestItem.url;
            }
            const name = s.title && s.title.text ? s.title.text : '未知餐廳';
            const actionUrl = s.actionUrl || '';
            const storeUuid = s.storeUuid || '';
            
            let distBadge = '';
            let etdText = '';
            if (s.meta && Array.isArray(s.meta)) {
                const etdMeta = s.meta.find(m => m.badgeType === 'ETD');
                if (etdMeta && etdMeta.accessibilityText) {
                    etdText = etdMeta.accessibilityText;
                } else if (etdMeta && etdMeta.text) {
                    etdText = etdMeta.text;
                }
            }
            if (!etdText) {
                etdText = '免運專區';
            }
            distBadge = `<div style="position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.75); color:#fff; padding:6px 14px; border-radius:20px; font-size:20px; font-weight:bold; letter-spacing:0.5px; z-index:3; box-shadow:0 2px 6px rgba(0,0,0,0.3);">${etdText}</div>`;

            const safeEtdText = (etdText || '').replace(/'/g, "\\'");
            return `
            <div class="card" id="card_${storeUuid}" onclick="localStorage.setItem('uberCartIsDiscount', 'true'); openStore('${storeUuid}', '${name.replace(/'/g, "\\'")}', '${actionUrl}', false, 'DELIVERY', '${safeEtdText}')" style="position:relative;">
                ${distBadge}
                <div style="position:absolute; top:8px; left:8px; background:rgba(0,0,0,0.75); color:#00cc66; padding:6px 14px; border-radius:20px; font-size:20px; font-weight:bold; letter-spacing:0.5px; z-index:3; box-shadow:0 2px 6px rgba(0,0,0,0.3);">免運費</div>
                <div class="card-img" style="background-image: url('${imgUrl}');"></div>
                <div class="card-body">
                  <div class="card-name">${name}</div>
                  <div class="card-meta">
                      <span style="color:#ff9800; font-weight:bold;">免運專區外送加成$0</span>
                  </div>
                </div>
            </div>
            `;
        }).join('');

    } catch (e) {
        console.error('Fetch store pickup error:', e);
        statusEl.innerHTML = '搜尋免運餐廳失敗';
    }
}

function syncStoreSearchInput(val) {
    const headerInput = document.getElementById('storeSearchInput');
    if (headerInput) headerInput.value = val;
}

function toggleStoreSearch() {
  if (typeof currentView !== 'undefined' && currentView === 'list') {
      
      
      if (typeof openQueryOverlay === 'function') {
          openQueryOverlay();
      }
      return;
  }

  const title = document.getElementById('headerTitleText');

  const box = document.getElementById('headerSearchBox');

  const overlay = document.getElementById('storeSearchOverlay');

  const input = document.getElementById('storeSearchInput');

  const results = document.getElementById('storeSearchResults');

  

  const mainBackBtn = document.getElementById('mainBackBtn');

  const searchBtn = document.getElementById('storeSearchBtn');

  

  if (box.style.display === 'none') {

    title.style.display = 'none';

    box.style.display = 'block';

    

    if (currentView === 'store') {

        input.placeholder = "搜尋菜單關鍵字...";

        overlay.style.display = 'flex';
        // Sync and focus the mobile input synchronously so the keyboard pops up immediately
        const mobileInput = document.getElementById('storeSearchInputMobile');
        if (mobileInput) {
            mobileInput.value = '';
            mobileInput.focus();
        }

    } else if (currentView === 'list') {

        const vert = typeof currentVertical !== 'undefined' ? currentVertical : 'RESTAURANTS';
        input.placeholder = vert === 'SHOP' ? '搜尋生鮮...' : '搜尋餐廳...';

        overlay.style.display = 'none';

    }

    

    if (mainBackBtn) {
      mainBackBtn.setAttribute('onclick', 'toggleStoreSearch()');
      mainBackBtn.style.visibility = 'visible';
    }

    if (searchBtn) searchBtn.setAttribute('onclick', 'executeHeaderSearch()');

    input.value = '';
    results.innerHTML = '';

    if (currentView === 'list') {
        handleStoreSearch();
        input.focus();
    }
  } else {
    title.style.display = 'block';
    box.style.display = 'none';
    overlay.style.display = 'none';
    const mobileInput2 = document.getElementById('storeSearchInputMobile');
    if (mobileInput2) mobileInput2.value = '';

    if (mainBackBtn) {
      mainBackBtn.setAttribute('onclick', 'handleMainBack()');
      if (currentView === 'home') mainBackBtn.style.visibility = 'hidden';
    }

    

    if (searchBtn) searchBtn.setAttribute('onclick', 'toggleStoreSearch()');

    

    if (currentView === 'list') {

        input.value = '';

        handleStoreSearch();

    }

  }

}



function triggerListSearch(force = false) {

    if (currentView !== 'list') return;

    clearTimeout(window.listSearchDebounceTimer);

    

    const input = document.getElementById('storeSearchInput');

    const keyword = input.value.trim();

    

    if (keyword === window.lastListSearchKeyword) {

        if (force) input.blur();

        return;

    }

    

    window.lastListSearchKeyword = keyword;

    document.getElementById('query').value = keyword;

    

    if (force) {

        input.blur();

    }

    

    searchStores();

}



function executeHeaderSearch() {

    if (currentView === 'list') {

        triggerListSearch(true);

        toggleStoreSearch();

    } else if (currentView === 'store') {

        document.getElementById('storeSearchInput').blur();

    }

}



function handleStoreSearch(isUserInput = false) {

  // Sync both inputs
  const headerInput = document.getElementById('storeSearchInput');
  const mobileInput = document.getElementById('storeSearchInputMobile');
  const keyword = (mobileInput && mobileInput === document.activeElement ? mobileInput.value : headerInput.value).trim().toLowerCase();
  if (headerInput) headerInput.value = keyword;
  if (mobileInput) mobileInput.value = keyword;

  

  if (currentView === 'list') {

      const cards = document.querySelectorAll('#results .card');

      cards.forEach(card => {

          const name = card.querySelector('.card-name') ? card.querySelector('.card-name').innerText.toLowerCase() : '';

          if (name.includes(keyword)) {

              card.style.display = '';

          } else {

              card.style.display = 'none';

          }

      });

      

            if (isUserInput) {
          clearTimeout(window.listSearchDebounceTimer);
          const prevVal = window._lastStoreSearchValue || '';
          window._lastStoreSearchValue = keyword;
          const diff = Math.abs(keyword.length - prevVal.length);
          const delay = diff > 2 ? 0 : 500;
          
          window.listSearchDebounceTimer = setTimeout(() => {
              triggerListSearch(false);
          }, delay);
      }

      return;

  }

  

  const results = document.getElementById('storeSearchResults');

  

  if (!keyword) {

    results.innerHTML = '';

    return;

  }

  

  if (!window.currentStoreRawData) return;

  const d = window.currentStoreRawData;

  const storeUuid = d.uuid;

  

  let html = '<div class="menu-grid">';

  let found = 0;

  

  if (d.catalogSectionsMap) {

    Object.keys(d.catalogSectionsMap).forEach(key => {

      const sectionArr = d.catalogSectionsMap[key];

      sectionArr.forEach(section => {

        const secUuid = key;

        const subsecUuid = section.catalogSectionUUID || '';

        if (section.payload && section.payload.standardItemsPayload) {

          const items = section.payload.standardItemsPayload.catalogItems || [];

          items.forEach(item => {

            const itemTitle = (typeof filterTrailingEnglish === 'function') ? filterTrailingEnglish(parseText(item.title)) : parseText(item.title) || '';

            const itemDesc = (typeof filterTrailingEnglish === 'function') ? filterTrailingEnglish(parseText(item.itemDescription)) : parseText(item.itemDescription) || '';

            

            if (itemTitle.toLowerCase().includes(keyword) || itemDesc.toLowerCase().includes(keyword)) {

                const priceVal = item.price > 0 ? Math.round(item.price / 100) : 0;

                let priceHtml = priceVal > 0 ? '$' + priceVal : '';

                if (item.priceTagline && item.priceTagline.textFormat) {

                  priceHtml = item.priceTagline.textFormat;

                }

                if (item.isSoldOut) priceHtml = '<span style="color:#d32f2f;">已售完</span>';

                

                const imgUrl = getUberWebpUrl(item.imageUrl || '');

                

                let isPromo = false;
                let promoBadgeHtml = '';

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
                        const txt = elements[0].text.text.text;
                        promoBadgeHtml = `<div style="background-color: #ffe0ea; color: #05944F; padding: 2px 6px; border-radius: 4px; font-size: 11px; display: inline-block; margin-bottom: 4px; font-weight: bold;">${escapeHTML(txt)}</div>`;
                      }
                    }
                    if (!promoBadgeHtml) {
                        promoBadgeHtml = `<div style="background-color: #ffe0ea; color: #05944F; padding: 2px 6px; border-radius: 4px; font-size: 11px; display: inline-block; margin-bottom: 4px; font-weight: bold;">優惠商品</div>`;
                    }
                  }
                } catch(e) {}

                

                found++;

                const isSoldOut = item.isSoldOut === true;
                let itemHtml = '';
                
                if (isPromo) {
                    itemHtml = `
                    <div class="menu-item" style="opacity: 0.6; cursor: not-allowed;">
                      <div class="menu-item-info">
                        ${promoBadgeHtml}
                        <div class="menu-item-title" style="text-decoration: line-through;">${escapeHTML(itemTitle)}</div>
                        <div style="color: #d32f2f; font-size: 12px; font-weight: bold; margin-bottom: 4px;">優惠商品無法訂購</div>
                        <div class="menu-item-desc">${escapeHTML(itemDesc)}</div>
                        <div class="menu-item-price">${priceHtml}</div>
                      </div>
                      ${imgUrl ? `<div class="menu-item-img" style="position:relative; overflow:hidden;"><img src="${imgUrl}" loading="lazy" style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover;" /></div>` : ''}
                    </div>`;
                } else {
                  itemHtml = '<div class="menu-item" style="position: relative;' + (isSoldOut ? ' opacity:0.6; cursor:not-allowed;' : '') + '" ' + (isSoldOut ? '' : 'onclick="toggleStoreSearch(); openItemModal(\'' + storeUuid + '\', \'' + secUuid + '\', \'' + subsecUuid + '\', \'' + item.uuid + '\', \'' + encodeURIComponent(itemTitle).replace(/'/g, "%27") + '\', \'' + encodeURIComponent(itemDesc).replace(/'/g, "%27") + '\', ' + priceVal + ', \'' + imgUrl + '\', ' + (item.hasCustomizations === false ? 'false' : 'true') + ')"') + '>';

                  itemHtml += '<div class="menu-item-info">';

                  if (promoBadgeHtml) itemHtml += promoBadgeHtml;

                  itemHtml += '<div class="menu-item-title">' + escapeHTML(itemTitle) + '</div>';

                  itemHtml += '<div class="menu-item-desc">' + escapeHTML(itemDesc) + '</div>';

                  itemHtml += '<div class="menu-item-price">' + priceHtml + '</div>';

                  itemHtml += '</div>';

                  

                  if (imgUrl) {

                    itemHtml += '<div class="menu-item-img" style="background-image: url(\'' + imgUrl + '\')"></div>';

                  }

                  

                  if (!isSoldOut) {
                      itemHtml += '<div class="item-action-area" id="action-' + item.uuid + '" style="position: absolute; right: 15px; bottom: 15px; background: white; border-radius: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); display: flex; align-items: center; justify-content: center; overflow: hidden;" onclick="event.stopPropagation();">';
                      itemHtml += '<div class="quick-add-btn" onclick="handleQuickAdd(event, \'' + storeUuid + '\', \'' + secUuid + '\', \'' + subsecUuid + '\', \'' + item.uuid + '\', \'' + encodeURIComponent(itemTitle).replace(/'/g, "%27") + '\', \'' + encodeURIComponent(itemDesc).replace(/'/g, "%27") + '\', ' + priceVal + ', \'' + imgUrl + '\', ' + (item.hasCustomizations === false ? 'false' : 'true') + ')" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; cursor: pointer; color: #111;">＋</div>';
                      itemHtml += '</div>';
                  }
                  itemHtml += '</div>';
                }

                html += itemHtml;

            }

          });

        }

      });

    });

  }

  html += '</div>';

  if(found === 0) html = '<div style="text-align:center; padding:30px; color:#666;">找不到符合「' + escapeHTML(keyword) + '」的餐點</div>';

  results.innerHTML = html;
  // Auto-scroll results to bottom so items appear near the input
  results.scrollTop = 0;

  updateMenuActions();

}







// =========================================================
// 多人團購與共用購物車前端核心邏輯 (Group Buy & Shared Cart)
// =========================================================
window.currentGroupBuyId = null;
window.groupBuyData = null;
window.groupBuyAuthed = false;
window.localGroupBuyVersion = 0;
let groupBuySyncInterval = null;

function handleGroupBuyBtnClick() {
    if (window.currentGroupBuyId) {
        openGroupBuyShareModal();
        return;
    }
    openGroupBuyModal();
}

function openGroupBuyModal() {
    const modal = document.getElementById('groupBuyCreateModal');
    const storeInfo = document.getElementById('gbStoreInfoDisplay');
    if (storeInfo) {
        storeInfo.innerHTML = `🏪 團購店家：<strong>${escapeHTML(currentStoreName || '當前店家')}</strong>`;
    }

    // 每次開啟發起彈窗時，自動載入使用者上次修改並儲存在本地的密碼與暱稱（若無則維持預設值）
    const pwdInput = document.getElementById('gbPasswordInput');
    if (pwdInput) {
        const savedPwd = localStorage.getItem('userGroupBuyPassword');
        if (savedPwd !== null && savedPwd.trim() !== '') {
            pwdInput.value = savedPwd;
        }
    }
    const nameInput = document.getElementById('gbCreatorNameInput');
    if (nameInput) {
        const savedName = localStorage.getItem('group_buy_user_name');
        if (savedName !== null && savedName.trim() !== '' && savedName.trim() !== '成員') {
            nameInput.value = savedName;
        }
    }

    if (modal) modal.style.display = 'flex';
}

function closeGroupBuyModal() {
    const modal = document.getElementById('groupBuyCreateModal');
    if (modal) modal.style.display = 'none';
}

function openGroupBuyShareModal() {
    const modal = document.getElementById('groupBuyShareModal');
    const linkInput = document.getElementById('gbShareLinkInput');
    if (linkInput && window.currentGroupBuyId) {
        const origin = window.location.origin.includes('localhost') ? window.location.origin + window.location.pathname : 'https://9ysong.shop/ubereat.html';
        linkInput.value = `${origin}?group_id=${window.currentGroupBuyId}`;
    }
    if (modal) modal.style.display = 'flex';
}

function closeGroupBuyShareModal() {
    const modal = document.getElementById('groupBuyShareModal');
    if (modal) modal.style.display = 'none';
}

function copyGroupBuyShareLink() {
    let link = '';
    const linkInput = document.getElementById('gbShareLinkInput');
    if (linkInput && linkInput.value) {
        link = linkInput.value;
    } else if (window.currentGroupBuyId) {
        const origin = window.location.origin.includes('localhost') ? window.location.origin + window.location.pathname : 'https://9ysong.shop/ubereat.html';
        link = `${origin}?group_id=${window.currentGroupBuyId}`;
    }
    if (!link) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(() => {
            showToast('📋 團購邀請連結已複製！');
        }).catch(() => {
            prompt('請複製以下團購連結發送給好友：', link);
        });
    } else {
        prompt('請複製以下團購連結發送給好友：', link);
    }
}

async function submitCreateGroupBuy() {
    const pwdInput = document.getElementById('gbPasswordInput');
    const nameInput = document.getElementById('gbCreatorNameInput');
    const password = (pwdInput ? pwdInput.value.trim() : '') || '123456';
    const creatorName = (nameInput ? nameInput.value.trim() : '') || '團長';

    // 像備註一樣存於使用者端
    localStorage.setItem('userGroupBuyPassword', password);
    localStorage.setItem('group_buy_user_name', creatorName);
    if (typeof saveSimpleHistory === 'function') {
        saveSimpleHistory('gbPasswordInput');
        saveSimpleHistory('gbCreatorNameInput');
    }

    if (!currentStoreUuid && !currentStoreName) {
        showModal('無法發起團購', '請先進入一家餐廳頁面後再發起團購！');
        return;
    }

    const submitBtn = document.getElementById('gbCreateSubmitBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = '建立中...';
    }

    const apiBase = typeof API_BASE_URL !== 'undefined' && API_BASE_URL ? API_BASE_URL : '';
    try {
        let cAddr = (typeof currentAddrTitle !== 'undefined' && currentAddrTitle) ? currentAddrTitle : '';
        if (!cAddr) {
            const addrEl = document.getElementById('addrInput');
            if (addrEl && addrEl.value) cAddr = addrEl.value.trim().replace(/^📍\s*/, '');
        }
        if (!cAddr) {
            try {
                const hist = JSON.parse(localStorage.getItem('finddog_history_address') || '[]');
                if (hist.length > 0 && hist[0].title) cAddr = hist[0].title.replace(/^📍\s*/, '');
            } catch(e) {}
        }
        let cLat = currentLat;
        let cLng = currentLng;
        if (!cLat || !cLng) {
            try {
                const hist = JSON.parse(localStorage.getItem('finddog_history_address') || '[]');
                if (hist.length > 0 && hist[0].lat && hist[0].lng) {
                    cLat = hist[0].lat;
                    cLng = hist[0].lng;
                }
            } catch(e) {}
        }
        const cPhone = localStorage.getItem('userPhone') || (document.getElementById('checkoutPhone') ? document.getElementById('checkoutPhone').value.trim() : '');
        const cDeliveryNotes = (document.getElementById('deliveryNotes') ? document.getElementById('deliveryNotes').value.trim() : '') || localStorage.getItem('userDeliveryNotes') || '';
        const cDeliveryMethod = (document.getElementById('deliveryMethod') ? document.getElementById('deliveryMethod').value : '') || localStorage.getItem('userDeliveryMethod') || '當面點交';
        const cFoodNotes = (document.getElementById('foodNotes') ? document.getElementById('foodNotes').value.trim() : '') || localStorage.getItem('userFoodNotes') || '';

        const payload = {
            store_uuid: currentStoreUuid,
            store_name: currentStoreName,
            store_url: typeof currentStoreUrl !== 'undefined' ? currentStoreUrl : '',
            address: cAddr,
            lat: cLat || 25.033,
            lng: cLng || 121.565,
            phone: cPhone,
            delivery_notes: cDeliveryNotes,
            delivery_method: cDeliveryMethod,
            food_notes: cFoodNotes,
            password: password,
            creator_name: creatorName,
            device_fp: getGroupBuyDeviceFp(),
            items: (typeof cart !== 'undefined' && Array.isArray(cart)) ? cart.map(it => ({
                ...it,
                user_name: it.user_name || creatorName,
                device_fp: it.device_fp || getGroupBuyDeviceFp()
            })) : []
        };

        const res = await fetch(`${apiBase}/api/group_buy/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (json.status === 'success' && json.group_id) {
            const groupId = json.group_id;
            window.currentGroupBuyId = groupId;
            window.groupBuyData = json.data;
            window.groupBuyAuthed = true;
            window.localGroupBuyVersion = json.data.version || 1;
            cart = json.data.items || [];
            updateCartBadge();
            if (typeof updateMenuActions === 'function') updateMenuActions();

            localStorage.setItem('gb_creator_' + groupId, 'true');
            localStorage.setItem('gb_leader_' + groupId, 'true');
            localStorage.setItem('gb_pwd_' + groupId, password);
            localStorage.setItem('group_buy_user_name', creatorName);

            closeGroupBuyModal();

            const gbBtn = document.getElementById('groupBuyBtn');
            if (gbBtn) {
                gbBtn.innerHTML = '👥 團購中';
                gbBtn.style.background = '#06c167';
            }

            renderGroupBuyTopBar(json.data);
            startGroupBuySync(groupId);
            openGroupBuyShareModal();
            copyGroupBuyShareLink();
        } else {
            showModal('發起團購失敗', json.message || '伺服器異常，請稍後再試！');
        }
    } catch (e) {
        console.error('發起團購錯誤:', e);
        showModal('連線失敗', '發起團購連線失敗，請檢查網路狀態後再試！');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = '🚀 產生團購連結';
        }
    }
}

function renderGroupBuyTopBar(gb) {
    const topBar = document.getElementById('groupBuyTopBar');
    const textEl = document.getElementById('groupBuyTopBarText');
    const storeNavBack = document.getElementById('storeNavBackBtn');
    const isClosed = window.isGroupBuyClosed || (gb && (gb.status === 'submitted' || gb.status === 'closed'));
    if (topBar && textEl) {
        if (isClosed) {
            topBar.style.background = 'linear-gradient(135deg, #475569, #334155)';
            textEl.innerHTML = `👥 團購：${escapeHTML(gb.store_name || currentStoreName)} | 🔒 訂單已送出 (已截止點餐)`;
            const shareBtn = topBar.querySelector('button');
            if (shareBtn) shareBtn.style.display = 'none';
        } else {
            topBar.style.background = 'linear-gradient(135deg, #06c167, #048848)';
            textEl.innerHTML = `👥 多人團購：${escapeHTML(gb.store_name || currentStoreName)} | 團長：${escapeHTML(gb.creator_name || '團長')}`;
            const shareBtn = topBar.querySelector('button');
            if (shareBtn) shareBtn.style.display = 'block';
        }
        topBar.style.display = 'flex';
    }
    if (storeNavBack) {
        storeNavBack.style.display = 'none';
    }
}

function exitGroupBuyToPersonal() {
    window.currentGroupBuyId = null;
    window.groupBuyData = null;
    window.isGroupBuyClosed = false;
    window.groupBuyAuthed = false;
    if (typeof clearCart === 'function') clearCart();
    else {
        cart = [];
        saveCart();
        updateCartBadge();
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('group_id');
    url.searchParams.delete('group');
    window.history.replaceState({}, '', url.toString());
    const topBar = document.getElementById('groupBuyTopBar');
    if (topBar) topBar.style.display = 'none';
    const storeNavBack = document.getElementById('storeNavBackBtn');
    if (storeNavBack) storeNavBack.style.display = 'block';
    if (document.getElementById('errorModalOverlay')) document.getElementById('errorModalOverlay').style.display = 'none';
    showToast('已切換為個人獨立點餐模式');
    if (typeof closeItemModal === 'function') closeItemModal();
    if (currentView === 'cart') goBackToStore();
    else if (typeof updateMenuActions === 'function') updateMenuActions();
}

async function markGroupBuySubmitted(orderText = '') {
    if (!window.currentGroupBuyId) return;
    try {
        const apiBase = typeof API_BASE_URL !== 'undefined' && API_BASE_URL ? API_BASE_URL : '';
        const uName = localStorage.getItem('group_buy_user_name') || '團長';
        const deviceFp = typeof getGroupBuyDeviceFp === 'function' ? getGroupBuyDeviceFp() : '';
        await fetch(`${apiBase}/api/group_buy/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                group_id: window.currentGroupBuyId,
                user_name: uName,
                device_fp: deviceFp,
                order_text: orderText
            })
        });
        window.isGroupBuyClosed = true;
        if (window.groupBuyData) {
            window.groupBuyData.status = 'submitted';
            window.groupBuyData.items = [];
        }
        if (typeof clearCart === 'function') clearCart();
        if (typeof renderGroupBuyTopBar === 'function') renderGroupBuyTopBar(window.groupBuyData || {});
        if (typeof updateMenuActions === 'function') updateMenuActions();
    } catch (e) {
        console.error('[GroupBuy] 標記送出失敗:', e);
    }
}

function getGroupBuyDeviceFp() {
    let fp = localStorage.getItem('group_buy_device_fp');
    if (!fp) {
        fp = 'fp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('group_buy_device_fp', fp);
    }
    return fp;
}

function isGroupBuyLeader() {
    if (!window.currentGroupBuyId) return true;
    if (window.groupBuyAuthed) return true;
    const gid = window.currentGroupBuyId;
    if (localStorage.getItem('gb_creator_' + gid) === 'true') return true;
    if (localStorage.getItem('gb_leader_' + gid) === 'true') return true;
    const myFp = getGroupBuyDeviceFp();
    if (window.groupBuyData?.creator_device_fp && window.groupBuyData.creator_device_fp === myFp) return true;
    if (window.groupBuyData?.authorized_fps && Array.isArray(window.groupBuyData.authorized_fps) && window.groupBuyData.authorized_fps.includes(myFp)) return true;
    return false;
}

function canEditCartItem(targetItem) {
    if (!window.currentGroupBuyId) return true;
    if (isGroupBuyLeader()) return true;
    if (!targetItem) return false;
    const myFp = getGroupBuyDeviceFp();
    if (targetItem.device_fp && targetItem.device_fp === myFp) return true;
    return false;
}

function getOrPromptGroupBuyUserName(forcePrompt = false) {
    let name = localStorage.getItem('group_buy_user_name');
    if (forcePrompt || !name || name.trim() === '' || name === '成員') {
        name = prompt('請輸入您的姓名或暱稱（方便大家在共用購物車辨認餐點）：', (name && name.trim() && name !== '成員') ? name : '');
        if (!name || name.trim() === '') name = '成員';
        name = name.trim();
        localStorage.setItem('group_buy_user_name', name);
        const nameInput = document.getElementById('gbCreatorNameInput');
        if (nameInput && name !== '成員') nameInput.value = name;
        if (typeof saveSimpleHistory === 'function' && name !== '成員') saveSimpleHistory('gbCreatorNameInput');
    }
    return name;
}

function changeGroupBuyUserName() {
    const oldName = localStorage.getItem('group_buy_user_name') || '成員';
    const newName = prompt('請輸入您想顯示的姓名或暱稱：', oldName);
    if (newName && newName.trim()) {
        const trimmed = newName.trim();
        localStorage.setItem('group_buy_user_name', trimmed);
        const nameInput = document.getElementById('gbCreatorNameInput');
        if (nameInput) nameInput.value = trimmed;
        if (typeof saveSimpleHistory === 'function') saveSimpleHistory('gbCreatorNameInput');
        showToast('暱稱已更新為：' + trimmed);
        if (currentView === 'cart') viewCart();
    }
}

function showGroupBuyClosedModal(customMsg = '') {
    window.isGroupBuyClosed = true;
    if (window.groupBuyData) window.groupBuyData.status = 'submitted';
    renderGroupBuyTopBar(window.groupBuyData || {});
    const detailMsg = customMsg || '團長已完成結帳並送出訂單，本團購已截止點餐，無法再增加或修改品項！';
    showModal('🔒 訂單已截止', detailMsg, true, `
        <div style="display:flex; flex-direction:column; gap:10px; margin-top:15px;">
            <button onclick="document.getElementById('errorModalOverlay').style.display='none'; viewCart();" style="width:100%; padding:11px; background:#06c167; color:#fff; border:none; border-radius:10px; font-weight:bold; font-size:15px; cursor:pointer;">👀 查看最終訂單明細</button>
            <button onclick="document.getElementById('errorModalOverlay').style.display='none'; exitGroupBuyToPersonal();" style="width:100%; padding:11px; background:#f43f5e; color:#fff; border:none; border-radius:10px; font-weight:bold; font-size:15px; cursor:pointer;">🛒 我要自己另外點餐</button>
        </div>
    `, true);
    if (typeof closeItemModal === 'function') closeItemModal();
    if (typeof updateMenuActions === 'function') updateMenuActions();
}

async function groupBuySyncCartAction(action, data = {}) {
    if (!window.currentGroupBuyId) return null;
    if (window.isGroupBuyClosed) {
        showGroupBuyClosedModal();
        return null;
    }
    const apiBase = typeof API_BASE_URL !== 'undefined' && API_BASE_URL ? API_BASE_URL : '';
    try {
        const uName = getOrPromptGroupBuyUserName();
        const deviceFp = getGroupBuyDeviceFp();
        const payload = {
            group_id: window.currentGroupBuyId,
            action: action,
            user_name: uName,
            device_fp: deviceFp,
            ...data
        };
        const res = await fetch(`${apiBase}/api/group_buy/cart/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            const json = await res.json();
            if (json.status === 'success') {
                window.localGroupBuyVersion = json.version;
                cart = json.items || [];
                updateCartBadge();
                if (typeof updateMenuActions === 'function') updateMenuActions();
                if (currentView === 'cart') {
                    if (cart.length === 0) {
                        goBackToStore();
                    } else {
                        viewCart();
                    }
                }
                return json;
            }
        } else {
            const errJson = await res.json().catch(() => ({}));
            if (errJson.code === 'GROUP_BUY_CLOSED') {
                showGroupBuyClosedModal(errJson.message);
                if (currentView === 'cart') viewCart();
                return null;
            }
        }
    } catch (e) {
        console.error('團購購物車同步失敗:', e);
    }
    return null;
}

async function syncGroupBuyCart(showFeedback = false, forceRefresh = false) {
    if (!window.currentGroupBuyId) return null;
    if (window._isSyncingGroupBuy) return null;
    window._isSyncingGroupBuy = true;

    const apiBase = typeof API_BASE_URL !== 'undefined' && API_BASE_URL ? API_BASE_URL : '';
    try {
        const v = forceRefresh ? 0 : (window.localGroupBuyVersion || 0);
        const res = await fetch(`${apiBase}/api/group_buy/sync?group_id=${window.currentGroupBuyId}&v=${v}`);
        if (res.ok) {
            const json = await res.json();
            if (json.status === 'success') {
                if (json.changed || forceRefresh) {
                    window.localGroupBuyVersion = json.version;

                    // 偵測到團購已送出結帳
                    if (json.group_status === 'submitted' || json.group_status === 'closed' || (json.last_event && json.last_event.type === 'order_submitted')) {
                        if (typeof clearCart === 'function') clearCart();
                        if (!window.isGroupBuyClosed) {
                            window.isGroupBuyClosed = true;
                            if (window.groupBuyData) {
                                window.groupBuyData.status = 'submitted';
                                window.groupBuyData.items = [];
                            }
                            renderGroupBuyTopBar(window.groupBuyData || {});
                            if (typeof updateMenuActions === 'function') updateMenuActions();
                            const submitMsg = (json.last_event && json.last_event.message) ? json.last_event.message : '團長已完成結帳並送出訂單，團購已截止！';
                            showModal('🎉 團長已送出訂單', submitMsg, false, `
                                <div style="display:flex; flex-direction:column; gap:10px; margin-top:15px;">
                                    <button onclick="document.getElementById('errorModalOverlay').style.display='none'; exitGroupBuyToPersonal();" style="width:100%; padding:11px; background:#f43f5e; color:#fff; border:none; border-radius:10px; font-weight:bold; font-size:15px; cursor:pointer;">🛒 我要自己另外點餐</button>
                                </div>
                            `, true);
                        }
                    } else {
                        cart = json.items || [];
                        updateCartBadge();
                    }

                    if (typeof updateMenuActions === 'function') updateMenuActions();
                    if (currentView === 'cart') {
                        if (cart.length === 0) {
                            goBackToStore();
                        } else {
                            viewCart(true);
                        }
                    }

                    // 根據 last_event 顯示精準廣播通知給其他團員
                    const myName = localStorage.getItem('group_buy_user_name') || '';
                    const evt = json.last_event;
                    if (evt && evt.user_name && evt.user_name !== myName) {
                        if (evt.type === 'remove') {
                            showToast(`🗑️ ${evt.user_name} 刪除了「${evt.item_title}」`);
                        } else if (evt.type === 'add') {
                            showToast(`🛒 ${evt.user_name} 新增了「${evt.item_title}」`);
                        } else if (evt.type === 'update_qty') {
                            const dStr = evt.delta > 0 ? `+${evt.delta}` : `${evt.delta}`;
                            showToast(`✏️ ${evt.user_name} 修改了「${evt.item_title}」數量 (${dStr})`);
                        } else if (evt.type === 'clear') {
                            showToast(`🧹 ${evt.user_name} 清空了團購購物車`);
                        }
                    } else if (showFeedback) {
                        showToast('🔄 團購點餐內容已更新為最新！');
                    }
                } else if (showFeedback) {
                    showToast('✅ 目前點餐內容已是最新！');
                }
                return json;
            }
        }
    } catch (e) {
        console.warn('團購同步失敗:', e);
        if (showFeedback) showToast('⚠️ 團購同步失敗，請檢查網路');
    } finally {
        window._isSyncingGroupBuy = false;
    }
    return null;
}

function startGroupBuySync(groupId) {
    if (groupBuySyncInterval) {
        clearInterval(groupBuySyncInterval);
        groupBuySyncInterval = null;
    }
    // 依指令：取消 2 秒高密集常駐輪詢，改為按需確認。進入團購時僅做單次初始同步
    syncGroupBuyCart(false, true);
}

function showGroupBuyPasswordAuthModal(callback, customTitle, customDesc) {
    window._groupBuyAuthCallback = (typeof callback === 'function') ? callback : null;
    const modal = document.getElementById('groupBuyAuthModal');
    const input = document.getElementById('gbAuthPwdInput');
    const titleEl = document.getElementById('gbAuthModalTitle');
    const descEl = document.getElementById('gbAuthModalDesc');
    if (titleEl) titleEl.innerText = customTitle || '請輸入團購結帳密碼';
    if (descEl) descEl.innerText = customDesc || '此訂單為多人共用購物車，只有持有結帳密碼才能結帳或修改其他成員餐點';
    if (input) {
        const savedPwd = (window.currentGroupBuyId && localStorage.getItem('gb_pwd_' + window.currentGroupBuyId)) || localStorage.getItem('userGroupBuyPassword') || '';
        input.value = savedPwd;
    }
    if (modal) modal.style.display = 'flex';
    setTimeout(() => { if (input) { input.focus(); input.select(); } }, 100);
}

function closeGroupBuyAuthModal() {
    const modal = document.getElementById('groupBuyAuthModal');
    if (modal) modal.style.display = 'none';
}

function cancelGroupBuyAuth() {
    closeGroupBuyAuthModal();
    if (window._groupBuyAuthCallback) {
        const cb = window._groupBuyAuthCallback;
        window._groupBuyAuthCallback = null;
        cb(false);
    } else {
        showModal('權限不足', '參與者沒有權限結帳，需由持有密碼的團長進行結帳。');
    }
}

async function verifyGroupBuyPassword() {
    const input = document.getElementById('gbAuthPwdInput');
    const pwd = input ? input.value.trim() : '';
    if (!pwd) {
        showToast('⚠️ 請輸入團購密碼');
        if (input) input.focus();
        return;
    }
    const apiBase = typeof API_BASE_URL !== 'undefined' && API_BASE_URL ? API_BASE_URL : '';
    try {
        const res = await fetch(`${apiBase}/api/group_buy/verify_password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                group_id: window.currentGroupBuyId,
                password: pwd,
                device_fp: getGroupBuyDeviceFp()
            })
        });
        const json = await res.json();
        if (json.status === 'success' && json.verified) {
            window.groupBuyAuthed = true;
            if (window.currentGroupBuyId) {
                localStorage.setItem('gb_leader_' + window.currentGroupBuyId, 'true');
                localStorage.setItem('gb_pwd_' + window.currentGroupBuyId, pwd);
            }
            localStorage.setItem('userGroupBuyPassword', pwd);
            if (typeof saveSimpleHistory === 'function') saveSimpleHistory('gbPasswordInput');
            closeGroupBuyAuthModal();
            showToast('👑 團長驗證成功！您現在可以修改訂單與結帳');
            if (window._groupBuyAuthCallback) {
                const cb = window._groupBuyAuthCallback;
                window._groupBuyAuthCallback = null;
                cb(true);
            } else {
                openCheckoutSummary();
            }
        } else {
            closeGroupBuyAuthModal();
            showModal('密碼錯誤', '團購密碼錯誤！只有本人或團長可以修改此餐點與進行結帳。');
            if (window._groupBuyAuthCallback) {
                const cb = window._groupBuyAuthCallback;
                window._groupBuyAuthCallback = null;
                cb(false);
            }
        }
    } catch (e) {
        closeGroupBuyAuthModal();
        showModal('連線失敗', '驗證密碼時連線失敗，請檢查網路狀態！');
        if (window._groupBuyAuthCallback) {
            const cb = window._groupBuyAuthCallback;
            window._groupBuyAuthCallback = null;
            cb(false);
        }
    }
}

function handleCartPreviewClick() {
    if (window.isGroupBuyClosed) {
        exitGroupBuyToPersonal();
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
    openCheckoutSummary();
}

async function checkAndInitGroupBuyFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const groupId = urlParams.get('group_id') || urlParams.get('group');
    if (!groupId) return;

    console.log('[GroupBuy] 偵測到團購參數:', groupId);
    const apiBase = typeof API_BASE_URL !== 'undefined' && API_BASE_URL ? API_BASE_URL : '';

    try {
        const res = await fetch(`${apiBase}/api/group_buy/get?group_id=${groupId}`);
        if (!res.ok) {
            showModal('找不到團購', '找不到此團購或團購已結束，請向主辦人確認連結是否正確。');
            return;
        }
        const json = await res.json();
        if (json.status !== 'success' || !json.data) {
            showModal('載入失敗', '無法載入團購資料: ' + (json.message || '伺服器異常'));
            return;
        }

        const gb = json.data;
        window.currentGroupBuyId = groupId;
        window.groupBuyData = gb;
        window.localGroupBuyVersion = gb.version || 1;

        if (gb.status === 'submitted' || gb.status === 'closed') {
            window.isGroupBuyClosed = true;
            if (typeof clearCart === 'function') clearCart();
            setTimeout(() => {
                const subTime = gb.submitted_at || '';
                const creator = gb.creator_name || '主辦人';
                showModal('🔒 團購訂單已送出', `此團購已由團長 (${creator}) 送出訂單${subTime ? '（' + subTime + '）' : ''}，目前已截止點餐，無法再加入或修改餐點。`, true, `
                    <div style="display:flex; flex-direction:column; gap:10px; margin-top:15px;">
                        <button onclick="document.getElementById('errorModalOverlay').style.display='none'; exitGroupBuyToPersonal();" style="width:100%; padding:11px; background:#f43f5e; color:#fff; border:none; border-radius:10px; font-weight:bold; font-size:15px; cursor:pointer;">🛒 我要自己另外點餐</button>
                    </div>
                `, true);
            }, 600);
        }

        if (localStorage.getItem('gb_creator_' + groupId) === 'true' || localStorage.getItem('gb_leader_' + groupId) === 'true') {
            window.groupBuyAuthed = true;
        }
        const myFp = getGroupBuyDeviceFp();
        if ((gb.creator_device_fp && gb.creator_device_fp === myFp) || (gb.authorized_fps && Array.isArray(gb.authorized_fps) && gb.authorized_fps.includes(myFp))) {
            window.groupBuyAuthed = true;
            localStorage.setItem('gb_leader_' + groupId, 'true');
        }

        if (gb.lat && gb.lng) {
            currentLat = gb.lat;
            currentLng = gb.lng;
        }
        if (gb.address) {
            currentAddrTitle = gb.address;
            const addrEl = document.getElementById('addrInput');
            if (addrEl) addrEl.value = gb.address;
        }
        isAddressSet = true;

        if (gb.phone) {
            localStorage.setItem('userPhone', gb.phone);
            const phoneEl = document.getElementById('checkoutPhone');
            if (phoneEl) phoneEl.value = gb.phone;
        }
        if (gb.delivery_notes !== undefined && gb.delivery_notes !== null) {
            localStorage.setItem('userDeliveryNotes', gb.delivery_notes);
            ['deliveryNotes', 'checkoutDeliveryNotes', 'groceryDeliveryNotes'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = gb.delivery_notes;
            });
        }
        if (gb.delivery_method) {
            localStorage.setItem('userDeliveryMethod', gb.delivery_method);
            ['deliveryMethod', 'checkoutDeliveryMethod', 'groceryDeliveryMethod'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = gb.delivery_method;
            });
            if (typeof setDeliveryMethod === 'function') {
                setDeliveryMethod(gb.delivery_method);
            }
        }
        if (gb.food_notes !== undefined && gb.food_notes !== null) {
            localStorage.setItem('userFoodNotes', gb.food_notes);
            ['foodNotes', 'checkoutFoodNotes', 'groceryFoodNotes'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = gb.food_notes;
            });
        }

        if (gb.lat && gb.lng && gb.address && typeof setAddress === 'function') {
            try {
                await setAddress(gb.lat, gb.lng, gb.address);
            } catch(e) {
                console.warn('[GroupBuy] setAddress error:', e);
            }
        }

        cart = (gb.status === 'submitted' || gb.status === 'closed') ? [] : (gb.items || []);
        updateCartBadge();
        if (typeof updateMenuActions === 'function') updateMenuActions();

        await openStore(gb.store_uuid, gb.store_name, gb.store_url || '', false, 'DELIVERY');
        renderGroupBuyTopBar(gb);
        startGroupBuySync(groupId);

    } catch (e) {
        console.error('[GroupBuy] 載入失敗:', e);
    }
}

