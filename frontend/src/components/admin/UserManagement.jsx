import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  VStack,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Button,
  IconButton,
  Text,
  Spinner,
  useToast,
  useDisclosure,
  Flex,
  Tooltip,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from '@chakra-ui/react'
import { 
  Search, 
  Edit2, 
  UserX, 
  UserCheck, 
  Trash2, 
  MoreVertical,
  Users,
  RefreshCw,
  Eye
} from 'react-feather'
import { 
  adminListUsers, 
  adminDeactivateUser, 
  adminReactivateUser,
  adminImpersonate 
} from '../../services/api'
import UserEditModal from './UserEditModal'
import DeleteConfirmModal from './DeleteConfirmModal'

const UserManagement = ({ onImpersonate }) => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [pagination, setPagination] = useState({ skip: 0, limit: 20, total: 0 })
  const [selectedUser, setSelectedUser] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)
  
  const toast = useToast()
  const editModal = useDisclosure()
  const deleteModal = useDisclosure()

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        skip: pagination.skip,
        limit: pagination.limit,
      }
      if (searchTerm) params.search = searchTerm
      if (roleFilter) params.role = roleFilter
      if (tierFilter) params.subscription_tier = tierFilter
      if (statusFilter !== '') params.is_active = statusFilter === 'active'

      const result = await adminListUsers(params)
      setUsers(result.users)
      setPagination(prev => ({ ...prev, total: result.total }))
    } catch (error) {
      toast({
        title: 'Error loading users',
        description: error.message,
        status: 'error',
        duration: 5000,
      })
    } finally {
      setLoading(false)
    }
  }, [pagination.skip, pagination.limit, searchTerm, roleFilter, tierFilter, statusFilter, toast])

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchUsers()
    }, 300)
    return () => clearTimeout(debounce)
  }, [fetchUsers])

  const handleSearch = (e) => {
    setSearchTerm(e.target.value)
    setPagination(prev => ({ ...prev, skip: 0 }))
  }

  const handleEditUser = (user) => {
    setSelectedUser(user)
    editModal.onOpen()
  }

  const handleDeleteUser = (user) => {
    setSelectedUser(user)
    deleteModal.onOpen()
  }

  const handleToggleActive = async (user) => {
    setActionLoading(user.id)
    try {
      if (user.is_active) {
        await adminDeactivateUser(user.id)
        toast({
          title: 'User deactivated',
          description: `${user.email} has been deactivated`,
          status: 'success',
          duration: 3000,
        })
      } else {
        await adminReactivateUser(user.id)
        toast({
          title: 'User reactivated',
          description: `${user.email} has been reactivated`,
          status: 'success',
          duration: 3000,
        })
      }
      fetchUsers()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 5000,
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleImpersonate = async (user) => {
    setActionLoading(user.id)
    try {
      const result = await adminImpersonate(user.id)
      if (onImpersonate) {
        onImpersonate(result)
      }
      toast({
        title: 'Impersonation started',
        description: `Now viewing as ${user.email}`,
        status: 'info',
        duration: 5000,
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 5000,
      })
    } finally {
      setActionLoading(null)
    }
  }

  const getRoleBadge = (role) => {
    const colors = {
      parent: 'blue',
      admin: 'purple',
      super_admin: 'red'
    }
    const labels = {
      parent: 'Parent',
      admin: 'Admin',
      super_admin: 'Super Admin'
    }
    return (
      <Badge colorScheme={colors[role] || 'gray'}>
        {labels[role] || role}
      </Badge>
    )
  }

  const getTierBadge = (tier, isGrandfathered) => {
    if (isGrandfathered) {
      return <Badge colorScheme="yellow">Grandfathered</Badge>
    }
    return (
      <Badge colorScheme={tier === 'basic' ? 'green' : 'gray'}>
        {tier === 'basic' ? 'Basic' : 'Free'}
      </Badge>
    )
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit)
  const currentPage = Math.floor(pagination.skip / pagination.limit) + 1

  return (
    <Box>
      <VStack spacing={4} align="stretch">
        {/* Filters */}
        <Flex gap={4} wrap="wrap">
          <InputGroup maxW="300px">
            <InputLeftElement pointerEvents="none">
              <Search size={18} color="gray" />
            </InputLeftElement>
            <Input
              placeholder="Search by email or name..."
              value={searchTerm}
              onChange={handleSearch}
            />
          </InputGroup>

          <Select 
            placeholder="All Roles" 
            maxW="150px"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value)
              setPagination(prev => ({ ...prev, skip: 0 }))
            }}
          >
            <option value="parent">Parent</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
          </Select>

          <Select 
            placeholder="All Tiers" 
            maxW="150px"
            value={tierFilter}
            onChange={(e) => {
              setTierFilter(e.target.value)
              setPagination(prev => ({ ...prev, skip: 0 }))
            }}
          >
            <option value="free">Free</option>
            <option value="basic">Basic</option>
          </Select>

          <Select 
            placeholder="All Status" 
            maxW="150px"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPagination(prev => ({ ...prev, skip: 0 }))
            }}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>

          <IconButton
            icon={<RefreshCw size={18} />}
            onClick={fetchUsers}
            aria-label="Refresh"
            variant="outline"
          />
        </Flex>

        {/* Stats */}
        <HStack spacing={4}>
          <HStack>
            <Users size={16} />
            <Text fontSize="sm" color="gray.600">
              {pagination.total} user{pagination.total !== 1 ? 's' : ''} found
            </Text>
          </HStack>
        </HStack>

        {/* Table */}
        {loading ? (
          <Flex justify="center" py={10}>
            <Spinner size="lg" />
          </Flex>
        ) : users.length === 0 ? (
          <Box textAlign="center" py={10}>
            <Text color="gray.500">No users found</Text>
          </Box>
        ) : (
          <Box overflowX="auto">
            <Table variant="simple" size="sm">
              <Thead>
                <Tr>
                  <Th>User</Th>
                  <Th>Role</Th>
                  <Th>Tier</Th>
                  <Th>Status</Th>
                  <Th>Joined</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {users.map((user) => (
                  <Tr 
                    key={user.id} 
                    opacity={user.is_active ? 1 : 0.6}
                    bg={user.role === 'super_admin' ? 'red.50' : undefined}
                  >
                    <Td>
                      <VStack align="start" spacing={0}>
                        <Text fontWeight="medium">
                          {user.first_name} {user.last_name}
                        </Text>
                        <Text fontSize="sm" color="gray.500">
                          {user.email}
                        </Text>
                      </VStack>
                    </Td>
                    <Td>{getRoleBadge(user.role)}</Td>
                    <Td>{getTierBadge(user.subscription_tier, user.is_grandfathered)}</Td>
                    <Td>
                      <Badge colorScheme={user.is_active ? 'green' : 'red'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </Td>
                    <Td>
                      <Text fontSize="sm">
                        {user.created_at 
                          ? new Date(user.created_at).toLocaleDateString() 
                          : '-'}
                      </Text>
                    </Td>
                    <Td>
                      <Menu>
                        <MenuButton
                          as={IconButton}
                          icon={<MoreVertical size={16} />}
                          variant="ghost"
                          size="sm"
                          isLoading={actionLoading === user.id}
                        />
                        <MenuList>
                          <MenuItem 
                            icon={<Edit2 size={14} />}
                            onClick={() => handleEditUser(user)}
                          >
                            Edit User
                          </MenuItem>
                          <MenuItem 
                            icon={<Eye size={14} />}
                            onClick={() => handleImpersonate(user)}
                          >
                            Impersonate
                          </MenuItem>
                          <MenuItem 
                            icon={user.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                            onClick={() => handleToggleActive(user)}
                          >
                            {user.is_active ? 'Deactivate' : 'Reactivate'}
                          </MenuItem>
                          <MenuItem 
                            icon={<Trash2 size={14} />}
                            color="red.500"
                            onClick={() => handleDeleteUser(user)}
                          >
                            Delete User
                          </MenuItem>
                        </MenuList>
                      </Menu>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <HStack justify="center" spacing={4}>
            <Button
              size="sm"
              onClick={() => setPagination(prev => ({ 
                ...prev, 
                skip: Math.max(0, prev.skip - prev.limit) 
              }))}
              isDisabled={pagination.skip === 0}
            >
              Previous
            </Button>
            <Text fontSize="sm">
              Page {currentPage} of {totalPages}
            </Text>
            <Button
              size="sm"
              onClick={() => setPagination(prev => ({ 
                ...prev, 
                skip: prev.skip + prev.limit 
              }))}
              isDisabled={currentPage >= totalPages}
            >
              Next
            </Button>
          </HStack>
        )}
      </VStack>

      {/* Edit Modal */}
      {selectedUser && (
        <UserEditModal
          isOpen={editModal.isOpen}
          onClose={() => {
            editModal.onClose()
            setSelectedUser(null)
          }}
          user={selectedUser}
          onSave={() => {
            fetchUsers()
            editModal.onClose()
            setSelectedUser(null)
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {selectedUser && (
        <DeleteConfirmModal
          isOpen={deleteModal.isOpen}
          onClose={() => {
            deleteModal.onClose()
            setSelectedUser(null)
          }}
          user={selectedUser}
          onDeleted={() => {
            fetchUsers()
            deleteModal.onClose()
            setSelectedUser(null)
          }}
        />
      )}
    </Box>
  )
}

export default UserManagement
