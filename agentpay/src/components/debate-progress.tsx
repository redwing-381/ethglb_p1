'use client';

import { AnimatedCard, CardBody } from '@/components/ui/animated-card';
import { BorderBeam } from '@/components/ui/border-beam';
import { DEBATE_AGENT_CONFIGS } from '@/lib/ai';
import { AgentIcon } from '@/components/agent-avatar';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, CheckCircle2, Zap } from 'lucide-react';
import type { DebateAgentType } from '@/types';

interface DebateProgressProps {
  currentRound: number;
  totalRounds: number;
  activeAgent: DebateAgentType | null;
  isActive: boolean;
}

const AGENT_PIPELINE: DebateAgentType[] = [
  'moderator', 'debater_a', 'debater_b', 'fact_checker', 'judge', 'summarizer',
];

function getAgentStatus(
  agent: DebateAgentType,
  activeAgent: DebateAgentType | null,
): 'waiting' | 'active' | 'done' {
  if (!activeAgent) return 'waiting';
  const activeIdx = AGENT_PIPELINE.indexOf(activeAgent);
  const agentIdx = AGENT_PIPELINE.indexOf(agent);
  if (agentIdx < activeIdx) return 'done';
  if (agentIdx === activeIdx) return 'active';
  return 'waiting';
}

export function DebateProgress({ currentRound, totalRounds, activeAgent, isActive }: DebateProgressProps) {
  if (!isActive) return null;

  const activeConfig = activeAgent ? DEBATE_AGENT_CONFIGS[activeAgent] : null;

  return (
    <AnimatedCard className="relative overflow-hidden">
      <BorderBeam lightColor="#3B82F6" lightWidth={300} duration={3} borderWidth={2} className="pointer-events-none" />
      <CardBody className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {currentRound > 0 ? `Round ${currentRound} of ${totalRounds}` : 'Initializing debate...'}
              </p>
              <AnimatePresence mode="wait">
                {activeConfig && (
                  <motion.p
                    key={activeAgent}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="text-xs text-muted-foreground flex items-center gap-1"
                  >
                    <AgentIcon icon={activeConfig.icon} className="w-3 h-3 text-blue-400" />
                    {activeConfig.name} is working...
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs text-muted-foreground">Payments flow in real-time</span>
          </div>
        </div>

        {/* Agent pipeline */}
        <div className="grid grid-cols-3 gap-3">
          {AGENT_PIPELINE.map((agentType) => {
            const config = DEBATE_AGENT_CONFIGS[agentType];
            const status = getAgentStatus(agentType, activeAgent);
            return (
              <motion.div
                key={agentType}
                animate={status === 'active' ? { scale: [1, 1.03, 1] } : {}}
                transition={status === 'active' ? { duration: 1.5, repeat: Infinity } : {}}
                className={`relative flex items-center gap-3 p-3 rounded-lg border transition-all duration-300 ${
                  status === 'active'
                    ? 'bg-blue-500/15 border-blue-500/40 shadow-sm shadow-blue-500/10'
                    : status === 'done'
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-secondary/30 border-border/30'
                }`}
              >
                <div className={`p-1.5 rounded-md transition-colors flex-shrink-0 ${
                  status === 'active' ? 'bg-blue-500/20 text-blue-400'
                  : status === 'done' ? 'bg-green-500/20 text-green-400'
                  : 'bg-secondary text-muted-foreground'
                }`}>
                  {status === 'done' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : status === 'active' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <AgentIcon icon={config.icon} className="w-4 h-4" />
                  )}
                </div>
                <span className={`text-xs font-medium leading-tight ${
                  status === 'active' ? 'text-blue-300'
                  : status === 'done' ? 'text-green-400'
                  : 'text-muted-foreground'
                }`}>
                  {config.name}
                </span>
                {status === 'active' && (
                  <motion.div
                    className="absolute -bottom-px left-1/4 right-1/4 h-0.5 bg-blue-400 rounded-full"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Round progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{Math.round((AGENT_PIPELINE.indexOf(activeAgent || 'moderator') / AGENT_PIPELINE.length) * 100)}%</span>
          </div>
          <div className="w-full bg-border/50 rounded-full h-1.5 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-primary rounded-full"
              initial={{ width: '0%' }}
              animate={{
                width: `${((AGENT_PIPELINE.indexOf(activeAgent || 'moderator') + 0.5) / AGENT_PIPELINE.length) * 100}%`,
              }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>
      </CardBody>
    </AnimatedCard>
  );
}
