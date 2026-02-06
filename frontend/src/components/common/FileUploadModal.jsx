import { useState, useCallback, useEffect } from 'react' // Added useEffect
import { generateAIDescription, uploadEvidence } from '../../services/api'
import { curriculumService } from '../../services/curriculum'
import { compressImage } from '../../services/imageService'
import { logger } from '../../utils/logger'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  VStack,
  Input,
  Textarea,
  Box,
  Text,
  HStack,
  IconButton,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Spinner,
  InputGroup,
  InputLeftElement,
  Alert,
  AlertIcon
} from '@chakra-ui/react'
import { Upload, X as XIcon, MapPin, WifiOff } from 'react-feather'
import ResponsiveImage from './ResponsiveImage'
import Select from 'react-select'

const MAX_FILES = 10; // Define max files constant

const FileUploadModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  studentId, 
  studentGrade,
  learningOutcomeId, 
  learningOutcomeDescription,
  initialLearningAreaCode,
  initialLearningOutcomeCode
}) => {
  const [selectedFiles, setSelectedFiles] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState(null)
  const [currentStage, setCurrentStage] = useState(null) // Add state for stage
  
  // Learning areas and outcomes state
  const [learningAreasList, setLearningAreasList] = useState([])
  const [learningOutcomesList, setLearningOutcomesList] = useState([])
  const [selectedLearningArea, setSelectedLearningArea] = useState(null)
  const [selectedLearningOutcome, setSelectedLearningOutcome] = useState(null)
  const [isLoadingAreas, setIsLoadingAreas] = useState(false)
  const [isLoadingOutcomes, setIsLoadingOutcomes] = useState(false)
  const [curriculumError, setCurriculumError] = useState(null)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  
  // Form validation
  const [titleError, setTitleError] = useState('')
  const [learningAreaError, setLearningAreaError] = useState('')
  const [learningOutcomeError, setLearningOutcomeError] = useState('')

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load curriculum data when modal opens
  useEffect(() => {
    if (isOpen) {
      // Add guard: Only proceed if studentGrade is valid
      if (!studentGrade) {
        logger.debug('FileUploadModal: Waiting for valid studentGrade');
        // Clear potentially stale state
        setLearningAreasList([]);
        setSelectedLearningArea(null);
        setCurrentStage(null);
        setLearningOutcomesList([]);
        setSelectedLearningOutcome(null);
        setCurriculumError('Student grade not available yet.'); // Inform user
        return; // Exit early
      }

      const loadCurriculum = async () => {
        try {
          setIsLoadingAreas(true)
          setCurriculumError(null)
          
          // Get student stage based on grade - No fallback needed now
          const stage = curriculumService.getStageForGrade(studentGrade)
          logger.debug('FileUploadModal: Stage derived from grade', { studentGrade, stage });
          setCurrentStage(stage); // Set the stage state here

          // If stage calculation failed, don't proceed
          if (!stage) {
            setCurriculumError('Could not determine student stage.');
            setIsLoadingAreas(false);
            return;
          }
          
          // Load curriculum data for this stage
          await curriculumService.load(stage)
          
          // Get subjects for this stage - now awaiting the async method
          const subjects = await curriculumService.getSubjects(studentGrade || 'Year 1')
          
          // Format for react-select
          const formattedSubjects = subjects.map(subject => ({
            value: subject.code,
            label: `${subject.name} (${subject.code})`,
            subject: subject
          }))
          
          setLearningAreasList(formattedSubjects)
          
          // If initialLearningAreaCode is provided, select it
          if (initialLearningAreaCode) {
            const initialArea = formattedSubjects.find(
              area => area.value.toLowerCase() === initialLearningAreaCode.toLowerCase()
            )
            if (initialArea) {
              setSelectedLearningArea(initialArea)
            }
          }
        } catch (err) {
          logger.error('Error loading curriculum', err)
          setCurriculumError(isOffline ? 
            'Curriculum data not available offline' : 
            'Failed to load curriculum data'
          )
        } finally {
          setIsLoadingAreas(false)
        }
      }
      
      loadCurriculum()
      
      // Reset form when modal opens
      setTitle('')
      setDescription('')
      setLocation('')
      setSelectedFiles([])
      setTitleError('')
    }
  }, [isOpen, studentGrade, initialLearningAreaCode, isOffline])
  
  // Load outcomes when learning area changes OR currentStage is set
  useEffect(() => {
    // Only run if an area is selected AND we have a valid stage stored
    if (selectedLearningArea && currentStage) {
      const loadOutcomes = async () => {
        try {
          setIsLoadingOutcomes(true)
          setCurriculumError(null)
          logger.debug('FileUploadModal: Loading outcomes', { stage: currentStage, area: selectedLearningArea.value });

          // Get outcomes using the stored stage
          const outcomes = await curriculumService.getOutcomes(currentStage, selectedLearningArea.value)
          
          // Format for react-select
          const formattedOutcomes = outcomes.map(outcome => ({
            value: outcome.code,
            label: `${outcome.code}: ${outcome.name}`,
            outcome: outcome
          }))
          
          setLearningOutcomesList(formattedOutcomes)
          
          // If initialLearningOutcomeCode is provided, select it
          if (initialLearningOutcomeCode) {
            const initialOutcome = formattedOutcomes.find(
              outcome => outcome.value.toLowerCase() === initialLearningOutcomeCode.toLowerCase()
            )
            if (initialOutcome) {
              setSelectedLearningOutcome(initialOutcome)
            }
          }
        } catch (err) {
          logger.error('Error loading outcomes', err)
          setCurriculumError(isOffline ? 
            'Learning outcomes not available offline' : 
            'Failed to load learning outcomes'
          )
        } finally {
          setIsLoadingOutcomes(false)
        }
      }
      
      loadOutcomes()
    } else {
      // Clear outcomes if no area or stage
      setLearningOutcomesList([])
      setSelectedLearningOutcome(null)
    }
  }, [selectedLearningArea, currentStage, initialLearningOutcomeCode, isOpen, isOffline])

  const handleFileSelect = useCallback(async (event) => {
  const files = Array.from(event.target.files);
  const newFiles = files.filter(file =>
    !selectedFiles.some(existingFile => existingFile.name === file.name && existingFile.lastModified === file.lastModified)
  );

  // Compress images before storing to avoid exceeding Vercel's proxy body-size limit
  const compressed = await Promise.all(newFiles.map(f => compressImage(f)));

  // Add unique identifiers to files for key prop
  const filesWithIds = compressed.map(file => ({ file, id: crypto.randomUUID() }));

  setSelectedFiles(prevFiles => {
    const combined = [...prevFiles, ...filesWithIds];
    // Enforce max file limit
    if (combined.length > MAX_FILES) {
      setError(`You can only upload a maximum of ${MAX_FILES} files.`);
      return prevFiles; // Keep previous state if limit exceeded
    }
    setError(null); // Clear error if within limit
    logger.debug('FileUploadModal: Files selected', { count: combined.length });
    return combined;
  });
  // Clear the input value to allow selecting the same file again after removing it
  event.target.value = null;
}, [selectedFiles]);

const handleRemoveFile = useCallback((fileIdToRemove) => {
  setSelectedFiles(prevFiles => prevFiles.filter(f => f.id !== fileIdToRemove));
}, []);

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const validateForm = () => {
    let isValid = true
    
    // Validate title (required)
    if (!title.trim()) {
      setTitleError('Title is required')
      isValid = false
    } else {
      setTitleError('')
    }

    // Validate Learning Area (required)
    if (!selectedLearningArea) {
      setLearningAreaError('Learning Area is required')
      isValid = false
    } else {
      setLearningAreaError('')
    }

    // Validate Learning Outcome (required)
    if (!selectedLearningOutcome) {
      setLearningOutcomeError('Learning Outcome is required')
      isValid = false
    } else {
      setLearningOutcomeError('')
    }
    
    // Also validate file selection
    if (selectedFiles.length === 0) {
      setError('Please select at least one file')
      isValid = false
    } else if (selectedFiles.length > MAX_FILES) {
      setError(`You can only upload a maximum of ${MAX_FILES} files. Please remove some.`)
      isValid = false
    } else {
      setError(null)
    }
    
    return isValid
  }
  
  const handleGenerateDescription = async () => {
    if (selectedFiles.length === 0) {
      setGenerationError('Please select at least one file first')
      return
    }
    
    if (isOffline) {
      setGenerationError('AI description generation is not available offline')
      return
    }
    
    setIsGenerating(true)
    setGenerationError(null)
    
    try {
      // Build a comprehensive context using all available information
      let contextParts = []
      
      // Add the learning outcome description if available
      if (selectedLearningOutcome?.outcome?.description) {
        contextParts.push(`Learning Outcome: ${selectedLearningOutcome.outcome.description}`)
      } else if (learningOutcomeDescription) {
        contextParts.push(`Learning Outcome: ${learningOutcomeDescription}`)
      }
      
      // Add the learning outcome code if available
      if (selectedLearningOutcome?.outcome?.code || selectedLearningOutcome?.value) {
        contextParts.push(`Learning Outcome Code: ${selectedLearningOutcome?.outcome?.code || selectedLearningOutcome?.value}`)
      }
      
      // Add the learning area if available
      if (selectedLearningArea?.label) {
        contextParts.push(`Learning Area: ${selectedLearningArea.label}`)
      }
      
      // Add the title if available
      if (title) {
        contextParts.push(`Title: ${title}`)
      }
      
      // Add any existing description content if available
      if (description && description.trim()) {
        contextParts.push(`Initial Description: ${description}`)
      }
      
      // Combine all parts or use a default if nothing is available
      const contextDescription = contextParts.length > 0 
        ? contextParts.join('\n') 
        : 'Please describe the uploaded content'
      
      // Pass the array of actual File objects with the comprehensive context
      const fileObjects = selectedFiles.map(f => f.file)
      const result = await generateAIDescription(fileObjects, contextDescription)
      
      if (result && result.description) {
        setDescription(result.description)
      } else {
        setGenerationError('Failed to generate description')
      }
      
      if (result && result.title && result.title.trim()) {
        setTitle(result.title.trim())
      }
    } catch (err) {
      const status = err.response?.status
      const detail = err.response?.data?.detail
      logger.error('FileUploadModal: generateAIDescription failed', err, {
        step: 'generate-description',
        fileCount: selectedFiles.length,
        studentId,
      })
      const statusHint = status ? ` (HTTP ${status})` : ''
      setGenerationError(detail || err.message || `Failed to generate description${statusHint}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSubmit = async () => {
    if (isOffline) {
      setError('Cannot upload files while offline')
      return
    }

    if (!validateForm()) {
      return
    }

    if (selectedFiles.length === 0) {
      setError('Please select at least one file')
      return
    }
    if (selectedFiles.length > MAX_FILES) {
      setError(`You can only upload a maximum of ${MAX_FILES} files. Please remove some.`)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const formData = new FormData()

      // Append each file with the key 'files'
      selectedFiles.forEach(({ file }) => {
        formData.append('files', file)
      });

      // Required fields
      formData.append('title', title)

      // Optional fields
      formData.append('description', description)

      // New fields
      if (location) formData.append('location', location)
      if (selectedLearningArea) formData.append('learning_area_code', selectedLearningArea.value)
      if (selectedLearningOutcome) formData.append('learning_outcome_code', selectedLearningOutcome.value)

      // Add student grade and outcome description for better context
      if (studentGrade) formData.append('student_grade', studentGrade)
      if (learningOutcomeDescription) formData.append('learning_outcome_description', learningOutcomeDescription)

      // Use the API service instead of direct fetch
      const result = await uploadEvidence(studentId, learningOutcomeId, formData)

      onSubmit(result)
      onClose()
    } catch (err) {
      const status = err.response?.status
      const detail = err.response?.data?.detail
      logger.error('FileUploadModal: uploadEvidence failed', err, {
        step: 'upload-evidence',
        fileCount: selectedFiles.length,
        studentId,
        learningOutcomeId,
        learningArea: selectedLearningArea?.value,
        learningOutcome: selectedLearningOutcome?.value,
      })
      const statusHint = status ? ` (HTTP ${status})` : ''
      setError(detail || err.message || `Upload failed${statusHint}. Please try again.`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Upload Evidence</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {isOffline && (
            <Alert status="warning" mb={4}>
              <AlertIcon />
              <HStack>
                <WifiOff size={16} />
                <Text>You are offline. File uploads will not work until you reconnect.</Text>
              </HStack>
            </Alert>
          )}
          
          <VStack spacing={4}>
            <Box w="full">
              <input
                type="file"
                accept="image/*,video/*"
                multiple // Allow multiple file selection
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                id="file-upload"
                disabled={isOffline}
              />
              <label htmlFor="file-upload">
                <Button
                  as="span"
                  leftIcon={<Upload />}
                  w="full"
                  h="150px" // Reduced height
                  variant="outline"
                  isDisabled={selectedFiles.length >= MAX_FILES || isOffline}
                >
                  {selectedFiles.length > 0 ? `Add More Files (${selectedFiles.length}/${MAX_FILES})` : `Select Files (Max ${MAX_FILES})`}
                </Button>
              </label>
              {selectedFiles.length >= MAX_FILES && (
                <Text color="orange.500" fontSize="sm" mt={1}>Maximum {MAX_FILES} files reached.</Text>
              )}
            </Box>

            {/* Preview Section */}
            {selectedFiles.length > 0 && (
              <Box w="full" overflowX="auto" p={2} borderWidth="1px" borderRadius="md">
                <HStack spacing={3}>
                  {selectedFiles.map(({ file, id }) => (
                    <Box key={id} position="relative" w="100px" h="100px" flexShrink={0}>
                      <ResponsiveImage
                        image={{
                          original_url: URL.createObjectURL(file),
                          // For local file previews, we don't have thumbnails yet
                          // so we use the same URL for all sizes
                          thumbnail_small_url: URL.createObjectURL(file),
                          thumbnail_medium_url: URL.createObjectURL(file),
                          thumbnail_large_url: URL.createObjectURL(file)
                        }}
                        alt={`Preview ${file.name}`}
                        width="100%"
                        height="100%"
                        imgProps={{
                          style: {
                            objectFit: 'cover',
                            objectPosition: 'center',
                            width: '100%',
                            height: '100%',
                            borderRadius: '0.375rem'
                          }
                        }}
                        isVisible={true} // Ensure image loading is triggered
                      />
                      <IconButton
                        icon={<XIcon size="12px" />}
                        size="xs"
                        colorScheme="red"
                        variant="solid"
                        isRound
                        position="absolute"
                        top="-5px"
                        right="-5px"
                        onClick={() => handleRemoveFile(id)}
                        aria-label="Remove file"
                      />
                    </Box>
                  ))}
                </HStack>
              </Box>
            )}
            {/* End Preview Section */}

            {/* Removed single image preview */}
            {/* {selectedFile && ( ... )} */} 
            
            <FormControl isInvalid={!!titleError} isRequired>
              <FormLabel>Title</FormLabel>
              <Input
                placeholder="Enter a title for this evidence"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              {titleError && <FormErrorMessage>{titleError}</FormErrorMessage>}
            </FormControl>
            
            <FormControl>
              <FormLabel>Location</FormLabel>
              <InputGroup>
                <InputLeftElement pointerEvents="none">
                  <MapPin size={16} color="gray.300" />
                </InputLeftElement>
                <Input
                  placeholder="Where was this evidence created? (Optional)"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </InputGroup>
            </FormControl>
            
            <FormControl isInvalid={!!learningAreaError} isRequired>
              <FormLabel>Learning Area</FormLabel>
              {isLoadingAreas ? (
                <Spinner size="sm" />
              ) : (
                <Select
                  options={learningAreasList}
                  value={selectedLearningArea}
                  onChange={setSelectedLearningArea}
                  placeholder="Select a learning area..."
                  isClearable
                  isSearchable
                  className="react-select-container"
                  classNamePrefix="react-select"
                  isDisabled={isOffline && learningAreasList.length === 0}
                />
              )}
              {learningAreaError && <FormErrorMessage>{learningAreaError}</FormErrorMessage>}
              {curriculumError && learningAreasList.length === 0 && (
                <Text color="red.500" fontSize="sm" mt={1}>
                  {curriculumError}
                </Text>
              )}
            </FormControl>
            
            <FormControl isInvalid={!!learningOutcomeError} isRequired>
              <FormLabel>Learning Outcome</FormLabel>
              {isLoadingOutcomes ? (
                <Spinner size="sm" />
              ) : (
                <Select
                  options={learningOutcomesList}
                  value={selectedLearningOutcome}
                  onChange={setSelectedLearningOutcome}
                  placeholder="Select a learning outcome..."
                  isClearable
                  isSearchable
                  isDisabled={!selectedLearningArea || (isOffline && learningOutcomesList.length === 0)}
                  className="react-select-container"
                  classNamePrefix="react-select"
                />
              )}
              {learningOutcomeError && <FormErrorMessage>{learningOutcomeError}</FormErrorMessage>}
            </FormControl>
            
            <FormControl>
              <FormLabel>Description</FormLabel>
              <Textarea
                placeholder="Description (Optional - AI can generate this)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </FormControl>
            
            <Button 
              colorScheme="blue" 
              onClick={handleGenerateDescription}
              isLoading={isGenerating}
              loadingText="Generating..."
              isDisabled={selectedFiles.length === 0 || isGenerating || isOffline}
              w="full"
            >
              ✨ Generate Description with AI
            </Button>
            {generationError && (
              <Text color="red.500" fontSize="sm">
                {generationError}
              </Text>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button 
            colorScheme="teal" 
            onClick={handleSubmit}
            isLoading={isLoading}
            isDisabled={isLoading || selectedFiles.length === 0 || selectedFiles.length > MAX_FILES || isOffline}
          >
            {isLoading ? 'Uploading...' : `Upload ${selectedFiles.length} File(s)`}
          </Button>
          {error && (
            <Text color="red.500" mt={2} textAlign="center" w="full"> {/* Centered error */}
              {error}
            </Text>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default FileUploadModal
