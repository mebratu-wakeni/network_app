const { Row, StatefulRow } = Liteframe;
import ServerManagerUI from "../serverManager/ServerManagerUI.js";
import { cleanupServerManager } from "../serverManager/ServerManagerVM.js";
import UsersTable from "../users/UsersUI.js";
import { Button } from "../utils/Button.js";
import { Card, CardHeader } from "../utils/Card.js";
import ExampleCard from "../utils/example.js";
import ProductsTable from "../utils/exampleTable.js";
import NavigationVM from "./NavigationVM.js";

// Route cleanup registry: maps route paths to their cleanup functions
// Add routes here that need cleanup when navigating away
const ROUTE_CLEANUP_REGISTRY = {
  '/server': cleanupServerManager,
  // Add more routes here as needed:
  // '/other-route': cleanupOtherComponent,
};

export default function  NavigationUI(router) {
  
  const viewModel = new NavigationVM();
  
  // Track current route for cleanup (initialize to default route)
  // Default active menu is 'Dashboard' which corresponds to '/'
  let currentRoute = '/';

  viewModel.menuOptions.forEach(option => {
    router.addRoute(option.route, () => {
      if (option.route === '/server') {
        return ServerManagerUI();
      }
      if (option.route === '/') return ExampleCard();
      if (option.route === '/inventory') return Card({}, [
        ProductsTable(),
      ])
      if (option.route === '/users') return UsersTable();
      
      return Row({ tagType: 'h2'}, 'Unspecified Route')
       // Replace with actual content
    });
  })

  const render = (props) => {
    props.ensureStateKey('active-menu');
    props.ensureStateKey('navCollapsed');

    const activeMenu = props.viewModel.getState('active-menu');
    const navCollapsed = props.viewModel.getState('navCollapsed') || false;
    
    return Row({ tagType: 'ul', class: "p-4 space-y-2" }, [
      ...props.viewModel.menuOptions.map(option => Row({ 
        tagType: 'li',
        class: navCollapsed ? 'overflow-x-hidden' : ''
      }, [
        Row({ 
          tagType: 'a', 
          class: `flex justify-between p-3 ${activeMenu === option.title ? 'bg-blue-500' : ''} rounded-lg  text-white font-medium hover:bg-gray-100 hover:text-blue-800 transition overflow-x-hidden min-w-60`,
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
              Row({ tagType: 'span', class: 'text-base font-medium' }, option.title)
            ]),
            Row({tagType: 'span', class: `${activeMenu === option.title ? '' : 'hidden'}`}, [
              Row({ tagType: 'ion-icon', attributes: { 'data-id': 'down', name: 'chevron-down-outline', class: 'text-2xl' }}) 
            ]),
            Row({ tagType: 'span', class: `${activeMenu === option.title ? 'hidden' : ''}`}, [
              Row({ tagType: 'ion-icon', attributes: { 'data-id': 'right', name: 'chevron-forward-outline', class: 'text-2xl' } }) 
            ])  
        ])
      ]))
    ])
  }

  return StatefulRow({ class: 'flex-1', viewModel }, render)
}