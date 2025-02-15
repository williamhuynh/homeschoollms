import { Container, Heading, VStack, IconButton, Flex } from '@chakra-ui/react'
import { MoreVertical } from 'react-feather'
import { useNavigate } from 'react-router-dom'
import StudentList from '../../components/students/StudentList'

const StudentSelection = () => {
  const navigate = useNavigate()

  // Enhanced mock data
  const mockStudents = [
    { id: 1, name: 'Test Student 1', grade: '3rd Grade' },
    { id: 2, name: 'Test Student 2', grade: '4th Grade' }
  ]

  const handleStudentSelect = (student) => {
    navigate(`/students/${student.id}/progress`, { state: { student } })
  }

  return (
    <Container maxW="container.sm" py={8}>
      <VStack spacing={8} align="stretch">
        <Flex justify="space-between" align="center" px={4}>
          <Heading size="xl">Your Students</Heading>
          <IconButton
            icon={<MoreVertical />}
            variant="ghost"
            aria-label="More options"
          />
        </Flex>

        <StudentList 
          students={mockStudents} 
          onStudentSelect={handleStudentSelect}
        />
      </VStack>
    </Container>
  )
}

export default StudentSelection