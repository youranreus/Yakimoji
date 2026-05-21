export function assertSessionBoundary() {
  throw new Error(
    "Session management is intentionally not implemented in story 1.1. Add auth/session logic in story 1.2 within this server-only boundary.",
  );
}
