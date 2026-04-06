export type IconName =
  | 'dashboard'
  | 'users'
  | 'swap'
  | 'briefcase'
  | 'upload'
  | 'badge'
  | 'chat';

export type NavItem = {
  id: string;
  label: string;
  icon: IconName;
  roles?: Array<'super' | 'wilayah' | 'ukpd'>;
  children?: NavItem[];
};

export const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
  },
  {
    id: 'pegawai',
    label: 'Data Pegawai',
    icon: 'users',
  },
  {
    id: 'usulan',
    label: 'Usulan',
    icon: 'swap',
    children: [
      {
        id: 'mutasi',
        label: 'Usulan Mutasi',
        icon: 'swap',
      },
      {
        id: 'putus-jf',
        label: 'Usulan Putus JF',
        icon: 'briefcase',
      },
    ],
  },
  {
    id: 'import-drh',
    label: 'Import DRH',
    icon: 'upload',
  },
  {
    id: 'duk',
    label: 'DUK Pegawai (PNS)',
    icon: 'badge',
  },
  {
    id: 'pangkat',
    label: 'Urutan Kepangkatan (PNS)',
    icon: 'badge',
  },
  {
    id: 'qna',
    label: 'QNA Admin Dinas',
    icon: 'chat',
    roles: ['super'],
  },
];
