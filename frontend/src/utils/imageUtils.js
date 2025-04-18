/**
 * Utility functions for image handling and optimization
 */

/**
 * Determines the appropriate thumbnail size based on display requirements
 * 
 * @param {Object} options - Configuration options
 * @param {number} options.containerWidth - Width of the container in pixels
 * @param {number} options.containerHeight - Height of the container in pixels
 * @param {string} options.displayType - Type of display ('thumbnail', 'preview', 'fullsize')
 * @param {boolean} options.highDensityDisplay - Whether the device has a high density display
 * @returns {string} - The appropriate thumbnail size ('small', 'medium', 'large', 'original')
 */
export const getAppropriateImageSize = ({
  containerWidth = 0,
  containerHeight = 0,
  displayType = 'thumbnail',
  highDensityDisplay = window.devicePixelRatio > 1
}) => {
  // Get the larger dimension
  const largerDimension = Math.max(containerWidth, containerHeight);
  
  // Adjust for high density displays
  const adjustedSize = highDensityDisplay ? largerDimension * window.devicePixelRatio : largerDimension;
  
  // Determine size based on display type and adjusted size
  switch (displayType) {
    case 'thumbnail':
      if (adjustedSize <= 150) return 'small';
      if (adjustedSize <= 300) return 'medium';
      return 'large';
      
    case 'preview':
      if (adjustedSize <= 300) return 'medium';
      return 'large';
      
    case 'fullsize':
      if (adjustedSize <= 600) return 'large';
      return 'original';
      
    default:
      if (adjustedSize <= 150) return 'small';
      if (adjustedSize <= 300) return 'medium';
      if (adjustedSize <= 600) return 'large';
      return 'original';
  }
};

/**
 * Gets the URL for the appropriate thumbnail size, with optional transformations
 *
 * @param {Object} image - Image object with thumbnail URLs
 * @param {string} size - Size to retrieve ('small', 'medium', 'large', 'original')
 * @param {Object} options - Optional transformation parameters
 * @param {number} options.width - Requested width (optional)
 * @param {number} options.height - Requested height (optional)
 * @param {string} options.format - Requested format (webp, jpeg, png) (optional)
 * @param {number} options.quality - Image quality (1-100) (optional)
 * @returns {string} - The URL for the requested size with transformations
 */
export const getThumbnailUrl = (image, size = 'medium', options = {}) => {
  if (!image) return null;

  // Get the base URL based on size
  let baseUrl;
  switch (size) {
    case 'small':
      baseUrl = image.thumbnail_small_url;
      break;
    case 'medium':
      baseUrl = image.thumbnail_medium_url;
      break;
    case 'large':
      baseUrl = image.thumbnail_large_url;
      break;
    default:
      baseUrl = image.original_url;
  }

  if (!baseUrl) return null;

  // Create URL object for manipulation
  const url = new URL(baseUrl);

  // Apply transformations
  if (options.width) {
    url.searchParams.set('width', options.width);
  }
  
  if (options.height) {
    url.searchParams.set('height', options.height);
  }
  
  if (options.format) {
    url.searchParams.set('format', options.format);
  }
  
  if (options.quality) {
    url.searchParams.set('quality', options.quality);
  }

  return url.toString();
};

/**
 * Checks if WebP format is supported by the browser
 * 
 * @returns {Promise<boolean>} - Promise that resolves to true if WebP is supported
 */
export const isWebPSupported = async () => {
  // If we've already checked, return the cached result
  if (typeof isWebPSupported.supported !== 'undefined') {
    return isWebPSupported.supported;
  }
  
  return new Promise(resolve => {
    const webP = new Image();
    webP.onload = function() {
      // The image loaded successfully, WebP is supported
      isWebPSupported.supported = true;
      resolve(true);
    };
    webP.onerror = function() {
      // The image failed to load, WebP is not supported
      isWebPSupported.supported = false;
      resolve(false);
    };
    // A simple 1x1 WebP image
    webP.src = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
  });
};

/**
 * Preloads an image
 * 
 * @param {string} src - Image URL to preload
 * @returns {Promise<HTMLImageElement>} - Promise that resolves when the image is loaded
 */
export const preloadImage = (src) => {
  return new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error('No image source provided'));
      return;
    }
    
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
};

/**
 * Get a signed URL for an image from the backend API
 * @param {string} imagePath The path of the image in storage
 * @param {Object} options Optional parameters
 * @param {number|string} options.width Optional width for image resize
 * @param {number|string} options.height Optional height for image resize
 * @param {number} options.quality Image quality (1-100), default is 80
 * @param {number} options.expiration URL expiration time in seconds, default is 3600 (1 hour)
 * @param {string} options.contentDisposition How file should be presented - 'inline' or 'attachment'
 * @returns {Promise<Object>} Object containing signed URLs
 */
import { authorizedFetch } from './authUtils';

export async function getSignedImageUrl(imagePath, options = {}) {
  try {
    // Create URL parameters
    const params = new URLSearchParams();
    params.append('file_path', imagePath);
    
    if (options.width) {
      // If width is a percentage string, convert to a number or use 'auto'
      const width = typeof options.width === 'string' && options.width.includes('%') 
        ? 'auto' // Use 'auto' for percentage widths
        : options.width;
      params.append('width', width);
    }
    
    if (options.height) {
      // If height is a percentage string, convert to a number or use 'auto'
      const height = typeof options.height === 'string' && options.height.includes('%') 
        ? 'auto' // Use 'auto' for percentage heights
        : options.height;
      params.append('height', height);
    }
    
    if (options.quality) params.append('quality', options.quality);
    if (options.expiration) params.append('expiration', options.expiration);
    if (options.contentDisposition) params.append('content_disposition', options.contentDisposition);
    
    // Get the API URL from environment or use a default
    const apiUrl = `/api/files/signed-url?${params.toString()}`;
    
    console.log(`Calling API: ${apiUrl}`);
    
    // Make the request using authorizedFetch
    const response = await authorizedFetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to get signed URL');
    }
    
    const data = await response.json();
    console.log('Received signed URL response:', data);
    
    return {
      signedUrl: data.signed_url,
      optimizedUrl: data.optimized_url || data.signed_url, // Use optimized if available
      expiration: data.expiration
    };
  } catch (error) {
    console.error('Error getting signed URL:', error);
    throw error;
  }
}