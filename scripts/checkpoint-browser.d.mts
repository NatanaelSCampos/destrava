export function checkpointBrowser(options?: { appOrigin?: string }): Promise<{
  cookies(entries: { name: string; value: string }[]): Promise<void>;
  navigate(path: string): Promise<void>;
  evaluate(expression: string): Promise<unknown>;
  key(
    key: string,
    code?: string,
    options?: { modifiers?: number; windowsVirtualKeyCode?: number; nativeVirtualKeyCode?: number },
  ): Promise<void>;
  insertText(text: string): Promise<void>;
  waitText(expected: string): Promise<void>;
  viewport(width: number, height: number): Promise<void>;
  screenshot(name: string): Promise<void>;
  proof(): { allowedOrigins: string[]; blockedRequests: number; runtimeErrors: number };
  close(): Promise<void>;
}>;
