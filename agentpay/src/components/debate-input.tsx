'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GlowingButton } from '@/components/ui/glowing-button';
import { ShuffleButton } from '@/components/ui/shuffle-button';
import { Textarea } from '@/components/ui/textarea';

const SUGGESTED_TOPICS = [
  'Should AI have legal personhood?',
  'Is universal basic income inevitable?',
  'Should social media be regulated like utilities?',
  'Will remote work replace offices permanently?',
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">🎯 Start a Debate</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          placeholder={isSessionActive
            ? 'Enter a debate topic...'
            : 'Create a session first'}
          value={topic}
          onChange={(e) => { setTopic(e.target.value); if (error) setError(null); }}
          disabled={!isSessionActive || isSubmitting}
          rows={2}
          className="resize-none text-sm"
        />

        {/* Suggested topics */}
        {isSessionActive && !topic && (
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_TOPICS.map((t) => (
              <ShuffleButton
                key={t}
                onClick={() => setTopic(t)}
                duration={0.6}
                className="h-auto px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full"
              >
                {t}
              </ShuffleButton>
            ))}
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <GlowingButton
          onClick={handleSubmit}
          disabled={!isSessionActive || isSubmitting || !topic.trim()}
          glowColor="#8B5CF6"
          className="w-full"
        >
          {isSubmitting ? 'Debating...' : '⚡ Start Debate'}
        </GlowingButton>
      </CardContent>
    </Card>
  );
}
