// Main entry point for the CRM service
import './server';

// Export main components for testing and external use
export { CRMController } from './controllers/CRMController';
export { ContactRepository } from './repositories/ContactRepository';
export { SegmentRepository } from './repositories/SegmentRepository';
export { CRMService } from './services/CRMService';
export * from './types';
export * from './utils/validation';
