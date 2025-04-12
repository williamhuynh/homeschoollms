import { useState, useEffect, useRef } from 'react';
import { Box, Skeleton } from '@chakra-ui/react';
import { getAppropriateImageSize, getThumbnailUrl, preloadImage } from '../../utils/imageUtils';

/**
 * A responsive image component that uses thumbnails, lazy loading, and progressive loading
 * 
 * @component
 * @example
 * return (
 *   <ResponsiveImage 
 *     image={{
 *       original_url: "https://example.com/images/original/image-123.jpg",
 *       thumbnail_small_url: "https://example.com/images/thumbnails/small/image-123.webp",
 *       thumbnail_medium_url: "https://example.com/images/thumbnails/medium/image-123.webp",
 *       thumbnail_large_url: "https://example.com/images/thumbnails/large/image-123.webp",
 *     }}
 *     alt="Description of image"
 *     width="300px"
 *     height="200px"
 *   />
 * )
 */
const ResponsiveImage = ({ 
  image, 
  alt = '', 
  width = '100%', 
  height = 'auto', 
  objectFit = 'cover',
  borderRadius = 'md',
  fallbackSrc = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  ...props
}) => {
  const [loading, setLoading] = useState(true);
  const [currentSrc, setCurrentSrc] = useState(null);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);
  const observerRef = useRef(null);

  // Function to load the image progressively
  const loadImageProgressively = () => {
    if (!image) return;

    // Reset states
    setError(false);
    
    // Start with small thumbnail (or fallback to original if no thumbnails)
    const smallSrc = getThumbnailUrl(image, 'small');
    setCurrentSrc(smallSrc);
    
    // Determine appropriate size based on container
    const containerWidth = imgRef.current?.parentElement?.clientWidth || 0;
    const containerHeight = imgRef.current?.parentElement?.clientHeight || 0;
    
    const size = getAppropriateImageSize({
      containerWidth,
      containerHeight,
      displayType: 'thumbnail',
      highDensityDisplay: window.devicePixelRatio > 1
    });
    
    // Determine if we should use WebP format
    const [supportsWebP, setSupportsWebP] = useState(false);
    
    // Function to check WebP support
    const isWebPSupported = () => {
      return new Promise(resolve => {
        const webP = new Image();
        webP.onload = webP.onerror = function() {
          resolve(webP.height === 1);
        };
        webP.src = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
      });
    };
    
    useEffect(() => {
      isWebPSupported().then(supported => {
        setSupportsWebP(supported);
      });
    }, []);
    
    // Prepare transformation options
    const transformOptions = {
      width: containerWidth * (window.devicePixelRatio || 1),
      height: containerHeight * (window.devicePixelRatio || 1),
      format: supportsWebP ? 'webp' : undefined,
      quality: 80
    };
    
    // Prepare the next image to load based on size and transformations
    const nextSrc = getThumbnailUrl(image, size, transformOptions);
    
    // If we're already using the best size, no need to load another image
    if (nextSrc === smallSrc) {
      setLoading(false);
      return;
    }
    
    // Preload the next size with transformations
    preloadImage(nextSrc)
      .then(() => {
        setCurrentSrc(nextSrc);
        
        // If this isn't the original, preload the original for highest quality
        if (nextSrc !== image.original_url && image.original_url) {
          // For original, we might still want some transformations like format conversion
          const originalWithTransforms = getThumbnailUrl(
            { original_url: image.original_url },
            'original',
            { format: supportsWebP ? 'webp' : undefined }
          );
          
          return preloadImage(originalWithTransforms)
            .then(() => {
              setCurrentSrc(image.original_url);
              setLoading(false);
            })
            .catch(() => {
              // If original fails, we still have a good thumbnail
              setLoading(false);
            });
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        // If next size fails, stay with small thumbnail
        setLoading(false);
      });
  };

  // Set up intersection observer for lazy loading
  useEffect(() => {
    if (!imgRef.current) return;

    observerRef.current = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry.isIntersecting) {
        loadImageProgressively();
        // Unobserve after loading starts
        observerRef.current.unobserve(imgRef.current);
      }
    }, {
      rootMargin: '200px', // Start loading when image is 200px from viewport
    });

    observerRef.current.observe(imgRef.current);

    return () => {
      if (observerRef.current && imgRef.current) {
        observerRef.current.unobserve(imgRef.current);
      }
    };
  }, [image, supportsWebP]);

  // Handle window resize to potentially load different size
  useEffect(() => {
    const handleResize = () => {
      if (imgRef.current && imgRef.current.complete) {
        const containerWidth = imgRef.current?.parentElement?.clientWidth || 0;
        const containerHeight = imgRef.current?.parentElement?.clientHeight || 0;
        const newSize = getAppropriateImageSize({
          containerWidth,
          containerHeight,
          displayType: 'thumbnail',
          highDensityDisplay: window.devicePixelRatio > 1
        });
        
        // Prepare transformation options for the new size
        const transformOptions = {
          width: containerWidth * (window.devicePixelRatio || 1),
          height: containerHeight * (window.devicePixelRatio || 1),
          format: supportsWebP ? 'webp' : undefined, // Use WebP if supported
          quality: 80
        };
        
        // Determine current size from the URL
        let currentSize;
        if (currentSrc?.includes('_thumb_small')) currentSize = 'small';
        else if (currentSrc?.includes('_thumb_medium')) currentSize = 'medium';
        else if (currentSrc?.includes('_thumb_large')) currentSize = 'large';
        else currentSize = 'original';
        
        // Only reload if we need a larger size than currently displayed
        const sizeOrder = { small: 1, medium: 2, large: 3, original: 4 };
        if (sizeOrder[newSize] > sizeOrder[currentSize]) {
          loadImageProgressively();
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentSrc, image]);

  // Handle image load error
  const handleError = () => {
    setError(true);
    setLoading(false);
  };

  // If no image data is provided
  if (!image) {
    return (
      <Box 
        width={width} 
        height={height} 
        bg="gray.100" 
        borderRadius={borderRadius}
        {...props}
      />
    );
  }

  return (
    <Box position="relative" width={width} height={height} {...props}>
      {loading && (
        <Skeleton
          position="absolute"
          top="0"
          left="0"
          width="100%"
          height="100%"
          borderRadius={borderRadius}
          startColor="gray.100"
          endColor="gray.300"
        />
      )}
      <Box
        as="img"
        ref={imgRef}
        src={currentSrc || (error ? fallbackSrc : null)}
        alt={alt}
        width="100%"
        height="100%"
        objectFit={objectFit}
        borderRadius={borderRadius}
        opacity={loading ? 0.3 : 1}
        transition="opacity 0.3s ease"
        onError={handleError}
        style={{ 
          filter: loading ? 'blur(10px)' : 'none',
          transition: 'filter 0.3s ease, opacity 0.3s ease'
        }}
      />
    </Box>
  );
};

export default ResponsiveImage;