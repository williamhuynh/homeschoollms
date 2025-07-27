import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  VStack,
  HStack,
  Text,
  Spinner,
  Progress,
  Box,
  Icon
} from '@chakra-ui/react'
import { CheckCircle, Clock } from 'react-feather'
import { useState, useEffect } from 'react'

const ReportGenerationProgress = ({ isOpen, generationStatus }) => {
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('Initializing...')
  const [completedSteps, setCompletedSteps] = useState([])

  // Simulate progress steps
  useEffect(() => {
    if (!isOpen) {
      setProgress(0)
      setCurrentStep('Initializing...')
      setCompletedSteps([])
      return
    }

    const steps = [
      { text: 'Loading curriculum data', duration: 2000 },
      { text: 'Analyzing evidence', duration: 3000 },
      { text: 'Generating AI summaries', duration: 15000 },
      { text: 'Calculating progress metrics', duration: 2000 },
      { text: 'Finalizing report', duration: 1000 }
    ]

    let currentIndex = 0
    let elapsed = 0
    const totalDuration = steps.reduce((acc, step) => acc + step.duration, 0)

    const interval = setInterval(() => {
      elapsed += 100
      setProgress((elapsed / totalDuration) * 100)

      // Check if we should move to next step
      let stepElapsed = 0
      for (let i = 0; i < steps.length; i++) {
        stepElapsed += steps[i].duration
        if (elapsed < stepElapsed) {
          if (i !== currentIndex) {
            currentIndex = i
            setCurrentStep(steps[i].text)
            if (i > 0) {
              setCompletedSteps(prev => [...prev, steps[i - 1].text])
            }
          }
          break
        }
      }

      if (elapsed >= totalDuration) {
        clearInterval(interval)
        setProgress(100)
        setCompletedSteps(steps.map(s => s.text))
      }
    }, 100)

    return () => clearInterval(interval)
  }, [isOpen])

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      closeOnOverlayClick={false}
      closeOnEsc={false}
      size="md"
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Generating Report</ModalHeader>
        <ModalBody pb={6}>
          <VStack spacing={4} align="stretch">
            <Box>
              <HStack justify="space-between" mb={2}>
                <Text fontSize="sm" color="gray.600">Overall Progress</Text>
                <Text fontSize="sm" fontWeight="medium">
                  {Math.round(progress)}%
                </Text>
              </HStack>
              <Progress 
                value={progress} 
                colorScheme="blue" 
                borderRadius="full"
                hasStripe
                isAnimated
              />
            </Box>

            <VStack align="stretch" spacing={2}>
              {/* Current Step */}
              <HStack spacing={3} p={3} bg="blue.50" borderRadius="md">
                <Spinner size="sm" color="blue.500" />
                <Text fontSize="sm" color="blue.700" fontWeight="medium">
                  {currentStep}
                </Text>
              </HStack>

              {/* Completed Steps */}
              {completedSteps.map((step, index) => (
                <HStack key={index} spacing={3} p={2} opacity={0.7}>
                  <Icon as={CheckCircle} color="green.500" boxSize={4} />
                  <Text fontSize="sm" color="gray.600">
                    {step}
                  </Text>
                </HStack>
              ))}
            </VStack>

            <HStack spacing={2} justify="center" color="gray.500" fontSize="sm">
              <Icon as={Clock} boxSize={4} />
              <Text>This may take a few minutes...</Text>
            </HStack>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default ReportGenerationProgress 