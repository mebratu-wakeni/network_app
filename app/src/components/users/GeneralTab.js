import { Button } from "../utils/Button";
import { Input } from "../utils/Input";
import { IonIcon } from "../utils/Icon.js";
import Badge from "../utils/Badge";

const { Row } = Liteframe;


export default function GeneralTabContent(props) {

  const user = props.viewModel.getState('selected-user');
  const userForm = props.viewModel.getState('user-form');
  props.ensureLocalStateKey('isActive', user?.is_active || false);
  const isActive = props.getLocalState('isActive');


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
    
    props.ensureLocalStateKey('avatar-preview', userForm.avatar_url || '');
    const avatarPreview = props.getLocalState('avatar-preview'); 

    
    const handleFileChange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Validate file type (optional)
      if (!file.type.startsWith('image/')) {
        console.log('Please select an image file');
        return;
      }

      props.viewModel.updateState('user-form', {
        ...userForm,
        file: file,
      })

      // Generate preview
      const reader = new FileReader();
      reader.onload = () => {
        props.setLocalState('avatar-preview', reader.result);
      };
      reader.readAsDataURL(file);
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
        Row({ tagType: 'label', attributes: { for: 'avatar-upload', class: 'cursor-pointer bg-gray-50 hover:bg-gray-400 text-indigo-950 px-4 py-2 rounded-md transition-colors flex items-center' } }, [
          Row({ tagType: 'ion-icon', attributes: { name: 'cloud-upload-outline', class: 'text-xl mr-2' } }),
          'Upload New Photo'
        ]),
      ])        
    ]);
  };

  return Row({class: 'h-full w-full'}, [
    Row({ class: 'flex justify-end gap-4 px-4 mb-6' }, [
      Button({ variant: 'secondary', class: 'my-4 px-5', onClick: () => {} }, 'Delete'),
      Button({ variant: 'primary', class: 'my-4 px-5', onClick: () => {} }, 'Save'),
    ]),
    formRow({
      left: Row({ class: 'text-gray-900 font-medium float-right' }, 'Full Name'), 
      right: Input({
        value: userForm?.display_name || '',
        class: 'text-gray-500 font-normal',
        onChange: (e) => {
          console.log(e.target.value);
        },
        name: 'full-name',
      }),
    }),
    formRow({
      left: Row({ class: 'text-gray-900 font-medium float-right' }, 'Email'), 
      right: Input({
        value: userForm?.email || '',
        class: 'text-gray-500 font-normal',
        onChange: (e) => {
          console.log(e.target.value);
        },
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
          tagType: 'span', class: `bg-white h-12 w-20 flex items-center 
        justify-center cursor-pointer transform transition-transform duration-0 ${!isActive ? 'rotate-180 text-red-300' : 'rotation-0 text-green-300'}`,
          events: { click: () => props.setLocalState('isActive', !props.getLocalState('isActive')) }
        }, [
          Row({ tagType: 'ion-icon', attributes: { name: 'toggle', class: 'text-6xl' } }),

        ]),
        Badge({
          label: isActive ? 'Active' : 'Inactive',
          tone: isActive ? 'success' : 'danger',
        })
      ]) ,
    }),    
  ])
}