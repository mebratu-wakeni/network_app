const { Row, StatefulRow }  = Liteframe;
import ServerManagerVM from './ServerManagerVM.js'

export default function ServerManagerUI() {
  // Create new instance (ServerManagerVM handles cleanup of previous instance internally)
  const viewModel = new ServerManagerVM();

  const render = (props) => {
    props.ensureStateKey('starting');
    props.ensureStateKey('stopping');
    props.ensureStateKey('refreshing');
    props.ensureStateKey('error');
    props.ensureStateKey('success');
    props.ensureStateKey('lastUpdated');
    props.ensureStateKey('mode');
    props.ensureStateKey('dev-server-status');
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
    const connectionInfo = props.viewModel.getState('connection-info');
    const licenseStatus = props.viewModel.getState('license-status');
    const licenseExpiryInfo = props.viewModel.getState('license-expiry-info');
    const devServerStatus = props.viewModel.getState('dev-server-status');

    const anyOperationInProgress = starting || stopping || refreshing;

    const Spinner = () => Row({ 
      class: "inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"
    });

    const copyText = async (text) => {
      try {
        if (!text || !navigator?.clipboard) return
        await navigator.clipboard.writeText(text)
        props.viewModel.updateState('success', 'Copied to clipboard')
        setTimeout(() => props.viewModel.updateState('success', null), 2000)
      } catch (e) {
        props.viewModel.updateState('error', 'Unable to copy to clipboard')
        setTimeout(() => props.viewModel.updateState('error', null), 3000)
      }
    }

    const isRunning = !!devServerStatus?.running
    const primaryLanUrl = connectionInfo?.lanUrls?.[0] || null
    const license = licenseStatus?.license || null
    const licenseType = license?.subscription_type || '-'
    const licenseStatusLabel = licenseStatus?.valid ? 'Active' : (licenseStatus?.reason || 'Unavailable')
    const licenseExpiryLabel = licenseExpiryInfo?.label || (license?.expires_at ? String(license.expires_at).slice(0, 10) : '-')

    return Row({class: 'p-6 h-full flex-1 min-h-0 overflow-y-auto'}, [
      Row({ class: "flex justify-between items-center mb-4" }, [
        Row({ tagType: 'h1', class: "text-2xl font-bold" }, "Server"),
        Row({ class: "text-xs text-gray-600" }, `Mode: ${mode || 'server'}`)
      ]),

      success && Row({ 
        class: "mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-800" 
      }, [
        Row({ tagType: 'p', class: "font-semibold" }, `✅ ${success}`)
      ]),

      error && Row({ 
        class: "mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800" 
      }, [
        Row({ tagType: 'p', class: "font-semibold mb-2" }, "Error"),
        Row({ tagType: 'p', class: "whitespace-pre-line" }, error)
      ]),

      mode === 'client' && Row({
        class: 'mb-4 p-3 rounded border border-amber-200 bg-amber-50 text-amber-800'
      }, 'This machine is configured as Client. Server controls are read-only.'),

      mode === 'server' && licenseExpiryInfo?.expiringSoon && Row({
        class: 'mb-4 p-3 rounded border border-amber-200 bg-amber-50 text-amber-800'
      }, `License expires soon: ${licenseExpiryInfo.label}. Please renew to avoid service interruption.`),

      mode === 'server' && licenseExpiryInfo?.expired && Row({
        class: 'mb-4 p-3 rounded border border-red-200 bg-red-50 text-red-800'
      }, 'License is expired. Renew/reactivate to continue normal operation.'),

      Row({ class: "mb-4 p-4 bg-white border border-gray-200 rounded" }, [
        Row({ tagType: 'h2', class: "text-lg font-semibold mb-3" }, 'Connection Details'),
        mode === 'server' && Row({ class: 'space-y-2 text-sm' }, [
          Row({}, `Port: ${connectionInfo?.port || '-'}`),
          Row({ class: 'flex items-center gap-2' }, [
            Row({}, `Primary LAN URL: ${primaryLanUrl || 'No LAN IP detected'}`),
            primaryLanUrl ? Row({
              tagType: 'button',
              class: 'px-2 py-1 text-xs border rounded hover:bg-gray-50',
              events: { click: async () => copyText(primaryLanUrl) }
            }, 'Copy') : null
          ]),
          Row({ class: 'flex items-center gap-2' }, [
            Row({}, `Local URL: ${connectionInfo?.localhostUrl || '-'}`),
            connectionInfo?.localhostUrl ? Row({
              tagType: 'button',
              class: 'px-2 py-1 text-xs border rounded hover:bg-gray-50',
              events: { click: async () => copyText(connectionInfo.localhostUrl) }
            }, 'Copy') : null
          ]),
          connectionInfo?.lanUrls?.length > 1
            ? Row({ class: 'text-xs text-gray-500' }, `Also available on ${connectionInfo.lanUrls.length - 1} additional network interface(s).`)
            : null
        ]),
        mode === 'client' && Row({ class: 'text-sm' }, [
          Row({}, `Connected server: ${connectionInfo?.apiRoot || 'Not configured'}`),
          connectionInfo?.apiRoot ? Row({
            tagType: 'button',
            class: 'mt-2 px-2 py-1 text-xs border rounded hover:bg-gray-50',
            events: { click: async () => copyText(connectionInfo.apiRoot) }
          }, 'Copy URL') : null
        ])
      ]),

      Row({ class: "mb-4 p-4 bg-white border border-gray-200 rounded" }, [
        Row({ tagType: 'h2', class: "text-lg font-semibold mb-3" }, 'Runtime Health'),
        Row({ class: 'space-y-2 text-sm' }, [
          Row({}, `Process: ${isRunning ? 'Running' : 'Stopped'}`),
          Row({}, `API Health: ${apiHealth?.healthy ? 'Healthy' : (apiHealth?.error ? `Unhealthy (${apiHealth.error})` : 'Unknown')}`),
          serverStatus?.success === false
            ? Row({ class: 'text-red-600' }, `Status error: ${serverStatus.error || 'Failed to get service status'}`)
            : null,
          devServerStatus?.error
            ? Row({ class: 'text-red-600' }, `Process error: ${devServerStatus.error}`)
            : null
        ])
      ]),

      mode === 'server' && Row({ class: "mb-4 p-4 bg-white border border-gray-200 rounded" }, [
        Row({ tagType: 'h2', class: "text-lg font-semibold mb-3" }, 'License'),
        Row({ class: 'space-y-2 text-sm' }, [
          Row({}, `Status: ${licenseStatusLabel}`),
          Row({}, `Type: ${licenseType}`),
          Row({}, `Duration: ${licenseExpiryLabel}`),
          Row({}, `Company: ${license?.company_name || '-'}`)
        ])
      ]),

      Row({ class: 'flex gap-3 items-center flex-wrap' }, [
        Row({ 
          tagType: 'button', 
          class: "px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50 hover:bg-green-600 transition-colors flex items-center", 
          attributes: {
            disabled: anyOperationInProgress || mode !== 'server'
          }, 
          events: {
            'click': async function () { 
              await props.viewModel.handleStart() 
            },
          }
        }, starting ? [Spinner(), 'Starting...'] : 'Start Server'),
        Row({
          tagType: 'button', 
          class: "px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50 hover:bg-red-600 transition-colors flex items-center", 
          attributes: {
            disabled: anyOperationInProgress || mode !== 'server'
          }, 
          events: {
            'click': async function () { 
              await props.viewModel.handleStop();
            }
          }
        }, stopping ? [Spinner(), 'Stopping...'] : 'Stop Server'),
        Row({
          tagType: 'button', 
          class: "px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50 hover:bg-blue-600 transition-colors flex items-center", 
          attributes: {
            disabled: anyOperationInProgress
          }, 
          events: {
            'click': async function () {
              await props.viewModel.checkStatus(true);
            }
          }
        }, refreshing ? [Spinner(), 'Refreshing...'] : 'Refresh Status'),
      ]),

      lastUpdated && Row({ 
        class: "mt-4 text-xs text-gray-500 text-center" 
      }, `Last updated: ${lastUpdated}`),
      
    ])
  };

  // Render and return the component
  return StatefulRow({ class: 'h-full flex flex-col min-h-0', viewModel }, render);
}