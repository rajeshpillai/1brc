import cluster from 'cluster';
import os from 'os';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import readline from 'readline';
import { performance } from 'perf_hooks';

const numCPUs = os.cpus().length;
const filePath = process.argv[2]; // Path to the large file

if (cluster.isPrimary) {
    console.log(`Master ${process.pid} is running`);

    // Start timing
    const startTime = performance.now();

    const divideWork = async () => {
        const { size } = await fs.stat(filePath);
        const chunkSize = Math.ceil(size / numCPUs);

        console.log(`Processing file of size ${size} with ${numCPUs} CPUs and chunk size ${chunkSize}`);
        for (let i = 0; i < numCPUs; i++) {
            const worker = cluster.fork();
            const start = i * chunkSize;
            const end = i === numCPUs - 1 ? size : (i + 1) * chunkSize - 1;
            //worker.send({ filePath, start, end });i
            
            worker.on('online', () => {
                worker.send({ filePath, start, end });
                console.log(`Sent range ${start}-${end} to worker ${worker.id}`);
            });
        }
    };

    divideWork();

    const finalAggr = {};
    let finishedWorkers = 0;

    cluster.on('message', (worker, message) => {
        console.log(`Received message from worker ${worker.process.pid}`);
        const { aggr } = message;

        for (const [key, value] of Object.entries(aggr)) {
            if (!finalAggr[key]) {
                finalAggr[key] = { ...value };
            } else {
                let station = finalAggr[key];
                station.min = Math.min(value.min, station.min);
                station.max = Math.max(value.max, station.max);
                station.sum += value.sum;
                station.count += value.count;
            }
        }

        if (++finishedWorkers === numCPUs) {
            // All workers are done, process the final aggregated results
            console.log(finalAggr);

            // End timing and log execution time
            const endTime = performance.now();
            console.log(`Total execution took ${(endTime - startTime).toFixed(2)} milliseconds.`);
        }
    });

    cluster.on('fork', (worker) => {
        console.log(`Worker ${worker.process.pid} forked`);
    });

  
    
    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} finished with code ${code} and signal ${signal}`);
    });
} else if (cluster.isWorker) {
    // Worker code
    console.log(`Worker ${process.pid} started`);
    process.on('message', async ({ filePath, start, end }) => {
        console.log(`Worker ${process.pid} started with range ${start}-${end}`);
        const stream = createReadStream(filePath, { start, end });
        const lineStream = readline.createInterface({
            input: stream,
            crlfDelay: Infinity
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

        // Send aggregated data back to the master
        process.send({ aggr });
    });
}
