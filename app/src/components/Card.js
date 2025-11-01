const { Row } = Liteframe;
const viteLogo = '../../vite.svg';




function Card() {
  return Row({ class: "mx-auto flex max-w-sm items-center gap-x-4 rounded-xl bg-white p-6 shadow-lg outline outline-black/5 dark:bg-slate-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10" }, [
    Row({ tagType: 'img', class: "size-12 shrink-0", attributes: { src: viteLogo, alt: "ChitChat Logo" } }, []),
    Row({}, [
      Row({ class: "text-xl font-medium text-black dark:text-white" }, "ChitChat"),
      Row({ tagType: 'p', class: "text-gray-500 dark:text-gray-400" }, "You have a new message!")
    ])
  ])
}

function ProfileCard() {
  return Row({ class: "mx-auto max-w-sm flex rounded-xl flex-col gap-2 p-8 shadow-lg sm:flex-row sm:items-center sm:gap-6 sm:py-4 mt-8" }, [
    Row({ tagType: 'img', class: "mx-auto block h-24 rounded-full sm:mx-0 sm:shrink-0", attributes: { src: "../../img/erin-lindford.jpg", alt: "" } }),
    Row({ class: "space-y-2 text-center sm:text-left" }, [
      Row({ class: "space-y-0.5" }, [
        Row({ class: "text-lg font-semibold text-black" }, "Erin Lindford"),
        Row({ class: "font-medium text-gray-500" }, "Product Engineer")
      ]),
      Row({ tagType: 'button', class: "btn-primary" }, "Message")
    ])
  ])
}
export { Card, ProfileCard };