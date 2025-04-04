import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Text, FormControl, FormLabel, Input, VStack, Alert, AlertIcon } from '@chakra-ui/react';
import { login } from '../../services/api';

const LoginPage = ({ setIsAuthenticated }) => {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({
    username: 'test@example.com',
    password: 'password'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
  };

const handleLogin = async () => {
  setIsLoading(true);
  setError('');
  
  try {
    // Call login API
    const response = await login(credentials);
    console.log('Login API Response:', response);
   
    // Store the token in localStorage
    const token = response.data.token;
    localStorage.setItem('authToken', token);
    console.log('Stored Token:', token);
    
    // Update authentication state
    setIsAuthenticated(true);
    navigate('/students');
  } catch (error) {
    console.error('Login failed:', error);
    setError(
      error.response?.data?.detail || 
      'Login failed. Please check your credentials and try again.'
    );
  } finally {
    setIsLoading(false);
  }
};
  
  return (
    <Box p={8} maxWidth="400px" mx="auto" mt={16}>
      <VStack spacing={6} align="stretch">
        <Text fontSize="2xl" fontWeight="bold">Login to Homeschool LMS</Text>
        
        {error && (
          <Alert status="error">
            <AlertIcon />
            {error}
          </Alert>
        )}
        
        <FormControl>
          <FormLabel>Email</FormLabel>
          <Input 
            name="username" 
            type="email" 
            value={credentials.username}
            onChange={handleChange}
          />
        </FormControl>
        
        <FormControl>
          <FormLabel>Password</FormLabel>
          <Input 
            name="password" 
            type="password" 
            value={credentials.password}
            onChange={handleChange}
          />
        </FormControl>
        
        <Button 
          onClick={handleLogin} 
          colorScheme="teal" 
          isLoading={isLoading}
          loadingText="Logging in"
        >
          Login
        </Button>
      </VStack>
    </Box>
  );
};

export default LoginPage;
