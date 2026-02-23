import {html, css, LitElement} from 'lit';

export class ScKnob extends LitElement {
  static properties = {
    onChange: {attribute: false},
    value: {type: Number},
    min: {type: Number},
    max: {type: Number},
    step: {type: Number},
    diameter: {type: Number},
    src: {type: String},
    sprites: {type: Number},
    fgcolor: {type: String},
    bgcolor: {type: String},
  };

  declare onChange: (v: number) => void;
  declare value: number;
  declare min: number;
  declare max: number;
  declare step: number;
  declare diameter: number;
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
    const range = this.max - this.min;
    const sensitivity = this.diameter * 1.5;

    const onMove = (me: MouseEvent | TouchEvent) => {
      me.preventDefault();
      const mev = 'touches' in me ? me.touches[0] : me;
      const dx = mev.clientX - startX;
      const dy = startY - mev.clientY;
      const d = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      let dv = (d / sensitivity) * range;
      if (me instanceof MouseEvent && me.shiftKey) dv *= 0.2;
      this._commit(startValue + dv);
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
    this._commit(this.value + delta);
  };

  private _commit(v: number) {
    v = Math.round((v - this.min) / this.step) * this.step + this.min;
    v = Math.max(this.min, Math.min(this.max, v));
    this.onChange(v);
  }

  render() {
    const ratio = (this.value - this.min) / (this.max - this.min);

    if (this.src && this.sprites >= 1) {
      const frame = Math.round(ratio * this.sprites);
      return html`<img
        width=${this.diameter}
        height=${this.diameter}
        style="object-fit: none; object-position: 0px ${-frame * this.diameter}px;"
        src=${this.src}
        alt=""
      />`;
    }

    const d = this.diameter;
    const r = d / 2;
    const angle = -135 + 270 * ratio;
    return html`
      <svg width=${d} height=${d} viewBox="0 0 ${d} ${d}">
        <circle cx=${r} cy=${r} r=${r * 0.94} fill=${this.bgcolor} />
        <line
          x1=${r} y1=${r * 0.88} x2=${r} y2=${r * 0.22}
          stroke=${this.fgcolor} stroke-width=${r * 0.19}
          stroke-linecap="round"
          transform="rotate(${angle} ${r} ${r})"
        />
      </svg>
    `;
  }
}

customElements.define('sc-knob', ScKnob);
