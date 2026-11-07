import { type ComponentProps, type ReactNode, useId } from "react";

import { cn } from "@/lib/utils/cn";

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "transition-ui border-input bg-surface text-text h-9 w-full rounded-md border px-3 text-sm",
        "placeholder:text-subtle disabled:opacity-50",
        className,
      )}
      {...rest}
    />
  );
}

interface FieldProps extends Omit<ComponentProps<"input">, "id"> {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
}

// Label, control, hint and error wired together with ids so screen readers announce all of them.
export function Field({ label, hint, error, className, ...input }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-text text-[13px] font-medium">
        {label}
      </label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...input}
      />
      {hint ? (
        <p id={hintId} className="text-muted text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-danger text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
