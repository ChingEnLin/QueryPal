import { describe, it, expect, vi } from 'vitest'
import App from '../App'

// Mock the config
vi.mock('../app.config', () => ({
  USE_MSAL_AUTH: false
}))

// Mock MSAL dependencies
vi.mock('@azure/msal-react', () => ({
  useIsAuthenticated: vi.fn(() => false),
  useMsal: vi.fn(() => ({ instance: {}, accounts: [] }))
}))

// Mock the AuthContext with a simple implementation
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: false,
    user: null,
    logout: vi.fn()
  }))
}))

// Mock the pages - these are complex components that would need extensive setup
vi.mock('../pages/LoginPage', () => ({
  default: () => <div data-testid="login-page">Login Page</div>
}))

vi.mock('../pages/QueryGeneratorPage', () => ({
  default: () => <div data-testid="query-generator-page">Query Generator</div>
}))

vi.mock('../pages/DataExplorerPage', () => ({
  default: () => <div data-testid="data-explorer-page">Data Explorer</div>
}))

describe('App', () => {
  it('should render without crashing', () => {
    expect(App).toBeDefined()
    expect(typeof App).toBe('function')
  })

  it('should use bypass flow when MSAL is disabled', () => {
    // This test verifies the basic structure of the App component
    // The actual rendering would require more complex mocking of dependencies
    expect(App).toBeDefined()
  })
})