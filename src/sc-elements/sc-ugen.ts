import {LitElement, html, css} from 'lit';

export class ScUGen extends LitElement {
  static properties = {
    type: {type: String},
    rate: {type: String},
  };

  declare type: string;
  declare rate: string;

  static styles = css`:host { display: contents; }`;

  constructor() {
    super();
    this.type = '';
    this.rate = 'ar';
  }

  render() {
    return html`<slot></slot>`;
  }
}
