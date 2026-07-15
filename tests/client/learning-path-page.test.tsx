// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LearningPathPage } from "../../src/client/pages/LearningPathPage";
import { AppStoreProvider } from "../../src/client/state/app-store";
import { api } from "../../src/client/api/client";

vi.mock("../../src/client/api/client",async(importOriginal)=>{const original=await importOriginal<typeof import("../../src/client/api/client")>();return{...original,api:{...original.api,learningPaths:vi.fn(),createSession:vi.fn()}}});
afterEach(cleanup);
beforeEach(()=>{vi.clearAllMocks();vi.mocked(api.learningPaths).mockResolvedValue([{id:1,slug:"a1",title:"A1 Beginner",level:"A1",description:"Start",sortOrder:1,modules:[{id:10,slug:"introduce-yourself",title:"Introduce Yourself",goalVi:"Giới thiệu bản thân",cefr:"A1",sortOrder:1,status:"active",progressPercent:0,mindmapTitle:"People Around Us"},{id:11,slug:"food-and-drinks",title:"Food & Drinks",goalVi:"Gọi món đơn giản",cefr:"A1",sortOrder:2,status:"locked",progressPercent:0,mindmapTitle:"Eating Essentials"}]}] as never);vi.mocked(api.createSession).mockResolvedValue({id:99,durationMinutes:20,status:"active",startedAt:"",completedAt:null,summary:"",items:[]} as never)});

describe("LearningPathPage",()=>{
  it("shows path modules and starts the active module",async()=>{
    render(<AppStoreProvider><LearningPathPage/></AppStoreProvider>);
    expect(await screen.findByText("A1 Beginner")).toBeInTheDocument();
    expect(screen.getByText("Introduce Yourself")).toBeInTheDocument();
    expect(screen.getByText("Food & Drinks")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button",{name:/Học tiếp 20 phút/}));
    expect(api.createSession).toHaveBeenCalledWith(20,10);
  });
  it("keeps the path visible when a module has no lesson items",async()=>{
    vi.mocked(api.createSession).mockResolvedValue({id:100,durationMinutes:20,status:"active",startedAt:"",completedAt:null,summary:"",items:[]} as never);
    render(<AppStoreProvider><LearningPathPage/></AppStoreProvider>);
    await screen.findByText("A1 Beginner");
    await userEvent.click(screen.getByRole("button",{name:/Học tiếp 20 phút/}));
    expect(await screen.findByText("Bài học này chưa có từ để luyện.")).toBeInTheDocument();
    expect(screen.getByText("A1 Beginner")).toBeInTheDocument();
  });
});
