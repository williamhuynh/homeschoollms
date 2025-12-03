import { useState, useEffect } from 'react'
import { 
  Container, 
  Heading, 
  VStack, 
  Box, 
  Button, 
  Text, 
  Avatar, 
  Center, 
  Spinner, 
  useToast,
  Link as ChakraLink, // Alias Link to avoid conflict with react-router-dom Link
  Badge,
  HStack,
  Divider,
} from '@chakra-ui/react'
import { ArrowLeft, LogOut, Settings, CreditCard, Star } from 'react-feather'
import { useNavigate, Link as RouterLink } from 'react-router-dom' // Use RouterLink for internal navigation
import { getCurrentUser, logout } from '../../services/api' // Assuming logout function exists in api.js
import UserAvatar from '../../components/common/UserAvatar'
import { useUser } from '../../contexts/UserContext'

const ProfilePage = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Get subscription info from context
  const { getEffectiveTier, isGrandfathered, usage } = useUser()

  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true)
      setError(null)
      try {
        const userData = await getCurrentUser() // Fetch user data from /api/users/me
        setUser(userData)
      } catch (err) {
        console.error("Failed to fetch user data:", err)
        setError("Failed to load profile information.")
        toast({
          title: 'Error',
          description: err.message || 'Could not load user data.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
        // Optionally redirect to login if unauthorized
        if (err.response?.status === 401) {
          navigate('/login')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [navigate, toast])

  const handleLogout = () => {
    logout() // Call the logout function from api.js (clears token)
    // Optionally clear other contexts if needed, e.g., students context
    // const { clearStudents } = useStudents(); 
    // clearStudents();
    toast({
      title: 'Logged Out',
      description: 'You have been successfully logged out.',
      status: 'success',
      duration: 3000,
      isClosable: true,
    })
    navigate('/login') // Redirect to login page
  }

  // Function to map access level to role name
  const getRoleName = (accessLevel) => {
    // This mapping might need adjustment based on your actual access levels
    switch (accessLevel) {
      case 0: return 'Student' // Example
      case 1: return 'Parent'
      case 2: return 'Teacher' // Example
      case 10: return 'Admin'
      default: return 'User'
    }
  }

  if (loading) {
    return (
      <Center h="100vh">
        <Spinner size="xl" />
      </Center>
    )
  }

  if (error) {
    return (
      <Container centerContent py={10}>
        <Text color="red.500">{error}</Text>
        <Button mt={4} onClick={() => navigate('/login')}>Go to Login</Button>
      </Container>
    )
  }

  return (
    <Container maxW="container.sm" py={8}>
      <VStack spacing={6} align="stretch">
        {/* Optional Back Button */}
        <Button 
          leftIcon={<ArrowLeft size={20} />}
          variant="ghost" 
          onClick={() => navigate('/students')} // Navigate back to student selection
          alignSelf="flex-start"
          mb={4} // Add some margin below
        >
          Back to Students
        </Button>

        <Center>
          <VStack spacing={4}>
            <UserAvatar 
              user={user}
              size="xl"
              isClickable={true}
            />
            <Heading size="lg">{user ? `${user.first_name} ${user.last_name}` : 'Loading...'}</Heading>
          </VStack>
        </Center>

        {/* Subscription Status Card */}
        <Box 
          bg="gray.50" 
          borderRadius="lg" 
          p={4} 
          border="1px" 
          borderColor="gray.200"
          mt={6}
        >
          <HStack justify="space-between" mb={2}>
            <HStack>
              <Star size={18} />
              <Text fontWeight="medium">Subscription</Text>
            </HStack>
            <Badge colorScheme={getEffectiveTier() === 'basic' ? 'purple' : 'gray'}>
              {getEffectiveTier() === 'basic' ? 'Basic' : 'Free'}
              {isGrandfathered() && ' (Grandfathered)'}
            </Badge>
          </HStack>
          
          {usage && (
            <VStack align="stretch" spacing={1} fontSize="sm" color="gray.600">
              <HStack justify="space-between">
                <Text>Students:</Text>
                <Text>{usage.student_count} / {usage.max_students}</Text>
              </HStack>
              <HStack justify="space-between">
                <Text>Evidence:</Text>
                <Text>{usage.evidence_count} / {usage.max_evidence}</Text>
              </HStack>
            </VStack>
          )}
          
          <Button
            as={RouterLink}
            to="/subscription"
            leftIcon={<CreditCard size={18} />}
            variant="outline"
            colorScheme="purple"
            size="sm"
            mt={3}
            w="full"
          >
            {getEffectiveTier() === 'basic' ? 'Manage Subscription' : 'Upgrade Plan'}
          </Button>
        </Box>

        <Divider my={2} />

        {/* Settings Link - Changed from Admin Tools */}
        <Button
          as={RouterLink}
          to="/admin"
          leftIcon={<Settings size={20} />}
          variant="outline"
          colorScheme="gray"
        >
          Settings
        </Button>

        {/* Logout Button */}
        <Button
          leftIcon={<LogOut size={20} />}
          colorScheme="red"
          onClick={handleLogout}
          mt={2}
        >
          Logout
        </Button>
      </VStack>
    </Container>
  )
}

export default ProfilePage
