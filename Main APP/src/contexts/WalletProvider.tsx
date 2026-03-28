/**
 * Aleo Wallet Provider
 * 
 * Wraps the app with Aleo wallet adapter for Shield Wallet integration.
 */

import { useMemo } from 'react';
import type { FC, ReactNode } from 'react';
import { AleoWalletProvider } from '@provablehq/aleo-wallet-adaptor-react';
import { WalletModalProvider } from '@provablehq/aleo-wallet-adaptor-react-ui';
import { ShieldWalletAdapter } from '@provablehq/aleo-wallet-adaptor-shield';
import { Network } from '@provablehq/aleo-types';
import { WalletDecryptPermission } from '@provablehq/aleo-wallet-standard';

// Import wallet adapter UI styles FIRST
import '@provablehq/aleo-wallet-adaptor-react-ui/dist/styles.css';
// Import our custom override styles AFTER
import '../styles/wallet-adapter-override.css';

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: FC<WalletProviderProps> = ({ children }) => {
  const wallets = useMemo(
    () => [
      new ShieldWalletAdapter(),
    ],
    []
  );

  // Programs that this app interacts with - CRITICAL for Shield wallet to work!
  // Must list all programs that will be used for transactions
  // Update the program ID here when deploying a new contract version
  const programs = useMemo(() => [
    'credits.aleo',
    'salud_records.aleo',  // Must match PROGRAM_ID in aleo-utils.ts
  ], []);

  return (
    <AleoWalletProvider
      wallets={wallets}
      network={Network.TESTNET}
      autoConnect={true}
      decryptPermission={WalletDecryptPermission.UponRequest}
      programs={programs}
      onError={(error) => {
        console.error('[WalletProvider] Wallet error:', error);
      }}
    >
      <WalletModalProvider>
        {children}
      </WalletModalProvider>
    </AleoWalletProvider>
  );
};
