import { useState } from 'react';
import { Grid, Box, useBreakpointValue, VStack, Text } from '@chakra-ui/react'; // Added VStack and Text
import LazyImage from './LazyImage';
import SignedImage from './SignedImage'; // Import the new SignedImage component
import ImageViewerModal from './ImageViewerModal';

// Feature flag to enable gradual migration
const USE_SIGNED_IMAGE = process.env.REACT_APP_USE_SIGNED_IMAGE === 'true' || true; // Default to true, can be controlled via env var

/**
 * A responsive image gallery component that displays a grid of images with lazy loading
 * 
 * @component
 * @example
 * return (
 *   <ImageGallery 
 *     images={[
 *       {
 *         id: '1',
 *         title: 'Image 1',
 *         description: 'Description of image 1',
 *         fileUrl: 'https://example.com/images/original/image-1.jpg',
 *         thumbnail_small_url: 'https://example.com/images/thumbnails/small/image-1.webp',
 *         thumbnail_medium_url: 'https://example.com/images/thumbnails/medium/image-1.webp',
 *         thumbnail_large_url: 'https://example.com/images/thumbnails/large/image-1.webp',
 *       },
 *       // More images...
 *     ]}
 *     studentId="123"
 *     learningOutcomeId="456"
 *     onImageDeleted={(imageId) => console.log('Image deleted:', imageId)}
 *     width={450}
 *     height={600}
 *   />
 * )
 */
const ImageGallery = ({ 
  images = [], 
  studentId, 
  learningOutcomeId, 
  onImageDeleted,
  columns = { base: 2, sm: 3, md: 4, lg: 5 },
  spacing = 4,
  aspectRatio = 1,
  width,
  height,
  borderRadius = 'md',
  useSignedImages = USE_SIGNED_IMAGE, // Allow overriding the feature flag per instance
  studentGrade // <-- add this prop
}) => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Responsive columns based on screen size
  const columnCount = useBreakpointValue(columns);
  
  // Handle image click to open modal
  const handleImageClick = (image) => {
    setSelectedImage(image);
    setIsModalOpen(true);
  };
  
  // Handle modal close
  const handleModalClose = () => {
    setIsModalOpen(false);
  };
  
  // Handle image deletion
  const handleImageDeleted = (imageId) => {
    if (onImageDeleted) {
      onImageDeleted(imageId);
    }
  };
  
  // If no images, return null or empty state
  if (!images || images.length === 0) {
    return null;
  }
  
  // Calculate aspect ratio from width/height if provided
  const effectiveAspectRatio = (width && height) ? width / height : aspectRatio;
  
  return (
    <>
      <Grid 
        templateColumns={`repeat(${columnCount}, 1fr)`} 
        gap={spacing}
      >
        {images
          .filter(image => !image.deleted) // Filter out deleted images
          .slice() // Create a copy to avoid mutating the original array
          .reverse() // Reverse the order to show latest images first
          .map((image) => {
          console.log('ImageGallery processing image:', {
            id: image.id || image._id,
            fileUrl: image.fileUrl,
            file_url: image.file_url,
            thumbnailUrl: image.thumbnailUrl,
            thumbnail_url: image.thumbnail_url,
            availableProps: Object.keys(image)
          });
          
          // Get the image URL
          const originalUrl = image.file_url || image.fileUrl;
          
          return (
            <Box // Outer Box (Card)
              key={image.id || image._id}
              onClick={() => handleImageClick(image)}
              cursor="pointer"
              borderRadius={borderRadius}
              overflow="hidden"
              borderWidth="1px" // Add border for card look
              borderColor="gray.200" // Add border color
              _hover={{
                transform: 'scale(1.02)',
                boxShadow: 'md', // Add shadow on hover
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out'
              }}
            >
              <VStack spacing={2} align="start" p={2}> {/* Add padding inside card */}
                <Box // Image container with aspect ratio
                  position="relative"
                  width="100%"
                  paddingBottom={`${100 / effectiveAspectRatio}%`} // Use portrait aspect ratio
                  borderRadius={borderRadius} // Apply border radius to image container too
                  overflow="hidden" // Ensure image corners are rounded
                >
                  <Box position="absolute" top="0" left="0" width="100%" height="100%">
                    {useSignedImages && originalUrl ? (
                      // New approach using SignedImage
                      <SignedImage
                        src={originalUrl}
                        width={width || "100%"}
                        height={height || "100%"}
                        quality={80}
                        alt={image.title || image.file_name || 'Gallery image'}
                        imgProps={{
                          style: {
                            objectFit: 'cover',
                            width: '100%',
                            height: '100%'
                          }
                        }}
                      />
                    ) : (
                      // Legacy approach using LazyImage
                      <LazyImage
                        image={{
                          original_url: image.file_url || image.fileUrl,
                          thumbnail_small_url: image.thumbnail_url || image.thumbnailUrl || image.file_url || image.fileUrl,
                          thumbnail_medium_url: image.thumbnail_url || image.thumbnailUrl || image.file_url || image.fileUrl,
                          thumbnail_large_url: image.thumbnail_url || image.thumbnailUrl || image.file_url || image.fileUrl
                        }}
                        alt={image.title || image.file_name || 'Gallery image'}
                        width={width || "100%"}
                        height={height || "100%"}
                        objectFit="cover"
                      />
                    )}
                  </Box>
                </Box>
                <Text fontWeight="bold" fontSize="sm" noOfLines={1}>
                  {image.title || 'No Title'}
                </Text>
                <Text fontSize="xs" color="gray.600" noOfLines={2}>
                  {image.description || 'No Description'}
                </Text>
              </VStack>
            </Box>
          );
        })}
      </Grid>
      
      {/* Image viewer modal */}
      {selectedImage && (
        <ImageViewerModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          image={selectedImage}
          studentId={studentId}
          learningOutcomeId={learningOutcomeId}
          onImageDeleted={handleImageDeleted}
          useSignedImages={useSignedImages}
          width={width}
          height={height}
          studentGrade={studentGrade}
        />
      )}
    </>
  );
};

export default ImageGallery;