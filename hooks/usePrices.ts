
import { useState, useEffect } from 'react';
import { Currency } from '../types';

const SKR_MINT  = import.meta.env.VITE_SKR_MINT  ?? 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3';
const RAID_MINT = import.meta.env.VITE_RAID_MINT ?? 'J8sMGxWB5kT8SqgmeTa3TfW6mpmucYK8xpMkmPCbBAGS';
const SOL_MINT = 'So11111111111111111111111111111111111111112';

// SOL: 1 (base). USDC/SKR/RAID: 0 means not yet loaded
const LOADING_RATES: Record<Currency, number> = {
  [Currency.SOL]:  1,
  [Currency.USDC]: 0,
  [Currency.SKR]:  0,
  [Currency.RAID]: 0,
};

export interface LivePrices {
  solUsd: number;
  skrUsd: number;
  raidUsd: number;
  currencyRates: Record<Currency, number>;
  pricesReady: boolean;
  pricesFailed: boolean; // true after first attempt returned no data
}

/** fetch with hard timeout — returns null on error or timeout */
async function timedFetch(url: string, ms = 4000): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok ? res : null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

async function fetchLivePrices(): Promise<{ solUsd: number; skrUsd: number; raidUsd: number } | null> {
  // Run all sources in parallel — first valid data wins; merge partial results
  const [dsResult, jupResult, raidDsResult, bnResult] = await Promise.allSettled([

    // ── DexScreener (user-preferred, DEX-native, no geo-blocks) ──────────────
    (async () => {
      const res = await timedFetch(
        `https://api.dexscreener.com/latest/dex/tokens/${SKR_MINT}`,
      );
      if (!res) return null;
      const json = await res.json();
      const pairs: any[] = json?.pairs ?? [];
      if (!pairs.length) return null;
      const sorted = [...pairs].sort(
        (a, b) => parseFloat(b.liquidity?.usd ?? '0') - parseFloat(a.liquidity?.usd ?? '0'),
      );
      const skrUsd = parseFloat(sorted[0]?.priceUsd ?? '0');
      if (skrUsd <= 0) return null;
      // Try to derive SOL price: find a pair where quote is SOL → solUsd = skrUsd / priceNative
      let solUsd = 0;
      const skrSolPair = sorted.find(
        (p) => p.quoteToken?.address === SOL_MINT && parseFloat(p.priceNative ?? '0') > 0,
      );
      if (skrSolPair) solUsd = skrUsd / parseFloat(skrSolPair.priceNative);
      return { skrUsd, solUsd, raidUsd: 0 };
    })(),

    // ── Jupiter Price API (Solana-native, single call for both) ──────────────
    (async () => {
      const res = await timedFetch(
        `https://api.jup.ag/price/v2?ids=${SOL_MINT},${SKR_MINT},${RAID_MINT}`,
      );
      if (!res) return null;
      const json = await res.json();
      const solUsd = parseFloat(json.data?.[SOL_MINT]?.price ?? '0');
      const skrUsd = parseFloat(json.data?.[SKR_MINT]?.price ?? '0');
      const raidUsd = parseFloat(json.data?.[RAID_MINT]?.price ?? '0');
      return solUsd > 0 ? { solUsd, skrUsd, raidUsd } : null;
    })(),

    
    // -- DexScreener (RAID token) -----------------------------------------
    (async () => {
      const res = await timedFetch(
        `https://api.dexscreener.com/latest/dex/tokens/${RAID_MINT}`,
      );
      if (!res) return null;
      const json = await res.json();
      const pairs: any[] = json?.pairs ?? [];
      if (!pairs.length) return null;
      const sorted = [...pairs].sort(
        (a, b) => parseFloat(b.liquidity?.usd ?? "0") - parseFloat(a.liquidity?.usd ?? "0"),
      );
      const raidUsd = parseFloat(sorted[0]?.priceUsd ?? "0");
      if (raidUsd <= 0) return null;
      // Try to derive SOL price: find a pair where quote is SOL ? solUsd = raidUsd / priceNative
      let solUsd = 0;
      const raidSolPair = sorted.find(
        (p) => p.quoteToken?.address === SOL_MINT && parseFloat(p.priceNative ?? "0") > 0,
      );
      if (raidSolPair) solUsd = raidUsd / parseFloat(raidSolPair.priceNative);
      return { solUsd, skrUsd: 0, raidUsd };
    })(),

    // ── Binance (SOL-only fallback) ───────────────────────────────────────────
    (async () => {
      const res = await timedFetch(
        'https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT',
      );
      if (!res) return null;
      const json = await res.json();
      const solUsd = parseFloat(json.price ?? '0');
      return solUsd > 0 ? { solUsd, skrUsd: 0, raidUsd: 0 } : null;
    })(),
  ]);

  // Merge: take best solUsd and token prices from whichever sources responded
  let solUsd = 0;
  let skrUsd = 0;
  let raidUsd = 0;
  for (const r of [dsResult, jupResult, raidDsResult, bnResult]) {
    if (r.status !== 'fulfilled' || !r.value) continue;
    if (r.value.solUsd > 0 && solUsd === 0) solUsd = r.value.solUsd;
    if (r.value.skrUsd > 0 && skrUsd === 0) skrUsd = r.value.skrUsd;
    if (r.value.raidUsd > 0 && raidUsd === 0) raidUsd = r.value.raidUsd;
  }

  return solUsd > 0 ? { solUsd, skrUsd, raidUsd } : null;
}

export function usePrices(): LivePrices {
  const [state, setState] = useState<LivePrices>({
    solUsd: 0,
    skrUsd: 0,
    raidUsd: 0,
    currencyRates: LOADING_RATES,
    pricesReady: false,
    pricesFailed: false,
  });

  useEffect(() => {
    let cancelled = false;

    const update = async () => {
      const result = await fetchLivePrices();
      if (cancelled) return;
      if (result) {
        const { solUsd, skrUsd, raidUsd } = result;
        setState({
          solUsd,
          skrUsd,
          raidUsd,
          pricesReady: true,
          pricesFailed: false,
          currencyRates: {
            [Currency.SOL]:  1,
            [Currency.USDC]: solUsd,
            [Currency.SKR]:  skrUsd > 0 ? solUsd / skrUsd : 0,
            [Currency.RAID]: raidUsd > 0 ? solUsd / raidUsd : 0,
          },
        });
      } else {
        // Only flag as failed on the FIRST attempt (don't wipe valid cached rates on a refresh blip)
        setState(prev => prev.pricesReady ? prev : { ...prev, pricesFailed: true });
      }
    };

    update();
    const interval = setInterval(update, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return state;
}
