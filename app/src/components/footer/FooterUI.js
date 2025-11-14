const { Row } = Liteframe;

export default function FooterUI() {
  return Row({ 
    class: 'w-full bg-gradient-to-r from-blue-50 to-indigo-50 border-t border-gray-200 px-6 py-4'
  }, [
    Row({ class: 'max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4' }, [
      // Company info
      Row({ class: 'flex items-center gap-2' }, [
        Row({ tagType: 'ion-icon', attributes: { name: 'medical-outline', class: 'text-xl text-blue-600' } }),
        Row({ tagType: 'span', class: 'text-sm font-semibold text-gray-900' }, 'MaSaTech PharmaSuite'),
        Row({ tagType: 'span', class: 'text-xs text-gray-500 ml-2' }, 'Pharmaceutical Wholesale Management System')
      ]),
      
      // Bottom info
      Row({ 
        class: 'flex items-center gap-4 text-xs text-gray-500' 
      }, [
        Row({ tagType: 'span' }, '© 2024 MaSaTech Software Solutions'),
        Row({ tagType: 'span', class: 'text-gray-300' }, '|'),
        Row({ tagType: 'span' }, 'Version 1.0.0'),
        Row({ tagType: 'span', class: 'text-gray-300' }, '|'),
        Row({ 
          class: 'flex items-center gap-1' 
        }, [
          Row({ tagType: 'ion-icon', attributes: { name: 'shield-checkmark-outline', class: 'text-sm' } }),
          Row({ tagType: 'span' }, 'Secure & Compliant')
        ])
      ])
    ])
  ]);
}

