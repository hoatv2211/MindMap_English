// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentDrawer } from "../../src/client/components/AgentDrawer";
import { api } from "../../src/client/api/client";
import { AppStoreProvider } from "../../src/client/state/app-store";

vi.mock("../../src/client/api/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/client/api/client")>();
  return { ...original, api: { ...original.api, tutor: vi.fn() } };
});

beforeEach(() => { vi.mocked(api.tutor).mockRejectedValue(new Error("Model openai/gpt-5 is unavailable")); });

describe("AgentDrawer", () => {
  it("shows the backend AI error instead of masking every failure as offline", async () => {
    render(<AppStoreProvider><AgentDrawer /></AppStoreProvider>);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Hỏi cách dùng một từ..."), "alo");
    await user.click(screen.getByRole("button", { name: "Gửi" }));
    expect(await screen.findByText("Model openai/gpt-5 is unavailable")).toBeInTheDocument();
  });
});