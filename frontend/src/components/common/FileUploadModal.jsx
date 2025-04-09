import { useState } from 'react'
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
} from '@chakra-ui/react'
import { Upload } from 'react-feather'

const FileUploadModal = ({ isOpen, onClose, onSubmit, studentId, learningOutcomeId, learningOutcomeDescription }) => {
  const [selectedFile, setSelectedFile] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState(null)

const handleFileSelect = (event) => {
  const file = event.target.files[0];
  if (file) {
    setSelectedFile(file);
  }
}

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const handleGenerateDescription = async () => {
    if (!selectedFile) {
      setGenerationError('Please select a file first')
      return
    }
    
    setIsGenerating(true)
    setGenerationError(null)
    
    try {
      const result = await generateAIDescription(selectedFile, learningOutcomeDescription)
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
  if (!selectedFile) {
    setError('Please select a file')
    return
  }

  setIsLoading(true)
  setError(null)

  try {
    const formData = new FormData()
    formData.append('file', selectedFile)
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
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button
                  as="span"
                  leftIcon={<Upload />}
                  w="full"
                  h="200px"
                  variant="outline"
                >
                  {selectedFile ? 'Change File' : 'Select Photo or Video'}
                </Button>
              </label>
            </Box>

            {selectedFile && (
              <Box w="full" position="relative" paddingTop="133.33%">
<Image src={URL.createObjectURL(selectedFile)}
                  alt="Preview"
                  position="absolute"
                  top={0}
                  left={0}
                  w="100%"
                  h="100%"
                  objectFit="cover"
                  borderRadius="lg"
                />
              </Box>
            )}

            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
            <Button 
              colorScheme="blue" 
              onClick={handleGenerateDescription}
              isLoading={isGenerating}
              loadingText="Generating..."
              isDisabled={!selectedFile || isGenerating}
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
            isDisabled={isLoading}
          >
            {isLoading ? 'Uploading...' : 'Upload'}
          </Button>
          {error && (
            <Text color="red.500" mt={2}>
              {error}
            </Text>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default FileUploadModal
