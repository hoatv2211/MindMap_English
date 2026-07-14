import { expect, test } from "@playwright/test";
async function authenticate(page: import("@playwright/test").Page, suffix: string) {
  const username=`e2e-${suffix}`;
  const password="strong password 123";
  const registered=await page.request.post("/api/auth/register",{data:{username,password,passwordConfirmation:password}});
  if(registered.status()===409){const login=await page.request.post("/api/auth/login",{data:{username,password}});expect(login.ok()).toBeTruthy()}else expect(registered.status()).toBe(201);
}



test("registers through UI and enforces recovery checkpoint", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop account flow only");
  const username=`ui-account-${Date.now()}`;
  const password="strong password 123";
  await page.goto("/");
  await page.getByRole("button",{name:"Tạo tài khoản"}).first().click();
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu",{exact:true}).fill(password);
  await page.getByLabel("Xác nhận mật khẩu").fill(password);
  await page.getByRole("button",{name:"Tạo không gian học"}).click();
  await expect(page.getByText("Code chỉ hiện lần này. Dùng khi quên mật khẩu.")).toBeVisible();
  await expect(page.locator("code")).toHaveText(/^[A-F0-9-]{20,}$/);
  await expect(page.getByRole("button",{name:"Tiếp tục vào app"})).toBeDisabled();
  await page.getByRole("checkbox",{name:"Tôi đã lưu recovery code"}).check();
  await page.getByRole("button",{name:"Tiếp tục vào app"}).click();
  await expect(page.getByRole("heading",{name:/Hôm nay mình nói được gì/})).toBeVisible();
  await page.getByRole("button",{name:new RegExp(username)}).click();
  await page.getByRole("button",{name:"Đăng xuất"}).click();
  await expect(page.getByRole("heading",{name:"Chào bạn quay lại."})).toBeVisible();
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button",{name:"Vào không gian học"}).click();
  await expect(page.getByRole("heading",{name:/Hôm nay mình nói được gì/})).toBeVisible();
});

test("keeps tutor threads isolated between accounts", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop account isolation only");
  const runId = Date.now();
  const password = "strong password 123";
  const firstUsername = `isolation-a-${runId}`;
  const secondUsername = `isolation-b-${runId}`;

  const firstRegistration = await page.request.post("/api/auth/register", {
    data: { username: firstUsername, password, passwordConfirmation: password },
  });
  expect(firstRegistration.status()).toBe(201);
  const createdThread = await page.request.post("/api/agent/threads", {
    data: { title: "Private tutor thread" },
  });
  expect(createdThread.status()).toBe(201);
  const thread = await createdThread.json() as { id: number };
  expect((await page.request.post("/api/auth/logout")).status()).toBe(204);

  const secondRegistration = await page.request.post("/api/auth/register", {
    data: { username: secondUsername, password, passwordConfirmation: password },
  });
  expect(secondRegistration.status()).toBe(201);
  const secondThreads = await page.request.get("/api/agent/threads");
  expect(secondThreads.status()).toBe(200);
  expect(await secondThreads.json()).toEqual([]);
  expect((await page.request.get(`/api/agent/threads/${thread.id}/messages`)).status()).toBe(404);
});

test("dashboard, library, mindmap and learning flow", async ({ page }, testInfo) => {
  await authenticate(page, testInfo.project.name);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Hôm nay mình nói được gì/ })).toBeVisible();
  await expect(page.getByText(/^(AI sẵn sàng|Học offline)$/)).toBeVisible();

  await page.getByRole("button", { name: "Thư viện", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Eating Essentials" })).toBeVisible();
  await page.getByRole("button", { name: /Eating Essentials/ }).click();
  await expect(page.getByRole("heading", { name: "Eating Essentials" })).toBeVisible();
  await expect(page.getByText("apple", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Hôm nay", exact: true }).click();
  await page.getByRole("button", { name: /Học 20 phút/ }).click();
  await expect(page.getByText(/1\/14 từ/)).toBeVisible();
});

test("imports reading text, saves a sentence, and starts practice", async ({ page }, testInfo) => {
  await authenticate(page, testInfo.project.name);
  const runId = Date.now();
  const filename = `practice-notes-${runId}.txt`;
  const targetSentence = `Could I have the menu please run ${runId}`;
  await page.goto("/");
  await page.getByRole("button", { name: "Thư viện", exact: true }).click();
  await page.getByRole("button", { name: /Tài liệu đang đọc/ }).click();
  await page.getByLabel("Chọn tài liệu").setInputFiles({ name: filename, mimeType: "text/plain", buffer: Buffer.from(targetSentence) });
  await page.getByRole("button", { name: "Nhập tài liệu" }).click();
  await expect(page.getByText(`Đã nhập ${filename}`)).toBeVisible();
  await page.getByRole("button", { name: `Mở practice-notes-${runId}` }).click();
  await page.getByRole("button", { name: "Tăng cỡ chữ" }).click();
  await page.getByRole("button", { name: "Tăng giãn dòng" }).click();
  const sentence = page.getByText(targetSentence, { exact: true });
  await sentence.selectText();
  await sentence.dispatchEvent("mouseup");
  await expect(page.getByRole("button", { name: "Lưu vào sổ câu" })).toBeVisible();
  await page.getByRole("button", { name: "Tạo thẻ từ" }).click();
  await expect(page.getByText("Đã tạo thẻ từ.")).toBeVisible();
  await page.getByRole("button", { name: "Lưu vào sổ câu" }).click();
  await expect(page.getByText("Đã lưu vào sổ câu.")).toBeVisible();

  await page.getByRole("button", { name: "Phòng luyện", exact: true }).click();
  await expect(page.getByText(targetSentence, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Bắt đầu luyện" }).click();
  await page.getByLabel("Transcript thử nghiệm").fill(`Could I have menu please run ${runId}`);
  await page.getByRole("button", { name: "Phân tích transcript" }).click();
  await expect(page.getByText("Thiếu: the")).toBeVisible();
});

test("mobile keeps primary navigation and reading action usable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile project only");
  await authenticate(page, testInfo.project.name);
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Học 20 phút/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Thư viện", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Phòng luyện", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Thư viện", exact: true }).click();
  await expect(page.getByPlaceholder("Tìm chủ đề hoặc mindmap")).toBeVisible();
  await expect(page.getByRole("button", { name: /Tài liệu đang đọc/ })).toBeVisible();
});
