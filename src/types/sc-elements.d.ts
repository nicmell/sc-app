import {ELEMENTS} from '@/constants/sc-elements';
import 'react';

export type ScElementTagNames = (typeof ELEMENTS)[keyof typeof ELEMENTS];

type ScElementIntrinsicElements = {
  [K in ScElementTagNames]: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends ScElementIntrinsicElements {}
  }
}
