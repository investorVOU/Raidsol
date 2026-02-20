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
    createDefaultAuthorizationResultCache,
    createDefaultWalletNotFoundHandler,
} from '@solana-mobile/wallet-adapter-mobile';

import '@solana/wallet-adapter-react-ui/styles.css';

export const SolanaWalletContext: FC<{ children: ReactNode }> = ({ children }) => {
    // Read RPC from env — set VITE_SOLANA_RPC_URL in .env for a private endpoint
    const endpoint = useMemo(
        () => import.meta.env.VITE_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com',
        [],
    );

    const network = useMemo(() => {
        const rpc = import.meta.env.VITE_SOLANA_RPC_URL ?? '';
        return rpc.includes('mainnet') ? WalletAdapterNetwork.Mainnet : WalletAdapterNetwork.Devnet;
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
                    name: 'Solana Raid',
                    uri: typeof window !== 'undefined' ? window.location.origin : 'https://solanaraid.app',
                    icon: '/favicon.ico',
                },
                authorizationResultCache: createDefaultAuthorizationResultCache(),
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
