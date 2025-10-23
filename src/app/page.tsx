/**
 * Homepage - Marketplace Landing Page
 *
 * Displays hero, live metrics, and featured listings
 */

import { Hero } from './components/Hero';
import { LiveMetrics } from './components/LiveMetrics';
import { FeaturedListings } from './components/FeaturedListings';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Hero />
      <LiveMetrics />
      <FeaturedListings />
    </div>
  );
}
