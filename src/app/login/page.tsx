import { Suspense } from "react";
import LoginClient from "@/app/components/LoginClient";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginClient />
    </Suspense>
  );
}