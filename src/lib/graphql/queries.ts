import { gql } from 'graphql-request';

/**
 * Query for market metrics (global statistics)
 */
export const MARKET_METRICS_QUERY = gql`
  query MarketMetrics {
    marketMetrics(id: "global") {
      id
      totalListings
      totalVolume
      activeAgents24h
      averagePrice
      totalTransactions
      lastUpdated
    }
  }
`;

/**
 * Query for top performing agents
 */
export const TOP_AGENTS_QUERY = gql`
  query TopAgents($first: Int = 100, $orderBy: String = "totalVolume") {
    agents(first: $first, orderBy: $orderBy, orderDirection: "desc") {
      id
      walletAddress
      totalListings
      totalPurchases
      totalVolume
      lastActivity
      chainId
      createdAt
    }
  }
`;

/**
 * Query for recent transactions
 */
export const RECENT_TRANSACTIONS_QUERY = gql`
  query RecentTransactions($first: Int = 50) {
    listingEvents(first: $first, orderBy: "timestamp", orderDirection: "desc") {
      id
      listingId
      type
      agentId
      seller
      price
      timestamp
      chainId
      transactionHash
      blockNumber
    }
    purchaseEvents(first: $first, orderBy: "timestamp", orderDirection: "desc") {
      id
      listingId
      buyer
      seller
      amount
      timestamp
      chainId
      transactionHash
      blockNumber
    }
  }
`;

/**
 * Query for agent details
 */
export const AGENT_DETAILS_QUERY = gql`
  query AgentDetails($id: ID!) {
    agent(id: $id) {
      id
      walletAddress
      totalListings
      totalPurchases
      totalVolume
      lastActivity
      chainId
      createdAt
    }
  }
`;

/**
 * Query for listing events by agent
 */
export const AGENT_LISTING_EVENTS_QUERY = gql`
  query AgentListingEvents($agentId: String!, $first: Int = 50) {
    listingEvents(
      where: { agentId: $agentId }
      first: $first
      orderBy: "timestamp"
      orderDirection: "desc"
    ) {
      id
      listingId
      type
      seller
      price
      timestamp
      transactionHash
    }
  }
`;

/**
 * Query for purchase events by buyer
 */
export const AGENT_PURCHASE_EVENTS_QUERY = gql`
  query AgentPurchaseEvents($buyer: String!, $first: Int = 50) {
    purchaseEvents(
      where: { buyer: $buyer }
      first: $first
      orderBy: "timestamp"
      orderDirection: "desc"
    ) {
      id
      listingId
      seller
      amount
      timestamp
      transactionHash
    }
  }
`;

// TypeScript types for query results
export interface MarketMetrics {
  id: string;
  totalListings: number;
  totalVolume: string;
  activeAgents24h: number;
  averagePrice: string;
  totalTransactions: number;
  lastUpdated: string;
}

export interface Agent {
  id: string;
  walletAddress: string;
  totalListings: number;
  totalPurchases: number;
  totalVolume: string;
  lastActivity: string;
  chainId: number;
  createdAt: string;
}

export interface ListingEvent {
  id: string;
  listingId: string;
  type: string;
  agentId: string;
  seller: string;
  price: string;
  timestamp: string;
  chainId: number;
  transactionHash: string;
  blockNumber: string;
}

export interface PurchaseEvent {
  id: string;
  listingId: string;
  buyer: string;
  seller: string;
  amount: string;
  timestamp: string;
  chainId: number;
  transactionHash: string;
  blockNumber: string;
}

export interface MarketMetricsQueryResult {
  marketMetrics: MarketMetrics | null;
}

export interface TopAgentsQueryResult {
  agents: Agent[];
}

export interface RecentTransactionsQueryResult {
  listingEvents: ListingEvent[];
  purchaseEvents: PurchaseEvent[];
}

export interface AgentDetailsQueryResult {
  agent: Agent | null;
}

export interface AgentListingEventsQueryResult {
  listingEvents: ListingEvent[];
}

export interface AgentPurchaseEventsQueryResult {
  purchaseEvents: PurchaseEvent[];
}
