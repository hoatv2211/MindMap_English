// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../../src/client/auth/auth-context";
import { AuthPage } from "../../src/client/pages/AuthPage";
import { api } from "../../src/client/api/client";

vi.mock("../../src/client/api/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/client/api/client")>();
  return { ...original, api: { ...original.api, authMe: vi.fn(), register: vi.fn(), login: vi.fn(), logout: vi.fn(), recoverPassword: vi.fn() } };
});

function Probe() { const auth=useAuth(); return auth.status === "authenticated" ? <button onClick={() => void auth.logout()}>Xin chào {auth.user.username}</button> : <AuthPage/>; }

afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); vi.mocked(api.authMe).mockRejectedValue(new Error("anonymous")); });

describe("account UX", () => {
  it("shows login after anonymous bootstrap", async () => {
    render(<AuthProvider><Probe/></AuthProvider>);
    expect(await screen.findByRole("heading", { name: "Chào bạn quay lại." })).toBeInTheDocument();
  });

  it("requires recovery-code confirmation after registration", async () => {
    vi.mocked(api.register).mockResolvedValue({ user:{id:1,username:"learner",profileRevision:1}, recoveryCode:"AAAAAA-BBBBBB-CCCCCC-DDDDDD" });
    render(<AuthProvider><Probe/></AuthProvider>);
    const user=userEvent.setup();
    await screen.findByText("Tạo tài khoản");
    await user.click(screen.getAllByRole("button", { name: "Tạo tài khoản" })[0]);
    await user.type(screen.getByLabelText("Tên đăng nhập"), "learner");
    await user.type(screen.getByLabelText("Mật khẩu"), "strong password 123");
    await user.type(screen.getByLabelText("Xác nhận mật khẩu"), "strong password 123");
    await user.click(screen.getByRole("button", { name: "Tạo không gian học" }));
    expect(await screen.findByText("AAAAAA-BBBBBB-CCCCCC-DDDDDD")).toBeInTheDocument();
    expect(screen.queryByText("Xin chào learner")).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Tôi đã lưu recovery code" }));
    await user.click(screen.getByRole("button", { name: "Tiếp tục vào app" }));
    expect(await screen.findByText("Xin chào learner")).toBeInTheDocument();
  });

  it("logs in and logs out", async () => {
    vi.mocked(api.login).mockResolvedValue({user:{id:2,username:"honghui",profileRevision:1}});
    vi.mocked(api.logout).mockResolvedValue(undefined);
    render(<AuthProvider><Probe/></AuthProvider>);
    const user=userEvent.setup();
    await screen.findByRole("heading", { name: "Chào bạn quay lại." });
    await user.type(screen.getByLabelText("Tên đăng nhập"), "honghui");
    await user.type(screen.getByLabelText("Mật khẩu"), "strong password 123");
    await user.click(screen.getByRole("button", { name: "Vào không gian học" }));
    await user.click(await screen.findByText("Xin chào honghui"));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Chào bạn quay lại." })).toBeInTheDocument());
  });
});

