import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YP Arena OS Admin Command Center",
  description: "Next-gen esports café management dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
