"use client";

import { useId, useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  createPerformanceCertificate,
  createPerformanceCertificateUpload,
} from "@/actions/performanceCertificates";
import { useAppDispatch } from "@/lib/hooks";
import { fetchPerformanceCertificates } from "@/lib/slices/performanceCertificatesSlice";
import { Button, IconButton } from "@/components/v2/ui/button";
import { toastError } from "@/components/v2/ui/errors";
import { Dialog } from "@/components/v2/ui/overlay";

async function uploadOne(file: File) {
  const contentType = file.type || "application/octet-stream";
  const { uploadUrl, publicUrl } = await createPerformanceCertificateUpload(
    file.name,
    contentType,
  );
  const res = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": contentType },
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  await createPerformanceCertificate(file.name, publicUrl);
}

export function UploadCertificateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const dispatch = useAppDispatch();
  const inputRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Start over each time it opens.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setFiles([]);
  }

  const add = (incoming: FileList | null) => {
    if (incoming?.length) setFiles((prev) => [...prev, ...Array.from(incoming)]);
  };

  const submit = async () => {
    if (!files.length) return;
    setUploading(true);
    try {
      await Promise.all(files.map(uploadOne));
      toast.success(
        `Uploaded ${files.length} certificate${files.length !== 1 ? "s" : ""}`,
      );
      onOpenChange(false);
    } catch (err) {
      toastError("Certificate upload failed", err);
    } finally {
      setUploading(false);
      dispatch(fetchPerformanceCertificates());
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Upload performance certificates"
      description="Each file is stored and added as a new row."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form={formId}
            loading={uploading}
            disabled={files.length === 0}
          >
            {files.length > 0 ? `Upload ${files.length}` : "Upload"}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.doc,.docx,.xls,.xlsx"
          className="sr-only"
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          icon={<Upload className="size-3.5" />}
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          Choose files
        </Button>
        {files.length > 0 ? (
          <ul className="flex flex-col">
            {files.map((file, i) => (
              <li
                key={`${file.name}-${file.size}-${i}`}
                className="flex items-center gap-2 border-b py-1.5 last:border-b-0"
              >
                <FileText className="size-4 text-ink-3" aria-hidden />
                <span className="min-w-0 flex-1 truncate" title={file.name}>
                  {file.name}
                </span>
                <IconButton
                  size="sm"
                  label={`Remove ${file.name}`}
                  disabled={uploading}
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                >
                  <X className="size-3.5" />
                </IconButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-3">No files chosen.</p>
        )}
      </form>
    </Dialog>
  );
}
