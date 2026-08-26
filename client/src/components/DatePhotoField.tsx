import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { compressImageFile } from "@/lib/imageCompress";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/i18n/i18n";

export function DatePhotoField({
  plannedDateId,
  photo,
  invalidateKeys,
}: {
  plannedDateId: number;
  photo: string | null | undefined;
  invalidateKeys: unknown[][];
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (nextPhoto: string | null) =>
      apiRequest("PATCH", `/api/dates/planned/${plannedDateId}`, { userId: user!.id, photo: nextPhoto }),
    onSuccess: () => {
      for (const key of invalidateKeys) qc.invalidateQueries({ queryKey: key });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("common.error")),
  });

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await compressImageFile(file);
      mutation.mutate(dataUrl);
    } catch {
      setError(t("dates.photoError"));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* No `capture` attribute — that forces the camera straight open on
          mobile, skipping the native picker's option to choose from the
          photo library instead. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {photo ? (
        <div className="relative">
          <img src={photo} alt={t("dates.photoAlt")} className="w-full rounded-2xl object-cover" style={{ maxHeight: 220 }} />
          <button
            onClick={() => mutation.mutate(null)}
            disabled={mutation.isPending}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
            aria-label={t("dates.removePhoto")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          className="self-start"
          disabled={mutation.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          <Camera className="h-4 w-4" /> {mutation.isPending ? t("dates.photoUploading") : t("dates.addPhoto")}
        </Button>
      )}
      {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
    </div>
  );
}
