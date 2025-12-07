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
  Divider,
  Input,
  Textarea,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider
} from '@chakra-ui/react'
import { ArrowLeft, Calendar, Clock, Check, Edit2, MoreVertical, RefreshCw, Save, X, Printer, Download, Share2 } from 'react-feather'
import { useEffect, useState } from 'react'
import { getReportById, getStudentBySlug, updateReportTitle, updateReportStatus, regenerateReport, updateReportOverview } from '../../services/api'
import LearningAreaSummaryCard from '../../components/reports/LearningAreaSummaryCard'
import ReportGenerationProgress from '../../components/reports/ReportGenerationProgress'
import { generatePrintableHTML } from '../../components/reports/exportUtils'
import { logger } from '../../utils/logger'

const ReportViewPage = () => {
  const navigate = useNavigate()
  const { studentId, reportId } = useParams()
  const toast = useToast()
  
  const [report, setReport] = useState(null)
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [editingOverview, setEditingOverview] = useState(false)
  const [overviewInput, setOverviewInput] = useState('')
  const [savingOverview, setSavingOverview] = useState(false)

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
      setTitleInput(reportData.title || '')
      setOverviewInput(reportData.parent_overview || reportData.ai_generated_overview || '')
    } catch (error) {
      logger.error('Error fetching report', error)
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

  const formatTime = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
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

  const handleSaveTitle = async () => {
    try {
      setSavingTitle(true)
      const updated = await updateReportTitle(studentId, reportId, titleInput.trim())
      setReport(updated)
      setEditingTitle(false)
      toast({ title: 'Title updated', status: 'success', duration: 1500, isClosable: true })
    } catch (error) {
      logger.error('Error updating title', error)
      toast({ title: 'Failed to update title', description: error.message, status: 'error' })
    } finally {
      setSavingTitle(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!report) return
    try {
      setUpdatingStatus(true)
      const target = report.status === 'submitted' ? 'draft' : 'submitted'
      logger.breadcrumb('reports', 'Toggling report status', { target })
      if (!studentId || !reportId) {
        logger.error('handleToggleStatus - Missing studentId or reportId')
        toast({ title: 'Error', description: 'Missing student or report ID', status: 'error' })
        return
      }
      const updated = await updateReportStatus(studentId, reportId, target)
      setReport(updated)
      const statusLabel = updated.status === 'submitted' ? 'Submitted' : 'Draft'
      toast({ title: `Marked as ${statusLabel}`, status: 'success', duration: 1500, isClosable: true })
    } catch (error) {
      logger.error('Error updating status', error)
      toast({ title: 'Failed to update status', description: error.response?.data?.detail || error.message, status: 'error' })
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleSaveOverview = async () => {
    try {
      setSavingOverview(true)
      const updated = await updateReportOverview(studentId, reportId, overviewInput.trim())
      setReport(updated)
      setEditingOverview(false)
      toast({ title: 'Overview updated', status: 'success', duration: 1500, isClosable: true })
    } catch (error) {
      logger.error('Error updating overview', error)
      toast({ title: 'Failed to update overview', description: error.message, status: 'error' })
    } finally {
      setSavingOverview(false)
    }
  }

  const handleRegenerate = async () => {
    try {
      setRegenerating(true)
      const updated = await regenerateReport(studentId, reportId)
      setReport(updated)
      toast({ title: 'Report regenerated', status: 'success', duration: 2000, isClosable: true })
    } catch (error) {
      logger.error('Error regenerating report', error)
      toast({ title: 'Failed to regenerate report', description: error.message, status: 'error' })
    } finally {
      setRegenerating(false)
    }
  }

  const handlePrint = () => {
    try {
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        toast({
          title: 'Print blocked',
          description: 'Please allow pop-ups to print the report',
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
        return
      }
      const htmlContent = generatePrintableHTML(report, student)
      printWindow.document.write(htmlContent)
      printWindow.document.close()
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print()
          printWindow.close()
        }, 500)
      }
    } catch (error) {
      logger.error('Print error', error)
      toast({ title: 'Print failed', description: 'Unable to open print dialog', status: 'error', duration: 3000, isClosable: true })
    }
  }

  const handleDownloadHTML = () => {
    try {
      const htmlContent = generatePrintableHTML(report, student)
      const blob = new Blob([htmlContent], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${student?.first_name}_${student?.last_name}_${report.report_period}_${report.academic_year}.html`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast({ title: 'Report downloaded', description: 'HTML report saved to your downloads', status: 'success', duration: 2000, isClosable: true })
    } catch (error) {
      logger.error('Download error', error)
      toast({ title: 'Download failed', description: 'Unable to download report', status: 'error', duration: 3000, isClosable: true })
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${titleDisplay} - ${student?.first_name} ${student?.last_name}`,
          text: `Educational progress report for ${student?.first_name} ${student?.last_name}`,
          url: window.location.href
        })
      } catch (error) {
        if (error.name !== 'AbortError') {
          logger.error('Share error', error)
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href)
        toast({ title: 'Link copied', description: 'Report link copied to clipboard', status: 'success', duration: 2000, isClosable: true })
      } catch (error) {
        toast({ title: 'Share failed', description: 'Unable to share report', status: 'error', duration: 3000, isClosable: true })
      }
    }
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

  const titleDisplay = report.title && report.title.trim().length > 0
    ? report.title
    : formatReportPeriod(report.report_period, report.custom_period_name)

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
          <VStack align="start" flex={1} spacing={1}>
            {!editingTitle ? (
              <HStack>
                <Heading size="lg">{titleDisplay}</Heading>
                <IconButton
                  icon={<Edit2 size={16} />}
                  size="sm"
                  variant="ghost"
                  aria-label="Edit title"
                  onClick={() => {
                    setTitleInput(report.title || '')
                    setEditingTitle(true)
                  }}
                />
              </HStack>
            ) : (
              <HStack>
                <Input
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder={formatReportPeriod(report.report_period, report.custom_period_name)}
                  size="md"
                  maxW="lg"
                />
                <IconButton
                  icon={<Save size={16} />}
                  size="sm"
                  colorScheme="blue"
                  aria-label="Save title"
                  isLoading={savingTitle}
                  onClick={handleSaveTitle}
                  isDisabled={!titleInput.trim()}
                />
                <IconButton
                  icon={<X size={16} />}
                  size="sm"
                  variant="ghost"
                  aria-label="Cancel"
                  onClick={() => setEditingTitle(false)}
                />
              </HStack>
            )}
            <Badge 
              colorScheme={report.status === 'submitted' ? 'green' : report.status === 'generating' ? 'purple' : 'orange'}
              px={2}
              py={0.5}
            >
              {report.status === 'submitted' ? 'SUBMITTED' : report.status?.toUpperCase()}
            </Badge>
            {student && (
              <Text color="gray.600" fontSize="sm">
                {student.first_name} {student.last_name} • {student.grade_level} • {report.academic_year}
              </Text>
            )}
          </VStack>
          <HStack>
            <Menu placement="bottom-end">
              <MenuButton as={IconButton} icon={<MoreVertical />} variant="ghost" aria-label="Options" />
              <MenuList>
                <MenuItem icon={<RefreshCw size={16} />} onClick={handleRegenerate} isDisabled={regenerating}>
                  {regenerating ? 'Regenerating...' : 'Regenerate Report'}
                </MenuItem>
                <MenuItem icon={<Check size={16} />} onClick={handleToggleStatus} isDisabled={updatingStatus}>
                  {report.status === 'submitted' ? 'Mark as Draft' : 'Submit Report'}
                </MenuItem>
                <MenuDivider />
                <MenuItem icon={<Printer size={16} />} onClick={handlePrint}>
                  Print Report
                </MenuItem>
                <MenuItem icon={<Download size={16} />} onClick={handleDownloadHTML}>
                  Download HTML
                </MenuItem>
                <MenuItem icon={<Share2 size={16} />} onClick={handleShare}>
                  Share Report
                </MenuItem>
              </MenuList>
            </Menu>
          </HStack>
        </HStack>

        {/* Report Metadata */}
        <Box bg="gray.50" p={4} borderRadius="md">
          <HStack spacing={6} fontSize="sm" color="gray.600" flexWrap="wrap">
            <HStack>
              <Calendar size={16} />
              <Text>Created: {formatDate(report.generated_at)}</Text>
            </HStack>
            <HStack>
              <Clock size={16} />
              <Text>Last Edited: {formatTime(report.last_modified)}</Text>
            </HStack>
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

        {/* Overview Section - Parent Comments */}
        <Box bg="green.50" p={4} borderRadius="md" border="1px solid" borderColor="green.200">
          <VStack align="stretch" spacing={3}>
            <HStack justify="space-between">
              <Text fontWeight="medium" color="green.800">
                Overview
              </Text>
              {!editingOverview && (
                <IconButton
                  icon={<Edit2 size={14} />}
                  size="xs"
                  variant="ghost"
                  colorScheme="green"
                  aria-label="Edit overview"
                  onClick={() => {
                    setOverviewInput(report.parent_overview || report.ai_generated_overview || '')
                    setEditingOverview(true)
                  }}
                />
              )}
            </HStack>
            
            {!editingOverview ? (
              <Text fontSize="sm" color="green.700" whiteSpace="pre-wrap">
                {report.parent_overview || report.ai_generated_overview || 'No overview available. Click edit to add one.'}
              </Text>
            ) : (
              <VStack align="stretch" spacing={2}>
                <Textarea
                  value={overviewInput}
                  onChange={(e) => setOverviewInput(e.target.value)}
                  placeholder="Add your comments and observations about your child's learning journey..."
                  minH="150px"
                  bg="white"
                  fontSize="sm"
                />
                <HStack justify="flex-end" spacing={2}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingOverview(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    colorScheme="green"
                    leftIcon={<Save size={14} />}
                    isLoading={savingOverview}
                    onClick={handleSaveOverview}
                  >
                    Save
                  </Button>
                </HStack>
              </VStack>
            )}
          </VStack>
        </Box>

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

      {/* Report Regeneration Progress Modal */}
      <ReportGenerationProgress isOpen={regenerating} title="Regenerating Report" />
    </Container>
  )
}

export default ReportViewPage 