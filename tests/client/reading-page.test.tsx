// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReadingPage } from "../../src/client/pages/ReadingPage";
import { AppStoreProvider } from "../../src/client/state/app-store";
import { useAppStore } from "../../src/client/state/app-store";

function StoreProbe() {
  const { page, mindmapDraftTerm, agentOpen, agentDraft } = useAppStore();
  return <output aria-label="Trạng thái app">{JSON.stringify({ page, mindmapDraftTerm, agentOpen, agentDraft })}</output>;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

describe("ReadingPage", () => {
  it("opens a document and saves selected text as a notebook sentence", async () => {
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/documents") return Response.json([{ id: 1, title: "My Notes", originalFilename: "notes.txt", format: "txt", mimeType: "text/plain", checksum: "x", sizeBytes: 20, sectionCount: 1, createdAt: "now" }]);
      if (url === "/api/documents/1") return Response.json({ id: 1, title: "My Notes", storagePath: "documents/x/source.txt", sections: [{ id: 2, documentId: 1, heading: "", content: "Useful phrase here.", sortOrder: 0, fingerprint: "section" }] });
      if (url.endsWith("/highlights")) return Response.json({ id: 3, documentId: 1, sectionId: 2, vocabularyId: null, sentenceId: null, selectedText: "Useful phrase", startOffset: 0, endOffset: 13, sourceType: "quoted", textFingerprint: "highlight" }, { status: 201 });
      if (url.endsWith("/extraction-drafts")) return Response.json({ jobId: 8, draft: { vocabulary: [{ term: "useful phrase", meaningVi: "cụm hữu ích", category: "recommended", reason: "Common in conversation" }], sentences: [] } }, { status: 201 });
      if (url === "/api/speaking/notebook" && init?.method === "POST") return Response.json({ id: 4, sentence: "Useful phrase", translationVi: "", sourceType: "quoted", sourceReference: "document:1:section:2", fingerprint: "sentence", vocabularyId: null, exampleId: null, createdAt: "now", updatedAt: "now" }, { status: 201 });
      throw new Error(`Unexpected request ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("getSelection", vi.fn(() => ({
      toString: () => "Useful phrase",
      anchorOffset: 0,
      focusOffset: 13,
      anchorNode: { parentElement: null },
      focusNode: { parentElement: null },
      rangeCount: 1,
    })));
    render(<AppStoreProvider><ReadingPage/><StoreProbe/></AppStoreProvider>);
    await userEvent.click(await screen.findByRole("button", { name: /My Notes/ }));
    const section = await screen.findByText("Useful phrase here.");
    fireEvent.mouseUp(section);
    await userEvent.click(await screen.findByRole("button", { name: "Lưu vào sổ câu" }));
    expect(await screen.findByText("Đã lưu vào sổ câu.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/speaking/notebook", expect.objectContaining({ method: "POST" }));
    await userEvent.click(screen.getByRole("button", { name: "Phân tích chương" }));
    expect(await screen.findByText("Nên học")).toBeInTheDocument();
    expect(screen.getByText("useful phrase")).toBeInTheDocument();
  });

  it("offers vocabulary, mindmap, tutor, and persisted reading controls", async () => {
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/documents") return Response.json([{ id: 1, title: "My Notes", originalFilename: "notes.txt", format: "txt", mimeType: "text/plain", checksum: "x", sizeBytes: 20, sectionCount: 1, createdAt: "now" }]);
      if (url === "/api/documents/1") return Response.json({ id: 1, title: "My Notes", storagePath: "documents/x/source.txt", sections: [{ id: 2, documentId: 1, heading: "", content: "Useful phrase here.", sortOrder: 0, fingerprint: "section" }] });
      if (url.endsWith("/vocabulary") && init?.method === "POST") return Response.json({ vocabulary: { id: 7, term: "Useful phrase", meaningVi: "", normalizedTerm: "useful phrase", ipa: "", partOfSpeech: "phrase", cefr: "B1", status: "new", imageUrl: null, audioUrl: null }, highlight: { id: 8, vocabularyId: 7 } }, { status: 201 });
      throw new Error(`Unexpected request ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("getSelection", vi.fn(() => ({ toString: () => "Useful phrase", anchorOffset: 0, focusOffset: 13, rangeCount: 1 })));
    render(<AppStoreProvider><ReadingPage/><StoreProbe/></AppStoreProvider>);
    await userEvent.click(await screen.findByRole("button", { name: /My Notes/ }));
    fireEvent.mouseUp(await screen.findByText("Useful phrase here."));
    await userEvent.click(screen.getByRole("button", { name: "Tạo thẻ từ" }));
    expect(await screen.findByText("Đã tạo thẻ từ.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Thêm vào mindmap" }));
    expect(screen.getByLabelText("Trạng thái app")).toHaveTextContent('"page":"create"');
    expect(screen.getByLabelText("Trạng thái app")).toHaveTextContent('"mindmapDraftTerm":"Useful phrase"');
    await userEvent.click(screen.getByRole("button", { name: "Hỏi gia sư" }));
    expect(screen.getByLabelText("Trạng thái app")).toHaveTextContent('"agentOpen":true');
    expect(screen.getByLabelText("Trạng thái app")).toHaveTextContent("Useful phrase");
    await userEvent.click(screen.getByRole("button", { name: "Tăng cỡ chữ" }));
    expect(localStorage.getItem("reader-font-scale")).toBe("1.1");
    await userEvent.click(screen.getByRole("button", { name: "Tăng giãn dòng" }));
    expect(localStorage.getItem("reader-line-height")).toBe("1.9");
  });

  it("uploads a local document", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      if (String(input) === "/api/documents" && init?.method === "POST") return Response.json({ id: 1, title: "notes", sectionCount: 1 }, { status: 201 });
      if (String(input) === "/api/documents") return Response.json([]);
      throw new Error("Unexpected request");
    }));
    render(<AppStoreProvider><ReadingPage /></AppStoreProvider>);
    const file = new File(["Hello"], "notes.txt", { type: "text/plain" });
    await userEvent.upload(screen.getByLabelText("Chọn tài liệu"), file);
    await userEvent.click(screen.getByRole("button", { name: "Nhập tài liệu" }));
    expect(await screen.findByText("Đã nhập notes.txt")).toBeInTheDocument();
  });
});
