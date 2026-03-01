import { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalCloseButton,
  Button,
  Flex,
  VStack,
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
  FormLabel,
  FormErrorMessage,
  Input,
  Textarea,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Spinner,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerBody,
  DrawerCloseButton,
  DrawerHeader,
  List,
  ListItem,
  Divider,
  Badge,
} from '@chakra-ui/react';
import ResponsiveImage from './ResponsiveImage';
import SignedImage from './SignedImage';
import { Download, Trash2, Share2, X, Edit } from 'react-feather';
import { curriculumService } from '../../services/curriculum';
import Select from 'react-select';
import { updateEvidence } from '../../services/api';
import { HamburgerIcon } from '@chakra-ui/icons';
import { logger } from '../../utils/logger';

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
  const [editLearningAreas, setEditLearningAreas] = useState([]);
  const [editLearningOutcomes, setEditLearningOutcomes] = useState([]);
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
  const [isBottomDrawerOpen, setIsBottomDrawerOpen] = useState(false);

  // Component mounted - no log needed in production

  /**
   * Helper function to detect and format old JSON descriptions
   */
  const formatDescription = (description) => {
    if (!description || !description.trim()) {
      return '';
    }

    // Check if the description looks like the old JSON format
    if (description.includes('ai_question_') && description.includes('{')) {
      try {
        // Try to parse the JSON context
        const contextMatch = description.match(/Context:\s*(\{.*\})/);
        if (contextMatch) {
          const contextJson = JSON.parse(contextMatch[1]);
          
          // Convert the JSON to readable format
          const formattedAnswers = Object.entries(contextJson)
            .filter(([key, value]) => value && value.trim())
            .map(([key, value]) => {
              // Clean up the question key
              const questionNum = key.replace('ai_question_', '');
              return `${value}`;
            })
            .join(', ');
          
          if (formattedAnswers) {
            return `AI analyzed evidence showing: ${formattedAnswers}.`;
          }
        }
        
        // If we can't parse it properly, show a generic message
        return 'Evidence analyzed by AI based on learning activity context.';
      } catch (error) {
        // If JSON parsing fails, show a generic message
        return 'Evidence analyzed by AI based on learning activity context.';
      }
    }

    // If it's not the old format, return as is
    return description;
  };

  const refreshToken = async () => {
    logger.debug('Refreshing token...');
    const { supabase } = await import('../../services/supabase');
    
    const { data: sessionData, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError) {
      logger.error('Token refresh error', refreshError);
      throw new Error('Your session has expired. Please log out and log back in.');
    }
    
    logger.debug('Token refresh successful');
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return sessionData?.session?.access_token || localStorage.getItem('token');
  };

  const handleDownload = async () => {
    try {
      setIsLoading(true);
      
      const freshToken = await refreshToken();
      
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || ''}/api/learning-outcomes/${studentId}/${learningOutcomeId}/evidence/${image._id}/download`,
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
      logger.error('Download error', error);
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
        `${import.meta.env.VITE_API_URL || ''}/api/learning-outcomes/${studentId}/${learningOutcomeId}/evidence/${image._id}/share`,
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
      logger.error('Share error', error);
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
        `${import.meta.env.VITE_API_URL || ''}/api/learning-outcomes/${studentId}/${learningOutcomeId}/evidence/${image._id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${freshToken}`
          }
        }
      );

      if (response.status === 404) {
        logger.debug('Evidence not found, likely already deleted');
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
      logger.error('Delete error', error);
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

  // Extract curriculum loading into reusable function
  const loadCurriculumData = async () => {
    logger.debug('loadCurriculumData called', { hasImage: !!image });
    
    if (!image) {
      return { areas: [], outcomes: [] };
    }

    // Get student grade - try multiple sources for robustness
    let gradeToUse = studentGrade;
    
    if (!gradeToUse && studentId) {
      logger.debug('studentGrade not provided, fetching student data');
      try {
        // Import the API functions to get student data
        const { getStudents, getStudentBySlug } = await import('../../services/api');
        
        // First try to get student by slug (if studentId looks like a slug)
        if (typeof studentId === 'string' && !studentId.match(/^[0-9a-fA-F]{24}$/)) {
          const student = await getStudentBySlug(studentId);
          if (student?.grade_level) {
            gradeToUse = student.grade_level;
            logger.debug('Fetched student grade from slug API', { gradeToUse });
          }
        }
        
        // If still no grade, try getting all students and find by ID or slug
        if (!gradeToUse) {
          const students = await getStudents();
          const student = students.find(s => 
            s._id === studentId || 
            s.id === studentId || 
            s.slug === studentId
          );
          if (student?.grade_level) {
            gradeToUse = student.grade_level;
            logger.debug('Fetched student grade from students list', { gradeToUse });
          } else {
            logger.debug('Could not find student or grade from students list');
          }
        }
      } catch (error) {
        logger.error('Error fetching student data', error);
      }
    }

    if (!gradeToUse) {
      logger.debug('No student grade available, cannot load curriculum');
      return { areas: [], outcomes: [] };
    }
    
    setIsLoadingAreas(true);
    setIsLoadingOutcomes(true);
    
          try {
        const stage = curriculumService.getStageForGrade(gradeToUse);
        logger.debug('Stage for grade', { gradeToUse, stage });
        setCurrentStage(stage);
        
        if (!stage) {
          logger.debug('No stage found for grade', { gradeToUse });
          setIsLoadingAreas(false);
          setIsLoadingOutcomes(false);
          return { areas: [], outcomes: [] };
        }
        
        logger.debug('Loading subjects for grade', { gradeToUse });
        const subjects = await curriculumService.getSubjects(gradeToUse);
      
      const formattedAreas = subjects.map(subject => ({
        value: subject.code,
        label: `${subject.name} (${subject.code})`,
        subject
      }));
      
      logger.debug('Formatted areas loaded', { count: formattedAreas.length });
      setLearningAreasList(formattedAreas);
      setIsLoadingAreas(false);

      // Load outcomes for ALL areas (needed for edit mode multi-select)
      logger.debug('Loading outcomes for all areas');
      const allOutcomes = [];
      
      for (const area of formattedAreas) {
        try {
          const outcomes = await curriculumService.getOutcomes(stage, area.value);
          
          const formattedOutcomes = outcomes.map(outcome => ({
            value: outcome.code,
            label: `${outcome.code}: ${outcome.name}`,
            outcome
          }));
          allOutcomes.push(...formattedOutcomes);
        } catch (error) {
          logger.warn(`Failed to load outcomes for area ${area.value}`);
        }
      }
      
      logger.debug('Total outcomes loaded', { count: allOutcomes.length });
      setLearningOutcomesList(allOutcomes);
      setIsLoadingOutcomes(false);

      // Set display selections for backward compatibility
      const currentArea = image.learning_area_codes?.[0] || image.learning_area_code;
      const areaOption = formattedAreas.find(a => a.value === currentArea) || null;
      setSelectedLearningArea(areaOption);

      const currentOutcome = image.learning_outcome_codes?.[0] || image.learning_outcome_code || image.learning_outcome;
      const outcomeOption = allOutcomes.find(o => o.value === currentOutcome) || null;
      setSelectedLearningOutcome(outcomeOption);
      
      return { areas: formattedAreas, outcomes: allOutcomes };
      
    } catch (error) {
      logger.error('Error loading curriculum data', error);
      setIsLoadingAreas(false);
      setIsLoadingOutcomes(false);
      return { areas: [], outcomes: [] };
    }
  };

  useEffect(() => {
    if (isOpen && image) {
      // Load curriculum data - it will handle missing studentGrade by fetching student data
      loadCurriculumData();
    } else if (!isOpen) {
      setLearningAreasList([]);
      setLearningOutcomesList([]);
      setSelectedLearningArea(null);
      setSelectedLearningOutcome(null);
      setCurrentStage(null);
    }
  }, [isOpen, studentGrade, image, studentId]);

  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      setEditErrors({});
      setEditTitle(image?.title || image?.file_name || '');
      // Use the formatted description, not the raw one
      setEditDescription(formatDescription(image?.description) || '');
      setEditLearningAreas([]);
      setEditLearningOutcomes([]);
    }
  }, [isOpen, image]);

  const findAreaOption = (code, list) => list.find(a => a.value === code) || null;
  const findOutcomeOption = (code, list) => list.find(o => o.value === code) || null;

  const startEdit = async () => {
    setIsEditing(true);
    setEditTitle(image.title || image.file_name || '');
    // Use the formatted description, not the raw one
    setEditDescription(formatDescription(image.description) || '');
    setEditErrors({});
    setIsSaving(false);

    logger.debug('Starting edit mode');

    // Always reload curriculum data fresh for edit mode
    const { areas, outcomes } = await loadCurriculumData();
    
    // Use the fresh loaded data and update the state
    const availableAreas = areas.length > 0 ? areas : learningAreasList;
    const availableOutcomes = outcomes.length > 0 ? outcomes : learningOutcomesList;

    // Update the state with the loaded data
    if (areas.length > 0) {
      setLearningAreasList(areas);
    }
    if (outcomes.length > 0) {
      setLearningOutcomesList(outcomes);
    }

    logger.debug('Curriculum data loaded for edit', { areasCount: availableAreas.length, outcomesCount: availableOutcomes.length });

    // Wait a moment to ensure state is updated
    await new Promise(resolve => setTimeout(resolve, 100));

    // Populate multi-select arrays with current values
    const currentAreaCodes = image.learning_area_codes || (image.learning_area_code ? [image.learning_area_code] : []);
    const currentOutcomeCodes = image.learning_outcome_codes || (image.learning_outcome_code ? [image.learning_outcome_code] : []);
    
    // Remove duplicate area codes
    const uniqueAreaCodes = [...new Set(currentAreaCodes)];
    
    const selectedAreasOptions = uniqueAreaCodes.map(code => {
      // First try direct match
      let found = availableAreas.find(a => a.value === code);
      
      // If not found, try to find subject by outcome prefix
      // (e.g., ENE outcomes are in ENG subject)
      if (!found) {
        found = availableAreas.find(a => {
          // Check if this subject contains outcomes that start with the code prefix
          if (a.subject && a.subject.outcomes) {
            const hasMatchingOutcomes = a.subject.outcomes.some(outcome => 
              outcome.code.startsWith(code + '-')
            );
            return hasMatchingOutcomes;
          }
          return false;
        });
      }
      
      return found;
    }).filter(Boolean);
    
    const selectedOutcomesOptions = currentOutcomeCodes.map(code => {
      const found = availableOutcomes.find(o => o.value === code);
      return found;
    }).filter(Boolean);
    
    logger.debug('Edit mode initialized', { areasSelected: selectedAreasOptions.length, outcomesSelected: selectedOutcomesOptions.length });
    
    setEditLearningAreas(selectedAreasOptions);
    setEditLearningOutcomes(selectedOutcomesOptions);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditErrors({});
  };

  const validateEdit = () => {
    const errors = {};
    if (!editTitle.trim()) errors.title = 'Title is required';
    if (editLearningAreas.length === 0) errors.learningAreas = 'At least one Learning Area is required';
    if (editLearningOutcomes.length === 0) errors.learningOutcomes = 'At least one Learning Outcome is required';
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
        learning_area_codes: editLearningAreas.map(area => area.value),
        learning_outcome_codes: editLearningOutcomes.map(outcome => outcome.value),
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
        // Update both old and new field formats for compatibility
        image.learning_area_codes = updated.learning_area_codes || [];
        image.learning_area_code = updated.learning_area_codes?.[0] || null;
        image.learning_outcome_codes = updated.learning_outcome_codes || [];
        image.learning_outcome_code = updated.learning_outcome_codes?.[0] || null;
        // Clear cached outcome details so they refresh from server
        image.learning_outcome_details = null;
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

  // Get formatted description
  const displayDescription = formatDescription(image.description);

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
            {useSignedImages && image.fileUrl ? (
              <SignedImage
                src={image.fileUrl}
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
                  <IconButton
                    icon={<HamburgerIcon color="#f0f0f0" />}
                    variant="ghost"
                    colorScheme="gray"
                    aria-label="Actions"
                    size="sm"
                    _hover={{ bg: 'whiteAlpha.300' }}
                    onClick={() => setIsBottomDrawerOpen(true)}
                  />
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
                  displayDescription && <Text fontSize="md" mt={1}>{displayDescription}</Text>
                )}
              </Box>
                            <Box mt={3}>
                {isEditing ? (
                  <FormControl isInvalid={!!editErrors.learningAreas} isRequired>
                    <FormLabel fontSize="sm" color="white">Learning Areas</FormLabel>
                    {isLoadingAreas ? <Spinner size="sm" /> : (
                      <Select
                        options={learningAreasList}
                        value={editLearningAreas}
                        onChange={setEditLearningAreas}
                        placeholder="Select learning areas..."
                        isMulti
                        isSearchable
                        closeMenuOnSelect={false}
                        classNamePrefix="react-select"
                        styles={{ 
                          menu: base => ({ ...base, zIndex: 9999 }),
                          control: base => ({ ...base, backgroundColor: 'white', minHeight: '40px' }),
                          multiValue: base => ({ ...base, backgroundColor: '#3182ce', color: 'white' }),
                          multiValueLabel: base => ({ ...base, color: 'white' }),
                          multiValueRemove: base => ({ ...base, color: 'white', ':hover': { backgroundColor: '#2c5aa0', color: 'white' } }),
                          option: (base, state) => ({
                            ...base,
                            color: state.isSelected ? 'white' : 'black',
                            backgroundColor: state.isSelected ? '#3182ce' : state.isFocused ? '#f7fafc' : 'white'
                          }),
                          input: base => ({ ...base, color: 'black' }),
                          placeholder: base => ({ ...base, color: 'gray' }),
                          singleValue: base => ({ ...base, color: 'black' })
                        }}
                      />
                    )}
                    {editErrors.learningAreas && <FormErrorMessage>{editErrors.learningAreas}</FormErrorMessage>}
                  </FormControl>
                ) : (
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold" mb={2} color="gray.300">Learning Areas</Text>
                    <Flex wrap="wrap" gap={2}>
                      {(() => {
                        const areaCodes = image.learning_area_codes || (image.learning_area_code ? [image.learning_area_code] : []);
                        // Remove duplicates by converting to Set and back to Array
                        const uniqueAreaCodes = [...new Set(areaCodes)];
                        
                        if (uniqueAreaCodes.length === 0) {
                          return <Badge colorScheme="gray" variant="subtle">No areas specified</Badge>;
                        }
                        return uniqueAreaCodes.map((areaCode, index) => {
                          const areaOption = learningAreasList.find(a => a.value === areaCode);
                          return (
                            <Badge 
                              key={index} 
                              colorScheme="blue" 
                              variant="solid"
                              fontSize="xs"
                              px={2}
                              py={1}
                            >
                              {areaOption ? areaOption.subject.name : areaCode}
                            </Badge>
                          );
                        });
                      })()}
                    </Flex>
                  </Box>
                )}
              </Box>
              <Box mt={3}>
                {isEditing ? (
                  <FormControl isInvalid={!!editErrors.learningOutcomes} isRequired>
                    <FormLabel fontSize="sm" color="white">Learning Outcomes</FormLabel>
                    {isLoadingOutcomes ? <Spinner size="sm" /> : (
                      <Select
                        options={learningOutcomesList}
                        value={editLearningOutcomes}
                        onChange={setEditLearningOutcomes}
                        placeholder="Select learning outcomes..."
                        isMulti
                        isSearchable
                        closeMenuOnSelect={false}
                        classNamePrefix="react-select"
                        styles={{ 
                          menu: base => ({ ...base, zIndex: 9999 }),
                          control: base => ({ ...base, backgroundColor: 'white', minHeight: '40px' }),
                          multiValue: base => ({ ...base, backgroundColor: '#38a169', color: 'white' }),
                          multiValueLabel: base => ({ ...base, color: 'white' }),
                          multiValueRemove: base => ({ ...base, color: 'white', ':hover': { backgroundColor: '#2f855a', color: 'white' } }),
                          option: (base, state) => ({
                            ...base,
                            color: state.isSelected ? 'white' : 'black',
                            backgroundColor: state.isSelected ? '#38a169' : state.isFocused ? '#f7fafc' : 'white'
                          }),
                          input: base => ({ ...base, color: 'black' }),
                          placeholder: base => ({ ...base, color: 'gray' }),
                          singleValue: base => ({ ...base, color: 'black' })
                        }}
                      />
                    )}
                    {editErrors.learningOutcomes && <FormErrorMessage>{editErrors.learningOutcomes}</FormErrorMessage>}
                  </FormControl>
                ) : (
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold" mb={2} color="gray.300">Learning Outcomes</Text>
                    <VStack spacing={2} align="stretch">
                      {(() => {
                        // Use the rich outcome details from backend if available, otherwise fallback to codes
                        const outcomeDetails = image.learning_outcome_details || [];
                        const outcomeCodes = image.learning_outcome_codes || (image.learning_outcome_code ? [image.learning_outcome_code] : []);
                        
                        if (outcomeDetails.length === 0 && outcomeCodes.length === 0) {
                          return <Badge colorScheme="gray" variant="subtle">No outcomes specified</Badge>;
                        }
                        
                        // If we have rich details, use them
                        if (outcomeDetails.length > 0) {
                          return outcomeDetails.map((outcome, index) => (
                            <Box 
                              key={index}
                              bg="whiteAlpha.100"
                              p={3}
                              borderRadius="md"
                              borderLeft="4px solid"
                              borderLeftColor="green.400"
                            >
                              <Text fontSize="xs" fontWeight="bold" color="green.300" mb={1}>
                                {outcome.code}
                              </Text>
                              <Text fontSize="sm" color="white" lineHeight="1.3">
                                {outcome.name || 'Learning outcome'}
                              </Text>
                              {outcome.description && (
                                <Text fontSize="xs" color="gray.400" mt={1} noOfLines={2}>
                                  {outcome.description}
                                </Text>
                              )}
                            </Box>
                          ));
                        }
                        
                        // Fallback to old logic for backward compatibility
                        return outcomeCodes.map((outcomeCode, index) => {
                          const outcomeOption = learningOutcomesList.find(o => o.value === outcomeCode);
                          return (
                            <Box 
                              key={index}
                              bg="whiteAlpha.100"
                              p={3}
                              borderRadius="md"
                              borderLeft="4px solid"
                              borderLeftColor="green.400"
                            >
                              <Text fontSize="xs" fontWeight="bold" color="green.300" mb={1}>
                                {outcomeCode}
                              </Text>
                              <Text fontSize="sm" color="white" lineHeight="1.3">
                                {outcomeOption ? outcomeOption.outcome.name : 'Auto-created learning outcome'}
                              </Text>
                              {outcomeOption && (
                                <Text fontSize="xs" color="gray.400" mt={1} noOfLines={2}>
                                  {outcomeOption.outcome.description}
                                </Text>
                              )}
                            </Box>
                          );
                        });
                      })()}
                    </VStack>
                  </Box>
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

      <Drawer
        isOpen={isBottomDrawerOpen}
        placement="bottom"
        onClose={() => setIsBottomDrawerOpen(false)}
        size="xs"
      >
        <DrawerOverlay />
        <DrawerContent borderTopRadius="2xl" pb={4}>
          <DrawerCloseButton />
          <DrawerHeader>Actions</DrawerHeader>
          <DrawerBody>
            <Flex justify="space-around" align="center" w="100%">
              <Flex direction="column" align="center" mx={2}>
                <IconButton
                  aria-label="Save"
                  icon={<Download color="#4A5568" />}
                  onClick={() => {
                    setIsBottomDrawerOpen(false);
                    setTimeout(() => { handleDownload(); }, 250);
                  }}
                  bg="gray.100"
                  color="gray.600"
                  isRound
                  size="lg"
                  _hover={{ bg: 'gray.200' }}
                />
                <Text fontSize="sm" mt={2}>Save</Text>
              </Flex>
              <Flex direction="column" align="center" mx={2}>
                <IconButton
                  aria-label="Share"
                  icon={<Share2 color="#4A5568" />}
                  onClick={() => {
                    setIsBottomDrawerOpen(false);
                    setTimeout(() => { handleShare(); }, 250);
                  }}
                  bg="gray.100"
                  color="gray.600"
                  isRound
                  size="lg"
                  _hover={{ bg: 'gray.200' }}
                />
                <Text fontSize="sm" mt={2}>Share</Text>
              </Flex>
              <Flex direction="column" align="center" mx={2}>
                <IconButton
                  aria-label="Delete"
                  icon={<Trash2 color="#4A5568" />}
                  onClick={() => {
                    setIsBottomDrawerOpen(false);
                    setTimeout(() => { setIsDeleteAlertOpen(true); }, 250);
                  }}
                  bg="gray.100"
                  color="gray.600"
                  isRound
                  size="lg"
                  _hover={{ bg: 'red.100' }}
                />
                <Text fontSize="sm" mt={2}>Delete</Text>
              </Flex>
              <Flex direction="column" align="center" mx={2}>
                <IconButton
                  aria-label="Edit"
                  icon={<Edit color="#4A5568" />}
                  onClick={() => {
                    setIsBottomDrawerOpen(false);
                    setTimeout(() => { startEdit(); }, 250);
                  }}
                  bg="gray.100"
                  color="gray.600"
                  isRound
                  size="lg"
                  _hover={{ bg: 'gray.200' }}
                />
                <Text fontSize="sm" mt={2}>Edit</Text>
              </Flex>
            </Flex>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default ImageViewerModal;
