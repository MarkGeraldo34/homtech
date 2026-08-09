import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { ConnectButton } from "@/components/ConnectButton";
import { Nav } from "@/components/Nav";
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
          <header className="sticky top-0 z-20 border-b border-border bg-background/75 backdrop-blur-md px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-2 font-semibold whitespace-nowrap tracking-tight">
              <Image src="/logo.png" alt="" width={30} height={30} className="rounded-md" />
              <span>
                Hom<span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">Tech</span>
              </span>
            </Link>
            <div className="order-3 w-full sm:order-none sm:w-auto sm:ml-4 sm:mr-auto">
              <Nav />
            </div>
            <ConnectButton />
          </header>
          <main className="flex-1 px-4 sm:px-6 py-10 sm:py-14 max-w-5xl w-full mx-auto">{children}</main>
          <footer className="border-t border-border px-4 sm:px-6 py-8">
            <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted">
              <p>&copy; {new Date().getFullYear()} HomTech &mdash; NFT-collateralized rent lending.</p>
              <p className="flex items-center gap-1.5">
                <span className="eyebrow-dot" />
                Running on Arc Testnet
              </p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
