import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { ConnectButton } from "@/components/ConnectButton";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HomTech",
  description: "NFT-collateralized rent lending on Arc Testnet",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>
          <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <nav className="flex items-center gap-6 text-sm font-medium">
              <Link href="/" className="flex items-center gap-2 font-semibold">
                <Image src="/logo.png" alt="HomTech" width={28} height={28} className="rounded-full" />
                HomTech
              </Link>
              <Link href="/lend">Lend</Link>
              <Link href="/borrow">Borrow</Link>
            </nav>
            <ConnectButton />
          </header>
          <main className="flex-1 px-6 py-8 max-w-3xl w-full mx-auto">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
