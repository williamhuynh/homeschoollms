import { useNavigate, useParams } from 'react-router-dom'
import { 
  Box, 
  Button, 
  Text, 
  VStack, 
  Heading, 
  Container, 
  Spinner, 
  Center,
  HStack,
  Badge,
  useToast,
  IconButton,
  Progress,
  Divider
} from '@chakra-ui/react'
import { ArrowLeft, Calendar, Clock } from 'react-feather'
import { useEffect, useState } from 'react'
import { getReportById, getStudentBySlug } from '../../services/api'
import LearningAreaSummaryCard from '../../components/reports/LearningAreaSummaryCard'
import ReportExporter from '../../components/reports/ReportExporter'

const ReportViewPage = () => {
  const navigate = useNavigate()
  const { studentId, reportId } = useParams()
  const toast = useToast()
  
  const [report, setReport] = useState(null)
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)

  function getReportIdFromState(r) {
    if (!r) return ''
    const raw = r.id ?? r._id
    if (!raw) return ''
    if (typeof raw === 'string') return raw
    if (typeof raw === 'object' && raw !== null) return raw.$oid || String(raw)
    return String(raw)
  }

  useEffect(() => {
    fetchReportData()
  }, [studentId, reportId])

  const fetchReportData = async () => {
    try {
      setLoading(true)
      const [reportData, studentData] = await Promise.all([
        getReportById(studentId, reportId),
        getStudentBySlug(studentId)
      ])
      setReport(reportData)
      setStudent(studentData)
    } catch (error) {
      console.error('Error fetching report:', error)
      toast({
        title: 'Error loading report',
        description: error.message || 'Failed to load report',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setLoading(false)
    }
  }

  const formatReportPeriod = (period, customName) => {
    if (period === 'custom' && customName) {
      return customName
    }
    const periodMap = {
      'annual': 'Annual Report',
      'term_1': 'Term 1 Report',
      'term_2': 'Term 2 Report',
      'term_3': 'Term 3 Report',
      'term_4': 'Term 4 Report'
    }
    return periodMap[period] || period
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatDuration = (seconds) => {
    if (!seconds) return null
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}m ${remainingSeconds}s`
  }

  const handleSummaryUpdate = (updatedSummary) => {
    // Update the report state with the updated summary
    setReport(prevReport => ({
      ...prevReport,
      learning_area_summaries: prevReport.learning_area_summaries.map(summary =>
        summary.learning_area_code === updatedSummary.learning_area_code
          ? updatedSummary
          : summary
      )
    }))
  }

  if (loading) {
    return (
      <Container maxW="container.md" py={8} pb="80px">
        <Center p={8}>
          <VStack spacing={4}>
            <Spinner size="xl" color="blue.500" />
            <Text color="gray.600">Loading report...</Text>
          </VStack>
        </Center>
      </Container>
    )
  }

  if (!report) {
    return (
      <Container maxW="container.md" py={8} pb="80px">
        <Center p={8}>
          <VStack spacing={4}>
            <Text color="gray.600">Report not found</Text>
            <Button onClick={() => navigate(`/students/${studentId}/reports`)}>
              Back to Reports
            </Button>
          </VStack>
        </Center>
      </Container>
    )
  }

  return (
    <Container maxW="container.md" py={4} pb="80px">
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <HStack spacing={4}>
          <IconButton
            icon={<ArrowLeft />}
            variant="ghost"
            onClick={() => navigate(`/students/${studentId}/reports`)}
            aria-label="Back to reports"
          />
          <VStack align="start" flex={1} spacing={0}>
            <Heading size="lg">
              {formatReportPeriod(report.report_period, report.custom_period_name)}
            </Heading>
            {student && (
              <Text color="gray.600" fontSize="sm">
                {student.first_name} {student.last_name} • {student.grade_level} • {report.academic_year}
              </Text>
            )}
          </VStack>
          <HStack>
            <ReportExporter 
              report={report} 
              student={student}
            />
            <Badge 
              colorScheme={report.status === 'published' ? 'green' : 'orange'}
              size="lg"
              px={3}
              py={1}
            >
              {report.status}
            </Badge>
          </HStack>
        </HStack>

        {/* Report Metadata */}
        <Box bg="gray.50" p={4} borderRadius="md">
          <HStack spacing={6} fontSize="sm" color="gray.600">
            <HStack>
              <Calendar size={16} />
              <Text>Generated: {formatDate(report.generated_at)}</Text>
            </HStack>
            {report.generation_time_seconds && (
              <HStack>
                <Clock size={16} />
                <Text>Generation time: {formatDuration(report.generation_time_seconds)}</Text>
              </HStack>
            )}
            <Text>
              {report.learning_area_summaries?.length || 0} Learning Areas
            </Text>
          </HStack>
        </Box>

        {/* Overall Progress Summary */}
        {report.learning_area_summaries?.length > 0 && (
          <Box bg="blue.50" p={4} borderRadius="md">
            <VStack align="stretch" spacing={2}>
              <Text fontWeight="medium" color="blue.800">
                Overall Progress Summary
              </Text>
              <HStack justify="space-between">
                <Text fontSize="sm" color="blue.700">
                  Total Evidence Collected
                </Text>
                <Text fontWeight="medium" color="blue.800">
                  {report.learning_area_summaries.reduce((acc, summary) => 
                    acc + summary.evidence_count, 0
                  )}
                </Text>
              </HStack>
              <HStack justify="space-between">
                <Text fontSize="sm" color="blue.700">
                  Learning Outcomes Achieved
                </Text>
                <Text fontWeight="medium" color="blue.800">
                  {report.learning_area_summaries.reduce((acc, summary) => 
                    acc + summary.outcomes_with_evidence, 0
                  )} / {report.learning_area_summaries.reduce((acc, summary) => 
                    acc + summary.total_outcomes, 0
                  )}
                </Text>
              </HStack>
            </VStack>
          </Box>
        )}

        <Divider />

        {/* Learning Area Summaries */}
        <VStack spacing={4} align="stretch">
          <Heading size="md">Learning Area Summaries</Heading>
          
          {report.learning_area_summaries?.length === 0 ? (
            <Box p={8} textAlign="center" color="gray.500">
              No learning area summaries generated yet.
            </Box>
          ) : (
            report.learning_area_summaries?.map((summary) => (
              <LearningAreaSummaryCard
                key={summary.learning_area_code}
                summary={summary}
                studentId={studentId}
                reportId={reportId}
                onUpdate={handleSummaryUpdate}
              />
            ))
          )}
        </VStack>
      </VStack>
    </Container>
  )
}

export default ReportViewPage 