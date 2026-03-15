export interface RuntimeEntry {
  id: string;
  type: "control" | "run";
  targetNode: string;
  boxId: string;
  value: number;
}
