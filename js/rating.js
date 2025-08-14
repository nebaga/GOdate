async function renderRating() {
  const list = document.getElementById('ratingList');
  list.innerHTML = '<div class="loading-rating">Загрузка рейтинга...</div>';
  try {
    const items = await API.rating();
    list.innerHTML = '';
    items.forEach((it, idx) => {
      const el = document.createElement('div'); el.className = 'rating-item';
      el.innerHTML = `<div class="place">${idx + 1}</div><div class="nick">${it.nickname}</div><div class="points">${it.rating}</div>`;
      list.appendChild(el);
    });
  } catch (e) { UI.showModal('Ошибка', e.message); }
}

document.addEventListener('DOMContentLoaded', renderRating);

