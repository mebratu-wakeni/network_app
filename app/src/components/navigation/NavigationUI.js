const { Row, StatefulRow } = Liteframe;
import { InventoryUI } from "../modules/inventory/Inventory.js";
import { Inventory } from "../modules/inventory/Inventory_old.js";
import { PurchaseUI } from "../modules/purchase/Purchase.js";
import { SalesUI } from "../modules/sales/Sales.js";
import ServerManagerUI from "../serverManager/ServerManagerUI.js";
import { cleanupServerManager } from "../serverManager/ServerManagerVM.js";
import UserProfile from "../users/profile/profile.js";
import UsersTable from "../users/UsersUI.js";
import { CustomersUI } from "../customers/CustomersUI.js";
import { SettingsUI } from "../settings/SettingsUI.js";
import { FinancialUI } from "../modules/financial/Financial.js";
import { Card, CardHeader } from "../utils/Card.js";
import ExampleCard from "../utils/example.js";
import ProductsTable from "../utils/exampleTable.js";
import NavigationVM from "./NavigationVM.js";
import { DashboardUI } from "../dashboard/DashboardUI.js";

// Route cleanup registry: maps route paths to their cleanup functions
// Add routes here that need cleanup when navigating away
const ROUTE_CLEANUP_REGISTRY = {
  '/server': cleanupServerManager,
  // Add more routes here as needed:
  // '/other-route': cleanupOtherComponent,
};

export default function  NavigationUI(props) {
  
  
  // Track current route for cleanup (initialize to default route)
  // Default active menu is 'Dashboard' which corresponds to '/'
  let currentRoute = '/';

  const router = props.router;

  props.viewModel.menuOptions.forEach(option => {
    router.addRoute(option.route, () => {
      if (option.route === '/server') {
        return ServerManagerUI();
      }
      if (option.route === '/') return DashboardUI({ router, navigationVM: props.viewModel });
      if (option.route === '/inventory') return InventoryUI();
      if (option.route === '/purchase') return PurchaseUI({ router, navigationVM: props.viewModel });
      if (option.route === '/sales') return SalesUI({ router, navigationVM: props.viewModel });
      if (option.route === '/financial') return FinancialUI({ router, navigationVM: props.viewModel });
      if (option.route === '/customers') return CustomersUI();
      if (option.route === '/users') return UsersTable();
      if (option.route === '/settings') return SettingsUI();
      if (option.route === '/user-profile') return UserProfile();

      return Row({ tagType: 'h2'}, 'Unspecified Route')
       // Replace with actual content
    });
  });

  props.ensureStateKey('active-menu');

  const activeMenu = props.viewModel.getState('active-menu');
  const navCollapsed = props.getLocalState('navCollapsed');
  const auth = props.viewModel.getState('auth') || {};
  const userRules = (auth.user && auth.user.rules) ? auth.user.rules : [];
  const menuOptions = props.viewModel.menuOptions.filter(opt =>
    opt.showInNav !== false &&
    (!opt.requireRule || (Array.isArray(userRules) && userRules.includes(opt.requireRule)))
  );

  return Row({ tagType: 'ul', class: "space-y-2" }, [
    ...menuOptions.map(option => Row({ 
      tagType: 'li',
      class: navCollapsed ? 'overflow-x-hidden' : ''
    }, [
      Row({ 
        tagType: 'a', 
        class: `flex justify-between p-3 ${activeMenu === option.title ? 'bg-blue-500' : ''} rounded-lg  text-white font-medium hover:bg-gray-100 hover:text-blue-800 transition overflow-x-hidden`,
        events: {
          'click': () => {
            // Cleanup current route if it has a cleanup function registered
            // This prevents memory leaks from intervals, timers, etc.
            if (currentRoute && ROUTE_CLEANUP_REGISTRY[currentRoute]) {
              ROUTE_CLEANUP_REGISTRY[currentRoute]();
            }
            
            // Update current route and navigate
            currentRoute = option.route;
            props.viewModel.updateState('active-menu', option.title);
            router.navigate(option.route);
          }
        }},
        [
          Row({ class: 'flex items-center gap-3' }, [
            Row({ tagType: 'ion-icon', attributes: { name: option.icon, class: 'text-2xl' } }),
            Row({ tagType: 'span', class: `text-base font-medium ${navCollapsed ? 'scale-0' : ''}` }, option.title)
          ]),
      ])
    ]))
  ])
}