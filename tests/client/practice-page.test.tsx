// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PracticePage } from "../../src/client/pages/PracticePage";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("PracticePage", () => {
  it("starts a sentence session and shows transcript feedback", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/speaking/notebook") && !init?.method) return Response.json([{ id: 1, sentence: "Could I have the menu please", translationVi: "Cho tôi xin thực đơn", sourceType: "user", sourceReference: "", fingerprint: "x", vocabularyId: null, exampleId: null, createdAt: "now", updatedAt: "now" }]);
      if (url.endsWith("/api/speaking/sessions") && init?.method === "POST") return Response.json({ id: 7, status: "active", items: [{ id: 9, sentenceId: 1, sentence: "Could I have the menu please", translationVi: "Cho tôi xin thực đơn", sortOrder: 0, completedAt: null }] }, { status: 201 });
      if (url.endsWith("/attempts")) return Response.json({ id: 2, sessionId: 7, sentenceId: 1, targetText: "Could I have the menu please", transcript: "Could I have menu please", diff: [{ token: "the", status: "missing" }], contentScore: 0.8, durationMs: 1000, createdAt: "now" }, { status: 201 });
      if (url.endsWith("/api/speaking/sessions/7/complete")) return Response.json({ id: 7, status: "completed", items: [{ id: 9, sentenceId: 1, sentence: "Could I have the menu please", translationVi: "Cho tôi xin thực đơn", sortOrder: 0, completedAt: "now" }] });
      throw new Error(`Unexpected request ${url}`);
    }));
    render(<PracticePage />);
    await screen.findByText("Could I have the menu please");
    await userEvent.click(screen.getByRole("button", { name: "Bắt đầu luyện" }));
    expect(await screen.findByText("Câu 1 / 1")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Transcript thử nghiệm"), "Could I have menu please");
    await userEvent.click(screen.getByRole("button", { name: "Phân tích transcript" }));
    await waitFor(() => expect(screen.getByText("Thiếu: the")).toBeInTheDocument());
    expect(screen.getByText("80% khớp nội dung")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Hoàn tất buổi luyện" }));
    expect(await screen.findByText("Buổi luyện đã hoàn tất.")).toBeInTheDocument();
  });

  it("shows an empty notebook action", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([])));
    render(<PracticePage />);
    expect(await screen.findByText("Lưu câu đầu tiên để bắt đầu shadowing.")).toBeInTheDocument();
  });

  it("adds a custom practice sentence and offers an AI helper", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/speaking/notebook") && !init?.method) return Response.json([]);
      if (url.endsWith("/api/speaking/notebook") && init?.method === "POST") return Response.json({ id: 2, sentence: "Could I have the receipt please?", translationVi: "Cho tôi xin hóa đơn được không?", sourceType: "user", sourceReference: "practice-room", fingerprint: "custom", vocabularyId: null, exampleId: null, createdAt: "now", updatedAt: "now" }, { status: 201 });
      if (url.endsWith("/api/agent/chat")) return Response.json({ reply: "Gợi ý: Could I have the receipt please?", suggestions: [], threadId: 3 });
      throw new Error(`Unexpected request ${url}`);
    }));
    render(<PracticePage />);
    expect(await screen.findByText("Thêm câu luyện riêng")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Câu tiếng Anh"), "Could I have the receipt please?");
    await userEvent.type(screen.getByLabelText("Nghĩa tiếng Việt"), "Cho tôi xin hóa đơn được không?");
    await userEvent.click(screen.getByRole("button", { name: "Thêm vào phòng luyện" }));
    expect(await screen.findByText("Could I have the receipt please?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Nhờ AI gợi ý câu" }));
    expect(await screen.findByText(/Gợi ý:/)).toBeInTheDocument();
  });

  it("keeps manual transcript available when speech provider is offline", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/speaking/notebook") && !init?.method) return Response.json([{ id: 1, sentence: "Try this sentence", translationVi: "Thử câu này", sourceType: "user", sourceReference: "", fingerprint: "x", vocabularyId: null, exampleId: null, createdAt: "now", updatedAt: "now" }]);
      if (url.endsWith("/api/speaking/sessions")) return Response.json({ id: 7, status: "active", items: [{ id: 9, sentenceId: 1, sentence: "Try this sentence", translationVi: "Thử câu này", sortOrder: 0, completedAt: null }] }, { status: 201 });
      if (url.endsWith("/api/speech/synthesize")) return Response.json({ error: "Speech provider offline" }, { status: 503 });
      throw new Error(`Unexpected request ${url}`);
    }));
    render(<PracticePage />);
    await userEvent.click(await screen.findByRole("button", { name: "Bắt đầu luyện" }));
    await userEvent.click(screen.getByRole("button", { name: "Nghe mẫu" }));
    expect(await screen.findByText("Speech provider chưa sẵn sàng. Bạn vẫn có thể nhập transcript thủ công.")).toBeInTheDocument();
    expect(screen.getByLabelText("Transcript thử nghiệm")).toBeEnabled();
  });
});
