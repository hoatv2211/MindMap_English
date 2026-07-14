// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateMindmapPage } from "../../src/client/pages/CreateMindmapPage";
import { AppStoreProvider } from "../../src/client/state/app-store";
import { api } from "../../src/client/api/client";

vi.mock("../../src/client/api/client",()=>({api:{topics:vi.fn(),generateMindmap:vi.fn(),saveGeneratedMindmap:vi.fn(),approveMindmap:vi.fn()}}));
afterEach(cleanup);
beforeEach(()=>{vi.clearAllMocks();vi.mocked(api.topics).mockResolvedValue([{id:1,slug:"eating",title:"Eating",titleVi:"Ăn uống",icon:"",color:"coral",mindmapCount:1}]);vi.mocked(api.generateMindmap).mockResolvedValue({jobId:1,duplicates:[],draft:{title:"Cafe talk",description:"Practical",branches:[{label:"orders",meaningVi:"gọi món",color:"coral",words:[{term:"to go",meaningVi:"mang đi",ipa:"",cefr:"A2",example:"To go, please.",exampleVi:"Cho mang đi."}]}]}})});
describe("CreateMindmapPage",()=>{it("keeps AI output as preview until user saves",async()=>{render(<AppStoreProvider><CreateMindmapPage/></AppStoreProvider>);await userEvent.type(screen.getByPlaceholderText("Ví dụ: phỏng vấn xin việc"),"coffee shop");await userEvent.click(screen.getByText("Tạo bản nháp"));expect(await screen.findByText("Cafe talk")).toBeInTheDocument();expect(screen.getByText("Lưu bản nháp")).toBeInTheDocument();expect(api.saveGeneratedMindmap).not.toHaveBeenCalled()})
it("explains why generation cannot start when topic is empty", async () => {
  render(<AppStoreProvider><CreateMindmapPage /></AppStoreProvider>);
  await userEvent.click(screen.getByText("Tạo bản nháp"));
  expect(await screen.findByText("Nhập chủ đề ít nhất 2 ký tự.")).toBeInTheDocument();
  expect(api.generateMindmap).not.toHaveBeenCalled();
});});
