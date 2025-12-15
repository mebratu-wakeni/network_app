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
    props.ensureStateKey('serverHealth');
    props.ensureStateKey('dbHealth');
    props.ensureStateKey('apiHealth');
    props.ensureStateKey('user');

    props.viewModel.syncUser();


    
    
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
      class: 'h-18 w-full bg-white border-b border-gray-200 shadow-sm px-6 py-4 flex items-center justify-between'
    }, [
      // Left side: Toggle button and health indicators
      Row({ class: 'flex items-center gap-4' }, [

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

