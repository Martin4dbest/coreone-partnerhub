"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase/client";

type Proposal = {
  id: string;
  title: string;
  body: string;
  published: boolean;
  created_at: string;
  updated_at: string;
  attachment_path?: string | null;
  attachment_name?: string | null;
};

type ResponseRow = {
  id: string;
  proposal_id: string;
  user_id: string;
  decision: "accepted" | "rejected";
  responded_at: string;
};

type Partner = {
  id?: string;
  user_id?: string;
  full_name?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  organization?: string;
  organization_name?: string;
  status?: string;
  application_status?: string;
};

function partnerName(partner?: Partner) {
  if (!partner) return "Representative";
  return (
    partner.full_name ||
    partner.name ||
    [partner.first_name, partner.last_name].filter(Boolean).join(" ") ||
    partner.email ||
    "Representative"
  );
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

export default function AdminProposalsPage() {
  const router = useRouter();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      const { data: admin, error: adminError } = await supabase.rpc(
        "is_coreone_partnerhub_admin"
      );

      if (adminError) throw adminError;

      if (admin !== true) {
        setError("Administrator access is required to manage proposals.");
        return;
      }

      const [
        { data: proposalData, error: proposalError },
        { data: responseData, error: responseError },
        { data: partnerData, error: partnerError },
      ] = await Promise.all([
        supabase
          .from("coreone_partnerhub_proposals")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("coreone_partnerhub_proposal_responses")
          .select("*")
          .order("responded_at", { ascending: false }),
        supabase.rpc("coreone_partnerhub_list_partners"),
      ]);

      if (proposalError) throw proposalError;
      if (responseError) throw responseError;
      if (partnerError) throw partnerError;

      const proposalRows = (proposalData ?? []) as Proposal[];

      setProposals(proposalRows);
      setResponses((responseData ?? []) as ResponseRow[]);
      setPartners((partnerData ?? []) as Partner[]);

      setSelectedId((current) =>
        proposalRows.some((item) => item.id === current)
          ? current
          : proposalRows[0]?.id ?? ""
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load proposals."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function clearForm() {
    setEditingId("");
    setTitle("");
    setBody("");
    setSelectedFile(null);
    setFileInputKey((current) => current + 1);
  }

  function editProposal(proposal: Proposal) {
    setEditingId(proposal.id);
    setSelectedId(proposal.id);
    setTitle(proposal.title);
    setBody(proposal.body);
    setSelectedFile(null);
    setFileInputKey((current) => current + 1);
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleFileChange(file?: File) {
    setError("");
    setMessage("");

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setSelectedFile(null);
      setFileInputKey((current) => current + 1);
      setError("Please choose a PDF document.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setSelectedFile(null);
      setFileInputKey((current) => current + 1);
      setError("The PDF must be 10 MB or smaller.");
      return;
    }

    setSelectedFile(file);
  }

  async function uploadProposalPdf(proposalId: string, file: File) {
    const safeName = file.name
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(-150);

    const path = `${proposalId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("coreone-proposals")
      .upload(path, file, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    return {
      attachment_path: path,
      attachment_name: file.name,
    };
  }

  async function saveProposal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    let uploadedPath: string | null = null;

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      const values = {
        title: title.trim(),
        body: body.trim(),
        updated_at: new Date().toISOString(),
      };

      let proposalId = editingId;
      let previousAttachmentPath: string | null = null;

      if (editingId) {
        const existing = proposals.find((item) => item.id === editingId);
        previousAttachmentPath = existing?.attachment_path ?? null;

        const { error: updateError } = await supabase
          .from("coreone_partnerhub_proposals")
          .update(values)
          .eq("id", editingId);

        if (updateError) throw updateError;
      } else {
        const { data: created, error: insertError } = await supabase
          .from("coreone_partnerhub_proposals")
          .insert({ ...values, created_by: authData.user.id })
          .select("id")
          .single();

        if (insertError) throw insertError;

        proposalId = created.id;

        // Keep the created draft available if a subsequent PDF upload fails.
        setEditingId(proposalId);
        setSelectedId(proposalId);
      }

      if (selectedFile) {
        const attachment = await uploadProposalPdf(proposalId, selectedFile);
        uploadedPath = attachment.attachment_path;

        const { error: attachmentError } = await supabase
          .from("coreone_partnerhub_proposals")
          .update({
            ...attachment,
            updated_at: new Date().toISOString(),
          })
          .eq("id", proposalId);

        if (attachmentError) {
          // Do not leave an orphaned upload if saving its path fails.
          await supabase.storage
            .from("coreone-proposals")
            .remove([attachment.attachment_path]);
          uploadedPath = null;
          throw attachmentError;
        }

        if (
          previousAttachmentPath &&
          previousAttachmentPath !== attachment.attachment_path
        ) {
          const { error: removeError } = await supabase.storage
            .from("coreone-proposals")
            .remove([previousAttachmentPath]);

          if (removeError) {
            setMessage(
              "Proposal saved with the new PDF, but the old file could not be removed."
            );
          }
        }
      }

      clearForm();

      if (!message) {
        setMessage(
          selectedFile
            ? "Proposal saved with its PDF attachment. Publish it when ready."
            : editingId
              ? "Proposal updated."
              : "Proposal created as a draft. Publish it when ready."
        );
      }

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save the proposal or upload its PDF."
      );
    } finally {
      setSaving(false);
    }
  }

  async function openPdf(proposal: Proposal) {
    if (!proposal.attachment_path) return;

    setError("");
    setMessage("");

    try {
      const { data, error: urlError } = await supabase.storage
        .from("coreone-proposals")
        .createSignedUrl(proposal.attachment_path, 300);

      if (urlError) throw urlError;

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to open the PDF."
      );
    }
  }

  async function setPublished(proposal: Proposal, published: boolean) {
    setWorkingId(proposal.id);
    setError("");
    setMessage("");

    try {
      const { error: updateError } = await supabase
        .from("coreone_partnerhub_proposals")
        .update({ published, updated_at: new Date().toISOString() })
        .eq("id", proposal.id);

      if (updateError) throw updateError;

      setMessage(
        published
          ? "Proposal published for approved representatives."
          : "Proposal unpublished."
      );

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update proposal."
      );
    } finally {
      setWorkingId("");
    }
  }

  async function deleteProposal(proposal: Proposal) {
    if (
      !window.confirm(
        `Delete "${proposal.title}" and its recorded responses? This cannot be undone.`
      )
    ) {
      return;
    }

    setWorkingId(proposal.id);
    setError("");
    setMessage("");

    try {
      if (proposal.attachment_path) {
        const { error: storageError } = await supabase.storage
          .from("coreone-proposals")
          .remove([proposal.attachment_path]);

        if (storageError) throw storageError;
      }

      const { error: deleteError } = await supabase
        .from("coreone_partnerhub_proposals")
        .delete()
        .eq("id", proposal.id);

      if (deleteError) throw deleteError;

      if (editingId === proposal.id) clearForm();

      setMessage("Proposal deleted.");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete proposal."
      );
    } finally {
      setWorkingId("");
    }
  }

  const selected = proposals.find((item) => item.id === selectedId);
  const selectedResponses = responses.filter(
    (item) => item.proposal_id === selectedId
  );
  const accepted = selectedResponses.filter(
    (item) => item.decision === "accepted"
  ).length;
  const rejected = selectedResponses.filter(
    (item) => item.decision === "rejected"
  ).length;
  const partnerById = new Map(
    partners.map((partner) => [
      partner.id ?? partner.user_id ?? "",
      partner,
    ])
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/admin"
              className="text-sm font-semibold text-rose-700 hover:underline"
            >
              ← Back to administration
            </Link>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
              Proposals &amp; Responses
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Upload PDF agreements, publish terms for approved sales
              representatives, and review each representative&apos;s decision.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-100"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </div>
        )}
        {message && (
          <div
            role="status"
            className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          >
            {message}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <form
            onSubmit={saveProposal}
            className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-lg font-bold">
              {editingId ? "Edit proposal" : "Create a proposal"}
            </h2>

            <label
              className="mt-5 block text-sm font-semibold"
              htmlFor="proposal-title"
            >
              Proposal title
            </label>
            <input
              id="proposal-title"
              required
              maxLength={180}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Sales Representative Partnership Agreement"
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-rose-500"
            />

            <label
              className="mt-4 block text-sm font-semibold"
              htmlFor="proposal-body"
            >
              Proposal details
            </label>
            <textarea
              id="proposal-body"
              required
              rows={8}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Enter a summary of the agreement, conditions, expectations, and relevant terms..."
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm leading-6 outline-none focus:border-rose-500"
            />

            <div className="mt-5 rounded-xl border-2 border-dashed border-rose-200 bg-rose-50/50 p-4">
              <label
                htmlFor={`proposal-pdf-${fileInputKey}`}
                className="block text-sm font-bold text-slate-900"
              >
                Upload proposal PDF
              </label>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Choose the agreement or proposal document from your computer.
                PDF only, maximum 10 MB.
              </p>

              <input
                key={fileInputKey}
                id={`proposal-pdf-${fileInputKey}`}
                type="file"
                accept=".pdf,application/pdf"
                onChange={(event) =>
                  handleFileChange(event.target.files?.[0])
                }
                className="mt-3 block w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-rose-600 file:px-3 file:py-2 file:font-semibold file:text-white hover:file:bg-rose-700"
              />

              {selectedFile && (
                <p className="mt-3 break-all text-sm font-semibold text-emerald-800">
                  Selected: {selectedFile.name}
                </p>
              )}

              {editingId &&
                proposals.find((item) => item.id === editingId)
                  ?.attachment_path &&
                !selectedFile && (
                  <p className="mt-3 text-sm text-slate-700">
                    Existing PDF:{" "}
                    <span className="font-semibold">
                      {
                        proposals.find((item) => item.id === editingId)
                          ?.attachment_name
                      }
                    </span>
                    . Choose another PDF above to replace it.
                  </p>
                )}
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Save the proposal first. You can then publish it for approved
              representatives. Publishing makes the attached PDF available to
              eligible representatives.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving || !title.trim() || !body.trim()}
                className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {saving
                  ? "Saving and uploading..."
                  : editingId
                    ? "Save changes"
                    : "Create draft"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={clearForm}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Saved proposals</h2>

            {loading ? (
              <p className="py-8 text-sm text-slate-500">
                Loading proposals...
              </p>
            ) : proposals.length === 0 ? (
              <p className="py-8 text-sm text-slate-500">
                No proposals yet. Create a draft to get started.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {proposals.map((proposal) => {
                  const count = responses.filter(
                    (item) => item.proposal_id === proposal.id
                  ).length;

                  return (
                    <article
                      key={proposal.id}
                      className={`rounded-xl border p-4 ${
                        selectedId === proposal.id
                          ? "border-rose-300 bg-rose-50/50"
                          : "border-slate-200"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(proposal.id)}
                        className="block w-full text-left"
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-bold">{proposal.title}</span>
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                              proposal.published
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {proposal.published ? "Published" : "Draft"}
                          </span>
                        </span>
                        <span className="mt-2 block text-xs text-slate-500">
                          {count} response{count === 1 ? "" : "s"} · Created{" "}
                          {dateLabel(proposal.created_at)}
                        </span>
                        <span className="mt-2 block text-xs font-semibold text-slate-700">
                          {proposal.attachment_name
                            ? `PDF attached: ${proposal.attachment_name}`
                            : "No PDF attached"}
                        </span>
                      </button>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {proposal.attachment_path && (
                          <button
                            type="button"
                            onClick={() => void openPdf(proposal)}
                            className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
                          >
                            View PDF
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => editProposal(proposal)}
                          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={workingId === proposal.id}
                          onClick={() =>
                            void setPublished(proposal, !proposal.published)
                          }
                          className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                        >
                          {workingId === proposal.id
                            ? "Working..."
                            : proposal.published
                              ? "Unpublish"
                              : "Publish"}
                        </button>
                        <button
                          type="button"
                          disabled={workingId === proposal.id}
                          onClick={() => void deleteProposal(proposal)}
                          className="rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Representative responses</h2>
              <p className="mt-1 text-sm text-slate-600">
                {selected
                  ? selected.title
                  : "Select a proposal above to view responses."}
              </p>
            </div>

            {selected && (
              <div className="flex gap-2 text-xs font-semibold">
                <span className="rounded-full bg-emerald-100 px-3 py-2 text-emerald-800">
                  Accepted: {accepted}
                </span>
                <span className="rounded-full bg-red-100 px-3 py-2 text-red-800">
                  Rejected: {rejected}
                </span>
              </div>
            )}
          </div>

          {!selected ? (
            <p className="py-6 text-sm text-slate-500">
              No proposal selected.
            </p>
          ) : selectedResponses.length === 0 ? (
            <p className="py-6 text-sm text-slate-500">
              No representatives have responded to this proposal yet.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3">Representative</th>
                    <th className="px-3 py-3">Organization</th>
                    <th className="px-3 py-3">Decision</th>
                    <th className="px-3 py-3">Responded</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedResponses.map((response) => {
                    const partner = partnerById.get(response.user_id);

                    return (
                      <tr
                        key={response.id}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="px-3 py-4">
                          <div className="font-semibold">
                            {partnerName(partner)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {partner?.email || response.user_id}
                          </div>
                        </td>
                        <td className="px-3 py-4 text-slate-600">
                          {partner?.organization_name ||
                            partner?.organization ||
                            "—"}
                        </td>
                        <td className="px-3 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                              response.decision === "accepted"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {response.decision === "accepted"
                              ? "Accepted"
                              : "Rejected"}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-slate-600">
                          {dateLabel(response.responded_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {selected && (
            <p className="mt-4 text-xs text-slate-500">
              Representatives who have not responded are not listed here.
              Their status is pending until they submit a decision.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
