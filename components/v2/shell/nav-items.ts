import {
  Activity,
  Award,
  BookOpen,
  CircleSlash,
  ClipboardCheck,
  ClipboardList,
  Columns3,
  FileText,
  KeyRound,
  ListOrdered,
  Merge,
  Package,
  Palette,
  TrainFront,
  Truck,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Rebuilt in v2: client-side navigation. Everything else is a v1 page. */
  v2?: boolean;
}

export interface NavGroup {
  label: string;
  adminOnly?: boolean;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Tenders",
    items: [
      { href: "/v2/tenders", label: "Tenders", icon: FileText, v2: true },
      { href: "/v2/pre-participation", label: "Pre Participation", icon: ClipboardList, v2: true },
      { href: "/v2/post-participation", label: "Post Participation", icon: ClipboardCheck, v2: true },
      { href: "/v2/not-participated", label: "Not Participated", icon: CircleSlash, v2: true },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/v2/supply-history", label: "Supply History", icon: Truck, v2: true },
      { href: "/v2/railways", label: "Railways", icon: TrainFront, v2: true },
      { href: "/v2/items", label: "Master Item List", icon: Package, v2: true },
      { href: "/v2/performance-certificates", label: "Performance Certificates", icon: Award, v2: true },
      { href: "/v2/emd", label: "EMD Merged", icon: Wallet, v2: true },
    ],
  },
  {
    label: "Reference",
    items: [
      { href: "/v2/credentials", label: "Links and Password", icon: KeyRound, v2: true },
      { href: "/v2/activity", label: "Activity", icon: Activity, v2: true },
      { href: "/v2/sop", label: "SOP", icon: BookOpen, v2: true },
    ],
  },
  {
    label: "Admin",
    adminOnly: true,
    items: [
      { href: "/admin/mappings", label: "Column Mappings", icon: Columns3 },
      { href: "/admin/indices", label: "Column Index", icon: ListOrdered },
      { href: "/admin/merging", label: "Column Merging", icon: Merge },
      { href: "/admin/sop", label: "SOP Responsibilities", icon: UsersRound },
      { href: "/v2/design", label: "Design System", icon: Palette, v2: true },
    ],
  },
];
