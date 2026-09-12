import { cn } from "@/lib/utils";

const sizes = { sm: "w-28", md: "w-36", lg: "w-48" } as const;

type BrandLogoProps = {
  className?: string;
  size?: keyof typeof sizes;
  compact?: boolean;
};

/** The single, official ESADS BEAUTY CRM brand asset used throughout the product. */
export function BrandLogo({ className, size = "md", compact = false }: BrandLogoProps) {
  return (
    <img
      src="/brand/esads-beauty-logo.png"
      alt="ESADS BEAUTY CRM"
      width="640"
      height="240"
      decoding="async"
      className={cn(
        "h-auto max-w-full object-contain",
        sizes[size],
        compact && "w-24",
        className
      )}
    />
  );
}
