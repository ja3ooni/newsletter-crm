import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { StructuredLogger } from '../logging/StructuredLogger';
import { getEncryptionService } from './EncryptionService';

const logger = new StructuredLogger({
  service: 'SecureServiceCommunication',
  environment: process.env.NODE_ENV || 'development',
});

export interface ServiceAuthConfig {
  serviceId: string;
  privateKey: string;
  publicKey: string;
  algorithm: 'RS256' | 'HS256';
  expiresIn: string | number;
}

export interface SecureCommunicationConfig {
  encryption: {
    enabled: boolean;
    algorithm: 'aes-256-gcm' | 'chacha20-poly1305';
  };
  authentication: {
    enabled: boolean;
    method: 'jwt' | 'hmac' | 'mutual-tls';
  };
  timeout: number;
  retries: number;
  circuitBreaker: {
    enabled: boolean;
    threshold: number;
    timeout: number;
  };
}

export interface SecureRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  data?: any;
  headers?: Record<string, string>;
  encrypted?: boolean;
}

export interface SecureResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
  encrypted: boolean;
}

export class SecureServiceCommunication {
  private config: SecureCommunicationConfig;
  private authConfig: ServiceAuthConfig;
  private httpClient!: AxiosInstance;
  private circuitBreakerState: Map<
    string,
    {
      failures: number;
      lastFailure: Date;
      isOpen: boolean;
    }
  > = new Map();

  constructor(
    config: SecureCommunicationConfig,
    authConfig: ServiceAuthConfig
  ) {
    this.config = config;
    this.authConfig = authConfig;
    this.initializeHttpClient();
  }

  private initializeHttpClient(): void {
    this.httpClient = axios.create({
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `ailert-service/${this.authConfig.serviceId}`,
      },
    });

    // Request interceptor for authentication and encryption
    this.httpClient.interceptors.request.use(
      async config => {
        if (this.config.authentication.enabled) {
          const authHeaders = await this.addAuthenticationHeaders(
            config.headers || {}
          );

          Object.assign(config.headers, authHeaders);
        }

        if (this.config.encryption.enabled && config.data) {
          config.data = await this.encryptRequestData(config.data);
          config.headers['X-Encrypted'] = 'true';
        }

        return config;
      },
      error => {
        logger.error('Request interceptor error', error as Error);

        return Promise.reject(error);
      }
    );

    // Response interceptor for decryption and error handling
    this.httpClient.interceptors.response.use(
      async response => {
        if (response.headers['x-encrypted'] === 'true') {
          response.data = await this.decryptResponseData(response.data);
        }

        return response;
      },
      error => {
        this.handleCircuitBreaker(error.config?.url || 'unknown', false);
        logger.error('Response interceptor error', error as Error);

        return Promise.reject(error);
      }
    );
  }

  /**
   * Make a secure request to another service
   */
  async request<T = any>(request: SecureRequest): Promise<SecureResponse<T>> {
    const {
      method,
      url,
      data,
      headers = {},
      encrypted = this.config.encryption.enabled,
    } = request;

    // Check circuit breaker
    if (this.isCircuitBreakerOpen(url)) {
      throw new Error(`Circuit breaker is open for ${url}`);
    }

    try {
      const config: AxiosRequestConfig = {
        method,
        url,
        data,
        headers: {
          ...headers,
          ...(encrypted && { 'X-Encrypt-Request': 'true' }),
        },
      };

      const response: AxiosResponse<T> = await this.httpClient.request(config);

      // Update circuit breaker on success
      this.handleCircuitBreaker(url, true);

      return {
        data: response.data,
        status: response.status,
        headers: response.headers as Record<string, string>,
        encrypted: response.headers['x-encrypted'] === 'true',
      };
    } catch (error) {
      this.handleCircuitBreaker(url, false);
      logger.error('Secure request failed', error as Error, { url, method });
      throw error;
    }
  }

  /**
   * Add authentication headers based on configured method
   */
  private async addAuthenticationHeaders(
    headers: Record<string, string>
  ): Promise<Record<string, string>> {
    switch (this.config.authentication.method) {
      case 'jwt': {
        const token = await this.generateJWT();

        return {
          ...headers,
          Authorization: `Bearer ${token}`,
        };
      }

      case 'hmac': {
        const signature = await this.generateHMACSignature(headers);

        return {
          ...headers,
          'X-Signature': signature,
          'X-Service-ID': this.authConfig.serviceId,
        };
      }

      case 'mutual-tls':
        // Mutual TLS would be handled at the HTTP client level
        return {
          ...headers,
          'X-Service-ID': this.authConfig.serviceId,
        };

      default:
        return headers;
    }
  }

  /**
   * Generate JWT token for service authentication
   */
  private async generateJWT(): Promise<string> {
    const payload = {
      serviceId: this.authConfig.serviceId,
      iat: Math.floor(Date.now() / 1000),
      iss: 'ailert-platform',
    };

    return jwt.sign(payload, this.authConfig.privateKey, {
      algorithm: this.authConfig.algorithm,
      expiresIn: this.authConfig.expiresIn,
    } as jwt.SignOptions);
  }

  /**
   * Generate HMAC signature for request authentication
   */
  private async generateHMACSignature(
    headers: Record<string, string>
  ): Promise<string> {
    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(16).toString('hex');

    const stringToSign = [
      this.authConfig.serviceId,
      timestamp,
      nonce,
      JSON.stringify(headers),
    ].join('\n');

    const signature = crypto
      .createHmac('sha256', this.authConfig.privateKey)
      .update(stringToSign)
      .digest('hex');

    return `${timestamp}:${nonce}:${signature}`;
  }

  /**
   * Encrypt request data
   */
  private async encryptRequestData(data: any): Promise<string> {
    const encryptionService = getEncryptionService();
    const serializedData = JSON.stringify(data);
    const encrypted = await encryptionService.encrypt(serializedData);

    return JSON.stringify(encrypted);
  }

  /**
   * Decrypt response data
   */
  private async decryptResponseData(encryptedData: string): Promise<any> {
    const encryptionService = getEncryptionService();
    const encryptedObject = JSON.parse(encryptedData);
    const decrypted = await encryptionService.decrypt(encryptedObject);

    return JSON.parse(decrypted);
  }

  /**
   * Handle circuit breaker logic
   */
  private handleCircuitBreaker(url: string, success: boolean): void {
    if (!this.config.circuitBreaker.enabled) return;

    const state = this.circuitBreakerState.get(url) || {
      failures: 0,
      lastFailure: new Date(),
      isOpen: false,
    };

    if (success) {
      // Reset on success
      state.failures = 0;
      state.isOpen = false;
    } else {
      // Increment failures
      state.failures++;
      state.lastFailure = new Date();

      // Open circuit if threshold exceeded
      if (state.failures >= this.config.circuitBreaker.threshold) {
        state.isOpen = true;
        logger.warn('Circuit breaker opened', {
          url,
          failures: state.failures,
        });
      }
    }

    this.circuitBreakerState.set(url, state);
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitBreakerOpen(url: string): boolean {
    if (!this.config.circuitBreaker.enabled) return false;

    const state = this.circuitBreakerState.get(url);

    if (!state || !state.isOpen) return false;

    // Check if timeout has passed to allow retry
    const timeSinceLastFailure = Date.now() - state.lastFailure.getTime();

    if (timeSinceLastFailure > this.config.circuitBreaker.timeout) {
      state.isOpen = false;
      this.circuitBreakerState.set(url, state);

      return false;
    }

    return true;
  }

  /**
   * Verify JWT token from incoming request
   */
  static verifyJWT(
    token: string,
    publicKey: string,
    algorithm: 'RS256' | 'HS256' = 'RS256'
  ): any {
    try {
      return jwt.verify(token, publicKey, { algorithms: [algorithm] });
    } catch (error) {
      logger.error('JWT verification failed', error as Error);
      throw new Error('Invalid token');
    }
  }

  /**
   * Verify HMAC signature from incoming request
   */
  static verifyHMACSignature(
    signature: string,
    headers: Record<string, string>,
    serviceId: string,
    secretKey: string
  ): boolean {
    try {
      const parts = signature.split(':');

      if (parts.length !== 3) {
        return false;
      }

      const [timestamp, nonce, receivedSignature] = parts;

      // Check timestamp (prevent replay attacks)
      const requestTime = parseInt(timestamp || '0', 10);
      const currentTime = Date.now();
      const timeDiff = Math.abs(currentTime - requestTime);

      if (timeDiff > 300000) {
        // 5 minutes
        logger.warn('Request timestamp too old', { timeDiff });

        return false;
      }

      const stringToSign = [
        serviceId,
        timestamp,
        nonce,
        JSON.stringify(headers),
      ].join('\n');

      const expectedSignature = crypto
        .createHmac('sha256', secretKey)
        .update(stringToSign)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(receivedSignature || '', 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      logger.error('HMAC verification failed', error as Error);

      return false;
    }
  }
}

// Factory function
export function createSecureServiceCommunication(
  config: SecureCommunicationConfig,
  authConfig: ServiceAuthConfig
): SecureServiceCommunication {
  return new SecureServiceCommunication(config, authConfig);
}

// Default configuration
export const defaultSecureCommunicationConfig: SecureCommunicationConfig = {
  encryption: {
    enabled: process.env.SERVICE_ENCRYPTION_ENABLED === 'true',
    algorithm: 'aes-256-gcm',
  },
  authentication: {
    enabled: true,
    method:
      (process.env.SERVICE_AUTH_METHOD as 'jwt' | 'hmac' | 'mutual-tls') ||
      'jwt',
  },
  timeout: parseInt(process.env.SERVICE_TIMEOUT || '30000'),
  retries: parseInt(process.env.SERVICE_RETRIES || '3'),
  circuitBreaker: {
    enabled: process.env.CIRCUIT_BREAKER_ENABLED !== 'false',
    threshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5'),
    timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '60000'),
  },
};
