import {LitElement, html, svg, css} from 'lit';

export class ScSwitch extends LitElement {
  static properties = {
    onChange: {attribute: false},
    checked: {type: Boolean, reflect: true},
    width: {type: Number, attribute: 'width'},
    height: {type: Number, attribute: 'height'},
    src: {type: String},
    fgcolor: {type: String},
    bgcolor: {type: String},
  };

  declare onChange: (checked: boolean) => void;
  declare checked: boolean;
  declare width: number;
  declare height: number;
  declare src: string;
  declare fgcolor: string;
  declare bgcolor: string;

  static styles = css`
    :host { display: inline-block; cursor: pointer; user-select: none; }
    svg { display: block; pointer-events: none; }
    img { display: block; pointer-events: none; }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('click', this._onClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('click', this._onClick);
  }

  private _onClick = () => {
    this.onChange(!this.checked);
  };

  render() {
    const w = this.width;
    const h = this.height;
    const minDim = Math.min(w, h);
    const r = minDim * 0.25;

    if (this.src) {
      const yOff = this.checked ? -h : 0;
      return html`<img
        width=${w}
        height=${h}
        style="object-fit: none; object-position: 0px ${yOff}px;"
        src=${this.src}
        alt=""
      />`;
    }

    return html`
      <svg width=${w} height=${h} viewBox="0 0 ${w} ${h}">
        <rect x="1" y="1" width=${w - 2} height=${h - 2} rx=${r} ry=${r} fill=${this.bgcolor} />
        ${this.checked
          ? svg`<circle cx=${w * 0.5} cy=${h * 0.5} r=${r} fill=${this.fgcolor} />`
          : ''}
      </svg>
    `;
  }
}

customElements.define('sc-switch', ScSwitch);
