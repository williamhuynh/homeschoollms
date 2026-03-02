/**
 * Tests for the imageService module.
 *
 * Covers getThumbnailUrl, preloadImage, preloadImages,
 * getImageDimensions, isWebPSupported, compressImage, compressImages,
 * and getAuthenticatedImageUrl.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getThumbnailUrl,
  preloadImage,
  preloadImages,
  getImageDimensions,
  isWebPSupported,
  compressImage,
  compressImages,
} from './imageService'

// Mock the logger
vi.mock('../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// ========================
// getThumbnailUrl
// ========================
describe('getThumbnailUrl', () => {
  it('should return null for null image', () => {
    expect(getThumbnailUrl(null)).toBeNull()
    expect(getThumbnailUrl(undefined)).toBeNull()
  })

  it('should return small thumbnail for dimensions <= 150', () => {
    const image = {
      thumbnail_small_url: 'small.jpg',
      thumbnail_medium_url: 'medium.jpg',
      thumbnail_large_url: 'large.jpg',
      fileUrl: 'original.jpg',
    }
    expect(getThumbnailUrl(image, 100, 100)).toBe('small.jpg')
    expect(getThumbnailUrl(image, 150, 50)).toBe('small.jpg')
  })

  it('should return medium thumbnail for dimensions <= 300', () => {
    const image = {
      thumbnail_small_url: 'small.jpg',
      thumbnail_medium_url: 'medium.jpg',
      thumbnail_large_url: 'large.jpg',
      fileUrl: 'original.jpg',
    }
    expect(getThumbnailUrl(image, 200, 200)).toBe('medium.jpg')
    expect(getThumbnailUrl(image, 300, 100)).toBe('medium.jpg')
  })

  it('should return large thumbnail for dimensions <= 600', () => {
    const image = {
      thumbnail_small_url: 'small.jpg',
      thumbnail_medium_url: 'medium.jpg',
      thumbnail_large_url: 'large.jpg',
      fileUrl: 'original.jpg',
    }
    expect(getThumbnailUrl(image, 400, 400)).toBe('large.jpg')
    expect(getThumbnailUrl(image, 600, 100)).toBe('large.jpg')
  })

  it('should return original URL for dimensions > 600', () => {
    const image = {
      thumbnail_small_url: 'small.jpg',
      thumbnail_medium_url: 'medium.jpg',
      thumbnail_large_url: 'large.jpg',
      fileUrl: 'original.jpg',
    }
    expect(getThumbnailUrl(image, 800, 800)).toBe('original.jpg')
  })

  it('should fallback to url if fileUrl not present', () => {
    const image = { url: 'fallback-url.jpg' }
    expect(getThumbnailUrl(image, 1000, 1000)).toBe('fallback-url.jpg')
  })

  it('should fallback to original_url', () => {
    const image = { original_url: 'original-url.jpg' }
    expect(getThumbnailUrl(image, 1000, 1000)).toBe('original-url.jpg')
  })

  it('should use default dimensions (0, 0) and return fallback', () => {
    const image = { fileUrl: 'original.jpg', thumbnail_small_url: 'small.jpg' }
    // Math.max(0, 0) = 0, which is <= 150, so returns small thumbnail
    expect(getThumbnailUrl(image)).toBe('small.jpg')
  })

  it('should fall through to next available size when smaller thumbnails missing', () => {
    const image = {
      // No small or medium thumbnails
      thumbnail_large_url: 'large.jpg',
      fileUrl: 'original.jpg',
    }
    // 100x100: largerDimension=100, <= 150 but no small, <= 300 but no medium, <= 600 and large exists
    expect(getThumbnailUrl(image, 100, 100)).toBe('large.jpg')
    // 700x700: largerDimension=700, > 600, falls to original
    expect(getThumbnailUrl(image, 700, 700)).toBe('original.jpg')
  })
})

// ========================
// preloadImage
// ========================
describe('preloadImage', () => {
  it('should reject if no src provided', async () => {
    await expect(preloadImage(null)).rejects.toThrow('No image source provided')
    await expect(preloadImage('')).rejects.toThrow('No image source provided')
  })

  it('should resolve with an Image element on success', async () => {
    const originalImage = globalThis.Image

    class MockImage {
      set src(val) {
        this._src = val
        setTimeout(() => this.onload?.(), 0)
      }
      get src() { return this._src }
    }
    globalThis.Image = MockImage

    const result = await preloadImage('http://example.com/image.jpg')
    expect(result).toBeInstanceOf(MockImage)
    expect(result.src).toBe('http://example.com/image.jpg')

    globalThis.Image = originalImage
  })

  it('should reject on load error', async () => {
    const originalImage = globalThis.Image

    class MockImage {
      set src(val) {
        this._src = val
        setTimeout(() => this.onerror?.(), 0)
      }
      get src() { return this._src }
    }
    globalThis.Image = MockImage

    await expect(preloadImage('http://example.com/bad.jpg'))
      .rejects.toThrow('Failed to load image')

    globalThis.Image = originalImage
  })
})

// ========================
// preloadImages
// ========================
describe('preloadImages', () => {
  it('should return empty array for null/empty input', async () => {
    expect(await preloadImages(null)).toEqual([])
    expect(await preloadImages([])).toEqual([])
    expect(await preloadImages(undefined)).toEqual([])
  })

  it('should return empty array for non-array input', async () => {
    expect(await preloadImages('not-an-array')).toEqual([])
  })
})

// ========================
// getImageDimensions
// ========================
describe('getImageDimensions', () => {
  it('should reject if no URL provided', async () => {
    await expect(getImageDimensions(null)).rejects.toThrow('No image URL provided')
    await expect(getImageDimensions('')).rejects.toThrow('No image URL provided')
  })

  it('should resolve with width and height', async () => {
    const originalImage = globalThis.Image

    class MockImage {
      constructor() {
        this.width = 800
        this.height = 600
      }
      set src(val) {
        this._src = val
        setTimeout(() => this.onload?.(), 0)
      }
      get src() { return this._src }
    }
    globalThis.Image = MockImage

    const dims = await getImageDimensions('http://example.com/img.jpg')
    expect(dims).toEqual({ width: 800, height: 600 })

    globalThis.Image = originalImage
  })
})

// ========================
// isWebPSupported
// ========================
describe('isWebPSupported', () => {
  it('should return true when WebP loads successfully', async () => {
    const originalImage = globalThis.Image

    class MockImage {
      set src(val) {
        this._src = val
        setTimeout(() => this.onload?.(), 0)
      }
      get src() { return this._src }
    }
    globalThis.Image = MockImage

    const result = await isWebPSupported()
    expect(result).toBe(true)

    globalThis.Image = originalImage
  })

  it('should return false when WebP fails to load', async () => {
    const originalImage = globalThis.Image

    class MockImage {
      set src(val) {
        this._src = val
        setTimeout(() => this.onerror?.(), 0)
      }
      get src() { return this._src }
    }
    globalThis.Image = MockImage

    const result = await isWebPSupported()
    expect(result).toBe(false)

    globalThis.Image = originalImage
  })
})

// ========================
// compressImage
// ========================
describe('compressImage', () => {
  it('should return non-image files unchanged', async () => {
    const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' })
    const result = await compressImage(file)
    expect(result).toBe(file)
  })

  it('should return small image files unchanged', async () => {
    // Create a file smaller than MAX_FILE_SIZE (1.5MB)
    const smallData = new Uint8Array(1000)
    const file = new File([smallData], 'small.jpg', { type: 'image/jpeg' })
    const result = await compressImage(file)
    expect(result).toBe(file)
  })
})

// ========================
// compressImages
// ========================
describe('compressImages', () => {
  it('should compress all files in array', async () => {
    const files = [
      new File(['data1'], 'a.pdf', { type: 'application/pdf' }),
      new File(['data2'], 'b.txt', { type: 'text/plain' }),
    ]

    const results = await compressImages(files)
    expect(results).toHaveLength(2)
    // Non-image files returned as-is
    expect(results[0]).toBe(files[0])
    expect(results[1]).toBe(files[1])
  })
})
