import { vi } from 'vitest';

// Ensure browser environment for Svelte 5
// This must be set before any Svelte imports
if (typeof globalThis !== 'undefined') {
  // Mark this as a browser environment for Svelte
  (globalThis as Record<string, unknown>).__BROWSER__ = true;
}

// Mock localStorage
const localStorageStore: Record<string, string> = {};

const localStorageMock = {
  get store() {
    return localStorageStore;
  },
  getItem: vi.fn((key: string): string | null => localStorageStore[key] || null),
  setItem: vi.fn((key: string, value: string): void => {
    localStorageStore[key] = value;
  }),
  removeItem: vi.fn((key: string): void => {
    delete localStorageStore[key];
  }),
  clear: vi.fn((): void => {
    Object.keys(localStorageStore).forEach((key) => delete localStorageStore[key]);
  }),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock clipboard API
const clipboardMock = {
  writeText: vi.fn(() => Promise.resolve()),
  readText: vi.fn(() => Promise.resolve('')),
};

Object.defineProperty(navigator, 'clipboard', {
  value: clipboardMock,
  writable: true,
});

// Mock URL.createObjectURL and revokeObjectURL
URL.createObjectURL = vi.fn(() => 'blob:mock-url');
URL.revokeObjectURL = vi.fn();

// Mock lucide-svelte - SVG parsing fails in jsdom (from_svg is not a function)
vi.mock('lucide-svelte', () => {
  const MockIcon = Object.assign(() => null, { displayName: 'MockIcon' });
  return new Proxy({} as Record<string, unknown>, {
    get() {
      return MockIcon;
    },
  });
});

// Mock mermaid
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn((id: string, code: string) =>
      Promise.resolve({ svg: `<svg id="${id}">${code}</svg>` })
    ),
  },
}));

/**
 * Reset all test mocks between tests.
 *
 * Clears localStorage data, resets all vi mocks, and restores
 * mock implementations to their original behavior. Call this
 * in afterEach() to ensure test isolation.
 *
 * @example
 * ```ts
 * import { resetMocks } from './setup';
 *
 * afterEach(() => {
 *   resetMocks();
 * });
 * ```
 */
export function resetMocks(): void {
  Object.keys(localStorageStore).forEach((key) => delete localStorageStore[key]);
  vi.clearAllMocks();
  // Restore original implementations (clearAllMocks does not restore them)
  localStorageMock.setItem.mockImplementation((key: string, value: string) => {
    localStorageStore[key] = value;
  });
  localStorageMock.removeItem.mockImplementation((key: string) => {
    delete localStorageStore[key];
  });
}

// Export mocks for direct access in tests
export { localStorageMock, clipboardMock };
