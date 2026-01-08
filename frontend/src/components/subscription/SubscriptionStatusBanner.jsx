import {
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Box,
  Button,
  CloseButton,
  HStack,
  useDisclosure,
} from '@chakra-ui/react'
import { AlertTriangle, Clock, XCircle } from 'react-feather'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../../contexts/UserContext'

/**
 * Global subscription status banner
 * Shows warnings for:
 * - Past due payments
 * - Subscription expiring soon
 * - Trial ending soon
 */
function SubscriptionStatusBanner() {
  const navigate = useNavigate()
  const { subscription, usage } = useUser()
  const { isOpen: isVisible, onClose } = useDisclosure({ defaultIsOpen: true })

  if (!isVisible || !subscription) return null

  const now = new Date()
  const status = subscription?.status
  const currentPeriodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end) : null
  const trialEnd = subscription?.trial_end ? new Date(subscription.trial_end) : null
  const isTrialing = status === 'trialing'
  const isPastDue = status === 'past_due'
  const isCanceled = status === 'canceled'

  // Calculate days remaining
  let daysRemaining = null
  if (currentPeriodEnd) {
    daysRemaining = Math.ceil((currentPeriodEnd - now) / (1000 * 60 * 60 * 24))
  }

  let trialDaysRemaining = null
  if (trialEnd) {
    trialDaysRemaining = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24))
  }

  // Show banner for past due
  if (isPastDue) {
    return (
      <Alert status="error" variant="solid" position="relative">
        <AlertIcon as={XCircle} />
        <Box flex="1">
          <AlertTitle>Payment Failed</AlertTitle>
          <AlertDescription display="block">
            Your recent payment failed. Please update your payment method to continue using premium features.
          </AlertDescription>
        </Box>
        <HStack spacing={2}>
          <Button
            size="sm"
            colorScheme="whiteAlpha"
            onClick={() => navigate('/subscription')}
          >
            Update Payment
          </Button>
          <CloseButton
            position="absolute"
            right="8px"
            top="8px"
            onClick={onClose}
          />
        </HStack>
      </Alert>
    )
  }

  // Show banner for trial ending soon (3 days or less, but not expired)
  if (isTrialing && trialDaysRemaining !== null && trialDaysRemaining <= 3 && trialDaysRemaining > 0) {
    return (
      <Alert status="warning" position="relative">
        <AlertIcon as={Clock} />
        <Box flex="1">
          <AlertTitle>Trial Ending Soon</AlertTitle>
          <AlertDescription display="block">
            Your 14-day trial ends in {trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'}.
            {trialDaysRemaining <= 1 && ' Add a payment method to continue.'}
          </AlertDescription>
        </Box>
        <HStack spacing={2}>
          <Button
            size="sm"
            colorScheme="orange"
            onClick={() => navigate('/subscription')}
          >
            Add Payment Method
          </Button>
          <CloseButton
            position="absolute"
            right="8px"
            top="8px"
            onClick={onClose}
          />
        </HStack>
      </Alert>
    )
  }

  // Show banner for canceled subscription ending soon (7 days or less)
  if (isCanceled && daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0) {
    return (
      <Alert status="info" position="relative">
        <AlertIcon as={AlertTriangle} />
        <Box flex="1">
          <AlertTitle>Subscription Ending</AlertTitle>
          <AlertDescription display="block">
            Your subscription ends in {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}.
            Renew to keep your premium features.
          </AlertDescription>
        </Box>
        <HStack spacing={2}>
          <Button
            size="sm"
            colorScheme="blue"
            onClick={() => navigate('/subscription')}
          >
            Renew Subscription
          </Button>
          <CloseButton
            position="absolute"
            right="8px"
            top="8px"
            onClick={onClose}
          />
        </HStack>
      </Alert>
    )
  }

  return null
}

export default SubscriptionStatusBanner
