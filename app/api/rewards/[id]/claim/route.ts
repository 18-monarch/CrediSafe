import { requireUser } from "@/lib/server/auth";
import { apiError, apiSuccess } from "@/lib/server/http";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return apiError(auth.error ?? "Unauthorized", auth.status);
  const { id } = await context.params;

  const { data, error } = await auth.supabase.rpc("claim_reward", { p_reward_id: id });
  if (error) {
    const status = error.message.toLowerCase().includes("insufficient") ? 409 : 500;
    return apiError(error.message, status);
  }
  return apiSuccess({ claimId: data }, 201);
}
