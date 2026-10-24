import type { ReactNode } from "react";

export const metadata = { title: "2ndLook", description: "Know when a pass reason stops being true." };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
