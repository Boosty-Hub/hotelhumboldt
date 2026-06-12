import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  QUOTE_STATUS_COLORS,
  QUOTE_STATUS_LABELS,
  type QuoteStatus,
} from "@/lib/constants";

export function QuoteStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const s = status as QuoteStatus;
  return (
    <Badge
      variant="outline"
      className={cn(QUOTE_STATUS_COLORS[s] ?? "", "font-medium", className)}
    >
      {QUOTE_STATUS_LABELS[s] ?? status}
    </Badge>
  );
}
