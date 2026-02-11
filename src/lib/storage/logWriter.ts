import {writeTextFile, mkdir, exists} from "@tauri-apps/plugin-fs";
import {BaseDirectory} from "@tauri-apps/api/path";

const DIR = "logs";
const FILE = "logs/sc-app.log";
const baseDir = BaseDirectory.AppData;

let dirCreated = false;

async function ensureDir() {
  if (dirCreated) return;
  const dirExists = await exists(DIR, {baseDir});
  if (!dirExists) {
    await mkdir(DIR, {baseDir, recursive: true});
  }
  dirCreated = true;
}

export async function appendLogLine(line: string): Promise<void> {
  try {
    await ensureDir();
    await writeTextFile(FILE, line + "\n", {baseDir, append: true});
  } catch {
    // logging must never crash the app
  }
}
