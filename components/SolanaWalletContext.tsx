import React, { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { LedgerWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';

import '@solana/wallet-adapter-react-ui/styles.css';
import { getPrimaryRpc } from '../lib/rpc';

// MWA is registered via registerMwa() in index.tsx for Solana mobile (Seed Vault, etc.)
// Phantom, Solflare, Backpack, and other Wallet Standard wallets auto-detect — no manual adapters needed.

export const SolanaWalletContext: FC<{ children: ReactNode }> = ({ children }) => {
    // Prefer Helius → Alchemy → VITE_SOLANA_RPC_URL → public mainnet
    const endpoint = useMemo(() => getPrimaryRpc(), []);

    const connectionConfig = useMemo(() => ({
        commitment: 'confirmed' as const,
        confirmTransactionInitialTimeout: 60_000,
        disableRetryOnRateLimit: false,
    }), []);

    // Only Ledger needs manual instantiation (WebHID).
    // All other wallets (Phantom, Solflare, Backpack, MWA/Seed Vault)
    // register via Wallet Standard and are auto-detected.
    const wallets = useMemo(
        () => [
            new LedgerWalletAdapter(),
        ],
        [],
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
