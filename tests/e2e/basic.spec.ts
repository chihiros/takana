import { test, expect } from '@playwright/test';

test('join shows sample assistant message and enables review UI scaffolding', async ({ page }) => {
  // Open the app
  await page.goto('/');

  // Basic smoke: header & join button exist
  await expect(page.getByRole('heading', { name: 'AI-DLC Planning' })).toBeVisible();
  const joinBtn = page.locator('#joinRoom');
  await expect(joinBtn).toBeVisible();

  // Join the room
  await joinBtn.click();

  // Status reflects joined state (set before P2P handshake)
  await expect(page.locator('#roomStatus')).toContainText('Joined (P2P):');

  // Initial sample assistant message appears when history is empty
  await expect(page.locator('#chat')).toContainText('プランニングを始めましょう');

  // Gutter UI for review gets rendered for assistant message (presence of .msg-gutter)
  await expect(page.locator('.msg.ai .msg-gutter').first()).toBeVisible();
});

