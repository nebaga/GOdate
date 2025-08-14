document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('aiForm');
  const btn = document.getElementById('aiSubmitBtn');
  const routeText = document.getElementById('routeText');
  const usedWords = document.getElementById('usedWords');
  const result = document.getElementById('aiResult');

  const people = document.getElementById('people');
  const peopleValue = document.getElementById('peopleValue');
  const time = document.getElementById('time');
  const timeValue = document.getElementById('timeValue');
  const places = document.getElementById('places');
  const placesValue = document.getElementById('placesValue');

  const updateSlider = (slider, label) => label.textContent = slider.value;
  people?.addEventListener('input', () => updateSlider(people, peopleValue));
  time?.addEventListener('input', () => updateSlider(time, timeValue));
  places?.addEventListener('input', () => updateSlider(places, placesValue));

  let map;
  ymaps.ready(() => {
    map = new ymaps.Map('map', { center: [55.76, 37.64], zoom: 10, controls: ['zoomControl', 'typeSelector', 'fullscreenControl'] });
  });

  function setLoading(isLoading) {
    const text = btn.querySelector('.btn-text');
    const loading = btn.querySelector('.btn-loading');
    if (isLoading) {
      btn.classList.add('loading');
      text.style.display = 'none';
      loading.style.display = 'inline-block';
      btn.disabled = true;
    } else {
      btn.classList.remove('loading');
      text.style.display = 'inline-block';
      loading.style.display = 'none';
      btn.disabled = false;
    }
  }

  function updateMap(coordinatesObj, places = []) {
    if (!map) return;
    map.geoObjects.removeAll();
    const points = [];

    // 1) Приоритет: структурированные места
    (places || []).forEach(pl => {
      if (typeof pl.lat === 'number' && typeof pl.lon === 'number') {
        const pt = [pl.lat, pl.lon];
        points.push(pt);
        const title = pl.name + (pl.address ? `, ${pl.address}` : '');
        const placemark = new ymaps.Placemark(pt, { hintContent: title, balloonContent: title }, { preset: 'islands#pinkDotIcon' });
        map.geoObjects.add(placemark);
      }
    });

    // 2) Фолбэк: координаты из текста
    if (points.length === 0) {
      Object.entries(coordinatesObj || {}).forEach(([place, coordStr]) => {
        const cleaned = String(coordStr).replace(/\s/g, '');
        const parts = cleaned.split(',').map(Number);
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          points.push(parts);
          const placemark = new ymaps.Placemark(parts, { hintContent: place, balloonContent: place }, { preset: 'islands#pinkDotIcon' });
          map.geoObjects.add(placemark);
        }
      });
    }
    if (points.length >= 1) {
      if (points.length >= 2) {
        ymaps.route(points, { mapStateAutoApply: true }).then(route => {
          route.options.set({ strokeColor: '#ff7eb9', strokeWidth: 4, strokeOpacity: 0.8 });
          map.geoObjects.add(route);
          map.setBounds(route.getBounds(), { checkZoomRange: true, zoomMargin: 50 });
        }).catch(() => { map.setBounds(map.geoObjects.getBounds(), { checkZoomRange: true, zoomMargin: 50 }); });
      } else {
        map.setCenter(points[0], 14);
      }
    }
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      city: document.getElementById('city').value.trim(),
      budget: parseInt(document.getElementById('budget').value, 10),
      people: parseInt(document.getElementById('people').value, 10),
      time: parseInt(document.getElementById('time').value, 10),
      places: parseInt(document.getElementById('places').value, 10),
      transport: document.getElementById('transport').value,
      whatai: document.getElementById('whatai').value,
    };
    if (!payload.city || !payload.budget) { UI.showModal('Ошибка', 'Заполните обязательные поля'); return; }
    try {
      setLoading(true);
      const data = await API.aiGenerate(payload);
      usedWords.textContent = data.used_words ?? '';
      // печатающий эффект
      routeText.innerHTML = '';
      result.style.display = 'block';
      const text = data.route || '';
      let i = 0; const speed = 10;
      const type = () => {
        if (i < text.length) {
          const ch = text.charAt(i);
          if (ch === '*' && text.charAt(i + 1) === '*') {
            const end = text.indexOf('**', i + 2);
            if (end !== -1) {
              const bold = text.substring(i + 2, end);
              routeText.innerHTML += `<strong>${bold}</strong>`;
              i = end + 2; setTimeout(type, speed); return;
            }
          }
          routeText.innerHTML += ch === '\n' ? '<br>' : ch;
          i++; setTimeout(type, speed);
        }
      };
      type();
      updateMap(data.coordinates || {}, data.places || []);
    } catch (e) {
      UI.showModal('Ошибка', e.message || 'Не удалось сгенерировать маршрут');
    } finally {
      setLoading(false);
    }
  });
});


