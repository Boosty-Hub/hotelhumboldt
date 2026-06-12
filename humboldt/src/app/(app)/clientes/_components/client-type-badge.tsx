import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CLIENT_TYPE_COLORS,
  CLIENT_TYPE_LABELS,
  isClientType,
} from "../_lib/shared";

export function ClientTypeBadge({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  if (!isClientType(type)) {
    return (
      <Badge variant="outline" className={className}>
        {type}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn(CLIENT_TYPE_COLORS[type], className)}
    >
      {CLIENT_TYPE_LABELS[type]}
    </Badge>
  );
}
