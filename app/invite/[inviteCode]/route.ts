import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseConfigurationErrorLoginPath } from "@/app/auth/redirects";
import {
  getInviteFailureRedirectPath,
  isInvalidOrExpiredInviteError,
} from "@/app/invite/invite-errors";
import { getCurrentUser } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type InviteRouteContext = {
  params: Promise<{
    inviteCode: string;
  }>;
};

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function GET(request: NextRequest, context: InviteRouteContext) {
  const { inviteCode } = await context.params;

  if (!isSupabaseConfigured()) {
    return redirectTo(request, getSupabaseConfigurationErrorLoginPath());
  }

  const user = await getCurrentUser();

  if (!user) {
    return redirectTo(
      request,
      `/login?next=${encodeURIComponent(`/invite/${inviteCode}`)}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("join_room_by_invite_code", {
    p_invite_code: inviteCode,
  });

  if (isInvalidOrExpiredInviteError(error)) {
    return redirectTo(request, getInviteFailureRedirectPath(inviteCode, error));
  }

  if (error?.code === "IF003") {
    return redirectTo(
      request,
      `/login?next=${encodeURIComponent(`/invite/${inviteCode}`)}`,
    );
  }

  if (error) {
    console.error("Unexpected invite join failure:", error);
    throw new Error(error.message);
  }

  return redirectTo(request, `/rooms/${encodeURIComponent(inviteCode)}`);
}
