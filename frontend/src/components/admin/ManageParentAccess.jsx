import { useState, useEffect } from 'react';
import { 
  Box, 
  Heading, 
  VStack, 
  Select, 
  Text, 
  Divider,
  useToast
} from '@chakra-ui/react';
import { getStudents } from '../../services/api';
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
        const fetchedStudents = await getStudents();
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
      <Heading size="md" mb={4}>Parent Access Management</Heading>
      <VStack spacing={4} align="stretch">
        <Box>
          <Text mb={2}>Select a student:</Text>
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
