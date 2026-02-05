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
      setTask(''); // Clear on success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit task');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-gray-200">
      <CardHeader className="border-b border-gray-100">
        <CardTitle className="text-lg text-gray-900">Submit Task</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <Textarea
          placeholder={isSessionActive 
            ? "Describe what you want the agents to do..." 
            : "Create a session to submit tasks"
          }
          value={task}
          onChange={(e) => {
            setTask(e.target.value);
            if (error) setError(null);
          }}
          disabled={!isSessionActive || isSubmitting}
          rows={4}
          className="resize-none border-gray-200 focus:border-blue-500 focus:ring-blue-500"
        />
        
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <span className="text-red-600 text-sm">{error}</span>
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={!isSessionActive || isSubmitting || !task.trim()}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-6 transition-smooth"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              Processing...
            </span>
          ) : (
            'Submit to Agents'
          )}
        </Button>

        {!isSessionActive && (
          <p className="text-xs text-gray-500 text-center">
            Create a session to submit tasks
          </p>
        )}
      </CardContent>
    </Card>
  );
}
