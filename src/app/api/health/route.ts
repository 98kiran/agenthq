import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { readFile } from "fs/promises";

export const dynamic = "force-dynamic";

const execAsync = promisify(exec);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function readCpuTimes() {
  const stat = await readFile("/proc/stat", "utf8");
  const cpuLine = stat.split("\n").find((l) => l.startsWith("cpu "));
  if (!cpuLine) throw new Error("no cpu line");
  const parts = cpuLine.trim().split(/\s+/).slice(1).map(Number);
  const idle = (parts[3] || 0) + (parts[4] || 0);
  const total = parts.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
  return { idle, total };
}

async function getCpuPercent() {
  const a = await readCpuTimes();
  await sleep(200);
  const b = await readCpuTimes();
  const td = b.total - a.total, id = b.idle - a.idle;
  return td <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((1 - id / td) * 100)));
}

export async function GET() {
  const [diskR, memR, uptR, cpuR] = await Promise.allSettled([
    execAsync("df -h / | tail -1 | awk '{print $2, $3, $4, $5}'"),
    execAsync("free -m | grep Mem | awk '{print $2, $3, $4}'"),
    execAsync("uptime -p 2>/dev/null || uptime"),
    getCpuPercent(),
  ]);

  let disk = { total: "?", used: "?", free: "?", percent: "?" };
  if (diskR.status === "fulfilled") {
    const p = diskR.value.stdout.trim().split(" ");
    disk = { total: p[0] || "?", used: p[1] || "?", free: p[2] || "?", percent: p[3] || "?" };
  }

  let ram = { total: 0, used: 0, free: 0, percent: 0 };
  if (memR.status === "fulfilled") {
    const p = memR.value.stdout.trim().split(" ").map(Number);
    const t = p[0] || 1, u = p[1] || 0;
    ram = { total: t, used: u, free: p[2] || 0, percent: Math.round(u / t * 100) };
  }

  let uptime = "unknown";
  if (uptR.status === "fulfilled") uptime = uptR.value.stdout.trim().replace(/^up\s*/i, "");

  let cpu = { percent: 0 };
  if (cpuR.status === "fulfilled") cpu = { percent: cpuR.value };

  return NextResponse.json(
    { disk, ram, cpu, uptime, timestamp: Date.now() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
