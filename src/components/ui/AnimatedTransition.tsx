import React from "react";

interface AnimatedTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export const AnimatedTransition = ({ 
  children, 
  className = ""
}: AnimatedTransitionProps) => {
  return (
    <div className={className}>
      {children}
    </div>
  );
};
