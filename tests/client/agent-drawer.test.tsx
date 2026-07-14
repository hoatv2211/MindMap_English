// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentDrawer } from "../../src/client/components/AgentDrawer";
import { api } from "../../src/client/api/client";
import { AppStoreProvider } from "../../src/client/state/app-store";

vi.mock("../../src/client/api/client", async (importOriginal) => { const original=await importOriginal<typeof import("../../src/client/api/client")>();return{...original,api:{...original.api,agentStatus:vi.fn(),agentThreads:vi.fn(),createAgentThread:vi.fn(),agentMessages:vi.fn(),sendAgentMessage:vi.fn(),archiveAgentThread:vi.fn(),deleteAgentThread:vi.fn()}}});
afterEach(cleanup);
beforeEach(()=>{vi.clearAllMocks();vi.mocked(api.agentStatus).mockResolvedValue({skill:"mindmap-english-tutor",skillVersion:"1.0.0",degraded:false});vi.mocked(api.agentThreads).mockResolvedValue([{id:4,title:"Present perfect",preview:"Dùng khi...",updatedAt:"2026-07-14"}]);vi.mocked(api.agentMessages).mockResolvedValue([{id:1,threadId:4,role:"assistant",content:"Chào bạn",status:"completed",cacheHit:0}]);});

describe("AgentDrawer",()=>{
  it("restores history and creates a new chat",async()=>{vi.mocked(api.createAgentThread).mockResolvedValue({id:5,title:"",updatedAt:"2026-07-14"});render(<AppStoreProvider><AgentDrawer/></AppStoreProvider>);expect(await screen.findByText("Present perfect")).toBeInTheDocument();expect(await screen.findByText("Chào bạn")).toBeInTheDocument();await userEvent.click(screen.getByRole("button",{name:"Chat mới"}));expect(api.createAgentThread).toHaveBeenCalledOnce();});
  it("persists replies and exposes backend errors",async()=>{vi.mocked(api.sendAgentMessage).mockRejectedValue(new Error("Model unavailable"));render(<AppStoreProvider><AgentDrawer/></AppStoreProvider>);const user=userEvent.setup();await screen.findByText("Chào bạn");await user.type(screen.getByPlaceholderText("Hỏi, sửa câu hoặc luyện hội thoại…"),"alo");await user.click(screen.getByRole("button",{name:"Gửi"}));expect(await screen.findByText("Model unavailable")).toBeInTheDocument();});
});
