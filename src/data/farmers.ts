import { supabase } from "../lib/supabaseClient";
import type { Farmer } from "../components/prototype/FarmerScreen";

/** Columns of public.farmers (see supabase/migrations/011_farmers_and_rls_hardening.sql). */
interface FarmerRow {
  id: string;
  owner_id: string;
  name: string;
  village: string | null;
  district: string | null;
  contact: string | null;
  email: string | null;
  crop: string | null;
  area: number | null;
  status: string | null;
  created_at: string;
}

export interface NewFarmerInput {
  name: string;
  village: string;
  district: string;
  contact: string;
  email: string;
  crop: string;
  area: number;
}

const STATUSES: Farmer["status"][] = ["Active", "Monitoring", "Attention", "Inactive"];

export function rowToFarmer(row: FarmerRow): Farmer {
  const created = new Date(row.created_at);
  return {
    id: row.id,
    name: row.name,
    village: row.village ?? "",
    district: row.district ?? "",
    contact: row.contact ?? "",
    email: row.email ?? "",
    crop: row.crop ?? "",
    area: row.area ?? 0,
    joinDate: isNaN(created.getTime())
      ? ""
      : created.toLocaleDateString(undefined, { month: "short", year: "numeric" }),
    status: STATUSES.includes(row.status as Farmer["status"]) ? (row.status as Farmer["status"]) : "Active",
    // Derived health/telemetry values are not stored for farmers; they stay
    // empty rather than being invented.
    yield: null,
    soilHealth: null,
    lastInspection: null,
    digitalTwin: null,
    lastRecommendation: null,
  };
}

/** The signed-in user's farmers only (enforced by RLS and by the owner filter). */
export async function fetchFarmers(ownerId: string): Promise<Farmer[]> {
  const { data, error } = await supabase
    .from("farmers")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as FarmerRow[]).map(rowToFarmer);
}

export async function createFarmer(ownerId: string, input: NewFarmerInput): Promise<Farmer> {
  const { data, error } = await supabase
    .from("farmers")
    .insert({
      owner_id: ownerId,
      name: input.name.trim(),
      village: input.village.trim() || null,
      district: input.district.trim() || null,
      contact: input.contact.trim() || null,
      email: input.email.trim() || null,
      crop: input.crop.trim() || null,
      area: input.area,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToFarmer(data as FarmerRow);
}

export async function deleteFarmer(id: string): Promise<void> {
  const { error } = await supabase.from("farmers").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
