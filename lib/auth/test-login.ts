/**
 * Test-only sign-in, used by the e2e tests in CI.
 * Never available on Vercel, whatever the environment variables say.
 */
export function testLoginEnabled() {
  return process.env.AUTH_TEST_LOGIN === "1" && !process.env.VERCEL;
}
