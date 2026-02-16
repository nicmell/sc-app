import {html, css} from 'lit';
import {ScRange} from './sc-range.ts';

export class ScSlider extends ScRange {
  static properties = {
    ...ScRange.properties,
    width: {type: Number, attribute: 'width'},
    height: {type: Number, attribute: 'height'},
    src: {type: String},
    sprites: {type: Number},
    fgcolor: {type: String},
    bgcolor: {type: String},
  };

  declare width: number;
  declare height: number;
  declare src: string;
  declare sprites: number;
  declare fgcolor: string;
  declare bgcolor: string;

  static styles = css`
    :host { display: inline-block; cursor: grab; touch-action: none; user-select: none; }
    :host(:active) { cursor: grabbing; }
    svg { display: block; pointer-events: none; }
    img { display: block; pointer-events: none; }
  `;

  constructor() {
    super();
    this.width = 128;
    this.height = 20;
    this.src = '';
    this.sprites = 0;
    this.fgcolor = 'var(--color-primary, #0a6dc4)';
    this.bgcolor = 'var(--color-bg-secondary, #e8e8e8)';
  }

  private _isVertical(): boolean {
    return this.height > this.width;
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('mousedown', this._onPointerDown);
    this.addEventListener('touchstart', this._onPointerDown, {passive: false});
    this.addEventListener('wheel', this._onWheel, {passive: false});
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('mousedown', this._onPointerDown);
    this.removeEventListener('touchstart', this._onPointerDown);
    this.removeEventListener('wheel', this._onWheel);
  }

  private _onPointerDown = (e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    const ev = 'touches' in e ? e.touches[0] : e;
    const startX = ev.clientX;
    const startY = ev.clientY;
    const startValue = this.value;
    const vertical = this._isVertical();
    const sensitivity = vertical ? this.height - this.width : this.width - this.height;

    const onMove = (me: MouseEvent | TouchEvent) => {
      me.preventDefault();
      const mev = 'touches' in me ? me.touches[0] : me;
      const dx = mev.clientX - startX;
      const dy = startY - mev.clientY;
      const d = vertical ? dy : dx;
      let dv = (d / sensitivity) * (this.max - this.min);
      if (me instanceof MouseEvent && me.shiftKey) dv *= 0.2;
      this._setValue(startValue + dv);
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      document.removeEventListener('touchcancel', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, {passive: false});
    document.addEventListener('touchend', onUp);
    document.addEventListener('touchcancel', onUp);
  };

  private _onWheel = (e: WheelEvent) => {
    e.preventDefault();
    let delta = e.deltaY > 0 ? -this.step : this.step;
    if (!e.shiftKey) delta *= 5;
    this._setValue(this.value + delta);
  };

  render() {
    const w = this.width;
    const h = this.height;
    const ratio = this._ratio();

    if (this.src && this.sprites >= 1) {
      const frame = Math.round(ratio * this.sprites);
      return html`<img
        width=${w}
        height=${h}
        style="object-fit: none; object-position: 0px ${-frame * h}px;"
        src=${this.src}
        alt=""
      />`;
    }

    if (this._isVertical()) {
      const r = w / 2;
      const trackH = h - w;
      const cy = h - r - trackH * ratio;
      return html`
        <svg width=${w} height=${h} viewBox="0 0 ${w} ${h}">
          <rect x="0" y="0" width=${w} height=${h} rx=${r} ry=${r} fill=${this.bgcolor} />
          <circle cx=${r} cy=${cy} r=${r * 0.9} fill=${this.fgcolor} />
        </svg>
      `;
    }

    const r = h / 2;
    const trackW = w - h;
    const cx = r + trackW * ratio;
    return html`
      <svg width=${w} height=${h} viewBox="0 0 ${w} ${h}">
        <rect x="0" y="0" width=${w} height=${h} rx=${r} ry=${r} fill=${this.bgcolor} />
        <circle cx=${cx} cy=${r} r=${r * 0.9} fill=${this.fgcolor} />
      </svg>
    `;
  }
}
