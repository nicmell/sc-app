import type {BoxItem, LayoutOptions} from "@/types/stores";

export const DEFAULT_LAYOUT: BoxItem[] = [
    {i: "box-1", x: 0, y: 0, w: 6, h: 3},
    {i: "box-2", x: 6, y: 0, w: 6, h: 3},
    {i: "box-3", x: 0, y: 3, w: 12, h: 4},
];

export const DEFAULT_OPTIONS: LayoutOptions = {
    numRows: 8,
    numColumns: 12,
};
