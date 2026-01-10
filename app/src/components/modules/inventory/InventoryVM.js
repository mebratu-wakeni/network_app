const { ViewModel, SharedStateManager } = Liteframe; 


export class InventoryVM extends ViewModel {
  constructor(sharedStateManager = new SharedStateManager()){
    super(sharedStateManager);
    this.initialize();
  }

  initialize() {
    this.setState('inventory-tab', 'stock');
    this.setState('loading', false);
    this.setState('messages', {});

  }
  getActiveTab() {
    return this.getState('inventory-tab');
  }


  updateTab(toTab) {
    this.updateState('inventory-tab', toTab);
    this.updateState('loading', false);
  }
}