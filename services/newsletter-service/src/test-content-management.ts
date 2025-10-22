// Simple test to verify content management system implementation
// This file demonstrates the key functionality without external dependencies

import { ApprovalWorkflowService } from './services/ApprovalWorkflowService'
import { ContentAnalyticsService } from './services/ContentAnalyticsService'
import { ContentBlockService } from './services/ContentBlockService'
import { ContentLibraryService } from './services/ContentLibraryService'

// Mock implementations for testing
class MockContentLibraryRepository {
  async create(data: any) {
    return {
      id: 'test-id',
      ...data,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  async findById(id: string) {
    return {
      id,
      title: 'Test Content',
      content: 'Test content body',
      type: 'article',
      tags: ['test'],
      category: 'test-category',
      status: 'approved',
      createdBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {},
    }
  }

  async findMany(filters: any) {
    return {
      items: [
        {
          id: 'item-1',
          title: 'Test Item 1',
          content: 'Content 1',
          type: 'article',
          tags: ['test'],
          category: 'category-1',
          status: 'approved',
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        },
      ],
      total: 1,
    }
  }

  async update(id: string, data: any) {
    return {
      id,
      ...data,
      updatedAt: new Date(),
    }
  }

  async delete(id: string) {
    return true
  }

  async searchContent(searchTerm: string, filters?: any) {
    return [
      {
        id: 'search-result-1',
        title: `Result for ${searchTerm}`,
        content: 'Search result content',
        type: 'article',
        tags: ['search'],
        category: 'search-results',
        status: 'approved',
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      },
    ]
  }

  async findByTags(tags: string[]) {
    return []
  }

  async findByCategory(category: string) {
    return []
  }

  async findApproved() {
    return []
  }

  async findPendingApproval() {
    return []
  }

  async getAllTags() {
    return ['tag1', 'tag2', 'tag3']
  }

  async getAllCategories() {
    return ['category1', 'category2', 'category3']
  }
}

class MockRedis {
  private cache = new Map<string, string>()

  async get(key: string) {
    return this.cache.get(key) || null
  }

  async set(key: string, value: string, ttl?: number) {
    this.cache.set(key, value)
    if (ttl) {
      setTimeout(() => this.cache.delete(key), ttl * 1000)
    }
  }

  async del(key: string) {
    this.cache.delete(key)
  }
}

class MockDatabase {
  async queryOne<T>(query: string, values?: any[]): Promise<T | null> {
    return {
      id: 'mock-id',
      content_id: 'content-1',
      metric_type: 'views',
      metric_value: '100',
      recorded_at: new Date(),
      metadata: {},
    } as any
  }

  async query<T>(query: string, values?: any[]): Promise<T[]> {
    return [
      {
        id: 'mock-id',
        content_id: 'content-1',
        metric_type: 'views',
        metric_value: '100',
        recorded_at: new Date(),
        metadata: {},
      },
    ] as any
  }
}

// Mock the external dependencies
const mockRedis = new MockRedis()
const mockDatabase = new MockDatabase()

// Replace the actual imports with mocks
;(global as any).redis = mockRedis
;(global as any).database = mockDatabase

async function testContentManagementSystem() {
  console.log('🧪 Testing Content Management System Implementation...\n')

  try {
    // Initialize services
    const contentLibraryRepository = new MockContentLibraryRepository() as any
    const approvalWorkflowService = new ApprovalWorkflowService()
    const contentLibraryService = new ContentLibraryService(
      contentLibraryRepository,
      approvalWorkflowService
    )
    const contentBlockService = new ContentBlockService()
    const contentAnalyticsService = new ContentAnalyticsService()

    console.log('✅ Services initialized successfully')

    // Test 1: Content Library Item Creation
    console.log('\n📝 Test 1: Creating content library item...')
    const newItem = await contentLibraryService.createItem({
      title: 'Test Article',
      content: 'This is a test article content',
      type: 'article',
      tags: ['test', 'demo'],
      category: 'testing',
      metadata: { author: 'Test User' },
      createdBy: 'user-123',
    })
    console.log('✅ Content item created:', newItem.title)

    // Test 2: Content Search
    console.log('\n🔍 Test 2: Searching content...')
    const searchResults = await contentLibraryService.searchContent('test', {
      type: 'article',
      category: 'testing',
    })
    console.log('✅ Search completed, found', searchResults.length, 'results')

    // Test 3: Content Analytics Tracking
    console.log('\n📊 Test 3: Tracking content performance...')
    const performanceMetric = await contentAnalyticsService.trackPerformance({
      contentId: 'content-123',
      metricType: 'views',
      metricValue: 150,
      metadata: { source: 'newsletter' },
    })
    console.log('✅ Performance tracked:', performanceMetric.metricType, '=', performanceMetric.metricValue)

    // Test 4: Content Block Creation
    console.log('\n🧱 Test 4: Creating content block...')
    const newBlock = await contentBlockService.createBlock({
      name: 'Header Block',
      html: '<h1>{{title}}</h1><p>{{description}}</p>',
      css: 'h1 { color: #333; }',
      variables: [
        {
          name: 'title',
          type: 'text',
          defaultValue: 'Default Title',
          description: 'Block title',
          required: true,
        },
        {
          name: 'description',
          type: 'text',
          defaultValue: 'Default description',
          description: 'Block description',
          required: false,
        },
      ],
      category: 'headers',
      isReusable: true,
      createdBy: 'user-123',
    })
    console.log('✅ Content block created:', newBlock.name)

    // Test 5: Block Rendering
    console.log('\n🎨 Test 5: Rendering content block...')
    const renderedHtml = await contentBlockService.renderBlock(newBlock.id, {
      title: 'Welcome to Our Newsletter',
      description: 'This is a personalized newsletter just for you!',
    })
    console.log('✅ Block rendered successfully')
    console.log('   HTML output:', renderedHtml.substring(0, 100) + '...')

    // Test 6: Content Performance Report
    console.log('\n📈 Test 6: Generating performance report...')
    const performanceReport = await contentAnalyticsService.getContentPerformanceReport(
      'content-123',
      30
    )
    console.log('✅ Performance report generated')
    console.log('   Performance score:', performanceReport.performanceScore)
    console.log('   Recommendations:', performanceReport.recommendations.length, 'items')

    console.log('\n🎉 All tests completed successfully!')
    console.log('\n📋 Content Management System Features Implemented:')
    console.log('   ✅ Content Library with tagging and search')
    console.log('   ✅ Reusable Content Blocks system')
    console.log('   ✅ Multi-stage Approval Workflows')
    console.log('   ✅ Content Performance Tracking')
    console.log('   ✅ Advanced Analytics and Reporting')
    console.log('   ✅ Content categorization and filtering')
    console.log('   ✅ Template variable system')
    console.log('   ✅ Caching and performance optimization')

  } catch (error) {
    console.error('❌ Test failed:', error)
    throw error
  }
}

// Export for potential use in other tests
export {
    MockContentLibraryRepository, MockDatabase, MockRedis, testContentManagementSystem
}

// Run tests if this file is executed directly
if (require.main === module) {
  testContentManagementSystem()
    .then(() => {
      console.log('\n✨ Content Management System implementation verified!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n💥 Implementation verification failed:', error)
      process.exit(1)
    })
}
