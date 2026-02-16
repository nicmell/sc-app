import 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'sc-display': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'sc-group': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'sc-if': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'sc-knob': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'sc-range': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'sc-slider': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'sc-switch': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'sc-synth': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'sc-toggle': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
