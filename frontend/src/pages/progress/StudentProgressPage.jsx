import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { Box, Button, Text, VStack, Heading, Container, Spinner, Center } from '@chakra-ui/react'
import { ArrowLeft } from 'react-feather'
import { useEffect, useState } from 'react'
import { getStudentBySlug } from '../../services/api'

const StudentProgressPage = () => {
  const navigate = useNavigate()
  const { studentId } = useParams()
  const location = useLocation()
  const [student, setStudent] = useState(location.state?.student || null)
  const [loading, setLoading] = useState(!location.state?.student)
  const [error, setError] = useState(null)

  // Mock progress data (you'll replace this with real data later)
  const mockProgress = {
    subjects: [
      { name: 'Math', progress: 75 },
      { name: 'English', progress: 85 },
      { name: 'Science', progress: 60 }
    ]
  }

  // Fetch student data if not provided in location state
  useEffect(() => {
    const fetchStudent = async () => {
      if (!student && studentId) {
        setLoading(true)
        try {
          // Try to fetch by slug (the API will handle if it's an ID or slug)
          const data = await getStudentBySlug(studentId)
          setStudent(data)
          setError(null)
        } catch (err) {
          console.error('Error fetching student:', err)
          setError('Failed to load student information')
        } finally {
          setLoading(false)
        }
      }
    }
    
    fetchStudent()
  }, [studentId, student])

  const handleBack = () => {
    navigate('/students')
  }

  const handleSubjectClick = (subject) => {
    navigate(`/students/${studentId}/subjects/${subject.toLowerCase()}`, {
      state: { student }
    })
  }

  if (loading) {
    return (
      <Container maxW="container.sm" py={8}>
        <Center p={8}>
          <Spinner size="xl" color="blue.500" />
        </Center>
      </Container>
    )
  }

  if (error || !student) {
    return (
      <Container maxW="container.sm" py={8}>
        <VStack spacing={4}>
          <Text color="red.500">{error || 'Student not found'}</Text>
          <Button onClick={handleBack}>Back to Students</Button>
        </VStack>
      </Container>
    )
  }

  return (
    <Container maxW="container.sm" py={8}>
      <VStack spacing={6} align="stretch">
        <Button 
          leftIcon={<ArrowLeft size={20} />}
          variant="ghost" 
          onClick={handleBack}
          alignSelf="flex-start"
        >
          Back to Students
        </Button>

        <Heading size="xl">{student.first_name} {student.last_name}'s Progress</Heading>
        <Text>Grade: {student.grade_level}</Text>

        <VStack spacing={4} align="stretch">
          {mockProgress.subjects.map((subject) => (
            <Box 
              key={subject.name} 
              p={4} 
              borderRadius="lg" 
              border="1px" 
              borderColor="gray.200"
              cursor="pointer"
              onClick={() => handleSubjectClick(subject.name)}
              _hover={{ bg: 'gray.50' }}
            >
              <Text fontWeight="bold">{subject.name}</Text>
              <Text>Progress: {subject.progress}%</Text>
            </Box>
          ))}
        </VStack>
      </VStack>
    </Container>
  )
}

export default StudentProgressPage
