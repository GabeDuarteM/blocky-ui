import { TRPCReactProvider } from "~/trpc/react";
import { Toaster } from "sonner";
import "../styles/globals.css";

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
      <body>
        <TRPCReactProvider>
          {children}
          <Toaster />
        </TRPCReactProvider>
      </body>
    </html>
  );
}
