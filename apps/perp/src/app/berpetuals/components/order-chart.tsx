"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { usePollPositionsLiqFeePrices } from "@bera/berajs";
import type { OpenTrade } from "@bera/proto/src";

import { formatFromBaseUnit } from "~/utils/formatBigNumber";
import { generateMarketOrders } from "~/utils/generateMarketOrders";
import { CloseOrderModal } from "~/app/components/close-order-modal";
import { TableContext } from "~/context/table-context";
import { usePollOpenLimitOrders } from "~/hooks/usePollOpenLimitOrders";
import { usePollOpenPositions } from "~/hooks/usePollOpenPositions";
import {
  type ChartingLibraryWidgetOptions,
  type ResolutionString,
} from "~/types/charting-library";
import { type IMarket } from "~/types/market";
import { ILimitOrder, IOpenTradeCalculated } from "~/types/order-history";
import { type TableStateProps } from "~/types/table";
import { ClosePositionModal } from "../../components/close-position-modal";
import type { ChartProps } from "./TVChartContainer";

export type OrderLine = {
  type: string;
  price: number;
  positionSize: string;
  onClose: () => void;
  onHighlight: () => void;
  tp?: number;
  sl?: number;
};

const TVChartContainer = dynamic(
  () =>
    import("./TVChartContainer").then(
      (mod) => mod.TVChartContainer as React.ComponentType<ChartProps>,
    ),
  {
    ssr: false,
  },
);

export function OrderChart({
  markets,
  marketName,
  chartReady,
  setChartError,
  setChartReady,
}: {
  markets: IMarket[];
  marketName: string;
  chartReady: boolean;
  setChartError: (error: string) => void;
  setChartReady: (ready: boolean) => void;
}) {
  const { tableState, setTableState } = useContext(TableContext);
  const { data: openPositionData } = usePollOpenPositions(tableState);
  const { data: openLimitOrdersData } = usePollOpenLimitOrders(tableState);

  const { data: openPositionsLiqFeesData } = usePollPositionsLiqFeePrices(
    openPositionData?.result
      ? openPositionData.result.map((position: OpenTrade) =>
          Number(position.index),
        )
      : [],
  );

  const openPositions = useMemo(() => {
    const positions = generateMarketOrders(openPositionData, markets);
    return positions.map((position, index) => {
      return {
        ...position,
        borrowing_fee:
          Array.isArray(openPositionsLiqFeesData) &&
          openPositionsLiqFeesData[1] &&
          openPositionsLiqFeesData[1][index] !== undefined
            ? openPositionsLiqFeesData[1][index].toString()
            : "0",
        liq_price:
          Array.isArray(openPositionsLiqFeesData) &&
          openPositionsLiqFeesData[0] &&
          openPositionsLiqFeesData[0][index] !== undefined
            ? openPositionsLiqFeesData[0][index].toString()
            : "0",
      };
    }) as IOpenTradeCalculated[];
  }, [openPositionData, markets, openPositionsLiqFeesData]);

  const openOrders = useMemo(() => {
    return generateMarketOrders(openLimitOrdersData, markets) as ILimitOrder[];
  }, [openLimitOrdersData, markets]);

  const [positionOpenState, setPositionOpenState] = useState(false);
  const [orderOpenState, setOrderOpenState] = useState(false);
  const [position, setPosition] = useState<IOpenTradeCalculated>();
  const [order, setOrder] = useState<ILimitOrder>();

  const defaultWidgetProps: Partial<ChartingLibraryWidgetOptions> = {
    symbol: marketName ?? "Not Found",
    interval: "15" as ResolutionString,
    library_path: "/static/charting_library/",
    locale: "en",
    charts_storage_url: "https://saveload.tradingview.com",
    charts_storage_api_version: "1.1",
    client_id: "tradingview.com",
    user_id: "public_user_id",
    fullscreen: false,
    autosize: true,
  };

  const humanizedPositions = useMemo(() => {
    return openPositions && tableState.tabType === "positions"
      ? openPositions.reduce<OrderLine[]>((acc, position, index) => {
          if (
            tableState.selection &&
            (Object.keys(tableState.selection).length === 0 ||
              tableState.selection[index]) &&
            position?.market?.name === marketName
          ) {
            const positionSize = formatFromBaseUnit(
              position.position_size,
              18,
            ).times(position.leverage ?? "1");
            const openPrice = formatFromBaseUnit(position.open_price, 10);
            const size = positionSize.div(openPrice).dp(4).toString(10);

            const pos = {
              price: Number(openPrice.toString(10)),
              type: position.buy ? "Long Position" : "Short Position",
              positionSize: size,
              onHighlight: () =>
                setTableState((tableState: TableStateProps) => ({
                  ...tableState,
                  selection: { ...tableState.selection, [index]: true },
                })),
              onClose: () => {
                setPosition(position);
                setPositionOpenState(true);
              },
            } as OrderLine;
            if (tableState.selection[index]) {
              pos.tp = Number(
                formatFromBaseUnit(position.tp ?? "0", 10).toString(10),
              );
              pos.sl = Number(
                formatFromBaseUnit(position.sl ?? "0", 10).toString(10),
              );
            }
            acc.push(pos);
          }
          return acc;
        }, [])
      : [];
  }, [openPositions, tableState]);

  const humanizedOrders = useMemo(() => {
    return openOrders && tableState.tabType === "orders"
      ? openOrders.reduce<OrderLine[]>((acc, order, index) => {
          if (
            tableState.selection &&
            (Object.keys(tableState.selection).length === 0 ||
              tableState.selection[index]) &&
            order?.market?.name === marketName
          ) {
            const positionSize = formatFromBaseUnit(
              order.position_size,
              18,
            ).times(order.leverage ?? "1");
            const openPrice = formatFromBaseUnit(order.min_price, 10);
            const size = positionSize.div(openPrice).dp(4).toString(10);

            const limit = {
              price: Number(openPrice),
              type: order.buy ? "Long Limit" : "Short Limit",
              positionSize: size,
              onHighlight: () =>
                setTableState((tableState: TableStateProps) => ({
                  ...tableState,
                  selection: { ...tableState.selection, [index]: true },
                })),
              onClose: () => {
                setOrder(order);
                setOrderOpenState(true);
              },
            } as OrderLine;
            if (tableState.selection[index]) {
              limit.tp = Number(
                formatFromBaseUnit(order.tp ?? "0", 10).toString(10),
              );
              limit.sl = Number(
                formatFromBaseUnit(order.sl ?? "0", 10).toString(10),
              );
            }
            acc.push(limit);
          }
          return acc;
        }, [])
      : [];
  }, [openOrders, tableState, marketName]);

  const orderLines = useMemo(() => {
    if (tableState.tabType === "positions") {
      return humanizedPositions;
    }
    if (tableState.tabType === "orders") {
      return humanizedOrders;
    }
    return [];
  }, [tableState.tabType, humanizedOrders, humanizedPositions]);

  return (
    <div className="grid h-full w-full rounded-md">
      <div className="h-full w-full rounded-md" style={{ gridArea: "1 / 1" }}>
        {position && (
          <ClosePositionModal
            controlledOpen={positionOpenState}
            openPosition={position}
            onOpenChange={setPositionOpenState}
          />
        )}
        {order && (
          <CloseOrderModal
            controlledOpen={orderOpenState}
            openOrder={order}
            onOpenChange={setOrderOpenState}
          />
        )}
        <TVChartContainer
          {...defaultWidgetProps}
          orderLines={orderLines}
          chartReady={chartReady}
          setChartReady={setChartReady}
          setChartError={setChartError}
        />
      </div>
    </div>
  );
}
