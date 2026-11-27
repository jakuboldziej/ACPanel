export type IniEntries = [key: string, value: string][];

interface SectionRange {
  name: string;
  header: number;
  end: number;
}

const HEADER = /^\s*\[([^\]]+)\]\s*$/;

export class IniDoc {
  private constructor(
    private lines: string[],
    private readonly eol: string,
  ) {}

  static parse(text: string): IniDoc {
    return new IniDoc(text.split(/\r?\n/), text.includes("\r\n") ? "\r\n" : "\n");
  }

  toString(): string {
    return this.lines.join(this.eol);
  }

  private ranges(): SectionRange[] {
    const out: SectionRange[] = [];
    this.lines.forEach((line, i) => {
      const m = HEADER.exec(line);
      if (!m) return;
      if (out.length) out[out.length - 1]!.end = i;
      out.push({ name: m[1]!.trim().toUpperCase(), header: i, end: this.lines.length });
    });
    return out;
  }

  private range(section: string): SectionRange | undefined {
    const name = section.toUpperCase();
    return this.ranges().find((r) => r.name === name);
  }

  sections(): string[] {
    return this.ranges().map((r) => r.name);
  }

  has(section: string): boolean {
    return this.range(section) !== undefined;
  }

  get(section: string, key: string): string | null {
    const r = this.range(section);
    if (!r) return null;
    const k = key.toUpperCase();
    for (let i = r.header + 1; i < r.end; i++) {
      const line = this.lines[i]!.trim();
      if (line.startsWith(";") || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq > 0 && line.slice(0, eq).trim().toUpperCase() === k) return line.slice(eq + 1).trim();
    }
    return null;
  }

  entries(section: string): IniEntries {
    const r = this.range(section);
    if (!r) return [];
    const out: IniEntries = [];
    for (let i = r.header + 1; i < r.end; i++) {
      const line = this.lines[i]!.trim();
      if (!line || line.startsWith(";") || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq > 0) out.push([line.slice(0, eq).trim().toUpperCase(), line.slice(eq + 1).trim()]);
    }
    return out;
  }

  private contentEnd(r: SectionRange): number {
    let last = r.header;
    for (let i = r.header + 1; i < r.end; i++) {
      const line = this.lines[i]!.trim();
      if (line && !line.startsWith(";") && !line.startsWith("#")) last = i;
    }
    return last + 1;
  }

  set(section: string, key: string, value: string): void {
    const k = key.toUpperCase();
    let r = this.range(section);
    if (!r) {
      this.addSection(section, []);
      r = this.range(section)!;
    }
    for (let i = r.header + 1; i < r.end; i++) {
      const line = this.lines[i]!.trim();
      if (line.startsWith(";") || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq > 0 && line.slice(0, eq).trim().toUpperCase() === k) {
        this.lines[i] = `${k}=${value}`;
        return;
      }
    }
    this.lines.splice(this.contentEnd(r), 0, `${k}=${value}`);
  }

  delete(section: string, key: string): void {
    const r = this.range(section);
    if (!r) return;
    const k = key.toUpperCase();
    for (let i = r.end - 1; i > r.header; i--) {
      const line = this.lines[i]!.trim();
      const eq = line.indexOf("=");
      if (!line.startsWith(";") && eq > 0 && line.slice(0, eq).trim().toUpperCase() === k) this.lines.splice(i, 1);
    }
  }

  removeSection(section: string): void {
    const r = this.range(section);
    if (!r) return;
    this.lines.splice(r.header, this.contentEnd(r) - r.header);
    const at = r.header;
    while (at < this.lines.length && this.lines[at]!.trim() === "" && (at === 0 || this.lines[at - 1]!.trim() === "")) {
      this.lines.splice(at, 1);
    }
  }

  addSection(section: string, entries: IniEntries, before?: string[]): void {
    if (this.has(section)) throw new Error(`Section [${section}] already exists`);
    const block = [`[${section.toUpperCase()}]`, ...entries.map(([k, v]) => `${k.toUpperCase()}=${v}`), ""];
    const target = before
      ?.map((b) => this.range(b))
      .filter((r): r is SectionRange => r !== undefined)
      .sort((a, b) => a.header - b.header)[0];
    if (target) {
      this.lines.splice(target.header, 0, ...block);
      return;
    }
    let at = this.lines.length;
    while (at > 0 && this.lines[at - 1]!.trim() === "") at--;
    const needsGap = at > 0;
    this.lines.splice(at, this.lines.length - at, ...(needsGap ? ["", ...block] : block));
  }

  firstHeaderIndex(prefix: string): number {
    const p = prefix.toUpperCase();
    return this.ranges().find((r) => r.name.startsWith(p))?.header ?? -1;
  }

  insertSectionsAt(index: number, sections: { name: string; entries: IniEntries }[]): void {
    const block = sections.flatMap((s) => [
      `[${s.name.toUpperCase()}]`,
      ...s.entries.map(([k, v]) => `${k.toUpperCase()}=${v}`),
      "",
    ]);
    this.lines.splice(index, 0, ...block);
  }
}
