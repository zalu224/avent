"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ImagePlus, Sparkles, X } from "lucide-react";
import { EMPTY_EVENT_FIELDS, EventFieldInputs, type EventFields } from "./event-fields";
import { analyzeFlyer, createEvent, type CreateEventState } from "@/lib/actions/events";
import type { ExtractedEvent } from "@/lib/ai/extract-event";
import { prepareImage } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";

type Upload = { url: string; path: string };

function fieldsFromExtraction(e: ExtractedEvent, prev: EventFields): EventFields {
  const start = e.date ? `${e.date}T${e.start_time ?? "21:00"}` : prev.starts_at_local;
  let end = prev.ends_at_local;
  if (e.date && e.end_time) {
    // An end time earlier than the start means it runs past midnight.
    const endsNextDay = e.start_time ? e.end_time < e.start_time : false;
    const endDate = new Date(`${e.date}T00:00:00`);
    if (endsNextDay) endDate.setDate(endDate.getDate() + 1);
    const y = endDate.getFullYear();
    const m = String(endDate.getMonth() + 1).padStart(2, "0");
    const d = String(endDate.getDate()).padStart(2, "0");
    end = `${y}-${m}-${d}T${e.end_time}`;
  }
  return {
    title: e.title ?? prev.title,
    category: e.category ?? prev.category,
    starts_at_local: start,
    ends_at_local: end,
    venue_name: e.venue_name ?? prev.venue_name,
    address: e.address ?? prev.address,
    city: e.city ?? prev.city,
    lineup: e.lineup.length ? e.lineup.join(", ") : prev.lineup,
    tags: e.tags.length ? e.tags.join(", ") : prev.tags,
    price: e.price ?? prev.price,
    ticket_url: e.ticket_url ?? prev.ticket_url,
    description: e.description ?? prev.description,
  };
}

export function NewPostForm({ userId, defaultCity }: { userId: string; defaultCity?: string | null }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [upload, setUpload] = useState<Upload | null>(null);
  const [caption, setCaption] = useState("");
  const [fields, setFields] = useState<EventFields>({
    ...EMPTY_EVENT_FIELDS,
    city: defaultCity ?? "",
  });
  const [step, setStep] = useState<"compose" | "review">("compose");
  const [busy, setBusy] = useState<"upload" | "analyze" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ai, setAi] = useState<{ used: boolean; confidence: number | null }>({
    used: false,
    confidence: null,
  });
  const fileInput = useRef<HTMLInputElement>(null);

  const [state, formAction, submitting] = useActionState<CreateEventState, FormData>(
    createEvent,
    {}
  );

  const tz =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

  // Release the previous preview URL whenever it changes or on unmount.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function pickFile(next: File | null) {
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : null);
    setUpload(null);
    setNotice(null);
  }

  async function ensureUploaded(): Promise<Upload | null> {
    if (upload) return upload;
    if (!file) return null;
    setBusy("upload");
    try {
      const prepared = await prepareImage(file);
      const path = `${userId}/${crypto.randomUUID()}.${prepared.ext}`;
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("event-images")
        .upload(path, prepared.blob, { contentType: prepared.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("event-images").getPublicUrl(path);
      const result = { url: data.publicUrl, path };
      setUpload(result);
      return result;
    } catch (err) {
      console.error(err);
      setNotice("The photo didn't upload. Check your connection and try again.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function readFlyer() {
    setNotice(null);
    if (!file && !caption.trim()) {
      setNotice("Add a flyer photo or write a caption first.");
      return;
    }
    const uploaded = await ensureUploaded();
    if (file && !uploaded) return;

    setBusy("analyze");
    try {
      const result = await analyzeFlyer({ imageUrl: uploaded?.url, caption });
      if (result.ok) {
        if (!result.event.is_event) {
          setNotice("That doesn't look like an event flyer. You can still fill in the details.");
        }
        setFields((prev) => fieldsFromExtraction(result.event, prev));
        setAi({ used: true, confidence: result.event.confidence });
      } else {
        setNotice(result.error);
      }
      setStep("review");
    } finally {
      setBusy(null);
    }
  }

  async function skipToForm() {
    setNotice(null);
    const uploaded = await ensureUploaded();
    if (file && !uploaded) return;
    setStep("review");
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Flyer + caption */}
      <section className="card p-4">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />

        {preview ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Selected flyer"
              className="max-h-[28rem] w-full rounded-lg object-contain"
            />
            {step === "compose" && (
              <button
                type="button"
                onClick={() => pickFile(null)}
                aria-label="Remove photo"
                className="absolute right-2 top-2 rounded-full bg-ink/80 p-1.5 text-cream hover:bg-ink"
              >
                <X size={16} aria-hidden />
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-plum-3 px-4 py-10 text-lilac-2 hover:border-lilac hover:text-cream"
          >
            <ImagePlus size={28} aria-hidden />
            <span className="font-medium">Add the flyer or a photo</span>
            <span className="text-sm text-lilac">Screenshots work too</span>
          </button>
        )}

        <label htmlFor="caption" className="field-label mt-4">
          Caption
        </label>
        <textarea
          id="caption"
          rows={2}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={2000}
          placeholder="Who's coming to this? Doors at 10, tickets at the door."
          className="field resize-y"
          disabled={step === "review"}
        />

        {step === "compose" && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={readFlyer}
              disabled={busy !== null}
              className="btn btn-primary"
            >
              <Sparkles size={16} aria-hidden />
              {busy === "upload"
                ? "Uploading…"
                : busy === "analyze"
                  ? "Reading the flyer…"
                  : "Read the flyer"}
            </button>
            <button
              type="button"
              onClick={skipToForm}
              disabled={busy !== null}
              className="btn btn-ghost"
            >
              Fill in the details myself
            </button>
          </div>
        )}

        {notice && (
          <p role="status" className="mt-3 text-sm text-glow">
            {notice}
          </p>
        )}
      </section>

      {/* Review + save */}
      {step === "review" && (
        <form action={formAction} className="card flex flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold">Check the details</h2>
              <p className="mt-1 text-sm text-lilac">
                {ai.used
                  ? `Filled in from the flyer${
                      ai.confidence !== null ? ` (${Math.round(ai.confidence * 100)}% sure)` : ""
                    }. Fix anything that's off.`
                  : "Fill in what you know. Only the title and start time are required."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep("compose")}
              className="btn btn-ghost shrink-0 text-sm"
            >
              Back
            </button>
          </div>

          <input type="hidden" name="tz" value={tz} />
          <input type="hidden" name="caption" value={caption} />
          <input type="hidden" name="image_url" value={upload?.url ?? ""} />
          <input type="hidden" name="image_path" value={upload?.path ?? ""} />
          <input type="hidden" name="ai_extracted" value={ai.used ? "true" : "false"} />
          <input type="hidden" name="ai_confidence" value={ai.confidence ?? ""} />

          <EventFieldInputs fields={fields} onChange={setFields} />

          {state.error && (
            <p role="alert" className="text-sm text-flare">
              {state.error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? "Posting…" : "Post to your calendar"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
