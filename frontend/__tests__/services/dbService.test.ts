import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deleteDocument, getAzureCosmosAccounts, getDatabasesForAccount, getCollectionInfo } from '../../services/dbService'

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

describe('dbService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('deleteDocument', () => {
    it('should return true for successful deletion in mock mode', async () => {
      const resource = { accountId: 'test-account', databaseName: 'test-db' }
      const result = await deleteDocument('users', resource, 'doc-123')
      
      expect(result).toBe(true)
    })
  })

  describe('getAzureCosmosAccounts', () => {
    it('should return mock cosmos accounts', async () => {
      const accounts = await getAzureCosmosAccounts()
      
      expect(Array.isArray(accounts)).toBe(true)
      expect(accounts.length).toBeGreaterThan(0)
      accounts.forEach(account => {
        expect(account).toHaveProperty('id')
        expect(account).toHaveProperty('name')
      })
    })
  })

  describe('getDatabasesForAccount', () => {
    it('should return database info for valid account', async () => {
      const accountId = '/subscriptions/mock-sub/resourceGroups/rg-prod/providers/Microsoft.DocumentDB/databaseAccounts/prod-ecommerce-db'
      const databases = await getDatabasesForAccount(accountId)
      
      expect(Array.isArray(databases)).toBe(true)
      expect(databases.length).toBeGreaterThan(0)
      databases.forEach(db => {
        expect(db).toHaveProperty('name')
        expect(db).toHaveProperty('collections')
        expect(db).toHaveProperty('totalDocuments')
        expect(db).toHaveProperty('size')
      })
    })

    it('should handle unknown accounts gracefully', async () => {
      await expect(getDatabasesForAccount('unknown-account')).rejects.toThrow('Mock databases not found')
    })
  })

  describe('getCollectionInfo', () => {
    it('should return collection info for valid collection', async () => {
      const resource = { accountId: 'test-account', databaseName: 'test-db' }
      const collectionInfo = await getCollectionInfo('users', resource)
      
      expect(collectionInfo).toBeDefined()
      expect(collectionInfo).toHaveProperty('name')
      expect(collectionInfo).toHaveProperty('documentCount')
      expect(collectionInfo).toHaveProperty('sampleDocument')
    })

    it('should handle unknown collections', async () => {
      const resource = { accountId: 'test-account', databaseName: 'test-db' }
      
      await expect(getCollectionInfo('unknown-collection', resource)).rejects.toThrow('Mock collection info not found')
    })
  })
})