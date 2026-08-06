import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { ConnectButton } from "@/components/ConnectButton";
import { NavLinks } from "@/components/NavLinks";
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
  description: "NFT-collateralized house rent lending on Arc Testnet",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden">
          <Image
            src="/backgrounds/house-1.jpg"
            alt=""
            fill
            priority
            className="object-cover grayscale opacity-[0.06]"
          />
        </div>
        <Providers>
          <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur px-4 sm:px-6 py-4 flex items-center justify-between gap-2">
            <nav className="flex items-center gap-3 sm:gap-6 text-sm font-medium">
              <Link href="/" className="flex items-center gap-2 py-3 font-semibold whitespace-nowrap">
                <Image src="/logo.png" alt="HomTech" width={28} height={28} />
                HomTech
              </Link>
              <NavLinks />
            </nav>
            <ConnectButton />
          </header>
          <main className="flex-1 px-6 py-8 max-w-3xl w-full mx-auto">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
