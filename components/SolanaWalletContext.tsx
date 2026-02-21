import React, { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
    PhantomWalletAdapter,
    SolflareWalletAdapter,
    TorusWalletAdapter,
    LedgerWalletAdapter,
    CoinbaseWalletAdapter,
    TrustWalletAdapter,
    NightlyWalletAdapter,
    Coin98WalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
    SolanaMobileWalletAdapter,
    createDefaultAddressSelector,
    createDefaultWalletNotFoundHandler,
} from '@solana-mobile/wallet-adapter-mobile';

import '@solana/wallet-adapter-react-ui/styles.css';
import { getPrimaryRpc } from '../lib/rpc';

// Clear stale MWA auth cache from devnet — runs once on module load before any React renders.
// The default cache key used by @solana-mobile/wallet-standard-mobile.
try {
    const MWA_CACHE_KEY = 'SolanaMobileWalletAdapterDefaultAuthorizationCache';
    const raw = localStorage.getItem(MWA_CACHE_KEY);
    if (raw && (raw.includes('devnet') || raw.includes('testnet'))) {
        localStorage.removeItem(MWA_CACHE_KEY);
    }
} catch { /* localStorage unavailable — SSR or sandboxed */ }

export const SolanaWalletContext: FC<{ children: ReactNode }> = ({ children }) => {
    // Prefer Helius → Alchemy → VITE_SOLANA_RPC_URL → public mainnet (403s on browser)
    const endpoint = useMemo(() => getPrimaryRpc(), []);

    const network = useMemo(() => {
        return getPrimaryRpc().includes('mainnet') ? WalletAdapterNetwork.Mainnet : WalletAdapterNetwork.Devnet;
    }, []);

    const connectionConfig = useMemo(() => ({
        commitment: 'confirmed' as const,
        confirmTransactionInitialTimeout: 60_000,
        disableRetryOnRateLimit: false,
    }), []);

    const wallets = useMemo(
        () => [
            new SolanaMobileWalletAdapter({
                addressSelector: createDefaultAddressSelector(),
                appIdentity: {
                    name: 'SolRaid',
                    uri: 'https://solraid.app',
                    icon: 'https://solraid.app/icon-192.png',
                },
                authorizationResultCache: {
                    get: async () => null,   // always request fresh auth — no stale-state issues
                    set: async () => {},
                    clear: async () => {},
                },
                cluster: network,
                onWalletNotFound: createDefaultWalletNotFoundHandler(),
            }),
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter({ network }),
            new CoinbaseWalletAdapter(),
            new TrustWalletAdapter(),
            new NightlyWalletAdapter(),
            new Coin98WalletAdapter(),
            new TorusWalletAdapter(),
            new LedgerWalletAdapter(),
        ],
        [network],
    );

    const onWalletError = (error: Error) => {
        // Suppress "User rejected" and adapter-not-found errors — these are normal user actions
        if (
            error.name === 'WalletNotReadyError' ||
            error.name === 'WalletNotSelectedError' ||
            error.message?.includes('User rejected') ||
            error.message?.includes('dismissed')
        ) return;
        console.warn('[Wallet]', error.message);
    };

    return (
        <ConnectionProvider endpoint={endpoint} config={connectionConfig}>
            <WalletProvider
                wallets={wallets}
                autoConnect
                localStorageKey="solana-raid-wallet"
                onError={onWalletError}
            >
                <WalletModalProvider>{children}</WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};
