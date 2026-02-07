import { useState, useEffect } from 'react'
import {
  Container,
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  Button,
  Badge,
  SimpleGrid,
  List,
  ListItem,
  ListIcon,
  Spinner,
  Center,
  useToast,
  useColorModeValue,
  Icon,
  Flex,
  Switch,
  FormControl,
  FormLabel,
} from '@chakra-ui/react'
import { ArrowLeft, Check, X, Star, Zap, Award } from 'react-feather'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../../contexts/UserContext'
import { 
  getSubscriptionPricing, 
  createCheckoutSession,
  createPortalSession 
} from '../../services/api'

function SubscriptionPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { 
    user, 
    subscription, 
    usage, 
    subscriptionLoading, 
    getEffectiveTier,
    isGrandfathered 
  } = useUser()
  
  const [pricing, setPricing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [isAnnual, setIsAnnual] = useState(true)

  // Theme colors
  const bgColor = useColorModeValue('gray.50', 'gray.900')
  const cardBg = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.700')
  const accentColor = 'purple.500'
  const gradientBg = useColorModeValue(
    'linear(to-br, purple.400, pink.400)',
    'linear(to-br, purple.600, pink.600)'
  )

  useEffect(() => {
    fetchPricing()
  }, [])

  const fetchPricing = async () => {
    try {
      const data = await getSubscriptionPricing()
      setPricing(data)
    } catch (error) {
      console.error('Failed to fetch pricing:', error)
      toast({
        title: 'Error',
        description: 'Failed to load pricing information',
        status: 'error',
        duration: 5000,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async (priceId) => {
    setCheckoutLoading(true)
    try {
      const successUrl = `${window.location.origin}/subscription?success=true`
      const cancelUrl = `${window.location.origin}/subscription?canceled=true`
      
      const result = await createCheckoutSession(priceId, successUrl, cancelUrl)
      
      // Redirect to Stripe Checkout
      window.location.href = result.checkout_url
    } catch (error) {
      console.error('Failed to create checkout session:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to start checkout',
        status: 'error',
        duration: 5000,
      })
      setCheckoutLoading(false)
    }
  }

  const handleManageSubscription = async () => {
    setCheckoutLoading(true)
    try {
      const returnUrl = `${window.location.origin}/subscription`
      const result = await createPortalSession(returnUrl)
      
      // Redirect to Stripe Customer Portal
      window.location.href = result.portal_url
    } catch (error) {
      console.error('Failed to create portal session:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to open subscription management',
        status: 'error',
        duration: 5000,
      })
      setCheckoutLoading(false)
    }
  }

  // Check for success/cancel URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true') {
      toast({
        title: 'Subscription Activated! 🎉',
        description: 'Welcome to the Basic plan! Your account has been upgraded.',
        status: 'success',
        duration: 8000,
        isClosable: true,
      })
      // Clean URL
      window.history.replaceState({}, '', '/subscription')
    } else if (params.get('canceled') === 'true') {
      toast({
        title: 'Checkout Canceled',
        description: 'No changes were made to your subscription.',
        status: 'info',
        duration: 5000,
        isClosable: true,
      })
      // Clean URL
      window.history.replaceState({}, '', '/subscription')
    }
  }, [toast])

  if (loading || subscriptionLoading) {
    return (
      <Center h="100vh" bg={bgColor}>
        <VStack spacing={4}>
          <Spinner size="xl" color={accentColor} thickness="4px" />
          <Text color="gray.500">Loading subscription details...</Text>
        </VStack>
      </Center>
    )
  }

  const effectiveTier = getEffectiveTier()
  const hasActiveSubscription = subscription?.stripe_subscription_id && subscription?.status === 'active'

  return (
    <Box bg={bgColor} minH="100vh" py={8}>
      <Container maxW="container.lg">
        <VStack spacing={8} align="stretch">
          {/* Header */}
          <Box>
            <Button
              leftIcon={<ArrowLeft size={20} />}
              variant="ghost"
              onClick={() => navigate(-1)}
              mb={4}
            >
              Back
            </Button>
            
            <VStack spacing={2} textAlign="center">
              <Heading size="2xl" bgGradient={gradientBg} bgClip="text">
                Choose Your Plan
              </Heading>
              <Text color="gray.500" fontSize="lg" maxW="600px">
                Unlock the full potential of your homeschool journey with our premium features
              </Text>
            </VStack>
          </Box>

          {/* Current Status */}
          {isGrandfathered() && (
            <Box
              bg="green.50"
              border="2px solid"
              borderColor="green.200"
              borderRadius="xl"
              p={6}
              textAlign="center"
            >
            <HStack justify="center" spacing={2} mb={2}>
              <Icon as={Award} color="green.500" />
              <Badge colorScheme="green" fontSize="md" px={3} py={1}>
                Grandfathered Account
              </Badge>
            </HStack>
              <Text color="green.700">
                You have free lifetime access to all Basic features as an early supporter! Thank you! 💚
              </Text>
            </Box>
          )}

          {/* Usage Stats */}
          {usage && (
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
              <Box bg={cardBg} p={4} borderRadius="lg" border="1px" borderColor={borderColor}>
                <Text color="gray.500" fontSize="sm">Students</Text>
                <HStack justify="space-between" align="baseline">
                  <Text fontSize="2xl" fontWeight="bold">
                    {usage.student_count} / {usage.max_students}
                  </Text>
                  <Text color="gray.400" fontSize="sm">
                    {usage.students_remaining} remaining
                  </Text>
                </HStack>
              </Box>
              <Box bg={cardBg} p={4} borderRadius="lg" border="1px" borderColor={borderColor}>
                <Text color="gray.500" fontSize="sm">Evidence Uploads</Text>
                <HStack justify="space-between" align="baseline">
                  <Text fontSize="2xl" fontWeight="bold">
                    {usage.evidence_count} / {usage.max_evidence}
                  </Text>
                  <Text color="gray.400" fontSize="sm">
                    {usage.evidence_remaining} remaining
                  </Text>
                </HStack>
              </Box>
              <Box bg={cardBg} p={4} borderRadius="lg" border="1px" borderColor={borderColor}>
                <Text color="gray.500" fontSize="sm">Report Generation</Text>
                <HStack justify="space-between" align="baseline">
                  <Text fontSize="2xl" fontWeight="bold">
                    {usage.can_generate_reports ? 'Enabled' : 'Disabled'}
                  </Text>
                  <Badge colorScheme={usage.can_generate_reports ? 'green' : 'gray'}>
                    {usage.can_generate_reports ? 'Active' : 'Upgrade'}
                  </Badge>
                </HStack>
              </Box>
            </SimpleGrid>
          )}

          {/* Billing Toggle */}
          <FormControl display="flex" alignItems="center" justifyContent="center">
            <FormLabel htmlFor="billing-toggle" mb="0" color="gray.500">
              Monthly
            </FormLabel>
            <Switch
              id="billing-toggle"
              isChecked={isAnnual}
              onChange={(e) => setIsAnnual(e.target.checked)}
              colorScheme="purple"
              size="lg"
            />
            <FormLabel htmlFor="billing-toggle" mb="0" ml={2} color="gray.500">
              Annual
            </FormLabel>
            <Badge colorScheme="green" ml={2}>Save 10%</Badge>
          </FormControl>

          {/* Pricing Cards */}
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8}>
            {/* Free Tier */}
            <Box
              bg={cardBg}
              borderRadius="2xl"
              border="2px"
              borderColor={effectiveTier === 'free' && !isGrandfathered() ? accentColor : borderColor}
              p={8}
              position="relative"
              overflow="hidden"
            >
              {effectiveTier === 'free' && !isGrandfathered() && (
                <Badge
                  position="absolute"
                  top={4}
                  right={4}
                  colorScheme="purple"
                  fontSize="sm"
                >
                  Current Plan
                </Badge>
              )}
              
              <VStack spacing={6} align="stretch">
                <Box>
                  <HStack mb={2}>
                    <Icon as={Star} color="gray.400" />
                    <Heading size="lg">Free</Heading>
                  </HStack>
                  <HStack align="baseline">
                    <Text fontSize="4xl" fontWeight="bold">$0</Text>
                    <Text color="gray.500">/month</Text>
                  </HStack>
                  <Text color="gray.500" mt={2}>
                    Perfect for getting started
                  </Text>
                </Box>

                <List spacing={3}>
                  <ListItem>
                    <ListIcon as={Check} color="green.500" />
                    1 student profile
                  </ListItem>
                  <ListItem>
                    <ListIcon as={Check} color="green.500" />
                    15 evidence uploads
                  </ListItem>
                  <ListItem>
                    <ListIcon as={Check} color="green.500" />
                    Progress tracking
                  </ListItem>
                  <ListItem>
                    <ListIcon as={Check} color="green.500" />
                    Curriculum alignment
                  </ListItem>
                  <ListItem color="gray.400">
                    <ListIcon as={X} color="gray.400" />
                    Report generation
                  </ListItem>
                </List>

                <Button
                  variant="outline"
                  size="lg"
                  isDisabled={effectiveTier === 'free' || isGrandfathered()}
                >
                  {effectiveTier === 'free' && !isGrandfathered() ? 'Current Plan' : 'Free Forever'}
                </Button>
              </VStack>
            </Box>

            {/* Basic Tier */}
            <Box
              bg={cardBg}
              borderRadius="2xl"
              border="2px"
              borderColor={effectiveTier === 'basic' ? accentColor : borderColor}
              p={8}
              position="relative"
              overflow="hidden"
              boxShadow={effectiveTier !== 'basic' ? '0 4px 20px rgba(128, 90, 213, 0.15)' : 'none'}
            >
              {effectiveTier === 'basic' && (
                <Badge
                  position="absolute"
                  top={4}
                  right={4}
                  colorScheme="purple"
                  fontSize="sm"
                >
                  Current Plan
                </Badge>
              )}
              
              {effectiveTier !== 'basic' && (
                <Badge
                  position="absolute"
                  top={4}
                  right={4}
                  bgGradient={gradientBg}
                  color="white"
                  fontSize="sm"
                >
                  Popular
                </Badge>
              )}
              
              <VStack spacing={6} align="stretch">
                <Box>
                  <HStack mb={2}>
                    <Icon as={Zap} color="purple.500" />
                    <Heading size="lg">Basic</Heading>
                  </HStack>
                  <HStack align="baseline">
                    <Text fontSize="4xl" fontWeight="bold">
                      ${isAnnual ? '9' : '10'}
                    </Text>
                    <Text color="gray.500">/month</Text>
                    {isAnnual && (
                      <Badge colorScheme="green" ml={2}>
                        $108/year
                      </Badge>
                    )}
                  </HStack>
                  {!hasActiveSubscription && !isGrandfathered() && (
                    <Badge colorScheme="purple" fontSize="sm" mt={2}>
                      14-day free trial
                    </Badge>
                  )}
                  <Text color="gray.500" mt={2}>
                    Everything you need for homeschooling
                  </Text>
                </Box>

                <List spacing={3}>
                  <ListItem>
                    <ListIcon as={Check} color="green.500" />
                    <strong>3</strong> student profiles
                  </ListItem>
                  <ListItem>
                    <ListIcon as={Check} color="green.500" />
                    <strong>1,000</strong> evidence uploads
                  </ListItem>
                  <ListItem>
                    <ListIcon as={Check} color="green.500" />
                    <strong>Full</strong> report generation
                  </ListItem>
                  <ListItem>
                    <ListIcon as={Check} color="green.500" />
                    Progress tracking
                  </ListItem>
                  <ListItem>
                    <ListIcon as={Check} color="green.500" />
                    Curriculum alignment
                  </ListItem>
                  <ListItem>
                    <ListIcon as={Check} color="green.500" />
                    Priority support
                  </ListItem>
                </List>

                {isGrandfathered() ? (
                  <Button
                    size="lg"
                    bgGradient={gradientBg}
                    color="white"
                    _hover={{ opacity: 0.9 }}
                    isDisabled
                  >
                    Included Free (Grandfathered)
                  </Button>
                ) : hasActiveSubscription ? (
                  <Button
                    size="lg"
                    variant="outline"
                    colorScheme="purple"
                    onClick={handleManageSubscription}
                    isLoading={checkoutLoading}
                  >
                    Manage Subscription
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    bgGradient={gradientBg}
                    color="white"
                    _hover={{ opacity: 0.9 }}
                    onClick={() => handleUpgrade(
                      isAnnual ? pricing?.annual_price_id : pricing?.monthly_price_id
                    )}
                    isLoading={checkoutLoading}
                  >
                    Upgrade Now
                  </Button>
                )}
              </VStack>
            </Box>
          </SimpleGrid>

          {/* Manage Subscription for existing subscribers */}
          {hasActiveSubscription && !isGrandfathered() && (
            <Box textAlign="center">
              <Text color="gray.500" mb={2}>
                Need to update payment method, change plans, or cancel?
              </Text>
              <Button
                variant="link"
                colorScheme="purple"
                onClick={handleManageSubscription}
                isLoading={checkoutLoading}
              >
                Open Subscription Portal →
              </Button>
            </Box>
          )}

          {/* FAQ Section */}
          <Box pt={8}>
            <Heading size="md" mb={4} textAlign="center">
              Frequently Asked Questions
            </Heading>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
              <Box bg={cardBg} p={6} borderRadius="lg" border="1px" borderColor={borderColor}>
                <Text fontWeight="bold" mb={2}>How does the free trial work?</Text>
                <Text color="gray.500">
                  Start with a 14-day free trial of Basic plan. No payment required upfront. Add your payment method anytime during the trial to continue after it ends.
                </Text>
              </Box>
              <Box bg={cardBg} p={6} borderRadius="lg" border="1px" borderColor={borderColor}>
                <Text fontWeight="bold" mb={2}>Can I cancel anytime?</Text>
                <Text color="gray.500">
                  Yes! You can cancel your subscription at any time. You'll keep access until the end of your billing period.
                </Text>
              </Box>
              <Box bg={cardBg} p={6} borderRadius="lg" border="1px" borderColor={borderColor}>
                <Text fontWeight="bold" mb={2}>What happens to my data if I downgrade?</Text>
                <Text color="gray.500">
                  Your data is safe! You'll still be able to view everything, but you won't be able to add more students or evidence beyond free tier limits.
                </Text>
              </Box>
              <Box bg={cardBg} p={6} borderRadius="lg" border="1px" borderColor={borderColor}>
                <Text fontWeight="bold" mb={2}>Is there a family plan?</Text>
                <Text color="gray.500">
                  The Basic plan supports up to 3 students, which works great for most homeschool families. Contact us if you need more!
                </Text>
              </Box>
              <Box bg={cardBg} p={6} borderRadius="lg" border="1px" borderColor={borderColor}>
                <Text fontWeight="bold" mb={2}>What payment methods do you accept?</Text>
                <Text color="gray.500">
                  We accept all major credit cards, debit cards, and other payment methods through Stripe's secure payment processing.
                </Text>
              </Box>
            </SimpleGrid>
          </Box>
        </VStack>
      </Container>
    </Box>
  )
}

export default SubscriptionPage
