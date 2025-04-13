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
 * Gets the URL for the appropriate thumbnail size
 * 
 * @param {Object} image - Image object with thumbnail URLs
 * @param {string} size - Size to retrieve ('small', 'medium', 'large', 'original')
 * @returns {string} - The URL for the requested size, falling back to larger sizes if not available
 */
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
  if (!image) {
    console.log('getThumbnailUrl: No image provided');
    return null;
  }
  
  // Add _thumb suffix to thumbnail URLs if they don't already have it
  let modifiedImage = { ...image };
  
  // Process thumbnail URLs to add _thumb suffix if needed
  ['thumbnail_small_url', 'thumbnail_medium_url', 'thumbnail_large_url'].forEach(urlKey => {
    if (modifiedImage[urlKey] && !modifiedImage[urlKey].includes('_thumb') && modifiedImage[urlKey].includes('.')) {
      const lastDotIndex = modifiedImage[urlKey].lastIndexOf('.');
      modifiedImage[urlKey] = modifiedImage[urlKey].substring(0, lastDotIndex) + '_thumb' + modifiedImage[urlKey].substring(lastDotIndex);
      console.log(`Modified ${urlKey}:`, modifiedImage[urlKey]);
    }
  });
  
  console.log('getThumbnailUrl input:', {
    image: modifiedImage,
    size,
    options,
    availableUrls: {
      original: modifiedImage.original_url,
      small: modifiedImage.thumbnail_small_url,
      medium: modifiedImage.thumbnail_medium_url,
      large: modifiedImage.thumbnail_large_url
    }
  });
  
  // Get the base URL for the requested size
  let baseUrl;
  
  // Log the URL selection process
  console.log('getThumbnailUrl URL selection:', {
    requestedSize: size,
    hasSmall: !!image.thumbnail_small_url,
    hasMedium: !!image.thumbnail_medium_url,
    hasLarge: !!image.thumbnail_large_url,
    hasOriginal: !!image.original_url
  });
  switch (size) {
    case 'small':
      baseUrl = modifiedImage.thumbnail_small_url || modifiedImage.thumbnail_medium_url || modifiedImage.thumbnail_large_url || modifiedImage.original_url;
      break;
      
    case 'medium':
      baseUrl = modifiedImage.thumbnail_medium_url || modifiedImage.thumbnail_large_url || modifiedImage.original_url;
      break;
      
    case 'large':
      baseUrl = modifiedImage.thumbnail_large_url || modifiedImage.original_url;
      break;
      
    case 'original':
    default:
      baseUrl = modifiedImage.original_url;
      break;
  }
  
  console.log('Selected base URL:', {
    size,
    baseUrl,
    fallbackChain: {
      thumbnail_small_url: modifiedImage.thumbnail_small_url,
      thumbnail_medium_url: modifiedImage.thumbnail_medium_url,
      thumbnail_large_url: modifiedImage.thumbnail_large_url,
      original_url: modifiedImage.original_url
    }
  });
  
  // If no URL is available or no transformations requested, return the base URL
  if (!baseUrl || Object.keys(options).length === 0) {
    console.log('Returning base URL without transformations:', baseUrl);
    return baseUrl;
  }
  
  // Normalize the URL by removing any double slashes (except after protocol)
  const normalizedUrl = baseUrl.replace(/([^:]\/)\/+/g, '$1');
  
  // Check if the URL is already using our Edge Function
  const isEdgeFunction = normalizedUrl.includes('/api/images/');
  
  console.log('URL normalization:', {
    originalUrl: baseUrl,
    normalizedUrl,
    isEdgeFunction
  });
  
  // If it's not an Edge Function URL, we can't apply transformations
  if (!isEdgeFunction) {
    console.log('Not an Edge Function URL, returning normalized URL:', normalizedUrl);
    return normalizedUrl;
  }
  
  // Apply transformations by adding query parameters
  // Handle both relative and absolute URLs correctly
  const url = normalizedUrl.startsWith('http') ?
    new URL(normalizedUrl) :
    new URL(normalizedUrl.replace(/^\/+/, ''), window.location.origin);
  
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
  const finalUrl = url.toString();
  console.log('Final transformed URL:', {
    finalUrl,
    appliedTransformations: {
      width: options.width,
      height: options.height,
      format: options.format,
      quality: options.quality
    }
  });
  
  return finalUrl;
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