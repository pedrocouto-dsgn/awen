import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  // Awen: soft 10px corners, uppercase tracked labels, Frost is the single action color.
  "group/button type-button inline-flex shrink-0 items-center justify-center rounded-input border border-transparent bg-clip-padding whitespace-nowrap transition-colors outline-none select-none disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active",
        /** The single most important action on a screen (Aprovar, Adicionar). */
        accent:
          "bg-primary bg-gradient-accent text-primary-foreground hover:bg-primary-hover hover:bg-none active:bg-primary-active active:bg-none",
        outline:
          "border-primary bg-transparent text-foreground hover:bg-glass-hover aria-expanded:bg-glass-hover",
        secondary: "bg-secondary text-secondary-foreground hover:bg-border-strong aria-expanded:bg-border-strong",
        ghost: "text-foreground hover:bg-glass-hover aria-expanded:bg-glass-hover",
        /** Danger outline (Rejeitar, Excluir): on canvas only. */
        destructive: "border-destructive bg-transparent text-destructive hover:bg-destructive/10",
        link: "text-link underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 gap-2 px-6",
        xs: "h-7 gap-1 px-2.5 text-[0.6875rem] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-4 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-8",
        icon: "size-11",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
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
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
