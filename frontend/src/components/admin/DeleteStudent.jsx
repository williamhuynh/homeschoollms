import { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Text, 
  useToast, 
  Select, 
  FormControl, 
  FormLabel,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure
} from '@chakra-ui/react';
import { deleteStudent, getStudents } from '../../services/api';

/**
 * A component that allows administrators to delete a student.
 */
const DeleteStudent = () => {
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [result, setResult] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  // Load students when component mounts
  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setIsLoadingStudents(true);
    try {
      const studentsData = await getStudents();
      setStudents(studentsData);
    } catch (error) {
      console.error('Error loading students:', error);
      toast({
        title: 'Error',
        description: 'Failed to load students',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!selectedStudentId) {
      toast({
        title: 'Error',
        description: 'Please select a student to delete',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    setIsLoading(true);
    setResult(null);
    
    try {
      const response = await deleteStudent(selectedStudentId);
      setResult({
        success: true,
        message: response.message || 'Student deleted successfully'
      });
      toast({
        title: 'Success',
        description: response.message || 'Student deleted successfully',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      // Reload students list
      await loadStudents();
      
      // Reset selection
      setSelectedStudentId('');
      
      // Close the confirmation dialog
      onClose();
    } catch (error) {
      console.error('Error deleting student:', error);
      setResult({
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to delete student'
      });
      toast({
        title: 'Error',
        description: error.response?.data?.detail || error.message || 'Failed to delete student',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDelete = () => {
    if (!selectedStudentId) {
      toast({
        title: 'Error',
        description: 'Please select a student to delete',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }
    
    // Open confirmation dialog
    onOpen();
  };

  const selectedStudent = students.find(student => student.id === selectedStudentId);

  return (
    <Box p={4} borderWidth="1px" borderRadius="lg">
      <Text mb={4}>
        This utility allows you to delete a student. This action cannot be undone.
      </Text>
      
      <FormControl mb={4}>
        <FormLabel>Select Student to Delete</FormLabel>
        <Select 
          placeholder="Select student" 
          value={selectedStudentId} 
          onChange={(e) => setSelectedStudentId(e.target.value)}
          isDisabled={isLoadingStudents}
        >
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.first_name} {student.last_name}
            </option>
          ))}
        </Select>
      </FormControl>
      
      <Button
        colorScheme="red"
        isLoading={isLoading}
        loadingText="Deleting..."
        onClick={confirmDelete}
        isDisabled={!selectedStudentId}
      >
        Delete Student
      </Button>
      
      {result && (
        <Box 
          mt={4} 
          p={3} 
          borderRadius="md" 
          bg={result.success ? 'green.100' : 'red.100'}
          color={result.success ? 'green.800' : 'red.800'}
        >
          {result.message}
        </Box>
      )}
      
      {/* Confirmation Dialog */}
      <AlertDialog
        isOpen={isOpen}
        onClose={onClose}
        leastDestructiveRef={undefined}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Student
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete {selectedStudent ? `${selectedStudent.first_name} ${selectedStudent.last_name}` : 'this student'}? 
              This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button onClick={onClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDeleteStudent} ml={3} isLoading={isLoading}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default DeleteStudent;
