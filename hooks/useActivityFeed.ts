import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface ActivityEvent {
  id: string;
  event_type: 'EXTRACTED' | 'BUSTED' | string;
  username: string;
  amount_sol: number | null;
  created_at: string;
}

export function useActivityFeed() {
  const [feed, setFeed] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    // Initial load — most recent 10 events
    supabase
      .from('activity_feed')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setFeed(data as ActivityEvent[]);
      });

    // Real-time: prepend new events as they arrive
    const channel = supabase
      .channel('activity_feed_rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_feed' },
        (payload) => {
          setFeed((prev) => [payload.new as ActivityEvent, ...prev].slice(0, 10));
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { feed };
}
