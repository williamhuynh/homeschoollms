import {
  Box,
  Grid,
  Image,
  Text,
  VStack,
  Skeleton,
  Tooltip,
  IconButton
} from '@chakra-ui/react'
import { Eye, ExternalLink } from 'react-feather'
import { useState, useCallback } from 'react'
import { useInView } from 'react-intersection-observer'

const EvidenceItem = ({ evidence, onClick, isVisible }) => {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)

  const formatDate = (dateString) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('en-AU', {
      month: 'short',
      day: 'numeric'
    })
  }

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true)
  }, [])

  const handleImageError = useCallback(() => {
    setImageError(true)
    setImageLoaded(true)
  }, [])

  return (
    <VStack 
      spacing={1}
      cursor="pointer"
      onClick={() => onClick?.(evidence)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick?.(evidence)
        }
      }}
      _hover={{
        transform: 'scale(1.05)',
        transition: 'transform 0.2s'
      }}
      _focus={{
        outline: '2px solid',
        outlineColor: 'blue.500',
        outlineOffset: '2px'
      }}
    >
      <Box
        borderRadius="md"
        overflow="hidden"
        bg="gray.100"
        w="100%"
        h="80px"
        position="relative"
        border="1px solid"
        borderColor="gray.200"
        _hover={{
          borderColor: 'blue.300',
          shadow: 'sm'
        }}
      >
        {!imageLoaded && !imageError && (
          <Skeleton w="100%" h="100%" />
        )}
        
        {isVisible && evidence.thumbnail_url && !imageError ? (
          <Image
            src={evidence.thumbnail_url}
            alt={evidence.title}
            objectFit="cover"
            w="100%"
            h="100%"
            onLoad={handleImageLoad}
            onError={handleImageError}
            loading="lazy"
            style={{
              opacity: imageLoaded ? 1 : 0,
              transition: 'opacity 0.3s ease-in-out'
            }}
          />
        ) : (
          <Box
            w="100%"
            h="100%"
            display="flex"
            alignItems="center"
            justifyContent="center"
            color="gray.400"
            bg="gray.50"
          >
            <Eye size={24} />
          </Box>
        )}

        {/* Hover overlay */}
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="blackAlpha.600"
          display="flex"
          alignItems="center"
          justifyContent="center"
          opacity={0}
          _hover={{ opacity: 1 }}
          transition="opacity 0.2s"
        >
          <ExternalLink size={20} color="white" />
        </Box>
      </Box>

      <Tooltip label={evidence.title} placement="bottom">
        <Text 
          fontSize="xs" 
          noOfLines={2} 
          textAlign="center"
          maxW="100px"
          lineHeight="short"
        >
          {evidence.title}
        </Text>
      </Tooltip>
      
      <Text fontSize="xs" color="gray.500">
        {formatDate(evidence.uploaded_at)}
      </Text>
    </VStack>
  )
}

const OptimizedEvidenceGallery = ({ 
  evidenceItems = [], 
  maxItems = 6,
  onEvidenceClick,
  title = "Evidence Examples"
}) => {
  const { ref: containerRef, inView: isInView } = useInView({
    threshold: 0.1,
    triggerOnce: true
  })

  const displayItems = evidenceItems.slice(0, maxItems)

  if (!evidenceItems.length) {
    return (
      <Box p={4} textAlign="center" color="gray.500" fontSize="sm">
        No evidence examples available
      </Box>
    )
  }

  return (
    <Box ref={containerRef}>
      <Text fontWeight="medium" mb={3} fontSize="sm">
        {title} ({evidenceItems.length} total)
      </Text>
      
      <Grid 
        templateColumns="repeat(auto-fill, minmax(100px, 1fr))" 
        gap={3}
        maxW="100%"
      >
        {displayItems.map((evidence, index) => (
          <EvidenceItem
            key={`${evidence.evidence_id}-${index}`}
            evidence={evidence}
            onClick={onEvidenceClick}
            isVisible={isInView}
          />
        ))}
      </Grid>

      {evidenceItems.length > maxItems && (
        <Text 
          fontSize="xs" 
          color="gray.600" 
          mt={2}
          textAlign="center"
        >
          Showing {maxItems} of {evidenceItems.length} evidence items
        </Text>
      )}
    </Box>
  )
}

export default OptimizedEvidenceGallery 