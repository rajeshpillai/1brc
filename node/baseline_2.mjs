// Import required modules

import * as readline from 'node:readline';
import * as fs from 'node:fs';

import { performance } from 'node:perf_hooks';

// Assuming the filename is passed as the second command line argument
const fileName = process.argv[2];

// Create a read stream from the file
const stream = fs.createReadStream(fileName);

// Use readline to handle the stream line by line
const lineStream = readline.createInterface({
  input: stream,
  crlfDelay: Infinity // Handle all CR/LF line breaks
});

// Initialize a Map to aggregate data
const aggr = new Map();

console.log(`Filename: ${fileName}`);

// Start timing
const startTime = performance.now();

(async () => {
  for await (const line of lineStream) {
    const [stnName, temp] = line.split(';');
    const temperature = parseFloat(temp);

    // Check if the station already exists in the map
    if (aggr.has(stnName)) {
      const existing = aggr.get(stnName);
      existing.min = Math.min(temperature, existing.min);
      existing.max = Math.max(temperature, existing.max);
      existing.sum += temperature;
      existing.count++;
    } else {
      aggr.set(stnName, {
        min: temperature,
        max: temperature,
        sum: temperature,
        count: 1
      });
    }
  }

  // Convert Map to Array, sort it, and then convert it back to a Map
  const sortedAggr = new Map([...aggr.entries()].sort((a, b) => a[0].localeCompare(b[0])));

  // Constructing output
  let output = "{";
  for (const [key, value] of sortedAggr) {
    const mean = value.sum / value.count;
    output += `${key}=${value.min.toFixed(1)}/${mean.toFixed(1)}/${value.max.toFixed(1)}, `;
  }
  output = output.slice(0, -2) + "}";

  // Log the output
  console.log(output);

  // End timing and log execution time
  const endTime = performance.now();
  console.log(`Function execution took ${(endTime - startTime).toFixed(2)} milliseconds.`);
})();

