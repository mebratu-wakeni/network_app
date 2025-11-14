const { ViewModel, SharedStateManager } = Liteframe

const MENU = [
  { title: 'Dashboard', route: '/', icon: "grid-outline" },
  {title: 'Inventory', route: '/inventory', icon: "layers-outline" },
  {title: 'Server', route: '/server', icon: "server-outline" },
  {title: 'Users', route: '/users', icon: "people-outline"}
]

export default class NavigationVM extends ViewModel {
  constructor(stateManager = new SharedStateManager()) { // Default to singleton sharedState
    super(stateManager);
    this.menuOptions = MENU;
    this.initializeState()
  }

  initializeState() {
    this.setState('active-menu', 'Dashboard')
  }

}