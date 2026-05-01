"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { useAppTheme, useResolvedTheme } from "@/components/app-theme-provider";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useAppTheme();
  const resolved = useResolvedTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "min-h-11 min-w-11 touch-manipulation",
          className,
        )}
        aria-label="Color theme"
        aria-haspopup="menu"
      >
        {resolved === "dark" ? (
          <Moon className="size-4" aria-hidden />
        ) : (
          <Sun className="size-4" aria-hidden />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[11rem]">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => {
            if (value === "light" || value === "dark" || value === "system") {
              setTheme(value);
            }
          }}
        >
          <DropdownMenuRadioItem value="light" closeOnClick className="gap-2">
            <Sun className="size-4" aria-hidden />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" closeOnClick className="gap-2">
            <Moon className="size-4" aria-hidden />
            Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system" closeOnClick className="gap-2">
            <Monitor className="size-4" aria-hidden />
            System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
