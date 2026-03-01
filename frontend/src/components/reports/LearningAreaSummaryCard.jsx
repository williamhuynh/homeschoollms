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
  Tooltip,
  Tag,
  TagLabel,
  TagCloseButton,
  Wrap,
  WrapItem,
  Input
} from '@chakra-ui/react'
import { Edit, Save, X, ExternalLink, Eye } from 'react-feather'
import { useState } from 'react'
import { updateLearningAreaSummary } from '../../services/api'
import { useNavigate } from 'react-router-dom'
import SummaryEditor from './SummaryEditor'
import OptimizedEvidenceGallery from './OptimizedEvidenceGallery'
import { logger } from '../../utils/logger'
import { formatMarkdownToHTML } from './exportUtils'

const LearningAreaSummaryCard = ({ summary, studentId, reportId, onUpdate }) => {
  const toast = useToast()
  const navigate = useNavigate()
  const { isOpen, onToggle } = useDisclosure()
  
  const [isEditing, setIsEditing] = useState(false)
  const [editedSummary, setEditedSummary] = useState(
    summary.user_edited_summary || summary.ai_generated_summary || ''
  )
  const [saving, setSaving] = useState(false)
  const [isEditingResources, setIsEditingResources] = useState(false)
  const [editedResources, setEditedResources] = useState([])
  const [newResource, setNewResource] = useState('')

  const handleAddResource = () => {
    const trimmed = newResource.trim()
    if (!trimmed) return
    if (!editedResources.some(r => r.toLowerCase() === trimmed.toLowerCase())) {
      setEditedResources(prev => [...prev, trimmed])
    }
    setNewResource('')
  }

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
      logger.error('Error updating summary', error)
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

  const handleSaveResources = async () => {
    try {
      await updateLearningAreaSummary(
        studentId,
        reportId,
        summary.learning_area_code,
        { user_edited_resources: editedResources }
      )
      onUpdate({
        ...summary,
        user_edited_resources: editedResources
      })
      setIsEditingResources(false)
      toast({
        title: 'Resources updated',
        status: 'success',
        duration: 2000,
        isClosable: true,
      })
    } catch (err) {
      logger.error('Failed to save resources', err)
      toast({
        title: 'Error updating resources',
        description: err.message || 'Failed to save resources',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  const displaySummary = summary.user_edited_summary || summary.ai_generated_summary || 'No summary available.'
  const displayResources = summary.user_edited_resources || summary.learning_resources || []

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
              maxLength={3500}
            />
          ) : (
            <Box
              whiteSpace="pre-wrap"
              lineHeight="tall"
              sx={{
                '& strong': { fontWeight: 'bold' },
                '& em': { fontStyle: 'italic' }
              }}
              dangerouslySetInnerHTML={{ __html: formatMarkdownToHTML(displaySummary) }}
            />
          )}

          {/* Learning Resources */}
          <Box>
            <HStack justify="space-between" mb={1}>
              <Text fontSize="sm" fontWeight="medium" color="gray.600">Learning Resources</Text>
              {!isEditingResources && (
                <IconButton
                  icon={<Edit size={14} />}
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setEditedResources([...displayResources])
                    setIsEditingResources(true)
                  }}
                  aria-label="Edit resources"
                />
              )}
            </HStack>

            {isEditingResources ? (
              <VStack spacing={2} align="stretch" p={3} bg="gray.50" borderRadius="md">
                <Wrap spacing={2}>
                  {editedResources.map((name, i) => (
                    <WrapItem key={i}>
                      <Tag size="sm" colorScheme="blue" borderRadius="full">
                        <TagLabel>{name}</TagLabel>
                        <TagCloseButton onClick={() => setEditedResources(prev => prev.filter((_, idx) => idx !== i))} />
                      </Tag>
                    </WrapItem>
                  ))}
                </Wrap>
                <HStack>
                  <Input
                    size="sm"
                    placeholder="Add a resource name"
                    value={newResource}
                    onChange={(e) => setNewResource(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddResource()
                    }}
                  />
                  <Button size="sm" isDisabled={!newResource.trim()} onClick={handleAddResource}>Add</Button>
                </HStack>
                <HStack spacing={2}>
                  <Button size="sm" colorScheme="blue" onClick={handleSaveResources}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditingResources(false)}>Cancel</Button>
                </HStack>
              </VStack>
            ) : (
              <Text fontSize="sm" color={displayResources.length > 0 ? "gray.700" : "gray.400"}>
                {displayResources.length > 0
                  ? displayResources.join(', ')
                  : 'No learning resources recorded'}
              </Text>
            )}
          </Box>

          {/* Expandable Details */}
          <Collapse in={isOpen} animateOpacity>
            <VStack align="stretch" spacing={4} pt={2}>
              {/* Evidence Examples */}
              <OptimizedEvidenceGallery
                evidenceItems={summary.evidence_examples || []}
                totalEvidenceCount={summary.evidence_count}
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
                onClick={() => navigate(`/students/${studentId}/subjects/${summary.learning_area_code}`, {
                  state: { subject: { code: summary.learning_area_code, name: summary.learning_area_name } }
                })}
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