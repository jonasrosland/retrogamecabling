import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="w-full max-w-md mx-4 bg-card border border-border rounded-lg p-6 shadow-lg">
        <div className="flex mb-4 gap-2">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <h1 className="text-2xl font-bold text-foreground">404 Page Not Found</h1>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          Beware of dragons! You've probably clicked on a link that doesn't exist.
        </p>
      </div>
    </div>
  );
}
