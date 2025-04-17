import { Box, Heading, Container } from '@chakra-ui/react';
import ImageOptimizationTester from '../src/components/test/ImageOptimizationTester';

const TestImageOptimizationPage = () => {
  return (
    <Container maxW="container.lg" py={8}>
      <Heading mb={6}>Image Optimization Test Page</Heading>
      <Box borderWidth="1px" borderRadius="lg" overflow="hidden" p={4}>
        <ImageOptimizationTester />
      </Box>
    </Container>
  );
};

export default TestImageOptimizationPage; 