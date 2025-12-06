import { useState, useEffect } from 'react'
import {
  Box,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Spinner,
  Text,
  VStack,
  HStack,
  Badge,
  Divider,
  useToast,
} from '@chakra-ui/react'
import { Users, BookOpen, FileText, Star } from 'react-feather'
import { adminGetPlatformStats } from '../../services/api'

const StatCard = ({ icon: Icon, label, value, helpText, color = 'purple' }) => (
  <Box
    p={5}
    bg="white"
    borderRadius="lg"
    borderWidth="1px"
    borderColor="gray.200"
    boxShadow="sm"
  >
    <HStack spacing={4}>
      <Box
        p={3}
        bg={`${color}.100`}
        borderRadius="lg"
        color={`${color}.600`}
      >
        <Icon size={24} />
      </Box>
      <Stat>
        <StatLabel color="gray.500">{label}</StatLabel>
        <StatNumber fontSize="2xl">{value}</StatNumber>
        {helpText && <StatHelpText>{helpText}</StatHelpText>}
      </Stat>
    </HStack>
  </Box>
)

const PlatformStats = () => {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await adminGetPlatformStats()
        setStats(data)
      } catch (error) {
        console.error('Admin Platform Stats Error:', error)
        const errorMessage = error.response?.data?.detail || error.message || 'Unknown error occurred'
        toast({
          title: 'Error loading stats',
          description: errorMessage,
          status: 'error',
          duration: 5000,
        })
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [toast])

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="lg" />
        <Text mt={2} color="gray.500">Loading platform statistics...</Text>
      </Box>
    )
  }

  if (!stats) {
    return (
      <Box textAlign="center" py={10}>
        <Text color="gray.500">Unable to load statistics</Text>
      </Box>
    )
  }

  return (
    <VStack spacing={6} align="stretch">
      {/* Main Stats */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
        <StatCard
          icon={Users}
          label="Total Users"
          value={stats.users.total}
          helpText={`${stats.users.active} active`}
          color="blue"
        />
        <StatCard
          icon={BookOpen}
          label="Total Students"
          value={stats.students.total}
          color="green"
        />
        <StatCard
          icon={FileText}
          label="Evidence Uploads"
          value={stats.evidence.total}
          color="purple"
        />
        <StatCard
          icon={Star}
          label="Paid Subscribers"
          value={stats.subscriptions.basic}
          helpText={`${stats.subscriptions.grandfathered} grandfathered`}
          color="yellow"
        />
      </SimpleGrid>

      <Divider />

      {/* Users by Role */}
      <Box
        p={5}
        bg="white"
        borderRadius="lg"
        borderWidth="1px"
        borderColor="gray.200"
      >
        <Text fontWeight="bold" mb={4}>Users by Role</Text>
        <HStack spacing={6} wrap="wrap">
          <HStack>
            <Badge colorScheme="blue" fontSize="md" px={3} py={1}>
              {stats.users.by_role.parent || 0}
            </Badge>
            <Text>Parents</Text>
          </HStack>
          <HStack>
            <Badge colorScheme="purple" fontSize="md" px={3} py={1}>
              {stats.users.by_role.admin || 0}
            </Badge>
            <Text>Admins</Text>
          </HStack>
          <HStack>
            <Badge colorScheme="red" fontSize="md" px={3} py={1}>
              {stats.users.by_role.super_admin || 0}
            </Badge>
            <Text>Super Admins</Text>
          </HStack>
        </HStack>
      </Box>

      {/* Subscription Breakdown */}
      <Box
        p={5}
        bg="white"
        borderRadius="lg"
        borderWidth="1px"
        borderColor="gray.200"
      >
        <Text fontWeight="bold" mb={4}>Subscription Breakdown</Text>
        <HStack spacing={6} wrap="wrap">
          <HStack>
            <Badge colorScheme="gray" fontSize="md" px={3} py={1}>
              {stats.subscriptions.free}
            </Badge>
            <Text>Free Tier</Text>
          </HStack>
          <HStack>
            <Badge colorScheme="green" fontSize="md" px={3} py={1}>
              {stats.subscriptions.basic}
            </Badge>
            <Text>Basic Tier</Text>
          </HStack>
          <HStack>
            <Badge colorScheme="yellow" fontSize="md" px={3} py={1}>
              {stats.subscriptions.grandfathered}
            </Badge>
            <Text>Grandfathered</Text>
          </HStack>
        </HStack>
      </Box>
    </VStack>
  )
}

export default PlatformStats
