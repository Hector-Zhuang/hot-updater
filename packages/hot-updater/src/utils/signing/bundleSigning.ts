import crypto from "node:crypto";
import { loadPrivateKey } from "./keyGeneration";

/**
 * Sign a bundle's file hash using RSA-SHA256 cryptographic signature
 * 
 * This creates a cryptographic proof that the bundle was created by you and hasn't been
 * tampered with. The signature is later verified by the mobile app before installing.
 * 
 * Process:
 * 1. Load your private key from the keystore
 * 2. Convert the SHA-256 hash (hexadecimal string) to bytes
 * 3. Sign the hash using RSA-SHA256 algorithm
 * 4. Return the signature as base64 for easy transmission
 * 
 * @param fileHash SHA-256 hash of bundle content (hex string format)
 * @param privateKeyPath Path to the private key file (.pem format)
 * @returns Base64-encoded RSA-SHA256 signature
 * 
 * @example
 * const hash = "abc123..."; // SHA-256 hash of bundle.zip
 * const signature = await signBundle(hash, "./keys/private.pem");
 * // signature can now be sent with the bundle for client verification
 */
export async function signBundle(
  fileHash: string,
  privateKeyPath: string,
): Promise<string> {
  // Load the private key from the file system
  const privateKeyPEM = await loadPrivateKey(privateKeyPath);

  // Convert hex-encoded fileHash to binary buffer
  // SHA-256 hashes are typically hex strings, but crypto operations need bytes
  const fileHashBuffer = Buffer.from(fileHash, "hex");

  // Create a signer using RSA-SHA256 algorithm
  // This combines RSA encryption with SHA-256 hashing
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(fileHashBuffer);
  sign.end();

  // Generate the signature using the private key
  // The private key is kept secure and never shared with clients
  const signature = sign.sign(privateKeyPEM);

  // Convert signature bytes to base64 string for transmission
  // Base64 is easier to transport in JSON and other text formats
  return signature.toString("base64");
}

/**
 * Verify that a bundle signature is authentic and valid
 * 
 * The mobile app uses this verification process to ensure:
 * 1. The bundle was actually signed by you (using your private key)
 * 2. The bundle hasn't been modified or corrupted since signing
 * 
 * Process:
 * 1. Convert inputs from strings (hex and base64) to binary buffers
 * 2. Create a verifier using the same RSA-SHA256 algorithm as signing
 * 3. Check if the signature matches the hash using your public key
 * 4. Return true only if verification succeeds
 * 
 * @param fileHash SHA-256 hash of bundle content (hex string format)
 * @param signature Base64-encoded RSA-SHA256 signature to verify
 * @param publicKeyPEM Your public key in PEM format
 * @returns true if signature is valid and was created with the corresponding private key, false otherwise
 * 
 * @example
 * const isValid = verifySignature(hash, signature, publicKeyPEM);
 * if (isValid) {
 *   console.log("Bundle is authentic and untampered");
 * }
 */
export function verifySignature(
  fileHash: string,
  signature: string,
  publicKeyPEM: string,
): boolean {
  try {
    // Convert hex-encoded hash to binary buffer
    const fileHashBuffer = Buffer.from(fileHash, "hex");
    
    // Convert base64-encoded signature to binary buffer
    const signatureBuffer = Buffer.from(signature, "base64");

    // Create a verifier using the same algorithm as the signer
    const verify = crypto.createVerify("RSA-SHA256");
    verify.update(fileHashBuffer);
    verify.end();

    // Verify the signature using the public key
    // Only succeeds if the signature was created with the corresponding private key
    return verify.verify(publicKeyPEM, signatureBuffer);
  } catch {
    // Any error during verification means the signature is invalid
    // Could be caused by: wrong key, corrupted signature, wrong hash, etc.
    return false;
  }
}
