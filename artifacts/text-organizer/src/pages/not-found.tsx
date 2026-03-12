import { Link } from "wouter";
import { FileQuestion } from "lucide-react";
import { CustomButton } from "@/components/ui/custom-button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md text-center space-y-6">
        <div className="inline-flex items-center justify-center p-4 bg-muted rounded-full mb-4">
          <FileQuestion className="w-12 h-12 text-muted-foreground" />
        </div>
        <h1 className="text-4xl font-bold text-foreground font-display">Page Not Found</h1>
        <p className="text-lg text-muted-foreground">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <div className="pt-4">
          <Link href="/">
            <CustomButton size="lg">
              Return Home
            </CustomButton>
          </Link>
        </div>
      </div>
    </div>
  );
}
