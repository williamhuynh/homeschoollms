import {
  Box,
  Card,
  CardBody,
  VStack,
  HStack,
  Text,
  Heading,
  Progress,
  Button,
  IconButton,
  Textarea,
  useToast,
  useDisclosure,
  Collapse,
  Grid,
  Image,
  Link,
  Badge,
  Tooltip
} from '@chakra-ui/react'
import { Edit, Save, X, ExternalLink, Eye } from 'react-feather'
import { useState } from 'react'
import { updateLearningAreaSummary } from '../../services/api'
import { useNavigate } from 'react-router-dom'
import SummaryEditor from './SummaryEditor'
import OptimizedEvidenceGallery from './OptimizedEvidenceGallery'

const LearningAreaSummaryCard = ({ summary, studentId, reportId, onUpdate }) => {
  const toast = useToast()
  const navigate = useNavigate()
  const { isOpen, onToggle } = useDisclosure()
  
  const [isEditing, setIsEditing] = useState(false)
  const [editedSummary, setEditedSummary] = useState(
    summary.user_edited_summary || summary.ai_generated_summary || ''
  )
  const [saving, setSaving] = useState(false)

  const handleSave = async (newSummary) => {
    try {
      setSaving(true)
      const updatedSummary = await updateLearningAreaSummary(
        studentId,
        reportId,
        summary.learning_area_code,
        { user_edited_summary: newSummary }
      )
      
      // Update the parent component
      onUpdate({
        ...summary,
        user_edited_summary: newSummary,
        is_edited: true
      })
      
      setEditedSummary(newSummary)
      setIsEditing(false)
      toast({
        title: 'Summary updated',
        status: 'success',
        duration: 2000,
        isClosable: true,
      })
    } catch (error) {
      console.error('Error updating summary:', error)
      toast({
        title: 'Error updating summary',
        description: error.message || 'Failed to update summary',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditedSummary(summary.user_edited_summary || summary.ai_generated_summary || '')
    setIsEditing(false)
  }

  const displaySummary = summary.user_edited_summary || summary.ai_generated_summary || 'No summary available.'

  const formatDate = (dateString) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('en-AU', {
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <Card>
      <CardBody>
        <VStack align="stretch" spacing={4}>
          {/* Header */}
          <HStack justify="space-between">
            <VStack align="start" spacing={1}>
              <HStack>
                <Heading size="md">{summary.learning_area_name}</Heading>
                {summary.is_edited && (
                  <Tooltip label="This summary has been manually edited">
                    <Badge colorScheme="blue" size="sm">Edited</Badge>
                  </Tooltip>
                )}
              </HStack>
              <HStack spacing={4} fontSize="sm" color="gray.600">
                <Text>
                  {summary.evidence_count} evidence items
                </Text>
                <Text>
                  {summary.outcomes_with_evidence}/{summary.total_outcomes} outcomes
                </Text>
              </HStack>
            </VStack>
            <HStack>
              <Button
                size="sm"
                variant="ghost"
                onClick={onToggle}
                rightIcon={isOpen ? <X size={16} /> : <Eye size={16} />}
              >
                {isOpen ? 'Hide' : 'Show'} Details
              </Button>
              {!isEditing && (
                <IconButton
                  icon={<Edit size={16} />}
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditing(true)}
                  aria-label="Edit summary"
                />
              )}
            </HStack>
          </HStack>

          {/* Progress Bar */}
          <Box>
            <HStack justify="space-between" mb={1}>
              <Text fontSize="sm" color="gray.600">Progress</Text>
              <Text fontSize="sm" fontWeight="medium">
                {Math.round(summary.progress_percentage)}%
              </Text>
            </HStack>
            <Progress 
              value={summary.progress_percentage} 
              colorScheme="green" 
              borderRadius="full"
              size="sm"
            />
          </Box>

          {/* Summary Text */}
          {isEditing ? (
            <SummaryEditor
              initialValue={editedSummary}
              onSave={handleSave}
              onCancel={handleCancel}
              saving={saving}
              placeholder={`Enter summary for ${summary.learning_area_name}...`}
              maxLength={2000}
            />
          ) : (
            <Box>
              <Text whiteSpace="pre-wrap" lineHeight="tall">
                {displaySummary}
              </Text>
            </Box>
          )}

          {/* Expandable Details */}
          <Collapse in={isOpen} animateOpacity>
            <VStack align="stretch" spacing={4} pt={2}>
              {/* Evidence Examples */}
              <OptimizedEvidenceGallery
                evidenceItems={summary.evidence_examples || []}
                maxItems={6}
                onEvidenceClick={(evidence) => {
                  // Navigate to evidence detail if needed
                  console.log('View evidence:', evidence.evidence_id)
                }}
              />

              {/* View All Evidence Link */}
              <Button
                variant="outline"
                size="sm"
                rightIcon={<ExternalLink size={16} />}
                onClick={() => navigate(`/students/${studentId}/subjects/${summary.learning_area_code}`)}
              >
                View All Evidence for {summary.learning_area_name}
              </Button>
            </VStack>
          </Collapse>
        </VStack>
      </CardBody>
    </Card>
  )
}

export default LearningAreaSummaryCard 