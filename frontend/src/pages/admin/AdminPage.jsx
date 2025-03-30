import { Container, Heading, VStack, Box, Button, Divider } from '@chakra-ui/react'
import { ArrowLeft } from 'react-feather'
import { useNavigate } from 'react-router-dom'
import UpdateStudentSlugs from '../../components/admin/UpdateStudentSlugs'
import DeleteStudent from '../../components/admin/DeleteStudent'

const AdminPage = () => {
  const navigate = useNavigate()

  return (
    <Container maxW="container.md" py={8}>
      <VStack spacing={8} align="stretch">
        <Box>
          <Button 
            leftIcon={<ArrowLeft size={20} />}
            variant="ghost" 
            onClick={() => navigate('/students')}
            alignSelf="flex-start"
          >
            Back to Students
          </Button>
          <Heading size="xl" mt={2}>Admin Tools</Heading>
        </Box>

        <Box>
          <Heading size="md" mb={4}>Student Management</Heading>
          <VStack spacing={4} align="stretch">
            <UpdateStudentSlugs />
            <Divider my={2} />
            <DeleteStudent />
          </VStack>
        </Box>
      </VStack>
    </Container>
  )
}

export default AdminPage
