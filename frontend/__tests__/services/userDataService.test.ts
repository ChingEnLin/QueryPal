import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSavedQueries, saveQuery } from '../../services/userDataService'

// Mock the dependencies
vi.mock('../../app.config', () => ({
  USE_MSAL_AUTH: false,
  API_BASE_URL: 'http://localhost:3000/api'
}))

vi.mock('../../authConfig', () => ({
  msalInstance: {
    getAllAccounts: vi.fn(),
    acquireTokenSilent: vi.fn()
  },
  loginRequest: {}
}))

describe('userDataService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getSavedQueries', () => {
    it('should return mock saved queries in dev mode', async () => {
      const queries = await getSavedQueries()
      
      expect(Array.isArray(queries)).toBe(true)
      expect(queries.length).toBeGreaterThan(0)
      
      queries.forEach(query => {
        expect(query).toHaveProperty('id')
        expect(query).toHaveProperty('name')
        expect(query).toHaveProperty('prompt')
        expect(query).toHaveProperty('code')
        expect(query).toHaveProperty('ownerEmail')
        expect(query).toHaveProperty('sharedWith')
        expect(query).toHaveProperty('updatedAt')
      })
    })

    it('should include both owned and shared queries', async () => {
      const queries = await getSavedQueries()
      
      const ownedQueries = queries.filter(q => q.ownerEmail === 'dev.user@example.com')
      const sharedQueries = queries.filter(q => q.sharedWith.includes('dev.user@example.com'))
      
      expect(ownedQueries.length).toBeGreaterThan(0)
      expect(sharedQueries.length).toBeGreaterThan(0)
    })
  })

  describe('saveQuery', () => {
    it('should save a new query in dev mode', async () => {
      const queryData = {
        name: 'Test Query',
        prompt: 'Find all test data',
        code: 'db.test.find({})'
      }
      
      const savedQuery = await saveQuery(queryData)
      
      expect(savedQuery).toHaveProperty('id')
      expect(savedQuery.name).toBe(queryData.name)
      expect(savedQuery.prompt).toBe(queryData.prompt)
      expect(savedQuery.code).toBe(queryData.code)
      expect(savedQuery).toHaveProperty('ownerEmail')
      expect(savedQuery).toHaveProperty('sharedWith')
      expect(savedQuery).toHaveProperty('updatedAt')
      expect(Array.isArray(savedQuery.sharedWith)).toBe(true)
    })

    it('should generate unique IDs for saved queries', async () => {
      const queryData1 = {
        name: 'Query 1',
        prompt: 'Test prompt 1',
        code: 'db.test1.find({})'
      }
      
      const queryData2 = {
        name: 'Query 2',
        prompt: 'Test prompt 2',
        code: 'db.test2.find({})'
      }
      
      const savedQuery1 = await saveQuery(queryData1)
      const savedQuery2 = await saveQuery(queryData2)
      
      expect(savedQuery1.id).not.toBe(savedQuery2.id)
    })
  })
})