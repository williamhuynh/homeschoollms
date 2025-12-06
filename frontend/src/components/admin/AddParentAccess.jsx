import { useState } from 'react';
import {
  Box,
  Heading,
  FormControl,
  FormLabel,
  Input,
  Select,
  Button,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  HStack,
  FormErrorMessage
} from '@chakra-ui/react';
import { addParentAccess } from '../../services/api';

const AddParentAccess = ({ studentId, studentName, onAccessUpdated }) => {
  const [email, setEmail] = useState('');
  const [accessLevel, setAccessLevel] = useState('view');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [emailError, setEmailError] = useState('');
  const toast = useToast();

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (emailError) {
      setEmailError('');
    }
  };

  const handleAccessLevelChange = (e) => {
    setAccessLevel(e.target.value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate email
    if (!email.trim()) {
      setEmailError('Email is required');
      return;
    }
    
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    
    // Open confirmation dialog
    setIsConfirmOpen(true);
  };

  const closeConfirmDialog = () => {
    setIsConfirmOpen(false);
  };

  const confirmAddParent = async () => {
    try {
      setIsSubmitting(true);
      await addParentAccess(studentId, email, accessLevel);
      
      toast({
        title: 'Access granted',
        description: `${accessLevel} access granted to ${email} for ${studentName}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      // Reset form
      setEmail('');
      setAccessLevel('view');
      
      // Notify parent
      if (onAccessUpdated) {
        onAccessUpdated();
      }
    } catch (error) {
      console.error('Error granting access:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to grant access. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
      closeConfirmDialog();
    }
  };

  return (
    <Box>
      <Heading size="sm" mb={4}>Invite Someone</Heading>
      <form onSubmit={handleSubmit}>
        <FormControl isInvalid={!!emailError} isRequired mb={4}>
          <FormLabel>Email Address</FormLabel>
          <Input
            type="email"
            value={email}
            onChange={handleEmailChange}
            placeholder="Enter their email address"
            isDisabled={isSubmitting}
          />
          {emailError && <FormErrorMessage>{emailError}</FormErrorMessage>}
        </FormControl>

        <FormControl isRequired mb={4}>
          <FormLabel>Access Level</FormLabel>
          <Select
            value={accessLevel}
            onChange={handleAccessLevelChange}
            isDisabled={isSubmitting}
          >
            <option value="admin">Admin (Full control)</option>
            <option value="content">Content (Can add evidence)</option>
            <option value="view">View Only</option>
          </Select>
        </FormControl>

        <Button
          type="submit"
          colorScheme="teal"
          isLoading={isSubmitting}
          loadingText="Sending..."
        >
          Grant Access
        </Button>
      </form>

      {/* Confirmation Dialog */}
      <AlertDialog
        isOpen={isConfirmOpen}
        leastDestructiveRef={undefined}
        onClose={closeConfirmDialog}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Confirm Access
            </AlertDialogHeader>

            <AlertDialogBody>
              Grant <strong>{accessLevel}</strong> access to <strong>{email}</strong> for <strong>{studentName}</strong>?
            </AlertDialogBody>

            <AlertDialogFooter>
              <HStack spacing={3}>
                <Button onClick={closeConfirmDialog} isDisabled={isSubmitting}>
                  Cancel
                </Button>
                <Button 
                  colorScheme="teal" 
                  onClick={confirmAddParent} 
                  isLoading={isSubmitting}
                  loadingText="Granting..."
                >
                  Grant Access
                </Button>
              </HStack>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default AddParentAccess;
