import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Button, 
  Text, 
  FormControl, 
  FormLabel, 
  Input, 
  VStack, 
  Alert, 
  AlertIcon, 
  Link,
  FormHelperText
} from '@chakra-ui/react';
import { signUp } from '../../services/supabase';

const RegisterPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.firstName || !formData.lastName) {
      setError('All fields are required');
      return false;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    
    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;
    
    setIsLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Call Supabase signUp function with user metadata
      const { user, session } = await signUp(
        formData.email, 
        formData.password,
        {
          first_name: formData.firstName,
          last_name: formData.lastName,
          role: 'parent'
        }
      );
      
      if (user) {
        console.log('Registration successful:', user);
        
        // Check if email confirmation is required
        if (user.identities && user.identities.length === 0) {
          setSuccess('Registration successful! Please check your email to confirm your account.');
        } else if (session) {
          // If session exists, user is automatically signed in
          navigate('/students');
        } else {
          // Otherwise, redirect to login
          setSuccess('Registration successful! You can now log in.');
          setTimeout(() => {
            navigate('/login');
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Registration failed:', error);
      setError(error.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Box p={8} maxWidth="400px" mx="auto" mt={16}>
      <VStack spacing={6} align="stretch">
        <Text fontSize="2xl" fontWeight="bold">Register for Homeschool LMS</Text>
        
        {error && (
          <Alert status="error">
            <AlertIcon />
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert status="success">
            <AlertIcon />
            {success}
          </Alert>
        )}
        
        <FormControl isRequired>
          <FormLabel>Email</FormLabel>
          <Input 
            name="email" 
            type="email" 
            value={formData.email}
            onChange={handleChange}
          />
        </FormControl>
        
        <FormControl isRequired>
          <FormLabel>Password</FormLabel>
          <Input 
            name="password" 
            type="password" 
            value={formData.password}
            onChange={handleChange}
          />
          <FormHelperText>Password must be at least 6 characters</FormHelperText>
        </FormControl>
        
        <FormControl isRequired>
          <FormLabel>Confirm Password</FormLabel>
          <Input 
            name="confirmPassword" 
            type="password" 
            value={formData.confirmPassword}
            onChange={handleChange}
          />
        </FormControl>
        
        <FormControl isRequired>
          <FormLabel>First Name</FormLabel>
          <Input 
            name="firstName" 
            value={formData.firstName}
            onChange={handleChange}
          />
        </FormControl>
        
        <FormControl isRequired>
          <FormLabel>Last Name</FormLabel>
          <Input 
            name="lastName" 
            value={formData.lastName}
            onChange={handleChange}
          />
        </FormControl>
        
        <Button 
          onClick={handleRegister} 
          colorScheme="teal" 
          isLoading={isLoading}
          loadingText="Registering"
        >
          Register
        </Button>
        
        <Text textAlign="center">
          Already have an account?{' '}
          <Link color="teal.500" href="/login">
            Login
          </Link>
        </Text>
      </VStack>
    </Box>
  );
};

export default RegisterPage;
