import { useState, useEffect, useRef } from 'react'
import { 
  Container, 
  VStack, 
  Box,
  Button, 
  Center,
  Avatar,
  Spinner,
  useToast,
  HStack,
  Input,
  useBreakpointValue
} from '@chakra-ui/react'
import { ArrowLeft, Upload } from 'react-feather'
import { useNavigate } from 'react-router-dom'
import { getCurrentUser } from '../../services/api'

const AvatarSettingsPage = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const fileInputRef = useRef(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  
  // Responsive avatar size
  const avatarSize = useBreakpointValue({ base: "90vw", md: "400px" })

  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true)
      try {
        const userData = await getCurrentUser()
        setUser(userData)
      } catch (err) {
        console.error("Failed to fetch user data:", err)
        toast({
          title: 'Error',
          description: 'Could not load user data.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
        if (err.response?.status === 401) {
          navigate('/login')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [navigate, toast])

  const handleFileSelect = (e) => {
    if (e.target.files.length > 0) {
      setSelectedFile(e.target.files[0])
      // Display a preview of the selected file
      // This would be expanded in the future
      toast({
        title: 'File selected',
        description: 'Avatar upload functionality will be completed in a future update.',
        status: 'info',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current.click()
  }

  const handleAIAvatarClick = () => {
    toast({
      title: 'Coming Soon',
      description: 'AI avatar generation will be available in a future update.',
      status: 'info',
      duration: 3000,
      isClosable: true,
    })
  }

  return (
    <Container 
      maxW="container.sm" 
      py={8} 
      display="flex" 
      flexDirection="column" 
      minHeight="80vh"
    >
      <Box>
        <Button 
          leftIcon={<ArrowLeft size={20} />}
          variant="ghost" 
          onClick={() => navigate('/profile')}
          alignSelf="flex-start"
        >
          Back to Profile
        </Button>
      </Box>

      {loading ? (
        <Center py={10} flexGrow={1}>
          <Spinner size="xl" />
        </Center>
      ) : (
        <VStack spacing={8} flexGrow={1} justify="center">
          <Center width="100%" pt={8} pb={10}>
            <Box
              width={avatarSize}
              height={avatarSize}
              maxWidth="90%"
              position="relative"
            >
              <Avatar 
                name={user ? `${user.first_name} ${user.last_name}` : ''} 
                src={user?.avatar_url}
                width="100%"
                height="100%"
                fontSize="5xl"
                borderRadius="50%"
              />
            </Box>
          </Center>

          <HStack spacing={4} justify="center" pt={6}>
            <Button
              leftIcon={<Upload size={18} />}
              colorScheme="blue"
              onClick={handleUploadClick}
              isLoading={uploading}
              loadingText="Uploading..."
            >
              Upload New Avatar
            </Button>
            
            <Button
              colorScheme="purple"
              variant="outline"
              isDisabled={true}
              opacity={0.6}
              onClick={handleAIAvatarClick}
            >
              Create AI Avatar
            </Button>
          </HStack>

          {/* Hidden file input */}
          <Input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            display="none"
            onChange={handleFileSelect}
          />
        </VStack>
      )}
    </Container>
  )
}

export default AvatarSettingsPage 