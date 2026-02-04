/**
 * Construct avatar URL for any user
 * Avatar is always stored as avatar.png in S3
 */
export function getAvatarUrl(userId: string): string {
  return `https://s3.tebi.io/besafe.backet/users/${userId}/avatar.png`;
}

/**
 * Get avatar URL with cache busting (use after upload)
 */
export function getAvatarUrlWithCacheBust(userId: string): string {
  return `${getAvatarUrl(userId)}?v=${Date.now()}`;
}
