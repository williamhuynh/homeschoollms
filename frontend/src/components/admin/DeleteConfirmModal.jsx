import { useState } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Text,
  VStack,
  Box,
  Input,
  FormControl,
  FormLabel,
  Alert,
  AlertIcon,
  Checkbox,
  useToast,
} from '@chakra-ui/react'
import { AlertTriangle } from 'react-feather'
import { adminDeleteUser } from '../../services/api'

const DeleteConfirmModal = ({ isOpen, onClose, user, onDeleted }) => {
  const [confirmEmail, setConfirmEmail] = useState('')
  const [permanentDelete, setPermanentDelete] = useState(false)
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const handleDelete = async () => {
    if (confirmEmail !== user.email) {
      toast({
        title: 'Email does not match',
        description: 'Please type the correct email to confirm',
        status: 'warning',
        duration: 3000,
      })
      return
    }

    setLoading(true)
    try {
      await adminDeleteUser(user.id, permanentDelete)
      toast({
        title: permanentDelete ? 'User permanently deleted' : 'User deactivated',
        description: `${user.email} has been ${permanentDelete ? 'permanently deleted' : 'deactivated'}`,
        status: 'success',
        duration: 5000,
      })
      onDeleted()
    } catch (error) {
      toast({
        title: 'Error deleting user',
        description: error.response?.data?.detail || error.message,
        status: 'error',
        duration: 5000,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setConfirmEmail('')
    setPermanentDelete(false)
    onClose()
  }

  if (!user) return null

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader color="red.600">
          <Box display="flex" alignItems="center" gap={2}>
            <AlertTriangle size={24} />
            Delete User
          </Box>
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Alert status="warning">
              <AlertIcon />
              This action will {permanentDelete ? 'permanently delete' : 'deactivate'} the user account.
            </Alert>

            <Box p={4} bg="gray.50" borderRadius="md">
              <Text fontWeight="bold">{user.first_name} {user.last_name}</Text>
              <Text color="gray.600">{user.email}</Text>
              <Text fontSize="sm" color="gray.500">Role: {user.role}</Text>
            </Box>

            <FormControl>
              <FormLabel>Type the user's email to confirm:</FormLabel>
              <Input
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={user.email}
              />
            </FormControl>

            <Box p={3} bg="red.50" borderRadius="md" borderWidth="1px" borderColor="red.200">
              <Checkbox
                colorScheme="red"
                isChecked={permanentDelete}
                onChange={(e) => setPermanentDelete(e.target.checked)}
              >
                <Text color="red.700" fontWeight="medium">
                  Permanently delete (cannot be undone)
                </Text>
              </Checkbox>
              <Text fontSize="xs" color="red.600" mt={1} ml={6}>
                If unchecked, the user will only be deactivated and can be restored later.
              </Text>
            </Box>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={handleClose}>
            Cancel
          </Button>
          <Button
            colorScheme="red"
            onClick={handleDelete}
            isLoading={loading}
            isDisabled={confirmEmail !== user.email}
          >
            {permanentDelete ? 'Permanently Delete' : 'Deactivate User'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default DeleteConfirmModal
