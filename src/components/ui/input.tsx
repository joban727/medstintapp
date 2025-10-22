import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-xl border-2 border-border bg-surface-1 px-4 py-3 text-base ring-2 ring-transparent ring-offset-2 ring-offset-background transition-all duration-200 file:border-0 file:bg-transparent file:font-medium file:text-base placeholder:text-text-muted focus-visible:border-medical-blue focus-visible:ring-medical-blue-light focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 hover:border-medical-blue/50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
