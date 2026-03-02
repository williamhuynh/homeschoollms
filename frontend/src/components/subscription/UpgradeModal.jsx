import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Text,
  VStack,
  Icon,
  useColorModeValue,
} from '@chakra-ui/react'
import { Zap } from 'react-feather'
import { useNavigate } from 'react-router-dom'

const UpgradeModal = ({ isOpen, feature = 'this feature' }) => {
  const navigate = useNavigate()

  const gradientBg = useColorModeValue(
    'linear(to-br, purple.400, pink.400)',
    'linear(to-br, purple.600, pink.600)'
  )

  const handleUpgrade = () => {
    navigate('/subscription')
  }

  return (
    <Modal isOpen={isOpen} onClose={() => {}} closeOnOverlayClick={false} isCentered>
      <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(10px)" />
      <ModalContent mx={4}>
        <ModalHeader textAlign="center" pt={8}>
          <VStack spacing={3}>
            <Icon
              as={Zap}
              w={12}
              h={12}
              color="purple.500"
            />
            <Text fontSize="2xl" fontWeight="bold">
              Upgrade Required
            </Text>
          </VStack>
        </ModalHeader>

        <ModalBody textAlign="center" pb={6}>
          <VStack spacing={4}>
            <Text color="gray.600">
              {feature} is available on the <strong>Basic</strong> plan.
            </Text>
            <Text color="gray.500" fontSize="sm">
              Unlock AI assistance, more students, and unlimited evidence uploads with our Basic plan.
            </Text>
          </VStack>
        </ModalBody>

        <ModalFooter justifyContent="center" pb={8}>
          <VStack spacing={3} w="full">
            <Button
              size="lg"
              w="full"
              bgGradient={gradientBg}
              color="white"
              _hover={{ opacity: 0.9 }}
              onClick={handleUpgrade}
            >
              View Plans & Upgrade
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate(-1)}
            >
              Go Back
            </Button>
          </VStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default UpgradeModal
