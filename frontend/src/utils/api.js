import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API functions
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (userData) => api.post('/auth/register', userData),
  getProfile: () => api.get('/auth/profile'),
};

export const itemsAPI = {
  getAll: (params = {}) => api.get('/items', { params }),
  getById: (id) => api.get(`/items/${id}`),
  create: (data) => api.post('/items', data),
  update: (id, data) => api.put(`/items/${id}`, data),
  delete: (id) => api.delete(`/items/${id}`),
};

export const periodsAPI = {
  getAll: () => api.get('/periods'),
  getById: (id) => api.get(`/periods/${id}`),
  create: (data) => api.post('/periods', data),
  close: (id) => api.post(`/periods/${id}/close`),
  reopen: (id) => api.post(`/periods/${id}/reopen`),
  getSummary: (id) => api.get(`/periods/${id}/summary`),
};

export const receiptsAPI = {
  getAll: (params = {}) => api.get('/receipts', { params }),
  getById: (id) => api.get(`/receipts/${id}`),
  create: (data) => api.post('/receipts', data),
  update: (id, data) => api.put(`/receipts/${id}`, data),
  void: (id, reason) => api.post(`/receipts/${id}/void`, { reason }),
};

export const consumptionsAPI = {
  getAll: (params = {}) => api.get('/consumptions', { params }),
  getById: (id) => api.get(`/consumptions/${id}`),
  create: (data) => api.post('/consumptions', data),
  update: (id, data) => api.put(`/consumptions/${id}`, data),
  void: (id, reason) => api.post(`/consumptions/${id}/void`, { reason }),
};

export const reportsAPI = {
  getPeriodItemBalances: (period) => api.get('/reports/period-item-balances', { params: { period } }),
  exportPeriod: (code) => api.get(`/exports/period/${code}.xlsx`, { responseType: 'blob' }),
};
