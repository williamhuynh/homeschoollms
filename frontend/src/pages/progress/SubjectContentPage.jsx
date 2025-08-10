import { Box, VStack, IconButton, Text, Container, Spinner, Center, Button } from '@chakra-ui/react'
import { ArrowLeft } from 'react-feather'
import styles from '../../styles/LearningOutcomes.module.css'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getStudentBySlug, getLatestEvidenceForOutcomes } from '../../services/api'
import { curriculumService } from '../../services/curriculum'
import LazyImage from '../../components/common/LazyImage'
import SignedImage from '../../components/common/SignedImage'
import placeholderImage from '../../assets/images/placeholder-photo.jpg'
 
 
// Feature flag for enabling SignedImage
const USE_SIGNED_IMAGES = process.env.REACT_APP_USE_SIGNED_IMAGES === 'true' || true;

// Image dimensions configuration
const IMAGE_WIDTH = 650;
const IMAGE_HEIGHT = 867; // 3:4 aspect ratio

const SubjectContentPage = () => {
  const navigate = useNavigate()
  const { studentId, subject } = useParams()
  const location = useLocation()
  
  const [student, setStudent] = useState(location.state?.student || null)
  const [subjectData, setSubjectData] = useState(location.state?.subject || null)
  const [loading, setLoading] = useState(!location.state?.student)
  const [error, setError] = useState(null)
  const [outcomes, setOutcomes] = useState([])
  const [evidenceMap, setEvidenceMap] = useState({})
  const [evidenceLoading, setEvidenceLoading] = useState(false)
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
        // Fetch student data if needed
        if (!student && studentId) {
          const data = await getStudentBySlug(studentId)
          setStudent(data)
        }
        
        // Get outcomes for the selected subject
        if (student?.grade_level && subjectData) {
          const stage = curriculumService.getStageForGrade(student.grade_level)
          
          // Load curriculum data for this stage
          await curriculumService.load(stage)
          
          // Get outcomes for this subject
          const subjectOutcomes = await curriculumService.getOutcomes(
            stage,
            subjectData.code
          )
          
          setOutcomes(subjectOutcomes)
        }
      } catch (err) {
        console.error('Error:', err)
        setError(isOffline ? 
          'You appear to be offline. Some data may not be available.' : 
          'Failed to load data'
        )
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [studentId, student, subjectData, isOffline])
  
  // Fetch latest evidence for all outcomes
  // This uses a batch API endpoint for better performance when multiple outcomes exist
  useEffect(() => {
    const fetchEvidence = async () => {
      if (outcomes.length > 0 && student?._id) {
        setEvidenceLoading(true)
        try {
          // Get all outcome codes
          const outcomeCodes = outcomes.map(outcome => outcome.code)
          
          // Fetch latest evidence for each outcome (uses batch API when possible)
          const evidence = await getLatestEvidenceForOutcomes(student._id, outcomeCodes)
          setEvidenceMap(evidence)
        } catch (err) {
          console.error('Error fetching evidence:', err)
          // Don't show an error message for evidence loading failures when offline
          // The UI will show placeholders instead
        } finally {
          setEvidenceLoading(false)
        }
      }
    }
    
    // Only fetch evidence if we're online
    if (!isOffline) {
      fetchEvidence()
    } else {
      setEvidenceLoading(false)
    }
  }, [outcomes, student, isOffline])

  // If navigated directly via URL without navigation state, derive subject from curriculum using URL param
  useEffect(() => {
    const deriveSubjectFromUrl = async () => {
      try {
        if (!student?.grade_level || subjectData || !subject) return
        const stage = curriculumService.getStageForGrade(student.grade_level)
        // Ensure curriculum for the stage is loaded
        await curriculumService.load(stage)
        const subjects = await curriculumService.getSubjects(student.grade_level)
        const foundSubject = subjects.find((s) => s.code === subject)
        if (foundSubject) {
          setSubjectData(foundSubject)
        }
      } catch (err) {
        console.error('Failed to derive subject from URL:', err)
      }
    }

    deriveSubjectFromUrl()
  }, [student, subject, subjectData])

  const handleNavigateToOutcome = (outcome) => {
    navigate(`/students/${studentId}/learning-outcomes/${outcome.code.toLowerCase()}`, {
      state: { learningOutcome: outcome, stage: curriculumService.getStageForGrade(student.grade_level), subject: subjectData }
    })
  }

  

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

  if (error && !student) {
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
          <Text color="red.500">{error}</Text>
        </Center>
      </Container>
    )
  }

  return (
    <Container maxW="container.sm" p={0} pb="64px">
      {isOffline && (
        <Box position="fixed" top={0} w="full" zIndex={10} bg="orange.100" p={2} textAlign="center">
          <Text fontSize="sm" fontWeight="medium">You are offline. Some content may not be available.</Text>
        </Box>
      )}
      
      <Box position="fixed" top={isOffline ? "30px" : 0} w="full" zIndex={10} bg="white" p={4} borderBottom="1px" borderColor="gray.200">
        <IconButton
          icon={<ArrowLeft />}
          onClick={() => navigate(-1)}
          variant="ghost"
          aria-label="Back"
        />
        <Text fontSize="xl" fontWeight="bold" ml={2} display="inline-block">
          {student?.first_name} {student?.last_name}'s {subjectData?.name || subject}
        </Text>
      </Box>

      <Box mt={isOffline ? "110px" : "80px"}>
        {evidenceLoading && (
          <Center py={4}>
            <Spinner size="md" color="blue.500" mr={2} />
            <Text>Loading evidence...</Text>
          </Center>
        )}
        
        {error && (
          <Box mx={4} mb={4} p={3} bg="orange.100" borderRadius="md">
            <Text color="orange.800">{error}</Text>
          </Box>
        )}
        
        <div className={styles.outcomeGrid}>
          {outcomes.length > 0 ? (
            outcomes.map((outcome) => (
              <div 
                key={outcome.code} 
                className={styles.outcomeCard}
                onClick={() => handleNavigateToOutcome(outcome)}
              >
                <div className={styles.imageContainer}>
                  {evidenceLoading ? (
                    <Center h="100%">
                      <Spinner size="md" color="blue.500" />
                    </Center>
                  ) : evidenceMap[outcome.code] ? (
                    USE_SIGNED_IMAGES ? (
                      <SignedImage
                        src={evidenceMap[outcome.code].fileUrl}
                        alt={`Evidence for ${outcome.name}`}
                        width={IMAGE_WIDTH}
                        height={IMAGE_HEIGHT}
                        imgProps={{
                          style: {
                            objectFit: 'cover',
                            objectPosition: 'center',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            borderRadius: '0.375rem'
                          }
                        }}
                      />
                    ) : (
                      <LazyImage
                        image={{
                          original_url: evidenceMap[outcome.code].fileUrl,
                          thumbnail_small_url: evidenceMap[outcome.code].thumbnail_large_url || evidenceMap[outcome.code].fileUrl,
                          thumbnail_medium_url: evidenceMap[outcome.code].thumbnail_large_url || evidenceMap[outcome.code].fileUrl,
                          thumbnail_large_url: evidenceMap[outcome.code].thumbnail_large_url || evidenceMap[outcome.code].fileUrl
                        }}
                        alt={`Evidence for ${outcome.name}`}
                        width={IMAGE_WIDTH}
                        height={IMAGE_HEIGHT}
                        style={{
                          objectFit: 'cover',
                          objectPosition: 'center',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          borderRadius: '0.375rem'
                        }}
                        rootMargin="200px"
                      />
                    )
                  ) : (
                    <img
                      src={placeholderImage}
                      alt="No Evidence Uploaded"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center',
                        borderRadius: '0.375rem',
                        position: 'absolute',
                        top: 0,
                        left: 0
                      }}
                    />
                  )}
                </div>
                <div className={styles.contentContainer}>
                  <h3 className={styles.title}>{outcome.name}</h3>
                  <p className={styles.description}>{outcome.description}</p>
                </div>
              </div>
            ))
          ) : (
            <Center p={4}>
              <Text color="gray.500">No learning outcomes available for this subject.</Text>
            </Center>
          )}
        </div>
      </Box>
    </Container>
  )
}

export default SubjectContentPage
