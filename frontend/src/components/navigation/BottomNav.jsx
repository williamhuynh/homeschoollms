// src/components/navigation/BottomNav.jsx
import { Box, Flex, IconButton } from '@chakra-ui/react'
import { Home, Plus, User } from 'react-feather' // Changed Settings to User
import { useNavigate, useLocation, useParams, useMatch } from 'react-router-dom'
import { useFileUploadModal } from '../../contexts/FileUploadModalContext'

const BottomNav = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  const { openModal } = useFileUploadModal()
  
  // Use useMatch to reliably get studentId from the current path
  const studentMatch = useMatch('/students/:studentId/*');
  const studentId = studentMatch?.params?.studentId;
  
  // Check if we're on the student selector page
  const isStudentSelectorPage = location.pathname === '/students'

  const handleOpenGlobalModal = () => {
    if (studentId) { // Only open if we have a student context
       console.log(`BottomNav: Opening global modal with studentId: ${studentId}`) // Log
       openModal({
         studentId: studentId,
         // Let the provider derive the grade
       });
    } else {
      console.warn("BottomNav: Cannot open file upload: No active student ID found in URL.");
      // Optionally show a message to the user (e.g., using a Toast)
    }
  }

  return (
    <Box 
      position="fixed" 
      bottom={0} 
      left={0} 
      right={0} 
      bg="white" 
      borderTop="1px" 
      borderColor="gray.200"
      px={4}
      py={2}
      zIndex={1000}
    >
      <Flex justify="space-between" align="center" maxW="container.sm" mx="auto">
        <IconButton
          icon={<Home />}
          variant="ghost"
          onClick={() => {
            if (studentId) {
              navigate(`/students/${studentId}/progress`);
            } else {
              navigate('/students');
            }
          }}
          aria-label="Home"
        />
        
        {/* Only show the upload button if we're not on the student selector page */}
        {!isStudentSelectorPage && (
          <IconButton
            icon={<Plus />}
            colorScheme="teal"
            rounded="full"
            size="lg"
            onClick={handleOpenGlobalModal}
            aria-label="Upload Evidence"
          />
        )}
        
        <IconButton
          icon={<User />} // Changed icon
          variant="ghost"
          onClick={() => navigate('/profile')} // Changed route
          aria-label="Profile" // Changed label
        />
      </Flex>
    </Box>
  )
}

export default BottomNav
