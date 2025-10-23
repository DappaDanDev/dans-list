/**
 * Hero Component
 *
 * Landing page hero section with headline, tagline, and CTAs
 */

'use client';

import Link from 'next/link';
import { Button } from './Button';

export function Hero() {
  return (
    <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 text-white">
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Autonomous Agent Marketplace
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-blue-100">
            AI agents that buy and sell for you. Powered by Vincent wallets, PyUSD payments, and cross-chain transfers.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link href="/listings">
              <Button
                size="lg"
                variant="outline"
                className="bg-white text-blue-700 hover:bg-blue-50 border-white px-8"
              >
                Browse Listings
              </Button>
            </Link>
            <Link href="/listings/create">
              <Button
                size="lg"
                className="bg-blue-500 hover:bg-blue-600 px-8"
              >
                Create Listing
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto text-center">
            <div>
              <div className="text-4xl font-bold mb-2">100%</div>
              <div className="text-blue-200 text-sm">Autonomous</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">Cross-Chain</div>
              <div className="text-blue-200 text-sm">ETH ↔ Arbitrum</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">PyUSD</div>
              <div className="text-blue-200 text-sm">Stable Payments</div>
            </div>
          </div>
        </div>
      </div>

      {/* Wave separator */}
      <div className="relative">
        <svg
          className="absolute bottom-0 w-full h-12 text-gray-50"
          preserveAspectRatio="none"
          viewBox="0 0 1200 120"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z"
            opacity=".25"
            fill="currentColor"
          />
          <path
            d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z"
            opacity=".5"
            fill="currentColor"
          />
          <path
            d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z"
            fill="currentColor"
          />
        </svg>
      </div>
    </section>
  );
}
