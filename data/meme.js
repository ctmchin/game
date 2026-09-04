// This file now imports the three parts and combines them into one.
// The file paths have been corrected to match your actual filenames.

// 1. Import the three split arrays using the correct names.
import { memeData_part1 } from './meme-part1.js';
import { memeData_part2 } from './meme-part2.js';
import { memeData_part3 } from './meme-part3.js';

// 2. Combine them into a single array using the "spread" (...) operator.
const combinedMemeData = [
    ...memeData_part1,
    ...memeData_part2,
    ...memeData_part3,
];

// 3. Export the final, combined array under the original name.
export const memeData = combinedMemeData;
