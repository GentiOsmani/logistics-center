/**
 * Latency benchmark against a running server.
 *   node scripts/bench.js [baseUrl] [iterations]
 * Uses a keep-alive agent so the numbers reflect server work, not TCP setup.
 */
import { Agent, request } from 'node:http';
import process from 'node:process';

const base = process.argv[2] || 'http://localhost:3000';
const iterations = Number(process.argv[3] || 300);
const agent = new Agent({ keepAlive: true, maxSockets: 1 });

const PATHS = [
  ['home', '/sq'],
  ['catalogue', '/sq/products'],
  ['search (part no.)', '/sq/products?q=6ES7214'],
  ['search (text)', '/sq/products?q=kushineta'],
  ['category filter', '/sq/products?category=mekanike'],
  ['product detail', '/sq/products/6205-2rsh-deep-groove-ball-bearing-6205-2rsh-25-52-15'],
  ['services index', '/sq/services'],
  ['service detail', '/sq/services/plc-hmi-vfd'],
  ['brands', '/sq/brands'],
  ['support', '/sq/support'],
  ['suggest API', '/sq/api/suggest?q=6205'],
  ['stylesheet', '/assets/css/main.css'],
];

function hit(path) {
  return new Promise((resolve, reject) => {
    const started = process.hrtime.bigint();
    const req = request(`${base}${path}`, {
      agent,
      headers: { 'accept-encoding': 'br', connection: 'keep-alive' },
    }, (res) => {
      let bytes = 0;
      res.on('data', (chunk) => { bytes += chunk.length; });
      res.on('end', () => resolve({
        ms: Number(process.hrtime.bigint() - started) / 1e6,
        bytes,
        status: res.statusCode,
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

console.log(`\n  ${iterations} requests per route against ${base}\n`);
console.log('  route                 status   bytes(br)     avg      p50      p95      max');
console.log('  ' + '-'.repeat(76));

for (const [label, path] of PATHS) {
  await hit(path); // warm the prepared statements / compression path
  const samples = [];
  let last;
  for (let i = 0; i < iterations; i++) {
    last = await hit(path);
    samples.push(last.ms);
  }
  samples.sort((a, b) => a - b);
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  console.log(
    '  ' + label.padEnd(20)
    + String(last.status).padStart(6)
    + String(last.bytes).padStart(11)
    + avg.toFixed(2).padStart(9)
    + percentile(samples, 0.5).toFixed(2).padStart(9)
    + percentile(samples, 0.95).toFixed(2).padStart(9)
    + samples[samples.length - 1].toFixed(2).padStart(9),
  );
}

console.log();
agent.destroy();
