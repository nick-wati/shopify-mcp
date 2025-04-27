# 🛍️ Shopify Shopping Assistant MCP

Minimal MCP server for AI agents to search and recommend products from your Shopify store. Built using Server-Sent Events (SSE) for real-time communication. Supports product search and recommendations.

## 🚀 Setup

1. Install:
```bash
git clone https://github.com/nick-wati/shopify-mcp.git
cd shopify-mcp
npm install
```

2. Create `.env`:
```bash
SHOPIFY_ACCESS_TOKEN=your-shopify-admin-api-token
SHOPIFY_STORE_DOMAIN=your-store-name.myshopify.com
PORT=3000
```

3. Run: `node server.js`

## 🔗 Cursor Integration

Add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "shopify-shopping-assistant": {
      "url": "http://localhost:3000/sse"
    }
  }
} 
```

## 🛠️ Tools

- `search_products`: Search by keyword
- `recommend_products`: Get product recommendations

## 💡 Suggested Prompts

- "Find me products about sneakers"
- "Recommend some popular products"
- "Show me items related to hats"
- "I want to buy a bag, help me"

## 📋 Notes

- Authentication required via `.env` file
- Don't commit `.env` to GitHub

## 📜 License

MIT

