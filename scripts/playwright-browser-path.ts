const configured = process.env.PLAYWRIGHT_BROWSERS_PATH;
if (configured?.includes("cursor-sandbox-cache")) {
  delete process.env.PLAYWRIGHT_BROWSERS_PATH;
}
