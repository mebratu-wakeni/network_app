const { ViewModel, SharedStateManager } = Liteframe;

export class InventoryVM extends ViewModel {
  constructor(sharedStateManager = new SharedStateManager()) {
    super(sharedStateManager);
    this.initialize();
    this.loadTableData();
  }

  initialize() {
    this.setState('inventory-tab', 'stock');
    this.setState('loading', false);
    this.setState('messages', {});
    this.setState('table-config', {
      limit: 10,
      offset: 0,
      sortBy: 'id',
      orderBy: 'desc'
    })
    this.setState('total-count', 100);

    this.setState('product-list', []);
    this.setState('stock-list', []);
  }

  async loadTableData() {
     const products = [
      {
        "id": 320,
        "product_code": "0004",
        "name": "AFB 3x250ml",
        "description": "",
        "category_id": 61,
        "unit_id": 106,
        "remark": null,
        "created_at": "2025-12-04 14:55:46",
        "last_updated": "2025-12-04 14:55:46",
        "sync_status": "pending",
        "category": "Reagent",
        "unit": "Bottle"
      },
      {
        "id": 321,
        "product_code": "0005",
        "name": "AFP Fincare 25 tests",
        "description": "",
        "category_id": 62,
        "unit_id": 107,
        "remark": null,
        "created_at": "2025-12-04 14:55:46",
        "last_updated": "2025-12-04 14:55:46",
        "sync_status": "pending",
        "category": "Supplies",
        "unit": "PK"
      },
      {
        "id": 327,
        "product_code": "0011",
        "name": "AMH Fincare 25 tests",
        "description": "",
        "category_id": 62,
        "unit_id": 107,
        "remark": null,
        "created_at": "2025-12-04 14:55:46",
        "last_updated": "2025-12-04 14:55:46",
        "sync_status": "pending",
        "category": "Supplies",
        "unit": "PK"
      },
      {
        "id": 334,
        "product_code": "0018",
        "name": "ASO latex 100 tests",
        "description": "",
        "category_id": 61,
        "unit_id": 109,
        "remark": null,
        "created_at": "2025-12-04 14:55:46",
        "last_updated": "2025-12-04 14:55:46",
        "sync_status": "pending",
        "category": "Reagent",
        "unit": "Kit"
      },
      {
        "id": 318,
        "product_code": "0002",
        "name": "Aceitic acid 5% 1000ml",
        "description": "",
        "category_id": 61,
        "unit_id": 106,
        "remark": null,
        "created_at": "2025-12-04 14:55:46",
        "last_updated": "2025-12-04 14:55:46",
        "sync_status": "pending",
        "category": "Reagent",
        "unit": "Bottle"
      },
      {
        "id": 317,
        "product_code": "0001",
        "name": "Acetone Alcohol 250ml",
        "description": "",
        "category_id": 61,
        "unit_id": 106,
        "remark": null,
        "created_at": "2025-12-04 14:55:46",
        "last_updated": "2025-12-04 14:55:46",
        "sync_status": "pending",
        "category": "Reagent",
        "unit": "Bottle"
      },
      {
        "id": 319,
        "product_code": "0003",
        "name": "Acid alcohol 3% 250ml",
        "description": "",
        "category_id": 61,
        "unit_id": 106,
        "remark": null,
        "created_at": "2025-12-04 14:55:46",
        "last_updated": "2025-12-04 14:55:46",
        "sync_status": "pending",
        "category": "Reagent",
        "unit": "Bottle"
      },
      {
        "id": 322,
        "product_code": "0006",
        "name": "Albendazole 400mg of 10",
        "description": "",
        "category_id": 62,
        "unit_id": 107,
        "remark": null,
        "created_at": "2025-12-04 14:55:46",
        "last_updated": "2025-12-04 14:55:46",
        "sync_status": "pending",
        "category": "Supplies",
        "unit": "PK"
      },
      {
        "id": 323,
        "product_code": "0007",
        "name": "Alcohol Denatured 70%",
        "description": "",
        "category_id": 62,
        "unit_id": 108,
        "remark": null,
        "created_at": "2025-12-04 14:55:46",
        "last_updated": "2025-12-04 14:55:46",
        "sync_status": "pending",
        "category": "Supplies",
        "unit": "Litter"
      },
      {
        "id": 324,
        "product_code": "0008",
        "name": "Alkaline Phosphatase - Jouri",
        "description": "",
        "category_id": 61,
        "unit_id": 109,
        "remark": null,
        "created_at": "2025-12-04 14:55:46",
        "last_updated": "2025-12-04 14:55:46",
        "sync_status": "pending",
        "category": "Reagent",
        "unit": "Kit"
      }
    ];

    this.updateState('product-list', products);
  }

  getProductList() {
    return this.getState('product-list');
  }
  filterProductList(query) {
    return this.getProductList().filter(product => product.name.toLowerCase().includes(query.toLowerCase()))
  }

  getActiveTab() {
    return this.getState('inventory-tab');
  }

  updateTab(value) {
    this.updateState('inventory-tab', value);
    this.updateState('loading', false);
    
  }
  setLimit(limit) {
    const tableConfig = this.getState('table-config');

    this.updateState('table-config', {
      ...tableConfig,
      limit
    });
    this.updateState('loading', false);
  }

  nextPage() {
    const tableConfig = this.getState('table-config');

    if(tableConfig.offset + tableConfig.limit + 1 >  this.getState('total-count')) return 

    this.updateState('table-config', {
      ...tableConfig,
      offset: tableConfig.offset + tableConfig.limit,
    });
    this.updateState('loading', false)
  }
  previousPage() {
    const tableConfig = this.getState('table-config');

    if (tableConfig.offset - 1 < 0) return 
    
    this.updateState('table-config', {
      ...tableConfig,
      offset: tableConfig.offset - tableConfig.limit,
    });
    this.updateState('loading', false)
  }
}