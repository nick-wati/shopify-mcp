//!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const { SHOPIFY_ACCESS_TOKEN, SHOPIFY_STORE_DOMAIN, SHOPIFY_API_VERSION = '2025-04', MCP_PROTOCOL_VERSION = '2024-11-05', PORT = 3000 } = process.env;

if (!SHOPIFY_ACCESS_TOKEN || !SHOPIFY_STORE_DOMAIN) {
  console.error('Missing Shopify credentials');
  process.exit(1);
}

const app = express();

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

const mcpServer = new Server(
  {
    name: "shopify-mcp-server",
    version: "1.0.0",
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

let activeTransport = null;

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

app.get('/sse', (req, res) => {
  const transport = new SSEServerTransport('/messages', res);
  activeTransport = transport;
  mcpServer.connect(transport);
});

app.post('/messages', (req, res) => {
  if (activeTransport) {
    activeTransport.handlePostMessage(req, res);
  } else {
    res.status(400).send('No active SSE client');
  }
});

app.listen(PORT, () => {
  console.log(`MCP server running at http://localhost:${PORT}`);
});
