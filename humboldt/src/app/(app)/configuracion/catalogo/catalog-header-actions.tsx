"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Tags } from "lucide-react";
import { ProductDialog } from "./product-dialog";
import { CategoriesDialog } from "./categories-dialog";
import type { CategoryOption, CategoryRow, SupplierOption } from "./catalog-shared";

export function CatalogHeaderActions({
  categories,
  categoryRows,
  suppliers,
  showCosts,
}: {
  categories: CategoryOption[];
  categoryRows: CategoryRow[];
  suppliers: SupplierOption[];
  showCosts: boolean;
}) {
  const [productOpen, setProductOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => setCategoriesOpen(true)}>
        <Tags className="h-3.5 w-3.5" />
        Categorías
      </Button>
      <Button onClick={() => setProductOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        Nuevo producto
      </Button>

      <ProductDialog
        open={productOpen}
        onOpenChange={setProductOpen}
        product={null}
        categories={categories}
        suppliers={suppliers}
        showCosts={showCosts}
      />
      <CategoriesDialog
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        categories={categoryRows}
      />
    </div>
  );
}
