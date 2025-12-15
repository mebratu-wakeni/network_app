import { Button, Spinner } from "../utils/Button";
import { Card, CardHeader, CardBody, CardFooter } from "../utils/Card";
import { IconButton, IonIcon } from "../utils/Icon";
import { Input } from "../utils/Input";
import Label from "../utils/Label";

const { Row, StatefulRow } = Liteframe;

// --- The Modal Content Component (Child) ---
const ModalContent = (viewModel, delegator, handleClose) => {

  const render = (props) => {
    props.ensureStateKey('creating');
    props.ensureStateKey('user-form');
    const creating = props.viewModel.getState('creating');
    const userForm = props.viewModel.getState('user-form');

    const handleSave = async () => {
      await props.viewModel.createUser();
      handleClose();
    }



    return Card({
      class: 'bg-white rounded-lg shadow-2xl w-full max-w-sm transform transition-all'
    }, [
      CardHeader({ class: 'flex justify-between items-center px-6 py-4' }, [
        Row({ tagType: 'h2', class: 'text-xl font-semibold text-gray-800' }, 'Create User'),
      ]),

      CardBody({}, [
        Label({ name: 'full-name', text: 'Full Name', class: 'mb-2' }),
        Input({ 
          name: 'full-name', value: userForm.display_name, placeholder: 'Enter name', class: 'mb-3', 
          onChange: (e) => props.viewModel.updateUserForm('display_name', e.target.value.trim()), delegator
        }),
        Label({ name: 'username', text: 'Username', class: 'mb-2' }),
        Input({ 
          id: 'user-search',
          name: 'username', placeholder: 'Enter username', class: 'mb-3', value: userForm.username,
          onChange: (e) => props.viewModel.updateUserForm('username', e.target.value.trim()), delegator
        }),
      ]),

      CardFooter({}, [
        Button({ variant: 'primary', delegator, onClick: handleSave, disabled: creating }, creating ? [Spinner(), 'Save' ] : 'Save'),
        Button({ variant: 'danger', onClick: handleClose, delegator }, 'Cancel'),
      ]),


    ]);

  }
  return StatefulRow({ class: 'fixed inset-0 bg-gray-800/0 flex items-center justify-center', viewModel }, render) 
};

export default ModalContent;