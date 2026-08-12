import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getEnv } from "@/config/env";
import { getAdminSessionService } from "@/domain/admin/runtime";

import { guardAdminMutation, handleAdminError } from "../shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  const env = getEnv();
  const rejected = guardAdminMutation(request, env);
  if (rejected) return rejected;

  try {
    const token = request.cookies.get(env.ADMIN_SESSION_COOKIE_NAME)?.value;
    await getAdminSessionService().logout(token);
    const response = NextResponse.json(
      { loggedOut: true },
      { headers: { "cache-control": "no-store" } },
    );
    response.cookies.set(env.ADMIN_SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "strict",
      secure: true,
    });
    return response;
  } catch (error) {
    return handleAdminError(error);
  }
}
