import { useNavigate } from 'react-router-dom'
import { Box, Button, Text } from '@chakra-ui/react'
import { login } from '../../services/api'

const LoginPage = ({ setIsAuthenticated }) => {
  const navigate = useNavigate()

  const handleLogin = async () => {
    try {
      // Replace with actual login credentials
      const credentials = {
        username: 'test@example.com',
        password: 'password'
      }
      
      // Call login API
      await login(credentials)
      
      // Update authentication state
      setIsAuthenticated(true)
      navigate('/students')
    } catch (error) {
      console.error('Login failed:', error)
      // Handle login error (show message to user)
    }
  }
  
  return (
    <Box p={4}>
      <Text fontSize="2xl">Login Page (Placeholder)</Text>
      <Button onClick={handleLogin} colorScheme="teal" mt={4}>
        Login
      </Button>
    </Box>
  )
}

export default LoginPage