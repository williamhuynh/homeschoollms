import { Box, VStack, IconButton, Text, Container, Spinner, Center } from '@chakra-ui/react'
import { ArrowLeft } from 'react-feather'
import styles from '../../styles/LearningOutcomes.module.css'
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
          const stage = curriculum.getStageForGrade(student.grade_level)
          const subjectOutcomes = curriculum.getOutcomes(
            stage,
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

      <Box mt="80px">
        <div className={styles.outcomeGrid}>
          {outcomes.map((outcome) => (
              <div 
                key={outcome.code} 
                className={styles.outcomeCard}
                onClick={() => navigate(`/students/${student._id}/learning-outcomes/${outcome.code}`, {
                  state: {
                    stage: curriculum.getStageForGrade(student.grade_level),
                    subject: subjectData
                  }
                })}
              >
                <div className={styles.imageContainer}>
                  <img 
                    className={styles.image}
                    src={outcome.thumbnail || 'https://placehold.co/300x300/e2e8f0/1a202c?text=Learning+Outcome'} 
                    alt={outcome.name} 
                  />
                </div>
                <div className={styles.contentContainer}>
                  <h3 className={styles.title}>{outcome.name}</h3>
                  <p className={styles.description}>{outcome.description}</p>
                </div>
              </div>
          ))}
        </div>
      </Box>
    </Container>
  )
}

export default SubjectContentPage
