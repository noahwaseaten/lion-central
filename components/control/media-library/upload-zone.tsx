"use client";

import { UploadSimple } from "@phosphor-icons/react";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

export function UploadZone({
  folder,
  onUpload,
}: {
  folder: string | null;
  onUpload: (files: FileList | File[], folder: string | null) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | File[]) => {
    setUploading(true);
    try {
      await onUpload(files, folder);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors",
        dragging && "border-signal bg-signal/5",
      )}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/mp4,video/webm,video/quicktime"
        multiple
        className="hidden"
        onChange={(e) => { if (e.target.files?.length) void handleFiles(e.target.files); }}
      />
      <UploadSimple className="size-8 text-muted-foreground" />
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="text-sm font-medium text-foreground outline-none hover:underline focus-visible:underline disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Click to upload"}
        </button>
        <p className="text-xs text-muted-foreground">or drag & drop · images & video</p>
      </div>
    </div>
  );
}
