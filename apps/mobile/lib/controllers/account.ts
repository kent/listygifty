import { useCallback, useRef, useState } from "react";
import { Alert } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { accountService, clearCachedResources } from "@/lib/api";
import { humanizeError } from "@/lib/error-message";

export function useDeleteAccountController() {
  const { signOut } = useAuth();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);

  const open = useCallback(() => {
    setError("");
    setVisible(true);
  }, []);

  const close = useCallback(() => {
    if (!busy.current) setVisible(false);
  }, []);

  const deleteAccount = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setDeleting(true);
    setError("");
    try {
      await accountService.delete();
    } catch (err) {
      setError(`We couldn't delete your account. ${humanizeError(err)}`);
      setDeleting(false);
      busy.current = false;
      return;
    }

    clearCachedResources();
    setVisible(false);
    // The server already deleted this Clerk user, so ending the session can
    // fail. That must not strand someone on an account that no longer exists.
    await signOut().catch(() => undefined);
    router.replace("/auth/login");
  }, [router, signOut]);

  const confirm = useCallback(() => {
    if (busy.current) return;
    Alert.alert("Delete your account?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete Account", style: "destructive", onPress: deleteAccount },
    ]);
  }, [deleteAccount]);

  return { visible, deleting, error, open, close, confirm };
}
