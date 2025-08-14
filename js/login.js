document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    try {
      const data = await API.login(email, password);
      localStorage.setItem('godate_token', data.access_token);
      location.href = 'index.html';
    } catch (e) { UI.showModal('Ошибка', e.message); }
  });
});

