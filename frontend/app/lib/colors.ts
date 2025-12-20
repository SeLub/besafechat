// Generate deterministic accent color from public key
export function getUserAccentColor(publicKey: string): string {
  if (!publicKey) return 'rgb(150, 150, 150)'; // Default gray

  // Use first 3 bytes of base64 string as RGB seed
  const bytes = publicKey.split('').map(c => c.charCodeAt(0));

  // Extract RGB values and adjust for good contrast (100-255 range)
  const r = 100 + (bytes[0] % 156);
  const g = 100 + (bytes[1] % 156);
  const b = 100 + (bytes[2] % 156);

  return `rgb(${r}, ${g}, ${b})`;
}
