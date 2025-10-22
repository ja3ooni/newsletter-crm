import { jwtConfig, securityConfig } from '@/config';
import {
    AuthTokens,
    JwtPayload,
    Permission,
    RefreshTokenPayload,
    UnauthorizedError,
    User,
} from '@/types';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { logger, logSecurityEvent } from './logger';
import { redis } from './redis';

export class AuthUtils {
  // Password hashing
  static async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, securityConfig.bcryptRounds);
    } catch (error) {
      logger.error('Password hashing error:', error);
      throw new Error('Failed to hash password');
    }
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      logger.error('Password verification error:', error);
      return false;
    }
  }

  // JWT token generation and verification
  static generateTokens(user: User, roles: string[], permissions: Permission[]): AuthTokens {
    const tokenId = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    // Access token payload
    const accessPayload: JwtPayload = {
      userId: user.id,
      email: user.email,
      roles,
      permissions,
      iat: now,
      exp: now + this.parseExpiryTime(jwtConfig.expiresIn),
    };

    // Refresh token payload
    const refreshPayload: RefreshTokenPayload = {
      userId: user.id,
      tokenId,
      iat: now,
      exp: now + this.parseExpiryTime(jwtConfig.refreshExpiresIn),
    };

    const accessToken = jwt.sign(accessPayload, jwtConfig.secret, {
      algorithm: jwtConfig.algorithm,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
    });

    const refreshToken = jwt.sign(refreshPayload, jwtConfig.refreshSecret, {
      algorithm: jwtConfig.algorithm,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiryTime(jwtConfig.expiresIn),
    };
  }

  static async verifyAccessToken(token: string): Promise<JwtPayload> {
    try {
      const payload = jwt.verify(token, jwtConfig.secret, {
        algorithms: [jwtConfig.algorithm],
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      }) as JwtPayload;

      // Check if token is blacklisted
      const isBlacklisted = await redis.isTokenBlacklisted(payload.userId + ':' + payload.iat);
      if (isBlacklisted) {
        throw new UnauthorizedError('Token has been revoked');
      }

      return payload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Token expired');
      }
      throw error;
    }
  }

  static async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      const payload = jwt.verify(token, jwtConfig.refreshSecret, {
        algorithms: [jwtConfig.algorithm],
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      }) as RefreshTokenPayload;

      // Check if token is blacklisted
      const isBlacklisted = await redis.isTokenBlacklisted(payload.tokenId);
      if (isBlacklisted) {
        throw new UnauthorizedError('Refresh token has been revoked');
      }

      return payload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid refresh token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Refresh token expired');
      }
      throw error;
    }
  }

  // Token blacklisting
  static async blacklistToken(payload: JwtPayload): Promise<void> {
    const tokenKey = payload.userId + ':' + payload.iat;
    const expiresAt = new Date(payload.exp * 1000);
    await redis.blacklistToken(tokenKey, expiresAt);

    logSecurityEvent('token_blacklisted', {
      userId: payload.userId,
      tokenId: tokenKey,
      expiresAt,
    });
  }

  static async blacklistRefreshToken(payload: RefreshTokenPayload): Promise<void> {
    const expiresAt = new Date(payload.exp * 1000);
    await redis.blacklistToken(payload.tokenId, expiresAt);

    logSecurityEvent('refresh_token_blacklisted', {
      userId: payload.userId,
      tokenId: payload.tokenId,
      expiresAt,
    });
  }

  // API Key generation and verification
  static generateApiKey(): { key: string; hash: string } {
    const key = 'ak_' + crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    return { key, hash };
  }

  static verifyApiKey(key: string, hash: string): boolean {
    const computedHash = crypto.createHash('sha256').update(key).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(computedHash));
  }

  // Password reset tokens
  static generatePasswordResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  static async storePasswordResetToken(userId: string, token: string, expiryMinutes = 60): Promise<void> {
    const key = `password_reset:${token}`;
    const ttl = expiryMinutes * 60; // Convert to seconds
    await redis.setJson(key, { userId, createdAt: new Date() }, ttl);
  }

  static async verifyPasswordResetToken(token: string): Promise<string | null> {
    const key = `password_reset:${token}`;
    const data = await redis.getJson<{ userId: string; createdAt: string }>(key);

    if (!data) {
      return null;
    }

    // Remove token after verification (single use)
    await redis.del(key);
    return data.userId;
  }

  // Email verification tokens
  static generateEmailVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  static async storeEmailVerificationToken(userId: string, token: string, expiryHours = 24): Promise<void> {
    const key = `email_verification:${token}`;
    const ttl = expiryHours * 3600; // Convert to seconds
    await redis.setJson(key, { userId, createdAt: new Date() }, ttl);
  }

  static async verifyEmailVerificationToken(token: string): Promise<string | null> {
    const key = `email_verification:${token}`;
    const data = await redis.getJson<{ userId: string; createdAt: string }>(key);

    if (!data) {
      return null;
    }

    // Remove token after verification (single use)
    await redis.del(key);
    return data.userId;
  }

  // Rate limiting helpers
  static async checkRateLimit(identifier: string, windowMs: number, maxRequests: number): Promise<boolean> {
    const key = `rate_limit:${identifier}`;
    const windowSeconds = Math.floor(windowMs / 1000);

    const count = await redis.incrementWithExpiry(key, windowSeconds);
    return count <= maxRequests;
  }

  static async getRateLimitInfo(identifier: string): Promise<{ count: number; ttl: number }> {
    const key = `rate_limit:${identifier}`;
    const count = parseInt(await redis.get(key) || '0', 10);
    const ttl = await redis.getClient().ttl(key);

    return { count, ttl };
  }

  // Permission checking
  static hasPermission(userPermissions: Permission[], requiredPermission: Permission): boolean {
    return userPermissions.some(permission =>
      permission.resource === requiredPermission.resource &&
      permission.action === requiredPermission.action &&
      this.matchesConditions(permission.conditions, requiredPermission.conditions)
    );
  }

  static hasAnyPermission(userPermissions: Permission[], requiredPermissions: Permission[]): boolean {
    return requiredPermissions.some(required => this.hasPermission(userPermissions, required));
  }

  static hasAllPermissions(userPermissions: Permission[], requiredPermissions: Permission[]): boolean {
    return requiredPermissions.every(required => this.hasPermission(userPermissions, required));
  }

  private static matchesConditions(
    userConditions?: Record<string, any>,
    requiredConditions?: Record<string, any>
  ): boolean {
    if (!requiredConditions) return true;
    if (!userConditions) return false;

    return Object.entries(requiredConditions).every(([key, value]) => {
      const userValue = userConditions[key];
      if (Array.isArray(value)) {
        return Array.isArray(userValue) && value.every(v => userValue.includes(v));
      }
      return userValue === value;
    });
  }

  // Utility functions
  private static parseExpiryTime(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid expiry format: ${expiry}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: throw new Error(`Invalid expiry unit: ${unit}`);
    }
  }

  // Session management
  static async createSession(userId: string, metadata: Record<string, any> = {}): Promise<string> {
    const sessionId = uuidv4();
    const sessionData = {
      userId,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      ...metadata,
    };

    const ttl = this.parseExpiryTime(jwtConfig.refreshExpiresIn);
    await redis.createSession(sessionId, sessionData, ttl);

    return sessionId;
  }

  static async getSession(sessionId: string): Promise<any | null> {
    return await redis.getSession(sessionId);
  }

  static async updateSessionAccess(sessionId: string): Promise<void> {
    const session = await redis.getSession(sessionId);
    if (session) {
      session.lastAccessedAt = new Date();
      const ttl = this.parseExpiryTime(jwtConfig.refreshExpiresIn);
      await redis.createSession(sessionId, session, ttl);
    }
  }

  static async destroySession(sessionId: string): Promise<void> {
    await redis.destroySession(sessionId);
  }
}
