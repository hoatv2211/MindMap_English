import { createHash } from "node:crypto";
import path from "node:path";
import AdmZip from "adm-zip";

export interface ParsedSection { heading: string; content: string; sortOrder: number; fingerprint: string }

function fingerprint(content: string): string {
  return createHash("sha256").update(content.normalize("NFKC")).digest("hex");
}

export function parseDocument(format: "txt" | "md", source: string): ParsedSection[] {
  const normalized = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (format === "txt") return [{ heading: "", content: normalized, sortOrder: 0, fingerprint: fingerprint(normalized) }];
  const sections: Array<{ heading: string; lines: string[] }> = [];
  let current = { heading: "", lines: [] as string[] };
  for (const line of normalized.split("\n")) {
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      if (current.lines.some((item) => item.trim()) || current.heading) sections.push(current);
      current = { heading: heading[1].trim(), lines: [] };
    } else current.lines.push(line);
  }
  if (current.lines.some((item) => item.trim()) || current.heading || sections.length === 0) sections.push(current);
  return sections.map((section, sortOrder) => {
    const content = section.lines.join("\n").trim();
    return { heading: section.heading, content, sortOrder, fingerprint: fingerprint(`${section.heading}\n${content}`) };
  });
}

function attribute(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`${name}=["']([^"']+)["']`, "i"))?.[1];
}

function htmlToText(html: string): { heading: string; content: string } {
  const heading = html.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1] ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const decode = (value: string) => value.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/p>|<\/div>|<\/h[1-6]>/gi, "\n\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, "\"").replace(/&#39;/gi, "'").replace(/\n{3,}/g, "\n\n").trim();
  return { heading: decode(heading), content: decode(html) };
}

export function parseEpub(buffer: Buffer, maxExpandedBytes = 20 * 1024 * 1024): ParsedSection[] {
  const zip = new AdmZip(buffer);
  let expandedBytes = 0;
  const entries = new Map<string, Buffer>();
  for (const entry of zip.getEntries()) {
    const entryName = entry.entryName.replace(/\\/g, "/");
    if (entryName.startsWith("/") || entryName.split("/").includes("..")) throw new Error("Unsafe EPUB archive entry");
    if (entry.isDirectory) continue;
    const data = entry.getData();
    expandedBytes += data.length;
    if (expandedBytes > maxExpandedBytes) throw new Error("EPUB expanded content is too large");
    entries.set(entryName, data);
  }
  const container = entries.get("META-INF/container.xml")?.toString("utf8");
  const opfPath = container?.match(/full-path=["']([^"']+)["']/i)?.[1];
  if (!opfPath) throw new Error("EPUB container is missing package metadata");
  const opf = entries.get(opfPath)?.toString("utf8");
  if (!opf) throw new Error("EPUB package file is missing");
  const manifest = new Map<string, string>();
  for (const tag of opf.match(/<item\b[^>]*>/gi) ?? []) {
    const id = attribute(tag, "id");
    const href = attribute(tag, "href");
    if (id && href) manifest.set(id, href);
  }
  const spineIds = (opf.match(/<itemref\b[^>]*>/gi) ?? []).map((tag) => attribute(tag, "idref")).filter((id): id is string => Boolean(id));
  const base = path.posix.dirname(opfPath);
  return spineIds.map((id, sortOrder) => {
    const href = manifest.get(id);
    if (!href) throw new Error(`EPUB spine item ${id} is missing`);
    const entryPath = path.posix.normalize(path.posix.join(base, decodeURIComponent(href.split("#")[0])));
    if (entryPath.split("/").includes("..")) throw new Error("Unsafe EPUB chapter path");
    const html = entries.get(entryPath)?.toString("utf8");
    if (!html) throw new Error(`EPUB chapter ${entryPath} is missing`);
    const parsed = htmlToText(html);
    return { heading: parsed.heading || `Chapter ${sortOrder + 1}`, content: parsed.content, sortOrder, fingerprint: fingerprint(`${parsed.heading}\n${parsed.content}`) };
  });
}
