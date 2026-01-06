import { Button } from "../../utils/Button.js";
import { Input } from "../../utils/Input.js";
import { IonIcon } from "../../utils/Icon.js";
import Badge from "../../utils/Badge.js";
import { getApiAsset } from "../../../../electron/config/apiConfig.js";
import { formatUTCDate } from "../../shared/TimeConverters.js";
import RuleRow from "../../shared/RuleRow.js";
import Modal from "../../shared/Modal.js";

const { Row } = Liteframe;


export default function GeneralTabContent(props) {

  const user = props.viewModel.getState('selected-user');
  const userForm = props.viewModel.getState('user-form');
  // props.ensureLocalStateKey('isActive', user?.is_active || false);
  const isActive = userForm.is_active;

  const loading  = props.viewModel.getState('loading');


  const handleSave =  () => {
    props.viewModel.updateState('loading', false);
    const userForm = props.viewModel.getState('user-form');

    const userData = {
      display_name: userForm?.display_name ||  '',
      email: userForm?.email || '',
      is_active: isActive,
    };

    const userId = user.id;

    props.viewModel.updateUser(userId, userData);
  };


  const formRow = ({left, right}) => {
    return Row({ class: 'w-full flex justify-between items-center mb-6 gap-x-4 px-4' }, [
      Row({ class: 'flex-1/4'}, [
        left
      ]),
      Row({ class: 'flex-3/4 pr-6' }, [
        right,
        
      ]),
      
    ]);
  };

  const UserImage = () => {

    
    // props.ensureLocalStateKey('avatar-preview', getApiAsset(user.avatar_url) || '');
    const avatarPreview = props.viewModel.getState('avatar-preview');

    

    
    const handleFileChange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        return;
      }

      // Generate preview immediately (UX-first)
      const reader = new FileReader();
      reader.onload = () => {
        props.viewModel.updateState('avatar-preview', reader.result);
        props.viewModel.reload();
      };
      reader.readAsDataURL(file);

      try {
        // Pass file directly to VM (do NOT store in state)
        await props.viewModel.updateAvatar(file);
      } catch (error) {
        console.error('Avatar upload failed:', error);
      }
    };

  
  
    return Row({ class: 'flex gap-4' }, [
      Row({
        tagType: 'div',
        class: 'h-40 w-40 overflow-hidden rounded-md bg-gray-100 flex items-center justify-center',
      }, [
        Row({
          tagType: 'img',
          class: 'w-full h-full object-cover',
          attributes: {
            src: avatarPreview || '/img/erin-lindford.jpg',
            alt: userForm?.display_name || 'User Avatar',
            loading: 'lazy',
            decoding: 'async',
            onerror: "this.onerror=null;this.src='/erin-lindford.jpg';"
          }
        })
      ]),
      Row({ tagType: 'input', attributes: { type: 'file', accept: 'image/*', class: 'hidden', id: 'avatar-upload' }, events: { change: handleFileChange } }),
      
      Row({class: 'item-bottom'}, [
        Row({ tagType: 'label', attributes: { for: 'avatar-upload', class: 'cursor-pointer bg-gray-50 font-semibold hover:bg-gray-150 hover:text-indigo-800 text-indigo-950 px-4 py-2 rounded-md transition-colors flex items-center' } }, [
          Row({ tagType: 'ion-icon', attributes: { name: 'cloud-upload-outline', class: 'text-xl font-semibold mr-2' } }),
          'Upload New Photo'
        ]),
      ])        
    ]);
  };

  const handleUserChange = (e, key) => {
    const value = e.target.value.trim();
    if (!value) return;

    props.viewModel.updateUserForm(key, value);
  };

  const handleStatusChange = () => {
    props.viewModel.updateUserForm('is_active', !props.viewModel.getState('user-form').is_active);
    props.viewModel.updateState('loading', false);
  }

  return Row({ class: 'h-full w-full'}, [
    Row({ class: 'flex justify-end gap-4 px-4 mb-6' }, [
      Button({ variant: 'secondary', class: 'my-4 px-5', onClick: () => DeleteUserConfirmModal(props) }, 'Delete'),
      Button({ variant: 'primary', disabled: loading, class: 'my-4 px-5', onClick: handleSave }, 'Save'),
    ]),
    formRow({
      left: Row({ tagType: 'label', attributes: {for: 'full-name'}, class: 'text-gray-900 font-medium float-right' }, 'Full Name'), 
      right: Input({
        value: userForm?.display_name || '',
        class: 'text-gray-500 font-normal',
        onChange: (e) => handleUserChange(e, 'display_name'),
        name: 'full-name',
      }),
    }),
    formRow({
      left: Row({ tagType: 'label', attributes: {for: 'email'}, class: 'text-gray-900 font-medium float-right' }, 'Email'), 
      right: Input({
        value: userForm?.email || '',
        class: 'text-gray-500 font-normal',
        onChange: (e) => handleUserChange(e, 'email'),
        name: 'email',
      }),
    }),
    formRow({
      left: Row({ class: 'text-gray-900 font-medium float-right' }, 'Avatar'), 
      right: UserImage(),
    }), 
  
    formRow({
      left: Row({ class: 'text-gray-900 font-medium float-right' }, 'Status'),
      right: Row({ class: 'flex items-center gap-x-2' }, [
        Row({
          tagType: 'span',
          class: `bg-white h-12 w-20 flex items-center justify-center cursor-pointer
            transition-colors duration-300
            ${!isActive ? 'scale-x-[-1] text-red-300' : 'scale-x-[1] text-green-300'} `,
          events: {
            click: handleStatusChange
          }
        }, [
          Row({
            tagType: 'ion-icon',
            attributes: {
              name: 'toggle',
              class: 'text-6xl'
            }
          })
        ])
,
        Badge({
          label: isActive ? 'Active' : 'Inactive',
          tone: isActive ? 'success' : 'danger',
        })
      ]) ,
    }), 
    formRow({
      left: Row({ class: 'text-gray-900 font-medium float-right'}, "Registered"),
      right: Row({ class: 'text-gray-500 text-sm float-left'}, formatUTCDate(user.created_at))
    }),
    formRow({
      left: Row({ class: 'text-gray-900 font-medium float-right' }, "Last Login"),
      right: Row({ class: 'text-gray-500 text-sm float-left' }, formatUTCDate(user.last_login_at))
    })    
  ])
}

function DeleteUserConfirmModal(props) {
  Modal({}, (delegator, closeHandler) => {

    const user = props.viewModel.getState('selected-user');
    const deleteHandler = () => {
      props.viewModel.deleteUser(user.id);
      props.viewModel.updateState('selected-user', null)
      closeHandler();
    } 
    
    return Row({class: 'px-6 pb-2 flex flex-col border-t-4 border-indigo-600 bg-gray-50'}, [
      Row({class: 'flex items-center justify-center text-gray-500 text-md font-semibold my-4'}, 'Delete'),
      Row({tagTye: 'p', class: 'float-center text-sm text-gray-500'}, 'Are you sure to delete this user?'),
      Row({class: 'flex items-center justify-between gap-4 my-3'}, [
        Button({variant: 'secondary', class: 'w-25 rounded-sm', onClick: closeHandler, delegator }, 'Cancel'),
        Button({ variant: 'primary', class: 'w-25 rounded-sm', onClick: deleteHandler, delegator }, 'Delete')
      ])
  ])
})
}