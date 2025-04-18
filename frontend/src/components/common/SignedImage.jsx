import React, { useState, useEffect } from 'react';
import { getSignedImageUrl } from '../../utils/imageUtils';
import { Skeleton, Box, Text, Alert, AlertIcon } from '@chakra-ui/react';

/**
 * A component for displaying images using signed URLs from the backend.
 * This handles fetching signed URLs and provides a fallback if loading fails.
 * 
 * @param {Object} props Component props
 * @param {string} props.imagePath The path to the image in storage
 * @param {number|string} props.width Optional width for the image
 * @param {number|string} props.height Optional height for the image
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

  // Helper function to extract the actual file path from a URL
  const extractFilePath = (url) => {
    if (!url) return null;
    
    // If it's a blob URL, return null as we can't get a signed URL for it
    if (url.startsWith('blob:')) {
      return null;
    }
    
    // If it's already a file path (not a URL), return it as is
    if (!url.startsWith('http')) {
      return url;
    }
    
    // For Cloudinary URLs, extract the file path
    // Example: https://res.cloudinary.com/dbri1xgl8/image/upload/v1744944024/evidence/67fa07ef67851723907a596b/ENE-OLC-01/20250418024022-d822e99194a3492ba2d910ed2507fbde.png.png
    const cloudinaryMatch = url.match(/res\.cloudinary\.com\/[^\/]+\/image\/upload\/[^\/]+\/(.+?)(?:\?.*)?$/);
    if (cloudinaryMatch && cloudinaryMatch[1]) {
      // Remove any double extensions
      let path = cloudinaryMatch[1];
      const extensionMatch = path.match(/(\.[^.\/]+)\1$/);
      if (extensionMatch) {
        path = path.replace(extensionMatch[0], extensionMatch[1]);
      }
      return path;
    }
    
    // For Backblaze URLs, extract the path after the bucket name
    const backblazeMatch = url.match(/backblazeb2\.com\/[^\/]+\/([^\/]+)\/(.+)/);
    if (backblazeMatch && backblazeMatch[2]) {
      return backblazeMatch[2];
    }
    
    // For API URLs, extract the path part
    const apiMatch = url.match(/\/api\/images\/[^\/]+\/(.+)/);
    if (apiMatch && apiMatch[1]) {
      return apiMatch[1];
    }
    
    // If we can't extract a path, return the full URL
    return url;
  };

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

        // If it's a blob URL, use it directly for preview
        if (imagePath.startsWith('blob:')) {
          setImageUrl(imagePath);
          setIsLoading(false);
          return;
        }

        // Extract the actual file path
        const actualFilePath = extractFilePath(imagePath);
        
        if (!actualFilePath) {
          // If we can't extract a valid file path, use the original URL
          setImageUrl(imagePath);
          setIsLoading(false);
          return;
        }

        // Convert percentage strings to numbers if possible
        const processedWidth = typeof width === 'string' && width.endsWith('%') 
          ? parseInt(width, 10) // Try to extract numeric value without '%'
          : width;
        
        const processedHeight = typeof height === 'string' && height.endsWith('%') 
          ? parseInt(height, 10) // Try to extract numeric value without '%'
          : height;

        const { optimizedUrl } = await getSignedImageUrl(actualFilePath, {
          width: processedWidth,
          height: processedHeight,
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