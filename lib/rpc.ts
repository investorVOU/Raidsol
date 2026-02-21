import { Connection } from '@solana/web3.js';

const MAINNET_PUBLIC = 'https://api.mainnet-beta.solana.com';

/**
 * Ordered RPC list: Helius → Alchemy → VITE_SOLANA_RPC_URL → public mainnet.
 * Public mainnet is always the last-resort fallback (rate-limits / 403s on browser origin).
 */
export function getRpcList(): string[] {
  const candidates = [
    import.meta.env.VITE_HELIUS_RPC_URL,
    import.meta.env.VITE_ALCHEMY_RPC_URL,
    import.meta.env.VITE_SOLANA_RPC_URL,
  ].filter((u): u is string => typeof u === 'string' && u.startsWith('http'));

  // Deduplicate, strip any public mainnet entries from private slots
  const seen = new Set<string>();
  const list: string[] = [];
  for (const url of candidates) {
    if (!seen.has(url) && !url.includes('api.mainnet-beta.solana.com')) {
      seen.add(url);
      list.push(url);
    }
  }
  list.push(MAINNET_PUBLIC); // public mainnet last — only if private endpoints fail
  return list;
}

/** Best single endpoint for ConnectionProvider (Helius > Alchemy > public). */
export function getPrimaryRpc(): string {
  return (
    import.meta.env.VITE_HELIUS_RPC_URL ||
    import.meta.env.VITE_ALCHEMY_RPC_URL ||
    import.meta.env.VITE_SOLANA_RPC_URL ||
    MAINNET_PUBLIC
  );
}

export function makeConnection(url: string): Connection {
  return new Connection(url, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60_000,
    disableRetryOnRateLimit: false,
  });
}
