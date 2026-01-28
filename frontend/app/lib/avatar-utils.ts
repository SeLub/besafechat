/**
 * Simple avatar utilities - URLs come from API responses
 */
export function getAvatarUrl(profile: { avatarUrl?: string }): string | undefined {
  return profile.avatarUrl;
}

export function getAvatarUrlWithCacheBust(profile: { avatarUrl?: string }): string | undefined {
  const url = profile.avatarUrl;
  return url ? `${url}?v=${Date.now()}` : undefined;
}
