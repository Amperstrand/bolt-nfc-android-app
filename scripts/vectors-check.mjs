import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const LOCK_PATH = "__tests__/conformance/ntag424-vectors/LOCK";
const VECTORS_PATH = "__tests__/conformance/ntag424-vectors/vectors.json";

const lock = readFileSync(LOCK_PATH, "utf8");
const match = lock.match(/vectors\.json sha256: ([0-9a-f]{64})/);
if (!match) {
    console.error(`${LOCK_PATH} does not record a "vectors.json sha256: <hex>" line`);
    process.exit(1);
}

const expected = match[1];
const actual = createHash("sha256").update(readFileSync(VECTORS_PATH)).digest("hex");

if (actual !== expected) {
    console.error(`vendored vectors.json drift detected:`);
    console.error(`  vendored sha256: ${actual}`);
    console.error(`  LOCK sha256:     ${expected}`);
    console.error(`Refresh: overwrite ${VECTORS_PATH} from Amperstrand/ntag424-vectors,`);
    console.error(`update ${LOCK_PATH} (upstream commit + sha256), re-run npm run vectors:check.`);
    process.exit(1);
}

console.log(`vectors.json sha256 OK (${actual})`);
