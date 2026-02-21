import { Container, Heading, VStack, IconButton, Flex, useToast, Text, Center, Spinner, Button } from '@chakra-ui/react'
import { Plus } from 'react-feather'
import { useNavigate } from 'react-router-dom'
import StudentList from '../../components/students/StudentList'
import BottomNav from '../../components/navigation/BottomNav'
import { useEffect, useState, useCallback } from 'react'
import { useStudents } from '../../contexts/StudentsContext'
import { useUser } from '../../contexts/UserContext'
import { getStudents } from '../../services/api'
import RefreshButton from '../../components/common/RefreshButton'
import { logger } from '../../utils/logger'

const StudentSelection = () => {
  const { students, setStudents } = useStudents()
  const { isAdmin } = useUser() // Get isAdmin function from UserContext
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const handleAddStudent = () => {
    navigate('/students/new')
  }

  const handleStudentSelect = (student) => {
    logger.breadcrumb('navigation', 'Student selected');
    
    // Prefer slug if available, fall back to ID
    if (student.slug) {
      navigate(`/students/${student.slug}`)
    } else {
      // Fall back to ID if slug is not available
      const studentId = student.id || student._id
      if (studentId) {
        navigate(`/students/${studentId}`)
      } else {
        logger.error('Student has no ID or slug');
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

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    try {
      logger.debug('StudentSelection: Fetching students');
      const data = await getStudents()
      logger.debug('StudentSelection: Fetched students', { count: data?.length });
      
      if (!data || data.length === 0) {
        setStudents([])
        setError('No students found. Try adding a student or check your connection.')
      } else {
        setStudents(data)
        setError(null)
      }
    } catch (error) {
      logger.error('StudentSelection: Failed to fetch students', error)
      const errorMessage = error.response?.data?.detail || error?.message || 'Unknown error'
      setError('Failed to load students. Please try again later.')
      toast({
        title: 'Error loading students',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setLoading(false)
    }
  }, [setStudents, toast])

  useEffect(() => {
    fetchStudents()
  }, [fetchStudents]) // Run on mount and when callback identity changes

  // Check for subscription success redirect from Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('subscription') === 'success') {
      toast({
        title: 'Subscription Activated!',
        description: 'Welcome to the Basic plan! Your account has been upgraded.',
        status: 'success',
        duration: 8000,
        isClosable: true,
      })
      // Clean URL
      window.history.replaceState({}, '', '/students')
    }
  }, [toast])

  return (
    // Add paddingBottom to account for fixed BottomNav height (adjust value as needed)
    <Container maxW="container.sm" py={8} pb="80px"> 
      <VStack spacing={8} align="stretch">
        <Flex justify="space-between" align="center" px={4}>
          <Heading size="xl">Your Students</Heading>
          <Flex gap={2}>
            <RefreshButton onClick={fetchStudents} isLoading={loading} label="Refresh list" />
            <IconButton
              icon={<Plus />}
              variant="solid"
              colorScheme="blue"
              aria-label="Add student"
              onClick={handleAddStudent}
            />
            {isAdmin() && (
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
            )}
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
                logger.breadcrumb('user-action', 'Manual refresh triggered');
                fetchStudents();
              }}
            >
              Retry Loading Students
            </Button>
          </VStack>
        ) : (
          <StudentList 
            students={students} 
            onStudentSelect={handleStudentSelect}
          />
        )}
      </VStack>
      <BottomNav /> {/* Add BottomNav component */}
    </Container>
  )
}

export default StudentSelection
