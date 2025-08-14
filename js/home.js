document.addEventListener('DOMContentLoaded', () => {
  const createRouteHeaderBtn = document.getElementById('createRouteHeaderBtn');
  if (createRouteHeaderBtn) {
    createRouteHeaderBtn.addEventListener('click', () => { location.href = 'create-route.html'; });
  }

  const dailyButtons = Array.from(document.querySelectorAll('[data-daily]'));

  async function refreshDailyUI() {
    try {
      const info = await API.dailyToday();
      const isCompleted = !!info.completed;
      dailyButtons.forEach(btn => {
        btn.disabled = isCompleted;
        btn.textContent = isCompleted ? 'Выполнено' : 'Выполнить';
      });
    } catch (e) {
      // Не блокируем интерфейс из-за ошибок получения статуса
    }
  }

  dailyButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await API.dailyComplete();
        UI.showModal('Дейлик', 'Засчитано! Рейтинг увеличен.');
      } catch (e) {
        // Если уже выполнено сегодня — просто обновим UI без показa ошибки
        if (String(e.message || '').includes('Дейлик уже выполнен')) {
          // no-op
        } else {
          UI.showModal('Ошибка', e.message);
        }
      } finally {
        await refreshDailyUI();
      }
    });
  });

  function formatHHMMSS(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function getMsUntilMoscowMidnight() {
    const now = new Date();
    const tzOffsetMs = now.getTimezoneOffset() * 60000; // разница с UTC в мс
    const utcNowMs = now.getTime() + tzOffsetMs;
    const mskOffsetMs = 3 * 60 * 60 * 1000; // UTC+3
    const mskNowMs = utcNowMs + mskOffsetMs;
    const mskNow = new Date(mskNowMs);
    // Используем UTC-компоненты, трактуя mskNow как MSK-время
    const y = mskNow.getUTCFullYear();
    const m = mskNow.getUTCMonth();
    const d = mskNow.getUTCDate();
    const nextMidnightMskUtcMs = Date.UTC(y, m, d + 1, 0, 0, 0, 0) - mskOffsetMs;
    return Math.max(0, nextMidnightMskUtcMs - utcNowMs);
  }

  function startDailyCountdown() {
    const timerEl = document.getElementById('dailyTimer');
    if (!timerEl) return;
    const tick = async () => {
      const msLeft = getMsUntilMoscowMidnight();
      timerEl.textContent = formatHHMMSS(msLeft);
      if (msLeft <= 0) {
        await refreshDailyUI();
      }
    };
    tick();
    setInterval(tick, 1000);
  }

  // Свайп-стек маршрутов на главной
  const stack = document.getElementById('homeSwipeStack');
  const applyBtn = document.getElementById('homeApplyFiltersBtn');
  const cityFilter = document.getElementById('homeCityFilter');

  let routes = [];
  let currentIndex = 0;

  function renderCard(route) {
    const el = document.createElement('div');
    el.className = 'swipe-card';
    el.innerHTML = `<h4>${route.title}</h4>
      <div class="route-meta">⏱️ ${route.time_minutes} мин · 💰 ${route.budget}₽</div>
      <div class="route-description">${route.description}</div>
      <div class="muted">Город: ${route.city}</div>
      ${Array.isArray(route.points) && route.points.length ? '<div class="route-map" style="height: 360px; border-radius: 12px; margin-top: 10px;"><div id="homeRouteMap" style="width:100%; height:100%"></div></div>' : ''}`;
    return el;
  }

  function layoutStack() {
    if (!stack) return;
    stack.innerHTML = '';
    if (!routes.length) {
      stack.innerHTML = '<div class="loading-routes">Маршрутов нет</div>';
      return;
    }
    
    if (currentIndex >= routes.length) {
      stack.innerHTML = '<div class="loading-routes">Больше маршрутов нет</div>';
      return;
    }

    const currentRoute = routes[currentIndex];
    const card = renderCard(currentRoute);
    stack.appendChild(card);

    if (Array.isArray(currentRoute.points) && currentRoute.points.length && window.ymaps) {
      ymaps.ready(() => {
        const container = document.getElementById('homeRouteMap');
        if (!container) return;
        const map = new ymaps.Map(container, { center: [55.76, 37.64], zoom: 10, controls: ['zoomControl'] });
        const points = currentRoute.points.map(p => [p.lat, p.lon]);
        const pmList = currentRoute.points.map(p => new ymaps.Placemark([p.lat, p.lon], { hintContent: p.name, balloonContent: p.name }, { preset: 'islands#pinkDotIcon' }));
        pmList.forEach(pm => map.geoObjects.add(pm));
        if (points.length >= 2) {
          ymaps.route(points, { mapStateAutoApply: true }).then(route => {
            route.options.set({ strokeColor: '#ff7eb9', strokeWidth: 4, strokeOpacity: 0.8 });
            map.geoObjects.add(route);
            map.setBounds(route.getBounds(), { checkZoomRange: true, zoomMargin: 30 });
          }).catch(() => { if (map.geoObjects.getBounds()) map.setBounds(map.geoObjects.getBounds(), { checkZoomRange: true, zoomMargin: 30 }); });
        } else if (points.length === 1) {
          map.setCenter(points[0], 14);
        }
      });
    }
  }

  async function loadRoutes() {
    if (!stack) return;
    stack.innerHTML = '<div class="loading-routes">Загрузка маршрутов...</div>';
    try {
      const params = cityFilter && cityFilter.value ? { city: cityFilter.value } : {};
      const [allRoutes, favorites] = await Promise.all([
        API.routes(params),
        (async () => { try { return await API.getFavorites(); } catch { return []; } })(),
      ]);
      const favoriteIds = new Set((favorites || []).map(r => r.id));
      routes = (allRoutes || []).filter(r => !favoriteIds.has(r.id));
      currentIndex = 0;
      layoutStack();
    } catch (e) {
      stack.innerHTML = '';
      UI.showModal('Ошибка', e.message);
    }
  }

  async function swipeRight() {
    if (!routes.length || currentIndex >= routes.length) return;
    
    const currentRoute = routes[currentIndex];
    try {
      await API.addToFavorites(currentRoute.id);
    } catch (e) {
      // Подавляем сообщение об ошибке «Маршрут уже в избранном»
      if (!String(e.message || '').includes('Маршрут уже в избранном')) {
        UI.showModal('Ошибка', e.message);
      }
    }
    
    // Переходим к следующему маршруту
    currentIndex++;
    layoutStack();
  }

  function swipeLeft() {
    if (!routes.length || currentIndex >= routes.length) return;
    
    // Просто переходим к следующему маршруту
    currentIndex++;
    layoutStack();
  }

  // Обработчики
  applyBtn?.addEventListener('click', loadRoutes);

  // Поддержка жестов: влево — skip, вправо — в избранное
  if (stack) {
    let startX = 0;
    let isTouch = false;
    let currentCard = null;

    const onStart = (x) => { 
      startX = x; 
      isTouch = true;
      currentCard = stack.querySelector('.swipe-card');
    };

    const onMove = (x) => {
      if (!isTouch || !currentCard) return;
      const dx = x - startX;
      currentCard.style.transform = `translateX(${dx}px) rotate(${dx/25}deg)`;
      
      // Добавляем визуальную обратную связь
      if (dx > 50) {
        currentCard.style.borderColor = '#28a745';
        currentCard.style.backgroundColor = '#f8fff9';
      } else if (dx < -50) {
        currentCard.style.borderColor = '#dc3545';
        currentCard.style.backgroundColor = '#fff8f8';
      } else {
        currentCard.style.borderColor = '#eee';
        currentCard.style.backgroundColor = '#fff';
      }
    };

    const onEnd = (x) => {
      if (!isTouch || !currentCard) return;
      isTouch = false;
      const dx = x - startX;
      const threshold = 80;
      
      if (Math.abs(dx) < threshold) {
        // Возвращаем карточку на место
        currentCard.style.transform = '';
        currentCard.style.borderColor = '#eee';
        currentCard.style.backgroundColor = '#fff';
        return;
      }
      
      // Анимация свайпа
      const direction = dx > 0 ? 1 : -1;
      currentCard.style.transform = `translateX(${direction * 500}px) rotate(${direction * 20}deg)`;
      currentCard.style.opacity = '0';
      
      setTimeout(() => {
        if (dx > 0) {
          swipeRight();
        } else {
          swipeLeft();
        }
      }, 300);
    };

    // Предотвращаем выделение текста при свайпе
    stack.addEventListener('selectstart', (e) => e.preventDefault());
    stack.addEventListener('mousedown', (e) => {
      e.preventDefault();
      onStart(e.clientX);
    });
    window.addEventListener('mousemove', (e) => onMove(e.clientX));
    window.addEventListener('mouseup', (e) => onEnd(e.clientX));

    stack.addEventListener('touchstart', (e) => {
      e.preventDefault();
      onStart(e.touches[0].clientX);
    }, { passive: false });
    stack.addEventListener('touchmove', (e) => {
      e.preventDefault();
      onMove(e.touches[0].clientX);
    }, { passive: false });
    stack.addEventListener('touchend', (e) => {
      e.preventDefault();
      onEnd(e.changedTouches[0].clientX);
    });
  }

  // Первичная загрузка
  loadRoutes();
  refreshDailyUI();
  startDailyCountdown();
});
