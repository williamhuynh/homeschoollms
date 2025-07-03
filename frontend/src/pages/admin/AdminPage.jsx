import { Container, Heading, VStack, Box, Button, Divider, Tabs, TabList, TabPanels, Tab, TabPanel } from '@chakra-ui/react'
import { ArrowLeft } from 'react-feather'
import { useNavigate } from 'react-router-dom'
import UpdateStudentSlugs from '../../components/admin/UpdateStudentSlugs'
import DeleteStudent from '../../components/admin/DeleteStudent'
import ManageParentAccess from '../../components/admin/ManageParentAccess'
import ImageMigrationManager from '../../components/admin/ImageMigrationManager'
import { useUser } from '../../contexts/UserContext'

const AdminPage = () => {
  const navigate = useNavigate()
  const { isAdmin } = useUser()

  return (
    <Container maxW="container.xl" py={8}>
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
          <Heading size="xl" mt={2}>Admin Settings</Heading>
        </Box>

        <Tabs isFitted variant="enclosed-colored">
          <TabList mb="1em">
            <Tab>Parent Access</Tab>
            {isAdmin() && <Tab>Student Slugs</Tab>}
            <Tab>Delete Student</Tab>
            {isAdmin() && <Tab>Image Migration</Tab>}
          </TabList>
          
          <TabPanels>
            {/* Parent Access Tab */}
            <TabPanel>
              <Box>
                <Heading size="md" mb={4}>Parent Access Management</Heading>
                <ManageParentAccess />
              </Box>
            </TabPanel>
            
            {/* Student Slugs Tab (Admin only) */}
            {isAdmin() && (
              <TabPanel>
                <Box>
                  <Heading size="md" mb={4}>Student Slug Management</Heading>
                  <UpdateStudentSlugs />
                </Box>
              </TabPanel>
            )}
            
            {/* Delete Student Tab */}
            <TabPanel>
              <Box>
                <Heading size="md" mb={4}>Student Deletion</Heading>
                <DeleteStudent />
              </Box>
            </TabPanel>
            
            {/* Image Migration Tab (Admin only) */}
            {isAdmin() && (
              <TabPanel>
                <Box>
                  <Heading size="md" mb={4}>Image Security Migration</Heading>
                  <ImageMigrationManager />
                </Box>
              </TabPanel>
            )}
          </TabPanels>
        </Tabs>
      </VStack>
    </Container>
  )
}

export default AdminPage
