import { Container, Heading, VStack, IconButton, Flex } from '@chakra-ui/react'
import { Plus } from 'react-feather'  // Changed from MoreVertical to Plus
import { useNavigate } from 'react-router-dom'
import StudentList from '../../components/students/StudentList'
import { useEffect } from 'react'
import { useStudents } from '../../contexts/StudentsContext'
import { getStudents } from '../../services/api'

const StudentSelection = () => {
  const { students, setStudents } = useStudents()
  const navigate = useNavigate()

  const handleAddStudent = () => {
    navigate('/students/new')
  }

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const data = await getStudents()
        setStudents(data)
      } catch (error) {
        console.error('Failed to fetch students:', error)
      }
    }
    fetchStudents()
  }, [setStudents])

  return (
    <Container maxW="container.sm" py={8}>
      <VStack spacing={8} align="stretch">
        <Flex justify="space-between" align="center" px={4}>
          <Heading size="xl">Your Students</Heading>
          <IconButton
            icon={<Plus />}
            variant="solid"
            colorScheme="blue"
            aria-label="Add student"
            onClick={handleAddStudent}
          />
        </Flex>

        <StudentList 
          students={students} 
          onStudentSelect={handleStudentSelect}
        />
      </VStack>
    </Container>
  )
}

export default StudentSelection