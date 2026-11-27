import net from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rconExec } from "../src/core/rcon.js";

function packet(id: number, type: number, body: string): Buffer {
  const payload = Buffer.from(body, "utf8");
  const buf = Buffer.alloc(14 + payload.length);
  buf.writeInt32LE(10 + payload.length, 0);
  buf.writeInt32LE(id, 4);
  buf.writeInt32LE(type, 8);
  payload.copy(buf, 12);
  return buf;
}

let server: net.Server;
let port = 0;
const received: string[] = [];

beforeAll(async () => {
  server = net.createServer((socket) => {
    let buf = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 4 && buf.length >= buf.readInt32LE(0) + 4) {
        const size = buf.readInt32LE(0);
        const id = buf.readInt32LE(4);
        const type = buf.readInt32LE(8);
        const body = buf.subarray(12, size + 2).toString("utf8").replace(/\0+$/, "");
        buf = buf.subarray(size + 4);
        if (type === 3) {
          socket.write(packet(id, 0, ""));
          socket.write(packet(body === "secret" ? id : -1, 2, ""));
        } else if (type === 2) {
          received.push(body);
          if (body === "multi") {
            socket.write(packet(id, 0, "part one, "));
            setTimeout(() => socket.write(packet(id, 0, "part two")), 50);
          } else if (body === "close") {
            socket.destroy();
          } else if (body !== "silent") {
            socket.write(packet(id, 0, `ok: ${body}`));
          }
        }
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as net.AddressInfo).port;
});

afterAll(() => server.close());

describe("RCON client", () => {
  it("authenticates and runs commands in order", async () => {
    const out = await rconExec({ host: "127.0.0.1", port, password: "secret" }, ["say hi", "next_session"]);
    expect(out).toEqual(["ok: say hi", "ok: next_session"]);
  });

  it("joins multi-packet responses and tolerates silent commands", async () => {
    const out = await rconExec({ host: "127.0.0.1", port, password: "secret" }, ["multi", "silent"]);
    expect(out).toEqual(["part one, part two", ""]);
  });

  it("rejects a wrong password", async () => {
    await expect(rconExec({ host: "127.0.0.1", port, password: "nope" }, ["say x"])).rejects.toThrow(/authentication failed/);
  });

  it("rejects commands with line breaks", async () => {
    await expect(rconExec({ host: "127.0.0.1", port, password: "secret" }, ["say a\nkick 1"])).rejects.toThrow(/Invalid RCON command/);
    expect(received).not.toContain("say a\nkick 1");
  });

  it("reports connection errors and closed connections", async () => {
    await expect(rconExec({ host: "127.0.0.1", port: 1, password: "secret" }, ["say x"])).rejects.toThrow(/Cannot connect/);
    await expect(rconExec({ host: "127.0.0.1", port, password: "secret" }, ["close"])).rejects.toThrow(/closed/);
  });
});
