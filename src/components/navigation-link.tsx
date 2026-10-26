"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";

export default function NavigationLink({
  prefetch = false,
  ...props
}: ComponentProps<typeof NextLink>) {
  return <NextLink {...props} prefetch={prefetch} />;
}
