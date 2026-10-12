import { ForbiddenException } from '@nestjs/common';
import { RoleCode } from '../../features/role/role.enum';
import { User } from '../../features/user/user.entity';
import {
  isPlatformAdmin,
  getEffectiveAspirantId,
  resolveTenantAspirantId,
} from './tenant-context.util';

describe('TenantContextUtil', () => {
  describe('isPlatformAdmin', () => {
    it('returns true for SUPER_ADMIN', () => {
      const user = { role: { code: RoleCode.SUPER_ADMIN } } as User;
      expect(isPlatformAdmin(user)).toBe(true);
    });

    it('returns true for SYSTEM_ADMIN', () => {
      const user = { role: { code: RoleCode.SYSTEM_ADMIN } } as User;
      expect(isPlatformAdmin(user)).toBe(true);
    });

    it('returns false for CLIENT_USER (Campaign Director)', () => {
      const user = { role: { code: RoleCode.CLIENT_USER } } as User;
      expect(isPlatformAdmin(user)).toBe(false);
    });

    it('returns false for ASPIRANT', () => {
      const user = { role: { code: RoleCode.ASPIRANT } } as User;
      expect(isPlatformAdmin(user)).toBe(false);
    });

    it('returns false for PU_AGENT', () => {
      const user = { role: { code: RoleCode.PU_AGENT } } as User;
      expect(isPlatformAdmin(user)).toBe(false);
    });
  });

  describe('getEffectiveAspirantId', () => {
    it('resolves aspirantAccount id when present', () => {
      const user = { aspirantAccount: { id: 42 } } as User;
      expect(getEffectiveAspirantId(user)).toBe(42);
    });

    it('resolves aspirant id when present', () => {
      const user = { aspirant: { id: 7 } } as User;
      expect(getEffectiveAspirantId(user)).toBe(7);
    });

    it('returns undefined if no campaign is linked', () => {
      const user = {} as User;
      expect(getEffectiveAspirantId(user)).toBeUndefined();
    });
  });

  describe('resolveTenantAspirantId', () => {
    it('allows platform admin to filter by requested aspirantId', () => {
      const admin = { role: { code: RoleCode.SUPER_ADMIN } } as User;
      expect(resolveTenantAspirantId(admin, 99)).toBe(99);
      expect(resolveTenantAspirantId(admin, undefined)).toBeUndefined();
    });

    it('scopes non-admin user to their effective aspirant id', () => {
      const agent = {
        role: { code: RoleCode.PU_AGENT },
        aspirant: { id: 5 },
      } as User;
      expect(resolveTenantAspirantId(agent)).toBe(5);
      expect(resolveTenantAspirantId(agent, 5)).toBe(5);
    });

    it('throws ForbiddenException if non-admin attempts cross-tenant query', () => {
      const director = {
        role: { code: RoleCode.CLIENT_USER },
        aspirantAccount: { id: 10 },
      } as User;
      expect(() => resolveTenantAspirantId(director, 99)).toThrow(
        ForbiddenException,
      );
    });
  });
});
