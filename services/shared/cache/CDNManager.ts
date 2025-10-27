import {
  CloudFrontClient,
  CreateInvalidationCommand,
  GetDistributionCommand,
  GetInvalidationCommand,
} from '@aws-sdk/client-cloudfront';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../utils/logger';

export interface CDNConfig {
  distributionId: string;
  bucketName: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  cloudFrontDomain: string;
  defaultCacheTTL: number;
  maxCacheTTL: number;
}

export interface AssetUploadOptions {
  contentType?: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
  tags?: Record<string, string>;
}

export interface InvalidationResult {
  invalidationId: string;
  status: string;
  paths: string[];
}

export class CDNManager {
  private s3: S3Client;
  private cloudFront: CloudFrontClient;
  private config: CDNConfig;

  constructor(config: CDNConfig) {
    this.config = config;

    const credentials = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    };

    this.s3 = new S3Client({
      region: config.region,
      credentials,
    });

    this.cloudFront = new CloudFrontClient({
      region: config.region,
      credentials,
    });
  }

  /**
   * Upload asset to S3 with optimized caching headers
   */
  async uploadAsset(
    key: string,
    buffer: Buffer,
    options: AssetUploadOptions = {}
  ): Promise<string> {
    try {
      const cacheControl =
        options.cacheControl || this.getCacheControlHeader(key);

      const uploadCommand = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
        Body: buffer,
        ContentType: options.contentType || this.getContentType(key),
        CacheControl: cacheControl,
        Metadata: options.metadata || {},
        Tagging: options.tags
          ? Object.entries(options.tags)
              .map(([key, value]) => `${key}=${value}`)
              .join('&')
          : undefined,
      });

      await this.s3.send(uploadCommand);

      logger.info('Asset uploaded to CDN', {
        key,
        location: this.getCDNUrl(key),
        cacheControl,
      });

      return this.getCDNUrl(key);
    } catch (error) {
      logger.error(
        'Asset upload failed',
        error instanceof Error ? error : new Error(String(error)),
        { key }
      );
      throw error;
    }
  }

  /**
   * Upload multiple assets in batch
   */
  async uploadAssets(
    assets: Array<{
      key: string;
      buffer: Buffer;
      options?: AssetUploadOptions;
    }>
  ): Promise<string[]> {
    const uploadPromises = assets.map(asset =>
      this.uploadAsset(asset.key, asset.buffer, asset.options)
    );

    try {
      const results = await Promise.all(uploadPromises);

      logger.info('Batch asset upload completed', { count: assets.length });

      return results;
    } catch (error) {
      logger.error(
        'Batch asset upload failed',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Delete asset from S3 and invalidate CDN cache
   */
  async deleteAsset(key: string): Promise<void> {
    try {
      // Delete from S3
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      await this.s3.send(deleteCommand);

      // Invalidate CDN cache
      await this.invalidateCache([`/${key}`]);

      logger.info('Asset deleted from CDN', { key });
    } catch (error) {
      logger.error(
        'Asset deletion failed',
        error instanceof Error ? error : new Error(String(error)),
        { key }
      );
      throw error;
    }
  }

  /**
   * Invalidate CloudFront cache for specific paths
   */
  async invalidateCache(paths: string[]): Promise<InvalidationResult> {
    try {
      const command = new CreateInvalidationCommand({
        DistributionId: this.config.distributionId,
        InvalidationBatch: {
          Paths: {
            Quantity: paths.length,
            Items: paths,
          },
          CallerReference: `invalidation-${Date.now()}`,
        },
      });

      const result = await this.cloudFront.send(command);

      const invalidationResult: InvalidationResult = {
        invalidationId: result.Invalidation?.Id || '',
        status: result.Invalidation?.Status || 'Unknown',
        paths,
      };

      logger.info('CDN cache invalidated', invalidationResult);

      return invalidationResult;
    } catch (error) {
      logger.error(
        'CDN cache invalidation failed',
        error instanceof Error ? error : new Error(String(error)),
        { paths }
      );
      throw error;
    }
  }

  /**
   * Get invalidation status
   */
  async getInvalidationStatus(invalidationId: string): Promise<string> {
    try {
      const command = new GetInvalidationCommand({
        DistributionId: this.config.distributionId,
        Id: invalidationId,
      });

      const result = await this.cloudFront.send(command);

      return result.Invalidation?.Status || 'Unknown';
    } catch (error) {
      logger.error(
        'Failed to get invalidation status',
        error instanceof Error ? error : new Error(String(error)),
        { invalidationId }
      );
      throw error;
    }
  }

  /**
   * Optimize images for web delivery
   */
  async optimizeAndUploadImage(
    key: string,
    imageBuffer: Buffer,
    options: {
      quality?: number;
      format?: 'webp' | 'jpeg' | 'png';
      resize?: { width?: number; height?: number };
    } = {}
  ): Promise<string> {
    try {
      // Note: In a real implementation, you would use a library like Sharp
      // For now, we'll just upload the original image
      const optimizedBuffer = imageBuffer; // TODO: Implement image optimization

      const uploadOptions: AssetUploadOptions = {
        contentType: `image/${options.format || 'jpeg'}`,
        cacheControl: 'public, max-age=31536000, immutable', // 1 year cache for images
      };

      return await this.uploadAsset(key, optimizedBuffer, uploadOptions);
    } catch (error) {
      logger.error(
        'Image optimization and upload failed',
        error instanceof Error ? error : new Error(String(error)),
        { key }
      );
      throw error;
    }
  }

  /**
   * Generate signed URL for private assets
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      return await getSignedUrl(this.s3, command, { expiresIn });
    } catch (error) {
      logger.error(
        'Failed to generate signed URL',
        error instanceof Error ? error : new Error(String(error)),
        { key }
      );
      throw error;
    }
  }

  /**
   * Get CDN URL for public assets
   */
  getCDNUrl(key: string): string {
    return `https://${this.config.cloudFrontDomain}/${key}`;
  }

  /**
   * Preload critical assets
   */
  async preloadCriticalAssets(assetKeys: string[]): Promise<void> {
    try {
      // This would typically involve warming up the CDN cache
      // For now, we'll just log the preload request
      logger.info('Preloading critical assets', { assetKeys });

      // In a real implementation, you might:
      // 1. Make HEAD requests to warm up the cache
      // 2. Use CloudFront's origin shield
      // 3. Implement cache warming strategies
    } catch (error) {
      logger.error(
        'Failed to preload critical assets',
        error instanceof Error ? error : new Error(String(error)),
        { assetKeys }
      );
      throw error;
    }
  }

  /**
   * Get asset metadata and cache status
   */
  async getAssetInfo(key: string): Promise<{
    exists: boolean;
    size?: number;
    lastModified?: Date;
    cacheControl?: string;
    contentType?: string;
  }> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      const result = await this.s3.send(command);

      return {
        exists: true,
        size: result.ContentLength,
        lastModified: result.LastModified,
        cacheControl: result.CacheControl,
        contentType: result.ContentType,
      };
    } catch (error: any) {
      if (
        error.name === 'NotFound' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return { exists: false };
      }

      logger.error(
        'Failed to get asset info',
        error instanceof Error ? error : new Error(String(error)),
        { key }
      );
      throw error;
    }
  }

  /**
   * Health check for CDN services
   */
  async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      // Test S3 connectivity
      const headBucketCommand = new HeadBucketCommand({
        Bucket: this.config.bucketName,
      });

      await this.s3.send(headBucketCommand);

      // Test CloudFront connectivity
      const getDistributionCommand = new GetDistributionCommand({
        Id: this.config.distributionId,
      });

      await this.cloudFront.send(getDistributionCommand);

      return {
        status: 'healthy',
        details: {
          s3: 'connected',
          cloudFront: 'connected',
          distributionId: this.config.distributionId,
          bucketName: this.config.bucketName,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          distributionId: this.config.distributionId,
          bucketName: this.config.bucketName,
        },
      };
    }
  }

  private getCacheControlHeader(key: string): string {
    const extension = key.split('.').pop()?.toLowerCase();

    switch (extension) {
      case 'css':
      case 'js':
        return `public, max-age=${this.config.maxCacheTTL}, immutable`;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
      case 'svg':
        return `public, max-age=${this.config.maxCacheTTL}, immutable`;
      case 'html':
        return 'public, max-age=300, must-revalidate'; // 5 minutes
      case 'json':
      case 'xml':
        return `public, max-age=${this.config.defaultCacheTTL}`;
      default:
        return `public, max-age=${this.config.defaultCacheTTL}`;
    }
  }

  private getContentType(key: string): string {
    const extension = key.split('.').pop()?.toLowerCase();

    const contentTypes: Record<string, string> = {
      html: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
      json: 'application/json',
      xml: 'application/xml',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      pdf: 'application/pdf',
      zip: 'application/zip',
    };

    return contentTypes[extension || ''] || 'application/octet-stream';
  }
}
