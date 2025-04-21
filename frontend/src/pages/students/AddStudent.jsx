import {
    Container,
    VStack,
    Heading,
    FormControl,
    FormLabel,
    Input,
    Select,
    Button,
    useToast,
    Box,
    IconButton
  } from '@chakra-ui/react'
  import { X } from 'react-feather'
  import { useState } from 'react'
  import { useNavigate } from 'react-router-dom'
  import { createStudent } from '../../services/api'
  import { useStudents } from '../../contexts/StudentsContext'

  
  const AddStudent = () => {
    const { addStudent } = useStudents()
    const navigate = useNavigate()
    const toast = useToast()
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    grade_level: '',
    gender: 'prefer_not_to_say'  // Default value
  })
  
    const handleChange = (e) => {
      const { name, value } = e.target
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
  
    const handleSubmit = async (e) => {
        e.preventDefault()
        
        // Validate form data
        if (!formData.first_name || !formData.last_name || !formData.date_of_birth || !formData.grade_level || !formData.gender) {
          toast({
            title: 'Missing information',
            description: 'Please fill in all required fields',
            status: 'warning',
            duration: 5000,
            isClosable: true,
          })
          return
        }
        
        try {
          // Log the data being sent
          console.log('Submitting student data:', formData)
          
          const newStudent = await createStudent(formData)
          console.log('Created student:', newStudent)
          
          addStudent(newStudent)
          toast({
            title: 'Student created.',
            description: "We've created the student profile for you.",
            status: 'success',
            duration: 5000,
            isClosable: true,
          })
          navigate('/students')
        } catch (error) {
          console.error('Error details:', error.response?.data)
          toast({
            title: 'Error creating student.',
            description: error.response?.data?.detail || error.message,
            status: 'error',
            duration: 5000,
            isClosable: true,
          })
        }
    }
  
    return (
      <Container maxW="container.sm" py={8} position="relative">
        <Box position="absolute" top={2} left={2}>
          <IconButton
            icon={<X size={16} />}
            size="sm"
            aria-label="Go back"
            variant="ghost"
            onClick={() => navigate('/students')}
          />
        </Box>
        <VStack spacing={8} align="stretch">
          <Heading size="xl">Add New Student</Heading>
          
          <form onSubmit={handleSubmit}>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>First Name</FormLabel>
                <Input
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                />
              </FormControl>
  
              <FormControl isRequired>
                <FormLabel>Last Name</FormLabel>
                <Input
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                />
              </FormControl>
  
              <FormControl isRequired>
                <FormLabel>Date of Birth</FormLabel>
                <Input
                  name="date_of_birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={handleChange}
                />
              </FormControl>
  
              <FormControl isRequired>
                <FormLabel>Grade Level</FormLabel>
                <Select
                  name="grade_level"
                  value={formData.grade_level}
                  onChange={handleChange}
                >
                  <option value="">Select grade</option>
                  <option value="K">Kindergarten</option>
                  <option value="1">1st Grade</option>
                  <option value="2">2nd Grade</option>
                  <option value="3">3rd Grade</option>
                  <option value="4">4th Grade</option>
                  <option value="5">5th Grade</option>

                  // <option value="6">6th Grade</option>
                </Select>
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Gender</FormLabel>
                <Select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </Select>
              </FormControl>
  
              <Button
                type="submit"
                colorScheme="blue"
                width="full"
                mt={4}
              >
                Create Student
              </Button>
            </VStack>
          </form>
        </VStack>
      </Container>
    )
  }
  
  export default AddStudent
