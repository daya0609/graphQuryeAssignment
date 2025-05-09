const mongoose = require('mongoose');
const { ApolloServer, gql } = require('apollo-server-express');
const express = require('express');
require('dotenv').config();
const Redis = require('ioredis');
const redis = new Redis(); // Defaults to localhost:6379
const CACHE_TTL = 300; // 5 minutes in seconds

const Customer = require('./models/Customer');
const Order = require('./models/Order');
const Product = require('./models/Product');

// GraphQL type definitions
const typeDefs = gql`
  type CustomerSpending {
    customerId: ID!
    totalSpent: Float!
    averageOrderValue: Float!
    lastOrderDate: String
  }

  type TopProduct {
    productId: ID!
    name: String!
    totalSold: Int!
  }

  type CategoryBreakdown {
    category: String!
    revenue: Float!
  }

  type SalesAnalytics {
    totalRevenue: Float!
    completedOrders: Int!
    categoryBreakdown: [CategoryBreakdown!]!
  }

  input PlaceOrderItemInput {
    productId: ID!
    quantity: Int!
  }

  input PlaceOrderInput {
    customerId: ID!
    items: [PlaceOrderItemInput!]!
  }

  type PlaceOrderPayload {
    orderId: ID!
    success: Boolean!
    message: String
  }

  type OrderItem {
    productId: ID!
    quantity: Int!
  }

  type CustomerOrder {
    _id: ID!
    orderDate: String!
    status: String!
    items: [OrderItem!]!
    total: Float!
  }

  type CustomerOrdersPage {
    orders: [CustomerOrder!]!
    totalCount: Int!
    page: Int!
    pageSize: Int!
    totalPages: Int!
  }

  type Mutation {
    placeOrder(input: PlaceOrderInput!): PlaceOrderPayload!
  }

  type Query {
    getCustomerSpending(customerId: ID!): CustomerSpending
    getTopSellingProducts(limit: Int!): [TopProduct]
    getSalesAnalytics(startDate: String!, endDate: String!): SalesAnalytics
    getCustomerOrders(customerId: ID!, page: Int!, pageSize: Int!): CustomerOrdersPage!
  }
`;

// Placeholder resolvers
const resolvers = {
  Query: {
    getCustomerSpending: async (_, { customerId }) => {
      const cacheKey = `customerSpending:${customerId}`;
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
      // Aggregate orders for the customer
      const orders = await Order.aggregate([
        { $match: { customerId } },
        { $sort: { orderDate: -1 } },
        {
          $group: {
            _id: null,
            totalSpent: { $sum: "$total" },
            averageOrderValue: { $avg: "$total" },
            lastOrderDate: { $first: "$orderDate" },
            count: { $sum: 1 }
          }
        }
      ]);
      if (!orders.length) return null;
      const result = {
        customerId,
        totalSpent: orders[0].totalSpent || 0,
        averageOrderValue: orders[0].averageOrderValue || 0,
        lastOrderDate: orders[0].lastOrderDate ? orders[0].lastOrderDate.toISOString() : null
      };
      await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL);
      return result;
    },
    getTopSellingProducts: async (_, { limit }) => {
      const cacheKey = `topSellingProducts:${limit}`;
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
      // Unwind order items and group by productId
      const topProducts = await Order.aggregate([
        { $unwind: "$items" },
        { $group: {
            _id: "$items.productId",
            totalSold: { $sum: "$items.quantity" }
        }},
        { $sort: { totalSold: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "product"
          }
        },
        { $unwind: "$product" },
        {
          $project: {
            productId: "$_id",
            name: "$product.name",
            totalSold: 1,
            _id: 0
          }
        }
      ]);
      await redis.set(cacheKey, JSON.stringify(topProducts), 'EX', CACHE_TTL);
      return topProducts;
    },
    getSalesAnalytics: async (_, { startDate, endDate }) => {
      const cacheKey = `salesAnalytics:${startDate}:${endDate}`;
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
      const start = new Date(startDate);
      const end = new Date(endDate);
      const analytics = await Order.aggregate([
        { $match: {
            orderDate: { $gte: start, $lte: end },
            status: "Completed"
        }},
        { $unwind: "$items" },
        {
          $lookup: {
            from: "products",
            localField: "items.productId",
            foreignField: "_id",
            as: "product"
          }
        },
        { $unwind: "$product" },
        {
          $addFields: {
            itemRevenue: { $multiply: ["$items.quantity", "$product.price"] },
            category: "$product.category"
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$itemRevenue" },
            completedOrders: { $addToSet: "$_id" },
            categoryMap: {
              $push: { category: "$category", revenue: "$itemRevenue" }
            }
          }
        }
      ]);
      if (!analytics.length) {
        return {
          totalRevenue: 0,
          completedOrders: 0,
          categoryBreakdown: []
        };
      }
      // Calculate revenue per category
      const categoryRevenue = {};
      analytics[0].categoryMap.forEach(({ category, revenue }) => {
        categoryRevenue[category] = (categoryRevenue[category] || 0) + revenue;
      });
      const result = {
        totalRevenue: analytics[0].totalRevenue,
        completedOrders: analytics[0].completedOrders.length,
        categoryBreakdown: Object.entries(categoryRevenue).map(([category, revenue]) => ({ category, revenue }))
      };
      await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL);
      return result;
    },
    getCustomerOrders: async (_, { customerId, page, pageSize }) => {
      const skip = (page - 1) * pageSize;
      const [orders, totalCount] = await Promise.all([
        Order.find({ customerId })
          .sort({ orderDate: -1 })
          .skip(skip)
          .limit(pageSize),
        Order.countDocuments({ customerId })
      ]);
      const totalPages = Math.ceil(totalCount / pageSize);
      return {
        orders: orders.map(order => ({
          _id: order._id,
          orderDate: order.orderDate.toISOString(),
          status: order.status,
          items: order.items,
          total: order.total
        })),
        totalCount,
        page,
        pageSize,
        totalPages
      };
    },
  },
  Mutation: {
    placeOrder: async (_, { input }) => {
      const { customerId, items } = input;
      // Validate customer
      const customer = await Customer.findById(customerId);
      if (!customer) {
        return { orderId: null, success: false, message: 'Customer not found' };
      }
      // Validate products and calculate total
      let total = 0;
      const orderItems = [];
      for (const item of items) {
        const product = await Product.findById(item.productId);
        if (!product) {
          return { orderId: null, success: false, message: `Product not found: ${item.productId}` };
        }
        orderItems.push({ productId: item.productId, quantity: item.quantity });
        total += product.price * item.quantity;
      }
      // Create order
      const order = await Order.create({
        _id: require('crypto').randomUUID(),
        customerId,
        orderDate: new Date(),
        status: 'Completed',
        items: orderItems,
        total
      });
      return { orderId: order._id, success: true, message: 'Order placed successfully' };
    }
  },
};

async function startServer() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/salesdb';
  if (!mongoUri || typeof mongoUri !== 'string') {
    throw new Error('MongoDB connection string is missing. Set MONGO_URI in your .env file.');
  }
  await mongoose.connect(mongoUri);
  const app = express();
  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();
  server.applyMiddleware({ app });
  app.listen({ port: 4000 }, () => {
    console.log('Server ready at http://localhost:4000' + server.graphqlPath);
  });
}

startServer();