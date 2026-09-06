// This file acts as a central hub for all our data files.
// It imports from all the other files in this folder and re-exports them.
// This makes it much easier to import our data later!

export * from './idioms.js';
export * from './grammar.js';
export * from './typos.js';
export * from './meme.js';

// Combined datasets with part1/part2/part3 placeholders
export * from './ancient-modern.js';
export * from './theme.js';
export * from './material.js';
export * from './logic.js';

// Optional: articles for the reading area (already supported)
export * from './articles.js';
