/**
 * Vitest global setup file.
 *
 * - Adds jest-dom matchers (toBeInTheDocument, toHaveTextContent, etc.)
 * - Stubs browser APIs that jsdom doesn't provide (localStorage, matchMedia)
 */
import '@testing-library/jest-dom'

// Stub matchMedia (used by Chakra UI / framer-motion)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Stub IntersectionObserver
class IntersectionObserverMock {
  constructor() {
    this.observe = vi.fn()
    this.unobserve = vi.fn()
    this.disconnect = vi.fn()
  }
}
window.IntersectionObserver = IntersectionObserverMock

// Stub ResizeObserver
class ResizeObserverMock {
  constructor() {
    this.observe = vi.fn()
    this.unobserve = vi.fn()
    this.disconnect = vi.fn()
  }
}
window.ResizeObserver = ResizeObserverMock

// Stub scrollTo
window.scrollTo = vi.fn()
Element.prototype.scrollTo = vi.fn()
