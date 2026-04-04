type StatusType = 'reservation' | 'reimbursement' | 'chemical_purchase' | 'equipment';

export interface StatusBadgeProps {
  status?: string;
  type?: StatusType;
  className?: string;
  children?: React.ReactNode;
  variant?: string;
}

interface StatusConfig {
  label: string;
  className: string;
}

const statusMap: Record<string, StatusConfig> = {
  pending: {
    label: '待审批',
    className: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  },
  approved: {
    label: '已批准',
    className: 'bg-green-50 text-green-700 ring-green-600/20',
  },
  rejected: {
    label: '已拒绝',
    className: 'bg-red-50 text-red-700 ring-red-600/20',
  },
  completed: {
    label: '已完成',
    className: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  },
  normal: {
    label: '正常',
    className: 'bg-green-50 text-green-700 ring-green-600/20',
  },
  maintenance: {
    label: '维护中',
    className: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  },
  broken: {
    label: '故障',
    className: 'bg-red-50 text-red-700 ring-red-600/20',
  },
  purchased: {
    label: '已采购',
    className: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  },
  received: {
    label: '已到货',
    className: 'bg-green-50 text-green-700 ring-green-600/20',
  },
};

export default function StatusBadge({ status, type: _type, className: extraClassName, children, variant }: StatusBadgeProps) {
  const resolvedStatus = status || variant || '';
  const config = statusMap[resolvedStatus] ?? {
    label: children || resolvedStatus,
    className: 'bg-gray-50 text-gray-700 ring-gray-600/20',
  };

  const label = children || config.label;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${config.className} ${extraClassName || ''}`}
    >
      {label}
    </span>
  );
}
