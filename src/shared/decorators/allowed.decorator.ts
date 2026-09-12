import { SetMetadata } from '@nestjs/common';

export const ALLOWED_ROLES = 'allowed_roles';
export const Allowed = (roles: string[]) => SetMetadata(ALLOWED_ROLES, roles);
