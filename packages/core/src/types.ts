/**
 * Platform types supported by Hot Updater
 * iOS: Apple iOS mobile platform
 * Android: Google Android mobile platform
 */
export type Platform = "ios" | "android";

/**
 * Metadata associated with a bundle deployment
 * Can store additional information like the target app version
 */
export type BundleMetadata = {
  app_version?: string;
};

/**
 * Core data structure representing an over-the-air (OTA) update bundle
 * This is the main entity that gets deployed and distributed to mobile devices
 * Contains all necessary information for the client to verify and download updates
 */
export interface Bundle {
  /**
   * The unique identifier for the bundle. Uses UUIDv7 format for ordering by timestamp
   */
  id: string;
  /**
   * The platform the bundle is for (iOS or Android).
   * Allows the system to manage different bundles for different platforms
   */
  platform: Platform;
  /**
   * Whether the bundle should force an update on the client side
   * When true, the app will immediately replace its current bundle regardless of user preferences
   */
  shouldForceUpdate: boolean;
  /**
   * Whether the bundle is enabled and available for distribution
   * Disabled bundles will not be served to clients even if they match all other criteria
   */
  enabled: boolean;
  /**
   * The SHA-256 hash of the bundle file
   * Used for integrity verification: clients compute the hash of downloaded bundle
   * and compare it with this value to ensure the bundle wasn't corrupted or tampered with
   */
  fileHash: string;
  /**
   * The storage location URI of the bundle
   * Could be in AWS S3, Cloudflare R2, Firebase Storage, or any other supported provider
   * Format examples:
   * @example "s3://my-bucket/my-app/00000000-0000-0000-0000-000000000000/bundle.zip"
   * @example "r2://my-bucket/my-app/00000000-0000-0000-0000-000000000000/bundle.zip"
   * @example "firebase-storage://my-bucket/my-app/00000000-0000-0000-0000-000000000000/bundle.zip"
   * @example "storage://my-app/00000000-0000-0000-0000-000000000000/bundle.zip"
   */
  storageUri: string;
  /**
   * The git commit hash associated with this bundle
   * Useful for tracing back which exact code version was deployed
   * Null if the bundle was created outside a git repository
   */
  gitCommitHash: string | null;
  /**
   * User-provided message describing the bundle (e.g., "Fixed login bug", "Performance improvements")
   * Helps teams track what changes are in each deployment
   */
  message: string | null;
  /**
   * The deployment channel name
   * Allows organizing updates into different release tracks
   * Common examples:
   * - "production": Production channel for end users
   * - "development": Development channel for testing
   * - "staging": Staging channel for QA before production
   * - "app-name": Channel for specific app instances (e.g., "my-app", "app-test")
   */
  channel: string;
  /**
   * Target native app version for this bundle
   * Updates are only offered to apps with matching version
   * Uses semantic versioning (e.g., "1.0.0")
   * Null means the bundle is compatible with all versions
   */
  targetAppVersion: string | null;
  /**
   * The fingerprint hash of the native parts (iOS/Android native code and assets)
   * Used to detect if native code changes require the app to be rebuilt
   * Different from file hash: fingerprint identifies code changes that must be compiled
   */
  fingerprintHash: string | null;
  /**
   * Additional metadata associated with the bundle
   */
  metadata?: BundleMetadata;
}

type SnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? `${T extends Capitalize<T> ? "_" : ""}${Lowercase<T>}${SnakeCase<U>}`
  : S;

// Utility type to recursively map object keys to snake_case
type SnakeKeyObject<T> = T extends Record<string, any>
  ? {
      [K in keyof T as SnakeCase<Extract<K, string>>]: T[K] extends object
        ? SnakeKeyObject<T[K]>
        : T[K];
    }
  : T;

export type SnakeCaseBundle = SnakeKeyObject<Bundle>;

export type UpdateStatus = "ROLLBACK" | "UPDATE";

/**
 * Represents the update status and metadata for a specific device/app instance
 * This is what the database returns to clients when they check for updates
 * 
 * The database layer converts Bundle to UpdateInfo, filtering sensitive fields
 * and focusing on what the client needs to know
 */
export interface UpdateInfo {
  /**
   * Unique identifier for this update record
   */
  id: string;
  /**
   * Whether the app should immediately install this update without user consent
   */
  shouldForceUpdate: boolean;
  /**
   * User message explaining this update (shown in UI)
   */
  message: string | null;
  /**
   * The action status: UPDATE for new version, ROLLBACK to downgrade
   */
  status: UpdateStatus;
  /**
   * URL/URI where the client can download the bundle from
   */
  storageUri: string | null;
  /**
   * Hash for verifying bundle integrity after download
   */
  fileHash: string | null;
}

/**
 * The update info for the app layer.
 * This is the update info that is used by the app.
 */
export interface AppUpdateInfo extends Omit<UpdateInfo, "storageUri"> {
  fileUrl: string | null;
  /**
   * SHA256 hash of the bundle file, optionally with embedded signature.
   * Format when signed: "sig:<base64_signature>"
   * Format when unsigned: "<hex_hash>" (64-character lowercase hex)
   * The client parses this to extract signature for native verification.
   */
  fileHash: string | null;
}

export type UpdateStrategy = "fingerprint" | "appVersion";

export type FingerprintGetBundlesArgs = {
  _updateStrategy: "fingerprint";
  platform: Platform;
  /**
   * The current bundle id of the app.
   */
  bundleId: string;
  /**
   * Minimum bundle id that should be used.
   * This value is generated at build time via getMinBundleId().
   *
   * @default "00000000-0000-0000-0000-000000000000"
   */
  minBundleId?: string;
  /**
   * The name of the channel where the bundle is deployed.
   *
   * @default "production"
   *
   * Examples:
   * - production: Production channel for end users
   * - development: Development channel for testing
   * - staging: Staging channel for quality assurance before production
   * - app-name: Channel for specific app instances (e.g., my-app, app-test)
   */
  channel?: string;
  /**
   * The fingerprint hash of the bundle.
   */
  fingerprintHash: string;
};

export type AppVersionGetBundlesArgs = {
  _updateStrategy: "appVersion";
  platform: Platform;
  /**
   * The current bundle id of the app.
   */
  bundleId: string;
  /**
   * Minimum bundle id that should be used.
   * This value is generated at build time via getMinBundleId().
   *
   * @default "00000000-0000-0000-0000-000000000000"
   */
  minBundleId?: string;
  /**
   * The name of the channel where the bundle is deployed.
   *
   * @default "production"
   *
   * Examples:
   * - production: Production channel for end users
   * - development: Development channel for testing
   * - staging: Staging channel for quality assurance before production
   * - app-name: Channel for specific app instances (e.g., my-app, app-test)
   */
  channel?: string;
  /**
   * The current app version.
   */
  appVersion: string;
};

export type GetBundlesArgs =
  | FingerprintGetBundlesArgs
  | AppVersionGetBundlesArgs;

export type UpdateBundleParams = {
  platform: Platform;
  bundleId: string;
  minBundleId: string;
  channel: string;
  appVersion: string;
  fingerprintHash: string | null;
};
