import { PrivateKey } from "@bsv/sdk";

/**
 * Derives a donation address for a test suite using Type 42 key derivation.
 *
 * Strategy:
 * - Master WIF from environment variable
 * - Self-pubkey as counterparty (deterministic, no other party needed)
 * - Suite ID as invoice number (survives suite renames)
 *
 * This ensures the same master WIF always produces the same addresses.
 */
export function getDonationAddress(suiteId: string): string {
  const masterWif = process.env.MASTER_WIF;
  if (!masterWif) {
    throw new Error("MASTER_WIF environment variable is not set");
  }

  const masterKey = PrivateKey.fromWif(masterWif);
  const selfPubKey = masterKey.toPublicKey();

  // Type 42 derivation: counterparty = self, invoiceNumber = suiteId
  const derivedKey = masterKey.deriveChild(selfPubKey, suiteId);

  return derivedKey.toAddress().toString();
}

/**
 * Get the derived private key for a suite (for spending donations)
 * Only use server-side, never expose to client
 */
export function getDerivedPrivateKey(suiteId: string): PrivateKey {
  const masterWif = process.env.MASTER_WIF;
  if (!masterWif) {
    throw new Error("MASTER_WIF environment variable is not set");
  }

  const masterKey = PrivateKey.fromWif(masterWif);
  const selfPubKey = masterKey.toPublicKey();

  return masterKey.deriveChild(selfPubKey, suiteId);
}

/**
 * Get the master public key (for verification purposes)
 */
export function getMasterPublicKey(): string {
  const masterWif = process.env.MASTER_WIF;
  if (!masterWif) {
    throw new Error("MASTER_WIF environment variable is not set");
  }

  const masterKey = PrivateKey.fromWif(masterWif);
  return masterKey.toPublicKey().toString();
}

/**
 * Check if the master WIF is configured
 */
export function isMasterWifConfigured(): boolean {
  return !!process.env.MASTER_WIF;
}
