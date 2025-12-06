import { useState, useEffect } from 'react';
import { 
  Box, 
  Heading, 
  VStack, 
  Select, 
  Text, 
  Divider,
  useToast,
  Alert,
  AlertIcon
} from '@chakra-ui/react';
import { getStudentsWithAdminAccess } from '../../services/api';
import ParentAccessList from './ParentAccessList';
import AddParentAccess from './AddParentAccess';

const ManageParentAccess = () => {
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setIsLoading(true);
        // Only fetch students for which the current user has admin access
        const fetchedStudents = await getStudentsWithAdminAccess();
        setStudents(fetchedStudents);
        
        // Select the first student by default if available
        if (fetchedStudents.length > 0) {
          setSelectedStudentId(fetchedStudents[0].id);
        }
      } catch (error) {
        console.error('Error fetching students:', error);
        toast({
          title: 'Error fetching students',
          description: error.message || 'An error occurred while fetching students',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudents();
  }, [toast]);

  const handleStudentChange = (e) => {
    setSelectedStudentId(e.target.value);
  };

  const handleAccessUpdated = () => {
    // Refresh the parent list when access is updated
    // This is handled by the ParentAccessList component's own useEffect
  };

  const getSelectedStudentName = () => {
    const student = students.find(s => s.id === selectedStudentId);
    return student ? `${student.first_name} ${student.last_name}` : '';
  };

  return (
    <Box>
      <Heading size="md" mb={2}>Share Student Access</Heading>
      <Text color="gray.600" mb={4}>
        Invite other parents, guardians, or caregivers to view or contribute to a student's profile. 
        You can control what each person can do by setting their access level.
      </Text>
      
      <Alert status="info" mb={4} borderRadius="md">
        <AlertIcon />
        <Box>
          <Text fontWeight="medium">Access Levels:</Text>
          <Text fontSize="sm">
            <strong>Admin</strong> – Full control, including managing who else has access. 
            <strong> Content</strong> – Can add evidence and notes. 
            <strong> View</strong> – Can only view the student's profile.
          </Text>
        </Box>
      </Alert>

      <VStack spacing={4} align="stretch">
        {students.length === 0 && !isLoading ? (
          <Box p={4} borderWidth="1px" borderRadius="md" bg="yellow.50">
            <Text>
              You don't have admin access to any students. Only students for which you have admin access will appear here.
            </Text>
          </Box>
        ) : (
          <Box>
            <Text mb={2} fontWeight="medium">Select a student:</Text>
            <Select
              value={selectedStudentId}
              onChange={handleStudentChange}
              isDisabled={isLoading || students.length === 0}
            >
              {students.map(student => (
                <option key={student.id} value={student.id}>
                  {student.first_name} {student.last_name}
                </option>
              ))}
            </Select>
          </Box>
        )}

        {selectedStudentId && (
          <>
            <Divider my={2} />
            <AddParentAccess 
              studentId={selectedStudentId} 
              studentName={getSelectedStudentName()}
              onAccessUpdated={handleAccessUpdated}
            />
            
            <Divider my={2} />
            <ParentAccessList 
              studentId={selectedStudentId}
              studentName={getSelectedStudentName()}
              onAccessUpdated={handleAccessUpdated}
            />
          </>
        )}
      </VStack>
    </Box>
  );
};

export default ManageParentAccess;
