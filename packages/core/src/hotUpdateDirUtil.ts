import path from "path";

/**
 * Directory name where Hot Updater stores local build and log files
 * This is added to .gitignore to avoid committing generated files
 */
const HOT_UPDATE_DIR_NAME = ".hot-updater";

/**
 * Subdirectory for compiled bundle output files
 * Contains the actual bundle artifacts ready for deployment
 */
const HOT_UPDATE_OUTPUT_DIR_NAME = "output";

/**
 * Subdirectory for storing operation logs
 * Helps with debugging and auditing the build and deploy process
 */
const HOT_UPDATE_LOG_DIR_NAME = "log";

/**
 * Utility object for managing Hot Updater directory structure
 * Provides consistent paths for output files and logs across the project
 * 
 * Directory structure:
 * .hot-updater/
 *   ├── output/     (compiled bundles)
 *   └── log/        (operation logs)
 */
export const HotUpdateDirUtil = {
  dirName: HOT_UPDATE_DIR_NAME,
  outputDirName: HOT_UPDATE_OUTPUT_DIR_NAME,
  logDirName: HOT_UPDATE_LOG_DIR_NAME,
  outputGitignorePath: `${HOT_UPDATE_DIR_NAME}/${HOT_UPDATE_OUTPUT_DIR_NAME}`,
  logGitignorePath: `${HOT_UPDATE_DIR_NAME}/${HOT_UPDATE_LOG_DIR_NAME}`,
  /**
   * Get the full path to the Hot Updater working directory
   */
  getDirPath: ({ cwd }: { cwd: string }) => {
    return path.join(cwd, HOT_UPDATE_DIR_NAME);
  },
  /**
   * Get the full path to the output directory where bundles are stored
   */
  getDefaultOutputPath: ({ cwd }: { cwd: string }) => {
    return path.join(cwd, HOT_UPDATE_DIR_NAME, HOT_UPDATE_OUTPUT_DIR_NAME);
  },
  /**
   * Get the full path to the log directory
   */
  getLogDirPath: ({ cwd }: { cwd: string }) => {
    return path.join(cwd, HOT_UPDATE_DIR_NAME, HOT_UPDATE_LOG_DIR_NAME);
  },
} as const;
