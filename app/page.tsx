import { Suspense } from "react";
import { CrediSafeExperience } from "@/components/CrediSafeExperience";
import { AuthRootCallbackBridge } from "@/components/mvp/AuthRootCallbackBridge";

export default function Home() {
  return (
    <>
      {/* Some older Supabase email templates return to the site root with ?code=.
          Forward that code to the server callback before rendering the home page. */}
      <Suspense fallback={null}>
        <AuthRootCallbackBridge />
      </Suspense>
      <CrediSafeExperience />
    </>
  );
}
