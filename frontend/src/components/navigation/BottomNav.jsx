// src/components/navigation/BottomNav.jsx
import { Box, Flex, IconButton } from '@chakra-ui/react'
import { Home, Plus, User, FileText, Zap } from 'react-feather' // Added Zap for AI chat
import { useNavigate, useLocation, useParams, useMatch } from 'react-router-dom'

const BottomNav = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  
  // Use useMatch to reliably get studentId from the current path
  const studentMatch = useMatch('/students/:studentId/*');
  const studentId = studentMatch?.params?.studentId;
  
  // Check if we're on the student selector page
  const isStudentSelectorPage = location.pathname === '/students'

  const handleOpenAIUpload = () => {
    if (studentId) { // Only navigate if we have a student context
       console.log(`BottomNav: Opening AI upload for studentId: ${studentId}`) // Log
       navigate(`/students/${studentId}/ai-upload`);
    } else {
      console.warn("BottomNav: Cannot open AI upload: No active student ID found in URL.");
      // Optionally show a message to the user (e.g., using a Toast)
    }
  }

  const handleOpenAIChat = () => {
    if (studentId) {
      console.log(`BottomNav: Opening AI chat for studentId: ${studentId}`)
      navigate(`/students/${studentId}/ai-chat`)
    } else {
      console.warn("BottomNav: Cannot open AI chat: No active student ID found in URL.")
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
            onClick={handleOpenAIUpload}
            aria-label="AI Evidence Upload"
          />
        )}
        
        {/* Reports button - only show if we have a student context */}
        {studentId && (
          <IconButton
            icon={<FileText />}
            variant="ghost"
            onClick={() => navigate(`/students/${studentId}/reports`)}
            aria-label="Reports"
          />
        )}
        
        {/* AI Chat button - only show if we have a student context */}
        {studentId && (
          <IconButton
            icon={<Zap />}
            variant="ghost"
            onClick={handleOpenAIChat}
            aria-label="AI Chat"
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
