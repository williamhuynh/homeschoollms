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
import SignedImage from './SignedImage';
import { Download, Trash2, Share2, X } from 'react-feather';

const ImageViewerModal = ({ 
  isOpen, 
  onClose, 
  image, 
  studentId, 
  learningOutcomeId, 
  onImageDeleted,
  useSignedImages = false
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const extractImagePath = (url) => {
    if (!url) return null;
    
    const apiPathMatch = url.match(/\/api\/images\/[^\/]+\/(.+)/);
    if (apiPathMatch && apiPathMatch[1]) {
      return apiPathMatch[1];
    }
    
    const backblazeMatch = url.match(/backblazeb2\.com\/(.+)/);
    if (backblazeMatch && backblazeMatch[1]) {
      return backblazeMatch[1];
    }
    
    return url;
  };
  
  const imagePath = extractImagePath(image?.fileUrl);

  const refreshToken = async () => {
    console.log('Refreshing token...');
    const { supabase } = await import('../../services/supabase');
    
    const { data: sessionData, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError) {
      console.error('Token refresh error:', refreshError);
      throw new Error('Your session has expired. Please log out and log back in.');
    }
    
    console.log('Token refresh successful:', sessionData ? 'New token obtained' : 'Failed to get new token');
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return sessionData?.session?.access_token || localStorage.getItem('token');
  };

  const handleDownload = async () => {
    try {
      setIsLoading(true);
      
      const freshToken = await refreshToken();
      
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/learning-outcomes/${studentId}/${learningOutcomeId}/evidence/${image._id}/download`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${freshToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate download link');
      }

      const data = await response.json();
      
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
      
      const freshToken = await refreshToken();
      
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/learning-outcomes/${studentId}/${learningOutcomeId}/evidence/${image._id}/share`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${freshToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate share link');
      }

      const data = await response.json();
      
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
      
      const freshToken = await refreshToken();
      
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/learning-outcomes/${studentId}/${learningOutcomeId}/evidence/${image._id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${freshToken}`
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
      
      setIsDeleteAlertOpen(false);
      
      onClose();
      
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
            {useSignedImages && imagePath ? (
              <SignedImage
                imagePath={imagePath}
                alt={image.title || 'Evidence'}
                quality={90}
                thumbnailWidth={450}
                imgProps={{
                  style: {
                    maxHeight: '85vh',
                    maxWidth: '90vw',
                    objectFit: 'contain',
                    borderRadius: '0.375rem',
                  }
                }}
              />
            ) : (
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
                quality={90}
                thumbnailWidth={450}
                fallbackSrc="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
              />
            )}
            
            <Box mt={4} bg="blackAlpha.600" p={3} borderRadius="md" color="white">
              <Text fontWeight="bold" fontSize="lg">{image.title || image.file_name || 'Evidence'}</Text>
              {image.description && (
                <Text fontSize="md" mt={1}>{image.description}</Text>
              )}
            
              <Flex mt={3} justify="center" gap={4}>
                <Button
                  leftIcon={<Download />}
                  onClick={handleDownload}
                  isLoading={isLoading}
                  loadingText="Downloading"
                  colorScheme="blue"
                  variant="solid"
                >
                  Download
                </Button>
                
                <Button
                  leftIcon={<Share2 />}
                  onClick={handleShare}
                  isLoading={isLoading}
                  loadingText="Sharing"
                  colorScheme="green"
                  variant="solid"
                >
                  Share
                </Button>
                
                <Button
                  leftIcon={<Trash2 />}
                  onClick={() => setIsDeleteAlertOpen(true)}
                  colorScheme="red"
                  variant="solid"
                >
                  Delete
                </Button>
              </Flex>
            </Box>
          </Flex>
        </ModalContent>
      </Modal>
      
      <AlertDialog
        isOpen={isDeleteAlertOpen}
        leastDestructiveRef={undefined}
        onClose={() => setIsDeleteAlertOpen(false)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Evidence
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure? This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button onClick={() => setIsDeleteAlertOpen(false)}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={handleDelete}
                isLoading={isDeleting}
                ml={3}
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
