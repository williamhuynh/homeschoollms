import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
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
  Link as ChakraLink
} from '@chakra-ui/react';
import { resetPassword } from '../../services/supabase';
import { logger } from '../../utils/logger';

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setEmail(e.target.value);
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Email is required');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setSuccess('');
    
    try {
      await resetPassword(email);
      setSuccess('Password reset instructions have been sent to your email.');
    } catch (error) {
      logger.error('Password reset failed', error);
      setError(error.message || 'Password reset failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Box p={8} maxWidth="400px" mx="auto" mt={16}>
      <VStack spacing={6} align="stretch">
        <Text fontSize="2xl" fontWeight="bold">Reset Password</Text>
        
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
        
        <Text>
          Enter your email address and we'll send you instructions to reset your password.
        </Text>
        
        <FormControl isRequired>
          <FormLabel>Email</FormLabel>
          <Input 
            name="email" 
            type="email" 
            value={email}
            onChange={handleChange}
          />
        </FormControl>
        
        <Button 
          onClick={handleResetPassword} 
          colorScheme="teal" 
          isLoading={isLoading}
          loadingText="Sending"
        >
          Send Reset Instructions
        </Button>
        
        <Text textAlign="center">
          Remember your password?{' '}
          <ChakraLink as={RouterLink} to="/login" color="teal.500">
            Back to Login
          </ChakraLink>
        </Text>
      </VStack>
    </Box>
  );
};

export default ResetPasswordPage;
