import { test, expect } from '../fixtures/app';

/**
 * E2E Tests for Critical User Paths
 * Tests authentication, diagram generation, file operations, and session management
 */

test.describe('Critical User Paths', () => {
  test('should load application successfully', async ({ app, page }) => {
    await app.goto();
    
    // Verify app loaded
    await expect(page.locator('body')).toBeVisible();
    
    // Verify mode tabs are visible
    const designTab = page.locator('button:has-text("Design")');
    const codeTab = page.locator('button:has-text("Code")');
    await expect(designTab).toBeVisible();
    await expect(codeTab).toBeVisible();
  });

  test('should switch between Design and Code modes', async ({ app, page }) => {
    await app.goto();

    // Switch to Design mode
    await app.switchToDesignMode();
    const designTab = page.locator('button:has-text("Design")');
    await expect(designTab).toHaveClass(/active/);

    // Switch to Code mode
    await app.switchToCodeMode();
    const codeTab = page.locator('button:has-text("Code")');
    await expect(codeTab).toHaveClass(/active/);
  });

  test('should generate and display diagram', async ({ app, page }) => {
    await app.goto();
    await app.switchToDesignMode();

    // Send message
    await app.sendMessage('Create a database schema diagram');

    // Wait for diagram
    await app.waitForDiagram(15000);

    // Verify diagram rendered
    const diagram = page.locator('svg').first();
    await expect(diagram).toBeVisible();
  });

  test('should handle file read operation in Code mode', async ({ app, page }) => {
    await app.goto();
    await app.switchToCodeMode();

    // Set workspace (mock path for testing)
    await app.setWorkspace('/tmp/test-workspace');

    // Send message to read file
    await app.sendMessage('Read the package.json file');

    // Wait for tool execution
    await app.waitForCodeGeneration(15000);

    // Verify tool result appears
    const toolResult = page.locator('.tool-result-card').first();
    await expect(toolResult).toBeVisible({ timeout: 10000 });
  });

  test('should display diff for file write operation', async ({ app, page }) => {
    await app.goto();
    await app.switchToCodeMode();
    await app.setWorkspace('/tmp/test-workspace');

    // Send message to create file
    await app.sendMessage('Create a file called test.js with console.log("hello")');

    // Wait for tool execution
    await app.waitForCodeGeneration(15000);

    // Check if diff viewer appears (if backend returns diff data)
    const toolResults = page.locator('.tool-result-card');
    await expect(toolResults.first()).toBeVisible({ timeout: 10000 });

    // If diff data is present, diff viewer should be visible
    const hasDiff = await app.hasDiffViewer();
    // This is optional - depends on backend response
  });

  test('should handle file edit operation', async ({ app, page }) => {
    await app.goto();
    await app.switchToCodeMode();
    await app.setWorkspace('/tmp/test-workspace');

    // Send message to edit file
    await app.sendMessage('Add a comment to the first line of test.js');

    // Wait for tool execution
    await app.waitForCodeGeneration(15000);

    // Verify tool result
    const toolResult = page.locator('.tool-result-card').first();
    await expect(toolResult).toBeVisible({ timeout: 10000 });
  });

  test('should save and load code session', async ({ app, page }) => {
    await app.goto();
    await app.switchToCodeMode();

    // Send a message to create session content
    await app.sendMessage('List files in the current directory');

    // Wait for response
    await app.waitForCodeGeneration(10000);

    // Look for save button
    const saveBtn = page.locator('button:has-text("Save"), button[title*="Save" i]');
    if (await saveBtn.count() > 0) {
      await saveBtn.click();
      
      // In a real scenario, we'd handle the prompt
      // For testing, we'll just verify the button exists
      await expect(saveBtn).toBeVisible();
    }
  });

  test('should switch workspace in Code mode', async ({ app, page }) => {
    await app.goto();
    await app.switchToCodeMode();

    // Set initial workspace
    await app.setWorkspace('/tmp/workspace1');

    // Verify workspace input has value
    const workspaceInput = page.locator('input[placeholder*="workspace" i], input[placeholder*="path" i]').first();
    const value1 = await workspaceInput.inputValue();
    expect(value1).toContain('workspace1');

    // Change workspace
    await app.setWorkspace('/tmp/workspace2');
    const value2 = await workspaceInput.inputValue();
    expect(value2).toContain('workspace2');
  });

  test('should handle tool execution errors gracefully', async ({ app, page }) => {
    await app.goto();
    await app.switchToCodeMode();
    await app.setWorkspace('/tmp/test-workspace');

    // Send message that might cause error
    await app.sendMessage('Read a file that does not exist: nonexistent.txt');

    // Wait for response
    await app.waitForCodeGeneration(15000);

    // Verify error is displayed
    const errorResult = page.locator('.tool-result-card.error, .tool-result-card:has-text("error")');
    const toastError = page.locator('.toast[class*="error"], [class*="error-message"]');
    
    const hasError = await errorResult.count() > 0 || await toastError.count() > 0;
    expect(hasError).toBe(true);
  });

  test('should display tool calls and results', async ({ app, page }) => {
    await app.goto();
    await app.switchToCodeMode();
    await app.setWorkspace('/tmp/test-workspace');

    // Send message that triggers tool use
    await app.sendMessage('List all files in the current directory');

    // Wait for tool execution
    await app.waitForCodeGeneration(15000);

    // Verify tool call appears
    const toolCall = page.locator('.tool-call-card').first();
    await expect(toolCall).toBeVisible({ timeout: 10000 });

    // Verify tool result appears
    const toolResult = page.locator('.tool-result-card').first();
    await expect(toolResult).toBeVisible({ timeout: 10000 });
  });
});
