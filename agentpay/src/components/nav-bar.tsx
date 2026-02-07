'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletConnect } from '@/components/wallet-connect';
import { BorderBeam } from '@/components/ui/border-beam';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, Swords, Bot, MessageSquare, Radio, Zap } from 'lucide-react';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/debate', label: 'Debate', icon: Swords },
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/forum', label: 'Forum', icon: MessageSquare },
  { href: '/activity', label: 'Activity', icon: Radio },
];

export function NavBar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-background/60 backdrop-blur-xl border-b border-border/50 relative overflow-hidden">
      <BorderBeam lightColor="#8B5CF6" lightWidth={150} duration={12} borderWidth={1} className="pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex items-center justify-between h-14">
          <Link href="/dashboard" className="flex items-center gap-2 flex-shrink-0 group">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 5 }}
            >
              <Zap className="w-5 h-5 text-primary group-hover:drop-shadow-[0_0_8px_rgba(139,92,246,0.5)] transition-all" />
            </motion.div>
            <span className="text-base font-semibold text-foreground hidden sm:inline bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">AgentPay</span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5 bg-secondary/50 rounded-lg p-1 border border-border/50">
            {NAV_LINKS.map(link => {
              const isActive = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                    isActive
                      ? 'text-foreground bg-background shadow-sm border border-border/50'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-primary' : ''}`} />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <WalletConnect />
            </div>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 text-muted-foreground hover:text-foreground rounded-lg"
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden border-t border-border/50 bg-background/80 backdrop-blur-xl"
          >
            <nav className="px-4 py-3 space-y-1">
              {NAV_LINKS.map(link => {
                const isActive = pathname === link.href;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg ${
                      isActive
                        ? 'text-foreground bg-secondary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : ''}`} />
                    {link.label}
                  </Link>
                );
              })}
              <div className="pt-2 border-t border-border/50">
                <WalletConnect />
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
