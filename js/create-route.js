document.addEventListener('DOMContentLoaded', () => {
  const pointsWrap = document.getElementById('routePoints');
  const addBtn = document.getElementById('addPointBtn');
  const cancelBtn = document.getElementById('cancelCreateRoute');

  // Яндекс.Карты
  let map;
  const markers = new Map(); // wrap -> placemark

  function initMap() {
    if (!window.ymaps) return;
    ymaps.ready(() => {
      map = new ymaps.Map('routeConstructorMap', { center: [55.76, 37.64], zoom: 10, controls: ['zoomControl', 'typeSelector', 'fullscreenControl'] });
      // Только просмотр и маркировка — ввод координат вручную
    });
  }

  function createPointElement() {
    const wrap = document.createElement('div'); wrap.className = 'route-point';
    wrap.innerHTML = `
      <input type="text" placeholder="Название точки" required maxlength="100">
      <textarea placeholder="Описание точки" rows="2" maxlength="200"></textarea>
      <div class="d-flex justify-between align-center">
        <div class="muted">Координаты: <span class="coords-view">—</span></div>
        <div class="d-flex" style="gap:8px">
          <input type="text" class="coord-input" placeholder="lat, lon" style="width:160px" />
          <button type="button" class="btn btn-outline btn-small apply-coords">Применить</button>
          <button type="button" class="btn btn-outline btn-small remove-point">Удалить</button>
        </div>
      </div>`;
    wrap.querySelector('.remove-point').onclick = () => { removeMarker(wrap); wrap.remove(); };
    wrap.querySelector('.apply-coords').onclick = () => {
      const val = wrap.querySelector('.coord-input')?.value || '';
      const parts = val.split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        setPointCoords(wrap, parts[0], parts[1]);
      } else {
        UI.showModal('Ошибка', 'Введите координаты в формате: lat, lon');
      }
    };
    return wrap;
  }

  function setPointCoords(wrap, lat, lon) {
    wrap.dataset.lat = String(lat);
    wrap.dataset.lon = String(lon);
    const label = wrap.querySelector('.coords-view');
    if (label) label.textContent = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    addOrMoveMarker(wrap, lat, lon, wrap.querySelector('input')?.value || 'Точка');
  }

  function addOrMoveMarker(wrap, lat, lon, name) {
    if (!map || !window.ymaps) return;
    let pm = markers.get(wrap);
    if (!pm) {
      pm = new ymaps.Placemark([lat, lon], { hintContent: name, balloonContent: name }, { preset: 'islands#pinkDotIcon' });
      markers.set(wrap, pm);
      map.geoObjects.add(pm);
    } else {
      pm.geometry.setCoordinates([lat, lon]);
      pm.properties.set({ hintContent: name, balloonContent: name });
    }
    fitToMarkers();
  }

  function removeMarker(wrap) {
    const pm = markers.get(wrap);
    if (pm && map) { map.geoObjects.remove(pm); }
    markers.delete(wrap);
  }

  function fitToMarkers() {
    if (!map) return;
    if (markers.size === 0) return;
    const coords = Array.from(markers.values()).map(pm => pm.geometry.getCoordinates());
    if (coords.length === 1) { map.setCenter(coords[0], 14); return; }
    map.setBounds(ymaps.geoQuery(coords.map(c => new ymaps.geometry.Point(c))).getBounds(), { checkZoomRange: true, zoomMargin: 40 });
  }

  function collectPayload() {
    const points = [];
    pointsWrap.querySelectorAll('.route-point').forEach(wrap => {
      const name = wrap.querySelector('input')?.value?.trim();
      const desc = wrap.querySelector('textarea')?.value?.trim();
      const lat = parseFloat(wrap.dataset.lat);
      const lon = parseFloat(wrap.dataset.lon);
      if (name && !isNaN(lat) && !isNaN(lon)) {
        points.push({ name, description: desc || undefined, lat, lon });
      }
    });
    return {
      title: document.getElementById('routeName').value.trim(),
      description: document.getElementById('routeDescription').value.trim(),
      city: document.getElementById('routeCity').value,
      time_minutes: parseInt(document.getElementById('routeTime').value, 10),
      budget: parseInt(document.getElementById('routeBudget').value, 10),
      points,
    };
  }

  function validatePayload(p) {
    if (!p.title || !p.city || !p.time_minutes || !p.budget) return 'Заполните обязательные поля';
    if (p.points.length === 0) return 'Добавьте хотя бы одну точку на карте';
    return null;
  }

  addBtn?.addEventListener('click', () => {
    const wrap = createPointElement();
    pointsWrap.appendChild(wrap);
  });

  // Инициализация для первой точки
  pointsWrap?.querySelectorAll('.route-point').forEach(wrap => {
    wrap.querySelector('.remove-point')?.addEventListener('click', () => { removeMarker(wrap); wrap.remove(); });
    wrap.querySelector('.apply-coords')?.addEventListener('click', () => {
      const val = wrap.querySelector('.coord-input')?.value || '';
      const parts = val.split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) setPointCoords(wrap, parts[0], parts[1]);
      else UI.showModal('Ошибка', 'Введите координаты в формате: lat, lon');
    });
  });

  cancelBtn?.addEventListener('click', () => history.back());

  const formEl = document.getElementById('createRouteForm');
  const urlParams = new URLSearchParams(location.search);
  const editId = urlParams.get('id');

  formEl?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = collectPayload();
    const err = validatePayload(payload);
    if (err) { UI.showModal('Ошибка', err); return; }
    try {
      UI.showPageLoading();
      if (editId) {
        await API.updateRoute(editId, payload);
        UI.showModal('Готово', 'Маршрут обновлён!');
      } else {
        await API.createRoute(payload);
        UI.showModal('Готово', 'Маршрут сохранён! Он появится в общем списке после обновления.');
      }
      setTimeout(() => { location.href = 'routes.html'; }, 800);
    } catch (e) {
      UI.showModal('Ошибка', e.message || 'Не удалось сохранить маршрут');
    } finally {
      UI.hidePageLoading();
    }
  });

  initMap();

  // Прелоад данных при редактировании
  (async function preload() {
    if (!editId) return;
    try {
      UI.showPageLoading();
      const r = await API.getRoute(editId);
      document.getElementById('routeName').value = r.title || '';
      document.getElementById('routeDescription').value = r.description || '';
      document.getElementById('routeCity').value = r.city || '';
      document.getElementById('routeTime').value = String(r.time_minutes || 0);
      document.getElementById('routeBudget').value = String(r.budget || 0);
      (r.points || []).forEach(p => {
        const wrap = createPointElement();
        wrap.querySelector('input').value = p.name || '';
        wrap.querySelector('textarea').value = p.description || '';
        pointsWrap.appendChild(wrap);
        setPointCoords(wrap, p.lat, p.lon);
      });
    } catch (e) {
      UI.showModal('Ошибка', 'Не удалось загрузить маршрут');
    } finally {
      UI.hidePageLoading();
    }
  })();
});

