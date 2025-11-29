"use client";

import dynamic from "next/dynamic";

const InstallBanner = dynamic(() => import("./InstallBanner"), {
  ssr: false,
});

export default function InstallPromptWrapper() {
  return <InstallBanner />;
}