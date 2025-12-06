import { useState, useEffect } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  Select,
  Switch,
  VStack,
  HStack,
  Divider,
  Text,
  useToast,
  Box,
  Badge,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from '@chakra-ui/react'
import { adminUpdateUserProfile, adminUpdateUserSubscription } from '../../services/api'

const UserEditModal = ({ isOpen, onClose, user, onSave }) => {
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    role: '',
    is_verified: false,
  })

  // Subscription form state
  const [subscriptionForm, setSubscriptionForm] = useState({
    subscription_tier: '',
    is_grandfathered: false,
    subscription_status: '',
  })

  // Initialize forms when user changes
  useEffect(() => {
    if (user) {
      setProfileForm({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        role: user.role || 'parent',
        is_verified: user.is_verified || false,
      })
      setSubscriptionForm({
        subscription_tier: user.subscription_tier || 'free',
        is_grandfathered: user.is_grandfathered || false,
        subscription_status: user.subscription_status || 'active',
      })
    }
  }, [user])

  const handleProfileChange = (field, value) => {
    setProfileForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubscriptionChange = (field, value) => {
    setSubscriptionForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSaveProfile = async () => {
    setLoading(true)
    try {
      // Only send changed fields
      const updates = {}
      if (profileForm.first_name !== user.first_name) updates.first_name = profileForm.first_name
      if (profileForm.last_name !== user.last_name) updates.last_name = profileForm.last_name
      if (profileForm.email !== user.email) updates.email = profileForm.email
      if (profileForm.role !== user.role) updates.role = profileForm.role
      if (profileForm.is_verified !== user.is_verified) updates.is_verified = profileForm.is_verified

      if (Object.keys(updates).length === 0) {
        toast({
          title: 'No changes',
          description: 'No profile fields were modified',
          status: 'info',
          duration: 3000,
        })
        return
      }

      await adminUpdateUserProfile(user.id, updates)
      toast({
        title: 'Profile updated',
        description: 'User profile has been updated successfully',
        status: 'success',
        duration: 3000,
      })
      onSave()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || error.message,
        status: 'error',
        duration: 5000,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSubscription = async () => {
    setLoading(true)
    try {
      // Only send changed fields
      const updates = {}
      if (subscriptionForm.subscription_tier !== user.subscription_tier) {
        updates.subscription_tier = subscriptionForm.subscription_tier
      }
      if (subscriptionForm.is_grandfathered !== user.is_grandfathered) {
        updates.is_grandfathered = subscriptionForm.is_grandfathered
      }
      if (subscriptionForm.subscription_status !== user.subscription_status) {
        updates.subscription_status = subscriptionForm.subscription_status
      }

      if (Object.keys(updates).length === 0) {
        toast({
          title: 'No changes',
          description: 'No subscription fields were modified',
          status: 'info',
          duration: 3000,
        })
        return
      }

      await adminUpdateUserSubscription(user.id, updates)
      toast({
        title: 'Subscription updated',
        description: 'User subscription has been updated successfully',
        status: 'success',
        duration: 3000,
      })
      onSave()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || error.message,
        status: 'error',
        duration: 5000,
      })
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          Edit User
          <Text fontSize="sm" fontWeight="normal" color="gray.500">
            {user.email}
          </Text>
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <Tabs colorScheme="purple">
            <TabList>
              <Tab>Profile</Tab>
              <Tab>Subscription</Tab>
            </TabList>

            <TabPanels>
              {/* Profile Tab */}
              <TabPanel>
                <VStack spacing={4} align="stretch">
                  <HStack spacing={4}>
                    <FormControl>
                      <FormLabel>First Name</FormLabel>
                      <Input
                        value={profileForm.first_name}
                        onChange={(e) => handleProfileChange('first_name', e.target.value)}
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Last Name</FormLabel>
                      <Input
                        value={profileForm.last_name}
                        onChange={(e) => handleProfileChange('last_name', e.target.value)}
                      />
                    </FormControl>
                  </HStack>

                  <FormControl>
                    <FormLabel>Email</FormLabel>
                    <Input
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => handleProfileChange('email', e.target.value)}
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Role</FormLabel>
                    <Select
                      value={profileForm.role}
                      onChange={(e) => handleProfileChange('role', e.target.value)}
                    >
                      <option value="parent">Parent</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </Select>
                    {profileForm.role === 'super_admin' && (
                      <Text fontSize="xs" color="red.500" mt={1}>
                        Warning: Super Admin has full platform access
                      </Text>
                    )}
                  </FormControl>

                  <FormControl display="flex" alignItems="center">
                    <FormLabel mb="0">Email Verified</FormLabel>
                    <Switch
                      isChecked={profileForm.is_verified}
                      onChange={(e) => handleProfileChange('is_verified', e.target.checked)}
                      colorScheme="green"
                    />
                  </FormControl>

                  <Button
                    colorScheme="purple"
                    onClick={handleSaveProfile}
                    isLoading={loading}
                  >
                    Save Profile Changes
                  </Button>
                </VStack>
              </TabPanel>

              {/* Subscription Tab */}
              <TabPanel>
                <VStack spacing={4} align="stretch">
                  <Box p={3} bg="yellow.50" borderRadius="md" borderWidth="1px" borderColor="yellow.200">
                    <Text fontSize="sm" color="yellow.800">
                      <strong>Note:</strong> Changes here bypass Stripe. Use with caution.
                    </Text>
                  </Box>

                  <FormControl>
                    <FormLabel>Subscription Tier</FormLabel>
                    <Select
                      value={subscriptionForm.subscription_tier}
                      onChange={(e) => handleSubscriptionChange('subscription_tier', e.target.value)}
                    >
                      <option value="free">Free</option>
                      <option value="basic">Basic</option>
                    </Select>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Subscription Status</FormLabel>
                    <Select
                      value={subscriptionForm.subscription_status}
                      onChange={(e) => handleSubscriptionChange('subscription_status', e.target.value)}
                    >
                      <option value="active">Active</option>
                      <option value="canceled">Canceled</option>
                      <option value="past_due">Past Due</option>
                      <option value="incomplete">Incomplete</option>
                      <option value="trialing">Trialing</option>
                    </Select>
                  </FormControl>

                  <FormControl display="flex" alignItems="center">
                    <FormLabel mb="0">
                      Grandfathered
                      <Text as="span" fontSize="xs" color="gray.500" ml={2}>
                        (Free Basic tier access)
                      </Text>
                    </FormLabel>
                    <Switch
                      isChecked={subscriptionForm.is_grandfathered}
                      onChange={(e) => handleSubscriptionChange('is_grandfathered', e.target.checked)}
                      colorScheme="yellow"
                    />
                  </FormControl>

                  {user.stripe_customer_id && (
                    <Box>
                      <Text fontSize="sm" color="gray.500">
                        Stripe Customer ID: {user.stripe_customer_id}
                      </Text>
                    </Box>
                  )}

                  <Button
                    colorScheme="purple"
                    onClick={handleSaveSubscription}
                    isLoading={loading}
                  >
                    Save Subscription Changes
                  </Button>
                </VStack>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default UserEditModal
