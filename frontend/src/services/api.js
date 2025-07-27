import axios from 'axios';
import { supabase, getSession } from './supabase';

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
const addAuthToken = async (config) => {
  try {
    // Get session from Supabase
    const session = await getSession();
    
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch (error) {
    console.error('Error getting Supabase session:', error);
  }
  
  return config;
};

api.interceptors.request.use(addAuthToken);
productionApi.interceptors.request.use(addAuthToken);

// Determine which API to use based on the environment
const apiToUse = window.location.hostname === 'localhost' ? api : productionApi;

export const login = async (credentials) => {
  try {
    // Use Supabase for authentication
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email || credentials.username,
      password: credentials.password,
    });
    
    if (error) throw error;
    
    console.log('Supabase Login Response:', data);
    
    return { data: { token: data.session?.access_token } };
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

export const getStudents = async (accessLevel = null) => {
  try {
    console.log('Using API:', apiToUse.defaults.baseURL);
    console.log('Token in localStorage:', localStorage.getItem('token'));
    console.log(`Making request to /api/students/for-parent${accessLevel ? `?access_level=${accessLevel}` : ''}`);
    
    // Add access_level as a query parameter if provided
    const response = await apiToUse.get('/api/students/for-parent', {
      params: accessLevel ? { access_level: accessLevel } : {}
    });
    
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
    
    // For debugging purposes, return empty array instead of throwing error
    console.log('Returning empty array instead of throwing error');
    return [];
  }
};

// Function to get students with admin access specifically
export const getStudentsWithAdminAccess = async () => {
  return getStudents('admin');
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

// Parent Access Management
export const getStudentParents = async (studentId) => {
  try {
    const response = await apiToUse.get(`/api/students/${studentId}/parents`);
    return response.data;
  } catch (error) {
    console.error('Get Student Parents Error:', error);
    throw error;
  }
};

export const addParentAccess = async (studentId, email, accessLevel) => {
  try {
    const response = await apiToUse.post(`/api/students/${studentId}/parents`, {
      email,
      access_level: accessLevel
    });
    return response.data;
  } catch (error) {
    console.error('Add Parent Access Error:', error);
    throw error;
  }
};

export const updateParentAccess = async (studentId, parentId, accessLevel) => {
  try {
    const response = await apiToUse.put(`/api/students/${studentId}/parents/${parentId}`, {
      access_level: accessLevel
    });
    return response.data;
  } catch (error) {
    console.error('Update Parent Access Error:', error);
    throw error;
  }
};

export const removeParentAccess = async (studentId, parentId) => {
  try {
    const response = await apiToUse.delete(`/api/students/${studentId}/parents/${parentId}`);
    return response.data;
  } catch (error) {
    console.error('Remove Parent Access Error:', error);
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


export const logout = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Logout Error:', error);
    throw error;
  }
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
    console.log('Fetching evidence for:', { studentId, learningOutcomeId });
    console.log('Current token:', localStorage.getItem('token'));
    
    const response = await apiToUse.get(`/api/learning-outcomes/${studentId}/${learningOutcomeId}/evidence`);
    
    console.log('Evidence API response:', response);
    return response.data;
  } catch (error) {
    console.error('Error getting evidence:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      config: error.config
    });
    throw error;
  }
};

export const getLatestEvidenceForOutcomes = async (studentId, outcomeCodes) => {
  try {
    console.log('Fetching latest evidence for outcomes:', { studentId, outcomeCodes });
    
    // Use batch endpoint if there are multiple outcomes (more efficient)
    if (outcomeCodes.length > 1) {
      return await getBatchEvidenceForOutcomes(studentId, outcomeCodes);
    }
    
    // Fallback to individual requests for a single outcome or empty array
    const evidenceMap = {};
    
    // Fetch evidence for each outcome code
    for (const outcomeCode of outcomeCodes) {
      try {
        const evidence = await getEvidenceForLearningOutcome(studentId, outcomeCode);
        if (evidence && evidence.length > 0) {
          // Sort by uploaded_at date (newest first) and take the first one
          const sortedEvidence = evidence.sort((a, b) => {
            return new Date(b.uploaded_at) - new Date(a.uploaded_at);
          });
          evidenceMap[outcomeCode] = sortedEvidence[0];
        }
      } catch (err) {
        console.error(`Error fetching evidence for outcome ${outcomeCode}:`, err);
        // Continue with other outcomes even if one fails
      }
    }
    
    return evidenceMap;
  } catch (error) {
    console.error('Error getting latest evidence for outcomes:', error);
    return {};
  }
};

// New function to get evidence for multiple outcomes in a single request
export const getBatchEvidenceForOutcomes = async (studentId, outcomeCodes) => {
  try {
    // Combine all outcome codes into a comma-separated string
    const outcomeCodesParam = outcomeCodes.join(',');
    
    console.log(`Fetching batch evidence for student ${studentId} with ${outcomeCodes.length} outcomes`);
    
    // Make a single API call to get all evidence at once
    const response = await apiToUse.get(
      `/api/evidence/batch/student/${studentId}?outcomes=${outcomeCodesParam}`
    );
    
    console.log(`Received batch evidence response with ${Object.keys(response.data).length} items`);
    return response.data;
  } catch (error) {
    console.error('Error fetching batch evidence:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    return {}; // Return empty object on error
  }
};

// Evidence management functions
export const deleteEvidence = async (studentId, learningOutcomeId, evidenceId) => {
  try {
    const response = await apiToUse.delete(
      `/api/learning-outcomes/${studentId}/${learningOutcomeId}/evidence/${evidenceId}`
    );
    return response.data;
  } catch (error) {
    console.error('Error deleting evidence:', error);
    
    // If the evidence is not found (404), consider it already deleted and return success
    if (error.response?.status === 404) {
      console.log('Evidence not found (404), treating as already deleted');
      return { success: true, message: 'Evidence already deleted or does not exist' };
    }
    
    // Add more details to the error
    const errorDetail = error.response?.data?.detail || error.message || 'Unknown error';
    const enhancedError = new Error(`Failed to delete evidence: ${errorDetail}`);
    enhancedError.statusCode = error.response?.status;
    enhancedError.originalError = error;
    
    throw enhancedError;
  }
};

export const getEvidenceDownloadUrl = async (studentId, learningOutcomeId, evidenceId) => {
  try {
    const response = await apiToUse.get(
      `/api/learning-outcomes/${studentId}/${learningOutcomeId}/evidence/${evidenceId}/download`
    );
    return response.data.download_url;
  } catch (error) {
    console.error('Error getting evidence download URL:', error);
    throw error;
  }
};

export const getCurrentUser = async () => {
  try {
    const response = await apiToUse.get('/api/users/me');
    return response.data;
  } catch (error) {
    console.error('Error getting current user:', error);
    throw error;
  }
};

export const getEvidenceShareUrl = async (studentId, learningOutcomeId, evidenceId) => {
  try {
    const response = await apiToUse.post(
      `/api/learning-outcomes/${studentId}/${learningOutcomeId}/evidence/${evidenceId}/share`
    );
    return response.data.share_url;
  } catch (error) {
    console.error('Error getting evidence share URL:', error);
    throw error;
  }
};

// AI Description Generation
export const generateAIDescription = async (files, contextDescription) => {
  try {
    // Validate inputs
    if (!files || files.length === 0) { // Check if files array is empty
      throw new Error('No files provided');
    }
    
    if (!contextDescription) {
      throw new Error('No context description provided');
    }
    
    // Log file details for debugging (log the first file for brevity)
    if (files.length > 0) {
      const firstFile = files[0];
      console.log(`Generating description for ${files.length} file(s). First file details:`, {
        name: firstFile.name,
        type: firstFile.type,
        size: firstFile.size,
        lastModified: new Date(firstFile.lastModified).toISOString()
      });
    }
    
    // Create FormData
    const formData = new FormData();
    // Append all files with the key 'files'
    files.forEach((file, index) => {
      formData.append('files', file); 
    });
    formData.append('context_description', contextDescription);

    // Log FormData contents for debugging
    console.log('--- FormData for AI Description ---');
    for (let [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`${key}: File: ${value.name} (${value.type}, ${value.size} bytes)`);
      } else {
        console.log(`${key}: ${value}`);
      }
    }
    console.log('---------------------------------');
    
    console.log('Sending request to /api/v1/ai/generate-description');
    console.log('API base URL:', apiToUse.defaults.baseURL);

    // Important: Set Content-Type to null to let the browser set the correct boundary
    // This prevents axios from overriding the automatically set multipart/form-data header
    const response = await apiToUse.post('/api/v1/ai/generate-description', formData, {
      headers: {
        'Content-Type': null, // Let axios set the correct multipart/form-data header with boundary
      },
    });
    
    console.log('AI Description Response:', response.data);
    return response.data; // Should contain { description: "..." }
  } catch (error) {
    console.error('Error generating AI description:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers,
        baseURL: error.config?.baseURL
      }
    });
    
    // If we have a response with data, log it in detail
    if (error.response?.data) {
      console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    // Re-throw the error so the component can handle it
    throw error; 
  }
};

// AI Image Analysis for Questions
export const analyzeImageForQuestions = async (files) => {
  try {
    // Validate inputs
    if (!files || files.length === 0) {
      throw new Error('No files provided');
    }
    
    // Log file details for debugging
    if (files.length > 0) {
      const firstFile = files[0];
      console.log(`Analyzing ${files.length} file(s) for questions. First file details:`, {
        name: firstFile.name,
        type: firstFile.type,
        size: firstFile.size,
        lastModified: new Date(firstFile.lastModified).toISOString()
      });
    }
    
    // Create FormData
    const formData = new FormData();
    // Append all files with the key 'files'
    files.forEach((file) => {
      formData.append('files', file); 
    });

    // Log FormData contents for debugging
    console.log('--- FormData for AI Image Analysis ---');
    for (let [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`${key}: File: ${value.name} (${value.type}, ${value.size} bytes)`);
      } else {
        console.log(`${key}: ${value}`);
      }
    }
    console.log('---------------------------------');
    
    console.log('Sending request to /api/v1/ai/analyze-image');
    console.log('API base URL:', apiToUse.defaults.baseURL);

    const response = await apiToUse.post('/api/v1/ai/analyze-image', formData, {
      headers: {
        'Content-Type': null, // Let axios set the correct multipart/form-data header
      },
    });
    
    console.log('AI Image Analysis Response:', response.data);
    return response.data; // Should contain { questions: [...] }
  } catch (error) {
    console.error('Error analyzing image for questions:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers,
        baseURL: error.config?.baseURL
      }
    });
    
    if (error.response?.data) {
      console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    throw error; 
  }
};

// AI Learning Outcome Suggestions
export const suggestLearningOutcomes = async (files, questionAnswers, curriculumData, studentGrade) => {
  try {
    // Validate inputs
    if (!files || files.length === 0) {
      throw new Error('No files provided');
    }
    
    if (!questionAnswers) {
      throw new Error('No question answers provided');
    }
    
    if (!curriculumData) {
      throw new Error('No curriculum data provided');
    }
    
    if (!studentGrade) {
      throw new Error('No student grade provided');
    }
    
    // Log file details for debugging
    if (files.length > 0) {
      const firstFile = files[0];
      console.log(`Suggesting outcomes for ${files.length} file(s), grade: ${studentGrade}. First file details:`, {
        name: firstFile.name,
        type: firstFile.type,
        size: firstFile.size,
        lastModified: new Date(firstFile.lastModified).toISOString()
      });
    }
    
    // Create FormData
    const formData = new FormData();
    
    // Append all files with the key 'files'
    files.forEach((file) => {
      formData.append('files', file); 
    });
    
    // Append other data as JSON strings
    formData.append('question_answers', JSON.stringify(questionAnswers));
    formData.append('curriculum_data', JSON.stringify(curriculumData));
    formData.append('student_grade', studentGrade);

    // Log FormData contents for debugging
    console.log('--- FormData for AI Outcome Suggestions ---');
    for (let [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`${key}: File: ${value.name} (${value.type}, ${value.size} bytes)`);
      } else {
        console.log(`${key}: ${value.length > 100 ? value.substring(0, 100) + '...' : value}`);
      }
    }
    console.log('---------------------------------');
    
    console.log('Sending request to /api/v1/ai/suggest-outcomes');
    console.log('API base URL:', apiToUse.defaults.baseURL);

    const response = await apiToUse.post('/api/v1/ai/suggest-outcomes', formData, {
      headers: {
        'Content-Type': null, // Let axios set the correct multipart/form-data header
      },
    });
    
    console.log('AI Outcome Suggestions Response:', response.data);
    return response.data; // Should contain { outcomes: [...] }
  } catch (error) {
    console.error('Error suggesting learning outcomes:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers,
        baseURL: error.config?.baseURL
      }
    });
    
    if (error.response?.data) {
      console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    throw error; 
  }
};

// New function for uploading evidence
export const uploadEvidence = async (studentId, learningOutcomeId, formData) => {
  try {
    // Log FormData contents for debugging
    console.log('--- FormData for Evidence Upload ---');
    for (let [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`${key}: File: ${value.name} (${value.type}, ${value.size} bytes)`);
      } else {
        console.log(`${key}: ${value}`);
      }
    }
    console.log('---------------------------------');
    
    console.log(`Sending request to /api/learning-outcomes/${studentId}/${learningOutcomeId}/evidence`);
    console.log('API base URL:', apiToUse.defaults.baseURL);

    // Use the correct API instance and endpoint
    // Pass learningOutcomeId in the path, other data is in formData
    const response = await apiToUse.post(
      `/api/learning-outcomes/${studentId}/${learningOutcomeId}/evidence`, 
      formData, 
      {
        headers: {
          // Let browser set Content-Type for FormData
          'Content-Type': null, 
        },
      }
    );
    
    console.log('Evidence Upload Response:', response.data);
    
    // Transform the response data to match the expected format
    const transformedData = {
      ...response.data,
      uploaded_files: response.data.uploaded_files.map(file => ({
        ...file,
        original_url: file.file_url,
        thumbnail_small_url: file.thumbnail_url ? `${file.thumbnail_url}?width=150&height=150&quality=80` : null,
        thumbnail_medium_url: file.thumbnail_url ? `${file.thumbnail_url}?width=600&height=450&quality=85` : null,
        thumbnail_large_url: file.thumbnail_url ? `${file.thumbnail_url}?width=800&height=600&quality=85` : null
      }))
    };
    
    return transformedData;
  } catch (error) {
    console.error('Error uploading evidence:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers,
        baseURL: error.config?.baseURL
      }
    });
    
    if (error.response?.data) {
      console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    throw error; // Re-throw for component handling
  }
};

// New function for uploading evidence to multiple outcomes
export const uploadEvidenceMultiOutcome = async (studentId, formData) => {
  try {
    // Log FormData contents for debugging
    console.log('--- FormData for Multi-Outcome Evidence Upload ---');
    for (let [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`${key}: File: ${value.name} (${value.type}, ${value.size} bytes)`);
      } else {
        console.log(`${key}: ${value}`);
      }
    }
    console.log('---------------------------------');
    
    console.log(`Sending request to /api/evidence/${studentId}`);
    console.log('API base URL:', apiToUse.defaults.baseURL);

    // Use the new multi-outcome endpoint
    const response = await apiToUse.post(
      `/api/evidence/${studentId}`, 
      formData, 
      {
        headers: {
          // Let browser set Content-Type for FormData
          'Content-Type': null, 
        },
      }
    );
    
    console.log('Multi-Outcome Evidence Upload Response:', response.data);
    
    // Transform the response data to match the expected format
    const transformedData = {
      ...response.data,
      uploaded_files: response.data.uploaded_files.map(file => ({
        ...file,
        original_url: file.file_url,
        thumbnail_small_url: file.thumbnail_url ? `${file.thumbnail_url}?width=150&height=150&quality=80` : null,
        thumbnail_medium_url: file.thumbnail_url ? `${file.thumbnail_url}?width=600&height=450&quality=85` : null,
        thumbnail_large_url: file.thumbnail_url ? `${file.thumbnail_url}?width=800&height=600&quality=85` : null
      }))
    };
    
    return transformedData;
  } catch (error) {
    console.error('Error uploading multi-outcome evidence:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers,
        baseURL: error.config?.baseURL
      }
    });
    
    if (error.response?.data) {
      console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    throw error; // Re-throw for component handling
  }
};

export const updateEvidence = async (studentId, learningOutcomeId, evidenceId, data) => {
  try {
    const response = await apiToUse.patch(
      `/api/learning-outcomes/${studentId}/${learningOutcomeId}/evidence/${evidenceId}`,
      data
    );
    return response.data;
  } catch (error) {
    console.error('Error updating evidence:', error);
    throw error;
  }
};

// File and image management
export const uploadFile = async (file, path) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('file_path', path);
    
    const response = await apiToUse.post('/api/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Upload File Error:', error);
    throw error;
  }
};

export const getSignedUrl = async (params) => {
  try {
    const response = await apiToUse.post('/api/files/signed-url', params);
    return response.data;
  } catch (error) {
    console.error('Get Signed URL Error:', error);
    throw error;
  }
};

export const deleteFile = async (filePath) => {
  try {
    const response = await apiToUse.post('/api/files/delete', { file_path: filePath });
    return response.data;
  } catch (error) {
    console.error('Delete File Error:', error);
    throw error;
  }
};

// Migration API functions
export const getMigrationStatus = async () => {
  try {
    const response = await apiToUse.get('/api/files/migration/status');
    return response.data;
  } catch (error) {
    console.error('Get Migration Status Error:', error);
    throw error;
  }
};

export const listMigrationImages = async (imageType = 'public', limit = 50) => {
  try {
    const response = await apiToUse.get('/api/files/migration/images', {
      params: { image_type: imageType, limit: limit }
    });
    return response.data;
  } catch (error) {
    console.error('List Migration Images Error:', error);
    throw error;
  }
};

export const migrateSingleImage = async (publicId) => {
  try {
    const response = await apiToUse.post('/api/files/migration/migrate-image', { public_id: publicId });
    return response.data;
  } catch (error) {
    console.error('Migrate Single Image Error:', error);
    throw error;
  }
};

export const bulkMigrateImages = async (publicIds) => {
  try {
    const response = await apiToUse.post('/api/files/migration/bulk-migrate', { public_ids: publicIds });
    return response.data;
  } catch (error) {
    console.error('Bulk Migrate Images Error:', error);
    throw error;
  }
};

export const setMigrationMode = async (mode) => {
  try {
    const response = await apiToUse.post('/api/files/migration/set-mode', { mode });
    return response.data;
  } catch (error) {
    console.error('Set Migration Mode Error:', error);
    throw error;
  }
};

// Cleanup functions (DANGEROUS - for starting fresh)
export const deleteAllPublicImages = () => apiToUse.post('/api/files/migration/cleanup/delete-all-public', { 
  confirm_delete_all: 'YES_DELETE_ALL_PUBLIC_IMAGES' 
});
export const deleteAllPrivateImages = () => apiToUse.post('/api/files/migration/cleanup/delete-all-private', { 
  confirm_delete_all: 'YES_DELETE_ALL_PRIVATE_IMAGES' 
});
export const deleteAllCloudinaryImages = () => apiToUse.post('/api/files/migration/cleanup/delete-all-cloudinary', { 
  confirm_delete_all: 'YES_DELETE_EVERYTHING_FROM_CLOUDINARY' 
});

// Student Report Functions
export const getStudentReports = async (studentId, params = {}) => {
  try {
    console.log('Fetching reports for student:', studentId, params);
    const response = await apiToUse.get(`/api/reports/${studentId}`, { params });
    return response.data;
  } catch (error) {
    console.error('Get Student Reports Error:', error);
    throw error;
  }
};

export const getReportById = async (studentId, reportId) => {
  try {
    console.log('Fetching report:', reportId, 'for student:', studentId);
    const response = await apiToUse.get(`/api/reports/${studentId}/${reportId}`);
    return response.data;
  } catch (error) {
    console.error('Get Report Error:', error);
    throw error;
  }
};

export const generateReport = async (studentId, reportData) => {
  try {
    console.log('Generating report for student:', studentId, reportData);
    const response = await apiToUse.post(`/api/reports/${studentId}/generate`, reportData);
    return response.data;
  } catch (error) {
    console.error('Generate Report Error:', error);
    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw error;
  }
};

export const updateLearningAreaSummary = async (studentId, reportId, learningAreaCode, summaryData) => {
  try {
    console.log('Updating learning area summary:', { studentId, reportId, learningAreaCode, summaryData });
    const response = await apiToUse.put(
      `/api/reports/${studentId}/${reportId}/learning-area/${learningAreaCode}`,
      summaryData
    );
    return response.data;
  } catch (error) {
    console.error('Update Learning Area Summary Error:', error);
    throw error;
  }
};

export const deleteReport = async (studentId, reportId) => {
  try {
    console.log('Deleting report:', reportId, 'for student:', studentId);
    const response = await apiToUse.delete(`/api/reports/${studentId}/${reportId}`);
    return response.data;
  } catch (error) {
    console.error('Delete Report Error:', error);
    throw error;
  }
};

export default apiToUse;
