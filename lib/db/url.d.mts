export function connectionOptions(rawUrl: string | undefined): {
  url: string;
  ssl: false | "require";
};
export function databaseUrl(env?: Record<string, string | undefined>): string | undefined;
export function migrationUrl(env?: Record<string, string | undefined>): string | undefined;
