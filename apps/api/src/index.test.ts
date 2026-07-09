import { describe, it, expect } from 'vitest';
import { chunkRows, normalizeRecord, validateRecord } from './utils/helpers';
import { GrowEasyRecord } from '@groweasy/types';

describe('AI CSV Importer Helpers', () => {
  describe('chunkRows', () => {
    it('should split rows into specified batch sizes', () => {
      const rows = Array.from({ length: 55 }, (_, i) => ({ id: i }));
      const batches = chunkRows(rows, 25);
      
      expect(batches.length).toBe(3);
      expect(batches[0].length).toBe(25);
      expect(batches[1].length).toBe(25);
      expect(batches[2].length).toBe(5);
      expect(batches[0][0].id).toBe(0);
      expect(batches[2][4].id).toBe(54);
    });

    it('should handle empty arrays gracefully', () => {
      const batches = chunkRows([], 10);
      expect(batches.length).toBe(0);
    });
  });

  describe('normalizeRecord', () => {
    it('should map empty strings and undefined values to null', () => {
      const raw = {
        name: 'John Doe',
        email: '',
        company: undefined,
        city: 'Seattle',
      };
      
      const normalized = normalizeRecord(raw);
      expect(normalized.name).toBe('John Doe');
      expect(normalized.email).toBeNull();
      expect(normalized.company).toBeNull();
      expect(normalized.city).toBe('Seattle');
    });
  });

  describe('validateRecord', () => {
    it('should parse and return valid CRM records', () => {
      const record = {
        created_at: '2026-07-08',
        name: 'John Doe',
        email: 'john@example.com',
        country_code: '+91',
        mobile_without_country_code: '9876543210',
        company: 'GrowEasy',
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
        lead_owner: 'Manager Admin',
        crm_status: 'GOOD_LEAD_FOLLOW_UP',
        crm_note: 'Warm lead',
        data_source: 'leads_on_demand',
        possession_time: 'Immediate',
        description: 'Interested client',
        _skip_reason: null,
      };

      const result = validateRecord(record);
      expect(result._skip_reason).toBeNull();
      expect(result.crm_status).toBe('GOOD_LEAD_FOLLOW_UP');
      expect(result.data_source).toBe('leads_on_demand');
      expect(result.name).toBe('John Doe');
    });

    it('should apply fallback parsing and mark _skip_reason on schema mismatches', () => {
      const invalidRecord = {
        name: 'John Doe',
        email: 'invalid-email', // Mismatch email format (actually Zod schema is just string.nullable() but we test other schema fields or mock invalid values if they trigger errors)
        crm_status: 'INVALID_STATUS', // Mismatch enum
        data_source: 'unknown_source', // Mismatch enum
      };

      const result = validateRecord(invalidRecord);
      expect(result._skip_reason).toContain('Schema validation failed');
      expect(result.crm_status).toBeNull(); // Mapped to null because it failed validation
      expect(result.data_source).toBeNull(); // Mapped to null because it failed validation
      expect(result.name).toBe('John Doe');
    });

    it('should normalize invalid crm_status (like "Unspecified") to null after Zod validation', () => {
      const mockRecordWithInvalidStatus = {
        created_at: '2026-07-08',
        name: 'Jane Doe',
        email: 'jane@example.com',
        crm_status: 'Unspecified', // Invalid enum value
        data_source: 'meridian_tower',
      };

      const result = validateRecord(mockRecordWithInvalidStatus);
      expect(result.crm_status).toBeNull();
      expect(result._skip_reason).toContain('Schema validation failed');
    });

    it('should normalize invalid created_at dates to null after Zod validation', () => {
      const mockRecordWithInvalidDate = {
        created_at: 'not-a-date', // Invalid date format
        name: 'Jane Doe',
        email: 'jane@example.com',
        crm_status: 'GOOD_LEAD_FOLLOW_UP',
        data_source: 'meridian_tower',
      };

      const result = validateRecord(mockRecordWithInvalidDate);
      expect(result.created_at).toBeNull();
      expect(result._skip_reason).toContain('Schema validation failed');
    });
  });
});
