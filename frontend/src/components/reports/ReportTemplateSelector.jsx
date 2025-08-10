import {
  Box,
  VStack,
  HStack,
  Text,
  Radio,
  RadioGroup,
  Card,
  CardBody,
  Badge,
  Icon,
  SimpleGrid,
  Tooltip
} from '@chakra-ui/react'
import { FileText, Users, Star, Award } from 'react-feather'
import { useState } from 'react'

const REPORT_TEMPLATES = [
  {
    id: 'standard',
    name: 'Standard Report',
    description: 'Comprehensive report with all learning areas and detailed progress',
    icon: FileText,
    features: [
      'All learning areas included',
      'Progress statistics',
      'Evidence examples',
      'AI-generated summaries'
    ],
    recommended: true,
    preview: 'Complete academic overview with detailed learning area summaries and evidence examples.'
  },
  {
    id: 'summary',
    name: 'Executive Summary (Coming soon)',
    description: 'Condensed report focusing on key achievements and overall progress',
    icon: Star,
    features: [
      'Overall progress highlights',
      'Key achievements only',
      'Concise format',
      'Administrator-friendly'
    ],
    preview: 'Brief overview emphasizing major accomplishments and progress milestones.',
    comingSoon: true
  },
  {
    id: 'detailed',
    name: 'Detailed Academic Report (Coming soon)',
    description: 'Comprehensive report with extended analysis and all evidence',
    icon: Award,
    features: [
      'Extended learning analysis',
      'All evidence included',
      'Detailed outcome mapping',
      'Curriculum alignment notes'
    ],
    preview: 'In-depth academic assessment with complete evidence documentation.',
    comingSoon: true
  },
  {
    id: 'portfolio',
    name: 'Learning Portfolio (Coming soon)',
    description: 'Visual report emphasizing student work and creative achievements',
    icon: Users,
    features: [
      'Emphasis on evidence gallery',
      'Visual layout',
      'Creative work highlights',
      'Student voice included'
    ],
    preview: 'Visual showcase of student work with emphasis on creative and practical achievements.',
    comingSoon: true
  }
]

const ReportTemplateSelector = ({ 
  selectedTemplate = 'standard', 
  onTemplateChange,
  disabled = false
}) => {
  const [hoveredTemplate, setHoveredTemplate] = useState(null)

  const handleTemplateSelect = (templateId) => {
    const target = REPORT_TEMPLATES.find(t => t.id === templateId)
    if (disabled || target?.comingSoon) return
    onTemplateChange?.(templateId)
  }

  return (
    <VStack align="stretch" spacing={4}>
      <Box>
        <Text fontWeight="medium" mb={1}>Report Template</Text>
        <Text fontSize="sm" color="gray.600">
          Choose the format and style for your report
        </Text>
      </Box>

      <RadioGroup value={selectedTemplate} onChange={handleTemplateSelect}>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
          {REPORT_TEMPLATES.map((template) => (
            <Card
              key={template.id}
              cursor={(disabled || template.comingSoon) ? 'not-allowed' : 'pointer'}
              opacity={(disabled || template.comingSoon) ? 0.6 : 1}
              onClick={() => handleTemplateSelect(template.id)}
              onMouseEnter={() => setHoveredTemplate(template.id)}
              onMouseLeave={() => setHoveredTemplate(null)}
              variant="outline"
              _hover={(disabled || template.comingSoon) ? {} : {
                borderColor: 'blue.300',
                shadow: 'md'
              }}
              borderColor={selectedTemplate === template.id ? 'blue.500' : 'gray.200'}
              borderWidth={selectedTemplate === template.id ? '2px' : '1px'}
              bg={selectedTemplate === template.id ? 'blue.50' : 'white'}
            >
              <CardBody>
                <VStack align="stretch" spacing={3}>
                  <HStack justify="space-between">
                    <HStack>
                      <Icon as={template.icon} boxSize={5} color="blue.500" />
                      <Radio 
                        value={template.id} 
                        isDisabled={disabled || template.comingSoon}
                        colorScheme="blue"
                      />
                    </HStack>
                    {template.recommended && (
                      <Badge colorScheme="green" size="sm">
                        Recommended
                      </Badge>
                    )}
                  </HStack>

                  <Box>
                    <Text fontWeight="medium" mb={1}>
                      {template.name}
                    </Text>
                    <Text fontSize="sm" color="gray.600" mb={2}>
                      {template.description}
                    </Text>
                  </Box>

                  <VStack align="start" spacing={1}>
                    {template.features.map((feature, index) => (
                      <Text key={index} fontSize="xs" color="gray.500">
                        • {feature}
                      </Text>
                    ))}
                  </VStack>

                  {(hoveredTemplate === template.id || selectedTemplate === template.id) && (
                    <Box
                      p={2}
                      bg="gray.50"
                      borderRadius="sm"
                      fontSize="xs"
                      color="gray.700"
                      fontStyle="italic"
                    >
                      {template.preview}
                    </Box>
                  )}
                </VStack>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      </RadioGroup>

      {selectedTemplate && (
        <Box bg="blue.50" p={3} borderRadius="md" fontSize="sm">
          <Text fontWeight="medium" color="blue.800" mb={1}>
            Selected Template: {REPORT_TEMPLATES.find(t => t.id === selectedTemplate)?.name}
          </Text>
          <Text color="blue.700">
            {REPORT_TEMPLATES.find(t => t.id === selectedTemplate)?.preview}
          </Text>
        </Box>
      )}
    </VStack>
  )
}

export const getTemplateConfig = (templateId) => {
  const template = REPORT_TEMPLATES.find(t => t.id === templateId)
  if (!template) return REPORT_TEMPLATES[0]
  
  return {
    ...template,
    settings: {
      includeAllLearningAreas: templateId !== 'summary',
      includeEvidenceGallery: true,
      includeProgressCharts: templateId === 'detailed' || templateId === 'standard',
      maxEvidencePerArea: templateId === 'portfolio' ? 12 : templateId === 'summary' ? 3 : 6,
      includeCurriculumAlignment: templateId === 'detailed',
      summaryLength: templateId === 'summary' ? 'short' : 'standard'
    }
  }
}

export default ReportTemplateSelector 