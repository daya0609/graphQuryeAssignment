# Sales & Revenue Analytics API

A Node.js, MongoDB, and GraphQL API for e-commerce sales analytics. Analyze revenue, customer spending, and product sales trends using real data imported from CSV files.

## Features
- GraphQL API for analytics and order management
- MongoDB aggregation for efficient analytics
- Redis caching for fast analytics queries
- CSV import utility for initial data
- Bonus: Place orders and paginate customer orders

## Prerequisites
- Node.js (v16+)
- MongoDB (local or remote)
- Redis (for caching, optional but recommended)

## Setup Instructions

### 1. Clone the repository
```
git clone <your-repo-url>
cd mongoGraphQl
```

### 2. Install dependencies
```
npm install
```

### 3. Configure environment variables
Create a `.env` file in the project root:
```
MONGO_URI=mongodb://localhost:27017/salesdb
```

### 4. Import CSV data into MongoDB
Ensure MongoDB is running, then run:
```
node src/importData.js
```
This will import data from `csv_data/customers.csv`, `orders.csv`, and `products.csv`.

### 5. Start Redis (optional, for caching)
If you want to use Redis caching, ensure Redis is running locally (default: `localhost:6379`).

### 6. Start the server
```
node src/index.js
```
The GraphQL Playground will be available at [http://localhost:4000/graphql](http://localhost:4000/graphql).

## GraphQL API

### Main Queries
- `getCustomerSpending(customerId: ID!): CustomerSpending`
- `getTopSellingProducts(limit: Int!): [TopProduct]`
- `getSalesAnalytics(startDate: String!, endDate: String!): SalesAnalytics`
- `getCustomerOrders(customerId: ID!, page: Int!, pageSize: Int!): CustomerOrdersPage!`

### Mutation
- `placeOrder(input: PlaceOrderInput!): PlaceOrderPayload!`

### Sample Queries
See [`queries.graphql`](./queries.graphql) for ready-to-use examples.

## Project Structure
```
├── csv_data/           # CSV files for import
├── src/
│   ├── importData.js   # CSV import script
│   ├── index.js        # Main server (GraphQL, Express)
│   └── models/         # Mongoose models
│       ├── Customer.js
│       ├── Order.js
│       └── Product.js
├── queries.graphql     # Sample GraphQL queries
├── package.json
└── .env                # Environment variables
```

## Bonus Features
- Place orders via GraphQL mutation
- Paginate customer orders
- Redis caching for analytics queries
