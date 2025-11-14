const { Row, Router } = Liteframe;
import NavigationUI from "./components/navigation/NavigationUI.js";
import ServerManagerUI from "./components/serverManager/ServerManagerUI.js";
import HeaderUI from "./components/header/HeaderUI.js";
import FooterUI from "./components/footer/FooterUI.js";

export function App() {
  const main = Row({ tagType: 'div', class: 'flex-1 overflow-auto' });

  const router = new Router(main);


  return Row({ class: "App flex h-screen" }, [
    Row({ tagType: 'section', class: "w-75 h-screen bg-blue-800 shadow-md flex flex-col transition-all duration-300", attributes: { id: 'sidebar' } }, [
      HeadNav(),
      NavigationUI(router),
      FootNav()
    ]),
    Row({ tagType: 'section', class: "flex-1 flex flex-col h-screen overflow-hidden bg-gray-50" }, [
      HeaderUI(),
      Row({ tagType: 'div', class: 'flex-1 overflow-auto' }, [main]),
      FooterUI()
    ])
  ])
}

function HeadNav() {
  return Row({ class: "p-4" }, [
    Row({ class: 'p-3 flex items-center gap-3' }, [
      Row({ tagType: 'ion-icon', attributes: { name: 'apple-logo-outline', class: 'text-3xl text-white font-bold' } }),
      Row({ tagType: 'span', class: 'text-3xl text-white font-bold' }, 'MasaTech')
    ]),
  ])
}



function FootNav() {
  return Row({ class: "p-4 border-t border-blue-900" }, [
    Row({ tagType: 'button', class: "w-full bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition" }, "Logout")
  ])
}