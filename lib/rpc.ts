import { Connection } from '@solana/web3.js';

const MAINNET_PUBLIC = 'https://api.mainnet-beta.solana.com';

/** Ordered RPC list — primary → Helius → Alchemy → public fallback */
export function getRpcList(): string[] {
  const list = [
    import.meta.env.VITE_SOLANA_RPC_URL,
    import.meta.env.VITE_HELIUS_RPC_URL,
    import.meta.env.VITE_ALCHEMY_RPC_URL,
  ].filter((u): u is string => typeof u === 'string' && u.startsWith('http'));
  return list.length > 0 ? list : [MAINNET_PUBLIC];
}

export function makeConnection(url: string): Connection {
  return new Connection(url, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60_000,
    disableRetryOnRateLimit: false,
  });
}
