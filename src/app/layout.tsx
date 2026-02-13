import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voho Team Overview",
  description: "Voho Team Overview dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
