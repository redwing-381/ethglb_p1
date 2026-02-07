'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
              <button
                key={t}
                onClick={() => setTopic(t)}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors"
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <Button
          onClick={handleSubmit}
          disabled={!isSessionActive || isSubmitting || !topic.trim()}
          className="w-full"
        >
          {isSubmitting ? 'Debating...' : '⚡ Start Debate'}
        </Button>
      </CardContent>
    </Card>
  );
}
