import type {BoxItem} from "@/types/stores";
import {toPixelStyle} from "./utils";

interface PlaceholderProps {
  item: BoxItem;
  containerWidth: number;
  cols: number;
  rowHeight: number;
  onClick: () => void;
}

export function Placeholder({item, containerWidth, cols, rowHeight, onClick}: PlaceholderProps) {
  return (
    <div
      className="add-box-placeholder"
      style={toPixelStyle(item, containerWidth, cols, rowHeight)}
      onClick={onClick}
    >
      +
    </div>
  );
}
