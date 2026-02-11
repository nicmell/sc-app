import {useState} from "react";
import {useOsc} from "./OscProvider";
import {createNodeSetMessage} from "../osc/oscService";

interface NodeValueRangeProps {
  nodeId: number;
  paramKey: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  format?: string;
}

function formatValue(template: string, value: number): string {
  return template.replace(/%(?:\.(\d+))?([df])/, (_, precision, type) => {
    if (type === 'f' && precision) {
      return value.toFixed(parseInt(precision));
    }
    if (type === 'd') {
      return Math.round(value).toString();
    }
    return String(value);
  });
}

export function NodeValueRange({nodeId, paramKey, label, min, max, step, defaultValue, format}: NodeValueRangeProps) {
  const {osc} = useOsc();
  const [value, setValue] = useState(defaultValue);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    osc.send(createNodeSetMessage(nodeId, {[paramKey]: val}));
    setValue(val);
  };

  const display = format ? formatValue(format, value) : String(value);

  return (
    <div className="range-control">
      <label>
        <span>{label}: {display}</span>
        <input type="range" min={min} max={max} step={step} value={value} onChange={handleChange}/>
      </label>
    </div>
  );
}
