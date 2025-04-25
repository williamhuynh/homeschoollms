import { useState, useEffect } from 'react';
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
  FormControl,
  FormErrorMessage,
  Input,
  Textarea,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Spinner,
} from '@chakra-ui/react';
import ResponsiveImage from './ResponsiveImage';
import SignedImage from './SignedImage';
import { Download, Trash2, Share2, X } from 'react-feather';
import { curriculumService } from '../../services/curriculum';
import Select from 'react-select';
import { updateEvidence } from '../../services/api';
import { HamburgerIcon } from '@chakra-ui/icons';

const ImageViewerModal = ({ 
  isOpen, 
  onClose, 
  image, 
  studentId, 
  learningOutcomeId, 
  onImageDeleted,
  width,
  height,
  useSignedImages = false,
  studentGrade
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLearningArea, setEditLearningArea] = useState(null);
  const [editLearningOutcome, setEditLearningOutcome] = useState(null);
  const [learningAreasList, setLearningAreasList] = useState([]);
  const [learningOutcomesList, setLearningOutcomesList] = useState([]);
  const [isLoadingAreas, setIsLoadingAreas] = useState(false);
  const [isLoadingOutcomes, setIsLoadingOutcomes] = useState(false);
  const [editErrors, setEditErrors] = useState({});
  const [currentStage, setCurrentStage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [areasLoaded, setAreasLoaded] = useState(false);
  const [outcomesLoaded, setOutcomesLoaded] = useState(false);
  const [selectedLearningArea, setSelectedLearningArea] = useState(null);
  const [selectedLearningOutcome, setSelectedLearningOutcome] = useState(null);

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

      if (response.status === 404) {
        console.log('Evidence not found, likely already deleted');
        toast({
          title: 'Image already removed',
          description: 'The evidence was already deleted or does not exist.',
          status: 'info',
          duration: 3000,
          isClosable: true,
        });
        
        setIsDeleteAlertOpen(false);
        onClose();
        
        if (onImageDeleted) {
          onImageDeleted(image._id);
        }
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || `Server error (${response.status})`;
        throw new Error(`Failed to delete image: ${errorMessage}`);
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
        description: error.message || 'An unknown error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      
      if (onImageDeleted) {
        onImageDeleted(image._id);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (isOpen && studentGrade && image) {
      const loadAreasAndOutcomes = async () => {
        setIsLoadingAreas(true);
        setLearningAreasList([]);
        setSelectedLearningArea(null);
        setLearningOutcomesList([]);
        setSelectedLearningOutcome(null);
        setIsLoadingOutcomes(false);
        setCurrentStage(null);

        const stage = curriculumService.getStageForGrade(studentGrade);
        setCurrentStage(stage);
        if (stage) {
          const subjects = await curriculumService.getSubjects(studentGrade);
          const formattedAreas = subjects.map(subject => ({
            value: subject.code,
            label: `${subject.name} (${subject.code})`,
            subject
          }));
          setLearningAreasList(formattedAreas);
          setIsLoadingAreas(false);

          const currentArea = image.learningArea || image.learning_area_code || image.learning_area;
          const areaOption = formattedAreas.find(a => a.value === currentArea) || null;
          setSelectedLearningArea(areaOption);

          if (areaOption) {
            setIsLoadingOutcomes(true);
            const outcomes = await curriculumService.getOutcomes(stage, areaOption.value);
            const formattedOutcomes = outcomes.map(outcome => ({
              value: outcome.code,
              label: `${outcome.code}: ${outcome.name}`,
              outcome
            }));
            setLearningOutcomesList(formattedOutcomes);
            setIsLoadingOutcomes(false);

            const currentOutcome = image.learningOutcome || image.learning_outcome_code || image.learning_outcome;
            const outcomeOption = formattedOutcomes.find(o => o.value === currentOutcome) || null;
            setSelectedLearningOutcome(outcomeOption);
          }
        }
      };
      loadAreasAndOutcomes();
    } else if (!isOpen) {
      setLearningAreasList([]);
      setLearningOutcomesList([]);
      setSelectedLearningArea(null);
      setSelectedLearningOutcome(null);
      setCurrentStage(null);
    }
  }, [isOpen, studentGrade, image]);

  const findAreaOption = (code, list) => list.find(a => a.value === code) || null;
  const findOutcomeOption = (code, list) => list.find(o => o.value === code) || null;

  const startEdit = async () => {
    setIsEditing(true);
    setEditTitle(image.title || image.file_name || '');
    setEditDescription(image.description || '');
    setEditErrors({});
    setIsSaving(false);

    setEditLearningArea(selectedLearningArea);
    setEditLearningOutcome(selectedLearningOutcome);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditErrors({});
  };

  const validateEdit = () => {
    const errors = {};
    if (!editTitle.trim()) errors.title = 'Title is required';
    if (!editLearningArea) errors.learningArea = 'Learning Area is required';
    if (!editLearningOutcome) errors.learningOutcome = 'Learning Outcome is required';
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveEdit = async () => {
    if (!validateEdit()) return;
    setIsSaving(true);
    try {
      const payload = {
        title: editTitle,
        description: editDescription,
        learning_area_code: editLearningArea?.value,
        learning_outcome_code: editLearningOutcome?.value,
      };
      const updated = await updateEvidence(
        studentId,
        learningOutcomeId,
        image._id,
        payload
      );
      // Update local UI (shallow update)
      if (updated) {
        image.title = updated.title;
        image.description = updated.description;
        image.learningArea = updated.learning_area_code;
        image.learningOutcome = updated.learning_outcome_code;
      }
      setIsEditing(false);
      toast({
        title: 'Evidence updated',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Failed to update evidence',
        description: error?.response?.data?.detail || error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
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
            justify="flex-start" 
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
                width={width}
                height={height}
                imgProps={{
                  style: {
                    maxHeight: '60vh',
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
                width={width}
                height={height}
                maxH="60vh"
                maxW="90vw"
                objectFit="contain"
                borderRadius="md"
                quality={90}
                fallbackSrc="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
              />
            )}
            
            <Box mt={6} bg="blackAlpha.600" p={5} borderRadius="md" color="white" minW="340px" maxW="lg" w="90vw">
              <Flex align="center" justify="space-between">
                {isEditing ? (
                  <FormControl isInvalid={!!editErrors.title} isRequired w="70%">
                    <Input
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      placeholder="Title"
                      size="md"
                      bg="white"
                      color="black"
                    />
                    {editErrors.title && <FormErrorMessage>{editErrors.title}</FormErrorMessage>}
                  </FormControl>
                ) : (
                  <Text fontWeight="bold" fontSize="xl" noOfLines={2}>{image.title || image.file_name || 'Evidence'}</Text>
                )}
                <Box>
                  <Menu>
                    <MenuButton
                      as={IconButton}
                      icon={<HamburgerIcon />}
                      variant="ghost"
                      colorScheme="gray"
                      aria-label="Actions"
                      size="sm"
                    />
                    <MenuList bg="white" color="black">
                      <MenuItem icon={<Download />} onClick={handleDownload}>Download</MenuItem>
                      <MenuItem icon={<Share2 />} onClick={handleShare}>Share</MenuItem>
                      <MenuItem icon={<Trash2 />} onClick={() => setIsDeleteAlertOpen(true)}>Delete</MenuItem>
                      <MenuItem icon={<Box as="svg" viewBox="0 0 24 24" width="20" height="20"><path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></Box>} onClick={startEdit}>Edit</MenuItem>
                    </MenuList>
                  </Menu>
                </Box>
              </Flex>
              <Box mt={3}>
                {isEditing ? (
                  <FormControl>
                    <Textarea
                      value={editDescription}
                      onChange={e => setEditDescription(e.target.value)}
                      placeholder="Description (optional)"
                      size="sm"
                      bg="white"
                      color="black"
                    />
                  </FormControl>
                ) : (
                  image.description && <Text fontSize="md" mt={1}>{image.description}</Text>
                )}
              </Box>
              <Box mt={3}>
                {isEditing ? (
                  <FormControl isInvalid={!!editErrors.learningArea} isRequired>
                    {isLoadingAreas ? <Spinner size="sm" /> : (
                      <Select
                        options={learningAreasList}
                        value={editLearningArea}
                        onChange={option => setEditLearningArea(option)}
                        placeholder="Select a learning area..."
                        isClearable
                        isSearchable
                        classNamePrefix="react-select"
                        styles={{ menu: base => ({ ...base, zIndex: 9999 }) }}
                      />
                    )}
                    {editErrors.learningArea && <FormErrorMessage>{editErrors.learningArea}</FormErrorMessage>}
                  </FormControl>
                ) : (
                  <Text fontSize="md" mt={1}><b>Learning Area:</b> {selectedLearningArea?.label || '-'}</Text>
                )}
              </Box>
              <Box mt={3}>
                {isEditing ? (
                  <FormControl isInvalid={!!editErrors.learningOutcome} isRequired>
                    {isLoadingOutcomes ? <Spinner size="sm" /> : (
                      <Select
                        options={learningOutcomesList}
                        value={editLearningOutcome}
                        onChange={option => setEditLearningOutcome(option)}
                        placeholder="Select a learning outcome..."
                        isClearable
                        isSearchable
                        classNamePrefix="react-select"
                        styles={{ menu: base => ({ ...base, zIndex: 9999 }) }}
                      />
                    )}
                    {editErrors.learningOutcome && <FormErrorMessage>{editErrors.learningOutcome}</FormErrorMessage>}
                  </FormControl>
                ) : (
                  <Text fontSize="md" mt={1}><b>Learning Outcome:</b> {selectedLearningOutcome?.label || '-'}</Text>
                )}
              </Box>
              {isEditing && (
                <Flex mt={4} gap={3} justify="flex-end">
                  <Button onClick={cancelEdit} variant="ghost" colorScheme="gray">Cancel</Button>
                  <Button onClick={saveEdit} colorScheme="blue" isLoading={isSaving}>Save</Button>
                </Flex>
              )}
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
