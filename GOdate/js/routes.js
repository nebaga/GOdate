async function renderRoutes() {
  const grid = document.getElementById('routesGrid');
  grid.innerHTML = '<div class="loading-routes">Загрузка избранных маршрутов...</div>';
  try {
    const routes = await API.getFavorites();
    grid.innerHTML = '';
    if (routes.length === 0) { 
      grid.innerHTML = '<p>У вас пока нет избранных маршрутов. Свайпните вправо на главной странице, чтобы добавить маршруты в избранное!</p>'; 
      return; 
    }
    const withPoints = [];
    routes.forEach(r => {
      const el = document.createElement('div'); 
      el.className = 'route-card';
      el.innerHTML = `
        <div class="route-card-header">
          <h4>${r.title}</h4>
          <button class="btn btn-outline btn-icon" title="Убрать из избранного" data-remove="${r.id}">−</button>
        </div>
        <div class="route-meta">⏱️ ${r.time_minutes} мин · 💰 ${r.budget}₽</div>
        <p class="route-description">${r.description}</p>
        <div class="muted">Город: ${r.city}</div>
        ${Array.isArray(r.points) && r.points.length ? `<div class="route-map" style="height: 180px; border-radius: 12px; margin-top: 10px;"><div id="fav-map-${r.id}" style="width:100%; height:100%"></div></div>` : ''}`;
      grid.appendChild(el);
      if (Array.isArray(r.points) && r.points.length) withPoints.push(r);
    });

    // Инициализация карт
    // Инициализация карт
    if (withPoints.length && window.ymaps) {
      ymaps.ready(() => {
        withPoints.forEach(r => {
          const container = document.getElementById(`fav-map-${r.id}`);
          if (!container) return;
          const map = new ymaps.Map(container, { center: [55.76, 37.64], zoom: 10, controls: ['zoomControl'] });
          const points = r.points.map(p => [p.lat, p.lon]);
          const pmList = r.points.map(p => new ymaps.Placemark([p.lat, p.lon], { hintContent: p.name, balloonContent: p.name }, { preset: 'islands#pinkDotIcon' }));
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
      });
    }
  } catch (e) { 
    UI.showModal('Ошибка', e.message); 
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('createRouteBtn')?.addEventListener('click', () => location.href = 'create-route.html');
  const grid = document.getElementById('routesGrid');
  // Делегирование клика для кнопок удаления — вешаем один раз
  grid?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-remove]');
    if (!btn) return;
    const id = Number(btn.getAttribute('data-remove'));
    try { await API.removeFavorite(id); }
    catch (err) { /* noop */ }
    finally { await renderRoutes(); }
  });
  renderRoutes();
});

