
// Sample data
/*
Hamburg;12.0
Bulawayo;8.9
Palembang;38.8
St. John's;15.2
*/

// Output
/*
The task is to write a Java program which reads the file, calculates the min, mean, and i
max temperature value per weather station, and emits the results on stdout like this 
(i.e. sorted alphabetically by station name, and the result values per station in the 
format <min>/<mean>/<max>, rounded to one fractional digit):

{Abha=-23.0/18.0/59.2, Abidjan=-16.2/26.0/67.3, Abéché=-10.0/29.4/69.0, Accra=-10.1/26.4/66.4,
*/


import * as readline from 'node:readline';
import * as fs from 'node:fs';

const fileName = process.argv[2];
const stream = fs.createReadStream(fileName);
const lineStream = readline.createInterface(stream);

const aggr = new Map();

console.log(`Filename: ${fileName}`);

/**
 * @example
 * round(1.2345) // "1.2"
 * round(1.55) // "1.6"
 * round(1) // "1.0"
 *
 * @param {number} num
 *
 * @returns {string}
 */

const startTime = performance.now();


function round(num) {
  const fixed = Math.round(10 * num) / 10;
  return fixed.toFixed(1);
}

for await (const line of lineStream) {
  const [stnName, temp] = line.split(';');

  // use integers for computation to avoid loosing precision
  const temperature = Math.floor(parseFloat(temp) * 10);
  
  //console.log(`Station name:  ${stnName}, Temp: ${temperature}`);

  let existing = aggr.get(stnName);
  if (existing) {
    existing.min = Math.min(temperature, existing.min);
    existing.max = Math.max(temperature, existing.max);
    existing.sum += temperature;
    existing.count += 1;
  } else {
    aggr.set(stnName, {
      min: temperature,
      max: temperature,
      sum: temperature,
      count: 1
    });
  }
  
}

// min mean max
//{Abha=-23.0/18.0/59.2, Abidjan=-16.2/26.0/67.3, Abéché=-10.0/29.4/69.0, Accra=-10.1/26.4/66.4,

const sortedAggr  = Array.from(aggr).sort((a, b) =>{
  return a[0].localeCompare(b[0]);
});

let data;
let output = `{`;
for(let i = 0; i < sortedAggr.length; i++) {
  data = sortedAggr[i];
  output += `${data[0]}=${round(data[1].min/10)}/${round(data[1].sum/10/data[1].count)}/${round(data[1].max/10)}, `;
  
}
output += "}";

console.log(output);
console.log("Keys: ", sortedAggr.length);

const endTime = performance.now();
console.log(`Function execution took ${endTime - startTime} milliseconds.`);



