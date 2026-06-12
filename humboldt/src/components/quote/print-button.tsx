"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <Button onClick={() => window.print()} type="button">
      <Printer className="h-4 w-4" />
      Imprimir / PDF
    </Button>
  );
}
