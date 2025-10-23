/**
 * Agent types and interfaces for marketplace search
 */

export interface SearchQuery {
  query: string;
  maxResults?: number;
  priceRange?: { min: number; max: number };
  category?: string;
}

export interface SearchResult {
  listingId: string;
  title: string;
  description: string;
  price: number;
  similarity: number;
  metadata: Record<string, unknown>;
}

export interface AgentContext {
  agentId: string;
  walletAddress: string;
  type: 'BUYER' | 'SELLER' | 'MARKETPLACE';
}
