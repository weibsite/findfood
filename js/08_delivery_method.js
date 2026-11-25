// Delivery method helpers (setDeliveryMethod defined in 01_config.js)
window.doStoreKeywordSearch = function(kw) {

      const box = document.getElementById('headerSearchBox');

      if (box.style.display === 'none') {

          toggleStoreSearch();

      }

      document.getElementById('storeSearchInput').value = kw;
      const mobileInput = document.getElementById('storeSearchInputMobile');
      if (mobileInput) mobileInput.value = kw;

      handleStoreSearch(true);
      
      // Blur the inputs so the keyboard doesn't pop up and cover the results when clicking a shortcut
      if (mobileInput) mobileInput.blur();
      document.getElementById('storeSearchInput').blur();

  };

  window.setupScrollSpy = function() {

      const cats = document.querySelectorAll('.menu-category[id^="cat_"]');

      const navs = document.querySelectorAll('.store-sidebar-item');

      if (cats.length === 0) return;

      const onScroll = () => {

          if (currentView !== 'store') {

              window.removeEventListener('scroll', onScroll);

              return;

          }

          let currentId = '';

          cats.forEach(cat => {

              const rect = cat.getBoundingClientRect();

              if (rect.top <= 130) {

                  currentId = cat.id;

              }

          });

          if (!currentId && cats.length > 0) currentId = cats[0].id;

          navs.forEach(nav => {

              nav.classList.remove('active');

              if (nav.id === `nav_${currentId}`) {

                  nav.classList.add('active');

                  const sb = document.querySelector('.store-sidebar');

                  if (sb) {

                      const navRect = nav.getBoundingClientRect();

                      const sbRect = sb.getBoundingClientRect();

                      if (navRect.bottom > sbRect.bottom) sb.scrollTop += navRect.bottom - sbRect.bottom;

                      if (navRect.top < sbRect.top) sb.scrollTop -= sbRect.top - navRect.top;

                  }

              }

          });

      };

      window.addEventListener('scroll', onScroll, { passive: true });

      setTimeout(onScroll, 100);

  };


function showToast(msg) {
    const el = document.createElement('div');
    el.innerText = msg;
    el.style.position = 'fixed';
    el.style.top = '50%';
    el.style.left = '50%';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.background = 'rgba(0,0,0,0.8)';
    el.style.color = '#fff';
    el.style.padding = '12px 24px';
    el.style.borderRadius = '20px';
    el.style.zIndex = '99999';
    el.style.fontSize = '15px';
    el.style.fontWeight = 'bold';
    el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
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
