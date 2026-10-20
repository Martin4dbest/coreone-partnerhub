"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";

type Resource = {
  id: string;
  title: string;
  description: string;
  file_path: string;
  file_name: string;
  file_type: "pdf" | "docx";
};

const BUCKET = "coreone-public-resources";

export default function PublicResources() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadResources() {
      const { data, error: queryError } = await supabase
        .from("coreone_partnerhub_resources")
        .select("id, title, description, file_path, file_name, file_type")
        .eq("published", true)
        .order("created_at", { ascending: false });

      if (queryError) {
        setError("CoreOne resources are temporarily unavailable.");
      } else {
        setResources((data ?? []) as Resource[]);
      }

      setLoading(false);
    }

    void loadResources();
  }, []);

  function fileUrl(resource: Resource) {
    return supabase.storage.from(BUCKET).getPublicUrl(resource.file_path)
      .data.publicUrl;
  }

  async function download(resource: Resource) {
    const url = fileUrl(resource);

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = resource.file_name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <section id="coreone-resources" className="section">
      <div className="container">
        <div className="section-heading">
          <span className="eyebrow eyebrow-light">COREONE RESOURCES</span>
          <h2>Discover what <span>CoreOne can do.</span></h2>
          <p>
            Explore our product guides, brochures and information documents
            to learn more about CoreOne and how it supports schools.
          </p>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Loading CoreOne resources...
          </p>
        ) : error ? (
          <p className="py-6 text-center text-sm text-slate-600">{error}</p>
        ) : resources.length === 0 ? (
          <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <h3 className="text-lg font-bold text-slate-900">
              CoreOne resources are coming soon
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Our product documents will appear here when they are published.
              Please check back soon.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {resources.map((resource) => (
              <article
                key={resource.id}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-sm font-extrabold text-rose-700">
                    {resource.file_type.toUpperCase()}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    CoreOne document
                  </span>
                </div>

                <h3 className="mt-5 text-lg font-bold text-slate-900">
                  {resource.title}
                </h3>

                {resource.description && (
                  <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">
                    {resource.description}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                  {resource.file_type === "pdf" && (
                    <a
                      href={fileUrl(resource)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-700"
                    >
                      View PDF ↗
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => void download(resource)}
                    className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-800 hover:bg-rose-100"
                  >
                    Download
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
