import { Request, Response } from 'express';
import { IntegrationController } from '../../src/controllers/IntegrationController';

// Mock the dependencies
jest.mock('../../src/integrations/marketing-integration-manager');
jest.mock('../../src/utils/logger');

describe('IntegrationController', () => {
  let controller: IntegrationController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    controller = new IntegrationController();
    mockRequest = {
      params: {},
      body: {},
      query: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('getIntegration', () => {
    it('should return 400 when id is missing', async () => {
      mockRequest.params = {};

      await controller.getIntegration(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Integration ID is required',
      });
    });

    it('should handle valid id parameter', async () => {
      mockRequest.params = { id: 'test-id' };

      // Mock the integration manager to return null (not found)
      const mockGetIntegration = jest.fn().mockReturnValue(null);
      (controller as any).integrationManager = {
        getIntegration: mockGetIntegration,
      };

      await controller.getIntegration(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockGetIntegration).toHaveBeenCalledWith('test-id');
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updateIntegration', () => {
    it('should return 400 when id is missing', async () => {
      mockRequest.params = {};

      // Mock validation result
      const mockValidationResult = jest.fn().mockReturnValue({
        isEmpty: () => true,
        array: () => [],
      });
      jest.doMock('express-validator', () => ({
        validationResult: mockValidationResult,
      }));

      await controller.updateIntegration(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Integration ID is required',
      });
    });
  });

  describe('deleteIntegration', () => {
    it('should return 400 when id is missing', async () => {
      mockRequest.params = {};

      await controller.deleteIntegration(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Integration ID is required',
      });
    });
  });

  describe('testIntegration', () => {
    it('should return 400 when id is missing', async () => {
      mockRequest.params = {};

      await controller.testIntegration(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Integration ID is required',
      });
    });
  });

  describe('handleWebhook', () => {
    it('should return 400 when integrationId is missing', async () => {
      mockRequest.params = {};

      await controller.handleWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Integration ID is required',
      });
    });
  });

  describe('exportIntegrationData', () => {
    it('should return 400 when integrationId is missing', async () => {
      mockRequest.params = {};

      await controller.exportIntegrationData(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Integration ID is required',
      });
    });
  });

  describe('importIntegrationData', () => {
    it('should return 400 when integrationId is missing', async () => {
      mockRequest.params = {};

      await controller.importIntegrationData(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Integration ID is required',
      });
    });
  });
});
