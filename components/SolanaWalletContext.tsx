import React, { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
    PhantomWalletAdapter,
    SolflareWalletAdapter,
    TorusWalletAdapter,
    LedgerWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { getPrimaryRpc } from '../lib/rpc';

import '@solana/wallet-adapter-react-ui/styles.css';

export const SolanaWalletContext: FC<{ children: ReactNode }> = ({ children }) => {
    const network = WalletAdapterNetwork.Mainnet;
    const endpoint = useMemo(() => getPrimaryRpc(), []);

    // MWA launches an Android intent (and may request loopback-network access).
    // Letting wallet-adapter auto-connect after render loses the user gesture
    // Chrome requires for that launch in a Trusted Web Activity.
    const isSeekerTwa =
        typeof document !== 'undefined' &&
        document.referrer.startsWith('android-app://') &&
        /android/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');

    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
            new TorusWalletAdapter(),
            new LedgerWalletAdapter(),
        ],
        [network]
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect={!isSeekerTwa}>
                <WalletModalProvider>{children}</WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};
