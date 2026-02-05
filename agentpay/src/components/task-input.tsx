'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface TaskInputProps {
  isSessionActive: boolean;
  onSubmit: (task: string) => Promise<void>;
}

export function TaskInput({ isSessionActive, onSubmit }: TaskInputProps) {
  const [task, setTask] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmedTask = task.trim();
    
    if (!trimmedTask) {
      setError('Please enter a task description');
      return;
    }

    if (!isSessionActive) {
      setError('Create a session first');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit(trimmedTask);
      setTask('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit task');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Submit Task</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          placeholder={isSessionActive 
            ? "What do you need help with?" 
            : "Create a session first"}
          value={task}
          onChange={(e) => {
            setTask(e.target.value);
            if (error) setError(null);
          }}
          disabled={!isSessionActive || isSubmitting}
          rows={3}
          className="resize-none text-sm"
        />
        
        {error && (
          <p className="text-xs text-red-600">{error}</p>
        )}

        <Button
          onClick={handleSubmit}
          disabled={!isSessionActive || isSubmitting || !task.trim()}
          className="w-full"
        >
          {isSubmitting ? 'Processing...' : 'Submit'}
        </Button>
      </CardContent>
    </Card>
  );
}
