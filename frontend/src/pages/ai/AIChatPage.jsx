import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Container, Flex, Heading, HStack, IconButton, Input, Spinner, Text, VStack, useToast, Avatar, Divider } from '@chakra-ui/react'
import { ArrowLeft, Send } from 'react-feather'
import { useNavigate, useParams } from 'react-router-dom'
import { useStudents } from '../../contexts/StudentsContext'
import { chatWithAI } from '../../services/api'

const MessageBubble = ({ role, content }) => {
  const isUser = role === 'user'
  return (
    <Flex w="100%" justify={isUser ? 'flex-end' : 'flex-start'} my={2}>
      <Box
        maxW="85%"
        bg={isUser ? 'teal.500' : 'gray.100'}
        color={isUser ? 'white' : 'gray.800'}
        px={4}
        py={3}
        borderRadius={isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px'}
        boxShadow="sm"
        whiteSpace="pre-wrap"
      >
        <Text fontSize="md">{content}</Text>
      </Box>
    </Flex>
  )
}

const AIChatPage = () => {
  const navigate = useNavigate()
  const { studentId } = useParams()
  const { students } = useStudents()
  const toast = useToast()
  const [isSending, setIsSending] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I am your homeschool co-pilot. How can I help you today?' }
  ])
  const scrollRef = useRef(null)

  const student = useMemo(() => (
    students.find(s => s._id === studentId || s.id === studentId || s.slug === studentId)
  ), [students, studentId])

  useEffect(() => {
    if (!student) return
    document.title = `AI Chat - ${student.first_name} ${student.last_name}`
  }, [student])

  useEffect(() => {
    // Auto-scroll to bottom when messages change
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isSending) return
    if (!student) {
      toast({ title: 'No student selected', description: 'Open a student first.', status: 'warning', duration: 3000, isClosable: true })
      return
    }

    const nextMessages = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setIsSending(true)
    try {
      const { reply } = await chatWithAI(student._id || student.id || student.slug, nextMessages)
      setMessages(prev => [...prev, { role: 'assistant', content: reply || '...' }])
    } catch (error) {
      console.error('Chat send error:', error)
      toast({ title: 'AI error', description: error.message || 'Failed to get a response', status: 'error', duration: 4000, isClosable: true })
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Box minH="100vh" bg="gray.50">
      <Container maxW="container.md" p={0}>
        <HStack px={4} py={3} spacing={3} bg="white" borderBottomWidth="1px" position="sticky" top={0} zIndex={10}>
          <IconButton icon={<ArrowLeft />} variant="ghost" onClick={() => navigate(-1)} aria-label="Back" />
          <Avatar name={student ? `${student.first_name} ${student.last_name}` : 'AI'} size="sm" />
          <Box>
            <Heading size="sm">AI Chat</Heading>
            <Text fontSize="xs" color="gray.500">{student ? `${student.first_name} ${student.last_name} • ${student.grade_level}` : 'No student selected'}</Text>
          </Box>
        </HStack>

        <Box ref={scrollRef} h="calc(100vh - 180px)" overflowY="auto" px={4} py={3}>
          <VStack align="stretch" spacing={0}>
            {messages.map((m, idx) => (
              <MessageBubble key={idx} role={m.role} content={m.content} />
            ))}
          </VStack>
        </Box>

        <Divider />

        <HStack px={3} py={3} bg="white" spacing={2}>
          <Input
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            bg="gray.100"
          />
          <IconButton
            icon={isSending ? <Spinner size="sm" /> : <Send />}
            colorScheme="teal"
            onClick={handleSend}
            aria-label="Send"
            isDisabled={isSending || !input.trim()}
          />
        </HStack>
      </Container>
    </Box>
  )
}

export default AIChatPage