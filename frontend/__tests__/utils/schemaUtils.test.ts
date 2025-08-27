import { describe, it, expect } from 'vitest'
import { extractSchemaTree, SchemaKeyNode } from '../../utils/schemaUtils'

describe('schemaUtils', () => {
  describe('extractSchemaTree', () => {
    it('should extract keys from simple object', () => {
      const data = {
        name: 'John',
        age: 30,
        status: 'active'
      }
      
      const result = extractSchemaTree(data)
      
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({ key: 'name', path: 'name' })
      expect(result[1]).toEqual({ key: 'age', path: 'age' })
      expect(result[2]).toEqual({ key: 'status', path: 'status' })
    })

    it('should handle nested objects', () => {
      const data = {
        user: {
          name: 'John',
          address: {
            city: 'New York',
            country: 'USA'
          }
        },
        status: 'active'
      }
      
      const result = extractSchemaTree(data)
      
      expect(result).toHaveLength(2)
      expect(result[0].key).toBe('user')
      expect(result[0].path).toBe('user')
      expect(result[0].children).toHaveLength(2)
      expect(result[0].children![0]).toEqual({ key: 'name', path: 'user.name' })
      expect(result[0].children![1].key).toBe('address')
      expect(result[0].children![1].children).toHaveLength(2)
      expect(result[0].children![1].children![0]).toEqual({ key: 'city', path: 'user.address.city' })
      expect(result[1]).toEqual({ key: 'status', path: 'status' })
    })

    it('should handle arrays of objects', () => {
      const data = {
        users: [
          { name: 'John', age: 30 },
          { name: 'Jane', age: 25 }
        ]
      }
      
      const result = extractSchemaTree(data)
      
      expect(result).toHaveLength(1)
      expect(result[0].key).toBe('users')
      expect(result[0].path).toBe('users')
      expect(result[0].children).toHaveLength(2)
      expect(result[0].children![0]).toEqual({ key: 'name', path: 'users.name' })
      expect(result[0].children![1]).toEqual({ key: 'age', path: 'users.age' })
    })

    it('should handle empty object', () => {
      const result = extractSchemaTree({})
      expect(result).toHaveLength(0)
    })

    it('should handle primitive array values', () => {
      const data = {
        tags: ['red', 'blue', 'green'],
        count: 5
      }
      
      const result = extractSchemaTree(data)
      
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ key: 'tags', path: 'tags' })
      expect(result[1]).toEqual({ key: 'count', path: 'count' })
    })

    it('should handle null and undefined values', () => {
      const data = {
        nullValue: null,
        undefinedValue: undefined,
        name: 'John'
      }
      
      const result = extractSchemaTree(data)
      
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({ key: 'nullValue', path: 'nullValue' })
      expect(result[1]).toEqual({ key: 'undefinedValue', path: 'undefinedValue' })
      expect(result[2]).toEqual({ key: 'name', path: 'name' })
    })

    it('should handle mixed nested structure', () => {
      const data = {
        id: 1,
        profile: {
          personal: {
            firstName: 'John',
            lastName: 'Doe'
          },
          settings: {
            theme: 'dark',
            notifications: true
          }
        },
        tags: ['admin', 'user'],
        metadata: null
      }
      
      const result = extractSchemaTree(data)
      
      expect(result).toHaveLength(4)
      expect(result[0]).toEqual({ key: 'id', path: 'id' })
      expect(result[1].key).toBe('profile')
      expect(result[1].children).toHaveLength(2)
      expect(result[1].children![0].children).toHaveLength(2)
      expect(result[1].children![1].children).toHaveLength(2)
      expect(result[2]).toEqual({ key: 'tags', path: 'tags' })
      expect(result[3]).toEqual({ key: 'metadata', path: 'metadata' })
    })

    it('should exclude special BSON types', () => {
      class ObjectId {
        constructor(public id: string) {}
      }
      
      const data = {
        _id: new ObjectId('507f1f77bcf86cd799439011'),
        name: 'John',
        profile: {
          userId: new ObjectId('507f1f77bcf86cd799439012'),
          settings: { theme: 'dark' }
        }
      }
      
      const result = extractSchemaTree(data)
      
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({ key: '_id', path: '_id' })
      expect(result[1]).toEqual({ key: 'name', path: 'name' })
      expect(result[2].key).toBe('profile')
      expect(result[2].children).toHaveLength(2)
      expect(result[2].children![0]).toEqual({ key: 'userId', path: 'profile.userId' })
      expect(result[2].children![1].children).toHaveLength(1)
    })
  })
})