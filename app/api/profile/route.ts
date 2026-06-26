import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { apiError, apiSuccess } from "@/lib/server/http";
import { serializeProfile } from "@/lib/server/serializers";

const schema = z.object({
  fullName: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
});

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return apiError(auth.error ?? "Unauthorized", auth.status);
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return apiError("Invalid profile details", 422, parsed.error.flatten());

  const { data, error } = await auth.supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, city: parsed.data.city })
    .eq("id", auth.user.id)
    .select("*")
    .single();

  if (error || !data) return apiError("Could not update profile", 500, error?.message);
  return apiSuccess(serializeProfile(data));
}
