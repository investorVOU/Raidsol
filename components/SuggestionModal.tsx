import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const BN:   React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '2px' };
const SG:   React.CSSProperties = { fontFamily: "'Space Grotesk', sans-serif" };
const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', 'Courier New', monospace" };

const CATEGORIES = ['Feature Request', 'Bug Report', 'UI / UX', 'Gameplay', 'Other'] as const;
type Category = typeof CATEGORIES[number];

interface SuggestionModalProps {
  walletAddress: string | null;
  onClose: () => void;
}

const SuggestionModal: React.FC<SuggestionModalProps> = ({ walletAddress, onClose }) => {
  const [category, setCategory] = useState<Category>('Feature Request');
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const canSubmit = text.trim().length >= 10 && status === 'idle';

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setStatus('submitting');
    try {
      const { error } = await supabase.from('suggestions').insert({
        wallet_address: walletAddress ?? null,
        category,
        suggestion_text: text.trim(),
      });
      if (error) throw error;
      setStatus('done');
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Submission failed. Please try again.');
      setStatus('error');
    }
  };

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)' }}
      onClick={handleBackdrop}
    >
      <div
        className="w-full max-w-md relative overflow-hidden"
        style={{ background: '#09090b', border: '1px solid rgba(255,255,255,0.10)' }}
      >
        {/* top accent */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: '#FF2929', boxShadow: '0 0 12px rgba(255,41,41,0.5)' }} />

        {/* header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between border-b border-white/[0.07]">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/30 mb-1" style={MONO}>
              // DROP YOUR IDEAS
            </p>
            <h2 style={{ ...BN, fontSize: '26px', color: '#fff', lineHeight: 1 }}>SUGGESTION BOX</h2>
            <p className="text-[12px] text-white/40 mt-1.5 leading-snug" style={SG}>
              We read every message. Help us build the raid you want.
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 ml-4 transition-colors"
            style={{ color: 'rgba(255,255,255,0.30)', fontSize: '20px', lineHeight: 1, touchAction: 'manipulation' }}
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* category chips */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/35 mb-2.5" style={MONO}>CATEGORY</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => {
                const active = category === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    style={{
                      touchAction: 'manipulation',
                      ...SG,
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '5px 12px',
                      border: active ? '1px solid #FF2929' : '1px solid rgba(255,255,255,0.12)',
                      background: active ? 'rgba(255,41,41,0.12)' : 'transparent',
                      color: active ? '#FF2929' : 'rgba(255,255,255,0.40)',
                      transition: 'all 0.15s',
                      cursor: 'pointer',
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* text input */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/35 mb-2.5" style={MONO}>YOUR SUGGESTION</p>
            <textarea
              value={text}
              onChange={e => {
                setText(e.target.value);
                if (status === 'error') setStatus('idle');
              }}
              placeholder="Tell us what would make this game better — features, fixes, vibes..."
              rows={5}
              maxLength={500}
              disabled={status === 'submitting' || status === 'done'}
              style={{
                ...SG,
                width: '100%',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: '#fff',
                fontSize: '13px',
                padding: '12px',
                resize: 'none',
                outline: 'none',
                lineHeight: 1.55,
              }}
            />
            <div className="flex justify-between items-center mt-1">
              {text.trim().length > 0 && text.trim().length < 10 ? (
                <p className="text-[10px] text-white/30 uppercase tracking-widest" style={MONO}>min 10 characters</p>
              ) : <span />}
              <p className="text-[10px] text-white/25 ml-auto" style={MONO}>{text.length}/500</p>
            </div>
          </div>

          {/* status messages */}
          {status === 'error' && (
            <p className="text-[12px]" style={{ ...SG, color: '#FF2929' }}>{errorMsg}</p>
          )}
          {status === 'done' && (
            <div className="py-3 text-center">
              <p className="text-[13px] font-black uppercase tracking-widest" style={{ ...MONO, color: '#FFB800' }}>
                RECEIVED — THANK YOU
              </p>
              <p className="text-[12px] text-white/40 mt-1" style={SG}>We read every suggestion.</p>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="px-6 pb-6">
          {status === 'done' ? (
            <button
              onClick={onClose}
              style={{
                touchAction: 'manipulation',
                ...BN,
                width: '100%',
                padding: '14px 0',
                fontSize: '18px',
                letterSpacing: '3px',
                background: '#FFB800',
                color: '#000',
                cursor: 'pointer',
              }}
            >
              CLOSE
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                touchAction: 'manipulation',
                ...BN,
                width: '100%',
                padding: '14px 0',
                fontSize: '18px',
                letterSpacing: '3px',
                background: canSubmit ? '#FF2929' : 'transparent',
                color: canSubmit ? '#fff' : 'rgba(255,255,255,0.15)',
                border: canSubmit ? 'none' : '1px solid rgba(255,255,255,0.07)',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
              }}
            >
              {status === 'submitting' ? 'SENDING...' : 'SUBMIT'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuggestionModal;
