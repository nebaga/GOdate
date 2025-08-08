async function loadMessages() {
  try {
    const [me, data] = await Promise.all([API.me(), API.messages()]);
    const renderList = (arr, container, highlightSoulmate = false) => {
      container.innerHTML = '';
      if (arr.length === 0) { container.innerHTML = '<p>Нет уведомлений</p>'; return; }
      arr.forEach(m => {
        const el = document.createElement('div'); el.className = 'message-item';
        if (highlightSoulmate && m.type === 'soulmate') el.classList.add('pink');
        el.innerHTML = `<div class="message-users"><strong>${m.from_user.nickname}</strong> → <strong>${m.to_user.nickname}</strong></div><div class="message-meta">${m.type}</div>`;
        if (m.to_user.id === me.id) {
          const actions = document.createElement('div'); actions.className = 'message-actions';
          const accept = document.createElement('button'); accept.className = 'btn btn-primary btn-small'; accept.innerText = 'Принять';
          const decline = document.createElement('button'); decline.className = 'btn btn-outline btn-small'; decline.innerText = 'Отклонить';
          accept.onclick = async () => { await API.actRequest(m.id, 'accept'); await loadMessages(); };
          decline.onclick = async () => { await API.actRequest(m.id, 'decline'); await loadMessages(); };
          actions.append(accept, decline);
          el.appendChild(actions);
        }
        container.appendChild(el);
      });
    };
    renderList([...data.incoming, ...data.outgoing], document.getElementById('allMessages'), true);
    renderList(data.incoming, document.getElementById('requestMessages'), true);
    renderList(data.incoming.filter(m => m.type === 'soulmate'), document.getElementById('soulmateMessages'), true);
  } catch (e) {
    UI.showModal('Ошибка', e.message);
    if (e.message.includes('401')) location.href = 'login.html';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(
        btn.dataset.tab === 'all' ? 'allMessages' : btn.dataset.tab === 'requests' ? 'requestMessages' : 'soulmateMessages'
      ).classList.add('active');
    });
  });
  loadMessages();
});

