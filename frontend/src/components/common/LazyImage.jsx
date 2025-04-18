import React, { useState, useEffect } from 'react';
import { Box, Image, Skeleton } from '@chakra-ui/react';
import { getSignedImageUrl } from '../../utils/imageUtils';

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
  objectFit = 'cover',
  borderRadius = 'md',
  onLoad,
  onError,
  quality = 80,
  thumbnailWidth,
  ...props
}) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px',
        threshold: 0.1
      }
    );

    const element = document.getElementById(`lazy-image-${image?.original_url}`);
    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [image]);

  useEffect(() => {
    let mounted = true;

    async function loadImage() {
      if (!image || !isVisible) return;

      try {
        setIsLoading(true);
        setError(null);

        // Get the appropriate image URL with optimization
        const result = await getSignedImageUrl(image.original_url, {
          width: width,
          height: height,
          quality: quality,
          thumbnailWidth: thumbnailWidth
        });

        if (mounted) {
          setImageUrl(result.optimizedUrl);
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err);
          setIsLoading(false);
          if (onError) onError(err);
        }
      }
    }

    loadImage();

    return () => {
      mounted = false;
    };
  }, [image, width, height, isVisible, onError, quality, thumbnailWidth]);

  return (
    <Box
      id={`lazy-image-${image?.original_url}`}
      position="relative"
      width={width}
      height={height}
      borderRadius={borderRadius}
      overflow="hidden"
      {...props}
    >
      {isLoading && (
        <Skeleton
          position="absolute"
          top={0}
          left={0}
          width="100%"
          height="100%"
        />
      )}
      
      {imageUrl && (
        <Image
          src={imageUrl}
          alt={alt}
          width="100%"
          height="100%"
          objectFit={objectFit}
          onLoad={() => {
            setIsLoading(false);
            if (onLoad) onLoad();
          }}
          onError={(e) => {
            setError(e);
            setIsLoading(false);
            if (onError) onError(e);
          }}
        />
      )}
      
      {error && (
        <Box
          position="absolute"
          top={0}
          left={0}
          width="100%"
          height="100%"
          display="flex"
          alignItems="center"
          justifyContent="center"
          bg="gray.100"
          color="gray.500"
        >
          Failed to load image
        </Box>
      )}
    </Box>
  );
};

export default LazyImage;