"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";

type Tier = {
  id: string;
  min_students: number;
  max_students: number | null;
  amount: number;
  active: boolean;
};

export default function CommissionTiersPage() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [message, setMessage] = useState("Loading...");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data, error } = await supabase.rpc(
      "coreone_partnerhub_list_commission_tiers"
    );
    if (error) {
      setMessage(error.message);
      return;
    }
    setTiers((data || []).map((t: Tier) => ({
      ...t, amount: Number(t.amount)
    })));
    setMessage("");
  }

  useEffect(() => {
    load();
  }, []);

  function change(id: string, field: keyof Tier, value: string | boolean) {
    setTiers(old => old.map(t => t.id === id ? {
      ...t,
      [field]: field === "active" ? value :
        field === "max_students" ? (value === "" ? null : Number(value)) :
        Number(value)
    } : t));
  }

  async function save(t: Tier) {
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc(
      "coreone_partnerhub_save_commission_tier",
      {
        p_id: t.id,
        p_min_students: t.min_students,
        p_max_students: t.max_students,
        p_amount: t.amount,
        p_active: t.active
      }
    );
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Tier saved successfully.");
    await load();
  }

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <h1 className="text-xl font-bold">Commission Tiers</h1>
      <p className="my-2 text-sm text-gray-600">
        Set the commission amount for each confirmed student-count range.
        Amounts are in Nigerian naira (NGN).
      </p>
      {message && <p className="my-4 rounded bg-gray-100 p-3">{message}</p>}
      <div className="mt-6 space-y-4">
        {tiers.map(t => (
          <section key={t.id} className="grid grid-cols-1 gap-3 rounded-xl border p-4 sm:grid-cols-5">
            <label className="text-sm">Minimum students
              <input className="mt-1 w-full rounded border p-2"
                type="number" min="1" value={t.min_students}
                onChange={e => change(t.id, "min_students", e.target.value)} />
            </label>
            <label className="text-sm">Maximum (blank = no limit)
              <input className="mt-1 w-full rounded border p-2"
                type="number" min={t.min_students}
                value={t.max_students ?? ""}
                onChange={e => change(t.id, "max_students", e.target.value)} />
            </label>
            <label className="text-sm">Commission (₦)
              <input className="mt-1 w-full rounded border p-2"
                type="number" min="0" step="0.01" value={t.amount}
                onChange={e => change(t.id, "amount", e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={t.active}
                onChange={e => change(t.id, "active", e.target.checked)} />
              Active
            </label>
            <button disabled={busy}
              onClick={() => save(t)}
              className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50">
              Save
            </button>
          </section>
        ))}
      </div>
    </main>
  );
}
