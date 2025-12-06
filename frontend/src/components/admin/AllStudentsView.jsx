import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  VStack,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Text,
  Spinner,
  Button,
  IconButton,
  Badge,
  useToast,
  Flex,
  Avatar,
} from '@chakra-ui/react'
import { Search, RefreshCw, Users, ExternalLink } from 'react-feather'
import { useNavigate } from 'react-router-dom'
import { adminListAllStudents } from '../../services/api'

const AllStudentsView = () => {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [pagination, setPagination] = useState({ skip: 0, limit: 20, total: 0 })
  
  const toast = useToast()
  const navigate = useNavigate()

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        skip: pagination.skip,
        limit: pagination.limit,
      }
      if (searchTerm) params.search = searchTerm

      const result = await adminListAllStudents(params)
      setStudents(result.students)
      setPagination(prev => ({ ...prev, total: result.total }))
    } catch (error) {
      console.error('Admin List Students Error:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error occurred'
      toast({
        title: 'Error loading students',
        description: errorMessage,
        status: 'error',
        duration: 5000,
      })
    } finally {
      setLoading(false)
    }
  }, [pagination.skip, pagination.limit, searchTerm, toast])

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchStudents()
    }, 300)
    return () => clearTimeout(debounce)
  }, [fetchStudents])

  const handleSearch = (e) => {
    setSearchTerm(e.target.value)
    setPagination(prev => ({ ...prev, skip: 0 }))
  }

  const handleViewStudent = (student) => {
    // Navigate to the student's progress page
    const identifier = student.slug || student.id
    navigate(`/students/${identifier}/progress`)
  }

  const getGradeBadgeColor = (grade) => {
    if (!grade) return 'gray'
    if (grade.includes('Early')) return 'pink'
    if (grade.includes('1')) return 'orange'
    if (grade.includes('2')) return 'yellow'
    if (grade.includes('3')) return 'green'
    if (grade.includes('4')) return 'teal'
    if (grade.includes('5')) return 'blue'
    if (grade.includes('6')) return 'purple'
    return 'gray'
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit)
  const currentPage = Math.floor(pagination.skip / pagination.limit) + 1

  return (
    <Box>
      <VStack spacing={4} align="stretch">
        {/* Search and Actions */}
        <Flex gap={4} wrap="wrap">
          <InputGroup maxW="300px">
            <InputLeftElement pointerEvents="none">
              <Search size={18} color="gray" />
            </InputLeftElement>
            <Input
              placeholder="Search by name..."
              value={searchTerm}
              onChange={handleSearch}
            />
          </InputGroup>

          <IconButton
            icon={<RefreshCw size={18} />}
            onClick={fetchStudents}
            aria-label="Refresh"
            variant="outline"
          />
        </Flex>

        {/* Stats */}
        <HStack spacing={4}>
          <HStack>
            <Users size={16} />
            <Text fontSize="sm" color="gray.600">
              {pagination.total} student{pagination.total !== 1 ? 's' : ''} in the system
            </Text>
          </HStack>
        </HStack>

        {/* Table */}
        {loading ? (
          <Flex justify="center" py={10}>
            <Spinner size="lg" />
          </Flex>
        ) : students.length === 0 ? (
          <Box textAlign="center" py={10}>
            <Text color="gray.500">No students found</Text>
          </Box>
        ) : (
          <Box overflowX="auto">
            <Table variant="simple" size="sm">
              <Thead>
                <Tr>
                  <Th>Student</Th>
                  <Th>Grade Level</Th>
                  <Th>Gender</Th>
                  <Th>Parents</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {students.map((student) => (
                  <Tr key={student.id}>
                    <Td>
                      <HStack>
                        <Avatar 
                          size="sm" 
                          name={`${student.first_name} ${student.last_name}`}
                          src={student.avatar_thumbnail_url}
                        />
                        <VStack align="start" spacing={0}>
                          <Text fontWeight="medium">
                            {student.first_name} {student.last_name}
                          </Text>
                          {student.slug && (
                            <Text fontSize="xs" color="gray.500">
                              /{student.slug}
                            </Text>
                          )}
                        </VStack>
                      </HStack>
                    </Td>
                    <Td>
                      <Badge colorScheme={getGradeBadgeColor(student.grade_level)}>
                        {student.grade_level || 'Not set'}
                      </Badge>
                    </Td>
                    <Td>
                      <Text textTransform="capitalize">
                        {student.gender || '-'}
                      </Text>
                    </Td>
                    <Td>
                      <Badge colorScheme="blue">
                        {(student.parent_access?.length || student.parent_ids?.length || 0)} parent(s)
                      </Badge>
                    </Td>
                    <Td>
                      <Button
                        size="sm"
                        leftIcon={<ExternalLink size={14} />}
                        variant="outline"
                        onClick={() => handleViewStudent(student)}
                      >
                        View
                      </Button>
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
    </Box>
  )
}

export default AllStudentsView
