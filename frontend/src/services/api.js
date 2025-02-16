import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const login = async (credentials) => {
  try {
    const response = await api.post('/api/login', credentials);
    localStorage.setItem('token', response.data.access_token);
    return response.data;
  } catch (error) {
    console.error('Login Error:', error);
    throw error;
  }
};

export const healthCheck = async () => {
  try {
    const response = await api.get('/api/health');
    return response.data;
  } catch (error) {
    console.error('API Health Check Error:', error);
    throw error;
  }
};

export const createStudent = async (studentData) => {
  try {
    const response = await api.post('/api/students', studentData);
    return response.data;
  } catch (error) {
    console.error('Create Student Error:', error);
    throw error;
  }
};

export const getStudents = async () => {
  try {
    const response = await api.get('/api/students');
    return response.data;
  } catch (error) {
    console.error('Get Students Error:', {
      message: error.message,
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method,
      responseData: error.response?.data
    });
    throw error;
  }
};

export const logout = () => {
  localStorage.removeItem('token')
}

export default api;