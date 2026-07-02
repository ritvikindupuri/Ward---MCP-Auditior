import { createFileRoute } from "@tanstack/react-router";
import { AuthShell } from "./sign-in";

export const Route = createFileRoute("/sign-up")({
  head: () => ({
    meta: [
      { title: "Sign up — Sable" },
      { name: "description", content: "Create your Sable account." },
    ],
  }),
  component: () => <AuthShell mode="signup" />,
});
