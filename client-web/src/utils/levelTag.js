/**
 * The training-level tag on profiles (server: utils/trainingLevel.js). Shared
 * by the web and mobile clients. Pure JS only.
 */
export const LEVEL_TAGS = {
  beginner:     { label: 'Beginner',     color: '#0284c7', bg: 'rgba(14,165,233,0.14)' },
  intermediate: { label: 'Intermediate', color: '#d97706', bg: 'rgba(245,158,11,0.16)' },
  advanced:     { label: 'Advanced',     color: '#059669', bg: 'rgba(16,185,129,0.16)' },
};

/** What the tag means (shown on hover / tap). */
export const LEVEL_HINT = 'Training level from FFMI (adjusted for sex). It updates by itself as your weight and body fat change.';

/** For your own profile when there's no level yet. */
export const NO_LEVEL_HINT = 'Add your height, weight and body fat % to your profile to get your training level.';
