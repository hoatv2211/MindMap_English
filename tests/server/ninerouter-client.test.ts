import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { NineRouterClient } from "../../src/server/modules/agent/ninerouter-client";

afterEach(() => vi.useRealTimers());

const config = { url: "http://router.test", key: "secret", chatModel: "combo/chat", imageModel: "combo/image", sttModel: "combo/stt", ttsModel: "combo/tts", ttsVoice: "" };

describe("NineRouterClient", () => {
  it("uses OpenAI chat endpoint and parses structured JSON", async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    const fetchMock = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push([String(input), init]);
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"reply":"Hello"}' } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    const client = new NineRouterClient(config, fetchMock);
    const result = await client.chatJson(z.object({ reply: z.string() }), [{ role: "user", content: "Hi" }]);
    expect(result.reply).toBe("Hello");
    expect(calls[0][0]).toBe("http://router.test/v1/chat/completions");
    expect(calls[0][1]?.method).toBe("POST");
    expect((calls[0][1]?.headers as Record<string,string>).Authorization).toBe("Bearer secret");
  });

  it("omits authorization when key is blank", async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    const fetchMock = (async (input: RequestInfo | URL, init?: RequestInit) => { calls.push([String(input), init]); return new Response("{}", { status: 200 }); }) as typeof fetch;
    const client = new NineRouterClient({ ...config, key: "" }, fetchMock);
    await client.health();
    expect((calls[0][1]?.headers as Record<string,string>).Authorization).toBeUndefined();
  });

  it("returns typed configuration errors", async () => {
    const client = new NineRouterClient({ ...config, chatModel: "" });
    await expect(client.chatJson(z.object({}), [])).rejects.toMatchObject({ code: "CONFIG", status: 400 });
  });

  it("returns a typed error when chat response is not JSON", async () => {
    const fetchMock = (async () => new Response("upstream proxy error", { status: 200, headers: { "Content-Type": "text/plain" } })) as typeof fetch;
    const client = new NineRouterClient(config, fetchMock);
    await expect(client.chatJson(z.object({ reply: z.string() }), [{ role: "user", content: "Hi" }])).rejects.toMatchObject({ code: "INVALID_RESPONSE", status: 502 });
  });

  it("returns a typed error when chat response shape is invalid", async () => {
    const fetchMock = (async () => new Response(JSON.stringify({ output: "Hello" }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;
    const client = new NineRouterClient(config, fetchMock);
    await expect(client.chatJson(z.object({ reply: z.string() }), [{ role: "user", content: "Hi" }])).rejects.toMatchObject({ code: "INVALID_RESPONSE", status: 502 });
  });
  it("returns plain chat content without forcing structured JSON", async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    const fetchMock = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push([String(input), init]);
      return new Response(JSON.stringify({ choices: [{ message: { content: "Hello from tutor" } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    const client = new NineRouterClient(config, fetchMock);
    expect(await client.chatText([{ role: "user", content: "Hi" }])).toBe("Hello from tutor");
    const payload = JSON.parse(String(calls[0][1]?.body));
    expect(payload.response_format).toBeUndefined();
    expect(payload.stream).toBe(false);
  });
  it("allows structured generation to run for up to 120 seconds", async () => {
    vi.useFakeTimers();
    const fetchMock = ((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })) as typeof fetch;
    const client = new NineRouterClient(config, fetchMock);
    let settled = false;
    const pending = client.chatJson(z.object({ reply: z.string() }), [{ role: "user", content: "Hi" }]);
    pending.then(() => { settled = true; }, () => { settled = true; });

    await vi.advanceTimersByTimeAsync(30_001);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(90_000);
    await expect(pending).rejects.toMatchObject({ code: "OFFLINE", status: 503 });
  });});
