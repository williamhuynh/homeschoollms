import axios from 'axios';
import { supabase, getSession } from './supabase';

// Resolve base URL: prefer explicit env, otherwise same-origin (works on prod/staging), fallback to localhost
const resolvedBaseURL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost:8000');

// Create API instance with base URL
const api = axios.create({
  baseURL: resolvedBaseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create a separate instance for explicitly configured remote API (optional)
const productionApi = axios.create({
  baseURL: import.meta.env.VITE_REMOTE_API_URL || 'https://homeschoollms-server.onrender.com',
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

// Determine which API to use
// Prefer explicit env-configured API; otherwise use same-origin. Only use remote URL if VITE_REMOTE_API_URL is provided.
const apiToUse = import.meta.env.VITE_API_URL
  ? api
  : (import.meta.env.VITE_REMOTE_API_URL ? productionApi : api);

// Helpful debug log
console.log('Using API base URL:', apiToUse.defaults.baseURL);

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

export const healthCheck = async () => {
  try {
    const response = await apiToUse.get('/health');
    return response.data;
  } catch (error) {
    console.error('API Health Check Error:', error);
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

// Reports API (re-add)
export const getStudentReports = async (studentId, params = {}) => {
  try {
    const response = await apiToUse.get(`/api/reports/${studentId}`, { params });
    return response.data;
  } catch (error) {
    console.error('Get Student Reports Error:', error);
    throw error;
  }
};

export const generateReport = async (studentId, reportData) => {
  try {
    const payload = { ...reportData };
    if (reportData.grade_level) payload.grade_level = reportData.grade_level;
    const response = await apiToUse.post(`/api/reports/${studentId}/generate`, payload);
    return response.data;
  } catch (error) {
    console.error('Generate Report Error:', error);
    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw error;
  }
};

export const deleteReport = async (studentId, reportId) => {
  try {
    const response = await apiToUse.delete(`/api/reports/${studentId}/${reportId}`);
    return response.data;
  } catch (error) {
    console.error('Delete Report Error:', error);
    throw error;
  }
};

export const updateReportTitle = async (studentId, reportId, title) => {
  try {
    const response = await apiToUse.put(`/api/reports/${studentId}/${reportId}/title`, { title });
    return response.data;
  } catch (error) {
    console.error('Update Report Title Error:', error);
    throw error;
  }
};

export const updateReportStatus = async (studentId, reportId, status) => {
  try {
    const response = await apiToUse.put(`/api/reports/${studentId}/${reportId}/status`, { status });
    return response.data;
  } catch (error) {
    console.error('Update Report Status Error:', error);
    throw error;
  }
};

export const regenerateReport = async (studentId, reportId) => {
  try {
    const response = await apiToUse.post(`/api/reports/${studentId}/${reportId}/regenerate`);
    return response.data;
  } catch (error) {
    console.error('Regenerate Report Error:', error);
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
    const response = await apiToUse.post('/api/students/actions/update-slugs');
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

export const updateStudentGrade = async (studentIdOrSlug, newGradeLevel) => {
  try {
    const response = await apiToUse.patch(`/api/students/${studentIdOrSlug}/grade`, {
      new_grade_level: newGradeLevel
    });
    return response.data;
  } catch (error) {
    console.error('Update Student Grade Error:', error);
    throw error;
  }
};

// Evidence and AI helpers (re-add)
export const uploadEvidence = async (studentId, learningOutcomeId, formData) => {
  try {
    const response = await apiToUse.post(
      `/api/learning-outcomes/${studentId}/${learningOutcomeId}/evidence`,
      formData,
      { headers: { 'Content-Type': null } }
    );
    return response.data;
  } catch (error) {
    console.error('Error uploading evidence:', error);
    throw error;
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

export const uploadEvidenceMultiOutcome = async (studentId, formData) => {
  try {
    const response = await apiToUse.post(`/api/evidence/${studentId}`, formData, {
      headers: { 'Content-Type': null }
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading multi-outcome evidence:', error);
    throw error;
  }
};

export const generateAIDescription = async (files, contextDescription) => {
  try {
    if (!files || files.length === 0) throw new Error('No files provided')
    if (!contextDescription) throw new Error('No context description provided')

    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))
    formData.append('context_description', contextDescription)

    const response = await apiToUse.post('/api/v1/ai/generate-description', formData, {
      headers: { 'Content-Type': null }
    })
    // Response now includes { description, title }
    return response.data
  } catch (error) {
    console.error('Error generating AI description:', error)
    throw error
  }
};

export const analyzeImageForQuestions = async (files) => {
  try {
    if (!files || files.length === 0) throw new Error('No files provided')
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))
    const response = await apiToUse.post('/api/v1/ai/analyze-image', formData, {
      headers: { 'Content-Type': null }
    })
    return response.data
  } catch (error) {
    console.error('Error analyzing image for questions:', error)
    throw error
  }
};

export const suggestLearningOutcomes = async (files, questionAnswers, curriculumData, studentGrade) => {
  try {
    if (!files || !Array.isArray(files)) throw new Error('Files must be an array')
    if (!questionAnswers) throw new Error('No question answers provided')
    if (!curriculumData) throw new Error('No curriculum data provided')
    if (!studentGrade) throw new Error('No student grade provided')

    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))
    formData.append('question_answers', JSON.stringify(questionAnswers))
    formData.append('curriculum_data', JSON.stringify(curriculumData))
    formData.append('student_grade', studentGrade)

    const response = await apiToUse.post('/api/v1/ai/suggest-outcomes', formData, {
      headers: { 'Content-Type': null }
    })
    return response.data
  } catch (error) {
    console.error('Error suggesting learning outcomes:', error)
    throw error
  }
};

// Migration API functions (re-add)
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

// Cleanup functions
export const deleteAllPublicImages = async () => apiToUse.post('/api/files/migration/cleanup/delete-all-public', { 
  confirm_delete_all: 'YES_DELETE_ALL_PUBLIC_IMAGES' 
});
export const deleteAllPrivateImages = async () => apiToUse.post('/api/files/migration/cleanup/delete-all-private', { 
  confirm_delete_all: 'YES_DELETE_ALL_PRIVATE_IMAGES' 
});
export const deleteAllCloudinaryImages = async () => apiToUse.post('/api/files/migration/cleanup/delete-all-cloudinary', { 
  confirm_delete_all: 'YES_DELETE_EVERYTHING_FROM_CLOUDINARY' 
});

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
        continue;
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

// Signed image URL generation
export const getSignedUrl = async (request) => {
  try {
    const response = await apiToUse.post('/api/files/signed-url', request);
    return response.data;
  } catch (error) {
    console.error('Error getting signed URL:', error);
    throw error;
  }
};

// Student profile update API
export const updateStudent = async (studentIdOrSlug, updates) => {
  try {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(studentIdOrSlug);
    const path = isObjectId ? `/api/students/${studentIdOrSlug}` : `/api/students/by-slug/${studentIdOrSlug}`;
    const response = await apiToUse.patch(path, updates);
    return response.data;
  } catch (error) {
    console.error('Error updating student:', error);
    throw error;
  }
};

export const uploadStudentAvatar = async (studentIdOrSlug, file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiToUse.post(`/api/students/${studentIdOrSlug}/avatar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading student avatar:', error);
    throw error;
  }
};

export const updateLearningAreaSummary = async (studentId, reportId, learningAreaCode, summaryData) => {
  try {
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

export const getReportById = async (studentId, reportId) => {
  try {
    const response = await apiToUse.get(`/api/reports/${studentId}/${reportId}`);
    return response.data;
  } catch (error) {
    console.error('Get Report Error:', error);
    throw error;
  }
};

export const chatWithAI = async (studentId, messages) => {
  try {
    const response = await apiToUse.post('/api/v1/ai/chat', {
      student_id: studentId,
      messages,
    });
    return response.data;
  } catch (error) {
    console.error('AI Chat Error:', error);
    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw error;
  }
};

// =====================
// Subscription API
// =====================

export const getSubscriptionPricing = async () => {
  try {
    const response = await apiToUse.get('/api/stripe/subscription/pricing');
    return response.data;
  } catch (error) {
    console.error('Get Subscription Pricing Error:', error);
    throw error;
  }
};

export const getSubscriptionStatus = async () => {
  try {
    const response = await apiToUse.get('/api/stripe/subscription/status');
    return response.data;
  } catch (error) {
    console.error('Get Subscription Status Error:', error);
    throw error;
  }
};

export const getSubscriptionUsage = async () => {
  try {
    const response = await apiToUse.get('/api/stripe/subscription/usage');
    return response.data;
  } catch (error) {
    console.error('Get Subscription Usage Error:', error);
    throw error;
  }
};

export const createCheckoutSession = async (priceId, successUrl, cancelUrl) => {
  try {
    const response = await apiToUse.post('/api/stripe/checkout/session', {
      price_id: priceId,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    return response.data;
  } catch (error) {
    console.error('Create Checkout Session Error:', error);
    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw error;
  }
};

export const createPortalSession = async (returnUrl) => {
  try {
    const response = await apiToUse.post('/api/stripe/portal/session', {
      return_url: returnUrl,
    });
    return response.data;
  } catch (error) {
    console.error('Create Portal Session Error:', error);
    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw error;
  }
};

export const canAddStudent = async () => {
  try {
    const response = await apiToUse.get('/api/stripe/can-add-student');
    return response.data;
  } catch (error) {
    console.error('Can Add Student Check Error:', error);
    throw error;
  }
};

export const canAddEvidence = async () => {
  try {
    const response = await apiToUse.get('/api/stripe/can-add-evidence');
    return response.data;
  } catch (error) {
    console.error('Can Add Evidence Check Error:', error);
    throw error;
  }
};

export const canGenerateReports = async () => {
  try {
    const response = await apiToUse.get('/api/stripe/can-generate-reports');
    return response.data;
  } catch (error) {
    console.error('Can Generate Reports Check Error:', error);
    throw error;
  }
};

// =====================
// Super Admin API
// =====================

export const adminListUsers = async (params = {}) => {
  try {
    const response = await apiToUse.get('/api/admin/users', { params });
    return response.data;
  } catch (error) {
    console.error('Admin List Users Error:', error);
    throw error;
  }
};

export const adminGetUser = async (userId) => {
  try {
    const response = await apiToUse.get(`/api/admin/users/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Admin Get User Error:', error);
    throw error;
  }
};

export const adminGetUserByEmail = async (email) => {
  try {
    const response = await apiToUse.get(`/api/admin/users/by-email/${encodeURIComponent(email)}`);
    return response.data;
  } catch (error) {
    console.error('Admin Get User By Email Error:', error);
    throw error;
  }
};

export const adminUpdateUserProfile = async (userId, updates) => {
  try {
    const response = await apiToUse.put(`/api/admin/users/${userId}/profile`, updates);
    return response.data;
  } catch (error) {
    console.error('Admin Update User Profile Error:', error);
    throw error;
  }
};

export const adminUpdateUserSubscription = async (userId, updates) => {
  try {
    const response = await apiToUse.put(`/api/admin/users/${userId}/subscription`, updates);
    return response.data;
  } catch (error) {
    console.error('Admin Update User Subscription Error:', error);
    throw error;
  }
};

export const adminDeactivateUser = async (userId) => {
  try {
    const response = await apiToUse.post(`/api/admin/users/${userId}/deactivate`);
    return response.data;
  } catch (error) {
    console.error('Admin Deactivate User Error:', error);
    throw error;
  }
};

export const adminReactivateUser = async (userId) => {
  try {
    const response = await apiToUse.post(`/api/admin/users/${userId}/reactivate`);
    return response.data;
  } catch (error) {
    console.error('Admin Reactivate User Error:', error);
    throw error;
  }
};

export const adminDeleteUser = async (userId, permanent = false) => {
  try {
    const response = await apiToUse.delete(`/api/admin/users/${userId}`, {
      data: { permanent }
    });
    return response.data;
  } catch (error) {
    console.error('Admin Delete User Error:', error);
    throw error;
  }
};

export const adminListAllStudents = async (params = {}) => {
  try {
    const response = await apiToUse.get('/api/admin/students', { params });
    return response.data;
  } catch (error) {
    console.error('Admin List All Students Error:', error);
    throw error;
  }
};

export const adminGetStudent = async (studentId) => {
  try {
    const response = await apiToUse.get(`/api/admin/students/${studentId}`);
    return response.data;
  } catch (error) {
    console.error('Admin Get Student Error:', error);
    throw error;
  }
};

export const adminImpersonate = async (userId) => {
  try {
    const response = await apiToUse.post('/api/admin/impersonate', { user_id: userId });
    return response.data;
  } catch (error) {
    console.error('Admin Impersonate Error:', error);
    throw error;
  }
};

export const adminGetPlatformStats = async () => {
  try {
    const response = await apiToUse.get('/api/admin/stats');
    return response.data;
  } catch (error) {
    console.error('Admin Get Platform Stats Error:', error);
    throw error;
  }
};

export default apiToUse;
