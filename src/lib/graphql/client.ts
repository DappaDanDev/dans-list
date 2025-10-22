import { GraphQLClient } from 'graphql-request';
import { getLogger } from '../utils/logger';

const logger = getLogger('graphql:client');

// GraphQL endpoint from Envio (local or deployed)
const GRAPHQL_ENDPOINT =
  process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_ENDPOINT || 'http://localhost:8080/graphql';

/**
 * GraphQL client for querying Envio HyperSync indexed data
 */
export const graphqlClient = new GraphQLClient(GRAPHQL_ENDPOINT, {
  headers: {
    'Content-Type': 'application/json',
  },
  requestMiddleware: (request) => {
    logger.debug({ endpoint: request.url }, 'GraphQL request initiated');
    return request;
  },
  responseMiddleware: (response) => {
    if (response instanceof Error) {
      logger.error({ error: response.message }, 'GraphQL request failed');
    } else {
      logger.debug('GraphQL request completed successfully');
    }
  },
});

/**
 * Execute a GraphQL query with error handling and logging
 */
export async function executeQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const startTime = Date.now();

  try {
    logger.info({ variables }, 'Executing GraphQL query');

    const data = await graphqlClient.request<T>(query, variables);

    const duration = Date.now() - startTime;
    logger.info({ duration }, 'GraphQL query executed successfully');

    return data;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(
      {
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        variables,
      },
      'GraphQL query failed',
    );
    throw error;
  }
}

/**
 * Health check for GraphQL endpoint
 */
export async function checkGraphQLHealth(): Promise<boolean> {
  try {
    const healthQuery = `
      query HealthCheck {
        __schema {
          queryType {
            name
          }
        }
      }
    `;

    await graphqlClient.request(healthQuery);
    logger.info('GraphQL endpoint health check passed');
    return true;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'GraphQL endpoint health check failed',
    );
    return false;
  }
}
