import React, { useEffect, useState } from 'react';
import { Check, X, Clock, Truck, PackageCheck, Info } from 'lucide-react';
import { getOrderEvents } from '../../services/orderService';
import { Order } from '../../types';

interface OrderTimelineProps {
  order: Order;
}

/** The forward flow; Cancelled is a terminal branch handled separately. */
const FLOW: Array<{ status: string; label: string }> = [
  { status: 'Confirmed', label: 'Order Placed' },
  { status: 'Processing', label: 'Processing' },
  { status: 'Shipped', label: 'Shipped' },
  { status: 'Delivered', label: 'Delivered' },
];

const STATUS_INDEX: Record<string, number> = {
  Pending: 0,
  Confirmed: 0,
  Processing: 1,
  Shipped: 2,
  Delivered: 3,
};

const fmt = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';

/** Customer-facing order timeline. Only real, stored events are shown —
 *  no fabricated courier tracking. */
export const OrderTimeline: React.FC<OrderTimelineProps> = ({ order }) => {
  const [events, setEvents] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    void getOrderEvents(order.id).then((rows) => {
      if (!mounted) return;
      const map: Record<string, string> = {};
      for (const row of rows) {
        if (row.event === 'order_placed') map['Order Placed'] = row.created_at;
        if (row.event === 'status_changed') map[row.metadata.new_status as string] = row.created_at;
        if (row.event === 'order_cancelled') map['Cancelled'] = row.created_at;
      }
      if (!map['Order Placed']) map['Order Placed'] = order.created_at;
      setEvents(map);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [order.id, order.created_at]);

  if (order.status === 'Cancelled') {
    return (
      <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 space-y-1.5 text-xs">
        <div className="flex items-center gap-2 font-bold text-red-700 dark:text-red-300">
          <X className="w-4 h-4" />
          <span>Order Cancelled</span>
          {events['Cancelled'] && (
            <span className="font-normal text-red-600/80 dark:text-red-400/80">{fmt(events['Cancelled'])}</span>
          )}
        </div>
        {order.cancellation_reason && (
          <p className="text-[11px] text-red-600/90 dark:text-red-300/90">
            Reason: {order.cancellation_reason}
          </p>
        )}
        {order.payment_status === 'Refund Required' && (
          <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold">
            This was a prepaid order — a manual refund review is required. Our team will contact you.
          </p>
        )}
      </div>
    );
  }

  const currentIdx = STATUS_INDEX[order.status] ?? 0;

  return (
    <div className="space-y-2">
      <div className="flex items-start">
        {FLOW.map((step, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          const date = events[step.label === 'Order Placed' ? 'Order Placed' : step.status];

          return (
            <React.Fragment key={step.label}>
              {idx > 0 && (
                <div className={`flex-1 h-0.5 mt-2.5 ${idx <= currentIdx ? 'bg-[#789A99] dark:bg-[#F1E194]' : 'bg-gray-200 dark:bg-[#7A1921]'}`} />
              )}
              <div className="flex flex-col items-center gap-1 shrink-0 w-14">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center transition ${
                    done || active
                      ? 'bg-[#789A99] dark:bg-[#F1E194] text-white dark:text-[#3F070B]'
                      : 'bg-gray-200 dark:bg-[#7A1921] text-gray-400'
                  }`}
                >
                  {step.status === 'Delivered' ? (
                    <PackageCheck className="w-3 h-3" />
                  ) : done || active ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Clock className="w-3 h-3" />
                  )}
                </div>
                <span className={`text-[9px] font-bold text-center leading-tight ${active ? 'text-[#2B1810] dark:text-[#FCF7DC]' : done ? 'text-[#789A99] dark:text-[#F1E194]' : 'text-gray-400'}`}>
                  {step.label}
                  <span className="block font-normal text-[8px] text-gray-400 min-h-[9px]">
                    {loading ? '' : fmt(date)}
                  </span>
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {(order.status === 'Shipped' || order.status === 'Delivered') && (
        <p className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-stone-500">
          <Truck className="w-3 h-3" />
          Tracking information is not available yet.
        </p>
      )}
      {loading && (
        <p className="flex items-center gap-1.5 text-[10px] text-gray-400">
          <Info className="w-3 h-3" /> Loading timeline…
        </p>
      )}
    </div>
  );
};
