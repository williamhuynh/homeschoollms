// src/components/navigation/BottomNav.jsx
import { Box, Flex, IconButton } from '@chakra-ui/react'
import { Home, Plus, Settings } from 'react-feather'
import { useNavigate, useLocation } from 'react-router-dom'

const BottomNav = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { studentId } = location.state?.student || {}

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
          onClick={() => navigate(`/students/${studentId}/content/create`)}
          aria-label="Create"
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