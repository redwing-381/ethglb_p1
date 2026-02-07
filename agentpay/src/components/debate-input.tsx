'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedCard } from '@/components/ui/animated-card';
import { GlowingButton } from '@/components/ui/glowing-button';
import { ShuffleButton } from '@/components/ui/shuffle-button';
import { Textarea } from '@/components/ui/textarea';
import { Crosshair, Zap, Sparkles } from 'lucide-react';

const SUGGESTED_TOPICS = [
  'Are state channels like Yellow Network superior to rollups for micropayments?',
  'Should ENS names replace wallet addresses as the standard for Web3 identity?',
  'Will off-chain payment channels make on-chain transactions obsolete?',
  'Is decentralized naming (ENS) more important than decentralized finance?',
  'Should AI agents have their own ENS identities and crypto wallets?',
  'Are gasless state channel payments the key to mainstream crypto adoption?',
];

interface DebateInputProps {
  isSessionActive: boolean;
  onSubmit: (topic: string) => Promise<void>;
}

export function DebateInput({ isSessionActive, onSubmit }: DebateInputProps) {
  const [topic, setTopic] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmed = topic.trim();
    if (!trimmed) { setError('Enter a debate topic'); return; }
    if (!isSessionActive) { setError('Create a session first'); return; }

    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(trimmed);
      setTopic('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start debate');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatedCard>
      <Card className="border-0 shadow-none">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-1.5">
          <Crosshair className="w-4 h-4 text-primary" /> Start a Debate
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder={isSessionActive
            ? 'Enter a debate topic or pick one below...'
            : 'Create a session first'}
          value={topic}
          onChange={(e) => { setTopic(e.target.value); if (error) setError(null); }}
          disabled={!isSessionActive || isSubmitting}
          rows={2}
          className="resize-none text-sm"
        />

        {/* Quick topic picks */}
        {isSessionActive && (
          <div>
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Quick topics
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_TOPICS.map((t) => (
                <ShuffleButton
                  key={t}
                  onClick={() => setTopic(t)}
                  duration={0.6}
                  className={`h-auto px-2.5 py-1 text-xs rounded-full transition-colors ${
                    topic === t
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-secondary hover:bg-secondary/80 text-muted-foreground'
                  }`}
                >
                  {t}
                </ShuffleButton>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <GlowingButton
          onClick={handleSubmit}
          disabled={!isSessionActive || isSubmitting || !topic.trim()}
          glowColor="#8B5CF6"
          className="w-full whitespace-nowrap"
        >
          <span className="inline-flex items-center gap-1.5">
            {isSubmitting ? 'Debating...' : <><Zap className="w-4 h-4 shrink-0" /> Start Debate</>}
          </span>
        </GlowingButton>
      </CardContent>
      </Card>
    </AnimatedCard>
  );
}
