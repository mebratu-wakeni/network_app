const { Row, StatefulRow } = Liteframe;
import { IonIcon } from "../../utils/Icon";
import UsersProfileVM from "./ProfileVM";
import { UserDetails } from "./UserDetail";


export default function UserProfile() {

  const viewModel = new UsersProfileVM();


  const render = (props) => {
    return Row({ class: 'w-full h-full flex flex-col' }, [
      ErrorToast(props),
      SuccessToast(props),
      UserDetails(props),
    ]);
  }

  return StatefulRow({class: 'w-full h-full',  viewModel, stateKeys: ['loading', 'profileTab']}, render)
  
}

function ErrorToast(props) {
  const error = props.viewModel.getState('error');
  if (!error) return false;
  closeToast('error', props);

  const message =
    typeof error === 'string'
      ? error
      : error.message || 'An unexpected error occurred';

  const handleClose = () => {
    props.viewModel.updateState('error', null);
    props.viewModel.updateState('loading', false);
  };

  return Row(
    {
      class: `
        absolute top-0 left-0 right-0
        mx-auto
        z-50
        min-w-[320px] max-w-[640px]
        px-4 py-3
        rounded-b-md
        border border-red-200
        bg-red-50
        shadow-lg
        flex items-start gap-3
        animate-toast-slide-down
      `
    },
    [
      IonIcon({
        name: 'alert-circle-outline',
        class: 'text-red-600 text-xl mt-0.5 flex-shrink-0'
      }),

      Row(
        { class: 'text-sm text-red-800 leading-snug flex-1' },
        message
      ),

      IonIcon({
        name: 'close-outline',
        class:
          'text-red-600 text-xl cursor-pointer hover:text-red-800 transition-colors',
        events: { "click": handleClose }
      })
    ]
  );
}

function SuccessToast(props) {
  const success = props.viewModel.getState('success');
  if (!success) return false;
  
  closeToast('success', props);

  console.log('success message: ', success.message);

  const message =
    typeof success === 'string'
      ? success
      : success.message || 'Operation completed successfully';

  const handleClose = async () => {
    await props.viewModel.sleep(300)
    props.viewModel.updateState('success', null);
    props.viewModel.updateState('loading', false);


  };

  return Row(
    {
      class: `
        absolute top-0 left-0 right-0
        mx-auto
        z-50
        min-w-[320px] max-w-[640px]
        px-4 py-3
        rounded-b-md
        border border-green-200
        bg-green-50
        shadow-lg
        flex items-start gap-3
        animate-toast-slide-down
      `
    },
    [
      /* Icon */
      IonIcon({
        name: 'checkmark-circle-outline',
        class: 'text-green-600 text-xl mt-0.5 flex-shrink-0'
      }),

      /* Message */
      Row(
        { class: 'text-sm text-green-800 leading-snug flex-1' },
        message
      ),

      /* Close */
      IonIcon({
        name: 'close-outline',
        class:
          'text-green-600 text-xl cursor-pointer hover:text-green-800 transition-colors',
        events: { 'click': handleClose }
      })
    ]
  );
}

async function closeToast(type, props) {
  await props.viewModel.sleep(1000);
  props.viewModel.updateState(type, null);
}

