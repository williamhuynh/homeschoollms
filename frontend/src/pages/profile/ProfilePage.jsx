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
  Link as ChakraLink // Alias Link to avoid conflict with react-router-dom Link
} from '@chakra-ui/react'
import { ArrowLeft, LogOut, Settings } from 'react-feather'
import { useNavigate, Link as RouterLink } from 'react-router-dom' // Use RouterLink for internal navigation
import { getCurrentUser, logout } from '../../services/api' // Assuming logout function exists in api.js

const ProfilePage = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

        <Heading size="xl" textAlign="center" mb={4}>Profile</Heading>

        <Center>
          <VStack spacing={4}>
            <Avatar 
              size="xl" 
              name={user ? `${user.first_name} ${user.last_name}` : ''} 
              // src={user?.avatar_url} // Uncomment if you have avatar URLs
            />
            <Heading size="lg">{user ? `${user.first_name} ${user.last_name}` : 'Loading...'}</Heading>
            <Text fontSize="md" color="gray.600">
              Role: {user ? getRoleName(user.access_level) : 'Loading...'}
            </Text>
          </VStack>
        </Center>

        {/* Conditional Admin Tools Link */}
        {user && user.access_level === 10 && ( // Assuming 10 is the admin level
          <Button 
            as={RouterLink} // Use RouterLink for internal navigation
            to="/admin" 
            leftIcon={<Settings size={20} />} 
            variant="outline"
            colorScheme="gray"
            mt={6} // Add margin top
          >
            Admin Tools
          </Button>
        )}

        {/* Logout Button */}
        <Button 
          leftIcon={<LogOut size={20} />} 
          colorScheme="red" 
          onClick={handleLogout}
          mt={user?.access_level === 10 ? 2 : 6} // Adjust margin based on admin button presence
        >
          Logout
        </Button>
      </VStack>
    </Container>
  )
}

export default ProfilePage
