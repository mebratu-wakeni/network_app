const { Row, StatefulRow } = Liteframe;
import Label from '../utils/Label.js';
import { Input } from '../utils/Input.js';
import HeaderVM from './HeaderVM.js';
import Dropdown from '../utils/Dropdown.js';
import { IconButton, IonIcon } from '../utils/Icon.js';

export default function HeaderUI() {
  const viewModel = new HeaderVM();
  
  // Track previous navCollapsed state to detect changes
  let previousNavCollapsed = null;

  const render = (props) => {
    props.ensureStateKey('navCollapsed');
    props.ensureStateKey('serverHealth');
    props.ensureStateKey('dbHealth');
    props.ensureStateKey('apiHealth');
    props.ensureStateKey('user');

    const navCollapsed = props.viewModel.getState('navCollapsed');
    
    // Handle sidebar DOM manipulation when navCollapsed state changes
    if (previousNavCollapsed !== navCollapsed) {
      previousNavCollapsed = navCollapsed;
      
      // Update sidebar width based on state
      setTimeout(() => {
        const sidebar = document.getElementById('sidebar') || 
                       document.querySelector('section[class*="w-75"]') ||
                       document.querySelector('section.bg-blue-800');
        
        if (sidebar) {
          if (navCollapsed) {
            // Collapse to 80px
            sidebar.style.width = '70px';
            sidebar.style.minWidth = '70px';
            sidebar.style.maxWidth = '70px';
            sidebar.style.overflowY = 'auto';
          } else {
            // Expand to 300px
            sidebar.style.width = '300px';
            sidebar.style.minWidth = '300px';
            sidebar.style.maxWidth = '300px';
            sidebar.style.overflowY = 'auto';
            
            // Show text in navigation items
            const navTexts = sidebar.querySelectorAll('span.text-base');
            navTexts.forEach(el => {
              el.style.display = '';
            });
          }
        }
      }, 0);
    }
    const serverHealth = props.viewModel.getState('serverHealth');
    const dbHealth = props.viewModel.getState('dbHealth');
    const apiHealth = props.viewModel.getState('apiHealth');
    const user = props.viewModel.getState('user');

    // Health status helper
    const getHealthStatus = (health) => {
      if (!health) return { healthy: false, pulsating: false };
      return {
        healthy: health.healthy === true,
        pulsating: health.healthy === true
      };
    };

    const serverStatus = getHealthStatus(serverHealth);
    const dbStatus = getHealthStatus(dbHealth);
    const apiStatus = getHealthStatus(apiHealth);

    // Overall health: all three must be healthy for pulsing red
    const allHealthy = serverStatus.healthy && dbStatus.healthy && apiStatus.healthy;

    // Pulsating animation class - only pulse when all are healthy
    const pulsatingClass = allHealthy ? 'animate-pulse' : '';

    // Health icon color - bright red when all healthy (pulsating), gray when any unhealthy (no pulse)
    const healthColor = allHealthy ? 'text-red-500' : 'text-gray-400';

    // User avatar or initials
    const renderAvatar = () => {
      if (user?.avatar) {
        return Row({ 
          tagType: 'img', 
          class: 'w-10 h-10 rounded-full object-cover',
          attributes: { src: user.avatar, alt: user.name }
        });
      }
      return Row({ 
        class: 'w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm'
      }, user?.initials || 'U');
    };

    return Row({ 
      class: 'w-full bg-white border-b border-gray-200 shadow-sm px-6 py-4 flex items-center justify-between'
    }, [
      // Left side: Toggle button and health indicators
      Row({ class: 'flex items-center gap-4' }, [
        // Hamburger menu toggle
        // Row({
        //   tagType: 'button',
        //   class: 'p-2 rounded-lg hover:bg-gray-100 transition-colors',
        //   events: {
        //     'click': () => props.viewModel.toggleNav()
        //   }
        // }, [
        //   Row({ 
        //     tagType: 'ion-icon', 
        //     attributes: { 
        //       name: 'menu-outline', 
        //       class: 'text-2xl text-gray-700' 
        //     } 
        //   })
        // ]),

      IconButton({class: 'p-2 rounded-lg hover:bg-gray-100 transition-colors', size: 'xlarge', onClick: () => props.viewModel.toggleNav()}, [
        IonIcon({name: 'menu-outline', class: 'text-4xl text-gray-700 font-bold'})
      ]),
        
        // Health indicators - all in one container with shared pulse and color
        Row({ 
          class: `flex items-center gap-3 ml-2 ${pulsatingClass} text-xl ${healthColor}`,
          attributes: {
            title: `Server: ${serverStatus.healthy ? 'Healthy' : 'Unhealthy'} | Database: ${dbStatus.healthy ? 'Healthy' : 'Unhealthy'} | API: ${apiStatus.healthy ? 'Healthy' : 'Unhealthy'}`
          }
        }, [
          Row({ 
            tagType: 'ion-icon', 
            attributes: { 
              name: 'server'
            } 
          }),
          Row({ 
            tagType: 'ion-icon', 
            attributes: { 
              name: 'cube'
            } 
          }),
          Row({ 
            tagType: 'ion-icon', 
            attributes: { 
              name: 'flash'
            } 
          })
        ])
      ]),
      // Right side: User info
      Row({ class: 'flex items-center gap-3' }, [
        Row({ tagType: 'span', class: 'text-gray-700 font-medium' }, user?.name || 'User'),
        renderAvatar()
      ])
    ]);
  };

  return StatefulRow({ viewModel }, render);
}

