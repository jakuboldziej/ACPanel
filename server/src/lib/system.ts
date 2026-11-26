import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
}

export async function run(cmd: string, args: string[], timeoutMs = 15000): Promise<RunResult> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 });
    return { ok: true, stdout, stderr, code: 0 };
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number | string };
    return {
      ok: false,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? err.message,
      code: typeof err.code === "number" ? err.code : null,
    };
  }
}
