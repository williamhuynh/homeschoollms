import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

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

export default api;