import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/src/auth/AuthContext";

export default function AuthLayout() {
  const { isReady, isAuthenticated } = useAuth();

  if (!isReady) return null;
  if (isAuthenticated) return <Redirect href={"/(tabs)" as any} />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
