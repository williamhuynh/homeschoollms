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
  const response = await fetch(`${API_BASE_URL}/api/students`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`  // Assuming you have this function
    },
    body: JSON.stringify(studentData)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to create student')
  }

  return response.json()
}


export const getStudents = async () => {
  const response = await fetch(`${API_BASE_URL}/api/students`, {
    headers: {
      'Authorization': `Bearer ${getToken()}`
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch students')
  }

  return response.json()
}

export default api;