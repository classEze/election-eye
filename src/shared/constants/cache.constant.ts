export enum CacheKeyPrefix {
  USER_INFO_CLI = 'USER_INFO_CLI_',
  USER_INFO_ADM = 'USER_INFO_ADM_',
}

export enum CacheTTL {
  ONE_MINUTE = 60 * 1000,
  TEN_MINUTES = 10 * 60 * 1000,
  ONE_HOUR = 60 * 60 * 1000,
  ONE_DAY = 24 * 60 * 60 * 1000,
}

export enum AccountType {
  CLIENT = 'client',
  ADMIN = 'admin',
}

/**
 * Generates the cache key for client user info
 */
export const getUserInfoCacheKey = (userId: number | string): string => {
  return `${CacheKeyPrefix.USER_INFO_CLI}${userId}`;
};

/**
 * Generates the cache key for admin user info
 */
export const getAdminInfoCacheKey = (adminId: number | string): string => {
  return `${CacheKeyPrefix.USER_INFO_ADM}${adminId}`;
};

/**
 * Resolves the appropriate cache key based on account type and ID
 */
export const getAuthCacheKey = (
  accountType: string | undefined,
  id: number | string,
): string => {
  if (accountType === AccountType.ADMIN) {
    return getAdminInfoCacheKey(id);
  }
  return getUserInfoCacheKey(id);
};
