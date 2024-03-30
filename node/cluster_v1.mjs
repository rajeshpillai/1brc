// This is just for quick demo of cluster
// All the nodes process the complete file (rather than working on parts of the file)
import * as readline from 'node:readline';
import * as fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import  cluster from 'cluster';
import  os from 'os';

const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
    console.log(`Master ${process.pid} is running`);

    // Fork workers.
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} died`);
    });

    // Assuming the filename is passed as the second command line argument
    const fileName = process.argv[2];
    console.log(`Filename: ${fileName}`);

    // Start timing
    const startTime = performance.now();

    // Listen for workers to send back the processed data
    const aggr = new Map();
    let activeWorkers = numCPUs;
    for (const id in cluster.workers) {
        cluster.workers[id].on('message', message => {
            // Merge results from worker
            for (const [key, value] of Object.entries(message)) {
                if (aggr.has(key)) {
                    let existing = aggr.get(key);
                    existing.min = Math.min(value.min, existing.min);
                    existing.max = Math.max(value.max, existing.max);
                    existing.sum += value.sum;
                    existing.count += value.count;
                } else {
                    aggr.set(key, value);
                }
            }

            if (--activeWorkers === 0) {
                // All workers are done, process the final aggregated results
                const sortedAggr = new Map([...aggr.entries()].sort((a, b) => a[0].localeCompare(b[0])));
                let output = "{";
                for (const [key, value] of sortedAggr) {
                    const mean = value.sum / value.count;
                    output += `${key}=${value.min.toFixed(1)}/${mean.toFixed(1)}/${value.max.toFixed(1)}, `;
                }
                output = output.slice(0, -2) + "}";
                console.log(output);

                // End timing and log execution time
                const endTime = performance.now();
                console.log(`Function execution took ${(endTime - startTime).toFixed(2)} milliseconds.`);
            }
        });
    }

} else {
    // Workers can share any TCP connection
    // In this case, it is an HTTP server
    console.log(`Worker ${process.pid} started`);

    // Worker processes have a separate portion of the file to process
    // This example assumes the data is evenly distributed, which may not be the case
    // A more robust solution would involve partitioning the file outside of this script

    // For simplicity, every worker processes the whole file, but in practice, you would divide the workload

    const fileName = process.argv[2];
    const stream = fs.createReadStream(fileName);
    const lineStream = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });

    const localAggr = {};

    (async () => {
        for await (const line of lineStream) {
            const [stnName, temp] = line.split(';');
            const temperature = parseFloat(temp);
            if (!localAggr[stnName]) {
                localAggr[stnName] = { min: temperature, max: temperature, sum: temperature, count: 1 };
            } else {
                localAggr[stnName].min = Math.min(temperature, localAggr[stnName].min);
                localAggr[stnName].max = Math.max(temperature, localAggr[stnName].max);
                localAggr[stnName].sum += temperature;
                localAggr[stnName].count++;
            }
        }
        // Send data back to master process
        process.send(localAggr);
    })();
}
