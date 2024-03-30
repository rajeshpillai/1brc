// A better version of cluster
// master.js

import cluster from 'cluster';
import os from 'os';
import fs from 'fs/promises';
import { basename } from 'path';
import readline from 'readline';

const numCPUs = os.cpus().length;
const filePath = process.argv[2]; // Path to the large file

async function divideWork() {
    const { size } = await fs.stat(filePath);
    const chunkSize = Math.ceil(size / numCPUs);

    for (let i = 0; i < numCPUs; i++) {
        const worker = cluster.fork();
        const start = i * chunkSize;
        const end = i === numCPUs - 1 ? size : (i + 1) * chunkSize - 1;
        worker.send({ filePath, start, end });
    }
}

if (cluster.isPrimary) {
    console.log(`Master ${process.pid} is running`);
    divideWork();

    cluster.on('exit', (worker) => {
        console.log(`Worker ${worker.process.pid} finished`);
    });
} else {
  // worker.js
    process.on('message', async (message) => {
        const { filePath, start, end } = message;
        const stream = fs.createReadStream(filePath, { start, end });
        const lineStream = readline.createInterface({
            input: stream,
            crlfDelay: Infinity,
        });

        const aggr = {};

        for await (const line of lineStream) {
            const [stnName, temp] = line.split(';');
            const temperature = parseFloat(temp);
            if (!aggr[stnName]) {
                aggr[stnName] = { min: temperature, max: temperature, sum: temperature, count: 1 };
            } else {
                aggr[stnName].min = Math.min(temperature, aggr[stnName].min);
                aggr[stnName].max = Math.max(temperature, aggr[stnName].max);
                aggr[stnName].sum += temperature;
                aggr[stnName].count++;
            }
        }

        // Each worker can either send results back to the master or write to a part of the output file
        process.exit();
    });
} 



