import {type ButtonHTMLAttributes} from "react";
import cn from "classnames";
import "./IconButton.scss";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md" | "lg";
}

export function IconButton({size = "md", className, ...rest}: IconButtonProps) {
  return (
    <button
      className={cn("icon-btn", `icon-btn--${size}`, className)}
      {...rest}
    />
  );
}
