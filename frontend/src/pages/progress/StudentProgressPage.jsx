import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { Box, Button, Text, VStack, Heading, Container, Spinner, Center } from '@chakra-ui/react'
import { ArrowLeft } from 'react-feather'
import { useEffect, useState } from 'react'
import { getStudentBySlug } from '../../services/api'
import { curriculumService } from '../../services/curriculum'

const StudentProgressPage = () => {
  const navigate = useNavigate()
  const { studentId } = useParams()
  const location = useLocation()
  const [student, setStudent] = useState(location.state?.student || null)
  const [loading, setLoading] = useState(!location.state?.student)
  const [curriculumLoading, setCurriculumLoading] = useState(true)
  const [error, setError] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize curriculum and fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // Fetch student data
        const data = await getStudentBySlug(studentId)
        setStudent(data)
        setError(null)
        
        // Get student's grade level
        if (data?.grade_level) {
          // Get stage for this grade level
          const stage = curriculumService.getStageForGrade(data.grade_level)
          console.log('Student grade level:', data.grade_level, 'Stage:', stage)
          
          setCurriculumLoading(true)
          
          // Load curriculum data for this stage
          try {
            // Get subjects for student's grade level
            const gradeSubjects = await curriculumService.getSubjects(data.grade_level)
            console.log('Found subjects:', gradeSubjects)
            setSubjects(gradeSubjects)
          } catch (err) {
            console.error('Error loading curriculum:', err)
            // Still show the student page even if curriculum fails
          } finally {
            setCurriculumLoading(false)
          }
        }
      } catch (err) {
        console.error('Error fetching student:', err)
        setError(isOffline ? 
          'You appear to be offline. Some data may not be available.' : 
          'Failed to load student information'
        )
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [studentId, isOffline])

  const handleBack = () => {
    navigate('/students')
  }

  const handleSubjectClick = (subject) => {
    navigate(`/students/${studentId}/subjects/${subject.code}`, {
      state: { student, subject }
    })
  }

  if (loading) {
    return (
      <Container maxW="container.sm" py={8} pb="64px">
        <Center p={8}>
          <Spinner size="xl" color="blue.500" />
        </Center>
      </Container>
    )
  }

  if (error && !student) {
    return (
      <Container maxW="container.sm" py={8} pb="64px">
        <VStack spacing={4}>
          <Text color="red.500">{error}</Text>
          <Button onClick={handleBack}>Back to Students</Button>
        </VStack>
      </Container>
    )
  }

  return (
    <Container maxW="container.sm" py={8} pb="64px">
      {isOffline && (
        <Box mb={4} p={3} bg="orange.100" borderRadius="md">
          <Text fontWeight="medium">You are currently offline. Some data may not be available.</Text>
        </Box>
      )}
      
      <VStack spacing={6} align="stretch">
        <Button 
          leftIcon={<ArrowLeft size={20} />}
          variant="ghost" 
          onClick={handleBack}
          alignSelf="flex-start"
        >
          Back to Students
        </Button>

        <Heading size="xl">{student?.first_name} {student?.last_name}'s Progress</Heading>
        <Text>Grade: {student?.grade_level}</Text>

        {curriculumLoading ? (
          <Center p={4}>
            <Spinner size="md" color="blue.500" mr={2} />
            <Text>Loading subjects...</Text>
          </Center>
        ) : subjects.length > 0 ? (
          <VStack spacing={4} align="stretch">
            {subjects.map((subject) => (
              <Box 
                key={subject.code} 
                p={4} 
                borderRadius="lg" 
                border="1px" 
                borderColor="gray.200"
                cursor="pointer"
                onClick={() => handleSubjectClick(subject)}
                _hover={{ bg: 'gray.50' }}
              >
                <Text fontWeight="bold">{subject.name}</Text>
                <Text>{subject.description}</Text>
              </Box>
            ))}
          </VStack>
        ) : (
          <Text color="gray.500">No subjects available for {student?.grade_level}.</Text>
        )}
        
        {error && (
          <Box p={3} bg="orange.100" borderRadius="md">
            <Text color="orange.800">{error}</Text>
          </Box>
        )}
      </VStack>
    </Container>
  )
}

export default StudentProgressPage
