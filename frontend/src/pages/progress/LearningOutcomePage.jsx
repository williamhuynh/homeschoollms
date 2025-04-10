import { Box, IconButton, Text, Container, Spinner, Center, VStack, useDisclosure } from '@chakra-ui/react'
import styles from '../../styles/LearningOutcomes.module.css'
import { ArrowLeft } from 'react-feather'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useState, useEffect, useContext } from 'react'
import { NSWCurriculum } from '../../services/curriculum'
import { useStudents } from '../../contexts/StudentsContext'
import { useFileUploadModal } from '../../contexts/FileUploadModalContext'
import ImageViewerModal from '../../components/common/ImageViewerModal'
import { getEvidenceForLearningOutcome } from '../../services/api'

const LearningOutcomePage = () => {
  const { openModal } = useFileUploadModal()
  const { 
    isOpen: isImageViewerOpen, 
    onOpen: onImageViewerOpen, 
    onClose: onImageViewerClose 
  } = useDisclosure()
  const [selectedImage, setSelectedImage] = useState(null)
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

  const handleImageClick = (image) => {
    setSelectedImage(image)
    onImageViewerOpen()
  }

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

        <div className={styles.outcomeGrid}>
          {evidenceLoading ? (
            <Center>
              <Spinner size="xl" color="blue.500" />
            </Center>
          ) : evidence.length === 0 ? (
              <div className={styles.outcomeCard} onClick={() => openModal({
                studentId,
                learningOutcomeId,
                learningOutcomeDescription: learningOutcome.description,
                initialLearningAreaCode: location.state?.subject?.code,
                initialLearningOutcomeCode: learningOutcome.code,
                onSubmit: async (data) => {
                  console.log('Evidence uploaded successfully:', data)
                  // Refresh the evidence list
                  try {
                    setEvidenceLoading(true)
                    const updatedEvidence = await getEvidenceForLearningOutcome(studentId, learningOutcomeId)
                    setEvidence(updatedEvidence)
                  } catch (err) {
                    console.error('Error refreshing evidence:', err)
                  } finally {
                    setEvidenceLoading(false)
                  }
                }
              })}>
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
          ) : (
            <>
              {evidence.map((item) => (
                <div 
                  className={styles.outcomeCard} 
                  key={item._id}
                  onClick={() => handleImageClick(item)}
                >
                  <div className={styles.imageContainer}>
                    <img
                      className={styles.image}
                      src={item.fileUrl}
                      alt="Evidence"
                      loading="lazy"
                      crossOrigin="anonymous"
                      aria-label={`Evidence for ${item.title}`}
                      onLoad={(e) => {
                        console.log('Image loaded successfully:', item.fileUrl);
                      }}
                      onError={(e) => {
                        console.error('Error loading image:', item.fileUrl, e);
                        e.target.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
                      }}
                      style={{ border: '1px solid #ddd' }}
                    />
                  </div>
                  <div className={styles.contentContainer}>
                    <h3 className={styles.title}>{item.title || item.file_name || 'Evidence'}</h3>
                    {item.description && (
                      <p className={styles.description}>{item.description}</p>
                    )}
                  </div>
                </div>
              ))}
              <div className={styles.outcomeCard} onClick={() => openModal({
                studentId,
                learningOutcomeId,
                learningOutcomeDescription: learningOutcome.description,
                initialLearningAreaCode: location.state?.subject?.code,
                initialLearningOutcomeCode: learningOutcome.code,
                onSubmit: async (data) => {
                  console.log('Evidence uploaded successfully:', data)
                  // Refresh the evidence list
                  try {
                    setEvidenceLoading(true)
                    const updatedEvidence = await getEvidenceForLearningOutcome(studentId, learningOutcomeId)
                    setEvidence(updatedEvidence)
                  } catch (err) {
                    console.error('Error refreshing evidence:', err)
                  } finally {
                    setEvidenceLoading(false)
                  }
                }
              })}>
                <div className={styles.imageContainer}>
                  <img 
                    className={styles.image}
                    src="https://placehold.co/300x400?text=Add+More+Evidence" 
                    alt="Add Evidence" 
                  />
                </div>
                <div className={styles.contentContainer}>
                  <h3 className={styles.title}>Add More Evidence</h3>
                  <p className={styles.description}>Upload additional evidence</p>
                </div>
              </div>
            </>
          )}
        </div>
      </Box>
      
      {/* Image Viewer Modal */}
      <ImageViewerModal
        isOpen={isImageViewerOpen}
        onClose={onImageViewerClose}
        image={selectedImage}
        studentId={studentId}
        learningOutcomeId={learningOutcomeId}
        onImageDeleted={handleImageDeleted}
      />
    </Container>
  )
}

export default LearningOutcomePage
