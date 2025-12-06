import {
  Box,
  HStack,
  Text,
  Button,
  Container,
} from '@chakra-ui/react'
import { Eye, X } from 'react-feather'

/**
 * Banner displayed at the top of the page when a super admin is impersonating another user.
 * 
 * Props:
 * - impersonatedUser: Object with user details (email, first_name, last_name)
 * - onStopImpersonation: Callback function to stop impersonation
 */
const ImpersonationBanner = ({ impersonatedUser, onStopImpersonation }) => {
  if (!impersonatedUser) return null

  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bg="orange.500"
      color="white"
      py={2}
      zIndex={9999}
      boxShadow="md"
    >
      <Container maxW="container.xl">
        <HStack justify="space-between">
          <HStack spacing={3}>
            <Eye size={18} />
            <Text fontWeight="medium">
              Impersonating: {impersonatedUser.first_name} {impersonatedUser.last_name}
            </Text>
            <Text fontSize="sm" opacity={0.9}>
              ({impersonatedUser.email})
            </Text>
          </HStack>
          <Button
            size="sm"
            leftIcon={<X size={16} />}
            colorScheme="orange"
            variant="outline"
            borderColor="white"
            color="white"
            _hover={{ bg: 'orange.600' }}
            onClick={onStopImpersonation}
          >
            Stop Impersonation
          </Button>
        </HStack>
      </Container>
    </Box>
  )
}

export default ImpersonationBanner
