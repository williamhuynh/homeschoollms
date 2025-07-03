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

        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">🔐 Authentication Status</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Current Mode:</strong> {migrationStatus.migration_mode}</p>
              <p><strong>Public Images:</strong> {migrationStatus.public_count}</p>
              <p><strong>Private Images:</strong> {migrationStatus.private_count}</p>
              {migrationStatus.migration_mode === 'hybrid' && (
                <div className="bg-yellow-100 border border-yellow-300 rounded p-2 mt-2">
                  <p className="text-yellow-800">
                    <strong>In Hybrid Mode:</strong> New uploads go to authenticated storage. 
                    URLs with <code>/image/authenticated/</code> and signatures (like <code>s--ABC123--</code>) are secured by Cloudinary.
                  </p>
                </div>
              )}
              {migrationStatus.migration_mode === 'private' && (
                <div className="bg-green-100 border border-green-300 rounded p-2 mt-2">
                  <p className="text-green-800">
                    <strong>Full Private Mode:</strong> All images require authentication. 
                    Only signed URLs with time-limited access tokens work.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </VStack>
    </Container>
  )
}

export default AdminPage
