// src/pages/content/ContentCreatePage.jsx
import { useState } from 'react'
import { 
  Box, 
  VStack, 
  Button, 
  IconButton, 
  Text, 
  Image, 
  Input, 
  Textarea,
  Container 
} from '@chakra-ui/react'
import { ArrowLeft, Upload } from 'react-feather'
import { useNavigate, useParams } from 'react-router-dom'

const ContentCreatePage = () => {
  const navigate = useNavigate()
  const { studentId } = useParams()
  const [step, setStep] = useState(1)
  const [selectedFile, setSelectedFile] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      setSelectedFile(URL.createObjectURL(file))
      setStep(2)
    }
  }

  const handleSubmit = () => {
    // TODO: Implement actual upload logic
    console.log('Uploading:', { selectedFile, title, description })
    navigate(-1)
  }

  return (
    <Container maxW="container.sm" p={0} className="with-bottom-nav-padding">
      <Box position="fixed" top={0} w="full" zIndex={10} bg="white" p={4} borderBottom="1px" borderColor="gray.200">
        <IconButton
          icon={<ArrowLeft />}
          onClick={() => navigate(-1)}
          variant="ghost"
          aria-label="Back"
        />
        <Text fontSize="xl" fontWeight="bold" ml={2} display="inline-block">
          Create New Content
        </Text>
      </Box>

      <VStack spacing={4} mt="60px" pb="80px" px={4}>
        {step === 1 ? (
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
                Select Photo or Video
              </Button>
            </label>
          </Box>
        ) : (
          <VStack spacing={4} w="full">
            <Box w="full" position="relative" paddingTop="133.33%">
              <Image
                src={selectedFile}
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
              colorScheme="teal" 
              w="full"
              onClick={handleSubmit}
            >
              Upload
            </Button>
          </VStack>
        )}
      </VStack>
    </Container>
  )
}

export default ContentCreatePage