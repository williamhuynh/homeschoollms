import React, { useState, useEffect, useRef } from 'react';
import SignedImage from './SignedImage';

/**
 * A lazy-loading wrapper for the ResponsiveImage component
 * Only loads the image when it enters the viewport
 * 
 * @component
 * @example
 * return (
 *   <LazyImage 
 *     image={{
 *       original_url: "https://example.com/images/original/image-123.jpg",
 *       thumbnail_small_url: "https://example.com/images/thumbnails/small/image-123.webp",
 *       thumbnail_medium_url: "https://example.com/images/thumbnails/medium/image-123.webp",
 *       thumbnail_large_url: "https://example.com/images/thumbnails/large/image-123.webp",
 *     }}
 *     alt="Description of image"
 *     width="300px"
 *     height="200px"
 *     aspectRatio={3/2}
 *   />
 * )
 */
const LazyImage = ({
  src,
  alt,
  className = "",
  placeholderClassName = "",
  quality = 80,
  threshold = 0.1,
  rootMargin = '50px',
  ...props
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const imgRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold,
        rootMargin
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  const handleImageLoad = () => {
    setHasLoaded(true);
  };

  const handleImageError = (e) => {
    console.error('Lazy image failed to load:', e);
  };

  return (
    <div 
      ref={imgRef} 
      className={`lazy-image-container ${className}`}
      style={{ 
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Placeholder */}
      {!hasLoaded && (
        <div 
          className={`lazy-image-placeholder bg-gray-200 animate-pulse flex items-center justify-center ${placeholderClassName}`}
          style={{
            position: isVisible ? 'absolute' : 'static',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 1
          }}
        >
          <svg 
            className="w-8 h-8 text-gray-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
            />
          </svg>
        </div>
      )}

      {/* Actual Image */}
      {isVisible && (
        <SignedImage
          src={src}
          alt={alt}
          quality={quality}
          className={`lazy-image ${hasLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
          onError={handleImageError}
          onLoad={handleImageLoad}
          {...props}
        />
      )}
    </div>
  );
};

export default LazyImage;