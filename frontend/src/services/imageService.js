/**
 * Service for handling image-related operations
 */

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