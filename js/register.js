document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registerForm');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('registerEmail').value;
    const nickname = document.getElementById('registerNickname').value;
    const password = document.getElementById('registerPassword').value;
    const confirm = document.getElementById('confirmPassword').value;
    if (password !== confirm) { UI.showModal('Ошибка', 'Пароли не совпадают'); return; }
    try {
      await API.register({ email, nickname, password });
      UI.showModal('Успех', 'Регистрация завершена. Теперь войдите.');
      setTimeout(() => location.href = 'login.html', 1200);
    } catch (e) { UI.showModal('Ошибка', e.message); }
  });
});

