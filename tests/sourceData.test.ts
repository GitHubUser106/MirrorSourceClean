import { describe, it, expect } from 'vitest'
import {
  getSourceInfo,
  getPoliticalLean,
  getSourceName,
  getOwnershipType,
  getOwnershipLabel,
  getSourcesByLean,
  getWikiLink,
  SOURCES,
  type PoliticalLean,
} from '@/lib/sourceData'

describe('sourceData', () => {
  describe('getSourceInfo', () => {
    it('should find source by full URL', () => {
      const source = getSourceInfo('https://www.nytimes.com/2024/01/15/article.html')
      expect(source).toBeDefined()
      expect(source?.name).toBe('The New York Times')
    })

    it('should find source by domain only', () => {
      const source = getSourceInfo('foxnews.com')
      expect(source).toBeDefined()
      expect(source?.name).toBe('Fox News')
    })

    it('should return undefined for unknown domain', () => {
      const source = getSourceInfo('unknownnewssite.com')
      expect(source).toBeUndefined()
    })

    it('should handle www prefix', () => {
      const source = getSourceInfo('www.cnn.com')
      expect(source).toBeDefined()
      expect(source?.name).toBe('CNN')
    })
  })

  describe('getPoliticalLean', () => {
    it('should return correct lean for known sources', () => {
      expect(getPoliticalLean('foxnews.com')).toBe('right')
      expect(getPoliticalLean('msnbc.com')).toBe('left')
      // AP News is classified as center-left in the database
      expect(getPoliticalLean('reuters.com')).toBe('center')
    })

    it('should return center for unknown sources', () => {
      expect(getPoliticalLean('unknownsite.com')).toBe('center')
    })
  })

  describe('getSourceName', () => {
    it('should return source name for known domain', () => {
      expect(getSourceName('bbc.com')).toBe('BBC')
    })

    it('should return null for unknown domain', () => {
      expect(getSourceName('unknownsite.com')).toBeNull()
    })
  })

  describe('getOwnershipType', () => {
    it('should return ownership type for known sources', () => {
      const ownershipType = getOwnershipType('npr.org')
      expect(ownershipType).toBe('nonprofit')
    })

    it('should return null for unknown sources', () => {
      expect(getOwnershipType('unknownsite.com')).toBeNull()
    })
  })

  describe('getOwnershipLabel', () => {
    it('should return human-readable labels', () => {
      expect(getOwnershipLabel('nonprofit')).toBe('Nonprofit')
      expect(getOwnershipLabel('corporate')).toBe('Corporate')
      expect(getOwnershipLabel('public')).toBe('Public Company')
    })
  })

  describe('getSourcesByLean', () => {
    it('should return sources grouped by political lean', () => {
      const grouped = getSourcesByLean()

      expect(grouped).toHaveProperty('left')
      expect(grouped).toHaveProperty('center-left')
      expect(grouped).toHaveProperty('center')
      expect(grouped).toHaveProperty('center-right')
      expect(grouped).toHaveProperty('right')

      // Each group should be an array
      expect(Array.isArray(grouped.left)).toBe(true)
      expect(Array.isArray(grouped.right)).toBe(true)
    })

    it('should include all five political leanings', () => {
      const grouped = getSourcesByLean()
      const keys = Object.keys(grouped) as PoliticalLean[]

      expect(keys).toContain('left')
      expect(keys).toContain('center-left')
      expect(keys).toContain('center')
      expect(keys).toContain('center-right')
      expect(keys).toContain('right')
    })
  })

  describe('getWikiLink', () => {
    it('should generate Wikipedia URL from source name', () => {
      const link = getWikiLink('The New York Times')
      expect(link).toContain('wikipedia.org')
      expect(link).toContain('The_New_York_Times')
    })

    it('should handle spaces in source names', () => {
      const link = getWikiLink('Fox News')
      expect(link).toContain('Fox_News')
    })
  })

  describe('SOURCES array', () => {
    it('should have a valid structure', () => {
      expect(SOURCES.length).toBeGreaterThan(0)

      // Check first source has required fields
      const source = SOURCES[0]
      expect(source).toHaveProperty('domain')
      expect(source).toHaveProperty('name')
      expect(source).toHaveProperty('lean')
      expect(source).toHaveProperty('legacyType')
    })

    it('should have valid political lean values', () => {
      const validLeans: PoliticalLean[] = ['left', 'center-left', 'center', 'center-right', 'right']

      for (const source of SOURCES) {
        expect(validLeans).toContain(source.lean)
      }
    })
  })
})
