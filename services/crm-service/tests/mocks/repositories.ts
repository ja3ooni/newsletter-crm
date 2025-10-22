import { ContactRepository } from '../../src/repositories/ContactRepository';
import { SegmentRepository } from '../../src/repositories/SegmentRepository';

export const createMockContactRepository = (): jest.Mocked<ContactRepository> => {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    search: jest.fn(),
    getContactStats: jest.fn(),
    updateLastActivity: jest.fn(),
    updateLeadScore: jest.fn(),
    bulkUpdate: jest.fn(),
    bulkDelete: jest.fn(),
    addTags: jest.fn(),
    removeTags: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn()
  } as any;
};

export const createMockSegmentRepository = (): jest.Mocked<SegmentRepository> => {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    updateContactCount: jest.fn(),
    getContactIds: jest.fn(),
    addContactsToSegment: jest.fn(),
    removeContactsFromSegment: jest.fn(),
    findByConditions: jest.fn(),
    count: jest.fn()
  } as any;
};
