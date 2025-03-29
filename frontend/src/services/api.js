import axios from 'axios';

// Create API instance with base URL
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
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
    // FastAPI OAuth2 expects form data with username and password fields
    const formData = new URLSearchParams();
    formData.append('username', credentials.username);
    formData.append('password', credentials.password);

    const response = await api.post('/api/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    console.log('API Login Response:', response.data);
    
    // Verify token is in response
    if (response.data.access_token) {
      localStorage.setItem('token', response.data.access_token);
    } else {
      console.error('No access_token in response:', response.data);
    }
    
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

// Content API
export const getContentBySubject = async (subjectId) => {
  try {
    const response = await api.get(`/api/content/subject/${subjectId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching content:', error);
    throw error;
  }
};

export const createContent = async (contentData) => {
  try {
    const response = await api.post('/api/content', contentData);
    return response.data;
  } catch (error) {
    console.error('Error creating content:', error);
    throw error;
  }
};

// Progress API
export const updateProgress = async (studentId, contentId, progressData) => {
  try {
    const response = await api.post(`/api/progress/${studentId}/${contentId}`, progressData);
    return response.data;
  } catch (error) {
    console.error('Error updating progress:', error);
    throw error;
  }
};


export const logout = () => {
  localStorage.removeItem('token')
};

export default api;