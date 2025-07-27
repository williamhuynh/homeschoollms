import React from 'react'
import {
  Box,
  VStack,
  Heading,
  Text,
  Button,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Code,
  Collapse,
  useDisclosure
} from '@chakra-ui/react'
import { RefreshCw, AlertTriangle, ChevronDown, ChevronUp } from 'react-feather'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    })
    
    // Log error to console for debugging
    console.error('Report Error Boundary caught an error:', error, errorInfo)
    
    // You could also send error to logging service here
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={() => {
            this.setState({ hasError: false, error: null, errorInfo: null })
            if (this.props.onRetry) {
              this.props.onRetry()
            }
          }}
          fallbackComponent={this.props.fallbackComponent}
        />
      )
    }

    return this.props.children
  }
}

const ErrorFallback = ({ error, errorInfo, onRetry, fallbackComponent }) => {
  const { isOpen, onToggle } = useDisclosure()

  if (fallbackComponent) {
    return fallbackComponent({ error, errorInfo, onRetry })
  }

  const isReportError = error?.message?.includes('report') || 
                       error?.message?.includes('generate') ||
                       error?.message?.includes('summary')

  return (
    <Box p={6} maxW="600px" mx="auto">
      <Alert status="error" mb={4} borderRadius="md">
        <AlertIcon />
        <Box>
          <AlertTitle mr={2}>
            {isReportError ? 'Report Error!' : 'Something went wrong!'}
          </AlertTitle>
          <AlertDescription>
            {isReportError 
              ? 'There was an issue loading or generating the report. This might be due to network connectivity or server issues.'
              : 'An unexpected error occurred. Please try refreshing the page.'
            }
          </AlertDescription>
        </Box>
      </Alert>

      <VStack spacing={4} align="stretch">
        <Box>
          <Text fontWeight="medium" mb={2}>What you can try:</Text>
          <VStack align="start" spacing={1} fontSize="sm" color="gray.600">
            <Text>• Check your internet connection</Text>
            <Text>• Refresh the page or try again</Text>
            <Text>• Go back and try a different action</Text>
            {isReportError && (
              <Text>• Try generating the report again later</Text>
            )}
          </VStack>
        </Box>

        <Button
          leftIcon={<RefreshCw size={16} />}
          colorScheme="blue"
          onClick={onRetry}
          size="sm"
        >
          Try Again
        </Button>

        {/* Technical Details (collapsed by default) */}
        <Box>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            rightIcon={isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            leftIcon={<AlertTriangle size={16} />}
          >
            Technical Details
          </Button>
          
          <Collapse in={isOpen} animateOpacity>
            <Box mt={3} p={3} bg="gray.50" borderRadius="md" fontSize="sm">
              {error && (
                <Box mb={3}>
                  <Text fontWeight="medium" mb={1}>Error Message:</Text>
                  <Code p={2} display="block" whiteSpace="pre-wrap" bg="red.50" color="red.700">
                    {error.toString()}
                  </Code>
                </Box>
              )}
              
              {errorInfo && errorInfo.componentStack && (
                <Box>
                  <Text fontWeight="medium" mb={1}>Component Stack:</Text>
                  <Code p={2} display="block" whiteSpace="pre-wrap" bg="gray.100" fontSize="xs">
                    {errorInfo.componentStack}
                  </Code>
                </Box>
              )}
            </Box>
          </Collapse>
        </Box>
      </VStack>
    </Box>
  )
}

// Hook for functional components
export const useErrorHandler = () => {
  const handleError = (error, errorInfo) => {
    console.error('Component error:', error, errorInfo)
    // Could send to error tracking service
  }

  return { handleError }
}

// Higher-order component wrapper
export const withErrorBoundary = (Component, errorFallback) => {
  const WrappedComponent = (props) => (
    <ErrorBoundary fallbackComponent={errorFallback}>
      <Component {...props} />
    </ErrorBoundary>
  )
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  return WrappedComponent
}

export default ErrorBoundary 