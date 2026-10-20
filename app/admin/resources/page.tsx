"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase/client";

type Resource = {
  id: string;
  title: string;
  description: string;
  file_path: string;
  file_name: string;
  file_type: "pdf" | "docx";
  published: boolean;
  created_at: string;
  updated_at: string;
};

const TABLE = "coreone_partnerhub_resources";
const BUCKET = "coreone-public-resources";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function safeFileName(name: string) {
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-150);
}

function getFileType(file: File): "pdf" | "docx" | null {
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf") && file.type === "application/pdf") {
    return "pdf";
  }

  if (
    name.endsWith(".docx") &&
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }

  return null;
}

export default function AdminResourcesPage() {
  const router = useRouter();

  const [resources, setResources] = useState<Resource[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadResources = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      const { data: isAdmin, error: adminError } = await supabase.rpc(
        "is_coreone_partnerhub_admin"
      );

      if (adminError) throw adminError;

      if (isAdmin !== true) {
        setError("Administrator access is required to manage CoreOne resources.");
        return;
      }

      const { data, error: listError } = await supabase
        .from(TABLE)
        .select("*")
        .order("created_at", { ascending: false });

      if (listError) throw listError;

      setResources((data ?? []) as Resource[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load CoreOne resources."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadResources();
  }, [loadResources]);

  function clearForm() {
    setTitle("");
    setDescription("");
    setSelectedFile(null);
    setEditing(null);
    setPublished(false);
  }

  function startEditing(resource: Resource) {
    setEditing(resource);
    setTitle(resource.title);
    setDescription(resource.description);
    setSelectedFile(null);
    setPublished(resource.published);
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleFileChange(file?: File) {
    setError("");
    setSelectedFile(null);

    if (!file) return;

    if (!getFileType(file)) {
      setError("Choose a valid PDF or Word document (.docx).");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("The document must be 10 MB or smaller.");
      return;
    }

    setSelectedFile(file);
  }

  async function uploadFile(file: File) {
    const fileType = getFileType(file);

    if (!fileType) {
      throw new Error("Choose a valid PDF or Word document (.docx).");
    }

    const path = `${Date.now()}-${crypto.randomUUID()}/${safeFileName(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    return {
      file_path: path,
      file_name: file.name,
      file_type: fileType,
    };
  }

  async function saveResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!title.trim()) {
      setError("Enter a document title.");
      return;
    }

    if (!editing && !selectedFile) {
      setError("Choose a PDF or Word document to upload.");
      return;
    }

    setSaving(true);
    let newUploadPath: string | null = null;

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      const { data: isAdmin, error: adminError } = await supabase.rpc(
        "is_coreone_partnerhub_admin"
      );

      if (adminError) throw adminError;
      if (isAdmin !== true) {
        throw new Error("Administrator access is required.");
      }

      let attachment: {
        file_path: string;
        file_name: string;
        file_type: "pdf" | "docx";
      } | null = null;

      if (selectedFile) {
        attachment = await uploadFile(selectedFile);
        newUploadPath = attachment.file_path;
      }

      const values = {
        title: title.trim(),
        description: description.trim(),
        published,
        updated_at: new Date().toISOString(),
        ...(attachment ?? {}),
      };

      if (editing) {
        const { error: updateError } = await supabase
          .from(TABLE)
          .update(values)
          .eq("id", editing.id);

        if (updateError) throw updateError;

        if (
          attachment &&
          editing.file_path &&
          editing.file_path !== attachment.file_path
        ) {
          const { error: removeError } = await supabase.storage
            .from(BUCKET)
            .remove([editing.file_path]);

          if (removeError) {
            setMessage(
              "Resource saved, but the previous file could not be removed."
            );
          }
        }
      } else {
        const { error: insertError } = await supabase.from(TABLE).insert({
          ...values,
          ...attachment,
          created_by: authData.user.id,
        });

        if (insertError) throw insertError;
      }

      newUploadPath = null;
      clearForm();
      setMessage(
        editing
          ? "Resource updated successfully."
          : "Resource uploaded successfully."
      );
      await loadResources();
    } catch (err) {
      if (newUploadPath) {
        await supabase.storage.from(BUCKET).remove([newUploadPath]);
      }

      setError(
        err instanceof Error ? err.message : "Unable to save the resource."
      );
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(resource: Resource) {
    setWorkingId(resource.id);
    setError("");
    setMessage("");

    try {
      const { error: updateError } = await supabase
        .from(TABLE)
        .update({
          published: !resource.published,
          updated_at: new Date().toISOString(),
        })
        .eq("id", resource.id);

      if (updateError) throw updateError;

      setMessage(
        resource.published
          ? "Resource unpublished. It is no longer listed on the public homepage."
          : "Resource published on the public homepage."
      );

      await loadResources();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to change publication status."
      );
    } finally {
      setWorkingId("");
    }
  }

  async function deleteResource(resource: Resource) {
    if (
      !window.confirm(
        `Delete "${resource.title}" and its uploaded file? This cannot be undone.`
      )
    ) {
      return;
    }

    setWorkingId(resource.id);
    setError("");
    setMessage("");

    try {
      const { error: deleteError } = await supabase
        .from(TABLE)
        .delete()
        .eq("id", resource.id);

      if (deleteError) throw deleteError;

      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([resource.file_path]);

      if (storageError) {
        setMessage(
          "Resource record deleted, but its stored file could not be removed. Check Supabase Storage."
        );
      } else {
        setMessage("Resource deleted successfully.");
      }

      if (editing?.id === resource.id) clearForm();
      await loadResources();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete the resource."
      );
    } finally {
      setWorkingId("");
    }
  }

  function publicUrl(resource: Resource) {
    return supabase.storage.from(BUCKET).getPublicUrl(resource.file_path)
      .data.publicUrl;
  }

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-rose-700">
            Administration
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
            CoreOne Resources
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Upload product brochures, feature guides and other documents for
            public visitors to view or download from the homepage.
          </p>
        </div>
        <Link
          href="/admin"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          ← Admin dashboard
        </Link>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
        </p>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-slate-900">
          {editing ? "Edit resource" : "Upload a resource"}
        </h2>

        <form onSubmit={saveResource} className="mt-5 space-y-4">
          <div>
            <label htmlFor="resource-title" className="block text-sm font-semibold text-slate-800">
              Document title
            </label>
            <input
              id="resource-title"
              required
              maxLength={180}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. CoreOne Product Brochure"
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label htmlFor="resource-description" className="block text-sm font-semibold text-slate-800">
              Description
            </label>
            <textarea
              id="resource-description"
              rows={3}
              maxLength={1500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Briefly explain what visitors will learn from this document."
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-rose-500"
            />
          </div>

          <div className="rounded-xl border-2 border-dashed border-rose-200 bg-rose-50/50 p-4">
            <label htmlFor="resource-file" className="block text-sm font-bold text-slate-900">
              PDF or Word document
            </label>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              PDF or DOCX only. Maximum size: 10 MB.
              {editing ? " Select a new file only if you want to replace the current one." : ""}
            </p>
            <input
              id="resource-file"
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => handleFileChange(event.target.files?.[0])}
              className="mt-3 block w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-rose-600 file:px-3 file:py-2 file:font-semibold file:text-white hover:file:bg-rose-700"
            />

            {selectedFile && (
              <p className="mt-3 break-all text-sm font-semibold text-emerald-800">
                Selected: {selectedFile.name}
              </p>
            )}

            {editing && !selectedFile && (
              <p className="mt-3 break-all text-sm text-slate-700">
                Current file: <strong>{editing.file_name}</strong>
              </p>
            )}
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
            <input
              type="checkbox"
              checked={published}
              onChange={(event) => setPublished(event.target.checked)}
              className="mt-1 h-4 w-4 accent-rose-600"
            />
            <span>
              <span className="block text-sm font-bold text-slate-900">
                Publish on public homepage
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-600">
                When enabled, visitors can access this document without signing in.
              </span>
            </span>
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : editing ? "Save changes" : "Upload resource"}
            </button>
            {editing && (
              <button
                type="button"
                onClick={clearForm}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">Uploaded documents</h2>
          <button
            type="button"
            onClick={() => void loadResources()}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh list
          </button>
        </div>

        {loading ? (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading resources...
          </p>
        ) : resources.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            No resources have been uploaded yet.
          </p>
        ) : (
          <div className="space-y-3">
            {resources.map((resource) => (
              <article
                key={resource.id}
                className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-slate-900">{resource.title}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      resource.published
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {resource.published ? "Published" : "Draft"}
                    </span>
                    <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold uppercase text-rose-700">
                      {resource.file_type}
                    </span>
                  </div>
                  {resource.description && (
                    <p className="mt-1 text-sm leading-5 text-slate-600">
                      {resource.description}
                    </p>
                  )}
                  <p className="mt-2 break-all text-xs text-slate-500">
                    {resource.file_name}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <a
                    href={publicUrl(resource)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Open file ↗
                  </a>
                  <button
                    type="button"
                    onClick={() => startEditing(resource)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={workingId === resource.id}
                    onClick={() => void togglePublished(resource)}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {workingId === resource.id
                      ? "Working..."
                      : resource.published
                        ? "Unpublish"
                        : "Publish"}
                  </button>
                  <button
                    type="button"
                    disabled={workingId === resource.id}
                    onClick={() => void deleteResource(resource)}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
