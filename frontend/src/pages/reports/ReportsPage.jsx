import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { 
  Box, 
  Button, 
  Text, 
  VStack, 
  Heading, 
  Container, 
  Spinner, 
  Center,
  Card,
  CardBody,
  HStack,
  Badge,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Select,
  FormControl,
  FormLabel,
  Input,
  useDisclosure,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem
} from '@chakra-ui/react'
import { ArrowLeft, Plus, FileText, MoreVertical, Trash2, Eye } from 'react-feather'
import { useEffect, useState } from 'react'
import { getStudentReports, generateReport, deleteReport, getStudentBySlug } from '../../services/api'
import ReportGenerationProgress from '../../components/reports/ReportGenerationProgress'
import ErrorBoundary from '../../components/reports/ErrorBoundary'
import ReportTemplateSelector from '../../components/reports/ReportTemplateSelector'

const ReportsPage = () => {
  const navigate = useNavigate()
  const { studentId } = useParams()
  const location = useLocation()
  const toast = useToast()
  const { isOpen, onOpen, onClose } = useDisclosure()
  
  const [reports, setReports] = useState([])
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [formData, setFormData] = useState({
    academic_year: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
    report_period: 'annual',
    custom_period_name: '',
    template: 'standard',
    grade_level: ''
  })

  // Normalize various id shapes to a string
  function getReportId(report) {
    if (!report) return ''
    const raw = report.id ?? report._id
    if (!raw) return ''
    if (typeof raw === 'string') return raw
    if (typeof raw === 'object' && raw !== null) return raw.$oid || String(raw)
    return String(raw)
  }

  useEffect(() => {
    fetchReports()
    fetchStudent()
  }, [studentId])

  // Refresh reports when navigating back to this page (location.key changes on navigation)
  useEffect(() => {
    fetchReports()
  }, [location.key])

  const fetchStudent = async () => {
    try {
      const data = await getStudentBySlug(studentId)
      setStudent(data)
      // Default grade selection to the student's current grade if not already set
      setFormData(prev => ({ ...prev, grade_level: prev.grade_level || data?.grade_level || '' }))
    } catch (error) {
      console.error('Error fetching student:', error)
    }
  }

  const fetchReports = async () => {
    try {
      setLoading(true)
      const data = await getStudentReports(studentId)
      setReports(data)
    } catch (error) {
      console.error('Error fetching reports:', error)
      toast({
        title: 'Error loading reports',
        description: error.message || 'Failed to load reports',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateReport = async () => {
    try {
      setGenerating(true)
      const report = await generateReport(studentId, formData)
      toast({
        title: 'Report generated successfully',
        description: 'Your report has been created and is ready to view.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
      onClose()
      // Ensure we use the canonical string id when navigating
      const reportId = (typeof report.id === 'string' && report.id) || (report._id && (report._id.$oid || report._id)) || report.id
      navigate(`/students/${studentId}/reports/${reportId}`)
    } catch (error) {
      console.error('Error generating report:', error)
      toast({
        title: 'Error generating report',
        description: error.message || 'Failed to generate report',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleDeleteReport = async (reportOrId) => {
    if (!window.confirm('Are you sure you want to delete this report?')) {
      return
    }

    try {
      const id = typeof reportOrId === 'string' ? reportOrId : getReportId(reportOrId)
      await deleteReport(studentId, id)
      toast({
        title: 'Report deleted',
        status: 'success',
        duration: 2000,
        isClosable: true,
      })
      fetchReports()
    } catch (error) {
      console.error('Error deleting report:', error)
      toast({
        title: 'Error deleting report',
        description: error.message || 'Failed to delete report',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  const formatReportPeriod = (period, customName) => {
    if (period === 'custom' && customName) {
      return customName
    }
    const periodMap = {
      'annual': 'Annual Report',
      'term_1': 'Term 1',
      'term_2': 'Term 2',
      'term_3': 'Term 3',
      'term_4': 'Term 4',
      'custom': 'Custom Period'
    }
    return periodMap[period] || period
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <Container maxW="container.sm" py={8} pb="80px">
        <Center p={8}>
          <Spinner size="xl" color="blue.500" />
        </Center>
      </Container>
    )
  }

  return (
    <ErrorBoundary
      onRetry={fetchReports}
      onError={(error, errorInfo) => {
        console.error('Reports page error:', error, errorInfo)
      }}
    >
      <Container maxW="container.sm" py={4} pb="80px">
        <VStack spacing={4} align="stretch">
        {/* Header */}
        <HStack spacing={4} mb={2}>
          <IconButton
            icon={<ArrowLeft />}
            variant="ghost"
            onClick={() => navigate(`/students/${studentId}/progress`)}
            aria-label="Back"
          />
          <Heading size="lg" flex={1}>Reports</Heading>
          <Button
            leftIcon={<Plus />}
            colorScheme="blue"
            onClick={onOpen}
            size="sm"
          >
            Generate Report
          </Button>
        </HStack>

        {student && (
          <Text color="gray.600" fontSize="sm" px={2}>
            {student.first_name} {student.last_name} • {student.grade_level}
          </Text>
        )}

        {/* Reports List */}
        {reports.length === 0 ? (
          <Card>
            <CardBody>
              <VStack spacing={3} py={8}>
                <FileText size={48} color="#CBD5E0" />
                <Text color="gray.500" textAlign="center">
                  No reports generated yet
                </Text>
                <Button
                  colorScheme="blue"
                  onClick={onOpen}
                  size="sm"
                  leftIcon={<Plus />}
                >
                  Generate First Report
                </Button>
              </VStack>
            </CardBody>
          </Card>
        ) : (
          <VStack spacing={3}>
            {reports.map((report) => (
              <Card 
                key={report.id || report._id} 
                cursor="pointer"
                _hover={{ shadow: 'md' }}
                onClick={() => navigate(`/students/${studentId}/reports/${getReportId(report)}`)}
              >
                <CardBody>
                  <HStack justify="space-between">
                    <VStack align="start" spacing={1} flex={1}>
                      <HStack>
                        <Text fontWeight="medium">
                          {(report.title && report.title.trim()) || formatReportPeriod(report.report_period, report.custom_period_name)}
                        </Text>
                        <Badge 
                          colorScheme={report.status === 'published' ? 'green' : 'orange'}
                          size="sm"
                        >
                          {report.status}
                        </Badge>
                      </HStack>
                      <Text fontSize="sm" color="gray.600">
                        {report.academic_year} • Generated {formatDate(report.generated_at)}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {report.learning_area_summaries?.length || 0} learning areas
                      </Text>
                    </VStack>
                    <Menu>
                      <MenuButton
                        as={IconButton}
                        icon={<MoreVertical size={16} />}
                        variant="ghost"
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <MenuList>
                        <MenuItem 
                          icon={<Eye size={16} />}
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/students/${studentId}/reports/${getReportId(report)}`)
                          }}
                        >
                          View Report
                        </MenuItem>
                        <MenuItem 
                          icon={<Trash2 size={16} />}
                          color="red.500"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteReport(report)
                          }}
                        >
                          Delete Report
                        </MenuItem>
                      </MenuList>
                    </Menu>
                  </HStack>
                </CardBody>
              </Card>
            ))}
          </VStack>
        )}
      </VStack>

      {/* Generate Report Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Generate New Report</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Academic Year</FormLabel>
                <Input
                  value={formData.academic_year}
                  onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                  placeholder="e.g., 2024-2025"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Report Period</FormLabel>
                <Select
                  value={formData.report_period}
                  onChange={(e) => setFormData({ ...formData, report_period: e.target.value })}
                >
                  <option value="annual">Annual Report</option>
                  <option value="term_1" disabled>Term 1 (soon)</option>
                  <option value="term_2" disabled>Term 2 (soon)</option>
                  <option value="term_3" disabled>Term 3 (soon)</option>
                  <option value="term_4" disabled>Term 4 (soon)</option>
                  <option value="custom" disabled>Custom Period (soon)</option>
                </Select>
              </FormControl>

              {formData.report_period === 'custom' && (
                <FormControl isRequired>
                  <FormLabel>Custom Period Name</FormLabel>
                  <Input
                    value={formData.custom_period_name}
                    onChange={(e) => setFormData({ ...formData, custom_period_name: e.target.value })}
                    placeholder="e.g., Mid-Year Review"
                  />
                </FormControl>
              )}

              <FormControl isRequired>
                <FormLabel>Grade</FormLabel>
                <Select
                  value={formData.grade_level || ''}
                  onChange={(e) => setFormData({ ...formData, grade_level: e.target.value })}
                  placeholder={student?.grade_level ? `Current: ${student.grade_level}` : 'Select grade'}
                  isDisabled={generating}
                >
                  <option value="1">1st Grade</option>
                  <option value="2">2nd Grade</option>
                  <option value="3">3rd Grade</option>
                  <option value="4">4th Grade</option>
                  <option value="5">5th Grade</option>
                  <option value="6">6th Grade</option>
                  <option value="7">7th Grade</option>
                  <option value="8">8th Grade</option>
                  <option value="9">9th Grade</option>
                  <option value="10">10th Grade</option>
                  <option value="11">11th Grade</option>
                  <option value="12">12th Grade</option>
                </Select>
              </FormControl>

              <ReportTemplateSelector
                selectedTemplate={formData.template}
                onTemplateChange={(template) => setFormData({ ...formData, template })}
                disabled={generating}
              />
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleGenerateReport}
              isLoading={generating}
              loadingText="Generating..."
            >
              Generate Report
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

        {/* Report Generation Progress Modal */}
        <ReportGenerationProgress isOpen={generating} />
      </Container>
    </ErrorBoundary>
  )
}

export default ReportsPage 