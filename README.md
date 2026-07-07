# Product Price Tracker

A simple browser app to track product pricing and profitability.

## What It Does

- Add products with:
  - Product name
  - Optional SKU
  - Cost price
  - Retail price
- Automatically calculates per product:
  - Profit = Retail - Cost
  - Margin % = Profit / Retail * 100
  - Markup % = Profit / Cost * 100
- Edit and delete products
- Search by product name or SKU
- Saves data in browser local storage

## How To Run

1. Open `index.html` in any modern browser.
2. Enter product values and click **Save Product**.

No install is required.

## Files

- `index.html` - App structure
- `styles.css` - UI styling and responsive layout
- `app.js` - App logic and local storage
