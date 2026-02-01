'use client';

import { WalletConnect } from '@/components/wallet-connect';
import { useAccount } from 'wagmi';

export default function Home() {
  const { address, isConnected } = useAccount();

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">AgentPay</h1>
          <WalletConnect />
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {!isConnected ? (
          <div className="text-center py-20">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Welcome to AgentPay
            </h2>
            <p className="text-gray-600 mb-8">
              AI agents paying each other instantly via Yellow Network
            </p>
            <p className="text-gray-500">
              Connect your wallet to get started
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Connected</h2>
              <p className="text-gray-600">
                Wallet: {address}
              </p>
              <p className="text-gray-500 mt-4">
                Session management coming next...
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
