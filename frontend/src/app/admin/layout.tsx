import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Panel de administración", template: "%s · Panel FerreMax" },
  robots: { index: false, follow: false },
};

export default function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  return children;
}
