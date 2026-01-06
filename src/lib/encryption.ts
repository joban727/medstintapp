/**
 * AES-256-GCM Encryption Utilities
 * Provides secure encryption/decryption for sensitive data like location coordinates
 */
import crypto from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16 // 128 bits
const AUTH_TAG_LENGTH = 16 // 128 bits
const KEY_LENGTH = 32 // 256 bits

// Cache the key to avoid repeated derivation
let cachedKey: Buffer | null = null

/**
 * Validate and get encryption key from environment
 * Throws error if not configured in production
 */
function getEncryptionKey(): Buffer {
  // Return cached key if available
  if (cachedKey) {
    return cachedKey
  }

  const keyHex = process.env.LOCATION_ENCRYPTION_KEY

  if (!keyHex) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "LOCATION_ENCRYPTION_KEY is required in production. " +
          "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
      )
    }
    // In development, warn but use a dev-only key
    console.warn(
      "[SECURITY] LOCATION_ENCRYPTION_KEY not set. Using development-only key. " +
        "DO NOT use in production!"
    )
    // Return a deterministic dev key (not random so data persists between restarts)
    cachedKey = crypto.scryptSync(
      "dev-only-key-do-not-use-in-production",
      "medstint-salt",
      KEY_LENGTH
    )
    return cachedKey
  }

  // Validate key length (should be 64 hex chars = 32 bytes)
  if (keyHex.length !== 64) {
    throw new Error(
      `LOCATION_ENCRYPTION_KEY must be 64 hex characters (256 bits), got ${keyHex.length}. ` +
        "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    )
  }

  cachedKey = Buffer.from(keyHex, "hex")
  return cachedKey
}

/**
 * Clear cached key (useful for testing)
 */
export function clearKeyCache(): void {
  cachedKey = null
}

export interface EncryptedData {
  /** Base64-encoded encrypted data */
  ciphertext: string
  /** Base64-encoded initialization vector */
  iv: string
  /** Base64-encoded authentication tag */
  authTag: string
  /** Encryption version for future migration support */
  version: number
}

/**
 * Encrypt sensitive string data using AES-256-GCM
 * @param plaintext The string to encrypt
 * @returns EncryptedData object containing ciphertext and decryption parameters
 */
export function encrypt(plaintext: string): EncryptedData {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, "utf8", "base64")
  encrypted += cipher.final("base64")

  const authTag = cipher.getAuthTag()

  return {
    ciphertext: encrypted,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    version: 1,
  }
}

/**
 * Decrypt encrypted data using AES-256-GCM
 * @param encryptedData The encrypted data object
 * @returns Decrypted plaintext string
 */
export function decrypt(encryptedData: EncryptedData): string {
  const key = getEncryptionKey()
  const iv = Buffer.from(encryptedData.iv, "base64")
  const authTag = Buffer.from(encryptedData.authTag, "base64")

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encryptedData.ciphertext, "base64", "utf8")
  decrypted += decipher.final("utf8")

  return decrypted
}

/**
 * Encrypt location coordinates
 * Combines latitude and longitude into JSON and encrypts
 * @param latitude GPS latitude
 * @param longitude GPS longitude
 * @returns EncryptedData containing encrypted coordinates
 */
export function encryptLocation(latitude: number, longitude: number): EncryptedData {
  const locationJson = JSON.stringify({ latitude, longitude })
  return encrypt(locationJson)
}

/**
 * Decrypt location coordinates
 * @param encryptedData The encrypted location data
 * @returns Object with latitude and longitude
 */
export function decryptLocation(encryptedData: EncryptedData): {
  latitude: number
  longitude: number
} {
  const locationJson = decrypt(encryptedData)
  return JSON.parse(locationJson)
}

/**
 * Serialize encrypted data to a single string for storage
 * Format: version:iv:authTag:ciphertext (all base64)
 */
export function serializeEncryptedData(data: EncryptedData): string {
  return `${data.version}:${data.iv}:${data.authTag}:${data.ciphertext}`
}

/**
 * Deserialize encrypted data from storage string
 */
export function deserializeEncryptedData(serialized: string): EncryptedData {
  const parts = serialized.split(":")
  if (parts.length !== 4) {
    throw new Error("Invalid encrypted data format")
  }

  return {
    version: parseInt(parts[0], 10),
    iv: parts[1],
    authTag: parts[2],
    ciphertext: parts[3],
  }
}

/**
 * Check if encryption is properly configured for production
 * @returns true if encryption key is set and valid
 */
export function isEncryptionConfigured(): boolean {
  const keyHex = process.env.LOCATION_ENCRYPTION_KEY
  return !!keyHex && keyHex.length === 64
}

/**
 * Check if a value appears to be encrypted (starts with version prefix)
 */
export function isEncrypted(value: string): boolean {
  // Encrypted values start with version number followed by colon
  return /^\d+:/.test(value)
}

/**
 * Encrypt location for storage, returning a compact string
 */
export function encryptLocationForStorage(latitude: number, longitude: number): string {
  const encrypted = encryptLocation(latitude, longitude)
  return serializeEncryptedData(encrypted)
}

/**
 * Decrypt location from storage string
 */
export function decryptLocationFromStorage(stored: string): {
  latitude: number
  longitude: number
} {
  // Check if data is actually encrypted
  if (!isEncrypted(stored)) {
    // Legacy unencrypted data - attempt to parse as coordinate
    const num = parseFloat(stored)
    if (!isNaN(num)) {
      // This is a raw coordinate, cannot determine if lat or long
      throw new Error("Cannot decrypt unencrypted legacy data - migration required")
    }
    throw new Error("Invalid location data format")
  }

  const encrypted = deserializeEncryptedData(stored)
  return decryptLocation(encrypted)
}
