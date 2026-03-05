import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export type PushStatus = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed' | 'loading';

// Resolves serviceWorker.ready with a timeout so we never stay in 'loading' forever
// (e.g. in dev mode or when the SW fails to activate).
function swReady(timeoutMs = 5000): Promise<ServiceWorkerRegistration | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    navigator.serviceWorker.ready.then((reg) => { clearTimeout(timer); resolve(reg); }).catch(() => { clearTimeout(timer); resolve(null); });
  });
}

export function usePushNotifications(walletAddress: string | null) {
  const [status, setStatus] = useState<PushStatus>('loading');

  const checkStatus = useCallback(async () => {
    // Only 'unsupported' when the browser itself lacks the APIs
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setStatus('unsupported');
      return;
    }
    const perm = Notification.permission;
    if (perm === 'denied') { setStatus('denied'); return; }

    // If VAPID key not configured, still show button so user can enable permission
    if (!VAPID_PUBLIC_KEY) { setStatus('unsubscribed'); return; }

    const reg = await swReady();
    if (!reg) { setStatus('unsubscribed'); return; }
    const existing = await reg.pushManager.getSubscription();
    setStatus(existing ? 'subscribed' : 'unsubscribed');
  }, []);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!walletAddress) return false;
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setStatus('denied'); return false; }

      // If no VAPID key, permission was granted but we can't create a push subscription
      if (!VAPID_PUBLIC_KEY) { setStatus('unsubscribed'); return false; }

      const reg = await swReady();
      if (!reg) return false;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const { endpoint, keys } = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      await supabase.from('push_subscriptions').upsert(
        { wallet_address: walletAddress, endpoint, p256dh: keys.p256dh, auth: keys.auth },
        { onConflict: 'endpoint' }
      );

      setStatus('subscribed');
      return true;
    } catch (err) {
      console.error('[push] subscribe failed', err);
      return false;
    }
  }, [walletAddress]);

  const unsubscribe = useCallback(async () => {
    const reg = await swReady();
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const { endpoint } = sub.toJSON() as { endpoint: string };
    await sub.unsubscribe();
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    setStatus('unsubscribed');
  }, []);

  return { status, subscribe, unsubscribe };
}
