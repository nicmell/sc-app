/// <reference types="vite/client" />

declare module '*.scsyndef?url' {
  const src: string;
  export default src;
}

import 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'sc-group': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
