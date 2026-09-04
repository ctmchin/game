// This file now imports the three parts and combines them into one.

// 1. Import the three split arrays.
import { memeData_part1 } from './memes-part1.js';
import { memeData_part2 } from './memes-part2.js';
import { memeData_part3 } from './memes-part3.js';

// 2. Combine them into a single array using the "spread" (...) operator.
// This is the modern way to merge arrays.
const combinedMemeData = [
    ...memeData_part1,
    ...memeData_part2,
    ...memeData_part3,
];

// 3. Export the final, combined array under the original name.
export const memeData = combinedMemeData;
