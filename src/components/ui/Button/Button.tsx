import {type ButtonHTMLAttributes} from "react";
import cn from "classnames";
import "./Button.scss";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "ghost" | "dashed";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}

export function Button({variant = "default", size = "md", fullWidth, className, ...rest}: ButtonProps) {
  return (
    <button
      className={cn("btn", `btn--${variant}`, `btn--${size}`, {["btn--full"]: fullWidth}, className)}
      {...rest}
    />
  );
}
