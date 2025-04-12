import { useState } from 'react';
import { Grid, Box, useBreakpointValue } from '@chakra-ui/react';
import LazyImage from './LazyImage';
import ImageViewerModal from './ImageViewerModal';

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
  borderRadius = 'md'
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
  
  return (
    <>
      <Grid 
        templateColumns={`repeat(${columnCount}, 1fr)`} 
        gap={spacing}
      >
        {images.map((image) => (
          <Box 
            key={image.id || image._id} 
            onClick={() => handleImageClick(image)}
            cursor="pointer"
            borderRadius={borderRadius}
            overflow="hidden"
            position="relative"
            paddingBottom={`${100 * aspectRatio}%`} // Maintain aspect ratio
            _hover={{
              transform: 'scale(1.02)',
              transition: 'transform 0.2s ease-in-out'
            }}
          >
            <Box position="absolute" top="0" left="0" width="100%" height="100%">
              <LazyImage
                image={{
                  original_url: image.fileUrl,
                  thumbnail_small_url: image.thumbnail_small_url || image.fileUrl,
                  thumbnail_medium_url: image.thumbnail_medium_url || image.fileUrl,
                  thumbnail_large_url: image.thumbnail_large_url || image.fileUrl
                }}
                alt={image.title || image.file_name || 'Gallery image'}
                width="100%"
                height="100%"
                objectFit="cover"
                borderRadius={borderRadius}
              />
            </Box>
          </Box>
        ))}
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
        />
      )}
    </>
  );
};

export default ImageGallery;