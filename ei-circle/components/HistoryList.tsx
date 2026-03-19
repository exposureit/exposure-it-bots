'use client';

import React from 'react';

interface Order {
  orderId: string;
  servicesOrdered: string;
  invoiceAmount: string;
  pointsThisOrder: number;
  creditUsed: string;
  status: string;
  dateOrdered: string;
  datePaid: string;
  referralOrder: string;
  notes: string;
}

interface HistoryListProps {
  orders: Order[];
}

export default function HistoryList({ orders }: HistoryListProps) {
  return (
    <section>
      {/* Section Header */}
      <h2
        style={{ fontFamily: 'Poppins, sans-serif', fontSize: '18px' }}
        className="font-bold text-[#F1F1F1] mb-4"
      >
        Recent Activity
        <span className="text-[#49D400]">.</span>
      </h2>

      {/* Empty State */}
      {orders.length === 0 && (
        <p
          style={{ fontFamily: 'Inter, sans-serif', color: 'rgba(187,187,187,0.5)' }}
          className="text-sm"
        >
          No transactions yet.
        </p>
      )}

      {/* Transaction List */}
      <div>
        {orders.map((order) => {
          const isReferral = order.referralOrder === 'Yes';
          const isPending = order.status === 'Pending';
          const displayName = isReferral
            ? `Referral: ${order.servicesOrdered}`
            : order.servicesOrdered;

          return (
            <div
              key={order.orderId}
              className="rounded-xl p-4 mb-2"
              style={{
                backgroundColor: '#111111',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {/* Top Row */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className="text-sm font-medium truncate"
                    style={{ fontFamily: 'Inter, sans-serif', color: '#F1F1F1' }}
                  >
                    {displayName}
                  </span>
                  {isPending && (
                    <span
                      className="shrink-0 uppercase font-semibold rounded px-1.5 py-0.5"
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '8px',
                        color: '#F59E0B',
                        backgroundColor: 'rgba(245,158,11,0.12)',
                        letterSpacing: '0.5px',
                      }}
                    >
                      PENDING
                    </span>
                  )}
                </div>
                <span
                  className="font-bold shrink-0"
                  style={{
                    fontFamily: 'Poppins, sans-serif',
                    color: '#49D400',
                    fontSize: '14px',
                  }}
                >
                  +{order.pointsThisOrder}
                </span>
              </div>

              {/* Bottom Row */}
              <div className="flex items-center justify-between mt-1.5">
                <span
                  className="text-xs"
                  style={{ fontFamily: 'Inter, sans-serif', color: 'rgba(187,187,187,0.5)' }}
                >
                  {order.dateOrdered}
                </span>
                <span
                  className="text-xs"
                  style={{ fontFamily: 'Inter, sans-serif', color: '#BBBBBB' }}
                >
                  ${order.invoiceAmount}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
