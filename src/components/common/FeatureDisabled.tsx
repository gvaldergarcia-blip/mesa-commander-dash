import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FEATURE_DISABLED_MESSAGE } from "@/config/feature-flags";

type FeatureDisabledProps = {
  message?: string;
  featureName?: string;
};

export function FeatureDisabled({ 
  message = FEATURE_DISABLED_MESSAGE, 
  featureName 
}: FeatureDisabledProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-3 bg-muted rounded-full">
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              {featureName && (
                <h3 className="text-lg font-semibold">{featureName}</h3>
              )}
              <p className="text-muted-foreground">{message}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
