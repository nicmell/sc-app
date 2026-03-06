import {ELEMENTS} from '@/constants/sc-elements';
import 'react';

export type ScElementTagNames = (typeof ELEMENTS)[keyof typeof ELEMENTS];

interface ScElementHTMLAttributes extends React.HTMLAttributes<HTMLElement> {
  name?: string;
}

type ScElementIntrinsicElements = {
  [K in ScElementTagNames]: React.DetailedHTMLProps<ScElementHTMLAttributes, HTMLElement>;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends ScElementIntrinsicElements {}
  }
}
