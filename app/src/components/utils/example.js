
const { Row } = Liteframe;
import { Button } from './Button.js';
import { Card, CardImage, CardHeader, CardBody,CardFooter } from './Card.js'
import { IconWrap, IonIcon } from './Icon.js';
const ExampleCard = () => {
  return Card({ className: 'w-full max-w-sm' }, [

    CardImage({
      src: 'https://th.bing.com/th/id/OIP.z_DiWRPIgoWVU22BaltFOwHaE_?o=7&cb=ucfimg2rm=3&ucfimg=1&rs=1&pid=ImgDetMain&o=7&rm=3',
      alt: 'A beautiful mountain landscape'
    }),

    CardHeader({ className: 'bg-gray-50' }, [
      // Example of using your existing Label component if desired, or just simple text
      Row({ tagType: 'h2', class: 'text-lg font-bold text-gray-900' }, 'Trip to the Alps')
    ]),

    CardBody({}, [
      Row({ tagType: 'p', class: 'text-gray-700' }, 'This is the main content describing the destination, available dates, and other details.'),
      Row({ tagType: 'ul', class: 'list-disc ml-5 mt-3 text-sm text-gray-600' }, [
        Row({ tagType: 'li' }, '5-day guided tour'),
        Row({ tagType: 'li' }, 'Includes accommodation and meals'),
      ])
    ]),

    CardFooter({}, [
      // Example Button component (conceptual, would need implementation)
      // Button({ class: 'text-sm bg-indigo-500 text-white' }, 'View Details'),
      // Button({ class: 'text-sm bg-gray-300 text-gray-800' }, 'Dismiss')
      // Row({ tagType: 'button', class: 'text-sm bg-indigo-500 text-white px-3 py-1 rounded' }, 'View Details'),
      // IconWrap({onClick: () => console.log('Caret is clicked')}, [IonIcon({name: 'caret-forward-outline', class: 'text-2xl' })]),
      // Button({ class: 'text-sm px-3 py-1 rounded', variant: 'outline' }, 'Detail View')
    ])
  ]);
};

export default ExampleCard;