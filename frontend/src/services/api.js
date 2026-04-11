import axios from 'axios';

// Create centralized API client
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'https://attendance-ml.duckdns.org/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for auth token
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

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Face service client
export const faceApi = axios.create({
  baseURL: process.env.REACT_APP_FACE_SERVICE_URL || '/face',
  headers: {
    'Content-Type': 'application/json',
  },
});

export { api };
export default api;
