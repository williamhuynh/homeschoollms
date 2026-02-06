/**
 * Service for handling image-related operations
 */
import { logger } from '../utils/logger';

/**
 * Get the appropriate thumbnail URL based on required dimensions
 * 
 * @param {Object} image - Image object with thumbnail URLs
 * @param {number} width - Required width in pixels
 * @param {number} height - Required height in pixels
 * @returns {string} - The most appropriate thumbnail URL
 */
export const getThumbnailUrl = (image, width = 0, height = 0) => {
  if (!image) return null;
  
  // Get the larger dimension
  const largerDimension = Math.max(width, height);
  
  // Select appropriate thumbnail based on size
  if (largerDimension <= 150 && image.thumbnail_small_url) {
    return image.thumbnail_small_url;
  } else if (largerDimension <= 300 && image.thumbnail_medium_url) {
    return image.thumbnail_medium_url;
  } else if (largerDimension <= 600 && image.thumbnail_large_url) {
    return image.thumbnail_large_url;
  }
  
  // Fallback to original URL
  return image.fileUrl || image.url || image.original_url;
};

/**
 * Preload an image
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
 * Preload multiple images
 * 
 * @param {Array<string>} urls - Array of image URLs to preload
 * @returns {Promise<Array<HTMLImageElement>>} - Promise that resolves when all images are loaded
 */
export const preloadImages = (urls) => {
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return Promise.resolve([]);
  }
  
  return Promise.all(urls.map(url => preloadImage(url)));
};

/**
 * Get image dimensions from a URL
 * 
 * @param {string} url - Image URL
 * @returns {Promise<{width: number, height: number}>} - Promise that resolves with image dimensions
 */
export const getImageDimensions = (url) => {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error('No image URL provided'));
      return;
    }
    
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
};

/**
 * Check if WebP format is supported by the browser
 * 
 * @returns {Promise<boolean>} - Promise that resolves to true if WebP is supported
 */
export const isWebPSupported = () => {
  return new Promise(resolve => {
    const webP = new Image();
    webP.onload = function() {
      // The image loaded successfully, WebP is supported
      resolve(true);
    };
    webP.onerror = function() {
      // The image failed to load, WebP is not supported
      resolve(false);
    };
    // A simple 1x1 WebP image
    webP.src = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
  });
};

/**
 * Maximum image dimension (width or height) after compression.
 * Keeps enough detail for AI analysis and evidence records while
 * staying well under Vercel's 4.5 MB proxy body-size limit.
 */
const MAX_DIMENSION = 2048;
const COMPRESSION_QUALITY = 0.8;
const MAX_FILE_SIZE = 1.5 * 1024 * 1024; // 1.5 MB

/**
 * Compress a single image File using Canvas.
 * Resizes if either dimension exceeds MAX_DIMENSION and re-encodes as JPEG.
 * Returns the original file if it is already small enough or is not an image.
 *
 * @param {File} file - The image file to compress
 * @returns {Promise<File>} - Compressed image file
 */
export const compressImage = (file) => {
  return new Promise((resolve) => {
    // Skip non-image files
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    // Skip files that are already small enough
    if (file.size <= MAX_FILE_SIZE) {
      resolve(file);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Scale down if larger than MAX_DIMENSION
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round(height * (MAX_DIMENSION / width));
          width = MAX_DIMENSION;
        } else {
          width = Math.round(width * (MAX_DIMENSION / height));
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file); // fallback to original
            return;
          }

          // Preserve original filename but switch extension to .jpg
          const name = file.name.replace(/\.[^.]+$/, '.jpg');
          const compressed = new File([blob], name, {
            type: 'image/jpeg',
            lastModified: file.lastModified,
          });

          logger.debug('Image compressed', {
            original: `${(file.size / 1024).toFixed(0)}KB`,
            compressed: `${(compressed.size / 1024).toFixed(0)}KB`,
            dimensions: `${width}x${height}`,
          });

          resolve(compressed);
        },
        'image/jpeg',
        COMPRESSION_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      logger.warn('Image compression failed, using original file', { name: file.name });
      resolve(file); // fallback to original on error
    };

    img.src = objectUrl;
  });
};

/**
 * Compress an array of image files.
 *
 * @param {File[]} files - Array of image files to compress
 * @returns {Promise<File[]>} - Array of compressed image files
 */
export const compressImages = (files) => {
  return Promise.all(files.map(compressImage));
};

/**
 * Get an authenticated image URL with a fresh token
 *
 * @param {string} url - Original image URL
 * @returns {Promise<string>} - Promise that resolves with the authenticated URL
 */
export const getAuthenticatedImageUrl = async (url) => {
  if (!url) return null;
  
  try {
    // Import supabase directly to refresh the session
    const { supabase } = await import('./supabase');
    
    // Refresh the session to get a new token
    const { data: sessionData, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError) {
      logger.warn('Token refresh error for image');
      // Return the original URL if refresh fails
      return url;
    }
    
    // Get the fresh token
    const freshToken = sessionData?.session?.access_token;
    
    if (!freshToken) {
      logger.warn('No fresh token available for authenticated image');
      return url;
    }
    
    // Parse the URL
    const parsedUrl = new URL(url.startsWith('http') ? url : `${window.location.origin}${url}`);
    
    // Add auth_token parameter for all URLs that use our API or Vercel's image optimization
    const isApiUrl = parsedUrl.pathname.includes('/api/images/') || parsedUrl.pathname.includes('/_vercel/image');
    
    if (isApiUrl) {
      // Add or update the auth token parameter
      parsedUrl.searchParams.set('auth_token', freshToken);
      logger.debug('Added auth_token to API URL');
    } else if (parsedUrl.hostname.includes('backblazeb2.com')) {
      // For direct Backblaze URLs, transform them to use our API
      const bucketName = 'homeschoollms'; // Your Backblaze bucket name
      
      // Extract the path from the Backblaze URL (after the domain)
      const pathMatch = parsedUrl.pathname.match(/^\/(.*)/);
      if (pathMatch && pathMatch[1]) {
        const imagePath = pathMatch[1];
        const apiUrl = new URL(`/api/images/${bucketName}/${imagePath}`, window.location.origin);
        
        // Copy all existing query parameters
        for (const [key, value] of parsedUrl.searchParams.entries()) {
          if (key !== 'auth_token') { // Skip old auth token if present
            apiUrl.searchParams.set(key, value);
          }
        }
        
        // Add the fresh auth token
        apiUrl.searchParams.set('auth_token', freshToken);
        
        logger.debug('Converted Backblaze URL to authenticated API URL');
        return apiUrl.toString();
      }
    }
    
    return parsedUrl.toString();
  } catch (error) {
    logger.error('Error getting authenticated image URL', error);
    return url;
  }
};