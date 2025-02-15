import { Box, VStack, IconButton, Text, Image, SimpleGrid, Container } from '@chakra-ui/react'
import { ArrowLeft } from 'react-feather'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import styles from '../../styles/SubjectContent.module.css'

const SubjectContentPage = () => {
  const navigate = useNavigate()
  const { studentId, subject } = useParams()
  const location = useLocation()
  const student = location.state?.student

  // Mock content data
  const contentItems = [
    {
        id: 1,
        title: "Addition with Fractions",
        thumbnail: "https://placehold.co/300x400",
        type: "video",
        views: "1.2k"
      },
      {
        id: 2,
        title: "Multiplication Tables",
        thumbnail: "https://placehold.co/300x400",
        type: "exercise",
        views: "856"
      },
      {
        id: 3,
        title: "Division Basics",
        thumbnail: "https://placehold.co/300x400",
        type: "video",
        views: "2.1k"
      },
      {
        id: 4,
        title: "Decimal Numbers",
        thumbnail: "https://placehold.co/300x400",
        type: "exercise",
        views: "943"
      },
      {
        id: 5,
        title: "Geometry: Understanding Shapes",
        thumbnail: "https://placehold.co/300x400",
        type: "video",
        views: "1.5k"
      },
      {
        id: 6,
        title: "Algebra Fundamentals",
        thumbnail: "https://placehold.co/300x400",
        type: "exercise",
        views: "1.1k"
      },
      {
        id: 7,
        title: "Percentages Made Easy",
        thumbnail: "https://placehold.co/300x400",
        type: "video",
        views: "987"
      },
      {
        id: 8,
        title: "Problem Solving Techniques",
        thumbnail: "https://placehold.co/300x400",
        type: "exercise",
        views: "765"
      },
      {
        id: 9,
        title: "Number Patterns",
        thumbnail: "https://placehold.co/300x400",
        type: "video",
        views: "1.3k"
      },
      {
        id: 10,
        title: "Introduction to Statistics",
        thumbnail: "https://placehold.co/300x400",
        type: "exercise",
        views: "892"
      },
      {
        id: 11,
        title: "Measurement and Units",
        thumbnail: "https://placehold.co/300x400",
        type: "video",
        views: "1.4k"
      },
      {
        id: 12,
        title: "Mental Math Strategies",
        thumbnail: "https://placehold.co/300x400",
        type: "exercise",
        views: "678"
      }
  ]

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
          {student?.name}'s {subject}
        </Text>
      </Box>

      <SimpleGrid 
        columns={2} 
        spacing={3} 
        mt="60px" 
        pb={4} 
        px={2}
      >
        {contentItems.map((item) => (
          <Box 
            key={item.id} 
            className={styles.contentCard}
            onClick={() => console.log('Open content:', item.id)}
          >
            <Box position="relative" paddingTop="133.33%"> {/* This creates 3:4 aspect ratio */}
              <Image
                src={item.thumbnail}
                alt={item.title}
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
                {item.title}
              </Text>
              <Text fontSize="xs" color="gray.500">
                {item.views} • {item.type}
              </Text>
            </Box>
          </Box>
        ))}
      </SimpleGrid>
    </Container>
  )
}

export default SubjectContentPage