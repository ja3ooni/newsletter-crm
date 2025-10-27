import { ComplianceService } from '../services/ComplianceService';

// Mock dependencies
jest.mock('../utils/database');
jest.mock('../utils/redis');
jest.mock('../utils/logger');

describe('ComplianceService Basic Tests', () => {
  let complianceService: ComplianceService;

  beforeEach(() => {
    complianceService = new ComplianceService();
    jest.clearAllMocks();
  });

  it('should create ComplianceService instance', () => {
    expect(complianceService).toBeInstanceOf(ComplianceService);
  });

  it('should validate CAN-SPAM compliance for compliant email', async () => {
    const emailContent = {
      subject: 'Test Newsletter',
      htmlContent:
        '<p>Test content with <a href="unsubscribe">unsubscribe</a> and address: 123 Main St, City, ST 12345</p>',
      textContent:
        'Test content with unsubscribe link and address: 123 Main St, City, ST 12345',
      fromAddress: 'test@example.com',
      fromName: 'Test Company',
      replyToAddress: 'reply@example.com',
    };

    const result =
      await complianceService.validateCANSPAMCompliance(emailContent);

    expect(result.isCompliant).toBe(true);
    expect(result.requirements.hasUnsubscribeLink).toBe(true);
    expect(result.requirements.hasPhysicalAddress).toBe(true);
    expect(result.requirements.hasValidReplyTo).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('should validate basic compliance functionality', async () => {
    const emailContent = {
      subject: 'Test Newsletter',
      htmlContent: '<p>Test content</p>',
      textContent: 'Test content',
      fromAddress: 'test@example.com',
      fromName: 'Test Company',
    };

    const result =
      await complianceService.validateCANSPAMCompliance(emailContent);

    // Basic structure validation
    expect(result).toBeDefined();
    expect(result.requirements).toBeDefined();
    expect(typeof result.isCompliant).toBe('boolean');
    expect(Array.isArray(result.violations)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(result.checkedAt).toBeInstanceOf(Date);
  });
});
