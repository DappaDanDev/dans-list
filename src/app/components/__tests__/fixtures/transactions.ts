/**
 * Transaction Test Fixtures
 * Reusable mock data for transaction-related tests
 */

export const mockAgents = {
  buyer: {
    id: 'agent-buyer-1',
    type: 'BUYER',
    address: '0x1234567890123456789012345678901234567890',
  },
  seller: {
    id: 'agent-seller-1',
    type: 'SELLER',
    address: '0x0987654321098765432109876543210987654321',
  },
  marketplace: {
    id: 'agent-marketplace-1',
    type: 'MARKETPLACE',
    address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  },
};

export const mockListings = {
  aiAgent: {
    id: 'listing-1',
    title: 'GPT-4 Agent Access',
    price: '100.00',
    status: 'SOLD',
    imageUrl: 'https://example.com/gpt4-agent.jpg',
  },
  dataAnalyst: {
    id: 'listing-2',
    title: 'Data Analysis Agent',
    price: '50.00',
    status: 'PENDING',
    imageUrl: 'https://example.com/data-agent.jpg',
  },
  trader: {
    id: 'listing-3',
    title: 'Trading Bot Agent',
    price: '200.00',
    status: 'AVAILABLE',
    imageUrl: 'https://example.com/trading-agent.jpg',
  },
};

export const mockTransactions = {
  /**
   * Confirmed transaction - agent received payment
   */
  confirmedReceived: {
    id: 'tx-confirmed-received',
    hash: '0xconfirmedreceived123456789abcdef123456789abcdef123456789abcdef1234',
    type: 'RECEIVED' as const,
    from: mockAgents.buyer,
    to: mockAgents.seller,
    listing: mockListings.aiAgent,
    amount: '100.00',
    token: 'PYUSD',
    sourceChain: 84532,
    destinationChain: 84532,
    nexusRoute: null,
    status: 'CONFIRMED' as const,
    blockNumber: '12345678',
    gasUsed: '21000',
    errorMessage: undefined,
    createdAt: '2024-01-15T10:30:00Z',
    confirmedAt: '2024-01-15T10:31:00Z',
  },

  /**
   * Confirmed transaction - agent sent payment
   */
  confirmedSent: {
    id: 'tx-confirmed-sent',
    hash: '0xconfirmedsent456789abcdef123456789abcdef123456789abcdef123456789ab',
    type: 'SENT' as const,
    from: mockAgents.seller,
    to: mockAgents.buyer,
    listing: mockListings.dataAnalyst,
    amount: '50.00',
    token: 'PYUSD',
    sourceChain: 84532,
    destinationChain: 84532,
    nexusRoute: null,
    status: 'CONFIRMED' as const,
    blockNumber: '12345680',
    gasUsed: '21000',
    errorMessage: undefined,
    createdAt: '2024-01-16T14:20:00Z',
    confirmedAt: '2024-01-16T14:21:00Z',
  },

  /**
   * Pending transaction
   */
  pending: {
    id: 'tx-pending',
    hash: '0xpending789abcdef123456789abcdef123456789abcdef123456789abcdef12345',
    type: 'SENT' as const,
    from: mockAgents.buyer,
    to: mockAgents.seller,
    listing: mockListings.trader,
    amount: '200.00',
    token: 'PYUSD',
    sourceChain: 84532,
    destinationChain: 84532,
    nexusRoute: null,
    status: 'PENDING' as const,
    blockNumber: undefined,
    gasUsed: undefined,
    errorMessage: undefined,
    createdAt: '2024-01-17T09:00:00Z',
    confirmedAt: undefined,
  },

  /**
   * Failed transaction
   */
  failed: {
    id: 'tx-failed',
    hash: '0xfailedabcdef123456789abcdef123456789abcdef123456789abcdef123456789',
    type: 'SENT' as const,
    from: mockAgents.buyer,
    to: mockAgents.seller,
    listing: mockListings.aiAgent,
    amount: '100.00',
    token: 'PYUSD',
    sourceChain: 84532,
    destinationChain: 84532,
    nexusRoute: null,
    status: 'FAILED' as const,
    blockNumber: '12345690',
    gasUsed: '50000',
    errorMessage: 'Insufficient funds',
    createdAt: '2024-01-18T16:45:00Z',
    confirmedAt: undefined,
  },

  /**
   * Reverted transaction
   */
  reverted: {
    id: 'tx-reverted',
    hash: '0xreverteddef123456789abcdef123456789abcdef123456789abcdef123456789ab',
    type: 'SENT' as const,
    from: mockAgents.buyer,
    to: mockAgents.seller,
    listing: mockListings.dataAnalyst,
    amount: '50.00',
    token: 'PYUSD',
    sourceChain: 84532,
    destinationChain: 84532,
    nexusRoute: null,
    status: 'REVERTED' as const,
    blockNumber: '12345695',
    gasUsed: '45000',
    errorMessage: 'Transaction reverted',
    createdAt: '2024-01-19T11:15:00Z',
    confirmedAt: undefined,
  },

  /**
   * Cross-chain transaction with Nexus route
   */
  crossChain: {
    id: 'tx-crosschain',
    hash: '0xcrosschainabc123456789abcdef123456789abcdef123456789abcdef12345678',
    type: 'SENT' as const,
    from: mockAgents.buyer,
    to: mockAgents.seller,
    listing: mockListings.trader,
    amount: '200.00',
    token: 'PYUSD',
    sourceChain: 84532,
    destinationChain: 421614,
    nexusRoute: {
      id: 'nexus-route-123',
      steps: [
        { step: 1, action: 'approve', chain: 84532 },
        { step: 2, action: 'bridge', chain: 84532 },
        { step: 3, action: 'receive', chain: 421614 },
      ],
      bridgeFee: '0.50',
      swapFee: '0.25',
    },
    status: 'CONFIRMED' as const,
    blockNumber: '12345700',
    gasUsed: '85000',
    errorMessage: undefined,
    createdAt: '2024-01-20T08:30:00Z',
    confirmedAt: '2024-01-20T08:35:00Z',
  },

  /**
   * Transaction without listing
   */
  noListing: {
    id: 'tx-no-listing',
    hash: '0xnolisting123456789abcdef123456789abcdef123456789abcdef123456789abc',
    type: 'RECEIVED' as const,
    from: mockAgents.buyer,
    to: mockAgents.seller,
    listing: null,
    amount: '75.00',
    token: 'PYUSD',
    sourceChain: 84532,
    destinationChain: 84532,
    nexusRoute: null,
    status: 'CONFIRMED' as const,
    blockNumber: '12345705',
    gasUsed: '21000',
    errorMessage: undefined,
    createdAt: '2024-01-21T13:00:00Z',
    confirmedAt: '2024-01-21T13:01:00Z',
  },
};

/**
 * Mock API responses
 */
export const mockApiResponses = {
  /**
   * Successful response with multiple transactions
   */
  success: {
    agent: mockAgents.buyer,
    transactions: [
      mockTransactions.confirmedReceived,
      mockTransactions.confirmedSent,
      mockTransactions.pending,
      mockTransactions.crossChain,
    ],
    pagination: {
      limit: 20,
      offset: 0,
      total: 4,
      hasMore: false,
    },
    summary: {
      totalTransactions: 4,
      sent: 2,
      received: 2,
      pending: 1,
      confirmed: 3,
      failed: 0,
    },
  },

  /**
   * Empty transaction list
   */
  empty: {
    agent: mockAgents.buyer,
    transactions: [],
    pagination: {
      limit: 20,
      offset: 0,
      total: 0,
      hasMore: false,
    },
    summary: {
      totalTransactions: 0,
      sent: 0,
      received: 0,
      pending: 0,
      confirmed: 0,
      failed: 0,
    },
  },

  /**
   * Response with pagination
   */
  paginated: {
    agent: mockAgents.seller,
    transactions: [
      mockTransactions.confirmedReceived,
      mockTransactions.confirmedSent,
    ],
    pagination: {
      limit: 2,
      offset: 0,
      total: 10,
      hasMore: true,
    },
    summary: {
      totalTransactions: 10,
      sent: 5,
      received: 5,
      pending: 2,
      confirmed: 7,
      failed: 1,
    },
  },

  /**
   * Response with all transaction statuses
   */
  allStatuses: {
    agent: mockAgents.buyer,
    transactions: [
      mockTransactions.confirmedReceived,
      mockTransactions.pending,
      mockTransactions.failed,
      mockTransactions.reverted,
    ],
    pagination: {
      limit: 20,
      offset: 0,
      total: 4,
      hasMore: false,
    },
    summary: {
      totalTransactions: 4,
      sent: 3,
      received: 1,
      pending: 1,
      confirmed: 1,
      failed: 2,
    },
  },
};

/**
 * Mock error responses
 */
export const mockErrorResponses = {
  agentNotFound: {
    error: 'Agent not found',
  },
  serverError: {
    error: 'Internal server error',
    message: 'Database connection failed',
  },
  invalidParams: {
    error: 'Invalid parameters',
    message: 'Limit must be between 1 and 100',
  },
};
