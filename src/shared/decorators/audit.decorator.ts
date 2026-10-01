import { SetMetadata } from '@nestjs/common';

export const AUDIT_METADATA_KEY = 'AUDIT_METADATA_KEY';

export interface AuditOptions {
  action?: string;
  entityName?: string;
  captureBody?: boolean;
  logFailures?: boolean;
  skip?: boolean;
}

export const Audit = (options: AuditOptions = {}) =>
  SetMetadata(AUDIT_METADATA_KEY, options);
