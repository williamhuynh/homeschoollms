import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Avatar,
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  IconButton,
  Input,
  Select,
  Spinner,
  Text,
  useBreakpointValue,
  useToast,
  VStack,
} from '@chakra-ui/react'
import { ArrowLeft, Camera, Save } from 'react-feather'
import { getStudentBySlug, updateStudent, uploadStudentAvatar } from '../../services/api'
import { useStudents } from '../../contexts/StudentsContext'

const StudentEditPage = () => {
  const { studentId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const { updateStudent: updateStudentInContext } = useStudents()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [student, setStudent] = useState(location.state?.student || null)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    grade_level: '',
    gender: 'prefer_not_to_say',
  })
  const [previewUrl, setPreviewUrl] = useState(null)
  const fileInputRef = useRef(null)
  const avatarBoxSize = useBreakpointValue({ base: '96px', md: '128px' })

  useEffect(() => {
    const load = async () => {
      try {
        const data = location.state?.student || await getStudentBySlug(studentId)
        setStudent(data)
        setFormData({
          first_name: data.first_name,
          last_name: data.last_name,
          date_of_birth: (data.date_of_birth || '').slice(0, 10),
          grade_level: data.grade_level || '',
          gender: data.gender || 'prefer_not_to_say',
        })
      } catch (err) {
        toast({ title: 'Failed to load student', status: 'error', description: err?.response?.data?.detail || err.message })
        navigate(`/students/${studentId}/progress`)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [studentId])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updates = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        date_of_birth: formData.date_of_birth,
        grade_level: formData.grade_level,
        gender: formData.gender,
      }
      const updated = await updateStudent(studentId, updates)
      setStudent(updated)
      updateStudentInContext(updated)
      toast({ title: 'Profile updated', status: 'success' })
      // If slug changed due to name change, navigate using new slug
      const newSlug = updated.slug || student.slug || studentId
      if (newSlug !== studentId) {
        navigate(`/students/${newSlug}/progress`, { replace: true })
      }
    } catch (err) {
      toast({ title: 'Update failed', status: 'error', description: err?.response?.data?.detail || err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleChangeAvatarClick = () => fileInputRef.current?.click()

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Show local preview
    const blobUrl = URL.createObjectURL(file)
    setPreviewUrl(blobUrl)

    setUploading(true)
    try {
      const updated = await uploadStudentAvatar(studentId, file)
      setStudent(updated)
      updateStudentInContext(updated)
      setPreviewUrl(null)
      toast({ title: 'Profile picture updated', status: 'success' })
    } catch (err) {
      toast({ title: 'Upload failed', status: 'error', description: err?.response?.data?.detail || err.message })
    } finally {
      setUploading(false)
      // cleanup preview blob
      setTimeout(() => {
        if (previewUrl) URL.revokeObjectURL(previewUrl)
      }, 500)
    }
  }

  if (loading) {
    return (
      <Container maxW="container.sm" py={8}>
        <VStack>
          <Spinner />
        </VStack>
      </Container>
    )
  }

  const currentAvatar = previewUrl || student?.avatar_url || student?.avatar_thumbnail_url || ''

  return (
    <Container maxW="container.sm" py={8}>
      <Button
        leftIcon={<ArrowLeft size={18} />}
        variant="ghost"
        onClick={() => navigate(-1)}
        mb={2}
        alignSelf="flex-start"
      >
        Back
      </Button>

      <VStack spacing={6} align="stretch">
        <Heading size="lg">Edit {student?.first_name} {student?.last_name}</Heading>

        <HStack spacing={4} align="center">
          <Avatar boxSize={avatarBoxSize} name={`${student?.first_name} ${student?.last_name}`} src={currentAvatar} />
          <div>
            <Button
              leftIcon={<Camera size={16} />}
              onClick={handleChangeAvatarClick}
              isLoading={uploading}
              loadingText="Uploading"
              colorScheme="blue"
              size="sm"
            >
              Change Photo
            </Button>
            <Input type="file" accept="image/*" ref={fileInputRef} display="none" onChange={handleFileSelected} />
            <Text fontSize="xs" color="gray.500" mt={1}>JPEG/PNG, up to ~5MB</Text>
          </div>
        </HStack>

        <Box as="form" onSubmit={handleSave}>
          <VStack spacing={4} align="stretch">
            <HStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>First Name</FormLabel>
                <Input name="first_name" value={formData.first_name} onChange={handleChange} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Last Name</FormLabel>
                <Input name="last_name" value={formData.last_name} onChange={handleChange} />
              </FormControl>
            </HStack>

            <FormControl isRequired>
              <FormLabel>Date of Birth</FormLabel>
              <Input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} />
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Grade Level</FormLabel>
              <Select name="grade_level" value={formData.grade_level} onChange={handleChange}>
                <option value="">Select grade</option>
                <option value="K">Kindergarten</option>
                <option value="1">1st Grade</option>
                <option value="2">2nd Grade</option>
                <option value="3">3rd Grade</option>
                <option value="4">4th Grade</option>
                <option value="5">5th Grade</option>
                <option value="6">6th Grade</option>
                <option value="7">7th Grade</option>
                <option value="8">8th Grade</option>
                <option value="9">9th Grade</option>
                <option value="10">10th Grade</option>
                <option value="11">11th Grade</option>
                <option value="12">12th Grade</option>
              </Select>
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Gender</FormLabel>
              <Select name="gender" value={formData.gender} onChange={handleChange}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </Select>
            </FormControl>

            <HStack justify="flex-end">
              <Button variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
              <Button type="submit" colorScheme="blue" leftIcon={<Save size={16} />} isLoading={saving}>Save Changes</Button>
            </HStack>
          </VStack>
        </Box>
      </VStack>
    </Container>
  )
}

export default StudentEditPage