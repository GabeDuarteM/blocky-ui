import { Inter } from "next/font/google";
import { TRPCReactProvider } from "~/trpc/react";
import { Toaster } from "~/components/ui/toast-provider";
import "../styles/globals.css";

import { type Metadata } from "next";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Blocky UI",
  description: "A modern UI for the Blocky DNS server",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html className="dark" lang="en">
      <body className={inter.className}>
        <TRPCReactProvider>
          {children}
          <Toaster />
        </TRPCReactProvider>
      </body>
    </html>
  );
}
