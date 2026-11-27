import { spawn } from "node:child_process";
import { Router } from "express";
import { z } from "zod";
import { withLock } from "../../core/lock.js";
import { getStatus, logUnit, readLogs, restartService } from "./service.js";

export const serverRouter = Router();

serverRouter.get("/status", async (_req, res) => {
  res.json(await getStatus());
});

serverRouter.post("/restart", async (_req, res) => {
  res.json(await withLock(() => restartService()));
});

serverRouter.get("/logs", async (req, res) => {
  const { lines } = z.object({ lines: z.coerce.number().int().min(1).max(5000).default(300) }).parse(req.query);
  res.json({ lines: await readLogs(lines) });
});

serverRouter.get("/logs/stream", (req, res) => {
  const unit = logUnit();
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  const child = spawn("journalctl", ["-u", unit, "-f", "-n", "0", "-o", "cat", "--no-pager"]);
  let buffer = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    for (const line of parts) if (line) res.write(`data: ${JSON.stringify(line)}\n\n`);
  });
  child.on("close", () => res.end());

  const ping = setInterval(() => res.write(": ping\n\n"), 25000);
  req.on("close", () => {
    clearInterval(ping);
    child.kill();
  });
});
