import { useState, useEffect } from 'react'
import {
  Box,
  Container,
  VStack,
  Button,
  Text,
  Heading,
  IconButton,
  useToast,
  Spinner,
  Center,
  Alert,
  AlertIcon,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  RadioGroup,
  Radio,
  Stack,
  Checkbox,
  HStack,
  Badge,
  Divider,
  Card,
  CardBody,
  Progress
} from '@chakra-ui/react'
import { ArrowLeft, Upload, CheckCircle } from 'react-feather'
import { useNavigate, useParams } from 'react-router-dom'
import { useStudents } from '../../contexts/StudentsContext'
import { analyzeImageForQuestions, suggestLearningOutcomes, uploadEvidence, uploadEvidenceMultiOutcome, generateAIDescription } from '../../services/api'
import { curriculumService } from '../../services/curriculum'
import ResponsiveImage from '../../components/common/ResponsiveImage'

const AIEvidenceUploadPage = () => {
  const navigate = useNavigate()
  const { studentId } = useParams()
  const { students } = useStudents()
  const toast = useToast()
  
  // Find current student
  const student = students.find(s => s._id === studentId || s.slug === studentId)
  
  // State management
  const [currentStep, setCurrentStep] = useState(1) // 1: Upload, 2: Questions, 3: Outcomes
  const [selectedFiles, setSelectedFiles] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [analysisQuestions, setAnalysisQuestions] = useState([])
  const [questionAnswers, setQuestionAnswers] = useState({})
  const [suggestedOutcomes, setSuggestedOutcomes] = useState([])
  const [selectedOutcomes, setSelectedOutcomes] = useState([])
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [curriculumData, setCurriculumData] = useState(null)

  // Load curriculum data when component mounts
  useEffect(() => {
    const loadCurriculumData = async () => {
      if (student?.grade_level) {
        try {
          console.log('Loading curriculum for grade:', student.grade_level)
          
          // Get the stage for this grade level
          const stage = curriculumService.getStageForGrade(student.grade_level)
          if (!stage) {
            throw new Error(`No stage found for grade: ${student.grade_level}`)
          }
          
          // Load the curriculum data for this stage
          const stageData = await curriculumService.load(stage)
          
          // Transform stage data to match expected format for AI
          const curriculumData = {
            stage: stage,
            grade_level: student.grade_level,
            learning_areas: stageData.subjects || []
          }
          
          setCurriculumData(curriculumData)
          console.log('Curriculum loaded successfully:', curriculumData?.learning_areas?.length || 0, 'learning areas')
        } catch (error) {
          console.error('Error loading curriculum:', error)
          toast({
            title: 'Warning',
            description: 'Could not load curriculum data. AI suggestions may be limited.',
            status: 'warning',
            duration: 5000,
            isClosable: true,
          })
        }
      }
    }

    loadCurriculumData()
  }, [student?.grade_level, toast])

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files)
    const newFiles = files.filter(file => 
      !selectedFiles.some(existingFile => existingFile.name === file.name && existingFile.lastModified === file.lastModified)
    )

    const filesWithIds = newFiles.map(file => ({ 
      file, 
      id: crypto.randomUUID(),
      preview: URL.createObjectURL(file)
    }))

    setSelectedFiles(prevFiles => [...prevFiles, ...filesWithIds])
    event.target.value = null
  }

  const handleRemoveFile = (fileIdToRemove) => {
    setSelectedFiles(prevFiles => {
      const fileToRemove = prevFiles.find(f => f.id === fileIdToRemove)
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove.preview)
      }
      return prevFiles.filter(f => f.id !== fileIdToRemove)
    })
  }

  const handleUploadAndAnalyze = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select at least one image to analyze',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    setIsProcessing(true)
    try {
      console.log('Analyzing images:', selectedFiles.map(f => f.file.name))
      
      // Call AI service to analyze image and generate questions
      const files = selectedFiles.map(f => f.file)
      const response = await analyzeImageForQuestions(files)
      
      if (response?.questions && response.questions.length > 0) {
        setAnalysisQuestions(response.questions)
        setCurrentStep(2)
        toast({
          title: 'Analysis complete',
          description: `Generated ${response.questions.length} contextual questions`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        })
      } else {
        throw new Error('No questions generated from AI analysis')
      }
      
    } catch (error) {
      console.error('Error analyzing images:', error)
      toast({
        title: 'Analysis failed',
        description: error.message || 'Unable to analyze the images. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleQuestionSubmit = async () => {
    // Validate that required questions are answered
    const unansweredRequired = analysisQuestions.filter(q => 
      q.type === 'radio' && !questionAnswers[q.id]
    )

    if (unansweredRequired.length > 0) {
      toast({
        title: 'Please answer all questions',
        description: 'All questions need to be answered before proceeding',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    if (!curriculumData) {
      toast({
        title: 'Curriculum data not available',
        description: 'Cannot suggest learning outcomes without curriculum data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return
    }

    setIsProcessing(true)
    try {
      console.log('Submitting answers:', questionAnswers)
      
      // Call AI service to suggest learning outcomes
      const files = selectedFiles.map(f => f.file)
      const response = await suggestLearningOutcomes(
        files, 
        questionAnswers, 
        curriculumData, 
        student.grade_level
      )
      
      if (response?.outcomes) {
        setSuggestedOutcomes(response.outcomes)
        // Auto-select outcomes with high confidence (>= 70%)
        setSelectedOutcomes(response.outcomes.filter(o => o.confidence >= 70).map(o => o.code))
        setCurrentStep(3)
        
        toast({
          title: 'Outcome analysis complete',
          description: `Found ${response.outcomes.length} relevant learning outcomes`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        })
      } else {
        // No outcomes suggested - still proceed to step 3 but with empty outcomes
        setSuggestedOutcomes([])
        setCurrentStep(3)
        
        toast({
          title: 'No specific outcomes identified',
          description: 'AI could not identify specific learning outcomes. You can still upload the evidence.',
          status: 'info',
          duration: 5000,
          isClosable: true,
        })
      }
      
    } catch (error) {
      console.error('Error getting outcome suggestions:', error)
      toast({
        title: 'Analysis failed',
        description: error.message || 'Unable to analyze learning outcomes. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  /**
   * Helper function to build rich context for AI description generation
   */
  const buildRichContext = () => {
    const contextParts = []
    
    // Add student context
    if (student) {
      contextParts.push(`Student: ${student.first_name} ${student.last_name}, Grade ${student.grade_level}`)
    }
    
    // Add selected learning outcomes with descriptions
    if (selectedOutcomes.length > 0) {
      const selectedOutcomeObjects = suggestedOutcomes.filter(outcome => 
        selectedOutcomes.includes(outcome.code)
      )
      
      if (selectedOutcomeObjects.length > 0) {
        contextParts.push('\nLearning Outcomes:')
        selectedOutcomeObjects.forEach(outcome => {
          const confidenceText = outcome.confidence ? ` (${outcome.confidence}% confidence)` : ''
          contextParts.push(`• ${outcome.code}: ${outcome.description}${confidenceText}`)
        })
      }
    }
    
    // Add question answers in natural language
    if (analysisQuestions.length > 0 && Object.keys(questionAnswers).length > 0) {
      contextParts.push('\nActivity Context:')
      analysisQuestions.forEach(question => {
        const answer = questionAnswers[question.id]
        if (answer) {
          contextParts.push(`• ${question.question}: ${answer}`)
        }
      })
    }
    
    // Add learning areas if available
    const learningAreas = selectedOutcomes.map(code => code.split('-')[0]).filter((area, index, self) => self.indexOf(area) === index)
    if (learningAreas.length > 0) {
      contextParts.push(`\nLearning Areas: ${learningAreas.join(', ')}`)
    }
    
    return contextParts.length > 0 ? contextParts.join('\n') : 'Learning activity evidence upload'
  }

  const handleFinalSubmit = async () => {
    setIsProcessing(true)
    try {
      console.log('Final submission:', {
        files: selectedFiles.map(f => f.file.name),
        outcomes: selectedOutcomes,
        answers: questionAnswers
      })

      // Use ALL selected outcomes with new multi-outcome endpoint
      if (selectedOutcomes.length === 0) {
        throw new Error('Please select at least one learning outcome to proceed')
      }

      // Generate rich AI description before upload
      let aiGeneratedDescription = ''
      try {
        console.log('Generating AI description from analysis data...')
        const richContext = buildRichContext()
        console.log('Rich context built:', richContext)
        
        const fileObjects = selectedFiles.map(f => f.file)
        const descriptionResult = await generateAIDescription(fileObjects, richContext)
        
        if (descriptionResult && descriptionResult.description) {
          aiGeneratedDescription = descriptionResult.description
          console.log('AI description generated:', aiGeneratedDescription)
        } else {
          console.warn('AI description generation returned empty result')
        }
      } catch (descError) {
        console.error('Failed to generate AI description:', descError)
        // Continue with upload even if description generation fails
        aiGeneratedDescription = buildFallbackDescription()
      }

      // Use AI-generated description or fallback
      const finalDescription = aiGeneratedDescription || buildFallbackDescription()

      // Create FormData for multi-outcome evidence upload
      const formData = new FormData()
      
      // Add files
      selectedFiles.forEach(({ file }) => {
        formData.append('files', file)
      })
      
      // Add metadata with ALL selected outcomes
      formData.append('title', `AI Analyzed Evidence - ${new Date().toLocaleDateString()}`)
      formData.append('description', finalDescription)
      formData.append('learning_outcome_codes', selectedOutcomes.join(',')) // All outcomes as comma-separated
      formData.append('learning_area_codes', selectedOutcomes.map(code => code.split('-')[0]).join(',')) // Extract area codes
      
      if (student?.grade_level) {
        formData.append('student_grade', student.grade_level)
      }

      // Upload evidence using new multi-outcome endpoint
      const result = await uploadEvidenceMultiOutcome(studentId, formData)

      toast({
        title: 'Evidence uploaded successfully',
        description: `Uploaded ${selectedFiles.length} file(s) to ${selectedOutcomes.length} learning outcome(s) with AI analysis`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      })

      // Navigate back to student progress
      navigate(`/students/${studentId}/progress`)
      
    } catch (error) {
      console.error('Error uploading evidence:', error)
      toast({
        title: 'Upload failed',
        description: error.message || 'Unable to upload evidence. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  /**
   * Build fallback description when AI generation fails
   */
  const buildFallbackDescription = () => {
    const parts = []
    
    // Add basic context
    parts.push(`Evidence analyzed by AI on ${new Date().toLocaleDateString()}.`)
    
    // Add learning outcomes
    if (selectedOutcomes.length > 0) {
      parts.push(`Learning outcomes: ${selectedOutcomes.join(', ')}.`)
    }
    
    // Add key answers
    if (Object.keys(questionAnswers).length > 0) {
      const keyAnswers = Object.entries(questionAnswers)
        .filter(([, answer]) => answer && answer.trim())
        .map(([questionId, answer]) => {
          const question = analysisQuestions.find(q => q.id === questionId)
          return question ? `${question.question}: ${answer}` : answer
        })
        .slice(0, 3) // Limit to first 3 answers
      
      if (keyAnswers.length > 0) {
        parts.push(`Activity context: ${keyAnswers.join('; ')}.`)
      }
    }
    
    return parts.join(' ')
  }

  const handleAnswerChange = (questionId, value) => {
    setQuestionAnswers(prev => ({
      ...prev,
      [questionId]: value
    }))
  }

  const handleOutcomeToggle = (outcomeCode) => {
    setSelectedOutcomes(prev => 
      prev.includes(outcomeCode)
        ? prev.filter(code => code !== outcomeCode)
        : [...prev, outcomeCode]
    )
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return 'Upload Images'
      case 2: return 'Provide Context'
      case 3: return 'Review Suggestions'
      default: return 'AI Evidence Upload'
    }
  }

  const renderStep1 = () => (
    <VStack spacing={6} align="stretch">
      <Box textAlign="center">
        <Heading size="lg" mb={2}>Upload Education Moment</Heading>
        <Text color="gray.600">
          Upload one or more images and let AI help identify the learning outcomes
        </Text>
      </Box>

      <Box>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          id="ai-file-upload"
          disabled={isOffline}
        />
        <label htmlFor="ai-file-upload">
          <Button
            as="span"
            w="full"
            h="150px"
            variant="outline"
            borderStyle="dashed"
            borderWidth="2px"
            isDisabled={isOffline}
            _hover={{ bg: 'gray.50' }}
          >
            <VStack spacing={2}>
              <Upload size={32} />
              <Text>Select Images to Analyze</Text>
              <Text fontSize="sm" color="gray.500">
                Choose photos of learning activities
              </Text>
            </VStack>
          </Button>
        </label>
      </Box>

      {selectedFiles.length > 0 && (
        <Box>
          <Text fontWeight="bold" mb={3}>Selected Images ({selectedFiles.length})</Text>
          <HStack spacing={3} overflowX="auto" pb={2}>
            {selectedFiles.map(({ id, file, preview }) => (
              <Box key={id} position="relative" flexShrink={0}>
                <Box
                  w="120px"
                  h="120px"
                  borderRadius="md"
                  overflow="hidden"
                  border="2px solid"
                  borderColor="gray.200"
                >
                  <img
                    src={preview}
                    alt={file.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                </Box>
                <IconButton
                  icon={<Text>×</Text>}
                  size="xs"
                  colorScheme="red"
                  variant="solid"
                  isRound
                  position="absolute"
                  top="-5px"
                  right="-5px"
                  onClick={() => handleRemoveFile(id)}
                  aria-label="Remove file"
                />
                <Text fontSize="xs" mt={1} noOfLines={1} textAlign="center">
                  {file.name}
                </Text>
              </Box>
            ))}
          </HStack>
        </Box>
      )}

      {selectedFiles.length > 0 && (
        <Button
          colorScheme="blue"
          size="lg"
          onClick={handleUploadAndAnalyze}
          isLoading={isProcessing}
          loadingText="Analyzing..."
          isDisabled={isOffline}
        >
          Upload
        </Button>
      )}

      {isOffline && (
        <Alert status="warning">
          <AlertIcon />
          You are offline. AI analysis requires an internet connection.
        </Alert>
      )}
    </VStack>
  )

  const renderStep2 = () => (
    <VStack spacing={6} align="stretch">
      <Box textAlign="center">
        <Heading size="lg" mb={2}>Provide some additional information and context</Heading>
        <Text color="gray.600">
          This will will be stored alongside your images so you can be reminded of what happened
        </Text>
      </Box>

      <VStack spacing={4} align="stretch">
        {analysisQuestions.map((question) => (
          <FormControl key={question.id} isRequired={question.type === 'radio'}>
            <FormLabel fontWeight="semibold">{question.question}</FormLabel>
            
            {question.type === 'radio' && (
              <RadioGroup
                value={questionAnswers[question.id] || ''}
                onChange={(value) => handleAnswerChange(question.id, value)}
              >
                <Stack direction="column" spacing={2}>
                  {question.options.map((option) => (
                    <Radio key={option} value={option}>
                      {option}
                    </Radio>
                  ))}
                </Stack>
              </RadioGroup>
            )}

            {question.type === 'text' && (
              <Textarea
                placeholder={question.placeholder}
                value={questionAnswers[question.id] || ''}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                rows={3}
              />
            )}
          </FormControl>
        ))}
      </VStack>

      <HStack spacing={3}>
        <Button
          variant="outline"
          onClick={() => setCurrentStep(1)}
          isDisabled={isProcessing}
        >
          Back
        </Button>
        <Button
          colorScheme="blue"
          flex={1}
          onClick={handleQuestionSubmit}
          isLoading={isProcessing}
          loadingText="Analyzing..."
        >
          Next
        </Button>
      </HStack>
    </VStack>
  )

  const renderStep3 = () => (
    <VStack spacing={6} align="stretch">
      <Box textAlign="center">
        <Heading size="lg" mb={2}>AI Suggested Learning Outcomes</Heading>
        <Text color="gray.600">
          Review and select the learning outcomes that best match this evidence
        </Text>
      </Box>

      <VStack spacing={3} align="stretch">
        {suggestedOutcomes.map((outcome) => (
          <Card key={outcome.code} variant="outline">
            <CardBody>
              <HStack spacing={3} align="start">
                <Checkbox
                  isChecked={selectedOutcomes.includes(outcome.code)}
                  onChange={() => handleOutcomeToggle(outcome.code)}
                  size="lg"
                  colorScheme="blue"
                />
                <Box flex={1}>
                  <HStack spacing={2} mb={2}>
                    <Text fontWeight="bold">{outcome.name}</Text>
                    <Badge 
                      colorScheme={outcome.confidence >= 80 ? 'green' : outcome.confidence >= 60 ? 'yellow' : 'red'}
                    >
                      {outcome.confidence}% confident
                    </Badge>
                  </HStack>
                  <Text fontSize="sm" color="gray.600" mb={2}>
                    {outcome.code} | {outcome.description}
                  </Text>
                  <Text fontSize="xs" color="gray.500" fontStyle="italic">
                    {outcome.reasoning}
                  </Text>
                </Box>
              </HStack>
            </CardBody>
          </Card>
        ))}
      </VStack>

      {suggestedOutcomes.length === 0 && (
        <Alert status="info">
          <AlertIcon />
          No learning outcomes were suggested. You can still upload the evidence manually by selecting outcomes from the regular upload flow.
        </Alert>
      )}

      <HStack spacing={3}>
        <Button
          variant="outline"
          onClick={() => setCurrentStep(2)}
          isDisabled={isProcessing}
        >
          Back
        </Button>
        <Button
          colorScheme="green"
          flex={1}
          leftIcon={<CheckCircle />}
          onClick={handleFinalSubmit}
          isLoading={isProcessing}
          loadingText="Generating description & uploading..."
          isDisabled={selectedOutcomes.length === 0}
        >
          Upload Evidence ({selectedOutcomes.length} outcomes)
        </Button>
      </HStack>
    </VStack>
  )

  return (
    <Container maxW="container.sm" py={4} pb="80px">
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <HStack spacing={3}>
          <IconButton
            icon={<ArrowLeft />}
            onClick={() => navigate(-1)}
            variant="ghost"
            aria-label="Back"
          />
          <VStack align="start" spacing={0} flex={1}>
            <Heading size="md">{getStepTitle()}</Heading>
            {student && (
              <Text fontSize="sm" color="gray.500">
                {student.first_name} {student.last_name} • Grade {student.grade_level}
              </Text>
            )}
          </VStack>
        </HStack>

        {/* Progress indicator */}
        <Box>
          <HStack justify="space-between" mb={2}>
            <Text fontSize="sm" fontWeight="medium">Step {currentStep} of 3</Text>
            <Text fontSize="sm" color="gray.500">{Math.round((currentStep / 3) * 100)}% complete</Text>
          </HStack>
          <Progress value={(currentStep / 3) * 100} colorScheme="blue" size="sm" />
        </Box>

        {/* Step content */}
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </VStack>
    </Container>
  )
}

export default AIEvidenceUploadPage 