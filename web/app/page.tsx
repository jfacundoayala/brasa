import type { Metadata } from "next";
import Brasa from "@/components/Brasa";

/** Dirección canónica de la portada. */
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Page() {
  return <Brasa />;
}
