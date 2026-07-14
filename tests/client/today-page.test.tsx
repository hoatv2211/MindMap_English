// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TodayPage } from "../../src/client/pages/TodayPage";
import { AppStoreProvider } from "../../src/client/state/app-store";
import { api } from "../../src/client/api/client";

vi.mock("../../src/client/api/client",()=>({api:{dashboard:vi.fn(),health:vi.fn(),createSession:vi.fn()}}));
beforeEach(()=>{vi.mocked(api.dashboard).mockResolvedValue({dueCount:18,newCount:12,weakCount:3,stableCount:8,streak:4,weeklyMinutes:45,weeklyGoalMinutes:100,aiOnline:false,unfinishedSessionId:null});vi.mocked(api.health).mockResolvedValue({ok:true,aiOnline:false});vi.mocked(api.createSession).mockResolvedValue({id:9,durationMinutes:20,status:"active",startedAt:"",completedAt:null,summary:"",items:[]})});
describe("TodayPage",()=>{it("shows dominant study action and offline-safe status",async()=>{render(<AppStoreProvider><TodayPage/></AppStoreProvider>);expect(await screen.findByText("Học 20 phút")).toBeInTheDocument();expect(screen.getByText("Học offline")).toBeInTheDocument();expect(screen.getByText("18 từ")).toBeInTheDocument();await userEvent.click(screen.getByText("Học 20 phút"));expect(api.createSession).toHaveBeenCalledWith(20)})});

