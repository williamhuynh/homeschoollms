import { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalCloseButton,
  Button,
  Flex,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  IconButton,
  Box,
  Text,
} from '@chakra-ui/react';
import ResponsiveImage from './ResponsiveImage';
import { Download, Trash2, Share2, X } from 'react-feather';

const ImageViewerModal = ({ isOpen, onClose, image, studentId, learningOutcomeId, onImageDeleted }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const handleDownload = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/learning-outcomes/${studentId}/${learningOutcomeId}/evidence/${image._id}/download`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate download link');
      }

      const data = await response.json();
      
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = data.download_url;
      link.download = image.file_name || 'evidence';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: 'Download started',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Download failed',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/learning-outcomes/${studentId}/${learningOutcomeId}/evidence/${image._id}/share`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate share link');
      }

      const data = await response.json();
      
      // Copy the share URL to clipboard
      await navigator.clipboard.writeText(data.share_url);
      
      toast({
        title: 'Share link copied to clipboard',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Share error:', error);
      toast({
        title: 'Failed to generate share link',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/learning-outcomes/${studentId}/${learningOutcomeId}/evidence/${image._id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete image');
      }

      toast({
        title: 'Image deleted',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Close the delete confirmation dialog
      setIsDeleteAlertOpen(false);
      
      // Close the image viewer modal
      onClose();
      
      // Notify parent component that image was deleted
      if (onImageDeleted) {
        onImageDeleted(image._id);
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Delete failed',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!image) {
    return null;
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="full" isCentered>
        <ModalOverlay bg="blackAlpha.800" />
        <ModalContent bg="transparent" boxShadow="none" maxW="100vw" maxH="100vh">
          <Box position="absolute" top={4} right={4} zIndex={10}>
            <IconButton
              icon={<X />}
              onClick={onClose}
              aria-label="Close"
              colorScheme="whiteAlpha"
              variant="ghost"
              size="lg"
              color="white"
              _hover={{ bg: 'whiteAlpha.300' }}
            />
          </Box>
          
          <Flex 
            direction="column" 
            justify="center" 
            align="center" 
            h="100vh" 
            w="100vw"
            position="relative"
          >
            <ResponsiveImage
              image={{
                original_url: image.fileUrl,
                thumbnail_small_url: image.thumbnail_small_url || image.fileUrl,
                thumbnail_medium_url: image.thumbnail_medium_url || image.fileUrl,
                thumbnail_large_url: image.thumbnail_large_url || image.fileUrl
              }}
              alt={image.title || 'Evidence'}
              maxH="85vh"
              maxW="90vw"
              objectFit="contain"
              borderRadius="md"
              fallbackSrc="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
            />
            
            <Box mt={4} bg="blackAlpha.600" p={3} borderRadius="md" color="white">
              <Text fontWeight="bold" fontSize="lg">{image.title || image.file_name || 'Evidence'}</Text>
              {image.description && (
                <Text fontSize="md" mt={1}>{image.description}</Text>
              )}
            </Box>
            
            <Flex 
              position="fixed" 
              bottom={8} 
              bg="blackAlpha.700" 
              borderRadius="full" 
              p={2}
              boxShadow="lg"
            >
              <IconButton
                icon={<Download />}
                onClick={handleDownload}
                aria-label="Download"
                colorScheme="blue"
                isLoading={isLoading}
                mr={2}
                borderRadius="full"
              />
              <IconButton
                icon={<Share2 />}
                onClick={handleShare}
                aria-label="Share"
                colorScheme="green"
                isLoading={isLoading}
                mr={2}
                borderRadius="full"
              />
              <IconButton
                icon={<Trash2 />}
                onClick={() => setIsDeleteAlertOpen(true)}
                aria-label="Delete"
                colorScheme="red"
                isLoading={isDeleting}
                borderRadius="full"
              />
            </Flex>
          </Flex>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isDeleteAlertOpen}
        onClose={() => setIsDeleteAlertOpen(false)}
        leastDestructiveRef={undefined}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Evidence
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete this evidence? This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button onClick={() => setIsDeleteAlertOpen(false)}>
                Cancel
              </Button>
              <Button 
                colorScheme="red" 
                onClick={handleDelete} 
                ml={3}
                isLoading={isDeleting}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
};

export default ImageViewerModal;
