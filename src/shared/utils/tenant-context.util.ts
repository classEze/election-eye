import { ForbiddenException } from '@nestjs/common';
import { User } from 'src/features/user/user.entity';
import { RoleCode } from 'src/features/role/role.enum';

/**
 * Checks whether the user is a platform-wide administrator (Super Admin or System Admin).
 * Campaign Directors (CLIENT_USER) belong to an aspirant's team and are not platform administrators.
 */
export function isPlatformAdmin(user?: User | null): boolean {
  if (!user?.role?.code) return false;
  return (
    user.role.code === RoleCode.SUPER_ADMIN ||
    user.role.code === RoleCode.SYSTEM_ADMIN
  );
}

/**
 * Retrieves the effective aspirant ID that the user is affiliated with.
 * - If the user is the Aspirant, returns their aspirantAccount.id.
 * - If the user is a campaign team member (Director, Coordinator, PU Agent), returns their aspirant.id.
 */
export function getEffectiveAspirantId(user?: User | null): number | undefined {
  if (!user) return undefined;
  return user.aspirantAccount?.id || user.aspirant?.id || undefined;
}

/**
 * Resolves the tenant aspirant ID for scoping database queries.
 * - For Platform Admins, allows viewing all data (undefined) or optionally filtering by requestedAspirantId.
 * - For campaign team members, strictly enforces the user's campaign aspirant ID.
 *   Throws ForbiddenException if the user does not belong to any campaign team or tries to access another team's data.
 */
export function resolveTenantAspirantId(
  user: User,
  requestedAspirantId?: number,
): number | undefined {
  if (isPlatformAdmin(user)) {
    return requestedAspirantId;
  }

  const teamAspirantId = getEffectiveAspirantId(user);
  if (!teamAspirantId) {
    throw new ForbiddenException(
      'Access denied: You are not assigned to any campaign team.',
    );
  }

  if (requestedAspirantId && requestedAspirantId !== teamAspirantId) {
    throw new ForbiddenException(
      'Access denied: You cannot view data belonging to another campaign team.',
    );
  }

  return teamAspirantId;
}
