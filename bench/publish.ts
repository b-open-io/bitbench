/**
 * Publish benchmark results to the blockchain as a 1sat ordinal
 */
import {
  PrivateKey,
  P2PKH,
  Transaction,
  ARC,
  SatoshisPerKilobyte,
  Script,
} from "@bsv/sdk";
import { getAuthToken } from "bitcoin-auth";

// B protocol prefix for data
const B_PREFIX = "19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut";

// MAP protocol prefix
const MAP_PREFIX = "1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5";

// ARC broadcaster endpoint
const ARC_URL = "https://arc.taal.com";

export interface BenchmarkResultData {
  suiteId: string;
  suiteName: string;
  chain: string;
  version: string;
  timestamp: string;
  rankings: Array<{
    model: string;
    correct: number;
    incorrect: number;
    errors: number;
    totalTests: number;
    successRate: number;
    totalCost: number;
    tokensPerSecond: number;
  }>;
  metadata: {
    totalModels: number;
    totalTestsRun: number;
    overallSuccessRate: number;
    totalCost: number;
  };
}

export interface PublishResult {
  txid: string;
  vout: number;
  outpoint: string;
  rawTx: string;
}

/**
 * Create OP_RETURN script with B protocol data and MAP metadata
 */
function createDataScript(data: BenchmarkResultData): Script {
  const jsonData = JSON.stringify(data);

  // Build script parts
  const parts: string[] = [
    // B protocol
    B_PREFIX,
    jsonData,
    "application/json",
    "utf-8",
    "|", // Pipe separator for chained protocols
    // MAP protocol
    MAP_PREFIX,
    "SET",
    "app",
    "bitbench",
    "type",
    "benchmark-result",
    "suite",
    data.suiteId,
    "chain",
    data.chain,
    "version",
    data.version,
  ];

  // Build script: OP_FALSE OP_RETURN <data...>
  const chunks: number[][] = [];

  // OP_FALSE OP_RETURN
  chunks.push([0x00, 0x6a]);

  for (const part of parts) {
    const bytes = Array.from(new TextEncoder().encode(part));
    // Push data with appropriate opcode
    if (bytes.length < 76) {
      chunks.push([bytes.length, ...bytes]);
    } else if (bytes.length < 256) {
      chunks.push([0x4c, bytes.length, ...bytes]); // OP_PUSHDATA1
    } else if (bytes.length < 65536) {
      chunks.push([0x4d, bytes.length & 0xff, (bytes.length >> 8) & 0xff, ...bytes]); // OP_PUSHDATA2
    } else {
      chunks.push([
        0x4e,
        bytes.length & 0xff,
        (bytes.length >> 8) & 0xff,
        (bytes.length >> 16) & 0xff,
        (bytes.length >> 24) & 0xff,
        ...bytes,
      ]); // OP_PUSHDATA4
    }
  }

  const scriptBytes = chunks.flat();
  return Script.fromBinary(scriptBytes);
}

/**
 * Get UTXOs for an address from WhatsOnChain
 */
async function getUtxos(
  address: string
): Promise<Array<{ txid: string; vout: number; satoshis: number; script: string }>> {
  const response = await fetch(
    `https://api.whatsonchain.com/v1/bsv/main/address/${address}/unspent`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch UTXOs: ${response.status}`);
  }

  const utxos = await response.json();

  // Get full transaction details for each UTXO to get the script
  const utxosWithScripts = await Promise.all(
    utxos.map(async (utxo: { tx_hash: string; tx_pos: number; value: number }) => {
      const txResponse = await fetch(
        `https://api.whatsonchain.com/v1/bsv/main/tx/${utxo.tx_hash}/hex`
      );
      const txHex = await txResponse.text();
      const tx = Transaction.fromHex(txHex);
      const output = tx.outputs[utxo.tx_pos];

      return {
        txid: utxo.tx_hash,
        vout: utxo.tx_pos,
        satoshis: utxo.value,
        script: output.lockingScript.toHex(),
      };
    })
  );

  return utxosWithScripts;
}

/**
 * Publish benchmark results to the blockchain
 */
export async function publishResults(
  data: BenchmarkResultData,
  options?: { silent?: boolean }
): Promise<PublishResult> {
  const wif = process.env.MASTER_WIF;
  if (!wif) {
    throw new Error("MASTER_WIF environment variable is required for publishing");
  }

  const privateKey = PrivateKey.fromWif(wif);
  const publicKey = privateKey.toPublicKey();
  const address = publicKey.toAddress();

  if (!options?.silent) {
    console.log(`Publishing from address: ${address}`);
  }

  // Get UTXOs
  const utxos = await getUtxos(address);
  if (utxos.length === 0) {
    throw new Error(`No UTXOs available for address ${address}`);
  }

  // Sort by value descending
  utxos.sort((a, b) => b.satoshis - a.satoshis);

  // Create transaction
  const tx = new Transaction();

  // Add input from largest UTXO
  const sourceUtxo = utxos[0];
  const p2pkh = new P2PKH();

  tx.addInput({
    sourceTXID: sourceUtxo.txid,
    sourceOutputIndex: sourceUtxo.vout,
    sequence: 0xffffffff,
    unlockingScriptTemplate: p2pkh.unlock(privateKey),
  });

  // Manually set source transaction output info for fee calculation
  const input = tx.inputs[0];
  (input as any).sourceTransaction = Transaction.fromHex(
    await (await fetch(`https://api.whatsonchain.com/v1/bsv/main/tx/${sourceUtxo.txid}/hex`)).text()
  );

  // Add data output (OP_RETURN with B + MAP)
  const dataScript = createDataScript(data);
  tx.addOutput({
    lockingScript: dataScript,
    satoshis: 0,
  });

  // Add change output back to same address
  tx.addOutput({
    lockingScript: p2pkh.lock(address),
    change: true,
  });

  // Calculate fee
  await tx.fee(new SatoshisPerKilobyte(1));

  // Sign
  await tx.sign();

  // Broadcast via ARC
  const arc = new ARC(ARC_URL);
  const broadcastResult = await arc.broadcast(tx);

  if (broadcastResult.status !== "success") {
    throw new Error(
      `Broadcast failed: ${broadcastResult.description || "Unknown error"}`
    );
  }

  const txid = tx.id("hex");
  const vout = 0; // Data output is first
  const outpoint = `${txid}_${vout}`;

  if (!options?.silent) {
    console.log(`✓ Published to blockchain: ${outpoint}`);
    console.log(`  View: https://whatsonchain.com/tx/${txid}`);
  }

  return {
    txid,
    vout,
    outpoint,
    rawTx: tx.toHex(),
  };
}

/**
 * Check if publishing is configured (MASTER_WIF is set)
 */
export function isPublishingConfigured(): boolean {
  return !!process.env.MASTER_WIF;
}

/**
 * Sync benchmark results to the website's KV store
 */
export interface SyncResult {
  success: boolean;
  runId?: string;
  error?: string;
}

export async function syncResultsToWebsite(
  data: BenchmarkResultData,
  options?: { baseUrl?: string; silent?: boolean }
): Promise<SyncResult> {
  const wif = process.env.MASTER_WIF;
  if (!wif) {
    return { success: false, error: "MASTER_WIF not set" };
  }

  const baseUrl = options?.baseUrl || "https://bitbench.dev";
  const requestPath = `/api/suites/${data.suiteId}/complete`;
  const body = JSON.stringify(data);

  // Generate bitcoin-auth token
  const authToken = getAuthToken({
    privateKeyWif: wif,
    requestPath,
    body,
    scheme: "brc77",
  });

  try {
    const response = await fetch(`${baseUrl}${requestPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Bitcoin-Auth-Token": authToken,
      },
      body,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}`,
      };
    }

    const result = await response.json();

    if (!options?.silent) {
      console.log(`✓ Synced results to website: ${result.runId}`);
    }

    return {
      success: true,
      runId: result.runId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
