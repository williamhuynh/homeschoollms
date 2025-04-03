import { Box, VStack, IconButton, Text, Image, SimpleGrid, Container, Spinner, Center } from '@chakra-ui/react'
import { ArrowLeft } from 'react-feather'
import { useNavigate, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { getLearningOutcome } from '../../services/api'

const LearningOutcomePage = () => {
  const navigate = useNavigate()
  const { studentId, learningOutcomeId } = useParams()
  const [learningOutcome, setLearningOutcome] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
  }, [learningOutcomeId])

  useEffect(() => {
    let isMounted = true
    
    const fetchData = async () => {
      try {
        const data = await getLearningOutcome(studentId, learningOutcomeId)
        if (isMounted) {
          setLearningOutcome(data)
          setError(null)
          setLoading(false)
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error fetching learning outcome:', err)
          setError('Failed to load learning outcome. Please try again.')
          // Keep loading true to show spinner
        }
      }
    }
    
    fetchData()
    
    return () => {
      isMounted = false
    }
  }, [studentId, learningOutcomeId])

  if (loading) {
    return (
      <Container maxW="container.sm" p={0}>
        <Box position="fixed" top={0} w="full" zIndex={10} bg="white" p={4} borderBottom="1px" borderColor="gray.200">
          <IconButton
            icon={<ArrowLeft />}
            onClick={() => navigate(-1)}
            variant="ghost"
            aria-label="Back"
          />
          <Text fontSize="xl" fontWeight="bold" ml={2} display="inline-block">
            Loading...
          </Text>
        </Box>
        <Center mt="80px">
          <Spinner size="xl" color="blue.500" />
        </Center>
      </Container>
    )
  }

  if (error || !learningOutcome) {
    return (
      <Container maxW="container.sm" p={0}>
        <Box position="fixed" top={0} w="full" zIndex={10} bg="white" p={4} borderBottom="1px" borderColor="gray.200">
          <IconButton
            icon={<ArrowLeft />}
            onClick={() => navigate(-1)}
            variant="ghost"
            aria-label="Back"
          />
          <Text fontSize="xl" fontWeight="bold" ml={2} display="inline-block">
            Error
          </Text>
        </Box>
        <Center mt="80px">
          <Text color="red.500">{error || 'Learning outcome not found'}</Text>
        </Center>
      </Container>
    )
  }

  return (
    <Container maxW="container.sm" p={0}>
      <Box position="fixed" top={0} w="full" zIndex={10} bg="white" p={4} borderBottom="1px" borderColor="gray.200">
        <IconButton
          icon={<ArrowLeft />}
          onClick={() => navigate(-1)}
          variant="ghost"
          aria-label="Back"
        />
        <Text fontSize="xl" fontWeight="bold" ml={2} display="inline-block">
          {learningOutcome.name}
        </Text>
      </Box>

      <Box mt="60px" p={4}>
        <Text fontSize="lg" mb={4}>
          {learningOutcome.description}
        </Text>

        <SimpleGrid 
          columns={2} 
          spacing={3} 
          pb={4}
        >
          {learningOutcome.evidence.map((evidence) => (
            <Box 
              key={evidence.id} 
              onClick={() => console.log('Open evidence:', evidence.id)}
              cursor="pointer"
            >
              <Box position="relative" paddingTop="133.33%">
                <Image
                  src={evidence.thumbnail || 'https://placehold.co/300x400'}
                  alt={evidence.description}
                  position="absolute"
                  top={0}
                  left={0}
                  w="100%"
                  h="100%"
                  objectFit="cover"
                  borderRadius="lg"
                />
              </Box>
              <Box p={2}>
                <Text fontSize="sm" fontWeight="semibold" noOfLines={2}>
                  {new Date(evidence.date).toLocaleDateString()}
                </Text>
                <Text fontSize="xs" color="gray.500" noOfLines={2}>
                  {evidence.description}
                </Text>
              </Box>
            </Box>
          ))}
        </SimpleGrid>
      </Box>
    </Container>
  )
}

export default LearningOutcomePage
