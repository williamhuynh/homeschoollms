import { Button, useToast, Box, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { updateStudentSlugs } from '../../services/api'

/**
 * A utility component to update slugs for all existing students.
 * This should be used by administrators to migrate existing data.
 */
const UpdateStudentSlugs = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState(null)
  const toast = useToast()

  const handleUpdateSlugs = async () => {
    setIsLoading(true)
    setResult(null)
    
    try {
      const response = await updateStudentSlugs()
      setResult({
        success: true,
        message: response.message || 'Student slugs updated successfully'
      })
      toast({
        title: 'Success',
        description: 'Student slugs have been updated',
        status: 'success',
        duration: 5000,
        isClosable: true,
      })
    } catch (error) {
      console.error('Error updating student slugs:', error)
      setResult({
        success: false,
        message: error.message || 'Failed to update student slugs'
      })
      toast({
        title: 'Error',
        description: 'Failed to update student slugs',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Box p={4} borderWidth="1px" borderRadius="lg">
      <Text mb={4}>
        This utility will update all existing students to include URL-friendly slugs based on their names.
      </Text>
      <Button
        colorScheme="blue"
        isLoading={isLoading}
        loadingText="Updating..."
        onClick={handleUpdateSlugs}
      >
        Update Student Slugs
      </Button>
      
      {result && (
        <Box 
          mt={4} 
          p={3} 
          borderRadius="md" 
          bg={result.success ? 'green.100' : 'red.100'}
          color={result.success ? 'green.800' : 'red.800'}
        >
          {result.message}
        </Box>
      )}
    </Box>
  )
}

export default UpdateStudentSlugs
