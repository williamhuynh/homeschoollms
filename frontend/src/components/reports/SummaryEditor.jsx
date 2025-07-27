import {
  Box,
  VStack,
  HStack,
  Textarea,
  Button,
  IconButton,
  Tooltip,
  useToast,
  Text,
  Divider
} from '@chakra-ui/react'
import { 
  Bold, 
  Italic, 
  List, 
  Type, 
  RotateCcw, 
  Save, 
  X,
  Copy,
  FileText
} from 'react-feather'
import { useState, useRef } from 'react'

const SummaryEditor = ({ 
  initialValue, 
  onSave, 
  onCancel, 
  saving = false,
  placeholder = "Enter summary...",
  maxLength = 2000
}) => {
  const [value, setValue] = useState(initialValue || '')
  const [wordCount, setWordCount] = useState(0)
  const textareaRef = useRef(null)
  const toast = useToast()

  const handleChange = (e) => {
    const newValue = e.target.value
    if (newValue.length <= maxLength) {
      setValue(newValue)
      // Count words (split by whitespace and filter empty strings)
      const words = newValue.trim().split(/\s+/).filter(word => word.length > 0)
      setWordCount(words.length)
    }
  }

  const insertText = (textToInsert) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newValue = value.substring(0, start) + textToInsert + value.substring(end)
    
    if (newValue.length <= maxLength) {
      setValue(newValue)
      // Update word count
      const words = newValue.trim().split(/\s+/).filter(word => word.length > 0)
      setWordCount(words.length)
      
      // Set cursor position after inserted text
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length)
      }, 0)
    }
  }

  const wrapSelectedText = (prefix, suffix = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)
    
    if (selectedText) {
      const newValue = value.substring(0, start) + prefix + selectedText + suffix + value.substring(end)
      if (newValue.length <= maxLength) {
        setValue(newValue)
        setTimeout(() => {
          textarea.focus()
          textarea.setSelectionRange(start + prefix.length, end + prefix.length)
        }, 0)
      }
    } else {
      // No selection, just insert the markers
      insertText(prefix + suffix)
    }
  }

  const handleBold = () => {
    wrapSelectedText('**', '**')
  }

  const handleItalic = () => {
    wrapSelectedText('*', '*')
  }

  const handleBulletPoint = () => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const isAtLineStart = start === lineStart
    
    if (isAtLineStart) {
      insertText('• ')
    } else {
      insertText('\n• ')
    }
  }

  const handleParagraphBreak = () => {
    insertText('\n\n')
  }

  const handleReset = () => {
    setValue(initialValue || '')
    const words = (initialValue || '').trim().split(/\s+/).filter(word => word.length > 0)
    setWordCount(words.length)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      toast({
        title: 'Copied to clipboard',
        status: 'success',
        duration: 1500,
        isClosable: true,
      })
    }).catch(() => {
      toast({
        title: 'Failed to copy',
        status: 'error',
        duration: 2000,
        isClosable: true,
      })
    })
  }

  const getCharacterCountColor = () => {
    const percentage = (value.length / maxLength) * 100
    if (percentage >= 95) return 'red.500'
    if (percentage >= 80) return 'orange.500'
    return 'gray.500'
  }

  return (
    <VStack align="stretch" spacing={3}>
      {/* Toolbar */}
      <Box bg="gray.50" p={2} borderRadius="md">
        <HStack spacing={1} wrap="wrap">
          <Tooltip label="Bold text (wrap selection with **)">
            <IconButton
              icon={<Bold size={16} />}
              size="sm"
              variant="ghost"
              onClick={handleBold}
              aria-label="Bold"
            />
          </Tooltip>
          
          <Tooltip label="Italic text (wrap selection with *)">
            <IconButton
              icon={<Italic size={16} />}
              size="sm"
              variant="ghost"
              onClick={handleItalic}
              aria-label="Italic"
            />
          </Tooltip>
          
          <Tooltip label="Add bullet point">
            <IconButton
              icon={<List size={16} />}
              size="sm"
              variant="ghost"
              onClick={handleBulletPoint}
              aria-label="Bullet point"
            />
          </Tooltip>
          
          <Tooltip label="Add paragraph break">
            <IconButton
              icon={<Type size={16} />}
              size="sm"
              variant="ghost"
              onClick={handleParagraphBreak}
              aria-label="Paragraph break"
            />
          </Tooltip>

          <Divider orientation="vertical" height="24px" mx={1} />
          
          <Tooltip label="Copy text">
            <IconButton
              icon={<Copy size={16} />}
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              aria-label="Copy"
            />
          </Tooltip>
          
          <Tooltip label="Reset to original">
            <IconButton
              icon={<RotateCcw size={16} />}
              size="sm"
              variant="ghost"
              onClick={handleReset}
              aria-label="Reset"
              isDisabled={value === (initialValue || '')}
            />
          </Tooltip>
        </HStack>
      </Box>

      {/* Text Area */}
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        minHeight="200px"
        resize="vertical"
        fontSize="sm"
        lineHeight="tall"
        focusBorderColor="blue.500"
      />

      {/* Status Bar */}
      <HStack justify="space-between" fontSize="xs" color="gray.600">
        <Text>
          {wordCount} words • {value.length}/{maxLength} characters
        </Text>
        <Text color={getCharacterCountColor()}>
          {maxLength - value.length} characters remaining
        </Text>
      </HStack>

      {/* Action Buttons */}
      <HStack justify="flex-end" spacing={2}>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          leftIcon={<X size={16} />}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          colorScheme="blue"
          onClick={() => onSave(value)}
          isLoading={saving}
          loadingText="Saving..."
          leftIcon={<Save size={16} />}
          isDisabled={!value.trim()}
        >
          Save Changes
        </Button>
      </HStack>

      {/* Writing Tips */}
      <Box bg="blue.50" p={3} borderRadius="md" fontSize="sm">
        <Text fontWeight="medium" color="blue.800" mb={1}>
          Writing Tips:
        </Text>
        <Text color="blue.700" lineHeight="short">
          • Use **bold** for emphasis and *italic* for subtle emphasis
          <br />
          • Focus on what the child accomplished and learned
          <br />
          • Keep it professional yet warm for parent-teacher communication
        </Text>
      </Box>
    </VStack>
  )
}

export default SummaryEditor 