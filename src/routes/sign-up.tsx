import { createFileRoute } from "@tanstack/react-router";
import { AuthShell } from "./sign-in";

export const Route = createFileRoute("/sign-up")({
  head: () => ({
    meta: [
      { title: "Sign up — Adversa" },
      { name: "description", content: "Create your Adversa account." },
    ],
  }),
  component: () => <AuthShell mode="signup" />,
});
