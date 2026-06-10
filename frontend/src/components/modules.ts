import {
  Boxes, FileText, Users, BarChart3, UserSquare2,
  ClipboardList, Banknote, ScanLine, Package, Activity,
  ShoppingCart, Tags, Barcode, PieChart, type LucideIcon,
} from "lucide-react";

export interface NavItem { code: string; label: string; path: string; icon: LucideIcon; }

export const MODULE_NAV: NavItem[] = [
  { code: "billing",   label: "POS / Cashier",   path: "/pos",            icon: ScanLine      },
  { code: "billing",   label: "Invoices",         path: "/billing",        icon: FileText      },
  { code: "inventory", label: "Inventory",        path: "/inventory",      icon: Boxes         },
  { code: "inventory", label: "Purchases",        path: "/purchases",      icon: ShoppingCart  },
  { code: "inventory", label: "Sales",            path: "/sales",          icon: Tags          },
  { code: "inventory", label: "Barcode Labels",   path: "/barcodes",       icon: Barcode       },
  { code: "inventory", label: "Inv. Reports",     path: "/inventory-reports", icon: PieChart   },
  { code: "inventory", label: "Updates",          path: "/updates",        icon: Activity      },
  { code: "inventory", label: "Products",         path: "/products",       icon: Package       },
  { code: "crm",       label: "Customers",        path: "/customers",      icon: Users         },
  { code: "hr",        label: "Employees",        path: "/employees",      icon: UserSquare2   },
  { code: "hr",        label: "Leave Requests",   path: "/leave-requests", icon: ClipboardList },
  { code: "hr",        label: "Payroll",          path: "/payroll",        icon: Banknote      },
  { code: "reports",   label: "Reports",          path: "/reports",        icon: BarChart3     },
];

export const navForModules = (enabled: string[]) =>
  MODULE_NAV.filter((i) => enabled.includes(i.code));
