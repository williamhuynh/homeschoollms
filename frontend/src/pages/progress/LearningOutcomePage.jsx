import { Box, IconButton, Text, Container, Spinner, Center, VStack, useDisclosure, Button, Flex } from '@chakra-ui/react'
import styles from '../../styles/LearningOutcomes.module.css'
import { ArrowLeft, Plus } from 'react-feather'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useState, useEffect, useContext } from 'react'
import { curriculumService } from '../../services/curriculum'
import { useStudents } from '../../contexts/StudentsContext'
import { useFileUploadModal } from '../../contexts/FileUploadModalContext'
import ImageGallery from '../../components/common/ImageGallery'
import { getEvidenceForLearningOutcome } from '../../services/api'

// Feature flag for enabling SignedImage
const USE_SIGNED_IMAGES = process.env.REACT_APP_USE_SIGNED_IMAGES === 'true' || true;

// Image dimensions configuration - 3:4 aspect ratio (portrait)
const THUMBNAIL_WIDTH = 450;
const THUMBNAIL_HEIGHT = 600;

const LearningOutcomePage = () => {
  const { openModal } = useFileUploadModal()
  const navigate = useNavigate()
  const { studentId, learningOutcomeId } = useParams()
  const [learningOutcome, setLearningOutcome] = useState(null)
  const [evidence, setEvidence] = useState([])
  const [loading, setLoading] = useState(true)
  const [evidenceLoading, setEvidenceLoading] = useState(false)
  const [error, setError] = useState(null)
  const { students } = useStudents()
  const location = useLocation()
  const student = students.find(s => s._id === studentId)
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

  const handleImageDeleted = async (imageId) => {
    // Refresh the evidence list after deletion
    try {
      setEvidenceLoading(true)
      const updatedEvidence = await getEvidenceForLearningOutcome(studentId, learningOutcomeId)
      setEvidence(updatedEvidence)
    } catch (err) {
      console.error('Error refreshing evidence after deletion:', err)
    } finally {
      setEvidenceLoading(false)
    }
  }

  const handleEvidenceUploaded = async () => {
    // Refresh the evidence list after upload
    try {
      setEvidenceLoading(true)
      const updatedEvidence = await getEvidenceForLearningOutcome(studentId, learningOutcomeId)
      setEvidence(updatedEvidence)
    } catch (err) {
      console.error('Error refreshing evidence after upload:', err)
    } finally {
      setEvidenceLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    
    const initializeData = async () => {
      try {
        // Get stage from location state or from student grade level
        const stage = location.state?.stage || curriculumService.getStageForGrade(student?.grade_level || 'Year 1')
        const subject = location.state?.subject
        
        if (!stage || !subject) {
          throw new Error('Missing stage or subject information')
        }
        
        // Load curriculum data for this stage
        await curriculumService.load(stage)
        
        // Get outcomes for the subject - now await the async call
        const outcomes = await curriculumService.getOutcomes(stage, subject.code)
        
        const outcome = outcomes.find(o => 
          o.code.toLowerCase() === learningOutcomeId.toLowerCase()
        )
        
        if (!outcome) {
          throw new Error(`Learning outcome ${learningOutcomeId} not found in curriculum for ${subject.name}`)
        }
        
        // Only fetch evidence if we're online
        if (!isOffline) {
          // Fetch evidence for this learning outcome
          setEvidenceLoading(true)
          try {
            const evidenceData = await getEvidenceForLearningOutcome(studentId, learningOutcomeId)
            console.log('Evidence data:', evidenceData)
            
            if (isMounted) {
              // The ImageGallery component handles extracting the image path internally
              setEvidence(evidenceData)
            }
          } catch (err) {
            console.error('Error fetching evidence:', err)
            // Don't show error for evidence loading when offline
          } finally {
            if (isMounted) {
              setEvidenceLoading(false)
            }
          }
        } else {
          setEvidenceLoading(false)
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
          setError(isOffline ? 
            'You appear to be offline. Some data may not be available.' : 
            'Failed to load data'
          )
          setLoading(false)
        }
      }
    }
    
    initializeData()
    
    return () => {
      isMounted = false
    }
  }, [learningOutcomeId, isOffline])

  console.log('Student ID:', studentId)
  console.log('Learning Outcome ID:', learningOutcomeId)

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

  if (error && !learningOutcome) {
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
    <Container maxW="container.sm" p={0} className="with-bottom-nav-padding">
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
        <VStack align="start" spacing={1} ml={2}>
          <Text fontSize="xl" fontWeight="bold">
            {learningOutcome?.name}
          </Text>
          <Text fontSize="sm" color="gray.500">
            {learningOutcome?.code} | {learningOutcome?.grade_level}
          </Text>
        </VStack>
      </Box>

      <Box mt={isOffline ? "110px" : "30%"} p={4}>
        {error && (
          <Box mb={4} p={3} bg="orange.100" borderRadius="md">
            <Text color="orange.800">{error}</Text>
          </Box>
        )}
      
        <Text fontSize="lg" fontWeight="bold" mb={2}>
          Learning Outcome Description:
        </Text>
        <Text fontSize="md" mb={4}>
          {learningOutcome?.description}
        </Text>

        {/* Evidence Gallery */}
        <Box mt={8} p={4}>
          <Flex justify="space-between" align="center" mb={4}>
            <Text fontSize="lg" fontWeight="bold">
              Evidence
            </Text>
            <Button 
              leftIcon={<Plus />} 
              colorScheme="blue" 
              onClick={() => openModal({
                studentId, 
                learningOutcomeId,
                initialLearningAreaCode: location.state?.subject?.code,
                initialLearningOutcomeCode: learningOutcome?.code,
                onSuccess: handleEvidenceUploaded
              })}
              isDisabled={isOffline}
            >
              Add Evidence
            </Button>
          </Flex>
          
          {evidenceLoading ? (
            <Center p={10}>
              <Spinner size="xl" color="blue.500" />
            </Center>
          ) : evidence.length === 0 ? (
            <Center p={10} borderWidth={1} borderRadius="md" borderStyle="dashed">
              <VStack spacing={4}>
                <Text color="gray.500">
                  {isOffline ? "Evidence not available while offline" : "No evidence uploaded yet"}
                </Text>
                {!isOffline && (
                  <Button 
                    leftIcon={<Plus />} 
                    colorScheme="blue" 
                    onClick={() => openModal({
                      studentId, 
                      learningOutcomeId,
                      initialLearningAreaCode: location.state?.subject?.code,
                      initialLearningOutcomeCode: learningOutcome?.code,
                      onSuccess: handleEvidenceUploaded
                    })}
                  >
                    Add Evidence
                  </Button>
                )}
              </VStack>
            </Center>
          ) : (
            <ImageGallery 
              images={evidence} 
              studentId={studentId} 
              learningOutcomeId={learningOutcomeId} 
              onImageDeleted={handleImageDeleted}
              useSignedImages={USE_SIGNED_IMAGES}
              columns={{ base: 3, sm: 3, md: 3 }}
              spacing={4}
              width={THUMBNAIL_WIDTH}
              height={THUMBNAIL_HEIGHT}
            />
          )}
        </Box>
      </Box>
    </Container>
  )
}

export default LearningOutcomePage
