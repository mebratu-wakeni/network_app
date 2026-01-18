# Stock Management Aggregate Stats - Brainstorming

## Overview
This document outlines aggregate statistics necessary for effective stock management in a pharmaceutical/logistics inventory system.

---

## 1. **Basic Inventory Metrics**

### Total Stock Value
- **Description**: Total monetary value of all stock items
- **Calculation**: `SUM(quantity * unit_cost)` or `SUM(quantity * current_price)`
- **Use Case**: Financial overview, insurance valuation

### Total Stock Quantity
- **Description**: Total number of units across all products
- **Calculation**: `SUM(quantity)`
- **Use Case**: Overall inventory volume assessment

### Total SKUs/Products
- **Description**: Count of distinct products in inventory
- **Calculation**: `COUNT(DISTINCT product_id)`
- **Use Case**: Product diversity metrics

### Total Stock Items
- **Description**: Count of all stock entries (batches/lots)
- **Calculation**: `COUNT(*)` from stock table
- **Use Case**: Inventory complexity assessment

---

## 2. **Stock Health Metrics**

### Out of Stock
- **Description**: Products with zero quantity
- **Calculation**: `COUNT(*) WHERE quantity = 0`
- **Use Case**: Critical alerts, reorder triggers

### Low Stock
- **Description**: Products below reorder point/threshold
- **Calculation**: `COUNT(*) WHERE quantity <= reorder_point`
- **Use Case**: Proactive restocking alerts

### Overstock
- **Description**: Products exceeding maximum stock level
- **Calculation**: `COUNT(*) WHERE quantity > max_stock_level`
- **Use Case**: Capital optimization, storage management

### Stock Turnover Rate
- **Description**: How quickly inventory is sold/used
- **Calculation**: `(Cost of Goods Sold / Average Inventory) * 100`
- **Use Case**: Efficiency metrics, slow-moving item identification

### Average Stock Level
- **Description**: Mean quantity across all products
- **Calculation**: `AVG(quantity)`
- **Use Case**: Benchmarking, trend analysis

---

## 3. **Expiry & Quality Metrics**

### Expiring Soon
- **Description**: Items expiring within X days (e.g., 30, 60, 90 days)
- **Calculation**: `COUNT(*) WHERE expiry_date BETWEEN NOW() AND NOW() + INTERVAL 'X days'`
- **Use Case**: FIFO management, waste reduction

### Expired Stock
- **Description**: Items past expiration date
- **Calculation**: `COUNT(*) WHERE expiry_date < NOW()`
- **Use Case**: Compliance, disposal management

### Near Expiry (30/60/90 days)
- **Description**: Separate counts for different expiry windows
- **Use Case**: Prioritized action planning

### Damaged Stock
- **Description**: Items marked as damaged
- **Calculation**: `COUNT(*) WHERE status = 'damaged'` or `SUM(quantity) WHERE condition = 'damaged'`
- **Use Case**: Quality control, insurance claims

### Lost Stock
- **Description**: Items marked as lost
- **Calculation**: `COUNT(*) WHERE status = 'lost'` or `SUM(quantity) WHERE status = 'lost'`
- **Use Case**: Loss tracking, security audits

### Missing Stock
- **Description**: Discrepancies between expected and actual stock
- **Calculation**: `SUM(expected_quantity - actual_quantity) WHERE actual_quantity < expected_quantity`
- **Use Case**: Inventory audits, theft detection

---

## 4. **Financial Metrics**

### Total Inventory Value
- **Description**: Current market value of all stock
- **Calculation**: `SUM(quantity * current_price)`
- **Use Case**: Balance sheet, financial reporting

### Cost of Goods Sold (COGS)
- **Description**: Total cost of items sold/used in a period
- **Calculation**: `SUM(quantity_sold * unit_cost)` for period
- **Use Case**: Profitability analysis

### Inventory Carrying Cost
- **Description**: Cost of holding inventory (storage, insurance, etc.)
- **Calculation**: `(Average Inventory Value * Carrying Cost %)`
- **Use Case**: Cost optimization

### Stock Value by Category
- **Description**: Value breakdown by product category
- **Calculation**: `SUM(quantity * price) GROUP BY category`
- **Use Case**: Category performance analysis

### Average Unit Cost
- **Description**: Mean cost per unit across all items
- **Calculation**: `AVG(unit_cost)` or `SUM(total_cost) / SUM(quantity)`
- **Use Case**: Pricing strategy, cost trends

---

## 5. **Movement & Activity Metrics**

### Stock In (Today/Week/Month)
- **Description**: Total quantity received in period
- **Calculation**: `SUM(quantity) WHERE transaction_type = 'in' AND date >= period_start`
- **Use Case**: Receiving activity, supplier performance

### Stock Out (Today/Week/Month)
- **Description**: Total quantity issued/sold in period
- **Calculation**: `SUM(quantity) WHERE transaction_type = 'out' AND date >= period_start`
- **Use Case**: Sales/usage trends, demand forecasting

### Stock Transfers
- **Description**: Items moved between locations
- **Calculation**: `COUNT(*) WHERE transaction_type = 'transfer'`
- **Use Case**: Location management, logistics efficiency

### Stock Adjustments
- **Description**: Manual corrections/adjustments made
- **Calculation**: `COUNT(*) WHERE transaction_type = 'adjustment'`
- **Use Case**: Audit trail, accuracy tracking

### Most Active Products
- **Description**: Products with highest transaction frequency
- **Calculation**: `COUNT(transactions) GROUP BY product_id ORDER BY count DESC LIMIT N`
- **Use Case**: Fast-moving items, demand patterns

### Slow-Moving Items
- **Description**: Products with no movement in X days
- **Calculation**: `COUNT(*) WHERE last_transaction_date < NOW() - INTERVAL 'X days'`
- **Use Case**: Dead stock identification, clearance planning

---

## 6. **Time-Based Metrics**

### Stock Received This Week/Month
- **Description**: Incoming stock for time period
- **Use Case**: Receiving trends, supplier scheduling

### Stock Issued This Week/Month
- **Description**: Outgoing stock for time period
- **Use Case**: Usage patterns, demand forecasting

### Stock Aging Analysis
- **Description**: Stock grouped by age (0-30 days, 31-60, 61-90, 90+)
- **Calculation**: `COUNT(*) GROUP BY age_bucket`
- **Use Case**: FIFO compliance, obsolescence risk

### Days of Stock Remaining
- **Description**: Estimated days until stockout based on usage rate
- **Calculation**: `quantity / (average_daily_usage)`
- **Use Case**: Reorder planning, stockout prevention

---

## 7. **Location & Warehouse Metrics**

### Stock by Location/Warehouse
- **Description**: Quantity/value breakdown by storage location
- **Calculation**: `SUM(quantity) GROUP BY location_id`
- **Use Case**: Location optimization, space planning

### Stock by Bin/Shelf
- **Description**: Granular location tracking
- **Use Case**: Picking efficiency, organization

### Cross-Location Transfers
- **Description**: Items moved between locations
- **Use Case**: Logistics optimization

---

## 8. **Category & Product Type Metrics**

### Stock by Category
- **Description**: Quantity/value by product category (e.g., Regent, Supplies)
- **Calculation**: `SUM(quantity) GROUP BY category`
- **Use Case**: Category performance, purchasing strategy

### Stock by Unit Type
- **Description**: Breakdown by unit (Bottle, PK, Kit, etc.)
- **Calculation**: `SUM(quantity) GROUP BY unit`
- **Use Case**: Packaging analysis, unit conversion

### Stock by Supplier
- **Description**: Inventory sourced from each supplier
- **Calculation**: `SUM(quantity) GROUP BY supplier_id`
- **Use Case**: Supplier relationship management

---

## 9. **Alert & Warning Metrics**

### Critical Alerts Count
- **Description**: Total number of critical issues (out of stock, expired, etc.)
- **Calculation**: `COUNT(*) WHERE alert_level = 'critical'`
- **Use Case**: Dashboard prioritization

### Warning Alerts Count
- **Description**: Non-critical issues requiring attention
- **Calculation**: `COUNT(*) WHERE alert_level = 'warning'`
- **Use Case**: Proactive management

### Items Requiring Attention
- **Description**: Products needing immediate action
- **Use Case**: Task prioritization

---

## 10. **Compliance & Audit Metrics**

### Stock Audit Status
- **Description**: Last audit date, items pending audit
- **Calculation**: `COUNT(*) WHERE last_audit_date < threshold OR audit_status = 'pending'`
- **Use Case**: Compliance tracking

### Discrepancy Count
- **Description**: Items with quantity mismatches
- **Calculation**: `COUNT(*) WHERE expected_quantity != actual_quantity`
- **Use Case**: Accuracy monitoring

### Stock Movements Logged
- **Description**: Total transactions recorded
- **Calculation**: `COUNT(*) FROM stock_transactions`
- **Use Case**: Audit trail completeness

---

## 11. **Advanced Analytics**

### Stock Velocity
- **Description**: Rate of stock movement (units/time)
- **Calculation**: `SUM(quantity_moved) / time_period`
- **Use Case**: Demand forecasting, trend analysis

### Stock Accuracy Rate
- **Description**: Percentage of accurate stock counts
- **Calculation**: `(Accurate counts / Total counts) * 100`
- **Use Case**: System reliability metrics

### Fill Rate
- **Description**: Percentage of orders fulfilled from stock
- **Calculation**: `(Orders fulfilled / Total orders) * 100`
- **Use Case**: Customer service metrics

### Stockout Frequency
- **Description**: How often items go out of stock
- **Calculation**: `COUNT(stockout_events) / time_period`
- **Use Case**: Service level assessment

### Average Days to Stockout
- **Description**: Mean time until stock depletion
- **Calculation**: `AVG(days_until_stockout)`
- **Use Case**: Reorder timing optimization

---

## 12. **Recommended Priority Stats for Dashboard**

### High Priority (Critical for Operations)
1. **Total Stock Value** - Financial overview
2. **Out of Stock** - Critical alerts
3. **Low Stock** - Proactive management
4. **Expiring Soon** - Waste prevention
5. **Stock In/Out (Today)** - Daily activity
6. **Expired Stock** - Compliance

### Medium Priority (Important for Management)
7. **Total Stock Quantity** - Volume overview
8. **Damaged/Lost/Missing** - Quality control
9. **Stock by Category** - Category analysis
10. **Stock Turnover Rate** - Efficiency metrics
11. **Stock Received/Issued (Week/Month)** - Trends

### Low Priority (Nice to Have)
12. **Stock Aging Analysis** - Detailed insights
13. **Stock by Location** - Multi-location management
14. **Slow-Moving Items** - Optimization
15. **Stock Velocity** - Advanced analytics

---

## Implementation Considerations

### Data Requirements
- **Stock Table**: product_id, quantity, unit_cost, current_price, location_id, expiry_date, status, condition
- **Stock Transactions Table**: transaction_id, product_id, quantity, transaction_type (in/out/transfer/adjustment), date, user_id
- **Products Table**: product_id, name, category, unit, reorder_point, max_stock_level

### Performance Optimization
- Consider materialized views for complex aggregations
- Cache frequently accessed stats
- Use database indexes on frequently queried columns
- Implement incremental updates for time-based metrics

### Real-time vs Batch Updates
- **Real-time**: Critical alerts (out of stock, expired)
- **Batch**: Complex aggregations (turnover rate, velocity)
- **Scheduled**: Daily/weekly summaries

---

## Next Steps

1. **Database Schema Design**: Create tables for stock, stock_transactions, products
2. **API Endpoints**: Design endpoints for fetching aggregate stats
3. **Dashboard Components**: Build UI components for displaying stats
4. **Alert System**: Implement real-time alerts for critical metrics
5. **Reporting**: Create reports for historical analysis
