// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "../../src/client/pages/SettingsPage";
import { api } from "../../src/client/api/client";

vi.mock("../../src/client/api/client",async(importOriginal)=>{const original=await importOriginal<typeof import("../../src/client/api/client")>();return{...original,api:{...original.api,settings:vi.fn(),backups:vi.fn(),settingsHealth:vi.fn(),saveSettings:vi.fn(),createBackup:vi.fn(),restoreBackup:vi.fn()}}});
afterEach(cleanup);
beforeEach(()=>{vi.clearAllMocks();vi.mocked(api.backups).mockResolvedValue([]);vi.mocked(api.settingsHealth).mockResolvedValue({nineRouter:true,configured:{chat:true,image:false,stt:true,tts:true}});vi.mocked(api.saveSettings).mockResolvedValue({saved:["defaultDuration"]});vi.mocked(api.createBackup).mockResolvedValue({} as never);vi.mocked(api.restoreBackup).mockResolvedValue({} as never)});

describe("SettingsPage",()=>{
  it("hides provider configuration from non-admin users",async()=>{
    vi.mocked(api.settings).mockResolvedValue({canManageProviderApi:false,hasNineRouterKey:false,models:{},defaultDuration:20});
    render(<SettingsPage/>);
    expect(await screen.findByText("Thông tin URL, model và trạng thái kết nối chỉ hiển thị cho tài khoản admin.")).toBeInTheDocument();
    expect(screen.queryByText("http://provider.test:20128")).not.toBeInTheDocument();
    expect(screen.queryByText("combo/chat")).not.toBeInTheDocument();
    expect(screen.queryByRole("button",{name:/Kiểm tra kết nối/})).not.toBeInTheDocument();
  });

  it("shows provider configuration to admin users",async()=>{
    vi.mocked(api.settings).mockResolvedValue({canManageProviderApi:true,nineRouterUrl:"http://provider.test:20128",hasNineRouterKey:true,models:{chat:"combo/chat",stt:"combo/stt",voice:"alloy"},defaultDuration:20});
    render(<SettingsPage/>);
    expect(await screen.findByText("http://provider.test:20128")).toBeInTheDocument();
    expect(screen.getByText("combo/chat")).toBeInTheDocument();
    expect(screen.getByText("combo/stt / alloy")).toBeInTheDocument();
    expect(screen.getByRole("button",{name:/Kiểm tra kết nối/})).toBeInTheDocument();
  });
});
