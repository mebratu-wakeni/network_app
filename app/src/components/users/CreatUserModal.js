import { Button } from "../utils/Button";
import { Card, CardHeader, CardBody, CardFooter } from "../utils/Card";
import { IconButton, IonIcon } from "../utils/Icon";
import { Input } from "../utils/Input";
import Label from "../utils/Label";

const { Row } = Liteframe;

// --- The Modal Content Component (Child) ---
const ModalContent = (delegator, handleClose) => {
  return Card({
    class: 'bg-white rounded-lg shadow-2xl w-full max-w-sm transform transition-all'
  }, [
    CardHeader({class: 'flex justify-between items-center'}, [
      Row({ tagType: 'h2', class: 'text-xl font-semibold text-gray-800' }, 'Create User'),
    ]),

    CardBody({}, [
      Label({ name: 'full-name', text: 'Full Name', class: 'mb-2' }),
      Input({ name: 'full-name', placeholder: 'Enter name', class: 'mb-3'}),
      Label({ name: 'username', text: 'Username', class: 'mb-2' }),
      Input({ name: 'username', placeholder: 'Enter username', class: 'mb-3' }),
    ]),

    CardFooter({}, [
      Button({variant: 'primary', delegator}, 'Save'),
      Button({variant: 'danger', onClick: handleClose, delegator}, 'Cancel'),
    ]),


  ]);
};

export default ModalContent;