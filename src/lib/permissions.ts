import { NextRequest, NextResponse } from "next/server";

// Single-user mode: no role or permission branching for internal usage.
export function requirePermission(
  request: NextRequest,
  permission: string,
): { denied: null | NextResponse } {
  void request;
  void permission;
  return { denied: null };
}
