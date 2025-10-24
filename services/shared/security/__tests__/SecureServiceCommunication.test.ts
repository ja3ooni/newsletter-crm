import axios from 'axios';
import {
  SecureServiceCommunication,
  createSecureServiceCommunication,
} from '../SecureServiceCommunication';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock jsonwebtoken
jest.mock('jsonwebtoken');
const mockedJwt = {
  sign: jest.fn(),
  verify: jest.fn(),
} as any;

describe('SecureServiceCommunication', () => {
  let secureComm: SecureServiceCommunication;
  let mockAxiosInstance: any;

  const mockConfig = {
    encryption: {
      enabled: true,
      algorithm: 'aes-256-gcm' as const,
    },
    authentication: {
      enabled: true,
      method: 'jwt' as const,
    },
    timeout: 30000,
    retries: 3,
    circuitBreaker: {
      enabled: true,
      threshold: 5,
      timeout: 60000,
    },
  };

  const mockAuthConfig = {
    serviceId: 'test-service',
    privateKey: 'test-private-key',
    publicKey: 'test-public-key',
    algorithm: 'RS256' as const,
    expiresIn: '1h',
  };

  beforeEach(() => {
    mockAxiosInstance = {
      request: jest.fn(),
      interceptors: {
        request: {
          use: jest.fn(),
        },
        response: {
          use: jest.fn(),
        },
      },
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    mockedJwt.sign.mockReturnValue('mock-jwt-token');

    secureComm = new SecureServiceCommunication(mockConfig, mockAuthConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create axios instance with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ailert-service/test-service',
        },
      });
    });

    it('should set up request and response interceptors', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('Secure Requests', () => {
    it('should make a successful secure request', async () => {
      const mockResponse = {
        data: { message: 'success' },
        status: 200,
        headers: { 'content-type': 'application/json' },
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const request = {
        method: 'GET' as const,
        url: 'https://api.example.com/test',
      };

      const response = await secureComm.request(request);

      expect(response.data).toEqual({ message: 'success' });
      expect(response.status).toBe(200);
      expect(response.encrypted).toBe(false);
    });

    it('should handle encrypted requests', async () => {
      const mockResponse = {
        data: 'encrypted-response-data',
        status: 200,
        headers: { 'x-encrypted': 'true' },
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const request = {
        method: 'POST' as const,
        url: 'https://api.example.com/test',
        data: { sensitive: 'data' },
        encrypted: true,
      };

      const response = await secureComm.request(request);

      expect(response.encrypted).toBe(true);
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Encrypt-Request': 'true',
          }),
        })
      );
    });

    it('should handle request failures', async () => {
      const error = new Error('Network error');
      mockAxiosInstance.request.mockRejectedValue(error);

      const request = {
        method: 'GET' as const,
        url: 'https://api.example.com/test',
      };

      await expect(secureComm.request(request)).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('Authentication', () => {
    it('should generate JWT token for authentication', async () => {
      const mockToken = 'mock-jwt-token';
      mockedJwt.sign.mockReturnValue(mockToken);

      // Access private method for testing
      const token = await (secureComm as any).generateJWT();

      expect(token).toBe(mockToken);
      expect(mockedJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceId: 'test-service',
          iss: 'ailert-platform',
        }),
        'test-private-key',
        {
          algorithm: 'RS256',
          expiresIn: '1h',
        }
      );
    });

    it('should generate HMAC signature for authentication', async () => {
      const headers = { 'content-type': 'application/json' };

      // Access private method for testing
      const signature = await (secureComm as any).generateHMACSignature(
        headers
      );

      expect(typeof signature).toBe('string');
      expect(signature.split(':')).toHaveLength(3); // timestamp:nonce:signature
    });

    it('should verify JWT tokens', () => {
      const mockPayload = { serviceId: 'test-service' };
      mockedJwt.verify.mockReturnValue(mockPayload);

      const result = SecureServiceCommunication.verifyJWT(
        'test-token',
        'test-public-key',
        'RS256'
      );

      expect(result).toEqual(mockPayload);
      expect(mockedJwt.verify).toHaveBeenCalledWith(
        'test-token',
        'test-public-key',
        {
          algorithms: ['RS256'],
        }
      );
    });

    it('should handle JWT verification errors', () => {
      mockedJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => {
        SecureServiceCommunication.verifyJWT(
          'invalid-token',
          'test-public-key'
        );
      }).toThrow('Invalid token');
    });

    it('should verify HMAC signatures', () => {
      const timestamp = Date.now().toString();
      const nonce = 'test-nonce';
      const signature = 'test-signature';
      const fullSignature = `${timestamp}:${nonce}:${signature}`;
      const headers = { 'content-type': 'application/json' };

      // Mock crypto.timingSafeEqual to return true
      const crypto = require('crypto');
      jest.spyOn(crypto, 'timingSafeEqual').mockReturnValue(true);
      jest.spyOn(crypto, 'createHmac').mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(signature),
      });

      const result = SecureServiceCommunication.verifyHMACSignature(
        fullSignature,
        headers,
        'test-service',
        'test-secret'
      );

      expect(result).toBe(true);
    });

    it('should reject old HMAC signatures', () => {
      const oldTimestamp = (Date.now() - 400000).toString(); // 6+ minutes ago
      const signature = `${oldTimestamp}:nonce:signature`;
      const headers = {};

      const result = SecureServiceCommunication.verifyHMACSignature(
        signature,
        headers,
        'test-service',
        'test-secret'
      );

      expect(result).toBe(false);
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit breaker after threshold failures', async () => {
      const error = new Error('Service unavailable');
      mockAxiosInstance.request.mockRejectedValue(error);

      const request = {
        method: 'GET' as const,
        url: 'https://api.example.com/test',
      };

      // Trigger failures to reach threshold
      for (let i = 0; i < 5; i++) {
        try {
          await secureComm.request(request);
        } catch (e) {
          // Expected to fail
        }
      }

      // Next request should be blocked by circuit breaker
      await expect(secureComm.request(request)).rejects.toThrow(
        'Circuit breaker is open for https://api.example.com/test'
      );
    });

    it('should reset circuit breaker on successful request', async () => {
      const error = new Error('Service unavailable');
      mockAxiosInstance.request
        .mockRejectedValueOnce(error)
        .mockResolvedValue({ data: 'success', status: 200, headers: {} });

      const request = {
        method: 'GET' as const,
        url: 'https://api.example.com/test',
      };

      // One failure
      try {
        await secureComm.request(request);
      } catch (e) {
        // Expected to fail
      }

      // Successful request should reset circuit breaker
      const response = await secureComm.request(request);
      expect(response.data).toBe('success');
    });

    it('should allow requests when circuit breaker is disabled', async () => {
      const disabledConfig = {
        ...mockConfig,
        circuitBreaker: {
          enabled: false,
          threshold: 5,
          timeout: 60000,
        },
      };

      const disabledSecureComm = new SecureServiceCommunication(
        disabledConfig,
        mockAuthConfig
      );
      const error = new Error('Service unavailable');
      mockAxiosInstance.request.mockRejectedValue(error);

      const request = {
        method: 'GET' as const,
        url: 'https://api.example.com/test',
      };

      // Should not be blocked by circuit breaker
      for (let i = 0; i < 10; i++) {
        await expect(disabledSecureComm.request(request)).rejects.toThrow(
          'Service unavailable'
        );
      }
    });
  });

  describe('Configuration', () => {
    it('should create secure communication with factory function', () => {
      const instance = createSecureServiceCommunication(
        mockConfig,
        mockAuthConfig
      );
      expect(instance).toBeInstanceOf(SecureServiceCommunication);
    });

    it('should handle different authentication methods', () => {
      const hmacConfig = {
        ...mockConfig,
        authentication: {
          enabled: true,
          method: 'hmac' as const,
        },
      };

      const hmacSecureComm = new SecureServiceCommunication(
        hmacConfig,
        mockAuthConfig
      );
      expect(hmacSecureComm).toBeInstanceOf(SecureServiceCommunication);
    });

    it('should handle disabled encryption', () => {
      const noEncryptionConfig = {
        ...mockConfig,
        encryption: {
          enabled: false,
          algorithm: 'aes-256-gcm' as const,
        },
      };

      const noEncryptionSecureComm = new SecureServiceCommunication(
        noEncryptionConfig,
        mockAuthConfig
      );
      expect(noEncryptionSecureComm).toBeInstanceOf(SecureServiceCommunication);
    });
  });
});
