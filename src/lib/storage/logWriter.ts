import {IS_TAURI} from "@/lib/env";

const DIR = "logs";
const FILE = "logs/sc-app.log";

let dirCreated = false;

async function ensureDir() {
  if (dirCreated) return;
  const {exists, mkdir} = await import("@tauri-apps/plugin-fs");
  const {BaseDirectory} = await import("@tauri-apps/api/path");
  const baseDir = BaseDirectory.AppData;
  const dirExists = await exists(DIR, {baseDir});
  if (!dirExists) {
    await mkdir(DIR, {baseDir, recursive: true});
  }
  dirCreated = true;
}

export async function appendLogLine(line: string): Promise<void> {
  if (!IS_TAURI) return;
  try {
    await ensureDir();
    const {writeTextFile} = await import("@tauri-apps/plugin-fs");
    const {BaseDirectory} = await import("@tauri-apps/api/path");
    await writeTextFile(FILE, line + "\n", {baseDir: BaseDirectory.AppData, append: true});
  } catch {
    // logging must never crash the app
  }
}
