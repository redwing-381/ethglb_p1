'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useEnsName } from '@/hooks/use-ens-name';
import { useEffect } from 'react';
import { clearEnsCache } from '@/lib/blockchain';

interface WalletConnectProps {
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
}

export function WalletConnect({ onConnect, onDisconnect }: WalletConnectProps) {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;
        
        // Use ENS name for connected account
        const { displayName, ensName } = useEnsName(account?.address);
        
        // Clear ENS cache on disconnect
        useEffect(() => {
          if (!connected) {
            clearEnsCache();
          }
        }, [connected]);

        // Call callbacks when connection state changes
        if (connected && onConnect) {
          onConnect(account.address);
        }
        if (!connected && onDisconnect) {
          onDisconnect();
        }

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Wrong network
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openChainModal}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    {chain.hasIcon && chain.iconUrl && (
                      <img
                        alt={chain.name ?? 'Chain icon'}
                        src={chain.iconUrl}
                        className="w-4 h-4"
                      />
                    )}
                    <span className="text-sm font-medium">{chain.name}</span>
                  </button>

                  <button
                    onClick={openAccountModal}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    title={account.address}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {displayName}
                      </span>
                      {ensName && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                          ENS
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
