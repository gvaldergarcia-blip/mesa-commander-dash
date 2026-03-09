import { useRef, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface CopyData {
  headline: string;
  subheadline: string;
  priceOld?: string;
  priceNew?: string;
  discount?: string;
  urgency?: string;
  cta: string;
  caption: string;
  hashtags: string[];
}

interface PostLayoutPreviewProps {
  layout: string;
  copy: CopyData;
  imageUrl: string;
  restaurantName: string;
  logoUrl?: string | null;
  format?: "feed" | "story";
  onEditField?: (field: keyof CopyData, value: string) => void;
}

function EditableText({
  value,
  field,
  className,
  onEdit,
  style,
}: {
  value: string;
  field: keyof CopyData;
  className?: string;
  onEdit?: (field: keyof CopyData, value: string) => void;
  style?: React.CSSProperties;
}) {
  if (!value) return null;
  return (
    <div
      className={cn(className, onEdit && "cursor-text hover:outline hover:outline-2 hover:outline-white/30 rounded px-1 -mx-1")}
      contentEditable={!!onEdit}
      suppressContentEditableWarning
      onBlur={(e) => onEdit?.(field, e.currentTarget.textContent || "")}
      style={style}
    >
      {value}
    </div>
  );
}

export const PostLayoutPreview = forwardRef<HTMLDivElement, PostLayoutPreviewProps>(
  ({ layout, copy, imageUrl, restaurantName, logoUrl, format = "feed", onEditField }, ref) => {
    const isStory = format === "story";
    const containerStyle: React.CSSProperties = {
      width: isStory ? 1080 : 1080,
      height: isStory ? 1920 : 1080,
      position: "relative",
      overflow: "hidden",
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    };

    const DiscountBadge = () =>
      copy.discount ? (
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 40,
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #ef4444, #dc2626)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: 900,
            fontSize: 22,
            textAlign: "center",
            lineHeight: 1.1,
            boxShadow: "0 8px 32px rgba(239,68,68,0.5)",
            zIndex: 20,
          }}
        >
          {copy.discount}
        </div>
      ) : null;

    const PriceDisplay = ({ dark = false }: { dark?: boolean }) => {
      if (!copy.priceOld && !copy.priceNew) return null;
      return (
        <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
          {copy.priceOld && (
            <span
              style={{
                textDecoration: "line-through",
                opacity: 0.5,
                fontSize: 28,
                color: dark ? "#ffffff" : "#374151",
              }}
            >
              {copy.priceOld}
            </span>
          )}
          {copy.priceNew && (
            <span
              style={{
                fontSize: 48,
                fontWeight: 900,
                color: dark ? "#ffffff" : "#059669",
              }}
            >
              {copy.priceNew}
            </span>
          )}
        </div>
      );
    };

    const RestaurantFooter = ({ light = false }: { light?: boolean }) => (
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "24px 40px",
          background: light
            ? "linear-gradient(to top, rgba(255,255,255,0.95), transparent)"
            : "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 15,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {logoUrl && (
            <img
              src={logoUrl}
              alt=""
              style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }}
              crossOrigin="anonymous"
            />
          )}
          <span
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: light ? "#1f2937" : "#ffffff",
              letterSpacing: "0.05em",
            }}
          >
            {restaurantName}
          </span>
        </div>
      </div>
    );

    // ─── Layout: IMPACTO ──────────────────
    if (layout === "impacto") {
      return (
        <div ref={ref} style={{ ...containerStyle, background: "#0a0a0a" }}>
          {/* Background image with overlay */}
          <img
            src={imageUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.6,
              filter: "blur(2px) brightness(0.5)",
            }}
          />
          {/* Hero product image */}
          <div
            style={{
              position: "absolute",
              top: isStory ? "30%" : "20%",
              left: "50%",
              transform: "translateX(-50%)",
              width: isStory ? 600 : 560,
              height: isStory ? 600 : 560,
              borderRadius: "50%",
              overflow: "hidden",
              boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
              zIndex: 10,
            }}
          >
            <img
              src={imageUrl}
              alt=""
              crossOrigin="anonymous"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <DiscountBadge />
          {/* Headline */}
          <div
            style={{
              position: "absolute",
              top: isStory ? 80 : 60,
              left: 40,
              right: 160,
              zIndex: 15,
            }}
          >
            <EditableText
              value={copy.headline}
              field="headline"
              onEdit={onEditField}
              style={{
                fontSize: isStory ? 52 : 48,
                fontWeight: 900,
                color: "#ffffff",
                lineHeight: 1.1,
                textShadow: "0 4px 20px rgba(0,0,0,0.5)",
              }}
            />
            <EditableText
              value={copy.subheadline}
              field="subheadline"
              onEdit={onEditField}
              style={{
                fontSize: 22,
                color: "rgba(255,255,255,0.85)",
                marginTop: 12,
                textShadow: "0 2px 10px rgba(0,0,0,0.5)",
              }}
            />
          </div>
          {/* Price & CTA area */}
          <div
            style={{
              position: "absolute",
              bottom: isStory ? 180 : 100,
              left: 40,
              zIndex: 15,
            }}
          >
            <PriceDisplay dark />
            {copy.urgency && (
              <div style={{ fontSize: 18, color: "#fbbf24", fontWeight: 700, marginTop: 8 }}>
                {copy.urgency}
              </div>
            )}
            <EditableText
              value={copy.cta}
              field="cta"
              onEdit={onEditField}
              style={{
                marginTop: 16,
                padding: "14px 32px",
                background: "linear-gradient(135deg, hsl(142 76% 36%), hsl(142 72% 29%))",
                borderRadius: 12,
                color: "#ffffff",
                fontWeight: 800,
                fontSize: 20,
                display: "inline-block",
                boxShadow: "0 8px 24px rgba(16,185,129,0.4)",
              }}
            />
          </div>
          <RestaurantFooter />
        </div>
      );
    }

    // ─── Layout: CLEAN ──────────────────
    if (layout === "clean") {
      return (
        <div ref={ref} style={{ ...containerStyle, background: "#faf9f7" }}>
          {/* Left side - copy */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: isStory ? "100%" : "48%",
              height: isStory ? "45%" : "100%",
              padding: isStory ? "60px 40px" : "80px 60px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              zIndex: 10,
            }}
          >
            {copy.discount && (
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#059669",
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                  marginBottom: 16,
                }}
              >
                {copy.discount}
              </span>
            )}
            <EditableText
              value={copy.headline}
              field="headline"
              onEdit={onEditField}
              style={{
                fontSize: isStory ? 44 : 42,
                fontWeight: 800,
                color: "#1f2937",
                lineHeight: 1.15,
              }}
            />
            <EditableText
              value={copy.subheadline}
              field="subheadline"
              onEdit={onEditField}
              style={{
                fontSize: 18,
                color: "#6b7280",
                marginTop: 16,
                lineHeight: 1.5,
              }}
            />
            <PriceDisplay />
            {copy.urgency && (
              <div style={{ fontSize: 15, color: "#dc2626", fontWeight: 600, marginTop: 12 }}>
                {copy.urgency}
              </div>
            )}
            <EditableText
              value={copy.cta}
              field="cta"
              onEdit={onEditField}
              style={{
                marginTop: 24,
                padding: "14px 28px",
                background: "#1f2937",
                borderRadius: 8,
                color: "#ffffff",
                fontWeight: 700,
                fontSize: 16,
                display: "inline-block",
                width: "fit-content",
              }}
            />
          </div>
          {/* Right side - image */}
          <div
            style={{
              position: "absolute",
              top: isStory ? "45%" : 0,
              right: 0,
              width: isStory ? "100%" : "52%",
              height: isStory ? "55%" : "100%",
            }}
          >
            <img
              src={imageUrl}
              alt=""
              crossOrigin="anonymous"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <RestaurantFooter light />
        </div>
      );
    }

    // ─── Layout: URGÊNCIA ──────────────────
    if (layout === "urgencia") {
      return (
        <div
          ref={ref}
          style={{
            ...containerStyle,
            background: "linear-gradient(135deg, #dc2626, #ea580c, #f59e0b)",
          }}
        >
          {/* Product photo */}
          <div
            style={{
              position: "absolute",
              top: isStory ? "35%" : "25%",
              left: "50%",
              transform: "translateX(-50%)",
              width: isStory ? 520 : 480,
              height: isStory ? 520 : 480,
              borderRadius: 24,
              overflow: "hidden",
              boxShadow: "0 30px 60px rgba(0,0,0,0.4)",
              zIndex: 10,
              border: "6px solid rgba(255,255,255,0.3)",
            }}
          >
            <img
              src={imageUrl}
              alt=""
              crossOrigin="anonymous"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <DiscountBadge />
          {/* Big headline */}
          <div
            style={{
              position: "absolute",
              top: isStory ? 60 : 40,
              left: 40,
              right: 160,
              zIndex: 15,
            }}
          >
            <EditableText
              value={copy.headline}
              field="headline"
              onEdit={onEditField}
              style={{
                fontSize: isStory ? 56 : 52,
                fontWeight: 900,
                color: "#ffffff",
                lineHeight: 1.05,
                textTransform: "uppercase",
                textShadow: "0 4px 20px rgba(0,0,0,0.3)",
              }}
            />
          </div>
          {/* Bottom area */}
          <div
            style={{
              position: "absolute",
              bottom: isStory ? 160 : 80,
              left: 40,
              right: 40,
              zIndex: 15,
              textAlign: "center",
            }}
          >
            <PriceDisplay dark />
            {copy.urgency && (
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 900,
                  color: "#ffffff",
                  background: "rgba(0,0,0,0.3)",
                  padding: "10px 24px",
                  borderRadius: 8,
                  display: "inline-block",
                  marginTop: 12,
                  animation: "pulse 2s infinite",
                }}
              >
                ⏰ {copy.urgency}
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <EditableText
                value={copy.cta}
                field="cta"
                onEdit={onEditField}
                style={{
                  padding: "16px 40px",
                  background: "#ffffff",
                  borderRadius: 12,
                  color: "#dc2626",
                  fontWeight: 900,
                  fontSize: 22,
                  display: "inline-block",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                }}
              />
            </div>
          </div>
          <RestaurantFooter />
        </div>
      );
    }

    // ─── Layout: MINIMALISTA ──────────────────
    return (
      <div ref={ref} style={{ ...containerStyle, background: "#ffffff" }}>
        {/* Centered product with lots of whitespace */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: isStory ? 600 : 560,
            height: isStory ? 600 : 560,
            borderRadius: 24,
            overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0,0,0,0.1)",
            zIndex: 10,
          }}
        >
          <img
            src={imageUrl}
            alt=""
            crossOrigin="anonymous"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
        {/* Top headline */}
        <div
          style={{
            position: "absolute",
            top: isStory ? 100 : 60,
            left: 60,
            right: 60,
            textAlign: "center",
            zIndex: 15,
          }}
        >
          <EditableText
            value={copy.headline}
            field="headline"
            onEdit={onEditField}
            style={{
              fontSize: isStory ? 40 : 36,
              fontWeight: 700,
              color: "#1f2937",
              lineHeight: 1.2,
            }}
          />
        </div>
        {/* Bottom CTA */}
        <div
          style={{
            position: "absolute",
            bottom: isStory ? 160 : 80,
            left: 60,
            right: 60,
            textAlign: "center",
            zIndex: 15,
          }}
        >
          {copy.priceNew && (
            <div
              style={{
                fontSize: 32,
                fontWeight: 800,
                color: "#1f2937",
                marginBottom: 12,
              }}
            >
              {copy.priceOld && (
                <span style={{ textDecoration: "line-through", opacity: 0.4, fontSize: 22, marginRight: 12 }}>
                  {copy.priceOld}
                </span>
              )}
              {copy.priceNew}
            </div>
          )}
          <EditableText
            value={copy.cta}
            field="cta"
            onEdit={onEditField}
            style={{
              padding: "12px 32px",
              background: "#1f2937",
              borderRadius: 8,
              color: "#ffffff",
              fontWeight: 700,
              fontSize: 18,
              display: "inline-block",
            }}
          />
        </div>
        <RestaurantFooter light />
      </div>
    );
  }
);

PostLayoutPreview.displayName = "PostLayoutPreview";
