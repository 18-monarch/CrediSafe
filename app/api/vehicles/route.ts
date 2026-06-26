import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { apiError, apiSuccess } from "@/lib/server/http";
import { serializeVehicle } from "@/lib/server/serializers";

const schema = z.object({
  registrationNumber: z.string().trim().min(4).max(20),
  makeModel: z.string().trim().min(2).max(80),
  vehicleType: z.enum(["car", "bike", "scooter", "other"]),
  isPrimary: z.boolean().default(true),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return apiError(auth.error ?? "Unauthorized", auth.status);

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return apiError("Invalid vehicle details", 422, parsed.error.flatten());

  if (parsed.data.isPrimary) {
    await auth.supabase.from("vehicles").update({ is_primary: false }).eq("user_id", auth.user.id);
  }

  const { data, error } = await auth.supabase
    .from("vehicles")
    .insert({
      user_id: auth.user.id,
      registration_number: parsed.data.registrationNumber.toUpperCase(),
      make_model: parsed.data.makeModel,
      vehicle_type: parsed.data.vehicleType,
      is_primary: parsed.data.isPrimary,
      verification_status: "simulated",
    })
    .select("*")
    .single();

  if (error || !data) return apiError("Could not add vehicle", 500, error?.message);
  return apiSuccess(serializeVehicle(data), 201);
}
