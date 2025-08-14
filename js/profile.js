async function renderProfile() {
  try {
    const me = await API.me();
    document.getElementById('userName').innerText = me.nickname;
    document.getElementById('userEmail').innerText = me.email;
    document.getElementById('userId').innerText = me.id;
    document.getElementById('userRating').innerText = me.rating;
    if (me.avatar_url) document.getElementById('userAvatar').src = me.avatar_url;

    const soulmateContent = document.getElementById('soulmateContent');
    soulmateContent.innerHTML = '';
    if (me.soulmate) {
      soulmateContent.innerHTML = `
        <div class="soulmate-card">
          <img class="avatar pink-border" src="${me.soulmate.avatar_url || '/placeholder.svg?height=64&width=64'}"/>
          <div class="soulmate-info">
            <div>${me.soulmate.nickname}</div>
            <div class="muted">ID: ${me.soulmate.id}</div>
          </div>
          <div class="soulmate-actions">
            <button class="btn btn-danger btn-small" onclick="removeSoulmate()">Удалить</button>
          </div>
        </div>`;
    } else {
      const input = document.createElement('input'); 
      input.placeholder = 'Логин или ID половинки'; 
      input.id = 'soulmateInput';
      input.style.width = '100%';
      input.style.padding = '10px 12px';
      input.style.borderRadius = '8px';
      input.style.border = '1px solid #ddd';
      input.style.marginBottom = '10px';
      
      const btn = document.createElement('button'); 
      btn.className = 'btn btn-primary btn-small mt-2'; 
      btn.innerText = 'Отправить заявку';
      btn.onclick = async () => {
        const value = input.value.trim(); if (!value) return;
        try { await API.sendRequest(value, 'soulmate'); UI.showModal('Отправлено', 'Заявка отправлена'); }
        catch (e) { UI.showModal('Ошибка', e.message); }
      };
      soulmateContent.append(input, btn);
    }

    const friendsList = document.getElementById('friendsList');
    friendsList.innerHTML = '';
    if (me.friends.length === 0) friendsList.innerHTML = '<p>Список друзей пуст</p>';
    me.friends.forEach(f => {
      const el = document.createElement('div'); 
      el.className = 'friend-item';
      el.innerHTML = `
        <div class="friend-info">
          <img class="avatar" src="${f.avatar_url || '/placeholder.svg?height=40&width=40'}"/>
          <div>${f.nickname}</div>
        </div>
        <div class="friend-actions">
          <button class="btn-remove" onclick="removeFriend(${f.id})">Удалить</button>
        </div>
      `;
      friendsList.appendChild(el);
    });

    const addFriendForm = document.getElementById('addFriendForm');
    addFriendForm.onsubmit = async (e) => {
      e.preventDefault();
      const v = document.getElementById('friendInput').value.trim(); if (!v) return;
      try { await API.sendRequest(v, 'friend'); UI.showModal('Отправлено', 'Заявка в друзья отправлена'); }
      catch (e) { UI.showModal('Ошибка', e.message); }
    };

    // кнопки смены аватарки
    const selectAvatarBtn = document.getElementById('selectAvatarBtn');
    const changeAvatarBtn = document.getElementById('changeAvatarBtn');
    const avatarFile = document.getElementById('avatarFile');
    
    if (selectAvatarBtn && avatarFile) {
      selectAvatarBtn.onclick = () => {
        avatarFile.click();
      };
    }
    
    if (changeAvatarBtn && avatarFile) {
      changeAvatarBtn.onclick = async () => {
        const file = avatarFile.files && avatarFile.files[0];
        if (!file) return UI.showModal('Ошибка', 'Выберите файл изображения');
        try { 
          await API.updateAvatarFile(file); 
          UI.showModal('Готово', 'Аватар обновлён'); 
          await renderProfile(); 
        }
        catch (e) { UI.showModal('Ошибка', e.message); }
      };
    }

    // кнопка выхода
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.onclick = async (e) => {
        e.preventDefault();
        try { await API.logout(); } catch {}
        localStorage.removeItem('godate_token');
        location.href = 'login.html';
      };
    }
  } catch (e) {
    UI.showModal('Ошибка', e.message);
    if (e.message.includes('401')) location.href = 'login.html';
  }
}

async function renderMyRoutes() {
  const container = document.getElementById('myRoutesList');
  if (!container) return;
  try {
    container.innerHTML = '<div class="loading-routes">Загрузка...</div>';
    const routes = await API.myRoutes();
    if (!routes.length) { container.innerHTML = '<p>У вас пока нет маршрутов</p>'; return; }
    container.innerHTML = '';
    routes.forEach(r => {
      const el = document.createElement('div'); el.className = 'route-card';
      el.innerHTML = `
        <div class="route-card-header">
          <h4>${r.title}</h4>
          <div class="d-flex" style="gap:8px">
            <button class="btn btn-outline btn-small" data-edit="${r.id}">Редактировать</button>
            <button class="btn btn-outline btn-small" data-del="${r.id}">Удалить</button>
          </div>
        </div>
        <div class="route-meta">⏱️ ${r.time_minutes} мин · 💰 ${r.budget}₽</div>
        <p class="route-description">${r.description}</p>
        <div class="muted">Город: ${r.city}</div>`;
      container.appendChild(el);
    });
    container.addEventListener('click', async (e) => {
      const del = e.target.closest('[data-del]');
      const edt = e.target.closest('[data-edit]');
      if (del) {
        const id = Number(del.getAttribute('data-del'));
        if (!isNaN(id)) {
          try { await API.deleteRoute(id); await renderMyRoutes(); } catch (err) { UI.showModal('Ошибка', err.message); }
        }
      } else if (edt) {
        const id = Number(edt.getAttribute('data-edit'));
        if (!isNaN(id)) location.href = `create-route.html?id=${id}`;
      }
    }, { once: true });
  } catch (e) {
    container.innerHTML = '<p class="error">Не удалось загрузить</p>';
  }
}

async function removeSoulmate() {
  try {
    if (confirm('Вы уверены, что хотите удалить вторую половинку?')) {
      await API.removeSoulmate();
      UI.showModal('Готово', 'Вторая половинка удалена');
      await renderProfile();
    }
  } catch (e) {
    UI.showModal('Ошибка', e.message);
  }
}

async function removeFriend(friendId) {
  try {
    if (confirm('Вы уверены, что хотите удалить этого друга?')) {
      await API.removeFriend(friendId);
      UI.showModal('Готово', 'Друг удален');
      await renderProfile();
    }
  } catch (e) {
    UI.showModal('Ошибка', e.message);
  }
}

document.addEventListener('DOMContentLoaded', async () => { await renderProfile(); await renderMyRoutes(); });

