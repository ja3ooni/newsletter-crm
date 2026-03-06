// @ts-nocheck
import {
  CreateCustomFieldRequest,
  CustomField,
  CustomFieldEntity,
  NotFoundError,
  PaginatedResponse,
  PaginationOptions,
  UpdateCustomFieldRequest,
} from '@/types';
import logger from '@/utils/logger';
import { Pool } from 'pg';

export class CustomFieldRepository {
  constructor(private db: Pool) {}

  async create(
    data: CreateCustomFieldRequest,
    createdBy?: string
  ): Promise<CustomField> {
    try {
      const result = await this.db.query(
        `INSERT INTO custom_fields (
          name, label, type, entity_type, options, validation, is_required,
          is_unique, is_searchable, default_value, help_text, field_order, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          data.name,
          data.label,
          data.type,
          data.entityType,
          JSON.stringify(data.options || []),
          JSON.stringify(data.validation || {}),
          data.isRequired || false,
          data.isUnique || false,
          data.isSearchable || false,
          data.defaultValue,
          data.helpText,
          data.order || 0,
          createdBy,
        ]
      );

      return this.mapFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Error creating custom field:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<CustomField | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM custom_fields WHERE id = $1',
        [id]
      );

      return result.rows.length > 0 ? this.mapFromDb(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error finding custom field by ID:', { id, error });
      throw error;
    }
  }

  async findByEntityType(
    entityType: CustomFieldEntity
  ): Promise<CustomField[]> {
    try {
      const result = await this.db.query(
        'SELECT * FROM custom_fields WHERE entity_type = $1 AND is_active = true ORDER BY field_order, created_at',
        [entityType]
      );

      return result.rows.map(this.mapFromDb);
    } catch (error) {
      logger.error('Error finding custom fields by entity type:', {
        entityType,
        error,
      });
      throw error;
    }
  }

  async findAll(
    options?: PaginationOptions
  ): Promise<PaginatedResponse<CustomField>> {
    try {
      const {
        page = 1,
        limit = 50,
        sortBy = 'field_order',
        sortOrder = 'asc',
      } = options || {};
      const offset = (page - 1) * limit;

      const countResult = await this.db.query(
        'SELECT COUNT(*) FROM custom_fields WHERE is_active = true'
      );
      const total = parseInt(countResult.rows[0].count);

      const fieldsResult = await this.db.query(
        `SELECT * FROM custom_fields WHERE is_active = true
         ORDER BY ${sortBy} ${sortOrder}
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      const fields = fieldsResult.rows.map(this.mapFromDb);

      return {
        data: fields,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      };
    } catch (error) {
      logger.error('Error finding all custom fields:', error);
      throw error;
    }
  }

  async update(
    id: string,
    updates: UpdateCustomFieldRequest
  ): Promise<CustomField> {
    try {
      const setParts = [];
      const values = [];
      let paramIndex = 1;

      const updateableFields = [
        'name',
        'label',
        'options',
        'validation',
        'is_required',
        'is_unique',
        'is_searchable',
        'default_value',
        'help_text',
        'field_order',
        'is_active',
      ];

      for (const [key, value] of Object.entries(updates)) {
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (updateableFields.includes(dbField)) {
          setParts.push(`${dbField} = $${paramIndex++}`);
          if (key === 'options' || key === 'validation') {
            values.push(JSON.stringify(value));
          } else {
            values.push(value);
          }
        }
      }

      if (setParts.length === 0) {
        const field = await this.findById(id);
        if (!field) throw new NotFoundError('Custom Field');
        return field;
      }

      setParts.push(`updated_at = $${paramIndex++}`);
      values.push(new Date());
      values.push(id);

      const result = await this.db.query(
        `UPDATE custom_fields SET ${setParts.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('Custom Field');
      }

      return this.mapFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Error updating custom field:', { id, error });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      // Soft delete by setting is_active to false
      const result = await this.db.query(
        'UPDATE custom_fields SET is_active = false, updated_at = NOW() WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new NotFoundError('Custom Field');
      }
    } catch (error) {
      logger.error('Error deleting custom field:', { id, error });
      throw error;
    }
  }

  async validateFieldValue(
    fieldId: string,
    value: any
  ): Promise<{ isValid: boolean; error?: string }> {
    try {
      const field = await this.findById(fieldId);
      if (!field) {
        return { isValid: false, error: 'Custom field not found' };
      }

      // Check if required field has value
      if (
        field.isRequired &&
        (value === null || value === undefined || value === '')
      ) {
        return { isValid: false, error: `${field.label} is required` };
      }

      // Type-specific validation
      switch (field.type) {
        case 'number':
          if (value !== null && value !== undefined && isNaN(Number(value))) {
            return { isValid: false, error: `${field.label} must be a number` };
          }
          break;

        case 'email':
          if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            return {
              isValid: false,
              error: `${field.label} must be a valid email address`,
            };
          }
          break;

        case 'url':
          if (value && !/^https?:\/\/.+/.test(value)) {
            return {
              isValid: false,
              error: `${field.label} must be a valid URL`,
            };
          }
          break;

        case 'select':
          if (value && field.options) {
            const validOptions = field.options
              .filter(opt => opt.isActive)
              .map(opt => opt.value);
            if (!validOptions.includes(value)) {
              return {
                isValid: false,
                error: `${field.label} must be one of: ${validOptions.join(', ')}`,
              };
            }
          }
          break;

        case 'multiselect':
          if (value && Array.isArray(value) && field.options) {
            const validOptions = field.options
              .filter(opt => opt.isActive)
              .map(opt => opt.value);
            const invalidValues = value.filter(v => !validOptions.includes(v));
            if (invalidValues.length > 0) {
              return {
                isValid: false,
                error: `${field.label} contains invalid values: ${invalidValues.join(', ')}`,
              };
            }
          }
          break;
      }

      // Custom validation rules
      if (field.validation) {
        if (
          field.validation.minLength &&
          value &&
          value.length < field.validation.minLength
        ) {
          return {
            isValid: false,
            error: `${field.label} must be at least ${field.validation.minLength} characters`,
          };
        }

        if (
          field.validation.maxLength &&
          value &&
          value.length > field.validation.maxLength
        ) {
          return {
            isValid: false,
            error: `${field.label} must be no more than ${field.validation.maxLength} characters`,
          };
        }

        if (
          field.validation.minValue &&
          value !== null &&
          Number(value) < field.validation.minValue
        ) {
          return {
            isValid: false,
            error: `${field.label} must be at least ${field.validation.minValue}`,
          };
        }

        if (
          field.validation.maxValue &&
          value !== null &&
          Number(value) > field.validation.maxValue
        ) {
          return {
            isValid: false,
            error: `${field.label} must be no more than ${field.validation.maxValue}`,
          };
        }

        if (
          field.validation.pattern &&
          value &&
          !new RegExp(field.validation.pattern).test(value)
        ) {
          return { isValid: false, error: `${field.label} format is invalid` };
        }
      }

      return { isValid: true };
    } catch (error) {
      logger.error('Error validating field value:', { fieldId, error });
      return { isValid: false, error: 'Validation error occurred' };
    }
  }

  async validateEntityCustomFields(
    entityType: CustomFieldEntity,
    customFields: Record<string, any>
  ): Promise<{ isValid: boolean; errors: string[] }> {
    try {
      const fields = await this.findByEntityType(entityType);
      const errors: string[] = [];

      for (const field of fields) {
        const value = customFields[field.name];
        const validation = await this.validateFieldValue(field.id, value);

        if (!validation.isValid && validation.error) {
          errors.push(validation.error);
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      logger.error('Error validating entity custom fields:', {
        entityType,
        error,
      });
      return {
        isValid: false,
        errors: ['Custom field validation error occurred'],
      };
    }
  }

  async checkUniqueConstraint(
    fieldId: string,
    value: any,
    entityId?: string
  ): Promise<boolean> {
    try {
      const field = await this.findById(fieldId);
      if (!field || !field.isUnique) {
        return true; // No uniqueness constraint
      }

      let tableName: string;
      switch (field.entityType) {
        case 'contact':
          tableName = 'contacts';
          break;
        case 'company':
          tableName = 'companies';
          break;
        case 'deal':
          tableName = 'deals';
          break;
        case 'opportunity':
          tableName = 'opportunities';
          break;
        case 'task':
          tableName = 'tasks';
          break;
        default:
          return true;
      }

      let query = `SELECT COUNT(*) FROM ${tableName} WHERE custom_fields->>'${field.name}' = $1`;
      const params = [value];

      if (entityId) {
        query += ' AND id != $2';
        params.push(entityId);
      }

      const result = await this.db.query(query, params);
      const count = parseInt(result.rows[0].count);

      return count === 0;
    } catch (error) {
      logger.error('Error checking unique constraint:', {
        fieldId,
        value,
        error,
      });
      return false;
    }
  }

  async reorderFields(
    entityType: CustomFieldEntity,
    fieldOrders: { id: string; order: number }[]
  ): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      for (const { id, order } of fieldOrders) {
        await client.query(
          'UPDATE custom_fields SET field_order = $1, updated_at = NOW() WHERE id = $2 AND entity_type = $3',
          [order, id, entityType]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error reordering custom fields:', { entityType, error });
      throw error;
    } finally {
      client.release();
    }
  }

  private mapFromDb(row: any): CustomField {
    return {
      id: row.id,
      name: row.name,
      label: row.label,
      type: row.type,
      entityType: row.entity_type,
      options: row.options || [],
      validation: row.validation || {},
      isRequired: row.is_required,
      isUnique: row.is_unique,
      isSearchable: row.is_searchable,
      defaultValue: row.default_value,
      helpText: row.help_text,
      order: row.field_order,
      isActive: row.is_active,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
