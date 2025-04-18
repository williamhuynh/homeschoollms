import { Container, Heading, VStack, Box, Button, Divider } from '@chakra-ui/react'
import { ArrowLeft } from 'react-feather'
import { useNavigate } from 'react-router-dom'
import UpdateStudentSlugs from '../../components/admin/UpdateStudentSlugs'
import DeleteStudent from '../../components/admin/DeleteStudent'
import ManageParentAccess from '../../components/admin/ManageParentAccess'
import { useUser } from '../../contexts/UserContext'

const AdminPage = () => {
  const navigate = useNavigate()
  const { isAdmin } = useUser()

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
          <Heading size="xl" mt={2}>Settings</Heading>
        </Box>

        <Box>
          <Heading size="md" mb={4}>Student Management</Heading>
          <VStack spacing={4} align="stretch">
            {isAdmin() && <UpdateStudentSlugs />}
            {isAdmin() && <Divider my={2} />}
            <DeleteStudent />
          </VStack>
        </Box>

        <Divider my={4} />
        
        <Box>
          <ManageParentAccess />
        </Box>
      </VStack>
    </Container>
  )
}

export default AdminPage
