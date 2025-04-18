import { Box, IconButton, Text, Container, Spinner, Center, VStack, useDisclosure, Button, Flex } from '@chakra-ui/react'
import styles from '../../styles/LearningOutcomes.module.css'
import { ArrowLeft, Plus } from 'react-feather'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useState, useEffect, useContext } from 'react'
import { NSWCurriculum } from '../../services/curriculum'
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
        const outcome = outcomes.find(o => 
          o.code.toLowerCase() === learningOutcomeId.toLowerCase()
        )
        if (!outcome) {
          throw new Error(`Learning outcome ${learningOutcomeId} not found in curriculum for ${subject.name}`)
        }
        
        // Fetch evidence for this learning outcome
        setEvidenceLoading(true)
        try {
          const evidenceData = await getEvidenceForLearningOutcome(studentId, learningOutcomeId)
          console.log('Evidence data:', evidenceData)
          
          if (isMounted) {
            setLearningOutcome({
              code: outcome.code,
              name: outcome.name,
              description: outcome.description,
              grade_level: student?.grade_level
            })
            
            // The ImageGallery component handles extracting the image path internally
            setEvidence(evidenceData)
            
            setError(null)
          }
        } catch (err) {
          console.error('Error fetching evidence:', err)
          if (isMounted) {
            setError('Failed to load evidence')
          }
        } finally {
          if (isMounted) {
            setEvidenceLoading(false)
            setLoading(false)
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error:', err)
          setError('Failed to load data')
          setLoading(false)
        }
      }
    }
    
    initializeData()
    
    return () => {
      isMounted = false
    }
  }, [learningOutcomeId])

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
        <VStack align="start" spacing={1} ml={2}>
          <Text fontSize="xl" fontWeight="bold">
            {learningOutcome.name}
          </Text>
          <Text fontSize="sm" color="gray.500">
            {learningOutcome.code} | {learningOutcome.grade_level}
          </Text>
        </VStack>
      </Box>

      <Box mt="30%" p={4}>
        <Text fontSize="lg" fontWeight="bold" mb={2}>
          Learning Outcome Description:
        </Text>
        <Text fontSize="md" mb={4}>
          {learningOutcome.description}
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
                initialLearningOutcomeCode: learningOutcome.code
              })}
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
                <Text color="gray.500">No evidence uploaded yet</Text>
                <Button 
                  leftIcon={<Plus />} 
                  colorScheme="blue" 
                  onClick={() => openModal({
                    studentId, 
                    learningOutcomeId,
                    initialLearningOutcomeCode: learningOutcome.code
                  })}
                >
                  Add Evidence
                </Button>
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
