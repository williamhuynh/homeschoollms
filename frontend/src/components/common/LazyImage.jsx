import { useState, useEffect, useRef } from 'react';
import { Box, Skeleton } from '@chakra-ui/react';
import ResponsiveImage from './ResponsiveImage';

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
  image, 
  alt = '', 
  width = '100%', 
  height = 'auto',
  aspectRatio,
  objectFit = 'cover',
  borderRadius = 'md',
  ...props
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef(null);
  const observerRef = useRef(null);

  // Calculate height based on aspect ratio if provided
  const calculatedHeight = aspectRatio && width !== 'auto' ? 
    typeof width === 'number' ? 
      `${width / aspectRatio}px` : 
      `calc(${width} / ${aspectRatio})` 
    : height;

  // Set up intersection observer for lazy loading
  useEffect(() => {
    if (!containerRef.current) return;

    observerRef.current = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry.isIntersecting) {
        setIsVisible(true);
        // Unobserve after becoming visible
        observerRef.current.unobserve(containerRef.current);
      }
    }, {
      rootMargin: '200px', // Start loading when image is 200px from viewport
      threshold: 0.01,
    });

    observerRef.current.observe(containerRef.current);

    return () => {
      if (observerRef.current && containerRef.current) {
        observerRef.current.unobserve(containerRef.current);
      }
    };
  }, [width, height, aspectRatio]);

  return (
    <Box 
      ref={containerRef}
      position="relative"
      width={width}
      height={calculatedHeight}
      className="lazy-image-container"
      data-testid="lazy-image"
      {...props}
    >
      {isVisible ? (
        <ResponsiveImage
          image={image}
          alt={alt}
          width="100%"
          height="100%"
          objectFit={objectFit}
          borderRadius={borderRadius}
          onLoad={() => setIsLoaded(true)}
        />
      ) : (
        <Skeleton
          width="100%"
          height="100%"
          borderRadius={borderRadius}
          startColor="gray.100"
          endColor="gray.300"
        />
      )}
    </Box>
  );
};

export default LazyImage;