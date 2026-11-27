import net from "node:net";
import { HttpError } from "./fsutil.js";

const TYPE_AUTH = 3;
const TYPE_EXEC = 2;
const TYPE_AUTH_RESPONSE = 2;
const TYPE_RESPONSE = 0;

export interface RconTarget {
  host: string;
  port: number;
  password: string;
}

interface Packet {
  id: number;
  type: number;
  body: string;
}

function encode(id: number, type: number, body: string): Buffer {
  const payload = Buffer.from(body, "utf8");
  const buf = Buffer.alloc(14 + payload.length);
  buf.writeInt32LE(10 + payload.length, 0);
  buf.writeInt32LE(id, 4);
  buf.writeInt32LE(type, 8);
  payload.copy(buf, 12);
  return buf;
}

class PacketReader {
  private buffer = Buffer.alloc(0);

  push(chunk: Buffer): Packet[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const out: Packet[] = [];
    while (this.buffer.length >= 4) {
      const size = this.buffer.readInt32LE(0);
      if (size < 10 || size > 1_000_000) throw new Error("Invalid RCON packet");
      if (this.buffer.length < size + 4) break;
      out.push({
        id: this.buffer.readInt32LE(4),
        type: this.buffer.readInt32LE(8),
        body: this.buffer.subarray(12, size + 2).toString("utf8").replace(/\0+$/, ""),
      });
      this.buffer = this.buffer.subarray(size + 4);
    }
    return out;
  }
}

export class RconConnection {
  private reader = new PacketReader();
  private waiters: ((p: Packet) => void)[] = [];
  private nextId = 1;
  private closed: Error | null = null;

  private constructor(private socket: net.Socket) {
    socket.on("data", (chunk) => {
      try {
        for (const p of this.reader.push(chunk)) this.waiters.forEach((w) => w(p));
      } catch (e) {
        socket.destroy(e as Error);
      }
    });
    socket.on("close", () => {
      this.closed ??= new Error("RCON connection closed");
    });
  }

  static async open(target: RconTarget, timeoutMs = 5000): Promise<RconConnection> {
    const socket = await new Promise<net.Socket>((resolve, reject) => {
      const s = net.connect({ host: target.host, port: target.port });
      const timer = setTimeout(() => s.destroy(new Error("RCON connection timed out")), timeoutMs);
      s.once("connect", () => {
        clearTimeout(timer);
        resolve(s);
      });
      s.once("error", (e) => {
        clearTimeout(timer);
        reject(new HttpError(502, `Cannot connect to RCON on port ${target.port}: ${e.message}`));
      });
    });
    socket.setNoDelay(true);
    const conn = new RconConnection(socket);
    try {
      await conn.authenticate(target.password, timeoutMs);
    } catch (e) {
      conn.close();
      throw e;
    }
    return conn;
  }

  private collect(filter: (p: Packet) => boolean, done: (packets: Packet[]) => boolean, idleMs: number, timeoutMs: number) {
    return new Promise<Packet[]>((resolve, reject) => {
      const packets: Packet[] = [];
      let idle: NodeJS.Timeout | undefined;
      const finish = (err?: Error) => {
        clearTimeout(total);
        clearTimeout(idle);
        this.waiters = this.waiters.filter((w) => w !== onPacket);
        this.socket.off("close", onClose);
        if (err) reject(err);
        else resolve(packets);
      };
      const onPacket = (p: Packet) => {
        if (!filter(p)) return;
        packets.push(p);
        if (done(packets)) return finish();
        clearTimeout(idle);
        idle = setTimeout(() => finish(), idleMs);
      };
      const onClose = () => finish(this.closed ?? new Error("RCON connection closed"));
      const total = setTimeout(() => finish(packets.length ? undefined : new HttpError(504, "RCON did not respond")), timeoutMs);
      this.waiters.push(onPacket);
      this.socket.once("close", onClose);
    });
  }

  private async authenticate(password: string, timeoutMs: number): Promise<void> {
    const id = this.nextId++;
    const result = this.collect(
      (p) => p.type === TYPE_AUTH_RESPONSE,
      () => true,
      0,
      timeoutMs,
    );
    this.socket.write(encode(id, TYPE_AUTH, password));
    const [reply] = await result;
    if (!reply || reply.id === -1 || reply.id !== id) throw new HttpError(502, "RCON authentication failed (check ADMIN_PASSWORD)");
  }

  async exec(command: string, timeoutMs = 5000): Promise<string> {
    if (/[\r\n\0]/.test(command)) throw new HttpError(400, "Invalid RCON command");
    const id = this.nextId++;
    const result = this.collect(
      (p) => p.id === id && p.type === TYPE_RESPONSE,
      () => false,
      250,
      timeoutMs,
    ).catch((e: Error) => {
      if (e instanceof HttpError && e.status === 504) return [] as Packet[];
      throw e;
    });
    this.socket.write(encode(id, TYPE_EXEC, command));
    return (await result).map((p) => p.body).join("").trim();
  }

  close(): void {
    this.socket.end();
    this.socket.destroy();
  }
}

export async function rconExec(target: RconTarget, commands: string[]): Promise<string[]> {
  const conn = await RconConnection.open(target);
  try {
    const out: string[] = [];
    for (const c of commands) out.push(await conn.exec(c));
    return out;
  } finally {
    conn.close();
  }
}
