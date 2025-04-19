import { useState, useCallback, useEffect } from 'react' // Added useEffect
import { generateAIDescription, uploadEvidence } from '../../services/api'
import { curriculumService } from '../../services/curriculum'
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
      const loadCurriculum = async () => {
        try {
          setIsLoadingAreas(true)
          setCurriculumError(null)
          
          // Get student stage based on grade
          const stage = curriculumService.getStageForGrade(studentGrade || 'Year 1')
          
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
          console.error('Error loading curriculum:', err)
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
  
  // Load outcomes when learning area changes
  useEffect(() => {
    if (selectedLearningArea) {
      const loadOutcomes = async () => {
        try {
          setIsLoadingOutcomes(true)
          setCurriculumError(null)
          
          // Get student stage based on grade
          const stage = curriculumService.getStageForGrade(studentGrade || 'Year 1')
          
          // Get outcomes for this subject - now awaiting the async method
          const outcomes = await curriculumService.getOutcomes(stage, selectedLearningArea.value)
          
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
          console.error('Error loading outcomes:', err)
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
      // Clear outcomes if no area is selected
      setLearningOutcomesList([])
      setSelectedLearningOutcome(null)
    }
  }, [selectedLearningArea, studentGrade, initialLearningOutcomeCode, isOpen, isOffline])

  const handleFileSelect = useCallback((event) => {
  const files = Array.from(event.target.files);
  const newFiles = files.filter(file => 
    !selectedFiles.some(existingFile => existingFile.name === file.name && existingFile.lastModified === file.lastModified)
  );

  // Add unique identifiers to files for key prop
  const filesWithIds = newFiles.map(file => ({ file, id: crypto.randomUUID() }));

  setSelectedFiles(prevFiles => {
    const combined = [...prevFiles, ...filesWithIds];
    // Enforce max file limit
    if (combined.length > MAX_FILES) {
      setError(`You can only upload a maximum of ${MAX_FILES} files.`);
      return prevFiles; // Keep previous state if limit exceeded
    }
    setError(null); // Clear error if within limit
    console.log('selectedFiles after handleFileSelect:', combined);
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
      // Pass the array of actual File objects
      const fileObjects = selectedFiles.map(f => f.file);
      const result = await generateAIDescription(fileObjects, learningOutcomeDescription)
      if (result && result.description) {
        setDescription(result.description)
      } else {
        setGenerationError('Failed to generate description')
      }
    } catch (err) {
      console.error('Error generating AI description:', err)
      setGenerationError(err.message || 'Failed to generate description')
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
      
      // Use the API service instead of direct fetch
      const result = await uploadEvidence(studentId, learningOutcomeId, formData)
      
      onSubmit(result)
      onClose()
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.')
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
                        objectFit="cover"
                        borderRadius="md"
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
            
            <FormControl>
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
              {curriculumError && learningAreasList.length === 0 && (
                <Text color="red.500" fontSize="sm" mt={1}>
                  {curriculumError}
                </Text>
              )}
            </FormControl>
            
            <FormControl>
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
