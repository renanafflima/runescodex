import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/src/auth/AuthContext";
import { mobileGate } from "@/src/domain/premium-access";

export default function AuthLayout() {
  const { isReady, isAuthenticated, premiumAccess } = useAuth();
  const gate = mobileGate({ isReady, isAuthenticated, premiumAccess });

  if (gate === "loading") return null;
  if (gate === "checkout") return <Redirect href={"/checkout" as any} />;
  if (gate === "app") return <Redirect href={"/(tabs)" as any} />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
