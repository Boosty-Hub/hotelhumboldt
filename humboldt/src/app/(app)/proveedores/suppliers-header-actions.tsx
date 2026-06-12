"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SupplierDialog } from "./supplier-dialog";

export function SuppliersHeaderActions() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        Nuevo proveedor
      </Button>
      <SupplierDialog open={open} onOpenChange={setOpen} supplier={null} />
    </>
  );
}
