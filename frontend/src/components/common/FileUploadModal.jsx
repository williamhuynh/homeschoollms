import { useState } from 'react'
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
  Box
} from '@chakra-ui/react'
import { Upload } from 'react-feather'

const FileUploadModal = ({ isOpen, onClose, onSubmit }) => {
  const [selectedFile, setSelectedFile] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      setSelectedFile(URL.createObjectURL(file))
    }
  }

  const handleSubmit = () => {
    onSubmit({ selectedFile, title, description })
    onClose()
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
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="teal" onClick={handleSubmit}>
            Upload
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default FileUploadModal
