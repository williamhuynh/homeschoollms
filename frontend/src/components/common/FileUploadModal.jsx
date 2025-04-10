import { useState, useCallback } from 'react' // Added useCallback
import { generateAIDescription } from '../../services/api'
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
  Image,
  Box,
  Text,
  HStack, // Added HStack for preview
  IconButton, // Added IconButton for removing images
} from '@chakra-ui/react'
import { Upload, X as XIcon } from 'react-feather' // Added XIcon

const MAX_FILES = 10; // Define max files constant

const FileUploadModal = ({ isOpen, onClose, onSubmit, studentId, learningOutcomeId, learningOutcomeDescription }) => {
  const [selectedFiles, setSelectedFiles] = useState([]) // Changed state to handle multiple files
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState(null)

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
  
  const handleGenerateDescription = async () => {
    if (selectedFiles.length === 0) {
      setGenerationError('Please select at least one file first')
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
    formData.append('title', title)
    formData.append('description', description)
      
    const token = localStorage.getItem('token');
    console.log('Token:', token); // Debugging: Log the token to the console
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/learning-outcomes/${studentId}/${learningOutcomeId}/evidence`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      }
    )

    console.log('Response:', response); // Debugging: Log the response to the console
    if (!response.ok) {
      throw new Error('Upload failed')
    }

    const result = await response.json()
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
          <VStack spacing={4}>
            <Box w="full">
              <input
                type="file"
                accept="image/*,video/*"
                multiple // Allow multiple file selection
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button
                  as="span"
                  leftIcon={<Upload />}
                  w="full"
                  h="150px" // Reduced height
                  variant="outline"
                  isDisabled={selectedFiles.length >= MAX_FILES}
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
                      <Image 
                        src={URL.createObjectURL(file)}
                        alt={`Preview ${file.name}`}
                        w="100%"
                        h="100%"
                        objectFit="cover"
                        borderRadius="md"
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
            
            <Input
              placeholder="Title (Optional)" // Made title optional
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Description (Optional - AI can generate this)" // Made description optional
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
            <Button 
              colorScheme="blue" 
              onClick={handleGenerateDescription}
              isLoading={isGenerating}
              loadingText="Generating..."
              isDisabled={selectedFiles.length === 0 || isGenerating} // Check selectedFiles length
              w="full"
            >
              Generate Description with AI
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
            isDisabled={isLoading || selectedFiles.length === 0 || selectedFiles.length > MAX_FILES} // Disable if no files or too many
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
