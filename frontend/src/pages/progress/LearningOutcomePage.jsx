import { Box, IconButton, Text, Container, Spinner, Center } from '@chakra-ui/react'
import styles from '../../styles/LearningOutcomes.module.css'
import { ArrowLeft } from 'react-feather'
import { useNavigate, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { getLearningOutcome } from '../../services/api'
import { curriculumService } from '../../services/curriculum'

const LearningOutcomePage = () => {
  const navigate = useNavigate()
  const { studentId, learningOutcomeId } = useParams()
  const [learningOutcome, setLearningOutcome] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
  }, [learningOutcomeId])

  useEffect(() => {
    let isMounted = true
    
    const initializeData = async () => {
      try {
        // Load curriculum data once
        await curriculumService.load()
        
        // Fetch learning outcome data
        const data = await getLearningOutcome(studentId, learningOutcomeId)
        if (isMounted) {
          setLearningOutcome(data)
          setError(null)
          setLoading(false)
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error:', err)
          setError('Failed to load data. Please try again.')
          // Keep loading true to show spinner
        }
      }
    }
    
    initializeData()
    
    return () => {
      isMounted = false
    }
  }, [studentId, learningOutcomeId])

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
          {learningOutcome.evidence.map((evidence) => (
            <div 
              key={evidence.id} 
              className={styles.outcomeCard}
              onClick={() => console.log('Open evidence:', evidence.id)}
            >
              <div className={styles.imageContainer}>
                <img 
                  className={styles.image}
                  src={evidence.thumbnail || 'https://placehold.co/300x400'} 
                  alt={evidence.description} 
                />
              </div>
              <div className={styles.contentContainer}>
                <h3 className={styles.title}>{new Date(evidence.date).toLocaleDateString()}</h3>
                <p className={styles.description}>{evidence.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Box>
    </Container>
  )
}

export default LearningOutcomePage
