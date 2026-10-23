export const workspace: string;
export const projectId: string;
export const localApi: string;
export const localApp: string;
export function assertLocalUrl(value: string | URL, allowed?: string[]): URL;
export function localEnvironment(): Record<string, string>;
export function isolatedProcessEnvironment(values: Record<string, string>): NodeJS.ProcessEnv;
export function assertLocalDocker(): {
  project: string;
  context: string;
  localDaemon: boolean;
  api: string;
};
export const localFetch: typeof fetch;
