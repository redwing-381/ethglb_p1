'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useDisconnect, useEnsAvatar } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { useEnsName } from '@/hooks/use-ens-name';
import { useEffect } from 'react';
import { clearEnsCache } from '@/lib/blockchain';
import { LogOut, ChevronDown, User } from 'lucide-react';

interface WalletConnectProps {
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
}

export function WalletConnect({ onConnect, onDisconnect }: WalletConnectProps) {
  const { disconnect } = useDisconnect();

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
        
        const { displayName, ensName } = useEnsName(account?.address);
        
        // Fetch ENS avatar on Sepolia
        const { data: ensAvatar } = useEnsAvatar({
          name: ensName || undefined,
          chainId: sepolia.id,
          query: { enabled: !!ensName },
        });

        useEffect(() => {
          if (!connected) {
            clearEnsCache();
          }
        }, [connected]);

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
                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-all duration-200 shadow-lg shadow-primary/25"
                  >
                    Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-white font-medium rounded-lg transition-colors"
                  >
                    Wrong network
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={openChainModal}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-secondary hover:bg-secondary/80 rounded-lg transition-all duration-200 border border-border"
                  >
                    {chain.hasIcon && chain.iconUrl && (
                      <img
                        alt={chain.name ?? 'Chain icon'}
                        src={chain.iconUrl}
                        className="w-4 h-4"
                      />
                    )}
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  </button>

                  <button
                    onClick={openAccountModal}
                    className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 rounded-lg transition-all duration-200 border border-border"
                    title={account.address}
                  >
                    <div className="flex items-center gap-2">
                      {ensAvatar ? (
                        <img
                          src={ensAvatar}
                          alt={ensName || 'ENS avatar'}
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : ensName ? (
                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                          <User className="w-3 h-3 text-primary" />
                        </div>
                      ) : null}
                      <span className="text-sm font-medium text-foreground">
                        {displayName}
                      </span>
                      {ensName && (
                        <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
                          ENS
                        </span>
                      )}
                    </div>
                  </button>

                  <button
                    onClick={() => disconnect()}
                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all duration-200"
                    title="Disconnect wallet"
                  >
                    <LogOut className="w-4 h-4" />
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
