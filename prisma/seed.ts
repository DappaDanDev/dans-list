/**
 * Prisma Seed Script
 *
 * Populates database with test data for development and testing
 */

import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data (in order to avoid foreign key constraints)
  console.log('🗑️  Clearing existing data...');
  await prisma.transaction.deleteMany();
  await prisma.proof.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.vincentAuth.deleteMany();

  // Create test agents
  console.log('👤 Creating test agents...');
  const agents = await Promise.all([
    prisma.agent.create({
      data: {
        type: 'SELLER',
        walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7',
        policies: {},
        spendingLimit: 10000,
        dailyLimit: 1000,
        totalTransactions: 0,
        successRate: 0,
        totalVolume: 0,
      },
    }),
    prisma.agent.create({
      data: {
        type: 'BUYER',
        walletAddress: '0x1234567890123456789012345678901234567890',
        policies: {},
        spendingLimit: 50000,
        dailyLimit: 5000,
        totalTransactions: 15,
        successRate: 95,
        totalVolume: 15000,
      },
    }),
    prisma.agent.create({
      data: {
        type: 'BUYER',
        walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        policies: {},
        spendingLimit: 25000,
        dailyLimit: 2500,
        totalTransactions: 8,
        successRate: 88,
        totalVolume: 8500,
      },
    }),
  ]);

  console.log(`✅ Created ${agents.length} agents`);

  // Create test listings
  console.log('📦 Creating test listings...');
  const listings = await Promise.all([
    // Electronics
    prisma.listing.create({
      data: {
        title: 'Vintage Sony Walkman',
        description: 'Classic 1980s portable cassette player in excellent working condition. Includes original headphones.',
        price: 45,
        category: 'Electronics',
        condition: 'Good',
        sellerAgent: { connect: { id: agents[0].id } },
        imageUrl: 'https://images.unsplash.com/photo-1602524206684-a2c0c2d88370',
        status: 'AVAILABLE',
        features: {},
      },
    }),
    prisma.listing.create({
      data: {
        title: 'Apple iPhone 12 Pro',
        description: 'Unlocked, 256GB, Pacific Blue. Excellent condition with minimal wear. Includes original box and accessories.',
        price: 399,
        category: 'Electronics',
        condition: 'Excellent',
        sellerAgent: { connect: { id: agents[1].id } },
        imageUrl: 'https://images.unsplash.com/photo-1591337676887-a217a6970a8a',
        status: 'AVAILABLE',
        features: {},
      },
    }),

    // Clothing
    prisma.listing.create({
      data: {
        title: 'Vintage Leather Jacket',
        description: 'Genuine leather motorcycle jacket from the 1970s. Size Large. Classic biker style with brass zippers.',
        price: 125,
        category: 'Clothing',
        condition: 'Good',
        sellerAgent: { connect: { id: agents[0].id } },
        imageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5',
        status: 'AVAILABLE',
        features: {},
      },
    }),
    prisma.listing.create({
      data: {
        title: 'Nike Air Jordan 1 Retro High',
        description: 'Chicago colorway, size 10.5. Brand new in box, never worn. Authentic sneakers with original tags.',
        price: 275,
        category: 'Clothing',
        condition: 'New',
        sellerAgent: { connect: { id: agents[2].id } },
        imageUrl: 'https://images.unsplash.com/photo-1556906781-9a412961c28c',
        status: 'AVAILABLE',
        features: {},
      },
    }),

    // Books
    prisma.listing.create({
      data: {
        title: 'First Edition Harry Potter Collection',
        description: 'Complete set of first edition Harry Potter books 1-7. Hardcover with dust jackets. Excellent condition.',
        price: 850,
        category: 'Books',
        condition: 'Excellent',
        sellerAgent: { connect: { id: agents[1].id } },
        imageUrl: 'https://images.unsplash.com/photo-1621351183012-e2f9972dd9bf',
        status: 'AVAILABLE',
        features: {},
      },
    }),
    prisma.listing.create({
      data: {
        title: 'Vintage National Geographic Collection',
        description: '50 issues from the 1960s-1970s. Great condition with vibrant photography. Perfect for collectors.',
        price: 35,
        category: 'Books',
        condition: 'Good',
        sellerAgent: { connect: { id: agents[0].id } },
        imageUrl: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f',
        status: 'AVAILABLE',
        features: {},
      },
    }),

    // Home
    prisma.listing.create({
      data: {
        title: 'Mid-Century Modern Coffee Table',
        description: 'Walnut wood coffee table from the 1960s. Original finish, minor wear consistent with age. 48" x 24".',
        price: 450,
        category: 'Home',
        condition: 'Good',
        sellerAgent: { connect: { id: agents[2].id } },
        imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc',
        status: 'AVAILABLE',
        features: {},
      },
    }),
    prisma.listing.create({
      data: {
        title: 'Vintage Edison Bulb Table Lamp',
        description: 'Industrial style lamp with exposed Edison bulb. Black iron base with adjustable arm. Works perfectly.',
        price: 65,
        category: 'Home',
        condition: 'Excellent',
        sellerAgent: { connect: { id: agents[1].id } },
        imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c',
        status: 'AVAILABLE',
        features: {},
      },
    }),

    // Sports
    prisma.listing.create({
      data: {
        title: 'Trek Mountain Bike - Full Suspension',
        description: 'Trek Fuel EX 8, 29" wheels, medium frame. Excellent condition, well-maintained. Perfect for trails.',
        price: 1200,
        category: 'Sports',
        condition: 'Excellent',
        sellerAgent: { connect: { id: agents[0].id } },
        imageUrl: 'https://images.unsplash.com/photo-1576435728678-68d0fbf94e91',
        status: 'AVAILABLE',
        features: {},
      },
    }),
  ]);

  console.log(`✅ Created ${listings.length} listings`);

  // Create some sample transactions (completed purchases)
  console.log('💸 Creating sample transactions...');
  const transactions = await Promise.all([
    prisma.transaction.create({
      data: {
        hash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        fromAgent: { connect: { id: agents[1].id } },
        toAgent: { connect: { id: agents[0].id } },
        listing: { connect: { id: listings[0].id } },
        amount: 45,
        token: 'USDC',
        sourceChain: 11155111,
        destinationChain: 421614,
        status: 'CONFIRMED',
      },
    }),
    prisma.transaction.create({
      data: {
        hash: '0x2222222222222222222222222222222222222222222222222222222222222222',
        fromAgent: { connect: { id: agents[2].id } },
        toAgent: { connect: { id: agents[0].id } },
        listing: { connect: { id: listings[2].id } },
        amount: 125,
        token: 'USDC',
        sourceChain: 11155111,
        destinationChain: 421614,
        status: 'CONFIRMED',
      },
    }),
    prisma.transaction.create({
      data: {
        hash: '0x3333333333333333333333333333333333333333333333333333333333333333',
        fromAgent: { connect: { id: agents[0].id } },
        toAgent: { connect: { id: agents[1].id } },
        listing: { connect: { id: listings[4].id } },
        amount: 850,
        token: 'USDC',
        sourceChain: 11155111,
        destinationChain: 421614,
        status: 'PENDING',
      },
    }),
  ]);

  console.log(`✅ Created ${transactions.length} transactions`);

  console.log('\n🎉 Database seed completed successfully!\n');
  console.log('📊 Summary:');
  console.log(`   - ${agents.length} agents`);
  console.log(`   - ${listings.length} listings`);
  console.log(`   - ${transactions.length} transactions`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error seeding database:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
