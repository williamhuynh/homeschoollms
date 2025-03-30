import { Container, Heading, VStack, IconButton, Flex, useToast, Text, Center, Spinner, Link, Box, Button } from '@chakra-ui/react'
import { Plus, Settings } from 'react-feather'
import { useNavigate } from 'react-router-dom'
import StudentList from '../../components/students/StudentList'
import { useEffect, useState } from 'react'
import { useStudents } from '../../contexts/StudentsContext'
import { getStudents } from '../../services/api'

const StudentSelection = () => {
  const { students, setStudents } = useStudents()
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const handleAddStudent = () => {
    navigate('/students/new')
  }

  const handleStudentSelect = (student) => {
    console.log('Selected student:', student)
    
    // Prefer slug if available, fall back to ID
    if (student.slug) {
      navigate(`/students/${student.slug}`)
    } else {
      // Fall back to ID if slug is not available
      const studentId = student.id || student._id
      if (studentId) {
        navigate(`/students/${studentId}`)
      } else {
        console.error('Student has no ID or slug:', student)
        toast({
          title: 'Error',
          description: 'Could not navigate to student details - missing identifier',
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
      }
    }
  }

  const fetchStudents = async () => {
    setLoading(true)
    try {
      console.log('StudentSelection: Fetching students...')
      const data = await getStudents()
      console.log('StudentSelection: Fetched students:', data)
      
      if (!data || data.length === 0) {
        console.log('StudentSelection: No students returned or empty array')
        setStudents([])
        setError('No students found. Try adding a student or check your connection.')
      } else {
        setStudents(data)
        setError(null)
      }
    } catch (error) {
      console.error('StudentSelection: Failed to fetch students:', error)
      setError('Failed to load students. Please try again later.')
      toast({
        title: 'Error loading students',
        description: error?.message || 'Unknown error',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStudents()
  }, []) // Empty dependency array to run only once on mount

  return (
    <Container maxW="container.sm" py={8}>
      <VStack spacing={8} align="stretch">
        <Flex justify="space-between" align="center" px={4}>
          <Heading size="xl">Your Students</Heading>
          <Flex gap={2}>
            <IconButton
              icon={<Settings size={20} />}
              variant="ghost"
              aria-label="Admin settings"
              onClick={() => navigate('/admin')}
            />
            <IconButton
              icon={<Plus />}
              variant="solid"
              colorScheme="blue"
              aria-label="Add student"
              onClick={handleAddStudent}
            />
            <IconButton
              icon={<span>🐞</span>}
              variant="outline"
              colorScheme="red"
              aria-label="Debug info"
              onClick={() => {
                const token = localStorage.getItem('token');
                toast({
                  title: 'Debug Info',
                  description: (
                    <VStack align="start">
                      <Text>Token exists: {token ? 'Yes' : 'No'}</Text>
                      <Text>Token length: {token ? token.length : 0}</Text>
                      <Text>API URL: {window.location.hostname === 'localhost' ? 
                        'http://localhost:8000' : 'https://homeschoollms-server.onrender.com'}</Text>
                    </VStack>
                  ),
                  status: 'info',
                  duration: 10000,
                  isClosable: true,
                });
              }}
            />
          </Flex>
        </Flex>

        {loading ? (
          <Center p={8}>
            <Spinner size="xl" color="blue.500" />
          </Center>
        ) : error ? (
          <VStack p={8} spacing={4}>
            <Text color="red.500">{error}</Text>
            <Button 
              colorScheme="blue" 
              onClick={() => navigate('/login')}
            >
              Go to Login Page
            </Button>
            <Button 
              colorScheme="green" 
              onClick={() => {
                console.log('Manual refresh triggered');
                fetchStudents();
              }}
            >
              Retry Loading Students
            </Button>
            <Button 
              colorScheme="purple" 
              onClick={async () => {
                try {
                  console.log('Attempting auto-login with test credentials');
                  // Import login function
                  const { login } = await import('../../services/api');
                  
                  // Use test credentials
                  const response = await login({
                    username: 'test@example.com',
                    password: 'password'
                  });
                  
                  console.log('Auto-login response:', response);
                  
                  // Refresh students after login
                  fetchStudents();
                } catch (error) {
                  console.error('Auto-login failed:', error);
                  toast({
                    title: 'Auto-login failed',
                    description: error.message,
                    status: 'error',
                    duration: 5000,
                    isClosable: true,
                  });
                }
              }}
            >
              Auto-Login with Test Credentials
            </Button>
          </VStack>
        ) : (
          <StudentList 
            students={students} 
            onStudentSelect={handleStudentSelect}
          />
        )}
      </VStack>
    </Container>
  )
}

export default StudentSelection
