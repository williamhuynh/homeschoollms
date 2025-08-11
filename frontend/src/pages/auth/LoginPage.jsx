import { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Box, Button, Text, FormControl, FormLabel, Input, VStack, Alert, AlertIcon, Link as ChakraLink } from '@chakra-ui/react';
import { signIn } from '../../services/supabase';

const LoginPage = ({ setIsAuthenticated }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState('');

  useEffect(() => {
    // Check for session_expired reason in URL
    const reason = searchParams.get('reason');
    if (reason === 'session_expired') {
      setNotification('Your session has expired. Please log in again.');
    }
  }, [searchParams]);

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
  setNotification('');
  
  try {
    // Call Supabase signIn function
    const { session } = await signIn(credentials.email, credentials.password);
    
    if (session) {
      console.log('Login successful, session:', session);
      
      // Update authentication state
      setIsAuthenticated(true);
      navigate('/students');
    } else {
      throw new Error('No session returned after login');
    }
  } catch (error) {
    console.error('Login failed:', error);
    setError(
      error.message || 
      'Login failed. Please check your credentials and try again.'
    );
  } finally {
    setIsLoading(false);
  }
};
  
  return (
    <Box p={8} maxWidth="400px" mx="auto" mt={16}>
      <VStack spacing={6} align="stretch">
        <Text fontSize="2xl" fontWeight="bold">Login to Astra Learning</Text>
        
        {notification && (
          <Alert status="info">
            <AlertIcon />
            {notification}
          </Alert>
        )}
        
        {error && (
          <Alert status="error">
            <AlertIcon />
            {error}
          </Alert>
        )}
        
        <FormControl>
          <FormLabel>Email</FormLabel>
          <Input 
            name="email" 
            type="email" 
            value={credentials.email}
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
        
        <Text textAlign="center">
          Don't have an account?{' '}
          <ChakraLink as={RouterLink} to="/register" color="teal.500">
            Register
          </ChakraLink>
        </Text>
      </VStack>
    </Box>
  );
};

export default LoginPage;
