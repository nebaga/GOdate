const API = {
  async request(path, { method = 'GET', body, auth = false } = {}) {
    const url = `${window.API_CONFIG.BASE_URL}${path}`;
    const headers = { ...window.API_CONFIG.HEADERS };
    if (auth) {
      const token = window.getAuthToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      let msg = 'Ошибка запроса';
      try { const data = await res.json(); msg = data.detail || JSON.stringify(data); } catch {}
      throw new Error(msg);
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) return res.json();
    return res.text();
  },
  // Auth
  async register(payload) { return this.request('/auth/register', { method: 'POST', body: payload }); },
  async login(email, password) {
    const form = new URLSearchParams();
    form.append('username', email);
    form.append('password', password);
    const res = await fetch(`${window.API_CONFIG.BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    if (!res.ok) throw new Error('Неверный email или пароль');
    return res.json();
  },
  // Users
  async me() { return this.request('/users/me', { auth: true }); },
  async logout() { return this.request('/users/logout', { method: 'POST' }); },
  async updateAvatarFile(file) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${window.API_CONFIG.BASE_URL}/users/avatar`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${window.getAuthToken()}` },
      body: form,
    });
    if (!res.ok) throw new Error('Не удалось загрузить аватар');
    return res.json();
  },
  async sendRequest(login_or_id, type) { return this.request('/users/request', { method: 'POST', body: { login_or_id, type }, auth: true }); },
  async removeSoulmate() { return this.request('/users/soulmate', { method: 'DELETE', auth: true }); },
  async removeFriend(friendId) { return this.request('/users/friend', { method: 'DELETE', body: { friend_id: friendId }, auth: true }); },
  // Messages
  async messages() { return this.request('/messages', { auth: true }); },
  async actRequest(request_id, action) { return this.request('/messages/act', { method: 'POST', body: { request_id, action }, auth: true }); },
  // Dailies
  async dailyToday() { return this.request('/dailies/today', { auth: true }); },
  async dailyComplete() { return this.request('/dailies/complete', { method: 'POST', auth: true }); },
  // Routes
  async routes(params = {}) {
    const q = new URLSearchParams(params).toString();
    const path = q ? `/routes?${q}` : '/routes';
    return this.request(path);
  },
  async likeRoute(route_id) { return this.request('/routes/like', { method: 'POST', body: { route_id }, auth: true }); },
  async addToFavorites(route_id) { return this.request('/routes/favorite', { method: 'POST', body: { route_id }, auth: true }); },
  async getFavorites() { return this.request('/routes/favorites', { auth: true }); },
  async myRoutes() { return this.request('/routes/mine', { auth: true }); },
  async getRoute(route_id) { return this.request(`/routes/${route_id}`, { auth: true }); },
  async updateRoute(route_id, payload) { return this.request(`/routes/${route_id}`, { method: 'PUT', body: payload, auth: true }); },
  async deleteRoute(route_id) { return this.request(`/routes/${route_id}`, { method: 'DELETE', auth: true }); },
  async createRoute(payload) { return this.request('/routes', { method: 'POST', body: payload, auth: true }); },
  async removeFavorite(route_id) { return this.request(`/routes/favorite/${route_id}`, { method: 'DELETE', auth: true }); },
  // Rating
  async rating() { return this.request('/rating'); },
  // Recs
  async recommend(city, description, places) { return this.request('/recommendations', { method: 'POST', body: { city, description, places }, auth: true }); },
  // AI Generation
  async aiGenerate(payload) { return this.request('/ai/generate', { method: 'POST', body: payload }); },
};

window.API = API;

