import { getAppVersion, getChannel } from "./native";
import type { BundleChannelInfo } from "./types";

/**
 * Gets bundle channel information.
 * Note: To switch channels, use updateBundle with the channel parameter.
 *
 * @param {string} channelName - The name of the channel (e.g., "production", "staging")
 *
 * @returns {BundleChannelInfo} Channel information
 *
 * @example
 * ```ts
 * const channel = HotUpdater.getBundleChannel('production');
 * console.log(`Channel: ${channel.name}, Version: ${channel.version}`);
 *
 * // To switch to a different channel, download a bundle with the new channel
 * await HotUpdater.updateBundle({
 *   bundleId: 'new-bundle-id',
 *   fileUrl: 'https://...',
 *   fileHash: '...',
 *   channel: 'staging',
 *   status: 'UPDATE',
 * });
 * ```
 */
export function getBundleChannel(
  channelName: string,
): BundleChannelInfo {
  const version = getAppVersion();

  return {
    name: channelName,
    version,
  };
}
