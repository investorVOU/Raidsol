export type SolanaCluster = 'mainnet-beta' | 'devnet';

/**
 * Mainnet is the only production default. Devnet must be selected explicitly
 * so a build can never silently redirect real users to a test cluster.
 */
export function getSolanaCluster(): SolanaCluster {
  return import.meta.env.VITE_SOLANA_CLUSTER?.toLowerCase() === 'devnet'
    ? 'devnet'
    : 'mainnet-beta';
}

export function isDevnet(): boolean {
  return getSolanaCluster() === 'devnet';
}

/**
 * Keep test payments isolated from the production treasury. A devnet build
 * fails closed if this address has not been configured.
 */
export function getTreasuryAddress(): string | undefined {
  return isDevnet()
    ? import.meta.env.VITE_DEVNET_TREASURY_ADDRESS
    : import.meta.env.VITE_TREASURY_ADDRESS;
}
