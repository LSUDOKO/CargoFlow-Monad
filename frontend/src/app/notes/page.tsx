import type { Metadata } from "next";
import { NotesView } from "@/components/notes/NotesView";

export const metadata: Metadata = {
  title: "Cargo Notes",
  description: "Trade financier positions in live shipments, marked on chain to the cargo's own evidence, on Monad.",
};

export default function NotesPage() {
  return <NotesView />;
}
