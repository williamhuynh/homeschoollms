import { Box, IconButton, Text, Container, Spinner, Center } from '@chakra-ui/react'
import styles from '../../styles/LearningOutcomes.module.css'
import { ArrowLeft } from 'react-feather'
import { useNavigate, useParams } from 'react-router-dom'
import { useState, useEffect, useContext } from 'react'
import { NSWCurriculum } from '../../services/curriculum'
import { StudentsContext } from '../../contexts/StudentsContext'

const LearningOutcomePage = () => {
  const navigate = useNavigate()
  const { studentId, learningOutcomeId } = useParams()
  const [learningOutcome, setLearningOutcome] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { students } = useContext(StudentsContext)
  const student = students.find(s => s._id === studentId)

  useEffect(() => {
    let isMounted = true
    
    const initializeData = async () => {
      try {
        // Initialize curriculum
        const curriculum = new NSWCurriculum()
        await curriculum.load()
        
        // Get outcomes for the subject
        const stage = location.state?.stage || curriculum.getStageForGrade(student?.grade_level || 'Year 1')
        const subject = location.state?.subject
        if (!stage || !subject) {
          throw new Error('Missing stage or subject information')
        }
        
        const outcomes = curriculum.getOutcomes(stage, subject.code)
        const outcome = outcomes.find(o => o.code === learningOutcomeId)
        if (!outcome) {
          throw new Error('Learning outcome not found in curriculum')
        }
        
        if (isMounted) {
          setLearningOutcome({
            code: outcome.code,
            name: outcome.name,
            description: outcome.description,
            grade_level: student?.grade_level
          })
          setError(null)
          setLoading(false)
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error:', err)
          setError('Failed to load curriculum data')
          setLoading(false)
        }
      }
    }
    
    initializeData()
    
    return () => {
      isMounted = false
    }
  }, [learningOutcomeId])

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

  if (error || !learningOutcome) {
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
          <Text color="red.500">{error || 'Learning outcome not found'}</Text>
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
          {learningOutcome.name}
        </Text>
      </Box>

      <Box mt="60px" p={4}>
        <Text fontSize="lg" mb={4}>
          {learningOutcome.description}
        </Text>

        <div className={styles.outcomeGrid}>
          <div className={styles.outcomeCard}>
            <div className={styles.imageContainer}>
              <img 
                className={styles.image}
                src="https://placehold.co/300x400?text=No+Evidence+Yet" 
                alt="Placeholder" 
              />
            </div>
            <div className={styles.contentContainer}>
              <h3 className={styles.title}>No Evidence Recorded</h3>
              <p className={styles.description}>Add evidence to track progress</p>
            </div>
          </div>
        </div>
      </Box>
    </Container>
  )
}

export default LearningOutcomePage
