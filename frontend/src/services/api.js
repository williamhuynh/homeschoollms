import axios from 'axios';

// Create API instance with base URL
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create a separate instance for the production API
const productionApi = axios.create({
  baseURL: 'https://homeschoollms-server.onrender.com',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include JWT token for both API instances
const addAuthToken = (config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

api.interceptors.request.use(addAuthToken);
productionApi.interceptors.request.use(addAuthToken);

// Determine which API to use based on the environment
const apiToUse = window.location.hostname === 'localhost' ? api : productionApi;

export const login = async (credentials) => {
  try {
    // FastAPI OAuth2 expects form data with username and password fields
    const formData = new URLSearchParams();
    formData.append('username', credentials.username);
    formData.append('password', credentials.password);

    const response = await apiToUse.post('/api/auth/login', formData, {
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
    const response = await apiToUse.get('/api/health');
    return response.data;
  } catch (error) {
    console.error('API Health Check Error:', error);
    throw error;
  }
};

export const createStudent = async (studentData) => {
  try {
    // Log the data being sent for debugging
    console.log('Sending student data:', studentData);
    
    // Create a copy of the data to avoid modifying the original
    const formattedData = { ...studentData };
    
    // Ensure parent_ids is initialized as an empty array if not provided
    if (!formattedData.parent_ids) {
      formattedData.parent_ids = [];
    }
    
    // Ensure organization_id and family_id are null if not provided
    if (!formattedData.organization_id) {
      formattedData.organization_id = null;
    }
    
    if (!formattedData.family_id) {
      formattedData.family_id = null;
    }
    
    // Initialize subjects and active_subjects if not provided
    if (!formattedData.subjects) {
      formattedData.subjects = {};
    }
    
    if (!formattedData.active_subjects) {
      formattedData.active_subjects = [];
    }
    
    console.log('Formatted student data:', formattedData);
    
    const response = await apiToUse.post('/api/students/', formattedData);
    return response.data;
  } catch (error) {
    console.error('Create Student Error:', error);
    // Log more detailed error information
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
      console.error('Error response headers:', error.response.headers);
    }
    throw error;
  }
};

export const getStudents = async () => {
  try {
    console.log('Using API:', apiToUse.defaults.baseURL);
    console.log('Token in localStorage:', localStorage.getItem('token'));
    console.log('Making request to /api/students');
    
    // Force a token for testing purposes
    if (!localStorage.getItem('token')) {
      console.log('No token found, setting a test token');
      localStorage.setItem('token', 'test-token-for-debugging');
    }
    
    const response = await apiToUse.get('/api/students');
    console.log('Students API response:', response);
    
    // Ensure IDs are in the correct format
    const students = response.data.map(student => {
      // Handle cases where id might be missing or in different format
      const studentId = student._id || student.id;
      return {
        ...student,
        id: studentId ? studentId.toString() : null
      };
    });
    
    return students;
  } catch (error) {
    console.error('Get Students Error:', {
      message: error.message,
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method,
      responseData: error.response?.data
    });
    
    // For debugging purposes, return empty array instead of throwing
    console.log('Returning empty array instead of throwing error');
    return [];
  }
};

export const getStudentBySlug = async (slug) => {
  try {
    const response = await apiToUse.get(`/api/students/by-slug/${slug}`);
    return response.data;
  } catch (error) {
    console.error('Get Student By Slug Error:', {
      message: error.message,
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method,
      responseData: error.response?.data
    });
    throw error;
  }
};

export const updateStudentSlugs = async () => {
  try {
    const response = await apiToUse.post('/api/students/update-slugs');
    return response.data;
  } catch (error) {
    console.error('Update Student Slugs Error:', error);
    throw error;
  }
};

export const deleteStudent = async (studentId) => {
  // Validate the student ID format
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  if (!objectIdRegex.test(studentId)) {
    throw new Error('Invalid student ID format. Must be a 24-character hexadecimal string');
  }

  try {
    const response = await apiToUse.delete(`/api/students/${studentId}`);
    return response.data;
  } catch (error) {
    console.error('Delete Student Error:', error);
    throw error;
  }
};

// Content API
export const getContentBySubject = async (subjectId) => {
  try {
    const response = await apiToUse.get(`/api/content/subject/${subjectId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching content:', error);
    throw error;
  }
};

export const createContent = async (contentData) => {
  try {
    const response = await apiToUse.post('/api/content/', contentData);
    return response.data;
  } catch (error) {
    console.error('Error creating content:', error);
    throw error;
  }
};

// Progress API
export const updateProgress = async (studentId, contentId, progressData) => {
  try {
    const response = await apiToUse.post(`/api/progress/${studentId}/${contentId}`, progressData);
    return response.data;
  } catch (error) {
    console.error('Error updating progress:', error);
    throw error;
  }
};


export const logout = () => {
  localStorage.removeItem('token')
};

export const getLearningOutcome = async (studentId, learningOutcomeId) => {
  try {
    const response = await apiToUse.get(`/api/learning-outcomes/${studentId}/${learningOutcomeId}`);
    return response.data;
  } catch (error) {
    console.error('Error getting learning outcome:', error);
    throw error;
  }
};

export const getEvidenceForLearningOutcome = async (studentId, learningOutcomeId) => {
  try {
    const response = await apiToUse.get(`/api/learning-outcomes/${studentId}/${learningOutcomeId}/evidence`);
    return response.data;
  } catch (error) {
    console.error('Error getting evidence:', error);
    throw error;
  }
};

export default apiToUse;
