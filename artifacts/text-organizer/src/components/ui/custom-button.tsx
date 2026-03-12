import * as React from "react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "secondary" | "ghost-muted";
  size?: "default" | "sm" | "lg" | "icon";
}

const CustomButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
          {
            "bg-primary text-primary-foreground shadow-md shadow-primary/10 hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5":
              variant === "default",
            "bg-secondary text-secondary-foreground hover:bg-secondary/80":
              variant === "secondary",
            "border border-border bg-card shadow-sm hover:bg-accent hover:text-accent-foreground":
              variant === "outline",
            "hover:bg-accent hover:text-accent-foreground": variant === "ghost",
            "hover:bg-muted text-muted-foreground hover:text-foreground": variant === "ghost-muted",
            "h-11 px-6 py-2": size === "default",
            "h-9 rounded-lg px-4": size === "sm",
            "h-12 rounded-2xl px-8 text-base": size === "lg",
            "h-11 w-11": size === "icon",
          },
          className
        )}
        {...props}
      />
    )
  }
)
CustomButton.displayName = "CustomButton"

export { CustomButton }
