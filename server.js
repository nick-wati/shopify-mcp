//!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import axios from "axios";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Extract and validate required environment variables
const {
  SHOPIFY_ACCESS_TOKEN,
  SHOPIFY_STORE_DOMAIN,
  SHOPIFY_API_VERSION = '2025-04',
  MCP_PROTOCOL_VERSION = '2024-11-05',
  PORT = 3000
} = process.env;

// Validate required Shopify credentials
if (!SHOPIFY_ACCESS_TOKEN || !SHOPIFY_STORE_DOMAIN) {
  console.error('Missing Shopify credentials');
  process.exit(1);
}

// Initialize Express application
const app = express();

// Health check endpoint for monitoring
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Initialize MCP server with configuration
const mcpServer = new Server(
  {
    name: "shopify-mcp-server",
    version: "1.0.0",
    protocolVersion: MCP_PROTOCOL_VERSION
  },
  {
    capabilities: {
      tools: {},
      experimental: {},
      prompts: { listChanged: false },
      resources: { subscribe: false, listChanged: false },
    },
  }
);

// Track active SSE transport for message handling
let activeTransport = null;

/**
 * Search for products in Shopify store by keyword
 * @param {string} keyword - Search term to find products
 * @returns {Promise<Array>} - Array of products with id, title, price, and image
 */
async function searchProducts(keyword) {
  const { data } = await axios.get(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/products.json`, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN },
    params: { title: keyword, limit: 5 }
  });
  return (data.products || []).map(p => ({
    id: p.id,
    title: p.title,
    price: p.variants[0]?.price,
    image: p.image?.src
  }));
}

/**
 * Get recommended products from Shopify store
 * @returns {Promise<Array>} - Array of best-selling products with id, title, price, and image
 */
async function recommendProducts() {
  const { data } = await axios.get(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/products.json`, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN },
    params: { limit: 5, order: 'best-selling' }
  });
  return (data.products || []).map(p => ({
    id: p.id,
    title: p.title,
    price: p.variants[0]?.price,
    image: p.image?.src
  }));
}

// Register tool listing handler
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_products",
        description: "Search Shopify products by keyword",
        type: "action",
        inputSchema: {
          type: "object",
          properties: { keyword: { type: "string" } },
          required: ["keyword"]
        },
      },
      {
        name: "recommend_products",
        description: "Recommend top-selling Shopify products",
        type: "action",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// Register tool execution handler
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "search_products" && args?.keyword) {
    const products = await searchProducts(args.keyword);
    return { content: [{ type: "text", text: JSON.stringify(products, null, 2) }], isError: false };
  }

  if (name === "recommend_products") {
    const recommendations = await recommendProducts();
    return { content: [{ type: "text", text: JSON.stringify(recommendations, null, 2) }], isError: false };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// SSE endpoint for real-time communication
app.get('/sse', (req, res) => {
  const transport = new SSEServerTransport('/messages', res);
  activeTransport = transport;
  mcpServer.connect(transport);
});

// Message handling endpoint for SSE
app.post('/messages', (req, res) => {
  if (activeTransport) {
    activeTransport.handlePostMessage(req, res);
  } else {
    res.status(400).send('No active SSE client');
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`MCP server running at http://localhost:${PORT}`);
});
