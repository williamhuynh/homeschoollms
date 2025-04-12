import { Box, Breadcrumb, BreadcrumbItem, BreadcrumbLink, Heading } from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import ImageOptimizationTester from '../../components/test/ImageOptimizationTester';

/**
 * Test page for image optimization features
 */
const ImageOptimizationTestPage = () => {
  return (
    <Box p={4}>
      <Breadcrumb mb={4}>
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} to="/">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} to="/test">Test</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink>Image Optimization</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>
      
      <Heading as="h1" mb={6}>Image Optimization Testing</Heading>
      
      <Box bg="white" p={4} borderRadius="md" boxShadow="sm">
        <ImageOptimizationTester />
      </Box>
    </Box>
  );
};

export default ImageOptimizationTestPage;