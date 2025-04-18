import { supabase, getSession, signOut } from '../services/supabase';

// Helper function to safely access localStorage
const safeLocalStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn('localStorage not available:', error);
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn('localStorage not available:', error);
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('localStorage not available:', error);
    }
  }
};

// Check if the token is expired or will expire soon (within 5 minutes)
export const isTokenExpired = (token) => {
  if (!token) return true;
  
  try {
    // Get the payload part of the JWT (second part)
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join('')
    );

    const { exp } = JSON.parse(jsonPayload);
    
    // Check if token will expire in the next 5 minutes
    return exp * 1000 < Date.now() + 5 * 60 * 1000;
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true; // If we can't verify, assume it's expired
  }
};

// Force logout and redirect to login page
export const forceLogout = async () => {
  console.log('Forcing logout due to invalid token');
  try {
    // Remove token from localStorage
    safeLocalStorage.removeItem('token');
    
    // Call Supabase sign out
    await signOut();
    
    // Redirect to login
    window.location.href = '/login?reason=session_expired';
  } catch (error) {
    console.error('Error during forced logout:', error);
    // Still redirect to login even if signOut fails
    window.location.href = '/login?reason=session_expired';
  }
};

// Get a fresh token, refreshing if needed
export const getAuthToken = async () => {
  try {
    // First try to get the current token from localStorage
    const currentToken = safeLocalStorage.getItem('token');
    
    // Check if we have a token and if it's not expired
    if (currentToken && !isTokenExpired(currentToken)) {
      return currentToken;
    }
    
    console.log('Token expired or missing, attempting refresh');
    
    // If no token or token is expired, try to refresh
    const session = await getSession();
    
    if (session && session.access_token) {
      console.log('Got fresh token from session');
      // Save the fresh token
      safeLocalStorage.setItem('token', session.access_token);
      return session.access_token;
    } else {
      console.warn('No valid session available, forcing logout');
      // No session or token, user needs to log in again
      await forceLogout();
      return null;
    }
  } catch (error) {
    console.error('Error getting auth token:', error);
    await forceLogout();
    return null;
  }
};

// Function to add authorization headers to fetch requests
export const authorizedFetch = async (url, options = {}) => {
  try {
    const token = await getAuthToken();
    
    if (!token) {
      throw new Error('No valid authentication token');
    }
    
    // Create headers with authorization
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
    
    // Make the fetch request with token
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    // Handle 401 Unauthorized errors
    if (response.status === 401) {
      const data = await response.json();
      console.error('Authentication failed:', data);
      
      // Try to get a fresh token one more time
      const freshToken = await getAuthToken();
      
      if (freshToken && freshToken !== token) {
        console.log('Got fresh token after 401, retrying request');
        // If we got a different token, retry the request
        const retryHeaders = {
          ...options.headers,
          'Authorization': `Bearer ${freshToken}`
        };
        
        return fetch(url, {
          ...options,
          headers: retryHeaders
        });
      } else {
        // If we couldn't get a fresh token or got the same one, force logout
        await forceLogout();
        throw new Error('Authentication failed: ' + (data.detail || 'Invalid token'));
      }
    }
    
    return response;
  } catch (error) {
    console.error('Error making authorized fetch:', error);
    throw error;
  }
}; 