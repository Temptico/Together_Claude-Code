import { useEffect, useState } from "react";
import { Instagram } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/i18n/i18n";
import { renderStoryCard, saveStoryImage, shareStoryImage, type StoryCard } from "@/lib/storyCard";

// "Share to story": draws the card, shows it, and shares it from a second
// tap. Phones only open the share sheet straight from a tap, and drawing
// the card (fonts, photo) can take longer than that allows, so the image is
// ready by the time "Share" is pressed.
export function ShareStoryButton({
  card,
  label,
  size = "sm",
  variant = "outline",
  className,
}: {
  card: Omit<StoryCard, "footer">;
  label?: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBlob(null);
    setFailed(false);
    renderStoryCard({ ...card, footer: t("share.footer") })
      .then((b) => {
        if (cancelled) return;
        setBlob(b);
        setUrl(URL.createObjectURL(b));
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
    // The card is rebuilt each render by the caller; drawing once per open is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  return (
    <>
      <Button size={size} variant={variant} className={className} onClick={() => setOpen(true)}>
        <Instagram className="mr-1 h-4 w-4" /> {label ?? t("share.button")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("share.title")}</DialogTitle>
            <DialogDescription>{t("share.hint")}</DialogDescription>
          </DialogHeader>
          {failed ? (
            <p className="text-sm text-destructive">{t("share.error")}</p>
          ) : url && blob ? (
            <>
              <img src={url} alt="" className="mx-auto max-h-[52vh] rounded-2xl shadow-md" />
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => void shareStoryImage(blob)}>
                  {t("share.share")}
                </Button>
                <Button variant="outline" onClick={() => saveStoryImage(blob)}>
                  {t("share.save")}
                </Button>
              </div>
            </>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground animate-pulse">{t("share.preparing")}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
