// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuickCaptureDrawer } from "../../src/client/components/QuickCaptureDrawer";
import { AppShell } from "../../src/client/components/AppShell";
import { VocabularyInboxPage } from "../../src/client/pages/VocabularyInboxPage";
import { AppStoreProvider, useAppStore } from "../../src/client/state/app-store";
import { api } from "../../src/client/api/client";

vi.mock("../../src/client/components/AccountMenu",()=>({AccountMenu:()=>null}));
vi.mock("../../src/client/api/client",async(importOriginal)=>{const original=await importOriginal<typeof import("../../src/client/api/client")>();return{...original,api:{...original.api,captureVocabulary:vi.fn(),vocabularyInbox:vi.fn()}}});
afterEach(cleanup);beforeEach(()=>{vi.clearAllMocks();vi.mocked(api.vocabularyInbox).mockResolvedValue([] as never)});
describe("QuickCaptureDrawer",()=>{it("captures a note and reports created item",async()=>{const created={id:4,status:"ready",rawText:"negotiate",draft:null};vi.mocked(api.captureVocabulary).mockResolvedValue(created as never);const onCreated=vi.fn();render(<QuickCaptureDrawer open onClose={()=>{}} onCreated={onCreated}/>);const user=userEvent.setup();await user.type(screen.getByLabelText("T\u1eeb ho\u1eb7c c\u1ee5m t\u1eeb"),"negotiate");await user.type(screen.getByLabelText("Ng\u1eef c\u1ea3nh"),"client call");await user.click(screen.getByRole("button",{name:"L\u01b0u v\u00e0 nh\u1edd AI ph\u00e2n t\u00edch"}));expect(api.captureVocabulary).toHaveBeenCalledWith(expect.objectContaining({rawText:"negotiate",contextText:"client call",sourceType:"quick_capture"}));expect(onCreated).toHaveBeenCalledWith(created)});});
function ShellHarness(){const {page,vocabularyInboxStatus}=useAppStore();return <AppShell>{page==="vocabulary-inbox"?<VocabularyInboxPage initialStatus={vocabularyInboxStatus}/>:<div>Today</div>}</AppShell>}


it("groups mobile actions in one dock",()=>{
  render(<AppStoreProvider><AppShell><div>Today</div></AppShell></AppStoreProvider>);
  const dock=screen.getByRole("group",{name:"H\u00e0nh \u0111\u1ed9ng nhanh"});
  expect(dock).toContainElement(screen.getByRole("button",{name:"Ghi nhanh"}));
  expect(dock).toContainElement(screen.getByRole("button",{name:"H\u1ecfi gia s\u01b0"}));
});

it("labels vocabulary inbox clearly and shows pending count badge",async()=>{
  vi.mocked(api.vocabularyInbox).mockResolvedValue([{id:1,status:"ready",rawText:"apple"},{id:2,status:"ready",rawText:"negotiate"}] as never);
  render(<AppStoreProvider><AppShell><div>Today</div></AppShell></AppStoreProvider>);
  expect(await screen.findByLabelText("2 từ chờ duyệt")).toBeInTheDocument();
  expect(screen.getByText("Hộp từ mới")).toBeInTheDocument();
  expect(api.vocabularyInbox).toHaveBeenCalledWith("ready");
});it("opens failed tab when AI enrichment fails",async()=>{
  const failed={id:5,userId:1,status:"failed",rawText:"negotiate",normalizedText:"negotiate",contextText:"",sourceType:"quick_capture",sourceReference:"",hintMindmapId:null,hintParentNodeId:null,errorMessage:"AI enrichment unavailable",approvedVocabularyId:null,approvedMindmapId:null,createdAt:"",updatedAt:"",approvedAt:null,draft:null};
  vi.mocked(api.captureVocabulary).mockResolvedValue(failed as never);
  vi.mocked(api.vocabularyInbox).mockResolvedValue([failed] as never);
  render(<AppStoreProvider><ShellHarness/></AppStoreProvider>);
  const user=userEvent.setup();
  await user.click(screen.getByRole("button",{name:"Ghi nhanh"}));
  await user.type(screen.getByLabelText("T\u1eeb ho\u1eb7c c\u1ee5m t\u1eeb"),"negotiate");
  await user.click(screen.getByRole("button",{name:"L\u01b0u v\u00e0 nh\u1edd AI ph\u00e2n t\u00edch"}));
  expect((await screen.findAllByText("AI enrichment unavailable")).length).toBeGreaterThan(0);
  expect(api.vocabularyInbox).toHaveBeenCalledWith("failed");
});