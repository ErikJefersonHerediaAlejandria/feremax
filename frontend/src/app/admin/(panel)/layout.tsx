import { MarcoAdmin } from "@/components/admin/marco";

// El panel se renderiza en el cliente: sus datos dependen de la cookie httpOnly del admin.
export default function LayoutPanel({ children }: LayoutProps<"/admin">) {
  return <MarcoAdmin>{children}</MarcoAdmin>;
}
