// src/components/navigation/BottomNav.jsx
import { Box, Flex, IconButton } from '@chakra-ui/react'
import { Home, Plus, Settings } from 'react-feather'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { useFileUploadModal } from '../../contexts/FileUploadModalContext'

const BottomNav = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  const { openModal } = useFileUploadModal()
  
  // Try to get studentId from location state or URL params
  const studentId = location.state?.student?.studentId || params.studentId

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
          onClick={() => navigate(`/students/${studentId}/progress`)}
          aria-label="Home"
        />
        <IconButton
          icon={<Plus />}
          colorScheme="teal"
          rounded="full"
          size="lg"
          onClick={() => openModal({ studentId })}
          aria-label="Upload Evidence"
        />
        <IconButton
          icon={<Settings />}
          variant="ghost"
          onClick={() => console.log('Settings clicked')}
          aria-label="Settings"
        />
      </Flex>
    </Box>
  )
}

export default BottomNav
