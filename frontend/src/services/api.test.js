/**
 * Tests for the API service (api.js).
 *
 * Covers the main API functions: auth, students, reports, evidence,
 * AI helpers, subscriptions, and admin endpoints.
 * All HTTP calls are mocked via vi.mock('axios').
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------- mocks must be declared before imports ----------

// Mock supabase module
vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  },
  getSession: vi.fn().mockResolvedValue({ access_token: 'test-token' }),
}))

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    breadcrumb: vi.fn(),
  },
}))

// We'll mock axios at the instance level
vi.mock('axios', () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    defaults: { baseURL: 'http://localhost:8000' },
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  }
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
    },
  }
})

// Now import the module under test and the mocked dependencies
import axios from 'axios'
import { supabase } from './supabase'

// Get the mock instance that api.js uses
const mockApi = axios.create()

// We need to import the api functions AFTER mocks are set up
import * as api from './api'

beforeEach(() => {
  vi.clearAllMocks()
})

// ========================
// Auth
// ========================
describe('Auth functions', () => {
  describe('login', () => {
    it('should call supabase signInWithPassword and return token', async () => {
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: { access_token: 'abc123' } },
        error: null,
      })

      const result = await api.login({ email: 'user@test.com', password: 'pass' })
      expect(result.data.token).toBe('abc123')
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'user@test.com',
        password: 'pass',
      })
    })

    it('should use username field if email not provided', async () => {
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: { access_token: 'abc123' } },
        error: null,
      })

      await api.login({ username: 'user@test.com', password: 'pass' })
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'user@test.com',
        password: 'pass',
      })
    })

    it('should throw on supabase error', async () => {
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: {},
        error: new Error('Invalid credentials'),
      })

      await expect(api.login({ email: 'bad@test.com', password: 'wrong' }))
        .rejects.toThrow('Invalid credentials')
    })
  })

  describe('logout', () => {
    it('should call supabase signOut', async () => {
      supabase.auth.signOut.mockResolvedValue({ error: null })

      const result = await api.logout()
      expect(result).toBe(true)
      expect(supabase.auth.signOut).toHaveBeenCalled()
    })

    it('should throw on signOut error', async () => {
      supabase.auth.signOut.mockResolvedValue({ error: new Error('Sign out failed') })

      await expect(api.logout()).rejects.toThrow('Sign out failed')
    })
  })
})

// ========================
// Health Check
// ========================
describe('healthCheck', () => {
  it('should call GET /health', async () => {
    mockApi.get.mockResolvedValue({ data: { status: 'healthy' } })

    const result = await api.healthCheck()
    expect(result).toEqual({ status: 'healthy' })
  })

  it('should throw on error', async () => {
    mockApi.get.mockRejectedValue(new Error('Network error'))

    await expect(api.healthCheck()).rejects.toThrow('Network error')
  })
})

// ========================
// User
// ========================
describe('getCurrentUser', () => {
  it('should call GET /api/users/me', async () => {
    const userData = { email: 'user@test.com', role: 'parent' }
    mockApi.get.mockResolvedValue({ data: userData })

    const result = await api.getCurrentUser()
    expect(result).toEqual(userData)
  })
})

// ========================
// Students
// ========================
describe('Student functions', () => {
  describe('createStudent', () => {
    it('should POST to /api/students/ with formatted data', async () => {
      const studentData = { first_name: 'Alice', last_name: 'Smith' }
      mockApi.post.mockResolvedValue({ data: { _id: '123', ...studentData } })

      const result = await api.createStudent(studentData)
      expect(result._id).toBe('123')
      expect(mockApi.post).toHaveBeenCalledWith('/api/students/', expect.objectContaining({
        first_name: 'Alice',
        parent_ids: [],
        organization_id: null,
        family_id: null,
        subjects: {},
        active_subjects: [],
      }))
    })

    it('should preserve existing parent_ids if provided', async () => {
      const studentData = { first_name: 'Bob', parent_ids: ['parent1'] }
      mockApi.post.mockResolvedValue({ data: { _id: '456' } })

      await api.createStudent(studentData)
      expect(mockApi.post).toHaveBeenCalledWith('/api/students/', expect.objectContaining({
        parent_ids: ['parent1'],
      }))
    })
  })

  describe('getStudents', () => {
    it('should GET /api/students/for-parent', async () => {
      const students = [{ _id: '1', first_name: 'Alice' }]
      mockApi.get.mockResolvedValue({ data: students })

      const result = await api.getStudents()
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('1')
    })

    it('should pass access_level param when provided', async () => {
      mockApi.get.mockResolvedValue({ data: [] })

      await api.getStudents('admin')
      expect(mockApi.get).toHaveBeenCalledWith('/api/students/for-parent', {
        params: { access_level: 'admin' },
      })
    })
  })

  describe('getStudentsWithAdminAccess', () => {
    it('should call getStudents with admin access level', async () => {
      mockApi.get.mockResolvedValue({ data: [] })

      await api.getStudentsWithAdminAccess()
      expect(mockApi.get).toHaveBeenCalledWith('/api/students/for-parent', {
        params: { access_level: 'admin' },
      })
    })
  })

  describe('getStudentBySlug', () => {
    it('should GET /api/students/by-slug/{slug}', async () => {
      mockApi.get.mockResolvedValue({ data: { slug: 'alice-smith' } })

      const result = await api.getStudentBySlug('alice-smith')
      expect(result.slug).toBe('alice-smith')
    })
  })

  describe('deleteStudent', () => {
    it('should validate ObjectId format', async () => {
      await expect(api.deleteStudent('invalid-id'))
        .rejects.toThrow('Invalid student ID format')
    })

    it('should DELETE with valid ObjectId', async () => {
      const validId = 'aabbccddeeff00112233aabb'
      mockApi.delete.mockResolvedValue({ data: { message: 'deleted' } })

      const result = await api.deleteStudent(validId)
      expect(result.message).toBe('deleted')
    })
  })

  describe('updateStudent', () => {
    it('should PATCH by ObjectId path', async () => {
      const objectId = 'aabbccddeeff00112233aabb'
      mockApi.patch.mockResolvedValue({ data: { updated: true } })

      await api.updateStudent(objectId, { first_name: 'Updated' })
      expect(mockApi.patch).toHaveBeenCalledWith(
        `/api/students/${objectId}`,
        { first_name: 'Updated' }
      )
    })

    it('should PATCH by slug path', async () => {
      mockApi.patch.mockResolvedValue({ data: { updated: true } })

      await api.updateStudent('alice-smith', { first_name: 'Updated' })
      expect(mockApi.patch).toHaveBeenCalledWith(
        '/api/students/by-slug/alice-smith',
        { first_name: 'Updated' }
      )
    })
  })

  describe('updateStudentGrade', () => {
    it('should PATCH grade level', async () => {
      mockApi.patch.mockResolvedValue({ data: { grade_level: 'Year 4' } })

      const result = await api.updateStudentGrade('alice-smith', 'Year 4')
      expect(mockApi.patch).toHaveBeenCalledWith(
        '/api/students/alice-smith/grade',
        { new_grade_level: 'Year 4' }
      )
    })
  })

  describe('uploadStudentAvatar', () => {
    it('should POST FormData with file', async () => {
      const file = new File(['data'], 'avatar.png', { type: 'image/png' })
      mockApi.post.mockResolvedValue({ data: { avatar_url: 'http://example.com/avatar.png' } })

      const result = await api.uploadStudentAvatar('alice-smith', file)
      expect(result.avatar_url).toBe('http://example.com/avatar.png')
      expect(mockApi.post).toHaveBeenCalledWith(
        '/api/students/alice-smith/avatar',
        expect.any(FormData),
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
    })
  })
})

// ========================
// Parent Access
// ========================
describe('Parent Access functions', () => {
  describe('getStudentParents', () => {
    it('should GET parents for student', async () => {
      mockApi.get.mockResolvedValue({ data: [{ email: 'parent@test.com' }] })

      const result = await api.getStudentParents('student123')
      expect(result).toHaveLength(1)
    })
  })

  describe('addParentAccess', () => {
    it('should POST parent access', async () => {
      mockApi.post.mockResolvedValue({ data: { success: true } })

      await api.addParentAccess('student123', 'new@test.com', 'content')
      expect(mockApi.post).toHaveBeenCalledWith('/api/students/student123/parents', {
        email: 'new@test.com',
        access_level: 'content',
      })
    })
  })

  describe('updateParentAccess', () => {
    it('should PUT parent access level', async () => {
      mockApi.put.mockResolvedValue({ data: { success: true } })

      await api.updateParentAccess('student123', 'parent456', 'admin')
      expect(mockApi.put).toHaveBeenCalledWith(
        '/api/students/student123/parents/parent456',
        { access_level: 'admin' }
      )
    })
  })

  describe('removeParentAccess', () => {
    it('should DELETE parent access', async () => {
      mockApi.delete.mockResolvedValue({ data: { success: true } })

      await api.removeParentAccess('student123', 'parent456')
      expect(mockApi.delete).toHaveBeenCalledWith(
        '/api/students/student123/parents/parent456'
      )
    })
  })
})

// ========================
// Reports
// ========================
describe('Report functions', () => {
  describe('getStudentReports', () => {
    it('should GET reports for student', async () => {
      mockApi.get.mockResolvedValue({ data: [{ _id: 'r1', title: 'Report 1' }] })

      const result = await api.getStudentReports('student123')
      expect(result).toHaveLength(1)
    })

    it('should pass query params', async () => {
      mockApi.get.mockResolvedValue({ data: [] })

      await api.getStudentReports('student123', { year: 2025 })
      expect(mockApi.get).toHaveBeenCalledWith('/api/reports/student123', {
        params: { year: 2025 },
      })
    })
  })

  describe('generateReport', () => {
    it('should POST report generation request', async () => {
      mockApi.post.mockResolvedValue({ data: { _id: 'r1', status: 'generating' } })

      const result = await api.generateReport('student123', {
        report_period: 'annual',
        grade_level: 'Year 3',
      })
      expect(result.status).toBe('generating')
    })

    it('should throw with detail message on error', async () => {
      mockApi.post.mockRejectedValue({
        response: { data: { detail: 'Subscription limit reached' } },
      })

      await expect(api.generateReport('s1', {}))
        .rejects.toThrow('Subscription limit reached')
    })
  })

  describe('deleteReport', () => {
    it('should DELETE report', async () => {
      mockApi.delete.mockResolvedValue({ data: { message: 'deleted' } })

      const result = await api.deleteReport('student123', 'report456')
      expect(result.message).toBe('deleted')
    })
  })

  describe('updateReportTitle', () => {
    it('should PUT new title', async () => {
      mockApi.put.mockResolvedValue({ data: { title: 'New Title' } })

      await api.updateReportTitle('s1', 'r1', 'New Title')
      expect(mockApi.put).toHaveBeenCalledWith(
        '/api/reports/s1/r1/title',
        { title: 'New Title' }
      )
    })
  })

  describe('updateReportStatus', () => {
    it('should PUT new status', async () => {
      mockApi.put.mockResolvedValue({ data: { status: 'final' } })

      await api.updateReportStatus('s1', 'r1', 'final')
      expect(mockApi.put).toHaveBeenCalledWith(
        '/api/reports/s1/r1/status',
        { status: 'final' }
      )
    })
  })

  describe('regenerateReport', () => {
    it('should POST regeneration request', async () => {
      mockApi.post.mockResolvedValue({ data: { status: 'generating' } })

      const result = await api.regenerateReport('s1', 'r1')
      expect(result.status).toBe('generating')
    })
  })

  describe('updateReportOverview', () => {
    it('should PUT parent overview', async () => {
      mockApi.put.mockResolvedValue({ data: { parent_overview: 'Great progress!' } })

      await api.updateReportOverview('s1', 'r1', 'Great progress!')
      expect(mockApi.put).toHaveBeenCalledWith(
        '/api/reports/s1/r1/overview',
        { parent_overview: 'Great progress!' }
      )
    })
  })

  describe('getReportById', () => {
    it('should GET specific report', async () => {
      mockApi.get.mockResolvedValue({ data: { _id: 'r1', title: 'Report' } })

      const result = await api.getReportById('s1', 'r1')
      expect(result._id).toBe('r1')
    })
  })

  describe('updateLearningAreaSummary', () => {
    it('should PUT learning area summary', async () => {
      mockApi.put.mockResolvedValue({ data: { updated: true } })

      await api.updateLearningAreaSummary('s1', 'r1', 'MA', { summary: 'Good' })
      expect(mockApi.put).toHaveBeenCalledWith(
        '/api/reports/s1/r1/learning-area/MA',
        { summary: 'Good' }
      )
    })
  })
})

// ========================
// Evidence / Learning Outcomes
// ========================
describe('Evidence functions', () => {
  describe('uploadEvidence', () => {
    it('should POST FormData to evidence endpoint', async () => {
      const formData = new FormData()
      mockApi.post.mockResolvedValue({ data: { _id: 'ev1' } })

      const result = await api.uploadEvidence('s1', 'MA2-RN-01', formData)
      expect(result._id).toBe('ev1')
      expect(mockApi.post).toHaveBeenCalledWith(
        '/api/learning-outcomes/s1/MA2-RN-01/evidence',
        formData,
        { headers: { 'Content-Type': null } }
      )
    })
  })

  describe('updateEvidence', () => {
    it('should PATCH evidence', async () => {
      mockApi.patch.mockResolvedValue({ data: { updated: true } })

      await api.updateEvidence('s1', 'MA2-RN-01', 'ev1', { description: 'Updated' })
      expect(mockApi.patch).toHaveBeenCalledWith(
        '/api/learning-outcomes/s1/MA2-RN-01/evidence/ev1',
        { description: 'Updated' }
      )
    })
  })

  describe('uploadEvidenceMultiOutcome', () => {
    it('should POST to multi-outcome endpoint', async () => {
      const formData = new FormData()
      mockApi.post.mockResolvedValue({ data: { success: true } })

      await api.uploadEvidenceMultiOutcome('s1', formData)
      expect(mockApi.post).toHaveBeenCalledWith(
        '/api/evidence/s1',
        formData,
        { headers: { 'Content-Type': null } }
      )
    })
  })

  describe('getLearningOutcome', () => {
    it('should GET learning outcome', async () => {
      mockApi.get.mockResolvedValue({ data: { code: 'MA2-RN-01' } })

      const result = await api.getLearningOutcome('s1', 'MA2-RN-01')
      expect(result.code).toBe('MA2-RN-01')
    })
  })

  describe('getEvidenceForLearningOutcome', () => {
    it('should GET evidence list', async () => {
      mockApi.get.mockResolvedValue({ data: [{ _id: 'ev1' }] })

      const result = await api.getEvidenceForLearningOutcome('s1', 'MA2-RN-01')
      expect(result).toHaveLength(1)
    })

    it('should include student_grade param when provided', async () => {
      mockApi.get.mockResolvedValue({ data: [] })

      await api.getEvidenceForLearningOutcome('s1', 'MA2-RN-01', 'Year 3')
      expect(mockApi.get).toHaveBeenCalledWith(
        '/api/learning-outcomes/s1/MA2-RN-01/evidence',
        { params: { student_grade: 'Year 3' } }
      )
    })
  })

  describe('getBatchEvidenceForOutcomes', () => {
    it('should GET batch evidence with comma-separated outcomes', async () => {
      mockApi.get.mockResolvedValue({ data: { 'MA2-RN-01': { _id: 'ev1' } } })

      const result = await api.getBatchEvidenceForOutcomes('s1', ['MA2-RN-01', 'MA2-RN-02'])
      expect(result).toHaveProperty('MA2-RN-01')
    })

    it('should return empty object on error', async () => {
      mockApi.get.mockRejectedValue(new Error('Network error'))

      const result = await api.getBatchEvidenceForOutcomes('s1', ['MA2-RN-01'])
      expect(result).toEqual({})
    })
  })
})

// ========================
// AI Helpers
// ========================
describe('AI functions', () => {
  describe('generateAIDescription', () => {
    it('should throw if no files provided', async () => {
      await expect(api.generateAIDescription([], 'context'))
        .rejects.toThrow('No files provided')
    })

    it('should throw if no context provided', async () => {
      await expect(api.generateAIDescription([new File(['x'], 'test.png')], ''))
        .rejects.toThrow('No context description provided')
    })

    it('should POST FormData with files and context', async () => {
      const file = new File(['data'], 'test.png', { type: 'image/png' })
      mockApi.post.mockResolvedValue({ data: { description: 'AI desc', title: 'AI title' } })

      const result = await api.generateAIDescription([file], 'Math homework')
      expect(result.description).toBe('AI desc')
      expect(result.title).toBe('AI title')
    })
  })

  describe('analyzeImageForQuestions', () => {
    it('should throw if no files', async () => {
      await expect(api.analyzeImageForQuestions([]))
        .rejects.toThrow('No files provided')
    })

    it('should POST files for analysis', async () => {
      const file = new File(['data'], 'test.png', { type: 'image/png' })
      mockApi.post.mockResolvedValue({ data: { questions: ['What subject?'] } })

      const result = await api.analyzeImageForQuestions([file])
      expect(result.questions).toHaveLength(1)
    })
  })

  describe('suggestLearningOutcomes', () => {
    it('should throw if files is not array', async () => {
      await expect(api.suggestLearningOutcomes(null, {}, {}, 'Year 3'))
        .rejects.toThrow('Files must be an array')
    })

    it('should throw if missing required params', async () => {
      await expect(api.suggestLearningOutcomes([], null, {}, 'Year 3'))
        .rejects.toThrow('No question answers provided')
      await expect(api.suggestLearningOutcomes([], {}, null, 'Year 3'))
        .rejects.toThrow('No curriculum data provided')
      await expect(api.suggestLearningOutcomes([], {}, {}, ''))
        .rejects.toThrow('No student grade provided')
    })

    it('should POST form data with all params', async () => {
      const file = new File(['data'], 'test.png', { type: 'image/png' })
      mockApi.post.mockResolvedValue({ data: { outcomes: [{ code: 'MA2-RN-01' }] } })

      const result = await api.suggestLearningOutcomes(
        [file],
        { q1: 'answer1' },
        { subjects: [] },
        'Year 3'
      )
      expect(result.outcomes).toHaveLength(1)
    })
  })

  describe('chatWithAI', () => {
    it('should POST chat messages', async () => {
      mockApi.post.mockResolvedValue({ data: { reply: 'AI response' } })

      const result = await api.chatWithAI('s1', [{ role: 'user', content: 'Hello' }])
      expect(result.reply).toBe('AI response')
      expect(mockApi.post).toHaveBeenCalledWith('/api/v1/ai/chat', {
        student_id: 's1',
        messages: [{ role: 'user', content: 'Hello' }],
      })
    })

    it('should throw with detail message on error', async () => {
      mockApi.post.mockRejectedValue({
        response: { data: { detail: 'Student not found' } },
      })

      await expect(api.chatWithAI('s1', []))
        .rejects.toThrow('Student not found')
    })
  })
})

// ========================
// Signed URLs / Files
// ========================
describe('File functions', () => {
  describe('getSignedUrl', () => {
    it('should POST signed URL request', async () => {
      mockApi.post.mockResolvedValue({ data: { signed_url: 'https://example.com/signed' } })

      const result = await api.getSignedUrl({ file_path: 'test/image.jpg' })
      expect(result.signed_url).toBe('https://example.com/signed')
    })
  })
})

// ========================
// Subscription API
// ========================
describe('Subscription functions', () => {
  describe('getSubscriptionPricing', () => {
    it('should GET pricing', async () => {
      mockApi.get.mockResolvedValue({ data: { monthly: 999, annual: 9999 } })

      const result = await api.getSubscriptionPricing()
      expect(result.monthly).toBe(999)
    })
  })

  describe('getSubscriptionStatus', () => {
    it('should GET status', async () => {
      mockApi.get.mockResolvedValue({ data: { tier: 'free', status: 'active' } })

      const result = await api.getSubscriptionStatus()
      expect(result.tier).toBe('free')
    })
  })

  describe('getSubscriptionUsage', () => {
    it('should GET usage', async () => {
      mockApi.get.mockResolvedValue({ data: { students: 1, evidence: 5 } })

      const result = await api.getSubscriptionUsage()
      expect(result.students).toBe(1)
    })
  })

  describe('createCheckoutSession', () => {
    it('should POST checkout session', async () => {
      mockApi.post.mockResolvedValue({ data: { url: 'https://checkout.stripe.com/...' } })

      const result = await api.createCheckoutSession('price_123', 'http://success', 'http://cancel')
      expect(result.url).toBeTruthy()
      expect(mockApi.post).toHaveBeenCalledWith('/api/stripe/checkout/session', {
        price_id: 'price_123',
        success_url: 'http://success',
        cancel_url: 'http://cancel',
      })
    })
  })

  describe('createPortalSession', () => {
    it('should POST portal session', async () => {
      mockApi.post.mockResolvedValue({ data: { url: 'https://billing.stripe.com/...' } })

      const result = await api.createPortalSession('http://return')
      expect(result.url).toBeTruthy()
    })
  })

  describe('canAddStudent', () => {
    it('should GET can-add-student check', async () => {
      mockApi.get.mockResolvedValue({ data: { allowed: true, message: '' } })

      const result = await api.canAddStudent()
      expect(result.allowed).toBe(true)
    })
  })

  describe('canAddEvidence', () => {
    it('should GET can-add-evidence check', async () => {
      mockApi.get.mockResolvedValue({ data: { allowed: false, message: 'Limit reached' } })

      const result = await api.canAddEvidence()
      expect(result.allowed).toBe(false)
    })
  })

  describe('canGenerateReports', () => {
    it('should GET can-generate-reports check', async () => {
      mockApi.get.mockResolvedValue({ data: { allowed: true } })

      const result = await api.canGenerateReports()
      expect(result.allowed).toBe(true)
    })
  })
})

// ========================
// Admin API
// ========================
describe('Admin functions', () => {
  describe('adminListUsers', () => {
    it('should GET admin users list', async () => {
      mockApi.get.mockResolvedValue({ data: { users: [], total: 0 } })

      const result = await api.adminListUsers({ skip: 0, limit: 10 })
      expect(result.total).toBe(0)
    })
  })

  describe('adminGetUser', () => {
    it('should GET user by ID', async () => {
      mockApi.get.mockResolvedValue({ data: { id: '123', email: 'user@test.com' } })

      const result = await api.adminGetUser('123')
      expect(result.email).toBe('user@test.com')
    })
  })

  describe('adminGetUserByEmail', () => {
    it('should GET user by email', async () => {
      mockApi.get.mockResolvedValue({ data: { email: 'user@test.com' } })

      const result = await api.adminGetUserByEmail('user@test.com')
      expect(result.email).toBe('user@test.com')
    })
  })

  describe('adminUpdateUserProfile', () => {
    it('should PUT user profile updates', async () => {
      mockApi.put.mockResolvedValue({ data: { first_name: 'Updated' } })

      await api.adminUpdateUserProfile('123', { first_name: 'Updated' })
      expect(mockApi.put).toHaveBeenCalledWith(
        '/api/admin/users/123/profile',
        { first_name: 'Updated' }
      )
    })
  })

  describe('adminUpdateUserSubscription', () => {
    it('should PUT subscription updates', async () => {
      mockApi.put.mockResolvedValue({ data: { subscription_tier: 'basic' } })

      await api.adminUpdateUserSubscription('123', { subscription_tier: 'basic' })
      expect(mockApi.put).toHaveBeenCalledWith(
        '/api/admin/users/123/subscription',
        { subscription_tier: 'basic' }
      )
    })
  })

  describe('adminDeactivateUser', () => {
    it('should POST deactivation', async () => {
      mockApi.post.mockResolvedValue({ data: { is_active: false } })

      await api.adminDeactivateUser('123')
      expect(mockApi.post).toHaveBeenCalledWith('/api/admin/users/123/deactivate')
    })
  })

  describe('adminReactivateUser', () => {
    it('should POST reactivation', async () => {
      mockApi.post.mockResolvedValue({ data: { is_active: true } })

      await api.adminReactivateUser('123')
      expect(mockApi.post).toHaveBeenCalledWith('/api/admin/users/123/reactivate')
    })
  })

  describe('adminDeleteUser', () => {
    it('should DELETE user with permanent flag', async () => {
      mockApi.delete.mockResolvedValue({ data: { message: 'deleted' } })

      await api.adminDeleteUser('123', true)
      expect(mockApi.delete).toHaveBeenCalledWith('/api/admin/users/123', {
        data: { permanent: true },
      })
    })

    it('should default permanent to false', async () => {
      mockApi.delete.mockResolvedValue({ data: { message: 'deactivated' } })

      await api.adminDeleteUser('123')
      expect(mockApi.delete).toHaveBeenCalledWith('/api/admin/users/123', {
        data: { permanent: false },
      })
    })
  })

  describe('adminListAllStudents', () => {
    it('should GET all students', async () => {
      mockApi.get.mockResolvedValue({ data: { students: [], total: 0 } })

      const result = await api.adminListAllStudents({ search: 'alice' })
      expect(result.total).toBe(0)
    })
  })

  describe('adminGetStudent', () => {
    it('should GET student by ID', async () => {
      mockApi.get.mockResolvedValue({ data: { id: 's1', first_name: 'Alice' } })

      const result = await api.adminGetStudent('s1')
      expect(result.first_name).toBe('Alice')
    })
  })

  describe('adminImpersonate', () => {
    it('should POST impersonation request', async () => {
      mockApi.post.mockResolvedValue({ data: { token: 'temp-token' } })

      const result = await api.adminImpersonate('user123')
      expect(result.token).toBe('temp-token')
      expect(mockApi.post).toHaveBeenCalledWith('/api/admin/impersonate', {
        user_id: 'user123',
      })
    })
  })

  describe('adminGetPlatformStats', () => {
    it('should GET platform stats', async () => {
      mockApi.get.mockResolvedValue({ data: { users: { total: 100 } } })

      const result = await api.adminGetPlatformStats()
      expect(result.users.total).toBe(100)
    })
  })
})
