/// <reference types="vite/client" />

import type { ThreeElements } from '@react-three/fiber';

declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

declare global {
  interface Window {
    Jupiter?: {
      init: (config: any) => void;
    };
    __jupSwapInited?: boolean;
  }
}
