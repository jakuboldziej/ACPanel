import readline from "node:readline";
import { Writable } from "node:stream";
import { hashPassword } from "../src/lib/password.js";

let muted = false;
const output = new Writable({
  write(chunk, _enc, cb) {
    if (!muted) process.stdout.write(chunk);
    cb();
  },
});
const rl = readline.createInterface({ input: process.stdin, output, terminal: process.stdin.isTTY });
const lines = rl[Symbol.asyncIterator]();

async function ask(question: string): Promise<string> {
  process.stdout.write(question);
  muted = true;
  const { value } = await lines.next();
  muted = false;
  process.stdout.write("\n");
  return (value as string | undefined) ?? "";
}

function fail(message: string): never {
  console.error(message);
  rl.close();
  process.exit(1);
}

const password = await ask("New admin password: ");
if (password.length < 10) fail("Password must be at least 10 characters");
if ((await ask("Repeat password: ")) !== password) fail("Passwords do not match");
rl.close();

console.log("\nPut this line in .env (single quotes are required because of the $ signs):\n");
console.log(`ADMIN_PASSWORD_HASH='${await hashPassword(password)}'`);
