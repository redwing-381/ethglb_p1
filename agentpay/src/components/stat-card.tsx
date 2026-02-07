'use client';

import type { ReactNode } from 'react';
import { AnimatedCard, CardBody } from '@/components/ui/animated-card';
import { BorderBeam } from '@/components/ui/border-beam';

interface StatCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  highlight?: boolean;
}

export function StatCard({ label, value, icon, highlight }: StatCardProps) {
  return (
    <AnimatedCard className="relative overflow-hidden">
      {highlight && <BorderBeam lightColor="#10B981" lightWidth={200} duration={6} borderWidth={1} />}
      <CardBody className="p-5">
        <div className="flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-xl font-bold text-foreground">{value}</p>
          </div>
        </div>
      </CardBody>
    </AnimatedCard>
  );
}
