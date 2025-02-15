import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { Box, Button, Text, VStack, Heading, Container } from '@chakra-ui/react'
import { ArrowLeft } from 'react-feather'

const StudentProgressPage = () => {
  const navigate = useNavigate()
  const { studentId } = useParams()
  const location = useLocation()
  const student = location.state?.student

  // Mock progress data (you'll replace this with real data later)
  const mockProgress = {
    subjects: [
      { name: 'Math', progress: 75 },
      { name: 'English', progress: 85 },
      { name: 'Science', progress: 60 }
    ]
  }

  const handleBack = () => {
    navigate('/students')
  }

  const handleSubjectClick = (subject) => {
    navigate(`/students/${studentId}/subjects/${subject.toLowerCase()}`, {
      state: { student }
    })
  }

  if (!student) {
    return (
      <Container maxW="container.sm" py={8}>
        <Text>Student not found</Text>
        <Button onClick={handleBack}>Back to Students</Button>
      </Container>
    )
  }

  return (
    <Container maxW="container.sm" py={8}>
      <VStack spacing={6} align="stretch">
        <Button 
          leftIcon={<ArrowLeft size={20} />}
          variant="ghost" 
          onClick={handleBack}
          alignSelf="flex-start"
        >
          Back to Students
        </Button>

        <Heading size="xl">{student.name}'s Progress</Heading>
        <Text>{student.grade}</Text>

        <VStack spacing={4} align="stretch">
          {mockProgress.subjects.map((subject) => (
            <Box 
              key={subject.name} 
              p={4} 
              borderRadius="lg" 
              border="1px" 
              borderColor="gray.200"
              cursor="pointer"
              onClick={() => handleSubjectClick(subject.name)}
              _hover={{ bg: 'gray.50' }}
            >
              <Text fontWeight="bold">{subject.name}</Text>
              <Text>Progress: {subject.progress}%</Text>
            </Box>
          ))}
        </VStack>
      </VStack>
    </Container>
  )
}

export default StudentProgressPage