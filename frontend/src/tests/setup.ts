import { vi } from 'vitest';

// Mock localStorage
const localStorageStore: Record<string, string> = {};

const localStorageMock = {
  get store() { return localStorageStore; },
  getItem: vi.fn((key: string): string | null => localStorageStore[key] || null),
  setItem: vi.fn((key: string, value: string): void => {
    localStorageStore[key] = value;
  }),
  removeItem: vi.fn((key: string): void => {
    delete localStorageStore[key];
  }),
  clear: vi.fn((): void => {
    Object.keys(localStorageStore).forEach(key => delete localStorageStore[key]);
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

// Mock mermaid
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn((id: string, code: string) => 
      Promise.resolve({ svg: `<svg id="${id}">${code}</svg>` })
    ),
  },
}));

// Helper to reset all mocks between tests
export function resetMocks(): void {
  Object.keys(localStorageStore).forEach(key => delete localStorageStore[key]);
  vi.clearAllMocks();
}

// Export mocks for direct access in tests
export { localStorageMock, clipboardMock };
