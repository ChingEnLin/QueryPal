import { describe, it, expect } from 'vitest'
import {
  mockDelay,
  mockCosmosAccounts,
  mockECommerceDbInfo,
  mockFindUsersQuery,
  mockUpdateProductsQuery,
  mockDefaultQuery,
  mockDebuggingResult,
  mockAnalysisResult,
  mockSavedQueries
} from '../../services/mockData'

describe('mockData', () => {
  describe('mockDelay', () => {
    it('should resolve after specified delay', async () => {
      const start = Date.now()
      await mockDelay(100)
      const end = Date.now()
      expect(end - start).toBeGreaterThanOrEqual(90)
    }, 200)
  })

  describe('mockCosmosAccounts', () => {
    it('should contain valid account data', () => {
      expect(mockCosmosAccounts).toHaveLength(3)
      expect(mockCosmosAccounts[0]).toHaveProperty('id')
      expect(mockCosmosAccounts[0]).toHaveProperty('name')
      expect(mockCosmosAccounts[0].name).toBe('prod-ecommerce-db')
    })

    it('should have unique account names', () => {
      const names = mockCosmosAccounts.map(account => account.name)
      const uniqueNames = new Set(names)
      expect(uniqueNames.size).toBe(names.length)
    })
  })

  describe('mockECommerceDbInfo', () => {
    it('should have valid database structure', () => {
      expect(mockECommerceDbInfo.name).toBe('ECommerce-DB')
      expect(mockECommerceDbInfo.collections).toHaveLength(3)
      expect(mockECommerceDbInfo.totalDocuments).toBe(15500)
      expect(mockECommerceDbInfo.size).toBe('256 MB')
    })

    it('should have collections with counts', () => {
      mockECommerceDbInfo.collections.forEach(collection => {
        expect(collection).toHaveProperty('name')
        expect(collection).toHaveProperty('count')
        expect(typeof collection.count).toBe('number')
        expect(collection.count).toBeGreaterThan(0)
      })
    })
  })

  describe('mock query results', () => {
    it('should have valid structure for user query', () => {
      expect(mockFindUsersQuery).toHaveProperty('generated_code')
      expect(typeof mockFindUsersQuery.generated_code).toBe('string')
      expect(mockFindUsersQuery.generated_code.length).toBeGreaterThan(0)
    })

    it('should have valid structure for products query', () => {
      expect(mockUpdateProductsQuery).toHaveProperty('generated_code')
      expect(typeof mockUpdateProductsQuery.generated_code).toBe('string')
      expect(mockUpdateProductsQuery.generated_code.length).toBeGreaterThan(0)
    })

    it('should have valid default query', () => {
      expect(mockDefaultQuery).toHaveProperty('generated_code')
      expect(typeof mockDefaultQuery.generated_code).toBe('string')
      expect(mockDefaultQuery.generated_code.length).toBeGreaterThan(0)
    })
  })

  describe('mock analysis results', () => {
    it('should have valid debugging result', () => {
      expect(mockDebuggingResult).toHaveProperty('suggestion')
      expect(typeof mockDebuggingResult.suggestion).toBe('string')
      expect(mockDebuggingResult.suggestion.length).toBeGreaterThan(0)
    })

    it('should have valid analysis result', () => {
      expect(mockAnalysisResult).toHaveProperty('insight')
      expect(mockAnalysisResult).toHaveProperty('chartType')
      expect(mockAnalysisResult).toHaveProperty('chartData')
      expect(typeof mockAnalysisResult.insight).toBe('string')
      expect(mockAnalysisResult.chartType).toBe('bar')
      expect(mockAnalysisResult.chartData).toHaveProperty('labels')
    })
  })

  describe('mockSavedQueries', () => {
    it('should contain valid saved queries', () => {
      expect(Array.isArray(mockSavedQueries)).toBe(true)
      expect(mockSavedQueries.length).toBeGreaterThan(0)
      
      mockSavedQueries.forEach(query => {
        expect(query).toHaveProperty('id')
        expect(query).toHaveProperty('name')
        expect(query).toHaveProperty('prompt')
        expect(query).toHaveProperty('code')
        expect(query).toHaveProperty('ownerEmail')
        expect(query).toHaveProperty('sharedWith')
        expect(query).toHaveProperty('updatedAt')
      })
    })

    it('should have unique query ids', () => {
      const ids = mockSavedQueries.map(query => query.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })
  })
})