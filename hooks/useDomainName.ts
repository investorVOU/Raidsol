import { useState, useEffect } from 'react';

/**
 * Resolves a Solana wallet address to its .skr (or .sol) domain name
 * via the AllDomains public API.
 *
 * Returns null if the wallet has no registered domain, or on any API error.
 * This hook is purely additive — failure is silent.
 */
export function useDomainName(walletAddress: string | null): string | null {
  const [domain, setDomain] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) {
      setDomain(null);
      return;
    }

    let cancelled = false;

    const resolve = async () => {
      try {
        // AllDomains public API — returns all TLD domains owned by this wallet.
        // 404 = wallet has no registered domain — not an error, just no domain.
        const res = await fetch(
          `https://api.alldomains.id/v1/domains/owner/${walletAddress}`,
          { headers: { Accept: 'application/json' } }
        );

        // 404 is expected for wallets with no domains — silently return null
        if (res.status === 404 || !res.ok || cancelled) return;

        const data = await res.json();
        // Response shape: { domains: ["example.skr", ...] } or similar array
        const list: string[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.domains)
          ? data.domains
          : [];

        if (cancelled) return;

        // Prefer .skr domain, fall back to .sol
        const skr = list.find((d) => d.endsWith('.skr'));
        const sol = list.find((d) => d.endsWith('.sol'));
        setDomain(skr ?? sol ?? null);
      } catch {
        // Silently fail — wallet address fallback is shown in UI
        if (!cancelled) setDomain(null);
      }
    };

    resolve();
    return () => { cancelled = true; };
  }, [walletAddress]);

  return domain;
}
