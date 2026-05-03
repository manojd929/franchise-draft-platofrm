"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

interface PendingSubmitButtonProps {
  children: ReactNode;
  pendingLabel: ReactNode;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";
  className?: string;
  disabled?: boolean;
}

export function PendingSubmitButton({
  children,
  pendingLabel,
  variant,
  size,
  className,
  disabled,
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={disabled}
      pending={pending}
      pendingLabel={pendingLabel}
    >
      {children}
    </Button>
  );
}
