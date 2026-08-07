"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

const containerVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.43, 0.13, 0.23, 0.96] as [number, number, number, number],
      delayChildren: 0.1,
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.43, 0.13, 0.23, 0.96] as [number, number, number, number],
    },
  },
};

const numberVariants = {
  hidden: (direction: number) => ({
    opacity: 0,
    x: direction * 40,
    y: 15,
    rotate: direction * 5,
  }),
  visible: {
    opacity: 0.7,
    x: 0,
    y: 0,
    rotate: 0,
    transition: {
      duration: 0.8,
      ease: [0.43, 0.13, 0.23, 0.96] as [number, number, number, number],
    },
  },
};

const ghostVariants = {
  hidden: { scale: 0.8, opacity: 0, y: 15, rotate: -5 },
  visible: {
    scale: 1,
    opacity: 1,
    y: 0,
    rotate: 0,
    transition: {
      duration: 0.6,
      ease: [0.43, 0.13, 0.23, 0.96] as [number, number, number, number],
    },
  },
  floating: {
    y: [-5, 5],
    transition: {
      y: {
        duration: 2,
        ease: "easeInOut" as const,
        repeat: Number.POSITIVE_INFINITY,
        repeatType: "reverse" as const,
      },
    },
  },
};

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <AnimatePresence mode="wait">
        <motion.div
          className="text-center"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          <div className="mb-8 flex items-center justify-center gap-4 md:mb-12 md:gap-6">
            <motion.span
              className="select-none text-[80px] font-bold text-foreground/70 md:text-[120px]"
              variants={numberVariants}
              custom={-1}
            >
              4
            </motion.span>
            <motion.div variants={ghostVariants} animate={["visible", "floating"]}>
              <Image
                src="https://xubohuah.github.io/xubohua.top/Group.png"
                alt="Ghost"
                width={120}
                height={120}
                className="size-20 select-none object-contain md:size-[120px]"
                draggable="false"
                priority
              />
            </motion.div>
            <motion.span
              className="select-none text-[80px] font-bold text-foreground/70 md:text-[120px]"
              variants={numberVariants}
              custom={1}
            >
              4
            </motion.span>
          </div>

          <motion.h1
            className="mb-4 select-none text-3xl font-bold text-foreground/70 md:mb-6 md:text-5xl"
            variants={itemVariants}
          >
            Page not found
          </motion.h1>

          <motion.p
            className="mb-8 select-none text-lg text-foreground/50 md:mb-12 md:text-xl"
            variants={itemVariants}
          >
            This page seems to have vanished into the void
          </motion.p>

          <motion.div
            variants={itemVariants}
            whileHover={{
              scale: 1.05,
              transition: {
                duration: 0.3,
                ease: [0.43, 0.13, 0.23, 0.96] as [number, number, number, number],
              },
            }}
          >
            <Link
              href="/"
              className="inline-block cursor-pointer select-none rounded-full bg-foreground px-8 py-3 text-lg font-medium text-background transition-colors hover:bg-foreground/90"
            >
              Go back home
            </Link>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
