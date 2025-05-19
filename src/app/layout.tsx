import { Geist, Jersey_15 } from "next/font/google";
import { TRPCReactProvider } from "~/trpc/react";
import { Toaster } from "sonner";
import "../styles/globals.css";
import clsx from "clsx";

export const metadata = {
  title: "Blocky UI",
  description: "A modern UI for the Blocky DNS server",
};

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
});

const jersey15 = Jersey_15({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-jersey15",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      className={clsx(geist.variable, jersey15.variable, "dark", "font-sans")}
      lang="en"
    >
      <body>
        <TRPCReactProvider>
          {children}
          <Toaster />
        </TRPCReactProvider>
      </body>
    </html>
  );
}
