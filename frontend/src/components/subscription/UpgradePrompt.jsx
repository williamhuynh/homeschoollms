import {
  Box,
  Button,
  Text,
  VStack,
  HStack,
  Icon,
  useColorModeValue,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
} from '@chakra-ui/react'
import { AlertTriangle, Zap, Crown } from 'react-feather'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../../contexts/UserContext'

/**
 * Inline upgrade prompt banner
 */
export function UpgradeBanner({ 
  message, 
  feature = 'this feature',
  showButton = true,
  variant = 'warning' // 'warning' | 'info' | 'premium'
}) {
  const navigate = useNavigate()
  
  const variants = {
    warning: {
      bg: 'orange.50',
      borderColor: 'orange.200',
      iconColor: 'orange.500',
      icon: AlertTriangle,
    },
    info: {
      bg: 'blue.50',
      borderColor: 'blue.200',
      iconColor: 'blue.500',
      icon: AlertTriangle,
    },
    premium: {
      bg: 'purple.50',
      borderColor: 'purple.200',
      iconColor: 'purple.500',
      icon: Crown,
    },
  }

  const config = variants[variant] || variants.warning

  return (
    <Box
      bg={config.bg}
      border="1px solid"
      borderColor={config.borderColor}
      borderRadius="lg"
      p={4}
    >
      <HStack spacing={3} justify="space-between" wrap="wrap">
        <HStack spacing={3}>
          <Icon as={config.icon} color={config.iconColor} boxSize={5} />
          <Text color="gray.700">
            {message || `Upgrade to Basic to unlock ${feature}`}
          </Text>
        </HStack>
        {showButton && (
          <Button
            size="sm"
            colorScheme="purple"
            leftIcon={<Zap size={16} />}
            onClick={() => navigate('/subscription')}
          >
            Upgrade
          </Button>
        )}
      </HStack>
    </Box>
  )
}

/**
 * Modal upgrade prompt for blocking actions
 */
export function UpgradeModal({ 
  isOpen, 
  onClose, 
  title = 'Upgrade Required',
  message,
  feature = 'this feature',
}) {
  const navigate = useNavigate()
  const bgColor = useColorModeValue('white', 'gray.800')

  const handleUpgrade = () => {
    onClose()
    navigate('/subscription')
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent bg={bgColor} mx={4}>
        <ModalHeader>
          <HStack spacing={3}>
            <Icon as={Crown} color="purple.500" />
            <Text>{title}</Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Text color="gray.600">
              {message || `You've reached your plan limit. Upgrade to Basic to unlock ${feature} and more!`}
            </Text>
            
            <Box
              bg="purple.50"
              borderRadius="lg"
              p={4}
              border="1px solid"
              borderColor="purple.200"
            >
              <Text fontWeight="bold" color="purple.700" mb={2}>
                Basic Plan includes:
              </Text>
              <VStack align="start" spacing={1} color="purple.600" fontSize="sm">
                <Text>✓ Up to 3 student profiles</Text>
                <Text>✓ 1,000 evidence uploads</Text>
                <Text>✓ Full report generation</Text>
                <Text>✓ Priority support</Text>
              </VStack>
            </Box>
          </VStack>
        </ModalBody>

        <ModalFooter gap={3}>
          <Button variant="ghost" onClick={onClose}>
            Maybe Later
          </Button>
          <Button
            colorScheme="purple"
            leftIcon={<Zap size={18} />}
            onClick={handleUpgrade}
          >
            View Plans
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

/**
 * Compact usage indicator with upgrade prompt
 */
export function UsageIndicator({ 
  current, 
  max, 
  label,
  showUpgrade = true,
}) {
  const navigate = useNavigate()
  const percentage = (current / max) * 100
  const isNearLimit = percentage >= 80
  const isAtLimit = current >= max

  const barColor = isAtLimit ? 'red.400' : isNearLimit ? 'orange.400' : 'green.400'

  return (
    <Box>
      <HStack justify="space-between" mb={1}>
        <Text fontSize="sm" color="gray.500">{label}</Text>
        <Text fontSize="sm" fontWeight="medium">
          {current} / {max}
        </Text>
      </HStack>
      <Box
        h="6px"
        bg="gray.100"
        borderRadius="full"
        overflow="hidden"
      >
        <Box
          h="100%"
          w={`${Math.min(percentage, 100)}%`}
          bg={barColor}
          borderRadius="full"
          transition="width 0.3s"
        />
      </Box>
      {isAtLimit && showUpgrade && (
        <HStack mt={2} spacing={2}>
          <Icon as={AlertTriangle} color="orange.500" boxSize={4} />
          <Text fontSize="xs" color="orange.600">
            Limit reached.{' '}
            <Button
              variant="link"
              size="xs"
              colorScheme="purple"
              onClick={() => navigate('/subscription')}
            >
              Upgrade now
            </Button>
          </Text>
        </HStack>
      )}
    </Box>
  )
}

/**
 * Hook-based helper to check limits and show prompts
 */
export function useUpgradePrompt() {
  const { usage, canAddStudent, canAddEvidence, canGenerateReports, isFreeTier } = useUser()
  
  const checkStudentLimit = () => {
    if (!canAddStudent()) {
      return {
        allowed: false,
        message: `You've reached your limit of ${usage?.max_students} student(s). Upgrade to Basic to add more students.`,
      }
    }
    return { allowed: true, message: '' }
  }

  const checkEvidenceLimit = () => {
    if (!canAddEvidence()) {
      return {
        allowed: false,
        message: `You've reached your limit of ${usage?.max_evidence} evidence uploads. Upgrade to Basic for more uploads.`,
      }
    }
    return { allowed: true, message: '' }
  }

  const checkReportAccess = () => {
    if (!canGenerateReports()) {
      return {
        allowed: false,
        message: 'Report generation is a premium feature. Upgrade to Basic to generate reports.',
      }
    }
    return { allowed: true, message: '' }
  }

  return {
    checkStudentLimit,
    checkEvidenceLimit,
    checkReportAccess,
    isFreeTier: isFreeTier(),
    usage,
  }
}

export default UpgradeBanner
