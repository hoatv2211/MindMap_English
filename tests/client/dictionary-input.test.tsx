// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DictionaryInput } from "../../src/client/components/DictionaryInput";

afterEach(() => vi.unstubAllGlobals());

describe("DictionaryInput", () => {
  it("selects an autocomplete result with the keyboard", async () => {
    const onChange = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("complete")) return new Response(JSON.stringify({ items: ["apple", "application"] }), { status: 200, headers: { "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ term: "apple", normalizedTerm: "apple", known: true, existingVocabularyId: 1, suggestions: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    render(<DictionaryInput value="app" onChange={onChange} ariaLabel="Từ tiếng Anh" />);
    const input = screen.getByRole("combobox", { name: "Từ tiếng Anh" });
    await userEvent.click(input);
    await waitFor(() => expect(screen.getByRole("option", { name: "apple" })).toBeInTheDocument());
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("apple");
  });

  it("offers a correction and allows an unknown word", async () => {
    const onChange = vi.fn();
    const onUnknownChange = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("complete")) return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ term: "aple", normalizedTerm: "aple", known: false, existingVocabularyId: null, suggestions: ["apple"] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    render(<DictionaryInput value="aple" onChange={onChange} onUnknownChange={onUnknownChange} ariaLabel="Từ tiếng Anh" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Dùng từ apple" })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Dùng từ apple" }));
    expect(onChange).toHaveBeenCalledWith("apple");
    expect(screen.getByText("Cần kiểm tra")).toBeInTheDocument();
    expect(onUnknownChange).toHaveBeenCalledWith(true);
    await userEvent.click(screen.getByRole("button", { name: "Giữ từ aple" }));
    expect(onUnknownChange).toHaveBeenLastCalledWith(false);
  });
});
