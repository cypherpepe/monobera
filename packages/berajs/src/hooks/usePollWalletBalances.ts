import useSWR from "swr";
import { usePublicClient } from "wagmi";

import { getWalletBalances } from "~/actions";
import POLLING from "~/enum/polling";
import {
  BalanceToken,
  DefaultHookOptions,
  DefaultHookReturnType,
  type Token,
} from "..";
import { useBeraJs } from "../contexts";
import { useTokens } from "./useTokens";

export type UsePollWalletBalancesArgs = {
  externalTokenList?: Token[];
};
export interface UsePollBalancesResponse
  extends DefaultHookReturnType<BalanceToken[] | undefined> {
  useSelectedWalletBalance: (address: string) => BalanceToken | undefined;
  useSelectedTagWalletBalances: (tag: string) => BalanceToken[] | undefined;
}

export const usePollWalletBalances = (
  args?: UsePollWalletBalancesArgs,
  options?: DefaultHookOptions,
): UsePollBalancesResponse => {
  const publicClient = usePublicClient();
  const { account, isConnected, config: beraConfig } = useBeraJs();
  const { data: tokenData } = useTokens({
    beraConfigOverride: options?.beraConfigOverride,
  });
  const QUERY_KEY = [
    account,
    isConnected,
    tokenData?.tokenList,
    "assetWalletBalances",
    args?.externalTokenList,
  ];

  const swrResponse = useSWR<BalanceToken[] | undefined>(
    QUERY_KEY,
    async () => {
      return getWalletBalances({
        account,
        tokenList: [
          ...(tokenData?.tokenList ?? []),
          ...(args?.externalTokenList ?? []),
        ],
        config: options?.beraConfigOverride ?? beraConfig,
        publicClient,
      });
    },
    {
      ...options?.opts,
      refreshInterval: options?.opts?.refreshInterval ?? POLLING.NORMAL,
    },
  );

  const useSelectedWalletBalance = (
    address: string,
  ): BalanceToken | undefined => {
    return swrResponse.data?.find(
      (item: Token) => item.address.toLowerCase() === address.toLowerCase(),
    );
  };

  const useSelectedTagWalletBalances = (
    tag: string,
  ): BalanceToken[] | undefined => {
    return swrResponse.data?.filter((item: Token) => item.tags?.includes(tag));
  };

  return {
    ...swrResponse,
    refresh: () => swrResponse?.mutate?.(),
    useSelectedWalletBalance,
    useSelectedTagWalletBalances,
  };
};
