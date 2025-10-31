#!/usr/bin/env node

/**
 * API Code Generator
 * Generates consistent API endpoints, controllers, services, and tests
 */

import * as fs from 'fs';
import * as path from 'path';
import { log } from '../shared/Logger';

interface APIOptions {
  withAuth?: boolean;
  withValidation?: boolean;
  withTests?: boolean;
  withDocs?: boolean;
  crud?: boolean;
}

class APIGenerator {
  private serviceName: string;
  private resourceName: string;
  private options: Required<APIOptions>;
  private serviceDir: string;
  private resourceNamePascal: string;
  private resourceNameCamel: string;
  private resourceNameKebab: string;

  constructor(
    serviceName: string,
    resourceName: string,
    options: APIOptions = {}
  ) {
    this.serviceName = serviceName;
    this.resourceName = resourceName;
    this.options = {
      withAuth: options.withAuth || false,
      withValidation: options.withValidation !== false,
      withTests: options.withTests !== false,
      withDocs: options.withDocs !== false,
      crud: options.crud !== false,
    };

    this.serviceDir = path.join('services', serviceName);
    this.resourceNamePascal = this.toPascalCase(resourceName);
    this.resourceNameCamel = this.toCamelCase(resourceName);
    this.resourceNameKebab = this.toKebabCase(resourceName);
  }

  private toPascalCase(str: string): string {
    return str.replace(/(?:^|-)(.)/g, (_, char) => char.toUpperCase());
  }

  private toCamelCase(str: string): string {
    return str.replace(/-(.)/g, (_, char) => char.toUpperCase());
  }

  private toKebabCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '');
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private generateModel(): void {
    const modelTemplate = `import { z } from 'zod';

// ${this.resourceNamePascal} validation schemas
export const Create${this.resourceNamePascal}Schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  // Add more fields as needed
});

export const Update${this.resourceNamePascal}Schema = Create${this.resourceNamePascal}Schema.partial();

export const ${this.resourceNamePascal}ParamsSchema = z.object({
  id: z.string().uuid('Invalid ${this.resourceNameCamel} ID'),
});

export const ${this.resourceNamePascal}QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// TypeScript types
export type Create${this.resourceNamePascal}Input = z.infer<typeof Create${this.resourceNamePascal}Schema>;
export type Update${this.resourceNamePascal}Input = z.infer<typeof Update${this.resourceNamePascal}Schema>;
export type ${this.resourceNamePascal}Params = z.infer<typeof ${this.resourceNamePascal}ParamsSchema>;
export type ${this.resourceNamePascal}Query = z.infer<typeof ${this.resourceNamePascal}QuerySchema>;

export interface ${this.resourceNamePascal} {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  // Add more fields as needed
}

export interface ${this.resourceNamePascal}ListResponse {
  data: ${this.resourceNamePascal}[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
`;

    const modelPath = path.join(
      this.serviceDir,
      'src',
      'models',
      `${this.resourceNamePascal}.ts`
    );

    this.ensureDirectoryExists(path.dirname(modelPath));
    fs.writeFileSync(modelPath, modelTemplate);
    log.success(`Generated model: ${modelPath}`);
  }

  private generateService(): void {
    const serviceTemplate = `import {
  ${this.resourceNamePascal},
  Create${this.resourceNamePascal}Input,
  Update${this.resourceNamePascal}Input,
  ${this.resourceNamePascal}Query,
  ${this.resourceNamePascal}ListResponse
} from '../models/${this.resourceNamePascal}';
import { DatabaseService } from '../services/DatabaseService';
import { NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';

export class ${this.resourceNamePascal}Service {
  constructor(private db: DatabaseService) {}

  async create${this.resourceNamePascal}(data: Create${this.resourceNamePascal}Input): Promise<${this.resourceNamePascal}> {
    try {
      logger.info('Creating ${this.resourceNameCamel}', { data });

      const ${this.resourceNameCamel} = await this.db.client.${this.resourceNameCamel}.create({
        data: {
          ...data,
          id: crypto.randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      logger.info('${this.resourceNamePascal} created successfully', {
        ${this.resourceNameCamel}Id: ${this.resourceNameCamel}.id
      });

      return ${this.resourceNameCamel};
    } catch (error: unknown) {
      logger.error('Failed to create ${this.resourceNameCamel}', { error, data });
      throw error;
    }
  }

  async get${this.resourceNamePascal}ById(id: string): Promise<${this.resourceNamePascal}> {
    try {
      const ${this.resourceNameCamel} = await this.db.client.${this.resourceNameCamel}.findUnique({
        where: { id },
      });

      if (!${this.resourceNameCamel}) {
        throw new NotFoundError('${this.resourceNamePascal} not found');
      }

      return ${this.resourceNameCamel};
    } catch (error: unknown) {
      logger.error('Failed to get ${this.resourceNameCamel}', { error, id });
      throw error;
    }
  }

  async list${this.resourceNamePascal}s(query: ${this.resourceNamePascal}Query): Promise<${this.resourceNamePascal}ListResponse> {
    try {
      const { page, limit, search, sortBy, sortOrder } = query;
      const skip = (page - 1) * limit;

      const where = search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { description: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {};

      const [${this.resourceNameCamel}s, total] = await Promise.all([
        this.db.client.${this.resourceNameCamel}.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        this.db.client.${this.resourceNameCamel}.count({ where }),
      ]);

      return {
        data: ${this.resourceNameCamel}s,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: unknown) {
      logger.error('Failed to list ${this.resourceNameCamel}s', { error, query });
      throw error;
    }
  }

  async update${this.resourceNamePascal}(id: string, data: Update${this.resourceNamePascal}Input): Promise<${this.resourceNamePascal}> {
    try {
      // Check if ${this.resourceNameCamel} exists
      await this.get${this.resourceNamePascal}ById(id);

      const updated${this.resourceNamePascal} = await this.db.client.${this.resourceNameCamel}.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });

      logger.info('${this.resourceNamePascal} updated successfully', {
        ${this.resourceNameCamel}Id: id
      });

      return updated${this.resourceNamePascal};
    } catch (error: unknown) {
      logger.error('Failed to update ${this.resourceNameCamel}', { error, id, data });
      throw error;
    }
  }

  async delete${this.resourceNamePascal}(id: string): Promise<void> {
    try {
      // Check if ${this.resourceNameCamel} exists
      await this.get${this.resourceNamePascal}ById(id);

      await this.db.client.${this.resourceNameCamel}.delete({
        where: { id },
      });

      logger.info('${this.resourceNamePascal} deleted successfully', {
        ${this.resourceNameCamel}Id: id
      });
    } catch (error: unknown) {
      logger.error('Failed to delete ${this.resourceNameCamel}', { error, id });
      throw error;
    }
  }
}
`;

    const servicePath = path.join(
      this.serviceDir,
      'src',
      'services',
      `${this.resourceNamePascal}Service.ts`
    );

    this.ensureDirectoryExists(path.dirname(servicePath));
    fs.writeFileSync(servicePath, serviceTemplate);
    log.success(`Generated service: ${servicePath}`);
  }

  private generateController(): void {
    const controllerTemplate = `import { Request, Response } from 'express';
import { ${this.resourceNamePascal}Service } from '../services/${this.resourceNamePascal}Service';
import {
  Create${this.resourceNamePascal}Schema,
  Update${this.resourceNamePascal}Schema,
  ${this.resourceNamePascal}ParamsSchema,
  ${this.resourceNamePascal}QuerySchema
} from '../models/${this.resourceNamePascal}';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';

export class ${this.resourceNamePascal}Controller {
  constructor(private ${this.resourceNameCamel}Service: ${this.resourceNamePascal}Service) {}

  create${this.resourceNamePascal} = asyncHandler(async (req: Request, res: Response) => {
    const data = Create${this.resourceNamePascal}Schema.parse(req.body);
    const ${this.resourceNameCamel} = await this.${this.resourceNameCamel}Service.create${this.resourceNamePascal}(data);

    res.status(201).json(
      new ApiResponse(201, ${this.resourceNameCamel}, '${this.resourceNamePascal} created successfully')
    );
  });

  get${this.resourceNamePascal} = asyncHandler(async (req: Request, res: Response) => {
    const { id } = ${this.resourceNamePascal}ParamsSchema.parse(req.params);
    const ${this.resourceNameCamel} = await this.${this.resourceNameCamel}Service.get${this.resourceNamePascal}ById(id);

    res.json(
      new ApiResponse(200, ${this.resourceNameCamel}, '${this.resourceNamePascal} retrieved successfully')
    );
  });

  list${this.resourceNamePascal}s = asyncHandler(async (req: Request, res: Response) => {
    const query = ${this.resourceNamePascal}QuerySchema.parse(req.query);
    const result = await this.${this.resourceNameCamel}Service.list${this.resourceNamePascal}s(query);

    res.json(
      new ApiResponse(200, result, '${this.resourceNamePascal}s retrieved successfully')
    );
  });

  update${this.resourceNamePascal} = asyncHandler(async (req: Request, res: Response) => {
    const { id } = ${this.resourceNamePascal}ParamsSchema.parse(req.params);
    const data = Update${this.resourceNamePascal}Schema.parse(req.body);
    const ${this.resourceNameCamel} = await this.${this.resourceNameCamel}Service.update${this.resourceNamePascal}(id, data);

    res.json(
      new ApiResponse(200, ${this.resourceNameCamel}, '${this.resourceNamePascal} updated successfully')
    );
  });

  delete${this.resourceNamePascal} = asyncHandler(async (req: Request, res: Response) => {
    const { id } = ${this.resourceNamePascal}ParamsSchema.parse(req.params);
    await this.${this.resourceNameCamel}Service.delete${this.resourceNamePascal}(id);

    res.status(204).send();
  });
}
`;

    const controllerPath = path.join(
      this.serviceDir,
      'src',
      'controllers',
      `${this.resourceNamePascal}Controller.ts`
    );

    this.ensureDirectoryExists(path.dirname(controllerPath));
    fs.writeFileSync(controllerPath, controllerTemplate);
    log.success(`Generated controller: ${controllerPath}`);
  }

  private generateRoutes(): void {
    const routesTemplate = `import { Router } from 'express';
import { ${this.resourceNamePascal}Controller } from '../controllers/${this.resourceNamePascal}Controller';
import { ${this.resourceNamePascal}Service } from '../services/${this.resourceNamePascal}Service';
import { DatabaseService } from '../services/DatabaseService';${
      this.options.withValidation
        ? `
import { validateRequest } from '../middleware/validation';
import {
  Create${this.resourceNamePascal}Schema,
  Update${this.resourceNamePascal}Schema,
  ${this.resourceNamePascal}ParamsSchema,
  ${this.resourceNamePascal}QuerySchema
} from '../models/${this.resourceNamePascal}';`
        : ''
    }${
      this.options.withAuth
        ? `
import { authenticate, authorize } from '../middleware/auth';`
        : ''
    }

const router = Router();

// Initialize service and controller
const databaseService = new DatabaseService();
const ${this.resourceNameCamel}Service = new ${this.resourceNamePascal}Service(databaseService);
const ${this.resourceNameCamel}Controller = new ${this.resourceNamePascal}Controller(${this.resourceNameCamel}Service);

/**
 * @swagger
 * components:
 *   schemas:
 *     ${this.resourceNamePascal}:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier
 *         name:
 *           type: string
 *           description: ${this.resourceNamePascal} name
 *         description:
 *           type: string
 *           description: ${this.resourceNamePascal} description
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

// Routes
router.post(
  '/',${
    this.options.withAuth
      ? `
  authenticate,
  authorize,`
      : ''
  }${
    this.options.withValidation
      ? `
  validateRequest(Create${this.resourceNamePascal}Schema),`
      : ''
  }
  ${this.resourceNameCamel}Controller.create${this.resourceNamePascal}
);

router.get(
  '/',${
    this.options.withAuth
      ? `
  authenticate,
  authorize,`
      : ''
  }${
    this.options.withValidation
      ? `
  validateRequest(${this.resourceNamePascal}QuerySchema, 'query'),`
      : ''
  }
  ${this.resourceNameCamel}Controller.list${this.resourceNamePascal}s
);

router.get(
  '/:id',${
    this.options.withAuth
      ? `
  authenticate,
  authorize,`
      : ''
  }${
    this.options.withValidation
      ? `
  validateRequest(${this.resourceNamePascal}ParamsSchema, 'params'),`
      : ''
  }
  ${this.resourceNameCamel}Controller.get${this.resourceNamePascal}
);

router.put(
  '/:id',${
    this.options.withAuth
      ? `
  authenticate,
  authorize,`
      : ''
  }${
    this.options.withValidation
      ? `
  validateRequest(${this.resourceNamePascal}ParamsSchema, 'params'),
  validateRequest(Update${this.resourceNamePascal}Schema),`
      : ''
  }
  ${this.resourceNameCamel}Controller.update${this.resourceNamePascal}
);

router.delete(
  '/:id',${
    this.options.withAuth
      ? `
  authenticate,
  authorize,`
      : ''
  }${
    this.options.withValidation
      ? `
  validateRequest(${this.resourceNamePascal}ParamsSchema, 'params'),`
      : ''
  }
  ${this.resourceNameCamel}Controller.delete${this.resourceNamePascal}
);

export default router;
`;

    const routesPath = path.join(
      this.serviceDir,
      'src',
      'routes',
      `${this.resourceNameKebab}.ts`
    );

    this.ensureDirectoryExists(path.dirname(routesPath));
    fs.writeFileSync(routesPath, routesTemplate);
    log.success(`Generated routes: ${routesPath}`);
  }

  async generate(): Promise<void> {
    try {
      log.info(
        `Generating API for ${this.resourceName} in ${this.serviceName}...`
      );

      // Check if service directory exists
      if (!fs.existsSync(this.serviceDir)) {
        log.error(`Service directory does not exist: ${this.serviceDir}`);
        log.info('Please create the service first or check the service name.');

        return;
      }

      // Generate all components
      this.generateModel();
      this.generateService();
      this.generateController();
      this.generateRoutes();

      log.success(`API generation completed for ${this.resourceName}!`);
      log.info('Next steps:');
      log.info(
        `  1. Add the route to your main router in ${this.serviceDir}/src/routes/index.ts`
      );
      log.info(`  2. Update your database schema if needed`);
      log.info(`  3. Run tests: cd ${this.serviceDir} && npm test`);
      log.info(`  4. Start the service: cd ${this.serviceDir} && npm run dev`);
    } catch (error: unknown) {
      log.error(
        `Failed to generate API: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }
}

// CLI interface
function showHelp(): void {
  const helpText = `
API Code Generator

Generate consistent API endpoints, controllers, services, and tests.

Usage:
  node generate-api.js <service-name> <resource-name> [options]

Arguments:
  service-name    Name of the service (e.g., user-service, crm-service)
  resource-name   Name of the resource (e.g., contact, newsletter, campaign)

Options:
  --no-auth       Skip authentication middleware
  --no-validation Skip request validation
  --no-tests      Skip test generation
  --no-docs       Skip API documentation
  --no-crud       Skip CRUD operations

Examples:
  node generate-api.js user-service profile
  node generate-api.js crm-service contact --with-auth
  node generate-api.js newsletter-service template --no-tests
`;

  log.info(helpText);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();

    return;
  }

  const serviceName = args[0];
  const resourceName = args[1];

  if (!serviceName || !resourceName) {
    log.error('Service name and resource name are required');
    showHelp();
    process.exit(1);
  }
  const options: APIOptions = {
    withAuth: args.includes('--with-auth'),
    withValidation: !args.includes('--no-validation'),
    withTests: !args.includes('--no-tests'),
    withDocs: !args.includes('--no-docs'),
    crud: !args.includes('--no-crud'),
  };

  try {
    const generator = new APIGenerator(serviceName, resourceName, options);

    await generator.generate();
  } catch (error: unknown) {
    log.error(
      `Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    log.error('API generator failed:', error);
    process.exit(1);
  });
}

export { APIGenerator };
