import { Box, VStack, IconButton, Text, Container, Spinner, Center } from '@chakra-ui/react'
import { ArrowLeft } from 'react-feather'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getStudentBySlug } from '../../services/api'
import { NSWCurriculum } from '../../services/curriculum'

const SubjectContentPage = () => {
  const navigate = useNavigate()
  const { studentId, subject } = useParams()
  const location = useLocation()
  const [student, setStudent] = useState(location.state?.student || null)
  const [subjectData, setSubjectData] = useState(location.state?.subject || null)
  const [loading, setLoading] = useState(!location.state?.student)
  const [error, setError] = useState(null)
  const [outcomes, setOutcomes] = useState([])
  const [curriculum, setCurriculum] = useState(null)

  // Initialize curriculum and fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // Load curriculum
        const curriculum = new NSWCurriculum()
        await curriculum.load()
        
        // Fetch student data if needed
        if (!student && studentId) {
          const data = await getStudentBySlug(studentId)
          setStudent(data)
        }
        
        // Get outcomes for the selected subject
        if (student?.grade_level && subjectData) {
          const subjectOutcomes = curriculum.getOutcomes(
            student.grade_level,
            subjectData.code
          )
          setOutcomes(subjectOutcomes)
          setCurriculum(curriculum)
        }
      } catch (err) {
        console.error('Error:', err)
        setError('Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [studentId, student, curriculum, subjectData])

  if (loading) {
    return (
      <Container maxW="container.sm" p={0}>
        <Box position="fixed" top={0} w="full" zIndex={10} bg="white" p={4} borderBottom="1px" borderColor="gray.200">
          <IconButton
            icon={<ArrowLeft />}
            onClick={() => navigate(-1)}
            variant="ghost"
            aria-label="Back"
          />
          <Text fontSize="xl" fontWeight="bold" ml={2} display="inline-block">
            Loading...
          </Text>
        </Box>
        <Center mt="80px">
          <Spinner size="xl" color="blue.500" />
        </Center>
      </Container>
    )
  }

  if (error || !student) {
    return (
      <Container maxW="container.sm" p={0}>
        <Box position="fixed" top={0} w="full" zIndex={10} bg="white" p={4} borderBottom="1px" borderColor="gray.200">
          <IconButton
            icon={<ArrowLeft />}
            onClick={() => navigate(-1)}
            variant="ghost"
            aria-label="Back"
          />
          <Text fontSize="xl" fontWeight="bold" ml={2} display="inline-block">
            Error
          </Text>
        </Box>
        <Center mt="80px">
          <Text color="red.500">{error || 'Student not found'}</Text>
        </Center>
      </Container>
    )
  }

  return (
    <Container maxW="container.sm" p={0}>
      <Box position="fixed" top={0} w="full" zIndex={10} bg="white" p={4} borderBottom="1px" borderColor="gray.200">
        <IconButton
          icon={<ArrowLeft />}
          onClick={() => navigate(-1)}
          variant="ghost"
          aria-label="Back"
        />
        <Text fontSize="xl" fontWeight="bold" ml={2} display="inline-block">
          {student.first_name} {student.last_name}'s {subjectData?.name}
        </Text>
      </Box>

      <VStack spacing={4} mt="80px" p={4}>
        {outcomes.map((outcome) => (
          <Box
            key={outcome.code}
            p={4}
            borderRadius="lg"
            border="1px"
            borderColor="gray.200"
            width="100%"
          >
            <Text fontWeight="bold">{outcome.name}</Text>
            <Text fontSize="sm" color="gray.600">{outcome.description}</Text>
          </Box>
        ))}
      </VStack>
    </Container>
  )
}

export default SubjectContentPage
