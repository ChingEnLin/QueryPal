import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateMongoQuery, debugMongoQuery, analyzeQueryResult } from '../../services/geminiService'
import * as appConfig from '../../app.config'

// Mock the app config to control test behavior
vi.mock('../../app.config', () => ({
  USE_MSAL_AUTH: false,
  API_BASE_URL: 'http://localhost:3000/api'
}))

describe('geminiService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateMongoQuery', () => {
    it('should return mock data when not using MSAL auth', async () => {
      const result = await generateMongoQuery('find users', 'test-account')
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('generated_code')
      expect(typeof result.generated_code).toBe('string')
      expect(result.generated_code.length).toBeGreaterThan(0)
    })

    it('should return user query for user-related input', async () => {
      const result = await generateMongoQuery('find all users from Canada', 'test-account')
      
      expect(result.generated_code).toContain('users')
    })

    it('should return product query for product-related input', async () => {
      const result = await generateMongoQuery('update product prices by 10%', 'test-account')
      
      expect(result.generated_code).toContain('products')
    })

    it('should return default query for other inputs', async () => {
      const result = await generateMongoQuery('show me something', 'test-account')
      
      expect(result).toBeDefined()
      expect(result.generated_code).toBeDefined()
    })

    it('should handle database context', async () => {
      const dbInfo = {
        name: 'TestDB',
        collections: [{ name: 'testCollection', count: 100 }],
        totalDocuments: 100,
        size: '10 MB'
      }
      
      const result = await generateMongoQuery('find data', 'test-account', dbInfo as any)
      expect(result).toBeDefined()
    })

    it('should handle collection context', async () => {
      const collectionContext = {
        name: 'users',
        count: 1000
      }
      
      const result = await generateMongoQuery('find data', 'test-account', undefined, collectionContext as any)
      expect(result).toBeDefined()
    })
  })

  describe('debugMongoQuery', () => {
    it('should return debugging suggestion', async () => {
      const result = await debugMongoQuery('invalid query', 'syntax error')
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('suggestion')
      expect(typeof result.suggestion).toBe('string')
      expect(result.suggestion.length).toBeGreaterThan(0)
    })

    it('should handle different error types', async () => {
      const result = await debugMongoQuery('db.users.find({})', 'Collection not found')
      
      expect(result.suggestion).toBeDefined()
      expect(typeof result.suggestion).toBe('string')
    })
  })

  describe('analyzeQueryResult', () => {
    it('should return analysis with insight and chart', async () => {
      // Use the specific format expected by the mock
      const mockData = [
        { name: 'John', age: 25, country: 'Canada' },
        { name: 'Jane', age: 30, country: 'Canada' }
      ]
      
      const result = await analyzeQueryResult(mockData)
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('insight')
      expect(result).toHaveProperty('chartType')
      expect(result).toHaveProperty('chartData')
      expect(typeof result.insight).toBe('string')
      expect(result.chartData).toHaveProperty('labels')
    })

    it('should handle different data formats', async () => {
      // This will trigger the error case, which we'll catch and verify
      const result = analyzeQueryResult([]).catch(error => error.message)
      
      await expect(result).resolves.toContain('No mock analysis available')
    })
  })
})

describe('geminiService with MSAL auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock MSAL auth to be true for these tests
    vi.mocked(appConfig).USE_MSAL_AUTH = true
  })

  it('should handle API calls when MSAL auth is enabled', async () => {
    // Mock fetch for API calls
    global.fetch = vi.fn().mockRejectedValue(new Error('No auth token'))

    // Since we can't easily test the actual API integration without auth,
    // we'll verify that it throws when no auth is available
    await expect(generateMongoQuery('test', 'test-account')).rejects.toThrow()
  })
})