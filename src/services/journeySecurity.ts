/**
 * Generates a cryptographically secure random bearer token with at least 128 bits of entropy.
 */
export function generateSecureBearerToken(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16); // 16 bytes = 128 bits of cryptographic entropy
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback to crypto.randomUUID (also 128-bit UUID v4)
  return crypto.randomUUID().replace(/-/g, '');
}

/**
 * Computes the SHA-256 hexadecimal hash of a string using Web Crypto API.
 */
export async function sha256Hex(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
