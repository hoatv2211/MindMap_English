import { expect, test } from "@playwright/test";

test("dashboard, library, mindmap and learning flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Hôm nay mình nói được gì/ })).toBeVisible();
  await expect(page.getByText("Học offline")).toBeVisible();

  await page.getByRole("button", { name: "Thư viện", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Eating Essentials" })).toBeVisible();
  await page.getByRole("button", { name: /Eating Essentials/ }).click();
  await expect(page.getByRole("heading", { name: "Eating Essentials" })).toBeVisible();
  await expect(page.getByText("apple", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Hôm nay", exact: true }).click();
  await page.getByRole("button", { name: /Học 20 phút/ }).click();
  await expect(page.getByText(/1\/14 từ/)).toBeVisible();
});

test("imports reading text, saves a sentence, and starts practice", async ({ page }) => {
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
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Học 20 phút/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Thư viện", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Phòng luyện", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Thư viện", exact: true }).click();
  await expect(page.getByPlaceholder("Tìm chủ đề hoặc mindmap")).toBeVisible();
  await expect(page.getByRole("button", { name: /Tài liệu đang đọc/ })).toBeVisible();
});
