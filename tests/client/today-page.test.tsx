// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TodayPage } from "../../src/client/pages/TodayPage";
import { AppStoreProvider, useAppStore } from "../../src/client/state/app-store";
import { api } from "../../src/client/api/client";

vi.mock("../../src/client/api/client",()=>({api:{dashboard:vi.fn(),health:vi.fn(),createSession:vi.fn()}}));
beforeEach(()=>{vi.mocked(api.dashboard).mockResolvedValue({dueCount:18,newCount:12,weakCount:3,stableCount:8,streak:4,weeklyMinutes:45,weeklyGoalMinutes:100,aiOnline:false,unfinishedSessionId:null});vi.mocked(api.health).mockResolvedValue({ok:true,aiOnline:false});vi.mocked(api.createSession).mockResolvedValue({id:9,durationMinutes:20,status:"active",startedAt:"",completedAt:null,summary:"",items:[]})});
afterEach(()=>{cleanup();vi.clearAllMocks()});
function StoreProbe(){const {agentOpen,agentDraft,page}=useAppStore();return <output data-testid="store">{JSON.stringify({agentOpen,agentDraft,page})}</output>}
describe("TodayPage",()=>{
  it("shows multiple account-aware study options and starts the main review",async()=>{render(<AppStoreProvider><TodayPage/><StoreProbe/></AppStoreProvider>);expect(await screen.findByText("Học 20 phút")).toBeInTheDocument();expect(screen.getByText("Học offline")).toBeInTheDocument();expect(screen.getByText("18 từ")).toBeInTheDocument();expect(screen.getByText("Ôn 18 từ đến hạn")).toBeInTheDocument();expect(screen.getByText("Đi tiếp lộ trình CEFR")).toBeInTheDocument();expect(screen.getByText("AI lập lộ trình riêng")).toBeInTheDocument();await userEvent.click(screen.getByText("Học 20 phút"));expect(api.createSession).toHaveBeenCalledWith(20)});
  it("opens tutor with an account-aware roadmap prompt",async()=>{render(<AppStoreProvider><TodayPage/><StoreProbe/></AppStoreProvider>);await screen.findByText("AI lập lộ trình riêng");await userEvent.click(screen.getByText("AI lập lộ trình riêng"));expect(screen.getByTestId("store")).toHaveTextContent("agentOpen\":true");expect(screen.getByTestId("store")).toHaveTextContent("Dựa trên dữ liệu tài khoản của tôi")});
});

