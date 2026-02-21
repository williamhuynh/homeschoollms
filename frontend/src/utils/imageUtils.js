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
 * Get a signed URL for an image with optional optimization parameters
 * @param {string} filePath - Path to the image in storage
 * @param {Object} options - Optimization options
 * @param {number} [options.width] - Desired width
 * @param {number} [options.height] - Desired height
 * @param {number} [options.quality=80] - Image quality (1-100)
 * @returns {Promise<string>} - Returns the optimized image URL
 */
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const getSignedImageUrl = async (filePath, options = {}) => {
  try {
    // If it's a blob URL or starts with http and isn't a backend path, return it directly
    if (!filePath) {
      throw new Error("No file path provided");
    }
    
    console.log('getSignedImageUrl input path:', filePath);
    
    // Handle blob URLs directly
    if (filePath.startsWith('blob:')) {
      return {
        signedUrl: filePath,
        optimizedUrl: filePath
      };
    }
    
    // If it's already a fully formed Cloudinary URL, use it directly
    if (filePath.includes('res.cloudinary.com')) {
      console.log('Using direct Cloudinary URL:', filePath);
      return {
        signedUrl: filePath,
        optimizedUrl: filePath
      };
    }
    
    const { width, height, quality = 80 } = options;
    const params = new URLSearchParams();
    
    if (width) params.append('width', width);
    if (height) params.append('height', height);
    if (quality) params.append('quality', quality);
    
    // Try to get the signed URL from the backend
    try {
      const response = await axios.get(
        `${API_BASE_URL}/files/signed-url?file_path=${encodeURIComponent(filePath)}&${params.toString()}`,
        { 
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`
          }
        }
      );
      
      console.log('Received signed URL response:', response.data);
      
      return {
        signedUrl: response.data.signed_url,
        optimizedUrl: response.data.signed_url
      };
    } catch (apiError) {
      // If we get a 404, try to construct a direct Cloudinary URL
      if (apiError.response?.status === 404) {
        // console.warn('File not found via API, trying direct Cloudinary URL');
        
        // Get the cloud name from environment or use a default
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dbri1xgl8';
        
        // Construct a direct Cloudinary URL
        let cloudinaryUrl = `https://res.cloudinary.com/${cloudName}/image/upload`;
        
        // Add transformations if specified
        const transformations = [];
        if (width && height) {
          transformations.push('c_fill');
          transformations.push('g_auto');
        }
        if (width) transformations.push(`w_${width}`);
        if (height) transformations.push(`h_${height}`);
        if (quality !== 80) transformations.push(`q_${quality}`);
        
        if (transformations.length > 0) {
          cloudinaryUrl += `/${transformations.join(',')}`;
        }
        
        // Add the path (remove any leading slash)
        const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
        cloudinaryUrl += `/${cleanPath}`;
        
        console.log('Generated direct Cloudinary URL:', cloudinaryUrl);
        
        return {
          signedUrl: cloudinaryUrl,
          optimizedUrl: cloudinaryUrl
        };
      }
      
      // Re-throw the error if it's not a 404 or the direct URL approach failed
      throw apiError;
    }
  } catch (error) {
    console.error('Error getting signed image URL:', error);
    throw error;
  }
};

/**
 * Generate a responsive image srcset using Cloudinary
 * @param {string} filePath - Path to the image in storage
 * @param {Object} options - Optimization options
 * @param {number[]} [options.sizes=[320, 640, 1024, 1600]] - Array of widths to generate
 * @param {number} [options.quality=80] - Image quality (1-100)
 * @returns {Promise<string>} - Returns the srcset string
 */
export const getResponsiveSrcset = async (filePath, options = {}) => {
  const { sizes = [320, 640, 1024, 1600], quality = 80 } = options;
  
  const srcsetPromises = sizes.map(async (width) => {
    const { optimizedUrl } = await getSignedImageUrl(filePath, { width, quality });
    return `${optimizedUrl} ${width}w`;
  });
  
  const srcset = await Promise.all(srcsetPromises);
  return srcset.join(', ');
};

/**
 * Generate a responsive image sizes attribute
 * @param {string} defaultSize - Default size (e.g., '100vw' or '800px')
 * @param {Object} breakpoints - Media query breakpoints
 * @returns {string} - Returns the sizes attribute string
 */
export const getResponsiveSizes = (defaultSize, breakpoints = {}) => {
  if (!breakpoints || Object.keys(breakpoints).length === 0) {
    return defaultSize;
  }
  
  const sizes = Object.entries(breakpoints)
    .sort(([a], [b]) => parseInt(b) - parseInt(a))
    .map(([width, size]) => `(max-width: ${width}px) ${size}`)
    .join(', ');
    
  return `${sizes}, ${defaultSize}`;
};

/**
 * Check if a URL is a Cloudinary URL
 * @param {string} url - URL to check
 * @returns {boolean} - True if the URL is from Cloudinary
 */
export const isCloudinaryUrl = (url) => {
  if (!url) return false;
  return url.includes('cloudinary.com');
};

/**
 * Get the original URL from a Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {string} - Original URL without transformations
 */
export const getOriginalUrlFromCloudinary = (url) => {
  if (!url || !isCloudinaryUrl(url)) return url;
  
  try {
    const urlObj = new URL(url);
    // Remove all transformations from the URL
    const pathParts = urlObj.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    return `${urlObj.origin}/${pathParts[1]}/${pathParts[2]}/${lastPart}`;
  } catch (error) {
    console.error('Error parsing Cloudinary URL:', error);
    return url;
  }
};