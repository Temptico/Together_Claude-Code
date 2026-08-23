import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/i18n/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest, ApiError } from "@/lib/queryClient";
import type { User } from "@shared/schema";

export function EditProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState(user!.name);
  const [email, setEmail] = useState(user!.email);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      const patch: any = { name, email };
      if (newPin) {
        patch.pin = newPin;
        patch.currentPin = currentPin;
      }
      return apiRequest<User>("PATCH", `/api/users/${user!.id}`, patch);
    },
    onSuccess: (updated) => {
      setUser(updated);
      qc.invalidateQueries({ queryKey: ["/api/home", user!.id] });
      onOpenChange(false);
      setNewPin("");
      setConfirmNewPin("");
      setCurrentPin("");
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("common.error")),
  });

  const pinRegex = /^\d{4,6}$/;
  const pinChangeValid = !newPin || (pinRegex.test(newPin) && newPin === confirmNewPin && currentPin.length > 0);

  const handleSave = () => {
    setError(null);
    if (newPin && newPin !== confirmNewPin) {
      setError(t("auth.pinMismatch"));
      return;
    }
    if (newPin && !pinRegex.test(newPin)) {
      setError(t("auth.pin"));
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("profile.editProfile")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-name">{t("auth.name")}</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-email">{t("auth.email")}</Label>
            <Input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="mt-1 flex flex-col gap-3 rounded-2xl bg-muted p-3">
            <p className="text-xs font-bold text-muted-foreground">{t("profile.changePin")}</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-pin">{t("profile.newPin")}</Label>
              <Input
                id="new-pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                className="tracking-[0.3em]"
              />
            </div>
            {newPin && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirm-new-pin">{t("auth.confirmPin")}</Label>
                  <Input
                    id="confirm-new-pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={confirmNewPin}
                    onChange={(e) => setConfirmNewPin(e.target.value)}
                    className="tracking-[0.3em]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="current-pin">{t("profile.currentPin")}</Label>
                  <Input
                    id="current-pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value)}
                    className="tracking-[0.3em]"
                  />
                </div>
              </>
            )}
          </div>

          {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("profile.cancel")}
          </Button>
          <Button disabled={!name.trim() || !email.trim() || !pinChangeValid || mutation.isPending} onClick={handleSave}>
            {t("profile.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
