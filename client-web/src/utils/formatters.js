/**
 * Re-exports every formatter from shared/formatters.js so web components
 * can import from a local path without reaching up multiple directories.
 *
 * Usage: import { formatDuration, relativeTime } from '../utils/formatters';
 */
export {
  formatDuration,
  formatWeight,
  kgToLbs,
  lbsToKg,
  sumMacro,
  macroProgress,
  relativeTime,
  toDateParam,
  getGreeting,
  estimateOneRM,
  capitalise,
  toTitleCase,
  truncate,
  getInitials,
} from '../../../shared/formatters';