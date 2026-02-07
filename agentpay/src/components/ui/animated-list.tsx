"use client"

import React from "react"
import { AnimatePresence, motion } from "motion/react"

import { cn } from "@/lib/utils"

interface AnimatedListProps {
  children: React.ReactNode
  className?: string
}

/**
 * Animated list that smoothly animates new items entering.
 * Each direct child gets a slide-in + fade animation.
 */
export function AnimatedList({ children, className }: AnimatedListProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <AnimatePresence initial={false}>
        {React.Children.map(children, (child) => {
          if (!React.isValidElement(child)) return child
          return (
            <motion.div
              key={child.key}
              initial={{ opacity: 0, y: -20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{
                duration: 0.35,
                ease: [0.4, 0, 0.2, 1],
              }}
              layout
            >
              {child}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
