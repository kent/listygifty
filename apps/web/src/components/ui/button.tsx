import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-[transform,background-color,color] active:translate-x-px active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-red-500 border-2 border-t-red-300 border-l-red-300 border-r-red-900 border-b-red-900 [text-shadow:1px_1px_0_#500305] active:border-t-red-900 active:border-l-red-900 active:border-r-red-300 active:border-b-red-300",
        destructive:
          "bg-destructive text-white hover:bg-red-500 border-2 border-t-red-300 border-l-red-300 border-r-red-900 border-b-red-900 focus-visible:ring-destructive/20",
        outline:
          "bg-[#c3c3c3] text-slate-900 border-2 border-t-white border-l-white border-r-slate-900 border-b-slate-900 hover:bg-[#d4d4d4] active:border-t-slate-900 active:border-l-slate-900 active:border-r-white active:border-b-white",
        secondary:
          "bg-[#c3c3c3] text-slate-900 border-2 border-t-white border-l-white border-r-slate-900 border-b-slate-900 hover:bg-[#d4d4d4] active:border-t-slate-900 active:border-l-slate-900 active:border-r-white active:border-b-white",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
