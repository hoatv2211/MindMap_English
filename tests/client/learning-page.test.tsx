// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LearningPage } from "../../src/client/pages/LearningPage";
import { AppStoreProvider, useAppStore } from "../../src/client/state/app-store";
import { api } from "../../src/client/api/client";

vi.mock("../../src/client/api/client",async(importOriginal)=>{const original=await importOriginal<typeof import("../../src/client/api/client")>();return{...original,api:{...original.api,session:vi.fn(),completeSession:vi.fn(),attempt:vi.fn()}}});
vi.mock("../../src/client/lib/speech",()=>({speakEnglish:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks()});

function StartSession({id}:{id:number}){const {startSession}=useAppStore();return <button onClick={()=>startSession(id)}>start</button>}
function renderWithSession(id:number){return render(<AppStoreProvider><StartSession id={id}/><LearningPage/></AppStoreProvider>)}

describe("LearningPage",()=>{
  it("shows an empty-session message instead of crashing when a path module has no lesson items",async()=>{
    vi.mocked(api.session).mockResolvedValue({id:42,durationMinutes:20,status:"active",startedAt:"",completedAt:null,summary:"",items:[]} as never);
    renderWithSession(42);
    await userEvent.click(screen.getByRole("button",{name:"start"}));
    expect(await screen.findByText("chưa có từ để luyện.")).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Quay lại lộ trình"})).toBeInTheDocument();
  });
});
