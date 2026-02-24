
import { useState, useEffect } from 'react';
import { Currency } from '../types';

const SKR_MINT = import.meta.env.VITE_SKR_MINT ?? 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3';
const SOL_MINT = 'So11111111111111111111111111111111111111112';

// SOL: 1 (base). USDC/SKR: 0 means "still loading" — not a valid rate
const LOADING_RATES: Record<Currency, number> = {
  [Currency.SOL]:  1,
  [Currency.USDC]: 0,
  [Currency.SKR]:  0,
};

export interface LivePrices {
  solUsd: number;
  skrUsd: number;
  currencyRates: Record<Currency, number>;
  pricesReady: boolean;
}

async function fetchLivePrices(): Promise<{ solUsd: number; skrUsd: number } | null> {
  // ── Primary: Jupiter Price API ───────────────────────────────────────────
  // Solana-native — works reliably in Phantom, Solflare, and all dapp browsers.
  // Single request returns both SOL and SKR prices in USD.
  try {
    const res = await fetch(
      `https://api.jup.ag/price/v2?ids=${SOL_MINT},${SKR_MINT}`,
    );
    if (res.ok) {
      const json = await res.json();
      const solUsd = parseFloat(json.data?.[SOL_MINT]?.price ?? '0');
      const skrUsd = parseFloat(json.data?.[SKR_MINT]?.price ?? '0');
      if (solUsd > 0) return { solUsd, skrUsd };
    }
  } catch { /* fall through to backup */ }

  // ── Fallback: Binance (SOL) + DexScreener (SKR) ──────────────────────────
  const [solResult, skrResult] = await Promise.allSettled([
    fetch('https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT').then(r => r.json()),
    fetch(`https://api.dexscreener.com/latest/dex/tokens/${SKR_MINT}`).then(r => r.json()),
  ]);

  const solUsd =
    solResult.status === 'fulfilled' ? parseFloat(solResult.value?.price ?? '0') : 0;

  let skrUsd = 0;
  if (skrResult.status === 'fulfilled') {
    const pairs = skrResult.value?.pairs;
    if (Array.isArray(pairs) && pairs.length > 0) {
      const sorted = [...pairs].sort(
        (a, b) => parseFloat(b.liquidity?.usd ?? '0') - parseFloat(a.liquidity?.usd ?? '0'),
      );
      skrUsd = parseFloat(sorted[0].priceUsd ?? '0');
    }
  }

  // Return as long as SOL price is available — SKR is optional
  return solUsd > 0 ? { solUsd, skrUsd } : null;
}

export function usePrices(): LivePrices {
  const [state, setState] = useState<LivePrices>({
    solUsd: 0,
    skrUsd: 0,
    currencyRates: LOADING_RATES,
    pricesReady: false,
  });

  useEffect(() => {
    let cancelled = false;

    const update = async () => {
      const result = await fetchLivePrices();
      if (cancelled) return;
      if (result) {
        const { solUsd, skrUsd } = result;
        setState({
          solUsd,
          skrUsd,
          // Ready once SOL price is known — USDC rate is derived from SOL alone
          pricesReady: true,
          currencyRates: {
            [Currency.SOL]:  1,
            [Currency.USDC]: solUsd,                               // always available with SOL price
            [Currency.SKR]:  skrUsd > 0 ? solUsd / skrUsd : 0,   // 0 means SKR price still unavailable
          },
        });
      }
      // If SOL price fetch failed entirely, keep loading state
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
