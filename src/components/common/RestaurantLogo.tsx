import { cn } from "@/lib/utils";

interface RestaurantLogoProps {
  logoUrl?: string | null;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-base",
  xl: "h-24 w-24 text-xl",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

export function RestaurantLogo({
  logoUrl,
  name,
  size = "md",
  className,
}: RestaurantLogoProps) {
  const initials = getInitials(name || "R");

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`Logo ${name}`}
        className={cn(
          "rounded-full object-cover border border-border",
          sizeClasses[size],
          className
        )}
        onError={(e) => {
          // Fallback to initials if image fails to load
          e.currentTarget.style.display = "none";
          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
          if (fallback) fallback.style.display = "flex";
        }}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center bg-muted text-muted-foreground font-semibold border border-border",
        sizeClasses[size],
        className
      )}
    >
      {initials}
    </div>
  );
}
