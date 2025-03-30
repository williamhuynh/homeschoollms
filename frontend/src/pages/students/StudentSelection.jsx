import { Container, Heading, VStack, IconButton, Flex, useToast, Text, Center, Spinner, Link, Box } from '@chakra-ui/react'
import { Plus, Settings } from 'react-feather'
import { useNavigate } from 'react-router-dom'
import StudentList from '../../components/students/StudentList'
import { useEffect, useState } from 'react'
import { useStudents } from '../../contexts/StudentsContext'
import { getStudents } from '../../services/api'

const StudentSelection = () => {
  const { students, setStudents } = useStudents()
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const handleAddStudent = () => {
    navigate('/students/new')
  }

  const handleStudentSelect = (student) => {
    console.log('Selected student:', student)
    
    // Prefer slug if available, fall back to ID
    if (student.slug) {
      navigate(`/students/${student.slug}`)
    } else {
      // Fall back to ID if slug is not available
      const studentId = student.id || student._id
      if (studentId) {
        navigate(`/students/${studentId}`)
      } else {
        console.error('Student has no ID or slug:', student)
        toast({
          title: 'Error',
          description: 'Could not navigate to student details - missing identifier',
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
      }
    }
  }

  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true)
      try {
        const data = await getStudents()
        console.log('Fetched students:', data)
        setStudents(data || [])
        setError(null)
      } catch (error) {
        console.error('Failed to fetch students:', error)
        setError('Failed to load students. Please try again later.')
        toast({
          title: 'Error loading students',
          description: error.message,
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
      } finally {
        setLoading(false)
      }
    }
    fetchStudents()
  }, [setStudents, toast])

  return (
    <Container maxW="container.sm" py={8}>
      <VStack spacing={8} align="stretch">
        <Flex justify="space-between" align="center" px={4}>
          <Heading size="xl">Your Students</Heading>
          <Flex gap={2}>
            <IconButton
              icon={<Settings size={20} />}
              variant="ghost"
              aria-label="Admin settings"
              onClick={() => navigate('/admin')}
            />
            <IconButton
              icon={<Plus />}
              variant="solid"
              colorScheme="blue"
              aria-label="Add student"
              onClick={handleAddStudent}
            />
          </Flex>
        </Flex>

        {loading ? (
          <Center p={8}>
            <Spinner size="xl" color="blue.500" />
          </Center>
        ) : error ? (
          <Center p={8}>
            <Text color="red.500">{error}</Text>
          </Center>
        ) : (
          <StudentList 
            students={students} 
            onStudentSelect={handleStudentSelect}
          />
        )}
      </VStack>
    </Container>
  )
}

export default StudentSelection
