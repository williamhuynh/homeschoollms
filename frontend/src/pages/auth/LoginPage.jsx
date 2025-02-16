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
      const response = await login(credentials)
      
      // Debug: Check login response
      console.log('Login Response:', response)
      
      // Debug: Verify token is stored
      const token = localStorage.getItem('token')
      console.log('Stored Token:', token)
      
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