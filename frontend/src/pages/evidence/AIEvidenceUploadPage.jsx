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
  Progress,
  Tag,
  TagLabel,
  TagCloseButton,
  Wrap,
  WrapItem,
  Tooltip
} from '@chakra-ui/react'
import { ArrowLeft, Upload, CheckCircle, AlertTriangle, Plus, Info } from 'react-feather'
import { useNavigate, useParams } from 'react-router-dom'
import { useStudents } from '../../contexts/StudentsContext'
import { useUser } from '../../contexts/UserContext'
import { analyzeImageForQuestions, suggestLearningOutcomes, uploadEvidence, uploadEvidenceMultiOutcome, generateAIDescription } from '../../services/api'
import { curriculumService } from '../../services/curriculum'
import ResponsiveImage from '../../components/common/ResponsiveImage'
import { compressImage } from '../../services/imageService'
import { logger } from '../../utils/logger'
import { UpgradeBanner } from '../../components/subscription/UpgradePrompt'
import Select from 'react-select'

/** Build a user-visible error description that includes actionable detail. */
function describeUploadError(error, fallback) {
  const status = error.response?.status
  const detail = error.response?.data?.detail
  const parts = []

  if (detail) parts.push(detail)
  else if (error.message) parts.push(error.message)
  else parts.push(fallback)

  if (status) parts.push(`(HTTP ${status})`)

  return parts.join(' ')
}

const AIEvidenceUploadPage = () => {
  const navigate = useNavigate()
  const { studentId } = useParams()
  const { students } = useStudents()
  const { usage, canAddEvidence } = useUser()
  const toast = useToast()

  // Find current student
  const student = students.find(s => s._id === studentId || s.slug === studentId)

  // Check if user can add evidence
  const canAdd = canAddEvidence()
  
  // State management
  const [currentStep, setCurrentStep] = useState(1) // 1: Upload, 2: Questions, 3: Outcomes, 4: Review
  const [selectedFiles, setSelectedFiles] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [analysisQuestions, setAnalysisQuestions] = useState([])
  const [questionAnswers, setQuestionAnswers] = useState({})
  const [customAnswers, setCustomAnswers] = useState({}) // For "Other" option text inputs
  const [additionalContext, setAdditionalContext] = useState('') // Free text context field
  const [suggestedOutcomes, setSuggestedOutcomes] = useState([])
  const [selectedOutcomes, setSelectedOutcomes] = useState([])
  const [manuallySelectedOutcomes, setManuallySelectedOutcomes] = useState([]) // Manual outcome selection
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [curriculumData, setCurriculumData] = useState(null)

  // Add fields for review/edit step
  const [title, setTitle] = useState(`AI Analyzed Evidence - ${new Date().toLocaleDateString()}`)
  const [description, setDescription] = useState('')
  const [aiGenerationError, setAIGenerationError] = useState(null)
  const [learningResources, setLearningResources] = useState([])
  const [newResourceName, setNewResourceName] = useState('')
  const [newResourceType, setNewResourceType] = useState('')
  const [newResourceDetails, setNewResourceDetails] = useState('')
  const [showAddResource, setShowAddResource] = useState(false)

  const resetResourceForm = () => {
    setShowAddResource(false)
    setNewResourceName('')
    setNewResourceType('')
    setNewResourceDetails('')
  }

  // Load curriculum data when component mounts
  useEffect(() => {
    const loadCurriculumData = async () => {
      if (student?.grade_level) {
        try {
          logger.debug('Loading curriculum for grade', { grade: student.grade_level })
          
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
          logger.debug('Curriculum loaded successfully', { areasCount: curriculumData?.learning_areas?.length || 0 })
        } catch (error) {
          logger.error('Error loading curriculum', error)
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

  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files)
    const newFiles = files.filter(file =>
      !selectedFiles.some(existingFile => existingFile.name === file.name && existingFile.lastModified === file.lastModified)
    )

    // Compress images before storing to avoid exceeding Vercel's proxy body-size limit
    const compressed = await Promise.all(newFiles.map(f => compressImage(f)))

    const filesWithIds = compressed.map(file => ({
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
    const fileSizes = selectedFiles.map(f => `${f.file.name}:${(f.file.size / 1024).toFixed(0)}KB`)
    try {
      logger.breadcrumb('ai', 'Step 1: Analyzing images', { count: selectedFiles.length, fileSizes })

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
      logger.error('Step 1 failed: analyzeImageForQuestions', error, {
        step: 'analyze-image',
        fileCount: selectedFiles.length,
        fileSizes,
        studentId,
      })
      toast({
        title: 'Analysis failed',
        description: describeUploadError(error, 'Unable to analyze the images. Please try again.'),
        status: 'error',
        duration: 7000,
        isClosable: true,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleQuestionSubmit = async () => {
    // No validation - all questions are now optional

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
      logger.breadcrumb('ai', 'Submitting answers for outcome analysis')

      // Merge question answers with custom "Other" answers and additional context
      const mergedAnswers = { ...questionAnswers }
      Object.keys(customAnswers).forEach(questionId => {
        if (questionAnswers[questionId] === 'Other (please specify)' && customAnswers[questionId]) {
          mergedAnswers[questionId] = customAnswers[questionId]
        }
      })
      if (additionalContext.trim()) {
        mergedAnswers['additional_context'] = additionalContext.trim()
      }

      // Call AI service to suggest learning outcomes
      const files = selectedFiles.map(f => f.file)
      const response = await suggestLearningOutcomes(
        files,
        mergedAnswers,
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
      logger.error('Step 2 failed: suggestLearningOutcomes', error, {
        step: 'suggest-outcomes',
        fileCount: selectedFiles.length,
        studentId,
        gradeLevel: student?.grade_level,
      })
      toast({
        title: 'Outcome analysis failed',
        description: describeUploadError(error, 'Unable to analyze learning outcomes. Please try again.'),
        status: 'error',
        duration: 7000,
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
      logger.breadcrumb('upload', 'Uploading AI-analyzed evidence', { fileCount: selectedFiles.length, outcomeCount: selectedOutcomes.length })

      if (selectedOutcomes.length === 0) {
        throw new Error('Please select at least one learning outcome to proceed')
      }

      if (!title || !title.trim()) {
        throw new Error('Please provide a title before uploading')
      }

      // Create FormData for multi-outcome evidence upload
      const formData = new FormData()

      // Add files
      selectedFiles.forEach(({ file }) => {
        formData.append('files', file)
      })

      // Use edited fields (fallback description if empty)
      const finalDescription = description && description.trim() ? description : buildFallbackDescription()

      formData.append('title', title.trim())
      formData.append('description', finalDescription)
      formData.append('learning_outcome_codes', selectedOutcomes.join(','))
      formData.append('learning_area_codes', selectedOutcomes.map(code => code.split('-')[0]).join(','))

      if (student?.grade_level) {
        formData.append('student_grade', student.grade_level)
      }

      if (learningResources.length > 0) {
        formData.append('learning_resources', JSON.stringify(learningResources))
      }

      await uploadEvidenceMultiOutcome(studentId, formData)

      toast({
        title: 'Evidence uploaded successfully',
        description: `Uploaded ${selectedFiles.length} file(s) to ${selectedOutcomes.length} learning outcome(s)`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      })

      navigate(`/students/${studentId}/progress`)
    } catch (error) {
      logger.error('Step 4 failed: uploadEvidenceMultiOutcome', error, {
        step: 'upload-evidence',
        fileCount: selectedFiles.length,
        selectedOutcomes,
        studentId,
      })

      const is403 = error.response?.status === 403
      toast({
        title: is403 ? 'Upload limit reached' : 'Upload failed',
        description: describeUploadError(error, 'Unable to upload evidence. Please try again.'),
        status: 'error',
        duration: 7000,
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
      case 4: return 'Review & Edit Details'
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
              <Text>Upload</Text>
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
          loadingText="Analysing..."
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
          <FormControl key={question.id}>
            <FormLabel fontWeight="semibold">
              {question.question}
              <Text as="span" fontSize="sm" color="gray.500" ml={2}>(optional)</Text>
            </FormLabel>

            {question.type === 'radio' && (
              <VStack align="stretch" spacing={2}>
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
                    <Radio value="Other (please specify)">
                      Other (please specify)
                    </Radio>
                  </Stack>
                </RadioGroup>

                {questionAnswers[question.id] === 'Other (please specify)' && (
                  <Input
                    placeholder="Please describe..."
                    value={customAnswers[question.id] || ''}
                    onChange={(e) => setCustomAnswers(prev => ({
                      ...prev,
                      [question.id]: e.target.value
                    }))}
                    mt={2}
                    bg="gray.50"
                  />
                )}
              </VStack>
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

        <Divider my={4} />

        <FormControl>
          <FormLabel fontWeight="semibold">
            Additional Context
            <Text as="span" fontSize="sm" color="gray.500" ml={2}>(optional)</Text>
          </FormLabel>
          <Text fontSize="sm" color="gray.600" mb={2}>
            Provide any extra details to help identify the right learning outcomes
          </Text>
          <Textarea
            placeholder="E.g., This activity involved problem solving with fractions..."
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            rows={3}
            maxLength={500}
          />
          <Text fontSize="xs" color="gray.500" mt={1} textAlign="right">
            {additionalContext.length}/500 characters
          </Text>
        </FormControl>
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
          loadingText="Analysing..."
        >
          Next
        </Button>
      </HStack>
    </VStack>
  )

  const renderStep3 = () => (
    <VStack spacing={6} align="stretch">
      <Box textAlign="center">
        <Heading size="lg" mb={2}>Suggested Learning Outcomes</Heading>
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
          No learning outcomes were suggested. Use the manual selection below to choose outcomes.
        </Alert>
      )}

      <Divider my={4} />

      <Box>
        <Heading size="md" mb={2}>Manual Selection</Heading>
        <Text fontSize="sm" color="gray.600" mb={3}>
          Can&apos;t find the right outcome? Manually select from all outcomes for {student?.grade_level}
        </Text>
        <Select
          isMulti
          options={curriculumData?.learning_areas?.map(subject => ({
            label: subject.name,
            options: (subject.outcomes || []).map(outcome => ({
              value: outcome.code,
              label: `${outcome.code} - ${outcome.name}`,
              subject: subject.name,
              outcome: outcome
            }))
          })) || []}
          value={manuallySelectedOutcomes}
          onChange={(selected) => setManuallySelectedOutcomes(selected || [])}
          placeholder="Search and select learning outcomes..."
          isSearchable
          closeMenuOnSelect={false}
          formatGroupLabel={(data) => (
            <Box fontWeight="bold" color="purple.600" py={1}>{data.label}</Box>
          )}
          styles={{
            control: (base) => ({ ...base, minHeight: '50px' }),
            option: (base, state) => ({
              ...base,
              backgroundColor: state.isSelected ? '#3182ce' : state.isFocused ? '#f7fafc' : 'white',
              color: state.isSelected ? 'white' : 'black'
            }),
            groupHeading: (base) => ({
              ...base,
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#805AD5',
              textTransform: 'none',
              padding: '8px 12px'
            })
          }}
        />
        {manuallySelectedOutcomes.length > 0 && (
          <Text fontSize="sm" color="gray.600" mt={2}>
            {manuallySelectedOutcomes.length} outcome(s) manually selected
          </Text>
        )}
      </Box>

      <HStack spacing={3}>
        <Button
          variant="outline"
          onClick={() => setCurrentStep(2)}
          isDisabled={isProcessing}
        >
          Back
        </Button>
        <Button
          colorScheme="blue"
          flex={1}
          onClick={async () => {
            const totalSelectedCodes = [
              ...selectedOutcomes,
              ...manuallySelectedOutcomes.map(o => o.value)
            ]
            const uniqueSelectedCodes = [...new Set(totalSelectedCodes)]

            if (uniqueSelectedCodes.length === 0) {
              toast({
                title: 'No outcomes selected',
                description: 'Please select at least one learning outcome',
                status: 'warning',
                duration: 3000,
                isClosable: true,
              })
              return
            }
            setIsProcessing(true)
            setAIGenerationError(null)
            try {
              // Build context and generate description
              const richContext = buildRichContext()
              const fileObjects = selectedFiles.map(f => f.file)
              const descriptionResult = await generateAIDescription(fileObjects, richContext)
              const generated = descriptionResult?.description || ''
              setDescription(generated || buildFallbackDescription())
              if (descriptionResult?.title && descriptionResult.title.trim()) {
                setTitle(descriptionResult.title.trim())
              } else if (!title) {
                setTitle(`AI Analyzed Evidence - ${new Date().toLocaleDateString()}`)
              }
              // Pre-populate learning resources from AI
              if (descriptionResult?.learning_resources?.length > 0) {
                setLearningResources(descriptionResult.learning_resources.map(r => ({
                  name: r.name,
                  type: r.type || '',
                  details: r.details || ''
                })))
              }
            } catch (err) {
              logger.error('Step 3 failed: generateAIDescription', err, {
                step: 'generate-description',
                fileCount: selectedFiles.length,
                selectedOutcomes,
                studentId,
              })
              setDescription(buildFallbackDescription())
              const statusHint = err.response?.status ? ` (HTTP ${err.response.status})` : ''
              setAIGenerationError(`Could not generate AI description${statusHint}. A basic description has been provided. You can edit it below.`)
            } finally {
              setIsProcessing(false)
              setCurrentStep(4)
            }
          }}
          isLoading={isProcessing}
          loadingText="Generating description..."
          isDisabled={selectedOutcomes.length === 0}
        >
          Review Details ({selectedOutcomes.length} outcomes)
        </Button>
      </HStack>
    </VStack>
  )

  const renderStep4 = () => (
    <VStack spacing={6} align="stretch">
      <Box textAlign="center">
        <Heading size="lg" mb={2}>Review & Edit</Heading>
        <Text color="gray.600">Update the title and description before saving.</Text>
      </Box>
      {aiGenerationError && (
        <Alert status="warning">
          <AlertIcon />
          {aiGenerationError}
        </Alert>
      )}
      <FormControl isRequired>
        <FormLabel>Title</FormLabel>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter a title" />
      </FormControl>
      <FormControl>
        <FormLabel>Description</FormLabel>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} placeholder="Enter a description" />
      </FormControl>

      {/* Learning Resources */}
      <FormControl>
        <FormLabel>
          Learning Resources
          <Tooltip label="Books, apps, websites, or other materials used in this activity" placement="top">
            <Box as="span" ml={1} color="gray.400" cursor="help">
              <Info size={14} style={{ display: 'inline' }} />
            </Box>
          </Tooltip>
        </FormLabel>

        {/* Resource chips */}
        {learningResources.length > 0 && (
          <Wrap spacing={2} mb={3}>
            {learningResources.map((resource, index) => (
              <WrapItem key={index}>
                <Tag size="md" colorScheme="blue" borderRadius="full">
                  <TagLabel>{resource.name}{resource.type ? ` (${resource.type})` : ''}</TagLabel>
                  <TagCloseButton onClick={() => {
                    setLearningResources(prev => prev.filter((_, i) => i !== index))
                  }} />
                </Tag>
              </WrapItem>
            ))}
          </Wrap>
        )}

        {/* Add resource form */}
        {showAddResource ? (
          <VStack spacing={2} align="stretch" p={3} bg="gray.50" borderRadius="md">
            <Input
              size="sm"
              placeholder="Resource name (e.g. Reading Eggs)"
              value={newResourceName}
              onChange={(e) => setNewResourceName(e.target.value)}
            />
            <HStack spacing={2}>
              <Input
                size="sm"
                placeholder="Type (e.g. Book, App, Website)"
                value={newResourceType}
                onChange={(e) => setNewResourceType(e.target.value)}
                flex={1}
              />
              <Input
                size="sm"
                placeholder="URL or note (optional)"
                value={newResourceDetails}
                onChange={(e) => setNewResourceDetails(e.target.value)}
                flex={1}
              />
            </HStack>
            <HStack spacing={2}>
              <Button
                size="sm"
                colorScheme="blue"
                isDisabled={!newResourceName.trim()}
                onClick={() => {
                  setLearningResources(prev => [...prev, {
                    name: newResourceName.trim(),
                    type: newResourceType.trim() || null,
                    details: newResourceDetails.trim() || null
                  }])
                  resetResourceForm()
                }}
              >
                Add
              </Button>
              <Button size="sm" variant="ghost" onClick={resetResourceForm}>
                Cancel
              </Button>
            </HStack>
          </VStack>
        ) : (
          <Button size="sm" variant="outline" leftIcon={<Plus size={14} />} onClick={() => setShowAddResource(true)}>
            Add Resource
          </Button>
        )}
      </FormControl>

      <HStack spacing={3}>
        <Button variant="outline" onClick={() => setCurrentStep(3)} isDisabled={isProcessing}>Back</Button>
        <Button colorScheme="green" flex={1} leftIcon={<CheckCircle />} onClick={handleFinalSubmit} isLoading={isProcessing} loadingText="Uploading...">
          Save Evidence
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

        {/* Usage Limit Warning */}
        {usage && (
          <Box>
            {/* Show warning when approaching limit (80%) */}
            {usage.evidence_count >= usage.max_evidence * 0.8 && !canAdd && (
              <UpgradeBanner
                message={`You've reached your evidence limit (${usage.evidence_count}/${usage.max_evidence}). Upgrade to continue uploading.`}
                feature="more evidence uploads"
                variant="warning"
              />
            )}
            {/* Show info when approaching limit but still can add */}
            {usage.evidence_count >= usage.max_evidence * 0.8 && canAdd && (
              <Alert status="info" borderRadius="md">
                <AlertIcon as={AlertTriangle} />
                <Box>
                  <Text fontWeight="bold">Approaching evidence limit</Text>
                  <Text fontSize="sm">
                    {usage.evidence_remaining} of {usage.max_evidence} uploads remaining
                  </Text>
                </Box>
              </Alert>
            )}
          </Box>
        )}

        {/* Progress indicator */}
        <Box>
          <HStack justify="space-between" mb={2}>
            <Text fontSize="sm" fontWeight="medium">Step {currentStep} of 4</Text>
            <Text fontSize="sm" color="gray.500">{Math.round((currentStep / 4) * 100)}% complete</Text>
          </HStack>
          <Progress value={(currentStep / 4) * 100} colorScheme="blue" size="sm" />
        </Box>

        {/* Step content */}
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </VStack>
    </Container>
  )
}

export default AIEvidenceUploadPage 