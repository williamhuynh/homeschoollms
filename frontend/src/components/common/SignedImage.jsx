import React, { useState, useEffect } from 'react';
import { getSignedUrl } from '../../services/api';
import placeholderImage from '../../assets/images/placeholder-photo.jpg';

/**
 * A component for displaying images using signed URLs from the backend.
 * This handles fetching signed URLs and provides a fallback if loading fails.
 * 
 * @param {Object} props Component props
 * @param {string} props.src The path to the image in storage
 * @param {string} props.alt Alt text for the image
 * @param {string} props.className Optional class name for the image container
 * @param {number|string} props.width Optional width for the image
 * @param {number|string} props.height Optional height for the image
 * @param {number} props.quality Optional quality for the image (1-100)
 * @param {string} props.fallbackSrc Fallback image source if loading fails
 * @param {function} props.onError Callback function to handle image load error
 * @param {Object} props.imgProps Additional props to pass to the img element
 */
const SignedImage = ({
  src,
  alt,
  className = '',
  width,
  height,
  quality = 80,
  fallbackSrc = placeholderImage,
  onError,
  imgProps = {},
  ...props
}) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;

  useEffect(() => {
    if (!src) {
      setLoading(false);
      setError('No image source provided');
      return;
    }

    fetchSignedUrl();
  }, [src, width, height, quality, retryCount]);

  const fetchSignedUrl = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[SignedImage] Processing src:', src);

      // Check if the src is already a Cloudinary authenticated URL
      const isCloudinaryAuthenticated = src.includes('/image/authenticated/') && src.includes('s--') && src.includes('--');
      
      // Check if the src is a public Cloudinary URL
      const isCloudinaryPublic = src.startsWith('http') && src.includes('res.cloudinary.com') && !isCloudinaryAuthenticated;

      // Check if it's a blob URL (local file preview)
      const isBlobUrl = src.startsWith('blob:');

      // Check if it's a data URL (base64 encoded file)
      const isDataUrl = src.startsWith('data:');

      if (isBlobUrl) {
        console.log('[SignedImage] Using blob URL (local file preview):', src);
        setImageUrl(src);
        setLoading(false);
        return;
      }

      if (isDataUrl) {
        console.log('[SignedImage] Using data URL (base64 file preview):', src.substring(0, 50) + '...');
        setImageUrl(src);
        setLoading(false);
        return;
      }

      if (isCloudinaryAuthenticated) {
        console.log('[SignedImage] Using Cloudinary authenticated URL (already signed):', src);
        setImageUrl(src);
        setLoading(false);
        return;
      }

      if (isCloudinaryPublic) {
        console.log('[SignedImage] Using public Cloudinary URL (legacy image):', src);
        setImageUrl(src);
        setLoading(false);
        return;
      }

      // If it's any other http URL, use it directly
      if (src.startsWith('http')) {
        console.log('[SignedImage] Using direct URL (external image):', src);
        setImageUrl(src);
        setLoading(false);
        return;
      }

      console.log('[SignedImage] Requesting signed URL for path:', src);
      
      // Generate signed URL for private images
      const response = await getSignedUrl({
        file_path: src,
        width: width,
        height: height,
        quality: quality,
        expiration: 14400 // 4 hours - matches backend
      });

      console.log('[SignedImage] Signed URL response:', response);

      if (response.signed_url) {
        setImageUrl(response.signed_url);
      } else {
        throw new Error('No signed URL received');
      }
    } catch (err) {
      console.error('[SignedImage] Error fetching signed URL:', err);
      setError(err.message || 'Failed to load image');
      
      // Try to use the original src as fallback for hybrid mode
      if (retryCount === 0 && src) {
        console.log('[SignedImage] Using fallback - original src:', src);
        setImageUrl(src);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImageError = (e) => {
    console.error('[SignedImage] Image load error:', e);
    console.error('[SignedImage] Failed URL was:', imageUrl);
    console.error('[SignedImage] Retry count:', retryCount);
    
    // Try retry logic
    if (retryCount < maxRetries) {
      console.log('[SignedImage] Retrying... attempt', retryCount + 1);
      setRetryCount(prev => prev + 1);
      return;
    }

    // Final fallback
    if (imageUrl !== fallbackSrc) {
      console.log('[SignedImage] Using final fallback image:', fallbackSrc);
      setImageUrl(fallbackSrc);
      setError(null);
    } else {
      setError('Failed to load image and fallback');
      if (onError) {
        onError(e);
      }
    }
  };

  const handleImageLoad = () => {
    setError(null);
  };

  if (loading) {
    return (
      <div 
        className={`bg-gray-200 animate-pulse flex items-center justify-center ${className}`}
        style={{ width, height }}
        {...props}
      >
        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  if (error && !imageUrl) {
    return (
      <div 
        className={`bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded flex items-center justify-center ${className}`}
        style={{ width, height }}
        {...props}
      >
        <span className="text-sm">Failed to load image</span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      onError={handleImageError}
      onLoad={handleImageLoad}
      {...props}
      {...imgProps}
      style={{
        width,
        height,
        ...imgProps.style
      }}
    />
  );
};

export default SignedImage; 