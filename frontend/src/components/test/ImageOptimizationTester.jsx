import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Text,
  VStack,
  HStack,
  Divider,
  Code,
  Select,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Switch,
  FormControl,
  FormLabel,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  StatGroup,
  useToast,
} from '@chakra-ui/react';
import ResponsiveImage from '../common/ResponsiveImage';
import LazyImage from '../common/LazyImage';
import { runImagePerformanceTest, setupImagePerformanceTesting } from '../../utils/imagePerformanceTest';

/**
 * A test component to verify that the image optimization via Vercel Edge Functions works correctly.
 * This component displays a test image using our ResponsiveImage component and shows debug information.
 */
const ImageOptimizationTester = () => {
  const toast = useToast();
  const [testImage, setTestImage] = useState(null);
  const [debugInfo, setDebugInfo] = useState("");

  // Helper function to build URLs with different patterns for testing
  const getTestImageUrls = () => {
    // The bucket name used in your backend
    const bucketName = 'homeschoollms';
    // Base URL of your deployment
    const baseUrl = window.location.origin;
    // A sample image path in your bucket
    const samplePath = 'test-image.jpg';

    // Create proper URL that should work
    const properUrl = `${baseUrl}/api/images/${bucketName}/${samplePath}`;
    
    // Create incorrect URL to test our fix (with [...path].js directly)
    const incorrectUrl = `${baseUrl}/api/images/[...path].js/${samplePath}`;
    
    // Direct Backblaze URL to test conversion
    const directBackblazeUrl = `https://${bucketName}.s3.us-east-005.backblazeb2.com/${samplePath}`;

    return {
      properUrl,
      incorrectUrl,
      directBackblazeUrl
    };
  };

  // Helper function to get URL for different sizes with appropriate dimensions
  const getUrl = (width, height) => {
    const urls = getTestImageUrls();
    return `${urls.properUrl}?width=${width}&height=${height}&quality=80`;
  };

  // Initialize test image
  useEffect(() => {
    const urls = getTestImageUrls();
    
    // The actual test image
    setTestImage({
      original_url: urls.properUrl,
      thumbnail_small_url: getUrl(150, 150),
      thumbnail_medium_url: getUrl(400, 300),
      thumbnail_large_url: getUrl(600, 450),
    });
    
    // Set debug info
    setDebugInfo(JSON.stringify({
      urls,
      origin: window.location.origin,
      hostname: window.location.hostname
    }, null, 2));
  }, []);

  // Test the direct URL
  const testDirectUrl = async () => {
    try {
      const urls = getTestImageUrls();
      const res = await fetch(urls.properUrl);
      if (res.ok) {
        toast({
          title: "Success!",
          description: `Direct URL fetch successful. Status: ${res.status}`,
          status: "success",
          duration: 5000,
          isClosable: true,
        });
      } else {
        toast({
          title: "API Error",
          description: `Failed with status: ${res.status} - ${res.statusText}`,
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: `Error testing URL: ${err.message}`,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Test the incorrect URL to verify our fix
  const testIncorrectUrl = async () => {
    try {
      const urls = getTestImageUrls();
      
      // Update test image to use the incorrect URL format
      setTestImage({
        original_url: urls.incorrectUrl,
        thumbnail_small_url: `${urls.incorrectUrl}?width=150&height=150&quality=80`,
        thumbnail_medium_url: `${urls.incorrectUrl}?width=400&height=300&quality=80`,
        thumbnail_large_url: `${urls.incorrectUrl}?width=600&height=450&quality=80`,
      });
      
      toast({
        title: "Test Initiated",
        description: "Testing with incorrect URL format to verify our fix works.",
        status: "info",
        duration: 5000,
        isClosable: true,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: `Error testing incorrect URL: ${err.message}`,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Test direct Backblaze URL to verify conversion
  const testBackblazeUrl = async () => {
    try {
      const urls = getTestImageUrls();
      
      // Update test image to use the direct Backblaze URL
      setTestImage({
        original_url: urls.directBackblazeUrl,
        thumbnail_small_url: `${urls.directBackblazeUrl}`,
        thumbnail_medium_url: `${urls.directBackblazeUrl}`,
        thumbnail_large_url: `${urls.directBackblazeUrl}`,
      });
      
      toast({
        title: "Test Initiated",
        description: "Testing with direct Backblaze URL to verify our conversion works.",
        status: "info",
        duration: 5000,
        isClosable: true,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: `Error testing Backblaze URL: ${err.message}`,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <VStack spacing={6} align="stretch" p={6}>
      <Heading size="lg">Image Optimization Test</Heading>
      
      <Text fontWeight="semibold">Test Image:</Text>
      <Flex justify="center" p={4} bg="gray.100" borderRadius="md">
        {testImage ? (
          <Box maxW="400px" maxH="300px" borderRadius="md" overflow="hidden" boxShadow="md">
            <ResponsiveImage 
              image={testImage}
              alt="Test image"
              width="100%"
              height="100%"
              objectFit="contain"
              isVisible={true}
            />
          </Box>
        ) : (
          <Text>Loading test image...</Text>
        )}
      </Flex>
      
      <VStack spacing={3} align="stretch">
        <Button colorScheme="blue" onClick={testDirectUrl}>
          Test Direct URL Fetch
        </Button>
        
        <Button colorScheme="orange" onClick={testIncorrectUrl}>
          Test with Incorrect URL Format
        </Button>
        
        <Button colorScheme="green" onClick={testBackblazeUrl}>
          Test with Direct Backblaze URL
        </Button>
      </VStack>
      
      <Box mt={4}>
        <Text fontWeight="semibold">Debug Info:</Text>
        <Box bg="gray.800" color="white" p={4} borderRadius="md" overflow="auto">
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {debugInfo}
          </pre>
        </Box>
      </Box>
    </VStack>
  );
};

export default ImageOptimizationTester;