import { useState } from 'react'
import { 
  Container, 
  Heading, 
  VStack, 
  Box, 
  Button, 
  Tabs, 
  TabList, 
  TabPanels, 
  Tab, 
  TabPanel,
  Badge,
  HStack,
  Text,
  Divider,
} from '@chakra-ui/react'
import { ArrowLeft, Shield, Users, BookOpen, BarChart2 } from 'react-feather'
import { useNavigate } from 'react-router-dom'
import DeleteStudent from '../../components/admin/DeleteStudent'
import ManageParentAccess from '../../components/admin/ManageParentAccess'
import ImageMigrationManager from '../../components/admin/ImageMigrationManager'
import UserManagement from '../../components/admin/UserManagement'
import AllStudentsView from '../../components/admin/AllStudentsView'
import PlatformStats from '../../components/admin/PlatformStats'
import ImpersonationBanner from '../../components/admin/ImpersonationBanner'
import { useUser } from '../../contexts/UserContext'

const AdminPage = () => {
  const navigate = useNavigate()
  const { isAdmin, isSuperAdmin, setUser, fetchUserData } = useUser()
  
  // Impersonation state
  const [impersonation, setImpersonation] = useState(null)
  const [originalToken, setOriginalToken] = useState(null)

  const handleImpersonate = (impersonationData) => {
    // Store the original token so we can restore it later
    const currentToken = localStorage.getItem('token')
    setOriginalToken(currentToken)
    
    // Set the impersonation token
    localStorage.setItem('token', impersonationData.token)
    setImpersonation(impersonationData.impersonated_user)
    
    // Refresh user data to reflect the impersonated user
    fetchUserData()
  }

  const handleStopImpersonation = () => {
    if (originalToken) {
      localStorage.setItem('token', originalToken)
      setOriginalToken(null)
      setImpersonation(null)
      fetchUserData()
    }
  }

  // Super admin tab styling
  const superAdminTabStyle = {
    bg: 'red.50',
    color: 'red.700',
    borderColor: 'red.200',
    _selected: {
      bg: 'red.500',
      color: 'white',
      borderColor: 'red.500',
    },
  }

  return (
    <>
      {/* Impersonation Banner */}
      <ImpersonationBanner 
        impersonatedUser={impersonation}
        onStopImpersonation={handleStopImpersonation}
      />
      
      <Container maxW="container.xl" py={8} mt={impersonation ? 12 : 0}>
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
            <HStack mt={2} spacing={3}>
              <Heading size="xl">Settings</Heading>
              {isSuperAdmin() && (
                <Badge colorScheme="red" fontSize="sm" px={2} py={1}>
                  <HStack spacing={1}>
                    <Shield size={14} />
                    <Text>Super Admin</Text>
                  </HStack>
                </Badge>
              )}
            </HStack>
          </Box>

          <Tabs isFitted variant="enclosed-colored" colorScheme="purple">
            <TabList mb="1em" flexWrap="wrap">
              {/* Regular Tabs */}
              <Tab>Parent Access</Tab>
              <Tab>Delete Student</Tab>
              {isAdmin() && <Tab>Image Migration</Tab>}
              
              {/* Super Admin Tabs - Distinguished with red styling */}
              {isSuperAdmin() && (
                <>
                  <Tab {...superAdminTabStyle}>
                    <HStack spacing={1}>
                      <BarChart2 size={16} />
                      <Text>Platform Stats</Text>
                    </HStack>
                  </Tab>
                  <Tab {...superAdminTabStyle}>
                    <HStack spacing={1}>
                      <Users size={16} />
                      <Text>All Users</Text>
                    </HStack>
                  </Tab>
                  <Tab {...superAdminTabStyle}>
                    <HStack spacing={1}>
                      <BookOpen size={16} />
                      <Text>All Students</Text>
                    </HStack>
                  </Tab>
                </>
              )}
            </TabList>
            
            <TabPanels>
              {/* Parent Access Tab */}
              <TabPanel>
                <Box>
                  <Heading size="md" mb={4}>Parent Access Management</Heading>
                  <ManageParentAccess />
                </Box>
              </TabPanel>
              
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
              
              {/* Super Admin Tabs */}
              {isSuperAdmin() && (
                <>
                  {/* Platform Stats Tab */}
                  <TabPanel>
                    <Box>
                      <HStack mb={4}>
                        <Heading size="md">Platform Statistics</Heading>
                        <Badge colorScheme="red">Super Admin</Badge>
                      </HStack>
                      <PlatformStats />
                    </Box>
                  </TabPanel>
                  
                  {/* User Management Tab */}
                  <TabPanel>
                    <Box>
                      <HStack mb={4}>
                        <Heading size="md">User Management</Heading>
                        <Badge colorScheme="red">Super Admin</Badge>
                      </HStack>
                      <UserManagement onImpersonate={handleImpersonate} />
                    </Box>
                  </TabPanel>
                  
                  {/* All Students Tab */}
                  <TabPanel>
                    <Box>
                      <HStack mb={4}>
                        <Heading size="md">All Students (System-wide)</Heading>
                        <Badge colorScheme="red">Super Admin</Badge>
                      </HStack>
                      <AllStudentsView />
                    </Box>
                  </TabPanel>
                </>
              )}
            </TabPanels>
          </Tabs>
        </VStack>
      </Container>
    </>
  )
}

export default AdminPage
