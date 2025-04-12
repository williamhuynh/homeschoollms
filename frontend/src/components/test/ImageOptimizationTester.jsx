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
 * A component for testing and demonstrating image optimization features
 */
const ImageOptimizationTester = () => {
  const [testImages, setTestImages] = useState([]);
  const [testResults, setTestResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [networkCondition, setNetworkCondition] = useState('online');
  const [imageCount, setImageCount] = useState(10);
  const [useLazyLoading, setUseLazyLoading] = useState(true);
  const [containerWidth, setContainerWidth] = useState(300);
  const toast = useToast();

  // Setup image performance testing
  useEffect(() => {
    const observer = setupImagePerformanceTesting();
    return () => observer.disconnect();
  }, []);

  // Generate test images
  const generateTestImages = () => {
    setIsLoading(true);
    
    // Create an array of test images with different sizes
    const images = Array.from({ length: imageCount }, (_, i) => ({
      id: `test-image-${i}`,
      original_url: `https://picsum.photos/id/${(i % 30) + 10}/800/600`,
      thumbnail_small_url: `https://picsum.photos/id/${(i % 30) + 10}/150/150`,
      thumbnail_medium_url: `https://picsum.photos/id/${(i % 30) + 10}/400/300`,
      thumbnail_large_url: `https://picsum.photos/id/${(i % 30) + 10}/600/450`,
      title: `Test Image ${i + 1}`,
      description: `This is a test image for optimization testing (${i + 1})`
    }));
    
    setTestImages(images);
    setIsLoading(false);
    
    toast({
      title: 'Test images generated',
      description: `Created ${imageCount} test images`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  // Run performance test
  const runTest = async () => {
    setIsLoading(true);
    try {
      const results = await runImagePerformanceTest();
      setTestResults(results);
      
      toast({
        title: 'Performance test complete',
        description: 'Check the results panel for details',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error running performance test:', error);
      toast({
        title: 'Test failed',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Apply network throttling
  const applyNetworkThrottling = (condition) => {
    setNetworkCondition(condition);
    
    // This is just for demonstration - actual throttling would be done in browser dev tools
    toast({
      title: 'Network condition changed',
      description: `Set to ${condition}. Note: This is simulated. Use browser dev tools for actual throttling.`,
      status: 'info',
      duration: 5000,
      isClosable: true,
    });
  };

  return (
    <Container maxW="container.xl" py={8}>
      <Heading as="h1" mb={6}>Image Optimization Tester</Heading>
      
      <Flex direction={{ base: 'column', md: 'row' }} gap={8}>
        {/* Controls Panel */}
        <Box width={{ base: '100%', md: '300px' }} p={4} borderWidth={1} borderRadius="md">
          <Heading as="h2" size="md" mb={4}>Test Controls</Heading>
          
          <VStack spacing={4} align="stretch">
            <FormControl>
              <FormLabel>Network Condition</FormLabel>
              <Select 
                value={networkCondition}
                onChange={(e) => applyNetworkThrottling(e.target.value)}
              >
                <option value="online">Online (No Throttling)</option>
                <option value="fast3g">Fast 3G</option>
                <option value="slow3g">Slow 3G</option>
                <option value="offline">Offline</option>
              </Select>
            </FormControl>
            
            <FormControl>
              <FormLabel>Number of Test Images</FormLabel>
              <NumberInput 
                min={1} 
                max={50} 
                value={imageCount}
                onChange={(valueString) => setImageCount(parseInt(valueString))}
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
            </FormControl>
            
            <FormControl>
              <FormLabel>Container Width (px)</FormLabel>
              <NumberInput 
                min={100} 
                max={800} 
                value={containerWidth}
                onChange={(valueString) => setContainerWidth(parseInt(valueString))}
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
            </FormControl>
            
            <FormControl display="flex" alignItems="center">
              <FormLabel htmlFor="lazy-loading" mb="0">
                Use Lazy Loading
              </FormLabel>
              <Switch 
                id="lazy-loading" 
                isChecked={useLazyLoading}
                onChange={(e) => setUseLazyLoading(e.target.checked)}
              />
            </FormControl>
            
            <Button 
              colorScheme="blue" 
              onClick={generateTestImages}
              isLoading={isLoading}
            >
              Generate Test Images
            </Button>
            
            <Button 
              colorScheme="green" 
              onClick={runTest}
              isLoading={isLoading}
              isDisabled={testImages.length === 0}
            >
              Run Performance Test
            </Button>
          </VStack>
        </Box>
        
        {/* Test Results Panel */}
        <Box flex={1} p={4} borderWidth={1} borderRadius="md">
          <Heading as="h2" size="md" mb={4}>Test Results</Heading>
          
          {testResults ? (
            <VStack align="stretch" spacing={4}>
              <StatGroup>
                <Stat>
                  <StatLabel>Total Images</StatLabel>
                  <StatNumber>{testResults.currentMetrics.totalImages}</StatNumber>
                </Stat>
                
                <Stat>
                  <StatLabel>Total Size</StatLabel>
                  <StatNumber>{testResults.currentMetrics.performance.totalImageSizeKB} KB</StatNumber>
                  {testResults.comparison && (
                    <StatHelpText>
                      <StatArrow type={testResults.comparison.imageSizeImprovement > 0 ? 'decrease' : 'increase'} />
                      {Math.abs(testResults.comparison.imageSizeImprovement)}%
                    </StatHelpText>
                  )}
                </Stat>
                
                <Stat>
                  <StatLabel>Avg Load Time</StatLabel>
                  <StatNumber>{testResults.currentMetrics.performance.averageImageLoadTime} ms</StatNumber>
                  {testResults.comparison && (
                    <StatHelpText>
                      <StatArrow type={testResults.comparison.loadTimeImprovement > 0 ? 'decrease' : 'increase'} />
                      {Math.abs(testResults.comparison.loadTimeImprovement)}%
                    </StatHelpText>
                  )}
                </Stat>
              </StatGroup>
              
              <Divider />
              
              <Box>
                <Text fontWeight="bold">Thumbnail Usage:</Text>
                <HStack spacing={4} mt={2}>
                  <Stat size="sm">
                    <StatLabel>Small</StatLabel>
                    <StatNumber>{testResults.currentMetrics.thumbnailUsage.small}</StatNumber>
                  </Stat>
                  <Stat size="sm">
                    <StatLabel>Medium</StatLabel>
                    <StatNumber>{testResults.currentMetrics.thumbnailUsage.medium}</StatNumber>
                  </Stat>
                  <Stat size="sm">
                    <StatLabel>Large</StatLabel>
                    <StatNumber>{testResults.currentMetrics.thumbnailUsage.large}</StatNumber>
                  </Stat>
                </HStack>
              </Box>
              
              <Box>
                <Text fontWeight="bold">Lazy Loading:</Text>
                <HStack spacing={4} mt={2}>
                  <Stat size="sm">
                    <StatLabel>In Viewport</StatLabel>
                    <StatNumber>{testResults.currentMetrics.lazyLoading.imagesInViewport}</StatNumber>
                  </Stat>
                  <Stat size="sm">
                    <StatLabel>Outside Viewport</StatLabel>
                    <StatNumber>{testResults.currentMetrics.lazyLoading.imagesOutsideViewport}</StatNumber>
                  </Stat>
                </HStack>
              </Box>
              
              <Divider />
              
              <Box>
                <Text fontWeight="bold">Raw Data:</Text>
                <Box mt={2} p={2} bg="gray.50" borderRadius="md" maxH="200px" overflowY="auto">
                  <Code display="block" whiteSpace="pre" fontSize="xs">
                    {JSON.stringify(testResults, null, 2)}
                  </Code>
                </Box>
              </Box>
            </VStack>
          ) : (
            <Text color="gray.500">Run a performance test to see results</Text>
          )}
        </Box>
      </Flex>
      
      {/* Image Gallery */}
      <Box mt={8}>
        <Heading as="h2" size="md" mb={4}>Test Images</Heading>
        
        {testImages.length > 0 ? (
          <Flex flexWrap="wrap" gap={4}>
            {testImages.map((image) => (
              <Box 
                key={image.id} 
                width={`${containerWidth}px`}
                className="responsive-image-container"
                data-testid="responsive-image"
              >
                {useLazyLoading ? (
                  <LazyImage
                    image={image}
                    alt={image.title}
                    width="100%"
                    height="auto"
                    aspectRatio={4/3}
                  />
                ) : (
                  <ResponsiveImage
                    image={image}
                    alt={image.title}
                    width="100%"
                    height="auto"
                    objectFit="cover"
                  />
                )}
                <Text fontSize="sm" mt={1}>{image.title}</Text>
              </Box>
            ))}
          </Flex>
        ) : (
          <Text color="gray.500">Generate test images to display them here</Text>
        )}
      </Box>
    </Container>
  );
};

export default ImageOptimizationTester;