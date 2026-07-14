import { expect, test } from "@playwright/test";

test("dashboard, library, mindmap and learning flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Hôm nay mình nói được gì?" })).toBeVisible();
  await expect(page.getByText("Học offline")).toBeVisible();

  await page.getByRole("button", { name: "Thư viện", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Eating Essentials" })).toBeVisible();
  await page.getByRole("button", { name: /Eating Essentials/ }).click();
  await expect(page.getByRole("heading", { name: "Eating Essentials" })).toBeVisible();
  await expect(page.getByText("apple", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Hôm nay", exact: true }).click();
  await page.getByRole("button", { name: /Học 20 phút/ }).click();
  await expect(page.getByText(/1\/14 từ/)).toBeVisible();
  const answer = page.getByPlaceholder("Nhập từ hoặc nghĩa...");
  if (await answer.isVisible()) {
    await answer.fill("test");
    await page.getByRole("button", { name: /Kiểm tra/ }).click();
    await expect(page.getByText("ĐÁP ÁN GỢI Ý")).toBeVisible();
  }
});

test("mobile keeps primary navigation and study action usable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile project only");
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Học 20 phút/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Thư viện", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Thư viện", exact: true }).click();
  await expect(page.getByPlaceholder("Tìm chủ đề hoặc mindmap")).toBeVisible();
});


