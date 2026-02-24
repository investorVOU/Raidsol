
import { useState, useEffect } from 'react';
import { Currency } from '../types';

const SKR_MINT = import.meta.env.VITE_SKR_MINT ?? 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3';

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
  const [solResult, skrResult] = await Promise.allSettled([
    // Binance public ticker — no CORS restriction, no API key, no rate limits for browsers
    fetch('https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT')
      .then(r => r.json()),
    fetch(`https://api.dexscreener.com/latest/dex/tokens/${SKR_MINT}`)
      .then(r => r.json()),
  ]);

  const solUsd =
    solResult.status === 'fulfilled' ? parseFloat(solResult.value?.price ?? '0') : 0;

  let skrUsd = 0;
  if (skrResult.status === 'fulfilled') {
    const pairs = skrResult.value?.pairs;
    if (Array.isArray(pairs) && pairs.length > 0) {
      // Sort by liquidity descending, pick most liquid pair
      const sorted = [...pairs].sort(
        (a, b) => parseFloat(b.liquidity?.usd ?? '0') - parseFloat(a.liquidity?.usd ?? '0'),
      );
      skrUsd = parseFloat(sorted[0].priceUsd ?? '0');
    }
  }

  return solUsd > 0 && skrUsd > 0 ? { solUsd, skrUsd } : null;
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
          pricesReady: true,
          currencyRates: {
            [Currency.SOL]:  1,
            [Currency.USDC]: solUsd,
            [Currency.SKR]:  solUsd / skrUsd,
          },
        });
      }
      // If fetch failed, keep loading state (don't overwrite with wrong rates)
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
