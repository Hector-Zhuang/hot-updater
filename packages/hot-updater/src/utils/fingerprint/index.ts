import { createFingerprintAsync } from "@expo/fingerprint";
import { getCwd } from "@hot-updater/cli-tools";
import type { Platform } from "@hot-updater/plugin-core";
import fs from "fs";
import path from "path";
import { setFingerprintHash } from "../setFingerprintHash";
import {
  ensureFingerprintConfig,
  type FingerprintOptions,
  type FingerprintResult,
  getOtaFingerprintOptions,
} from "./common";

export * from "./common";
export * from "./diff";

/**
 * Calculates the fingerprint of the native parts of the project
 * 
 * Fingerprints are used to detect when native code or configuration changes require
 * a new native build (Android/iOS recompilation) rather than just a bundle update.
 * This prevents issues where the native code version no longer matches the bundle.
 * 
 * The fingerprint is based on:
 * - Source code files (Java, Kotlin, Swift, Objective-C)
 * - Native dependencies and their versions
 * - Build configuration files
 * - Pod/Gradle configuration
 * - Native code generation results
 * 
 * @param path - Project root directory
 * @param options - Configuration for fingerprint generation (platform, excludes, etc.)
 * @returns FingerprintResult containing hash and metadata
 */
export async function nativeFingerprint(
  path: string,
  options: FingerprintOptions,
): Promise<FingerprintResult> {
  const platform = options.platform;
  return createFingerprintAsync(
    path,
    getOtaFingerprintOptions(platform, path, options),
  );
}

/**
 * Generate fingerprints for both iOS and Android platforms in parallel
 * 
 * This is called during the initial fingerprint creation to capture the current
 * state of both native projects. Later comparisons detect what has changed.
 * 
 * @returns Object with both ios and android fingerprint results
 */
export const generateFingerprints = async () => {
  const fingerprintConfig = await ensureFingerprintConfig();

  const projectPath = getCwd();
  // Generate both fingerprints in parallel for better performance
  const [ios, android] = await Promise.all([
    nativeFingerprint(projectPath, {
      platform: "ios",
      ...fingerprintConfig,
    }),
    nativeFingerprint(projectPath, {
      platform: "android",
      ...fingerprintConfig,
    }),
  ]);
  return { ios, android };
};

/**
 * Generate fingerprint for a specific platform
 * 
 * Used when only one platform needs to be fingerprinted (e.g., during targeted deployment)
 * 
 * @param platform - "ios" or "android"
 * @returns Fingerprint result for the specified platform
 */
export const generateFingerprint = async (platform: "ios" | "android") => {
  const fingerprintConfig = await ensureFingerprintConfig();

  return nativeFingerprint(getCwd(), {
    platform,
    ...fingerprintConfig,
  });
};

/**
 * Create fingerprint files and inject the hashes into native build files
 * 
 * This is the main entry point for the fingerprint workflow:
 * 1. Read existing fingerprint.json if it exists (preserve previous values)
 * 2. Generate new fingerprints for the requested platform(s)
 * 3. Write fingerprint.json with the updated values
 * 4. Inject the hash into native build files:
 *    - Android: BuildConfig.java
 *    - iOS: Info.plist
 * 5. Track which files were modified for git commits
 * 
 * The injection step ensures the native app can verify its fingerprint hash,
 * allowing it to detect when an update requires a native rebuild.
 * 
 * @param options - { platform?: "ios" | "android" }
 *   If no platform specified, both are regenerated
 *   If platform specified, only that platform is regenerated while preserving the other
 * @returns Object with fingerprint results and list of modified files
 */
export const createAndInjectFingerprintFiles = async ({
  platform,
}: {
  platform?: Platform;
} = {}) => {
  // Load existing fingerprint.json if available
  const localFingerprint = await readLocalFingerprint();
  // Generate new fingerprints for the project
  const newFingerprint = await generateFingerprints();

  const androidPaths: string[] = [];
  const iosPaths: string[] = [];
  
  // If no local fingerprint exists or no specific platform requested,
  // replace the entire fingerprint.json with newly generated values
  if (!localFingerprint || !platform) {
    await createFingerprintJSON(newFingerprint);
    // Inject the new hashes into Android build files
    const { paths: _androidPaths } = await setFingerprintHash(
      "android",
      newFingerprint.android.hash,
    );
    androidPaths.push(..._androidPaths);

    // Inject the new hashes into iOS build files
    const { paths: _iosPaths } = await setFingerprintHash(
      "ios",
      newFingerprint.ios.hash,
    );
    iosPaths.push(..._iosPaths);
  } else {
    // A specific platform was requested AND local fingerprint exists
    // Strategy: preserve the other platform's existing fingerprint value
    // This prevents overwriting a platform that wasn't updated in this build
    const nextFingerprints = {
      android: localFingerprint.android || newFingerprint.android,
      ios: localFingerprint.ios || newFingerprint.ios,
      [platform]: newFingerprint[platform], // Overwrite only the requested platform
    } satisfies Record<Platform, FingerprintResult>;

    await createFingerprintJSON(nextFingerprints);
    // Inject hash only for the platform that was regenerated
    const { paths: _platformPaths } = await setFingerprintHash(
      platform,
      newFingerprint[platform].hash,
    );
    switch (platform) {
      case "android":
        androidPaths.push(..._platformPaths);
        break;
      case "ios":
        iosPaths.push(..._platformPaths);
        break;
    }
  }

  return {
    fingerprint: newFingerprint,
    androidPaths,
    iosPaths,
  };
};

/**
 * Write fingerprint data to fingerprint.json in project root
 * 
 * Format:
 * {
 *   "ios": { "hash": "...", "mtime": ... },
 *   "android": { "hash": "...", "mtime": ... }
 * }
 * 
 * This file should be committed to git so that changes to native code are tracked
 * 
 * @param fingerprint - Object with ios and android fingerprint data
 * @returns The fingerprint object that was written
 */
export const createFingerprintJSON = async (fingerprint: {
  ios: FingerprintResult;
  android: FingerprintResult;
}) => {
  const FINGERPRINT_FILE_PATH = path.join(getCwd(), "fingerprint.json");
  await fs.promises.writeFile(
    FINGERPRINT_FILE_PATH,
    JSON.stringify(fingerprint, null, 2),
  );
  return fingerprint;
};

/**
 * Read fingerprint.json from project root
 * 
 * Used to load existing fingerprint data for comparison or updates
 * Gracefully handles missing file by returning null
 * 
 * @returns Object with ios/android fingerprint data, or null if file doesn't exist
 */
export const readLocalFingerprint = async (): Promise<{
  ios: FingerprintResult | null;
  android: FingerprintResult | null;
} | null> => {
  const FINGERPRINT_FILE_PATH = path.join(getCwd(), "fingerprint.json");
  try {
    const content = await fs.promises.readFile(FINGERPRINT_FILE_PATH, "utf-8");
    return JSON.parse(content);
  } catch {
    // File doesn't exist or is not valid JSON
    return null;
  }
};
