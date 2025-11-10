const { Row, StatefulRow, }  = Liteframe;
import ServerManagerVM from './ServerManagerVM.js'

export default function serverManagerUI() {
  const viewModel = new ServerManagerVM();

  const render = (props) => {
    props.ensureStateKey('docker-status');
    props.ensureStateKey('server-status');
    props.ensureStateKey('api-health');
    // props.ensureStateKey('starting');
    // props.ensureStateKey('stopping');
    // props.ensureStateKey('refreshing');
    // props.ensureStateKey('error');
    // props.ensureStateKey('success');
    // props.ensureStateKey('lastUpdated');
    // props.ensureStateKey('mode');
    // props.ensureStateKey('dev-server-status');
    const dockerStatus = props.viewModel.getState('docker-status');
    const serverStatus = props.viewModel.getState('server-status');
    const apiHealth = props.viewModel.getState('api-health');
    const starting = props.viewModel.getState('starting');
    const stopping = props.viewModel.getState('stopping');
    const refreshing = props.viewModel.getState('refreshing');
    const error = props.viewModel.getState('error');
    const success = props.viewModel.getState('success');
    const lastUpdated = props.viewModel.getState('lastUpdated');
    const mode = props.viewModel.getState('mode');
    const devServerStatus = props.viewModel.getState('dev-server-status');
    
    // Check if any operation is in progress
    const anyOperationInProgress = starting || stopping || refreshing;

    // Loading Spinner Component
    const Spinner = () => Row({ 
      class: "inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"
    });

    return Row({class: 'p-6'}, [
      Row({ class: "flex justify-between items-center mb-6" }, [
        Row({ tagType: 'h1', class: "text-2xl font-bold" }, "Server Management"),
        // Mode Toggle
        Row({ class: "flex items-center gap-3" }, [
          Row({ tagType: 'span', class: "text-sm text-gray-600" }, mode === 'docker' ? 'Docker Mode' : 'Dev Mode'),
          Row({
            tagType: 'button',
            class: `px-3 py-1 rounded text-sm font-medium transition-colors ${
              mode === 'docker' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`,
            attributes: {
              disabled: anyOperationInProgress
            },
            events: {
              'click': () => props.viewModel.toggleMode()
            }
          }, 'Docker'),
          Row({
            tagType: 'button',
            class: `px-3 py-1 rounded text-sm font-medium transition-colors ${
              mode === 'dev' 
                ? 'bg-green-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`,
            attributes: {
              disabled: anyOperationInProgress
            },
            events: {
              'click': () => props.viewModel.toggleMode()
            }
          }, 'Dev'),
        ])
      ]),

      // Mode Info Banner
      mode === 'dev' && Row({ 
        class: "mb-6 p-3 bg-blue-50 border border-blue-200 rounded text-blue-800 text-sm" 
      }, [
        Row({ tagType: 'p', class: "font-semibold mb-1" }, "🚀 Development Mode"),
        Row({ tagType: 'p' }, "Running server directly from api/ directory. Faster startup, no Docker build required.")
      ]),

      // Success Display
      success && Row({ 
        class: "mb-6 p-4 bg-green-50 border border-green-200 rounded text-green-800" 
      }, [
        Row({ tagType: 'p', class: "font-semibold" }, `✅ ${success}`)
      ]),

      // Error Display
      error && Row({ 
        class: "mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-800" 
      }, [
        Row({ tagType: 'p', class: "font-semibold mb-2" }, "Error"),
        Row({ tagType: 'p', class: "whitespace-pre-line" }, error)
      ]),

      // Docker Status
      Row({ class: "mb-6 p-4 bg-gray-100 rounded" }, [
        Row({ tagType: 'h2', class: "text-xl font-semibold mb-2" }, 'Docker Status'),
        dockerStatus ? Row({}, [
          Row({ tagType: 'p' }, `Installed: ${dockerStatus.installed ? '✅ Yes' : '❌ No'}`),
          Row({ tagType: 'p' }, `Running: ${dockerStatus.running ? '✅ Yes' : '❌ No'}`),
          dockerStatus.error && Row({ tagType: 'p', class: "text-red-600" }, `Error: ${dockerStatus.error}`)
        ]) : Row({tagType: 'p', class: ""}, 'Checking...')
      ]),

      // Server Status (only show in Docker mode)
      mode === 'docker' && Row({ class: "mb-6 p-4 bg-gray-100 rounded" }, [
        Row({ tagType: 'h2', class: "text-xl font-semibold mb-2" }, 'Docker Services Status'),
        
        serverStatus === null && Row({ tagType: 'p', class: "" }, 'Checking...'),
        
        serverStatus?.success === false && Row({ tagType: 'p', class: "text-red-600" }, 
          `Error: ${serverStatus.error || 'Failed to get server status'}`
        ),
        
        serverStatus?.success && (
          serverStatus?.services?.length > 0 ? 
            serverStatus.services.map(service => (
              Row({ class: 'mb-2', attributes: { key: service.name } }, [
                Row({ tagType: 'p' }, [
                  `${service.name}: `,
                  Row({ tagType: 'span', class: `${service.status === 'running' ? 'text-green-600' : 'text-red-600'}` },
                    `${service.status}`
                  )
                ])
              ]))
            ) :
            Row({ tagType: 'p', class: "text-gray-500" }, 'No services found')
        )
      ]),

      // Dev Server Status (only show in Dev mode)
      mode === 'dev' && Row({ class: "mb-6 p-4 bg-gray-100 rounded" }, [
        Row({ tagType: 'h2', class: "text-xl font-semibold mb-2" }, 'Development Server Status'),
        
        devServerStatus === null && Row({ tagType: 'p', class: "" }, 'Checking...'),
        
        devServerStatus && Row({}, [
          Row({ tagType: 'p' }, [
            'Status: ',
            devServerStatus.running ? 
              Row({ tagType: 'span', class: "text-green-600 font-semibold" }, '✅ Running') : 
              Row({ tagType: 'span', class: "text-red-600 font-semibold" }, '❌ Stopped')
          ]),
          devServerStatus.error && Row({ tagType: 'p', class: "text-red-600 text-sm mt-2" }, 
            `Error: ${devServerStatus.error}`
          )
        ])
      ]),

      // API health
      Row({ class: "mb-6 p-4 bg-gray-100 rounded" }, [
        Row({ tagType: 'h2', class: "text-xl font-semibold mb-2" }, 'API Health'),
        apiHealth === null && Row({ tagType: 'p', class: "" }, 'Checking...'),
        apiHealth && Row({tagType: 'p'}, [
          'Status: ',
          apiHealth.healthy ? 
            Row({ tagType: 'span', class: "text-green-600 font-semibold" }, '✅ Healthy') : 
            Row({ tagType: 'span', class: "text-red-600 font-semibold" }, `❌ Unhealthy${apiHealth.error ? `: ${apiHealth.error}` : ''}`)
        ])
      ]),

      // Controls
      Row({ class: 'flex gap-4 items-center' }, [
        Row({ 
          tagType: 'button', 
          class: "px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50 hover:bg-green-600 transition-colors flex items-center", 
          attributes: {
            disabled: anyOperationInProgress
          }, 
          events: {
            'click': async function () { 
              await props.viewModel.handleStart() 
            },
          }
        }, starting ? [Spinner(), 'Starting...'] : mode === 'dev' ? 'Start Dev Server' : 'Start Server'),
        Row({
          tagType: 'button', 
          class: "px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50 hover:bg-red-600 transition-colors flex items-center", 
          attributes: {
            disabled: anyOperationInProgress
          }, 
          events: {
            'click': async function () { 
              await props.viewModel.handleStop();
            }
          }
        }, stopping ? [Spinner(), 'Stopping...'] : mode === 'dev' ? 'Stop Dev Server' : 'Stop Server'),
        Row({
          tagType: 'button', 
          class: "px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50 hover:bg-blue-600 transition-colors flex items-center", 
          attributes: {
            disabled: anyOperationInProgress
          }, 
          events: {
            'click': async function () {
              await props.viewModel.checkStatus(true); // Manual refresh - show loading
            }
          }
        }, refreshing ? [Spinner(), 'Refreshing...'] : 'Refresh Status'),
      ]),
      
      // Last Updated Timestamp
      lastUpdated && Row({ 
        class: "mt-4 text-sm text-gray-500 text-center" 
      }, `Last updated: ${lastUpdated}`),
      
    ])
  };

  return StatefulRow({ viewModel }, render)
}