import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { Box, Button, Text, VStack, Heading, Container, Spinner, Center, HStack, Progress, useDisclosure, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, Select, useToast, Menu, MenuButton, MenuList, MenuItem, IconButton } from '@chakra-ui/react'
import { ArrowLeft, MoreVertical } from 'react-feather'
import { useEffect, useState } from 'react'
import { getStudentBySlug, getLatestEvidenceForOutcomes, updateStudentGrade } from '../../services/api'
import { curriculumService } from '../../services/curriculum'
import { useStudents } from '../../contexts/StudentsContext'

const StudentProgressPage = () => {
  const navigate = useNavigate()
  const { studentId } = useParams()
  const location = useLocation()
  const { updateStudent } = useStudents()
  const toast = useToast()
  const [student, setStudent] = useState(location.state?.student || null)
  const [loading, setLoading] = useState(!location.state?.student)
  const [curriculumLoading, setCurriculumLoading] = useState(true)
  const [error, setError] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [subjectProgress, setSubjectProgress] = useState({})
  const [progressLoading, setProgressLoading] = useState(false)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [newGrade, setNewGrade] = useState('')
  const [changingGrade, setChangingGrade] = useState(false)

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
        // Fetch student data
        const data = await getStudentBySlug(studentId)
        setStudent(data)
        setError(null)
        
        // Get student's grade level
        if (data?.grade_level) {
          // Get stage for this grade level
          const stage = curriculumService.getStageForGrade(data.grade_level)
          console.log('Student grade level:', data.grade_level, 'Stage:', stage)
          
          setCurriculumLoading(true)
          
          // Load curriculum data for this stage
          try {
            // Get subjects for student's grade level
            const gradeSubjects = await curriculumService.getSubjects(data.grade_level)
            console.log('Found subjects:', gradeSubjects)
            setSubjects(gradeSubjects)
          } catch (err) {
            console.error('Error loading curriculum:', err)
            // Still show the student page even if curriculum fails
          } finally {
            setCurriculumLoading(false)
          }
        }
      } catch (err) {
        console.error('Error fetching student:', err)
        setError(isOffline ? 
          'You appear to be offline. Some data may not be available.' : 
          'Failed to load student information'
        )
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [studentId, isOffline])

  // Compute subject progress (outcomes with evidence / total outcomes)
  useEffect(() => {
    const computeProgress = async () => {
      if (!student?._id || subjects.length === 0 || isOffline) {
        return;
      }
      setProgressLoading(true)
      try {
        const stage = curriculumService.getStageForGrade(student.grade_level)
        const entries = await Promise.all(
          subjects.map(async (subject) => {
            try {
              const outcomes = await curriculumService.getOutcomes(stage, subject.code)
              const outcomeCodes = outcomes.map(o => o.code)
              if (outcomeCodes.length === 0) {
                return [subject.code, { percentage: 0, total: 0, withEvidence: 0 }]
              }
              const evidenceMap = await getLatestEvidenceForOutcomes(student._id, outcomeCodes)
              const withEvidence = Object.keys(evidenceMap || {}).length
              const total = outcomeCodes.length
              const percentage = total > 0 ? (withEvidence / total) * 100 : 0
              return [subject.code, { percentage, total, withEvidence }]
            } catch (err) {
              console.error(`Failed computing progress for ${subject.code}:`, err)
              return [subject.code, { percentage: 0, total: 0, withEvidence: 0 }]
            }
          })
        )
        setSubjectProgress(Object.fromEntries(entries))
      } catch (err) {
        console.error('Error computing subject progress:', err)
      } finally {
        setProgressLoading(false)
      }
    }

    computeProgress()
  }, [student, subjects, isOffline])

  const handleBack = () => {
    navigate('/students')
  }

  const handleSubjectClick = (subject) => {
    navigate(`/students/${studentId}/subjects/${subject.code}`, {
      state: { student, subject }
    })
  }

  const handleConfirmChangeGrade = async () => {
    if (!student || !newGrade) return
    setChangingGrade(true)
    try {
      const updated = await updateStudentGrade(studentId, newGrade)
      setStudent(updated)
      updateStudent(updated)
      // Reload curriculum
      setCurriculumLoading(true)
      const stage = curriculumService.getStageForGrade(updated.grade_level)
      await curriculumService.load(stage)
      const gradeSubjects = await curriculumService.getSubjects(updated.grade_level)
      setSubjects(gradeSubjects)
      toast({ title: 'Grade updated', description: `Now viewing ${updated.grade_level}`, status: 'success', duration: 3000 })
      onClose()
      setNewGrade('')
    } catch (e) {
      toast({ title: 'Failed to update grade', description: e?.response?.data?.detail || e.message, status: 'error' })
    } finally {
      setChangingGrade(false)
      setCurriculumLoading(false)
    }
  }

  if (loading) {
    return (
      <Container maxW="container.sm" py={8} pb="64px">
        <Center p={8}>
          <Spinner size="xl" color="blue.500" />
        </Center>
      </Container>
    )
  }

  if (error && !student) {
    return (
      <Container maxW="container.sm" py={8} pb="64px">
        <VStack spacing={4}>
          <Text color="red.500">{error}</Text>
          <Button onClick={handleBack}>Back to Students</Button>
        </VStack>
      </Container>
    )
  }

  return (
    <Container maxW="container.sm" py={8} pb="80px">
      {isOffline && (
        <Box mb={4} p={3} bg="orange.100" borderRadius="md">
          <Text fontWeight="medium">You are currently offline. Some data may not be available.</Text>
        </Box>
      )}
      
      <VStack spacing={6} align="stretch">
        <Button 
          leftIcon={<ArrowLeft size={20} />}
          variant="ghost" 
          onClick={handleBack}
          alignSelf="flex-start"
        >
          Back to Students
        </Button>

        <HStack justify="space-between" align="center">
          <VStack align="start" spacing={0}>
            <Heading size="xl">{student?.first_name} {student?.last_name}'s Progress</Heading>
            <Text>Grade: {student?.grade_level}</Text>
          </VStack>
          <Menu placement="bottom-end">
            <MenuButton as={IconButton} icon={<MoreVertical />} variant="ghost" aria-label="Options" isDisabled={isOffline || curriculumLoading} />
            <MenuList>
              <MenuItem onClick={onOpen}>Change Grade</MenuItem>
            </MenuList>
          </Menu>
        </HStack>

        {curriculumLoading ? (
          <Center p={4}>
            <Spinner size="md" color="blue.500" mr={2} />
            <Text>Loading subjects...</Text>
          </Center>
        ) : subjects.length > 0 ? (
          <VStack spacing={4} align="stretch">
            {subjects.map((subject) => {
              const progressData = subjectProgress[subject.code]
              const percent = Math.round(progressData?.percentage || 0)
              return (
                <Box 
                  key={subject.code} 
                  p={4} 
                  borderRadius="lg" 
                  border="1px" 
                  borderColor="gray.200"
                  cursor="pointer"
                  onClick={() => handleSubjectClick(subject)}
                  _hover={{ bg: 'gray.50' }}
                >
                  <Text fontWeight="bold">{subject.name}</Text>
                  <Text>{subject.description}</Text>

                  {!isOffline && (
                    <Box mt={3}>
                      <HStack justify="space-between" mb={1}>
                        <Text fontSize="sm" color="gray.600">Progress</Text>
                        <Text fontSize="sm" fontWeight="medium">{percent}%</Text>
                      </HStack>
                      <Progress 
                        value={percent}
                        size="sm"
                        colorScheme="teal"
                        borderRadius="md"
                        sx={{
                          '> div': { borderRadius: '6px' }
                        }}
                      />
                      {progressData && (
                        <Text mt={1} fontSize="xs" color="gray.500">
                          {progressData.withEvidence || 0} / {progressData.total || 0} outcomes evidenced
                        </Text>
                      )}
                      {progressLoading && !progressData && (
                        <Text mt={1} fontSize="xs" color="gray.400">Calculating...</Text>
                      )}
                    </Box>
                  )}

                  {isOffline && (
                    <Text mt={2} fontSize="xs" color="gray.500">Progress unavailable offline</Text>
                  )}
                </Box>
              )
            })}
          </VStack>
        ) : (
          <Text color="gray.500">No subjects available for {student?.grade_level}.</Text>
        )}
        
        {error && (
          <Box p={3} bg="orange.100" borderRadius="md">
            <Text color="orange.800">{error}</Text>
          </Box>
        )}
      </VStack>

      <Modal isOpen={isOpen} onClose={changingGrade ? () => {} : onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Change Grade</ModalHeader>
          <ModalBody>
            <Text mb={2}>Select a new grade level for this student.</Text>
            <Select value={newGrade} onChange={(e) => setNewGrade(e.target.value)} placeholder="Select grade" isDisabled={changingGrade}>
              <option value="K">Kindergarten</option>
              <option value="1">1st Grade</option>
              <option value="2">2nd Grade</option>
              <option value="3">3rd Grade</option>
              <option value="4">4th Grade</option>
              <option value="5">5th Grade</option>
              <option value="6">6th Grade</option>
              <option value="7">7th Grade</option>
              <option value="8">8th Grade</option>
              <option value="9">9th Grade</option>
              <option value="10">10th Grade</option>
              <option value="11">11th Grade</option>
              <option value="12">12th Grade</option>
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button mr={3} onClick={onClose} isDisabled={changingGrade}>Cancel</Button>
            <Button colorScheme="blue" onClick={handleConfirmChangeGrade} isLoading={changingGrade} isDisabled={!newGrade}>Confirm</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  )
}

export default StudentProgressPage
