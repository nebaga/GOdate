function ensureModal() {
  let modal = document.getElementById('notificationModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'notificationModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content modal-animated">
        <div class="modal-header">
          <h3 id="modalTitle">Уведомление</h3>
          <button class="modal-close" id="modalClose">&times;</button>
        </div>
        <div class="modal-body">
          <p id="modalMessage"></p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" id="modalOkBtn">OK</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  return modal;
}

function showModal(title, message) {
  const modal = ensureModal();
  const content = modal.querySelector('.modal-content');
  modal.style.display = 'flex';
  // старт анимации
  content?.classList.remove('pop-in');
  // eslint-disable-next-line no-unused-expressions
  content?.offsetHeight; // reflow
  content?.classList.add('pop-in');
  modal.querySelector('#modalTitle').innerText = String(title || 'Уведомление');
  modal.querySelector('#modalMessage').innerText = String(message || '');
  const close = () => { modal.style.display = 'none'; };
  modal.querySelector('#modalClose')?.addEventListener('click', close, { once: true });
  modal.querySelector('#modalOkBtn')?.addEventListener('click', close, { once: true });
}

function setAuthUI() {
  const token = window.getAuthToken();
  const loginBtn = document.getElementById('loginBtn');
  const profileBtn = document.getElementById('profileBtn');
  if (!loginBtn || !profileBtn) return;
  if (token) {
    loginBtn.style.display = 'none';
    profileBtn.style.display = 'inline-flex';
    profileBtn.onclick = () => location.href = 'profile.html';
  } else {
    loginBtn.style.display = 'inline-flex';
    loginBtn.onclick = () => location.href = 'login.html';
    profileBtn.style.display = 'none';
  }
}

// Глобальный экран загрузки и плавное появление страницы
function ensureLoadingOverlay() {
  let overlay = document.getElementById('loadingOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.className = 'loading-overlay fade-in';
    overlay.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Загрузка...</p></div>';
    document.body.appendChild(overlay);
  }
  return overlay;
}

function showPageLoading() {
  const overlay = ensureLoadingOverlay();
  overlay.style.display = 'flex';
  overlay.classList.remove('fade-out');
  // reflow
  // eslint-disable-next-line no-unused-expressions
  overlay.offsetHeight;
  overlay.classList.add('fade-in');
}

function hidePageLoading() {
  const overlay = ensureLoadingOverlay();
  overlay.classList.remove('fade-in');
  overlay.classList.add('fade-out');
  setTimeout(() => { overlay.style.display = 'none'; }, 250);
}

document.addEventListener('DOMContentLoaded', () => {
  setAuthUI();
  hidePageLoading();
});

window.addEventListener('beforeunload', () => {
  showPageLoading();
});

window.UI = { showModal, showPageLoading, hidePageLoading };

