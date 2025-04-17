import React, { useState, useEffect } from 'react';
import { getSignedImageUrl } from '../../utils/imageUtils';
import { Skeleton, Box, Text, Alert, AlertIcon } from '@chakra-ui/react';

/**
 * A component for displaying images using signed URLs from the backend.
 * This handles fetching signed URLs and provides a fallback if loading fails.
 * 
 * @param {Object} props Component props
 * @param {string} props.imagePath The path to the image in storage
 * @param {number} props.width Optional width for the image
 * @param {number} props.height Optional height for the image
 * @param {number} props.quality Optional quality for the image (1-100)
 * @param {string} props.alt Alt text for the image
 * @param {Object} props.imgProps Additional props to pass to the img element
 * @param {boolean} props.showPlaceholder Whether to show a placeholder while loading
 */
const SignedImage = ({
  imagePath,
  width,
  height,
  quality = 80,
  alt = 'Image',
  imgProps = {},
  showPlaceholder = true,
  ...rest
}) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchSignedUrl = async () => {
      if (!imagePath) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const { optimizedUrl } = await getSignedImageUrl(imagePath, {
          width,
          height,
          quality,
        });

        if (isMounted) {
          setImageUrl(optimizedUrl);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error loading image:', err);
        if (isMounted) {
          setError(err.message || 'Failed to load image');
          setIsLoading(false);
        }
      }
    };

    fetchSignedUrl();

    return () => {
      isMounted = false;
    };
  }, [imagePath, width, height, quality]);

  if (isLoading && showPlaceholder) {
    return (
      <Skeleton
        width={width || '100%'}
        height={height || '200px'}
        startColor="gray.100"
        endColor="gray.300"
        borderRadius="md"
        {...rest}
      />
    );
  }

  if (error) {
    return (
      <Alert status="error" borderRadius="md" {...rest}>
        <AlertIcon />
        <Text fontSize="sm">{error}</Text>
      </Alert>
    );
  }

  if (!imageUrl) {
    return (
      <Box
        width={width || '100%'}
        height={height || '200px'}
        bg="gray.100"
        display="flex"
        alignItems="center"
        justifyContent="center"
        borderRadius="md"
        {...rest}
      >
        <Text color="gray.500">No image available</Text>
      </Box>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      width={width}
      height={height}
      style={{
        maxWidth: '100%',
        height: 'auto',
        display: 'block',
        borderRadius: '4px',
        ...imgProps.style,
      }}
      {...imgProps}
      {...rest}
    />
  );
};

export default SignedImage; 