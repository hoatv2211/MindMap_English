import { z, type ZodType } from "zod";
import type { AppConfig } from "../../config";

export class NineRouterError extends Error {
  constructor(message: string, readonly code: "OFFLINE" | "CONFIG" | "INVALID_RESPONSE" | "UPSTREAM", readonly status = 503) {
    super(message);
    this.name = "NineRouterError";
  }
}

const ChatResponseSchema = z.object({ choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1) });
const ImageResponseSchema = z.object({ data: z.array(z.object({ url: z.string().url().optional(), b64_json: z.string().optional() })).min(1) });
const TranscriptionSchema = z.object({ text: z.string() });

export interface ChatMessage { role: "system" | "user" | "assistant"; content: string; }

export class NineRouterClient {
  constructor(private readonly config: AppConfig["nineRouter"], private readonly fetchImpl: typeof fetch = fetch) {}

  getChatModel(): string { return this.config.chatModel; }

  private headers(json = true): Record<string, string> {
    return {
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(this.config.key ? { Authorization: `Bearer ${this.config.key}` } : {}),
    };
  }

  private async request(path: string, init: RequestInit, timeoutMs = 30_000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.config.url}${path}`, { ...init, signal: controller.signal });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new NineRouterError(`9Router ${response.status}: ${detail.slice(0, 240)}`, "UPSTREAM", response.status);
      }
      return response;
    } catch (error) {
      if (error instanceof NineRouterError) throw error;
      throw new NineRouterError(error instanceof Error ? error.message : "9Router unavailable", "OFFLINE");
    } finally { clearTimeout(timer); }
  }

  async health(): Promise<boolean> {
    try { await this.request("/api/health", { method: "GET", headers: this.headers(false) }, 2_500); return true; }
    catch { return false; }
  }

  private async chatCompletion(messages: ChatMessage[], structured: boolean, timeoutMs: number): Promise<string> {
    if (!this.config.chatModel) throw new NineRouterError("Chat model is not configured", "CONFIG", 400);
    const response = await this.request("/v1/chat/completions", {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: this.config.chatModel,
        messages,
        stream: false,
        ...(structured ? { response_format: { type: "json_object" } } : {}),
        temperature: 0.3,
      }),
    }, timeoutMs);
    const responseText = await response.text();
    let responseJson: unknown;
    try { responseJson = JSON.parse(responseText); }
    catch { throw new NineRouterError("9Router returned a non-JSON chat response", "INVALID_RESPONSE", 502); }
    const parsed = ChatResponseSchema.safeParse(responseJson);
    if (!parsed.success) throw new NineRouterError("9Router returned an invalid chat response shape", "INVALID_RESPONSE", 502);
    return parsed.data.choices[0].message.content.trim();
  }

  async chatText(messages: ChatMessage[]): Promise<string> {
    return this.chatCompletion(messages, false, 30_000);
  }

  async chatJson<T>(schema: ZodType<T>, messages: ChatMessage[]): Promise<T> {
    const raw = (await this.chatCompletion(messages, true, 120_000)).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    try { return schema.parse(JSON.parse(raw)); }
    catch { throw new NineRouterError("9Router returned invalid structured JSON", "INVALID_RESPONSE", 502); }
  }

  async generateImage(prompt: string): Promise<{ buffer: Buffer; mimeType: string }> {
    if (!this.config.imageModel) throw new NineRouterError("Image model is not configured", "CONFIG", 400);
    const response = await this.request("/v1/images/generations", {
      method: "POST", headers: this.headers(), body: JSON.stringify({ model: this.config.imageModel, prompt, n: 1, size: "1024x1024", response_format: "b64_json" }),
    }, 90_000);
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.startsWith("image/")) return { buffer: Buffer.from(await response.arrayBuffer()), mimeType: contentType };
    const image = ImageResponseSchema.parse(await response.json()).data[0];
    if (image.b64_json) return { buffer: Buffer.from(image.b64_json, "base64"), mimeType: "image/png" };
    if (image.url) {
      const imageResponse = await this.fetchImpl(image.url);
      if (!imageResponse.ok) throw new NineRouterError(`Image download ${imageResponse.status}`, "UPSTREAM", imageResponse.status);
      return { buffer: Buffer.from(await imageResponse.arrayBuffer()), mimeType: imageResponse.headers.get("content-type") || "image/png" };
    }
    throw new NineRouterError("9Router returned an empty image response", "INVALID_RESPONSE", 502);
  }

  async transcribe(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
    if (!this.config.sttModel) throw new NineRouterError("STT model is not configured", "CONFIG", 400);
    const form = new FormData();
    form.append("model", this.config.sttModel);
    form.append("language", "en");
    form.append("response_format", "json");
    form.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);
    const response = await this.request("/v1/audio/transcriptions", { method: "POST", headers: this.headers(false), body: form }, 90_000);
    return TranscriptionSchema.parse(await response.json()).text;
  }

  async synthesizeSpeech(input: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const model = this.config.ttsVoice || this.config.ttsModel;
    if (!model) throw new NineRouterError("TTS model or voice is not configured", "CONFIG", 400);
    const response = await this.request("/v1/audio/speech?response_format=mp3", {
      method: "POST", headers: this.headers(), body: JSON.stringify({ model, input }),
    }, 60_000);
    return { buffer: Buffer.from(await response.arrayBuffer()), mimeType: response.headers.get("content-type") || "audio/mpeg" };
  }
}
