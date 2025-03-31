import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { Box, Button, Text, VStack, Heading, Container, Spinner, Center } from '@chakra-ui/react'
import { ArrowLeft } from 'react-feather'
import { useEffect, useState } from 'react'
import { getStudentBySlug } from '../../services/api'
import { NSWCurriculum } from '../../services/curriculum'

const StudentProgressPage = () => {
  const navigate = useNavigate()
  const { studentId } = useParams()
  const location = useLocation()
  const [student, setStudent] = useState(location.state?.student || null)
  const [loading, setLoading] = useState(!location.state?.student)
  const [error, setError] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [curriculum, setCurriculum] = useState(null)

  // Initialize curriculum
  useEffect(() => {
    const initCurriculum = async () => {
      try {
        const curriculum = new NSWCurriculum("backend/nsw_curriculum.json")
        setCurriculum(curriculum)
      } catch (err) {
        console.error('Error loading curriculum:', err)
        setError('Failed to load curriculum data')
      }
    }
    initCurriculum()
  }, [])

  // Fetch student data and subjects
  useEffect(() => {
    const fetchData = async () => {
      if (!student && studentId) {
        setLoading(true)
        try {
          const data = await getStudentBySlug(studentId)
          setStudent(data)
          setError(null)
          
          // Get subjects for student's grade level
          if (curriculum && data.grade_level) {
            const gradeSubjects = curriculum.get_subjects(data.grade_level)
            setSubjects(gradeSubjects)
          }
        } catch (err) {
          console.error('Error fetching student:', err)
          setError('Failed to load student information')
        } finally {
          setLoading(false)
        }
      }
    }
    
    fetchData()
  }, [studentId, student, curriculum])

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
      </VStack>
    </Container>
  )
}

export default StudentProgressPage
